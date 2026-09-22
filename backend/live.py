"""
live.py — Live market data (Yahoo Finance) with in-memory TTL cache.

Exposes:
  * GET  /api/prices/live   → latest close + daily % change (all 25 assets, THB)
  * background task on startup → runs full pipeline + MPT + Regime once
                                 so the rest of the app has CSV artefacts.

Keeps latency low by fetching only the last ~5 trading days and by caching
results for `CACHE_TTL` seconds.  If Yahoo is briefly unreachable we fall
back to the last successful snapshot.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime
from typing import Any

import pandas as pd
import yfinance as yf
from fastapi import FastAPI

from yh import ALL_TICKERS, USD_TICKERS, FX_TICKER, FX_FALLBACK

log = logging.getLogger("live")

CACHE_TTL = 60          # seconds — how long a live snapshot is reused
_snapshot: dict[str, Any] | None = None
_snapshot_ts: float = 0.0
_lock = asyncio.Lock()


# ─────────────────────────────────────────────
# Live fetch
# ─────────────────────────────────────────────
def _download() -> dict[str, Any]:
    """Blocking Yahoo fetch — runs in a thread executor."""
    tickers = ALL_TICKERS + [FX_TICKER]
    raw = yf.download(
        tickers,
        period="7d",
        auto_adjust=True,
        progress=False,
        threads=True,
    )
    if raw.empty:
        raise RuntimeError("Yahoo returned empty frame")

    close = raw["Close"] if isinstance(raw.columns, pd.MultiIndex) else raw[["Close"]]

    # FX: latest available THB/USD
    fx_series = close.get(FX_TICKER)
    if fx_series is None or fx_series.dropna().empty:
        fx_rate = FX_FALLBACK
    else:
        fx_rate = float(fx_series.dropna().iloc[-1])

    # Convert USD-denominated tickers → THB
    df = close.drop(columns=[FX_TICKER], errors="ignore").copy()
    for col in USD_TICKERS:
        if col in df.columns:
            df[col] = df[col] * fx_rate

    raw = df.dropna(how="all")
    if raw.empty:
        raise RuntimeError("No usable rows after cleaning")

    prices: dict[str, float] = {}
    changes: dict[str, float] = {}
    latest_dates: dict[str, str] = {}

    # Compute per-ticker independently using its own last 2 non-null closes.
    # Different markets (US vs .BK) trade on different calendar days, so
    # applying ffill+iloc[-2] before this step wipes out real % changes.
    for ticker in raw.columns:
        s = raw[ticker].dropna()
        if s.empty:
            continue
        last_v = float(s.iloc[-1])
        prices[ticker] = round(last_v, 2)
        latest_dates[ticker] = str(s.index[-1].date())
        if len(s) >= 2:
            prev_v = float(s.iloc[-2])
            if prev_v != 0:
                changes[ticker] = round((last_v - prev_v) / prev_v * 100, 3)
            else:
                changes[ticker] = 0.0
        else:
            changes[ticker] = 0.0

    # Overall "as-of" date = latest bar in the frame
    return {
        "status": "live",
        "date": str(raw.index[-1].date()),
        "fx_thb_per_usd": round(fx_rate, 4),
        "prices": prices,
        "changes": changes,
        "asof": latest_dates,
        "fetched_at": datetime.now().isoformat(timespec="seconds"),
    }


async def get_live_snapshot(force: bool = False) -> dict[str, Any]:
    """TTL-cached wrapper around _download(). Concurrent callers share one fetch."""
    global _snapshot, _snapshot_ts

    now = time.time()
    if not force and _snapshot and (now - _snapshot_ts) < CACHE_TTL:
        return _snapshot

    async with _lock:
        # re-check inside the lock (another coroutine may have refreshed)
        if not force and _snapshot and (time.time() - _snapshot_ts) < CACHE_TTL:
            return _snapshot
        try:
            data = await asyncio.get_event_loop().run_in_executor(None, _download)
            _snapshot = data
            _snapshot_ts = time.time()
            return data
        except Exception as e:
            log.warning("live fetch failed: %s", e)
            if _snapshot:
                stale = dict(_snapshot)
                stale["status"] = "stale"
                stale["error"] = str(e)
                return stale
            raise


# ─────────────────────────────────────────────
# Background one-shot pipeline (so MPT/Regime CSVs exist)
# ─────────────────────────────────────────────
async def _bootstrap_pipeline() -> None:
    from pathlib import Path

    output = Path(__file__).parent / "output"
    prices_csv    = output / "prices_clean_thb.csv"
    portfolio_csv = output / "optimal_portfolio.csv"
    regime_csv    = output / "regime_predictions.csv"

    loop = asyncio.get_event_loop()

    try:
        if not prices_csv.exists():
            log.info("bootstrap: running data pipeline…")
            from yh import run_pipeline
            await loop.run_in_executor(None, run_pipeline)
        if not portfolio_csv.exists():
            log.info("bootstrap: running MPT optimizer…")
            from mpt import run_mpt
            await loop.run_in_executor(None, lambda: run_mpt(objective="max_sharpe"))
        if not regime_csv.exists():
            log.info("bootstrap: running Regime classifier…")
            from regime import run_regime
            await loop.run_in_executor(None, lambda: run_regime(model_type="random_forest"))
        log.info("bootstrap: done ✓")
    except Exception as e:
        log.warning("bootstrap failed (non-fatal): %s", e)


# ─────────────────────────────────────────────
# Registration
# ─────────────────────────────────────────────
def register(app: FastAPI) -> None:
    @app.get("/api/prices/live")
    async def api_prices_live(force: bool = False, currency: str = "THB"):
        snapshot = await get_live_snapshot(force=force)
        if currency.upper() == "USD":
            fx = snapshot.get("fx_thb_per_usd", FX_FALLBACK)
            prices_usd = {t: round(p / fx, 2) for t, p in snapshot.get("prices", {}).items()}
            result = dict(snapshot)
            result["prices"] = prices_usd
            result["currency"] = "USD"
            result["fx_used"] = fx
            return result
        result = dict(snapshot)
        result["currency"] = "THB"
        return result

    @app.on_event("startup")
    async def _startup() -> None:
        # warm the cache immediately (non-blocking)
        asyncio.create_task(get_live_snapshot(force=True))
        # kick off the heavy pipeline once, in the background
        asyncio.create_task(_bootstrap_pipeline())
