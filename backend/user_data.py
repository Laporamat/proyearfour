"""
user_data.py — Per-user data persistence (Portfolio, Watchlist, custom tickers)
                + Price Alert email notifications.

All endpoints require an authenticated session (same cookie as auth.py).

Collections:
  user_portfolios   — {user_id, items: [{id, ticker, shares, buyDate, buyPrice}]}
  user_watchlists   — {user_id, items: [{id, ticker, target, note, alerted}]}
  user_tickers      — {user_id, tickers: [str]}
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient

from auth import _current_user, db
from live import get_live_snapshot
from mailer import send_price_alert

log = logging.getLogger("user_data")


# ─────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────
class HoldingIn(BaseModel):
    ticker:   str = Field(min_length=1, max_length=20)
    shares:   float = Field(gt=0)
    buyDate:  str
    buyPrice: float

class WatchlistItemIn(BaseModel):
    ticker: str = Field(min_length=1, max_length=20)
    target: float | None = None
    note:   str = ""

class TickerIn(BaseModel):
    ticker: str = Field(min_length=1, max_length=20)


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
async def _require_user(request: Request) -> dict:
    user = await _current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


# ─────────────────────────────────────────────
# Registration
# ─────────────────────────────────────────────
def register(app: FastAPI) -> None:

    # ════════════════════════════════════════════
    # PORTFOLIO
    # ════════════════════════════════════════════
    @app.get("/api/user/portfolio")
    async def get_portfolio(request: Request):
        user = await _require_user(request)
        doc = await db.user_portfolios.find_one({"user_id": user["user_id"]}, {"_id": 0})
        return {"items": doc["items"] if doc else []}

    @app.post("/api/user/portfolio")
    async def add_holding(request: Request, inp: HoldingIn):
        user = await _require_user(request)
        item = {
            "id":       f"h_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}",
            "ticker":   inp.ticker.upper().strip(),
            "shares":   inp.shares,
            "buyDate":  inp.buyDate,
            "buyPrice": inp.buyPrice,
        }
        await db.user_portfolios.update_one(
            {"user_id": user["user_id"]},
            {"$push": {"items": item}, "$setOnInsert": {"user_id": user["user_id"]}},
            upsert=True,
        )
        return item

    @app.delete("/api/user/portfolio/{item_id}")
    async def delete_holding(request: Request, item_id: str):
        user = await _require_user(request)
        result = await db.user_portfolios.update_one(
            {"user_id": user["user_id"]},
            {"$pull": {"items": {"id": item_id}}},
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="ไม่พบรายการที่ต้องการลบ")
        return {"ok": True}

    # ════════════════════════════════════════════
    # WATCHLIST
    # ════════════════════════════════════════════
    @app.get("/api/user/watchlist")
    async def get_watchlist(request: Request):
        user = await _require_user(request)
        doc = await db.user_watchlists.find_one({"user_id": user["user_id"]}, {"_id": 0})
        return {"items": doc["items"] if doc else []}

    @app.post("/api/user/watchlist")
    async def add_watchlist_item(request: Request, inp: WatchlistItemIn):
        user = await _require_user(request)
        # Check duplicate
        existing = await db.user_watchlists.find_one({"user_id": user["user_id"]})
        if existing:
            for it in existing.get("items", []):
                if it["ticker"] == inp.ticker.upper().strip():
                    raise HTTPException(status_code=409, detail="หุ้นนี้อยู่ใน Watchlist แล้ว")
        item = {
            "id":      f"w_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}",
            "ticker":  inp.ticker.upper().strip(),
            "target":  inp.target,
            "note":    inp.note.strip(),
            "alerted": False,
        }
        await db.user_watchlists.update_one(
            {"user_id": user["user_id"]},
            {"$push": {"items": item}, "$setOnInsert": {"user_id": user["user_id"]}},
            upsert=True,
        )
        return item

    @app.delete("/api/user/watchlist/{item_id}")
    async def delete_watchlist_item(request: Request, item_id: str):
        user = await _require_user(request)
        result = await db.user_watchlists.update_one(
            {"user_id": user["user_id"]},
            {"$pull": {"items": {"id": item_id}}},
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="ไม่พบรายการที่ต้องการลบ")
        return {"ok": True}

    # ════════════════════════════════════════════
    # PRICE ALERTS
    # ════════════════════════════════════════════
    @app.post("/api/user/watchlist/check-alerts")
    async def check_price_alerts(request: Request):
        """Check watchlist items against live prices; email the user when a
        target is hit for the first time.  Returns a summary of alerts sent."""
        user = await _require_user(request)
        doc = await db.user_watchlists.find_one({"user_id": user["user_id"]})
        items = doc.get("items", []) if doc else []
        if not items:
            return {"checked": 0, "alerts_sent": 0}

        # Fetch live prices (cached, 60s TTL)
        try:
            snapshot = await get_live_snapshot()
            prices = snapshot.get("prices", {})
        except Exception as e:
            log.warning("alert check: live prices unavailable: %s", e)
            return {"checked": 0, "alerts_sent": 0, "error": "live prices unavailable"}

        alerts_sent = 0
        newly_alerted_ids: list[str] = []

        for item in items:
            if item.get("alerted"):
                continue
            target = item.get("target")
            if not target:
                continue
            current = prices.get(item["ticker"])
            if current is None:
                continue
            if current <= target:
                # Hit! Send email
                email_id = await send_price_alert(
                    user.get("email", ""),
                    user.get("name", ""),
                    item["ticker"],
                    current,
                    target,
                    item.get("note", ""),
                )
                if email_id:
                    alerts_sent += 1
                newly_alerted_ids.append(item["id"])

        # Mark alerted items so we don't email twice
        if newly_alerted_ids:
            await db.user_watchlists.update_one(
                {"user_id": user["user_id"]},
                {"$set": {f"items.$[elem].alerted": True for _ in newly_alerted_ids}},
                array_filters=[{"elem.id": {"$in": newly_alerted_ids}}],
            )

        return {
            "checked": len(items),
            "alerts_sent": alerts_sent,
            "newly_alerted": newly_alerted_ids,
        }

    # ════════════════════════════════════════════
    # CUSTOM TICKERS
    # ════════════════════════════════════════════
    @app.get("/api/user/tickers")
    async def get_custom_tickers(request: Request):
        user = await _require_user(request)
        doc = await db.user_tickers.find_one({"user_id": user["user_id"]}, {"_id": 0})
        return {"tickers": doc["tickers"] if doc else []}

    @app.post("/api/user/tickers")
    async def add_custom_ticker(request: Request, inp: TickerIn):
        user = await _require_user(request)
        ticker = inp.ticker.upper().strip()
        await db.user_tickers.update_one(
            {"user_id": user["user_id"]},
            {"$addToSet": {"tickers": ticker}, "$setOnInsert": {"user_id": user["user_id"]}},
            upsert=True,
        )
        return {"ticker": ticker}

    @app.delete("/api/user/tickers/{ticker}")
    async def delete_custom_ticker(request: Request, ticker: str):
        user = await _require_user(request)
        await db.user_tickers.update_one(
            {"user_id": user["user_id"]},
            {"$pull": {"tickers": ticker.upper().strip()}},
        )
        return {"ok": True}
