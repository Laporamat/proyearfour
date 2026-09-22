"""
auth.py — Auth for QuantAI.

Supported flows:
  * Emergent Google OAuth  (existing) — POST /api/auth/session
  * Email + password           (new)  — POST /api/auth/register + verify-otp
  * Password reset via email   (new)  — POST /api/auth/forgot-password + reset-password

All flows converge on the SAME session cookie (`session_token`, httpOnly,
Secure, SameSite=None) so `ProtectedRoute` and `/api/auth/me` are unchanged.

Collections:
  users                  — {user_id, email, name, picture, password_hash?, is_verified,
                             auth_provider, created_at, last_login}
  user_sessions          — {user_id, session_token, expires_at, created_at}
  email_otps             — {email, code, purpose, attempts, expires_at, created_at}
  password_reset_tokens  — {email, token, expires_at, used, created_at}
"""
from __future__ import annotations

import os
import re
import uuid
import secrets
import logging
from datetime import datetime, timezone, timedelta

import bcrypt
import httpx
from fastapi import FastAPI, Request, Response, HTTPException
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient

from mailer import send_otp, send_reset_link

log = logging.getLogger("auth")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME   = os.environ["DB_NAME"]

_client = AsyncIOMotorClient(MONGO_URL)
db = _client[DB_NAME]

EMERGENT_AUTH_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
SESSION_TTL_DAYS = 7
OTP_TTL_MINUTES  = 10
RESET_TTL_HOURS  = 1
MAX_OTP_ATTEMPTS = 5
COOKIE_NAME      = "session_token"

_INDEXES_READY = False


async def _ensure_indexes() -> None:
    global _INDEXES_READY
    if _INDEXES_READY:
        return
    try:
        await db.users.create_index("email", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.email_otps.create_index("email")
        await db.email_otps.create_index("expires_at", expireAfterSeconds=0)
        await db.password_reset_tokens.create_index("token", unique=True)
        await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
        _INDEXES_READY = True
    except Exception as e:
        log.warning("index creation failed: %s", e)


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
def _hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def _verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def _valid_password(pw: str) -> bool:
    return isinstance(pw, str) and 8 <= len(pw) <= 128


def _norm_email(email: str) -> str:
    return (email or "").strip().lower()


def _gen_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )


async def _issue_session(user_id: str) -> str:
    token = f"tok_{uuid.uuid4().hex}{secrets.token_hex(8)}"
    await db.user_sessions.insert_one({
        "user_id":       user_id,
        "session_token": token,
        "expires_at":    _now() + timedelta(days=SESSION_TTL_DAYS),
        "created_at":    _now(),
    })
    return token


def _public_user(u: dict) -> dict:
    return {
        "user_id":  u.get("user_id"),
        "email":    u.get("email"),
        "name":     u.get("name"),
        "picture":  u.get("picture") or "",
        "provider": u.get("auth_provider", "google"),
        "is_verified": bool(u.get("is_verified", False)),
    }


async def _resolve_token(request: Request) -> str | None:
    tok = request.cookies.get(COOKIE_NAME)
    if tok:
        return tok
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()
    return None


async def _current_user(request: Request) -> dict | None:
    tok = await _resolve_token(request)
    if not tok:
        return None
    sess = await db.user_sessions.find_one({"session_token": tok}, {"_id": 0})
    if not sess:
        return None
    exp = sess.get("expires_at")
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if not exp or exp < _now():
        return None
    return await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0, "password_hash": 0})


# ─────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────
class RegisterIn(BaseModel):
    email:    EmailStr
    password: str = Field(min_length=8, max_length=128)
    name:     str = Field(min_length=1, max_length=80)

class VerifyOtpIn(BaseModel):
    email: EmailStr
    code:  str = Field(min_length=6, max_length=6)

class ResendOtpIn(BaseModel):
    email: EmailStr

class LoginIn(BaseModel):
    email:    EmailStr
    password: str

class ForgotIn(BaseModel):
    email: EmailStr

class ResetIn(BaseModel):
    token:    str = Field(min_length=10)
    password: str = Field(min_length=8, max_length=128)

class ChangePasswordIn(BaseModel):
    current_password: str
    new_password:     str = Field(min_length=8, max_length=128)

