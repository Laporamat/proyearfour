"""
Portfolio Manager — Multi-portfolio + Dividend tracking
=========================================================
รองรับการสร้างหลายพอร์ต (เช่น พอร์ตเกษียณ, พอร์ตเก็งกำไร)
และติดตามเงินปันผล + ผลตอบแทนรวม (total return)

Collections:
  user_multi_portfolios — {
    user_id: "xxx",
    portfolios: [
      {
        id: "p_xxx",
        name: "พอร์ตหลัก",
        icon: "📊",
        created_at: "...",
        items: [{id, ticker, shares, buyDate, buyPrice}]
      }
    ]
  }

Backward compatibility: หากผู้ใช้เคยใช้ระบบเดิม (user_portfolios collection)
  จะ migrate ข้อมูลเดิมเข้าเป็น "พอร์ตหลัก" อัตโนมัติ
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

import pandas as pd
import yfinance as yf
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel, Field

from auth import _current_user, db
from live import get_live_snapshot

log = logging.getLogger("portfolio_manager")

DEFAULT_PORTFOLIO_NAME = "พอร์ตหลัก"
DEFAULT_PORTFOLIO_ICON = "📊"


# ─────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────
class PortfolioCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    icon: str = Field(default="📊", max_length=10)

class PortfolioUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=50)
    icon: str | None = Field(None, max_length=10)

class HoldingIn(BaseModel):
    ticker:   str = Field(min_length=1, max_length=20)
    shares:   float = Field(gt=0)
    buyDate:  str
    buyPrice: float


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
async def _require_user(request: Request) -> dict:
    user = await _current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def _get_or_init_portfolios(user_id: str) -> list[dict]:
    """ดึง portfolios ของผู้ใช้ หรือสร้าง default + migrate ข้อมูลเดิม"""
    doc = await db.user_multi_portfolios.find_one({"user_id": user_id}, {"_id": 0})

    if doc and doc.get("portfolios"):
        return doc["portfolios"]

    # Migrate จากระบบเดิม (user_portfolios collection)
    old_doc = await db.user_portfolios.find_one({"user_id": user_id}, {"_id": 0})
    old_items = old_doc.get("items", []) if old_doc else []

    default_portfolio = {
        "id": f"p_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "name": DEFAULT_PORTFOLIO_NAME,
        "icon": DEFAULT_PORTFOLIO_ICON,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "items": old_items,
    }

    await db.user_multi_portfolios.update_one(
        {"user_id": user_id},
        {"$setOnInsert": {"user_id": user_id, "portfolios": [default_portfolio]}},
        upsert=True,
    )
    return [default_portfolio]


async def _save_portfolios(user_id: str, portfolios: list[dict]) -> None:
    await db.user_multi_portfolios.update_one(
        {"user_id": user_id},
        {"$set": {"portfolios": portfolios}},
        upsert=True,
    )


def _find_portfolio(portfolios: list[dict], portfolio_id: str) -> dict | None:
    for p in portfolios:
        if p["id"] == portfolio_id:
            return p
    return None


# ─────────────────────────────────────────────
# Dividend fetching
# ─────────────────────────────────────────────
def _fetch_dividends(ticker: str, start_date: str) -> pd.DataFrame:
    """ดึงประวัติเงินปันผลของ ticker ตั้งแต่ start_date"""
    try:
        stock = yf.Ticker(ticker)
        divs = stock.dividends
        if divs is None or divs.empty:
            return pd.DataFrame(columns=["date", "dividend"])
        # Filter by start date
        divs = divs[divs.index >= pd.Timestamp(start_date)]
        if divs.empty:
            return pd.DataFrame(columns=["date", "dividend"])
        return pd.DataFrame({
            "date": divs.index.tz_localize(None).strftime("%Y-%m-%d"),
            "dividend": divs.values,
        })
    except Exception as e:
        log.warning("dividend fetch failed for %s: %s", ticker, e)
        return pd.DataFrame(columns=["date", "dividend"])


async def _compute_dividends(holdings: list[dict], live_prices: dict[str, float],
                             fx_rate: float = 1.0) -> dict:
    """
    คำนวณเงินปันผลรวม + total return สำหรับ holdings

    คืน:
      - dividends: รายการปันผลตาม ticker
      - total_dividends: ปันผลรวม (THB)
      - total_cost: ต้นทุนรวม
      - total_value: มูลค่าปัจจุบัน
      - capital_gain: กำไร/ขาดทุนจากการเปลี่ยนแปลงราคา
      - total_return_pct: ผลตอบแทนรวม (%)
    """
    from yh import USD_TICKERS

    dividend_records = []
    total_dividends = 0.0
    total_cost = 0.0
    total_value = 0.0

    for h in holdings:
        ticker = h["ticker"]
        shares = h["shares"]
        buy_date = h["buyDate"]
        buy_price = h["buyPrice"]
        cost = buy_price * shares
        total_cost += cost

        current_price = live_prices.get(ticker, buy_price)
        value = current_price * shares
        total_value += value

        # ดึงประวัติปันผล
        is_usd = ticker in USD_TICKERS
        div_df = await asyncio.get_event_loop().run_in_executor(
            None, _fetch_dividends, ticker, buy_date
        )

        ticker_dividends = 0.0
        if not div_df.empty:
            for _, row in div_df.iterrows():
                div_per_share = float(row["dividend"])
                # แปลง USD dividends → THB
                div_thb = div_per_share * fx_rate if is_usd else div_per_share
                div_total = div_thb * shares
                ticker_dividends += div_total
                dividend_records.append({
                    "ticker": ticker,
                    "date": row["date"],
                    "per_share": round(div_per_share, 4),
                    "per_share_thb": round(div_thb, 4),
                    "total": round(div_total, 2),
                    "shares": shares,
                })

        total_dividends += ticker_dividends

    capital_gain = total_value - total_cost
    total_return_value = capital_gain + total_dividends
    total_return_pct = (total_return_value / total_cost * 100) if total_cost > 0 else 0

    return {
        "dividends": dividend_records,
        "total_dividends": round(total_dividends, 2),
        "total_cost": round(total_cost, 2),
        "total_value": round(total_value, 2),
        "capital_gain": round(capital_gain, 2),
        "total_return_value": round(total_return_value, 2),
        "total_return_pct": round(total_return_pct, 2),
        "capital_return_pct": round((capital_gain / total_cost * 100) if total_cost > 0 else 0, 2),
        "dividend_return_pct": round((total_dividends / total_cost * 100) if total_cost > 0 else 0, 2),
    }


# ─────────────────────────────────────────────
# Registration
# ─────────────────────────────────────────────
def register(app: FastAPI) -> None:

    # ════════════════════════════════════════════
    # MULTI-PORTFOLIO CRUD
    # ════════════════════════════════════════════

    @app.get("/api/user/portfolios")
    async def list_portfolios(request: Request):
        user = await _require_user(request)
        portfolios = await _get_or_init_portfolios(user["user_id"])
        # ส่งเฉพาะ metadata (ไม่ส่ง items ทั้งหมดเพื่อลด payload)
        result = [
            {
                "id": p["id"],
                "name": p["name"],
                "icon": p.get("icon", "📊"),
                "created_at": p.get("created_at"),
                "item_count": len(p.get("items", [])),
            }
            for p in portfolios
        ]
        return {"portfolios": result}

    @app.post("/api/user/portfolios")
    async def create_portfolio(request: Request, inp: PortfolioCreate):
        user = await _require_user(request)
        portfolios = await _get_or_init_portfolios(user["user_id"])
        new_portfolio = {
            "id": f"p_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}",
            "name": inp.name.strip(),
            "icon": inp.icon,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "items": [],
        }
        portfolios.append(new_portfolio)
        await _save_portfolios(user["user_id"], portfolios)
        return {
            "id": new_portfolio["id"],
            "name": new_portfolio["name"],
            "icon": new_portfolio["icon"],
            "created_at": new_portfolio["created_at"],
            "item_count": 0,
        }

    @app.delete("/api/user/portfolios/{portfolio_id}")
    async def delete_portfolio(request: Request, portfolio_id: str):
        user = await _require_user(request)
        portfolios = await _get_or_init_portfolios(user["user_id"])
        if len(portfolios) <= 1:
            raise HTTPException(status_code=400, detail="ไม่สามารถลบพอร์ตสุดท้ายได้")
        new_list = [p for p in portfolios if p["id"] != portfolio_id]
        if len(new_list) == len(portfolios):
            raise HTTPException(status_code=404, detail="ไม่พบพอร์ตที่ต้องการลบ")
        await _save_portfolios(user["user_id"], new_list)
        return {"ok": True}

    @app.patch("/api/user/portfolios/{portfolio_id}")
    async def update_portfolio(request: Request, portfolio_id: str, inp: PortfolioUpdate):
        user = await _require_user(request)
        portfolios = await _get_or_init_portfolios(user["user_id"])
        portfolio = _find_portfolio(portfolios, portfolio_id)
        if not portfolio:
            raise HTTPException(status_code=404, detail="ไม่พบพอร์ต")
        if inp.name is not None:
            portfolio["name"] = inp.name.strip()
        if inp.icon is not None:
            portfolio["icon"] = inp.icon
        await _save_portfolios(user["user_id"], portfolios)
        return {"ok": True, "id": portfolio_id, "name": portfolio["name"], "icon": portfolio["icon"]}

    # ════════════════════════════════════════════
    # HOLDINGS (per portfolio)
    # ════════════════════════════════════════════

    @app.get("/api/user/portfolios/{portfolio_id}/holdings")
    async def get_holdings(request: Request, portfolio_id: str):
        user = await _require_user(request)
        portfolios = await _get_or_init_portfolios(user["user_id"])
        portfolio = _find_portfolio(portfolios, portfolio_id)
        if not portfolio:
            raise HTTPException(status_code=404, detail="ไม่พบพอร์ต")
        return {"items": portfolio.get("items", [])}

    @app.post("/api/user/portfolios/{portfolio_id}/holdings")
    async def add_holding(request: Request, portfolio_id: str, inp: HoldingIn):
        user = await _require_user(request)
        portfolios = await _get_or_init_portfolios(user["user_id"])
        portfolio = _find_portfolio(portfolios, portfolio_id)
        if not portfolio:
            raise HTTPException(status_code=404, detail="ไม่พบพอร์ต")
        item = {
            "id": f"h_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}",
            "ticker": inp.ticker.upper().strip(),
            "shares": inp.shares,
            "buyDate": inp.buyDate,
            "buyPrice": inp.buyPrice,
        }
        portfolio.setdefault("items", []).append(item)
        await _save_portfolios(user["user_id"], portfolios)
        return item

    @app.delete("/api/user/portfolios/{portfolio_id}/holdings/{item_id}")
    async def delete_holding(request: Request, portfolio_id: str, item_id: str):
        user = await _require_user(request)
        portfolios = await _get_or_init_portfolios(user["user_id"])
        portfolio = _find_portfolio(portfolios, portfolio_id)
        if not portfolio:
            raise HTTPException(status_code=404, detail="ไม่พบพอร์ต")
        items = portfolio.get("items", [])
        new_items = [i for i in items if i["id"] != item_id]
        if len(new_items) == len(items):
            raise HTTPException(status_code=404, detail="ไม่พบรายการที่ต้องการลบ")
        portfolio["items"] = new_items
        await _save_portfolios(user["user_id"], portfolios)
        return {"ok": True}

    # ════════════════════════════════════════════
    # DIVIDENDS
    # ════════════════════════════════════════════

    @app.get("/api/user/portfolios/{portfolio_id}/dividends")
    async def get_dividends(request: Request, portfolio_id: str):
        """ดึงประวัติเงินปันผล + total return สำหรับพอร์ตที่เลือก"""
        user = await _require_user(request)
        portfolios = await _get_or_init_portfolios(user["user_id"])
        portfolio = _find_portfolio(portfolios, portfolio_id)
        if not portfolio:
            raise HTTPException(status_code=404, detail="ไม่พบพอร์ต")
        holdings = portfolio.get("items", [])
        if not holdings:
            return {
                "dividends": [],
                "total_dividends": 0,
                "total_cost": 0,
                "total_value": 0,
                "capital_gain": 0,
                "total_return_value": 0,
                "total_return_pct": 0,
                "capital_return_pct": 0,
                "dividend_return_pct": 0,
            }

        # ดึง live prices + FX
        try:
            snapshot = await get_live_snapshot()
            live_prices = snapshot.get("prices", {})
            fx_rate = snapshot.get("fx_thb_per_usd", 35.0)
        except Exception as e:
            log.warning("live prices unavailable: %s", e)
            live_prices = {}
            fx_rate = 35.0

        result = await _compute_dividends(holdings, live_prices, fx_rate)
        return result
