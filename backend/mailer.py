"""
mailer.py — Resend integration for transactional email (OTP + password reset).

REMINDER: Resend testing mode only delivers to verified addresses.
For the sandbox `onboarding@resend.dev` sender, mail may only reach the
account owner. Users seeing "Email sent successfully" without receiving
should upgrade the Resend account and verify a real sender domain.
"""
from __future__ import annotations

import os
import asyncio
import logging
from typing import Optional

import resend

log = logging.getLogger("mailer")

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL   = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
SENDER_NAME    = os.environ.get("SENDER_NAME", "QuantAI")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

FROM_LINE = f"{SENDER_NAME} <{SENDER_EMAIL}>"


# ─────────────────────────────────────────────
# Templates (Thai, table-based, inline CSS)
# ─────────────────────────────────────────────
def _base_template(title: str, body_html: str) -> str:
    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fafaf9;padding:40px 20px;">
  <tr><td align="center">
    <table role="presentation" width="480" cellspacing="0" cellpadding="0"
           style="background:#ffffff;border:1px solid #e5e5e4;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:32px 32px 8px 32px;">
        <table role="presentation" cellspacing="0" cellpadding="0"><tr>
          <td style="width:36px;height:36px;background:#2f5bd6;border-radius:8px;text-align:center;color:#fff;font-weight:800;font-size:16px;line-height:36px;">Q</td>
          <td style="padding-left:12px;font-weight:700;color:#0b0f19;font-size:16px;">QuantAI</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:20px 32px 8px 32px;">
        <h1 style="margin:0;font-size:22px;font-weight:800;color:#0b0f19;letter-spacing:-0.02em;">{title}</h1>
      </td></tr>
      <tr><td style="padding:12px 32px 32px 32px;color:#3f4650;font-size:14px;line-height:1.65;">
        {body_html}
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #e5e5e4;color:#6b7280;font-size:12px;background:#f5f5f4;">
        อีเมลนี้ส่งอัตโนมัติจาก QuantAI — โปรดอย่าตอบกลับ<br/>
        หากคุณไม่ได้เป็นผู้ทำรายการนี้ ให้ไม่ต้องสนใจอีเมลนี้
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""


def otp_email_html(code: str, purpose: str = "register") -> str:
    intro = "ยินดีต้อนรับสู่ QuantAI! กรุณาใช้รหัส OTP ด้านล่างเพื่อยืนยันอีเมลของคุณ" \
            if purpose == "register" \
            else "กรุณาใช้รหัส OTP ด้านล่างเพื่อยืนยันตัวตน"
    body = f"""
      <p>{intro}</p>
      <div style="margin:24px 0;padding:18px;background:#eff2fc;border:1px dashed #4a72e0;
                  border-radius:8px;text-align:center;">
        <div style="font-family:'Courier New',monospace;font-size:32px;font-weight:800;
                    letter-spacing:0.35em;color:#2f5bd6;">{code}</div>
      </div>
      <p style="color:#6b7280;font-size:13px;">รหัสนี้จะหมดอายุใน <b>10 นาที</b></p>
    """
    return _base_template("ยืนยันอีเมลของคุณ", body)


def reset_email_html(link: str) -> str:
    body = f"""
      <p>เราได้รับคำขอเปลี่ยนรหัสผ่านของบัญชีคุณ กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่</p>
      <div style="margin:24px 0;text-align:center;">
        <a href="{link}"
           style="display:inline-block;padding:12px 28px;background:#2f5bd6;color:#fff;
                  text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;">
          ตั้งรหัสผ่านใหม่
        </a>
      </div>
      <p style="color:#6b7280;font-size:12px;word-break:break-all;">
        หรือคัดลอกลิงก์: <a href="{link}" style="color:#2f5bd6;">{link}</a>
      </p>
      <p style="color:#6b7280;font-size:13px;">ลิงก์นี้จะหมดอายุใน <b>1 ชั่วโมง</b></p>
    """
    return _base_template("รีเซ็ตรหัสผ่าน", body)


# ─────────────────────────────────────────────
# Send
# ─────────────────────────────────────────────
async def send_email(to: str, subject: str, html: str) -> Optional[str]:
    """Send email via Resend. Returns email_id on success, None on failure (never raises)."""
    if not RESEND_API_KEY:
        log.warning("RESEND_API_KEY not set — skipping email to %s", to)
        return None
    params = {"from": FROM_LINE, "to": [to], "subject": subject, "html": html}
    try:
        resp = await asyncio.to_thread(resend.Emails.send, params)
        email_id = resp.get("id") if isinstance(resp, dict) else None
        log.info("sent email to %s (id=%s)", to, email_id)
        return email_id
    except Exception as e:
        log.error("resend failed for %s: %s", to, e)
        return None


async def send_otp(to: str, code: str, purpose: str = "register") -> Optional[str]:
    subject = "รหัสยืนยันอีเมล QuantAI" if purpose == "register" else "รหัสยืนยันตัวตน QuantAI"
    return await send_email(to, subject, otp_email_html(code, purpose))


async def send_reset_link(to: str, link: str) -> Optional[str]:
    return await send_email(to, "รีเซ็ตรหัสผ่าน QuantAI", reset_email_html(link))