class DeleteAccountIn(BaseModel):
    password: str = ""

class UpdateProfileIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)


# ─────────────────────────────────────────────
# Registration
# ─────────────────────────────────────────────
def register(app: FastAPI) -> None:

    @app.on_event("startup")
    async def _prepare():
        await _ensure_indexes()

    # ── Google OAuth (existing) ───────────────
    @app.post("/api/auth/session")
    async def create_session(request: Request, response: Response):
        try:
            body = await request.json()
        except Exception:
            body = {}
        session_id = body.get("session_id") or request.headers.get("X-Session-ID")
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id required")

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.get(
                    EMERGENT_AUTH_SESSION_URL,
                    headers={"X-Session-ID": session_id},
                )
        except Exception as e:
            log.warning("emergent oauth network error: %s", e)
            raise HTTPException(status_code=502, detail=f"OAuth service unreachable: {e}")

        if r.status_code != 200:
            log.warning("emergent session-data failed %s: %s", r.status_code, r.text[:200])
            # bubble up the actual message so users see WHY (not just generic "failed")
            detail = "OAuth session invalid or expired"
            try:
                j = r.json()
                if isinstance(j, dict) and j.get("detail"):
                    detail = str(j["detail"])
            except Exception:
                if r.text:
                    detail = r.text[:180]
            raise HTTPException(status_code=401, detail=detail)

        data = r.json()
        email   = _norm_email(data.get("email", ""))
        name    = data.get("name") or email
        picture = data.get("picture") or ""
        token   = data.get("session_token")
        if not (email and token):
            raise HTTPException(status_code=502, detail="Malformed OAuth response")

        now = _now()
        existing = await db.users.find_one({"email": email}, {"_id": 0})
        if existing:
            user_id = existing["user_id"]
            await db.users.update_one({"user_id": user_id}, {
                "$set": {"name": name, "picture": picture, "last_login": now, "is_verified": True},
            })
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            await db.users.insert_one({
                "user_id":       user_id,
                "email":         email,
                "name":          name,
                "picture":       picture,
                "auth_provider": "google",
                "is_verified":   True,
                "created_at":    now,
                "last_login":    now,
            })

        await db.user_sessions.insert_one({
            "user_id":       user_id,
            "session_token": token,
            "expires_at":    now + timedelta(days=SESSION_TTL_DAYS),
            "created_at":    now,
        })
        _set_session_cookie(response, token)
        return _public_user({"user_id": user_id, "email": email, "name": name, "picture": picture,
                             "auth_provider": "google", "is_verified": True})

    # ── Email register ───────────────────────
    @app.post("/api/auth/register")
    async def register_email(inp: RegisterIn):
        email = _norm_email(inp.email)

        existing = await db.users.find_one({"email": email}, {"_id": 0})
        if existing and existing.get("is_verified"):
            raise HTTPException(status_code=409, detail="อีเมลนี้ถูกใช้แล้ว กรุณาเข้าสู่ระบบ")

        password_hash = _hash_password(inp.password)
        now = _now()

        if existing:
            # unverified — allow re-registration to update password & resend OTP
            user_id = existing["user_id"]
            await db.users.update_one({"user_id": user_id}, {
                "$set": {
                    "name":          inp.name,
                    "password_hash": password_hash,
                    "auth_provider": "email",
                    "updated_at":    now,
                },
            })
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            await db.users.insert_one({
                "user_id":       user_id,
                "email":         email,
                "name":          inp.name,
                "picture":       "",
                "password_hash": password_hash,
                "auth_provider": "email",
                "is_verified":   False,
                "created_at":    now,
            })

        # issue OTP
        code = _gen_otp()
        await db.email_otps.delete_many({"email": email, "purpose": "register"})
        await db.email_otps.insert_one({
            "email":      email,
            "code":       code,
            "purpose":    "register",
            "attempts":   0,
            "expires_at": now + timedelta(minutes=OTP_TTL_MINUTES),
            "created_at": now,
        })
        email_id = await send_otp(email, code, purpose="register")
        log.info("OTP for %s: %s (email_id=%s)", email, code, email_id)

        return {
            "status":    "otp_sent",
            "email":     email,
            "ttl_min":   OTP_TTL_MINUTES,
            "delivered": bool(email_id),
        }

    @app.post("/api/auth/verify-otp")
    async def verify_otp(inp: VerifyOtpIn, response: Response):
        email = _norm_email(inp.email)
        code  = inp.code.strip()

        rec = await db.email_otps.find_one({"email": email, "purpose": "register"}, {"_id": 1, "code": 1, "attempts": 1, "expires_at": 1})
        if not rec:
            raise HTTPException(status_code=400, detail="ไม่พบรหัส OTP กรุณาขอใหม่")

        exp = rec.get("expires_at")
        if isinstance(exp, str):
            exp = datetime.fromisoformat(exp)
        if exp and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if not exp or exp < _now():
            await db.email_otps.delete_one({"_id": rec["_id"]})
            raise HTTPException(status_code=400, detail="รหัส OTP หมดอายุ กรุณาขอใหม่")

        if rec.get("attempts", 0) >= MAX_OTP_ATTEMPTS:
            await db.email_otps.delete_one({"_id": rec["_id"]})
            raise HTTPException(status_code=429, detail="กรอกรหัสผิดเกินกำหนด กรุณาขอ OTP ใหม่")

        if rec["code"] != code:
            await db.email_otps.update_one({"_id": rec["_id"]}, {"$inc": {"attempts": 1}})
            raise HTTPException(status_code=400, detail="รหัส OTP ไม่ถูกต้อง")

        # success → verify & login
        await db.email_otps.delete_one({"_id": rec["_id"]})
        user = await db.users.find_one({"email": email}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")

        await db.users.update_one({"user_id": user["user_id"]},
                                  {"$set": {"is_verified": True, "last_login": _now()}})
        token = await _issue_session(user["user_id"])
        _set_session_cookie(response, token)
        user["is_verified"] = True
        return _public_user(user)

    @app.post("/api/auth/resend-otp")
    async def resend_otp(inp: ResendOtpIn):
        email = _norm_email(inp.email)
        user  = await db.users.find_one({"email": email}, {"_id": 0, "is_verified": 1})
        if not user:
            raise HTTPException(status_code=404, detail="ไม่พบอีเมลนี้ในระบบ")
        if user.get("is_verified"):
            raise HTTPException(status_code=400, detail="บัญชีนี้ยืนยันแล้ว")

        code = _gen_otp()
        now = _now()
        await db.email_otps.delete_many({"email": email, "purpose": "register"})
        await db.email_otps.insert_one({
            "email": email, "code": code, "purpose": "register", "attempts": 0,
            "expires_at": now + timedelta(minutes=OTP_TTL_MINUTES), "created_at": now,
        })
        email_id = await send_otp(email, code, purpose="register")
        log.info("OTP (resend) for %s: %s", email, code)
        return {"status": "otp_sent", "ttl_min": OTP_TTL_MINUTES, "delivered": bool(email_id)}

    # ── Login ────────────────────────────────
    @app.post("/api/auth/login")
    async def login(inp: LoginIn, response: Response):
        email = _norm_email(inp.email)
        user  = await db.users.find_one({"email": email}, {"_id": 0})
        if not user or not user.get("password_hash"):
            raise HTTPException(status_code=401, detail="อีเมลหรือรหัสผ่านไม่ถูกต้อง")
        if not _verify_password(inp.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="อีเมลหรือรหัสผ่านไม่ถูกต้อง")
        if not user.get("is_verified"):
            raise HTTPException(status_code=403, detail="กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ")

        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"last_login": _now()}})
        token = await _issue_session(user["user_id"])
        _set_session_cookie(response, token)
        return _public_user(user)

    # ── Forgot / Reset ───────────────────────
    @app.post("/api/auth/forgot-password")
    async def forgot_password(inp: ForgotIn, request: Request):
        email = _norm_email(inp.email)
        user  = await db.users.find_one({"email": email}, {"_id": 0, "password_hash": 1, "user_id": 1})

        # generic response regardless of existence (prevents email enumeration)
        generic = {"status": "sent", "message": "ถ้าอีเมลนี้อยู่ในระบบ เราได้ส่งลิงก์รีเซ็ตไปให้แล้ว"}
        if not user or not user.get("password_hash"):
            return generic

        token = secrets.token_urlsafe(32)
        now   = _now()
        await db.password_reset_tokens.insert_one({
            "email":      email,
            "user_id":    user["user_id"],
            "token":      token,
            "expires_at": now + timedelta(hours=RESET_TTL_HOURS),
            "used":       False,
            "created_at": now,
        })
        origin = (request.headers.get("origin")
                  or f"{request.url.scheme}://{request.url.hostname}")
        link = f"{origin}/reset-password?token={token}"
        email_id = await send_reset_link(email, link)
        log.info("password reset link for %s: %s (email_id=%s)", email, link, email_id)
        return generic

    @app.post("/api/auth/reset-password")
    async def reset_password(inp: ResetIn):
        rec = await db.password_reset_tokens.find_one({"token": inp.token})
        if not rec or rec.get("used"):
            raise HTTPException(status_code=400, detail="ลิงก์ไม่ถูกต้องหรือถูกใช้แล้ว")
        exp = rec.get("expires_at")
        if isinstance(exp, str):
            exp = datetime.fromisoformat(exp)
        if exp and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if not exp or exp < _now():
            raise HTTPException(status_code=400, detail="ลิงก์หมดอายุ")

        await db.users.update_one(
            {"email": rec["email"]},
            {"$set": {"password_hash": _hash_password(inp.password), "updated_at": _now()}},
        )
        await db.password_reset_tokens.update_one({"_id": rec["_id"]}, {"$set": {"used": True}})
        # invalidate all sessions of this user (force re-login)
        await db.user_sessions.delete_many({"user_id": rec["user_id"]})
        return {"status": "ok", "message": "รีเซ็ตรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่"}

    # ── Session mgmt ─────────────────────────
    @app.get("/api/auth/me")
    async def me(request: Request):
        user = await _current_user(request)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        return _public_user(user)

    @app.post("/api/auth/logout")
    async def logout(request: Request, response: Response):
        tok = await _resolve_token(request)
        if tok:
            await db.user_sessions.delete_many({"session_token": tok})
        response.delete_cookie(COOKIE_NAME, path="/", samesite="none", secure=True)
        return {"ok": True}

    # ── Change password ──────────────────────
    @app.post("/api/auth/change-password")
    async def change_password(request: Request, inp: ChangePasswordIn):
        user = await _current_user(request)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        if not user.get("password_hash"):
            raise HTTPException(status_code=400, detail="บัญชีนี้ใช้ Google OAuth — ไม่มีรหัสผ่านให้เปลี่ยน")
        if not _verify_password(inp.current_password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="รหัสผ่านปัจจุบันไม่ถูกต้อง")
        if not _valid_password(inp.new_password):
            raise HTTPException(status_code=400, detail="รหัสผ่านใหม่ต้องมี 8-128 ตัวอักษร")
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"password_hash": _hash_password(inp.new_password), "updated_at": _now()}},
        )
        # Invalidate all sessions (force re-login)
        await db.user_sessions.delete_many({"user_id": user["user_id"]})
        return {"ok": True, "message": "เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่"}

    # ── Update profile ────────────────────────
    @app.patch("/api/auth/profile")
    async def update_profile(request: Request, inp: UpdateProfileIn):
        user = await _current_user(request)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"name": inp.name.strip(), "updated_at": _now()}},
        )
        updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
        return _public_user(updated)

    # ── Delete account ───────────────────────
    @app.delete("/api/auth/account")
    async def delete_account(request: Request, response: Response, inp: DeleteAccountIn):
        user = await _current_user(request)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        # If password-based account, verify password
        if user.get("password_hash"):
            if not _verify_password(inp.password, user["password_hash"]):
                raise HTTPException(status_code=401, detail="รหัสผ่านไม่ถูกต้อง")
        user_id = user["user_id"]
        # Delete all user data
        await db.users.delete_one({"user_id": user_id})
        await db.user_sessions.delete_many({"user_id": user_id})
        await db.user_portfolios.delete_many({"user_id": user_id})
        await db.user_watchlists.delete_many({"user_id": user_id})
        await db.user_tickers.delete_many({"user_id": user_id})
        response.delete_cookie(COOKIE_NAME, path="/", samesite="none", secure=True)
        return {"ok": True, "message": "ลบบัญชีสำเร็จ"}
