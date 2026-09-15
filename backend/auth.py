"""
auth.py — Emergent-managed Google Auth for QuantAI.

Endpoints:
  POST /api/auth/session   — exchange session_id (from URL fragment) for a session_token,
                             upsert the user, set httpOnly cookie
  GET  /api/auth/me        — return the authenticated user (cookie or Bearer)
  POST /api/auth/logout    — clear cookie + delete DB session

REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
"""
from __future__ import annotations

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import FastAPI, Request, Response, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

log = logging.getLogger("auth")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME   = os.environ["DB_NAME"]

_client = AsyncIOMotorClient(MONGO_URL)
db = _client[DB_NAME]

EMERGENT_AUTH_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
SESSION_TTL_DAYS = 7
COOKIE_NAME = "session_token"


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
async def _resolve_session_token(request: Request) -> str | None:
    """Read token from httpOnly cookie first, then Authorization: Bearer fallback."""
    tok = request.cookies.get(COOKIE_NAME)
    if tok:
        return tok
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()
    return None


async def _current_user(request: Request) -> dict | None:
    tok = await _resolve_session_token(request)
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
    if not exp or exp < datetime.now(timezone.utc):
        return None

    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    return user


# ─────────────────────────────────────────────
# Registration
# ─────────────────────────────────────────────
def register(app: FastAPI) -> None:

    @app.post("/api/auth/session")
    async def create_session(request: Request, response: Response):
        """
        Exchange the one-time session_id (issued by Emergent Auth) for a
        long-lived session_token; upsert the user; set an httpOnly cookie.
        """
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        session_id = body.get("session_id") or request.headers.get("X-Session-ID")
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id required")

        # Call Emergent Auth from BACKEND (never from frontend)
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                EMERGENT_AUTH_SESSION_URL,
                headers={"X-Session-ID": session_id},
            )
        if r.status_code != 200:
            log.warning("emergent session-data failed %s: %s", r.status_code, r.text[:200])
            raise HTTPException(status_code=401, detail="Invalid session_id")

        data = r.json()
        email   = data.get("email")
        name    = data.get("name") or email
        picture = data.get("picture") or ""
        token   = data.get("session_token")
        if not (email and token):
            raise HTTPException(status_code=502, detail="Malformed session-data response")

        # Upsert user by email
        now = datetime.now(timezone.utc)
        existing = await db.users.find_one({"email": email}, {"_id": 0})
        if existing:
            user_id = existing["user_id"]
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"name": name, "picture": picture, "last_login": now}},
            )
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            await db.users.insert_one({
                "user_id":    user_id,
                "email":      email,
                "name":       name,
                "picture":    picture,
                "created_at": now,
                "last_login": now,
            })

        expires_at = now + timedelta(days=SESSION_TTL_DAYS)
        await db.user_sessions.insert_one({
            "user_id":       user_id,
            "session_token": token,
            "expires_at":    expires_at,
            "created_at":    now,
        })

        response.set_cookie(
            key=COOKIE_NAME,
            value=token,
            max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
        )
        return {
            "user_id": user_id,
            "email":   email,
            "name":    name,
            "picture": picture,
        }

    @app.get("/api/auth/me")
    async def me(request: Request):
        user = await _current_user(request)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        return user

    @app.post("/api/auth/logout")
    async def logout(request: Request, response: Response):
        tok = await _resolve_session_token(request)
        if tok:
            await db.user_sessions.delete_many({"session_token": tok})
        response.delete_cookie(COOKIE_NAME, path="/", samesite="none", secure=True)
        return {"ok": True}
