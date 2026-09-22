"""
myportfolio.py — Historical price lookup for the My Portfolio feature.

Exposes:
  GET /api/price/at?ticker=AAPL&date=2024-01-15
    → close price on (or nearest before) that date, converted to THB for USD assets.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta

import pandas as pd
import yfinance as yf
from fastapi import FastAPI, HTTPException, Query

from yh import USD_TICKERS, FX_TICKER, FX_FALLBACK

log = logging.getLogger("myportfolio")


def register(app: FastAPI) -> None:

    @app.get("/api/price/at")
    async def price_at(
        ticker: str = Query(..., description="Ticker symbol, e.g. AAPL or PTT.BK"),
        date:   str = Query(..., description="Buy date YYYY-MM-DD"),
    ):
        """Fetch the close price of a ticker on a specific date (THB)."""
        try:
            target = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(400, "รูปแบบวันที่ไม่ถูกต้อง — ใช้ YYYY-MM-DD")

        # 7-day window to handle weekends/holidays
        start = (target - timedelta(days=7)).strftime("%Y-%m-%d")
        end   = (target + timedelta(days=3)).strftime("%Y-%m-%d")

        need_fx = ticker in USD_TICKERS
        dl_tickers = [ticker, FX_TICKER] if need_fx else [ticker]

        def _fetch():
            return yf.download(
                dl_tickers, start=start, end=end,
                auto_adjust=True, progress=False, threads=False,
            )

        try:
            raw = await asyncio.get_event_loop().run_in_executor(None, _fetch)
        except Exception as e:
            raise HTTPException(500, f"Yahoo Finance error: {e}")

        if raw.empty:
            raise HTTPException(404, f"ไม่มีข้อมูล {ticker} ในช่วงวันที่ {date}")

        # Extract close prices
        if isinstance(raw.columns, pd.MultiIndex):
            close_df = raw["Close"]
            price_s = close_df[ticker].dropna() if ticker in close_df.columns else None
            fx_s = close_df.get(FX_TICKER)
        else:
            price_s = raw["Close"].dropna() if "Close" in raw.columns else None
            fx_s = None

        if price_s is None or price_s.empty:
            raise HTTPException(404, f"ไม่มีราคา {ticker} ในช่วงวันที่ {date}")

        # FX rate at/near the buy date
        fx_rate = FX_FALLBACK
        if need_fx and fx_s is not None and not fx_s.dropna().empty:
            fx_rate = float(fx_s.dropna().iloc[-1])

        # Closest date on or before the target
        target_ts = pd.Timestamp(target)
        valid = price_s[price_s.index <= target_ts]
        if valid.empty:
            valid = price_s.iloc[:1]
        actual_date = str(valid.index[-1].date())
        close_raw = float(valid.iloc[-1])
        close_thb = close_raw * fx_rate if need_fx else close_raw

        return {
            "ticker":       ticker,
            "date":         actual_date,
            "close":        round(close_raw, 2),
            "close_thb":    round(close_thb, 2),
            "fx_thb_per_usd": round(fx_rate, 4) if need_fx else None,
        }
