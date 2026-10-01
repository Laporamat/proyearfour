"""
terminal.py — Trading-terminal data (Yahoo Finance) for the /terminal page.

Exposes:
  * GET /api/terminal/candles?symbol=NVDA&tf=1h  → OHLCV candles for one symbol
  * GET /api/terminal/quotes?symbols=AAPL,MSFT   → last price + 24h change + volume

All prices are in the symbol's native currency (USD for the default US watchlist).
Results are cached in-memory with a short TTL to keep Yahoo load / latency low.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any

import pandas as pd
import yfinance as yf
from fastapi import FastAPI, HTTPException

log = logging.getLogger("terminal")

# Default US watchlist shown on the terminal (matches the reference design).
DEFAULT_WATCHLIST = [
    "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL",
    "META", "TSLA", "AVGO", "JPM", "XOM",
]

# tf -> (yfinance interval, yfinance period). Chosen within Yahoo's limits.
TIMEFRAMES: dict[str, tuple[str, str]] = {
    "1m":  ("1m",  "5d"),
    "5m":  ("5m",  "1mo"),
    "15m": ("15m", "1mo"),
    "1h":  ("60m", "3mo"),
    "1d":  ("1d",  "2y"),
    "1wk": ("1wk", "5y"),
    "1mo": ("1mo", "10y"),
}

MAX_CANDLES = 400          # cap bars sent to the client for a snappy chart
CANDLE_TTL = 60            # seconds
QUOTE_TTL = 30             # seconds

_candle_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_quote_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_candle_locks: dict[str, asyncio.Lock] = {}
_quote_locks: dict[str, asyncio.Lock] = {}


def _lock_for(store: dict[str, asyncio.Lock], key: str) -> asyncio.Lock:
    """Per-key lock so only duplicate fetches of the SAME key de-dupe;
    distinct symbols/timeframes fetch in parallel. Safe on the single-
    threaded event loop (no await between get and set)."""
    lk = store.get(key)
    if lk is None:
        lk = asyncio.Lock()
        store[key] = lk
    return lk


def _num(x: Any, fallback: float = 0.0) -> float:
    """Coerce to float, mapping None/NaN/invalid to a fallback (avoids
    emitting non-JSON `NaN` literals that the client cannot parse)."""
    try:
        f = float(x)
    except (TypeError, ValueError):
        return fallback
    return fallback if f != f else f  # f != f is True only for NaN


def _series(raw: pd.DataFrame, field: str) -> pd.Series:
    """Return a 1-D Series for an OHLCV field, flattening MultiIndex frames."""
    col = raw[field]
    if isinstance(col, pd.DataFrame):
        col = col.iloc[:, 0]
    return col


def _download_candles(symbol: str, tf: str) -> dict[str, Any]:
    """Blocking Yahoo fetch for a single symbol — runs in a thread executor."""
    interval, period = TIMEFRAMES[tf]
    raw = yf.download(
        symbol,
        period=period,
        interval=interval,
        auto_adjust=True,
        progress=False,
        threads=False,
    )
    if raw is None or raw.empty:
        raise RuntimeError(f"Yahoo returned no data for {symbol}")

    open_ = _series(raw, "Open")
    high = _series(raw, "High")
    low = _series(raw, "Low")
    close = _series(raw, "Close")
    volume = _series(raw, "Volume")

    candles: list[dict[str, Any]] = []
    for idx, c in close.items():
        if pd.isna(c):
            continue
        ts = idx.to_pydatetime()
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        cval = float(c)
        candles.append({
            "t": int(ts.timestamp() * 1000),
            "o": round(_num(open_.get(idx), cval), 4),
            "h": round(_num(high.get(idx), cval), 4),
            "l": round(_num(low.get(idx), cval), 4),
            "c": round(cval, 4),
            "v": _num(volume.get(idx), 0.0),
        })

    candles = candles[-MAX_CANDLES:]
    if not candles:
        raise RuntimeError(f"No usable candles for {symbol}")

    return {
        "symbol": symbol,
        "tf": tf,
        "candles": candles,
        "status": "live",
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def _download_quotes(symbols: list[str]) -> dict[str, Any]:
    """Blocking Yahoo fetch for watchlist quotes — last close, prev close, volume."""
    raw = yf.download(
        symbols,
        period="5d",
        interval="1d",
        auto_adjust=True,
        progress=False,
        threads=True,
    )
    if raw is None or raw.empty:
        raise RuntimeError("Yahoo returned empty frame")

    close = raw["Close"] if isinstance(raw.columns, pd.MultiIndex) else raw[["Close"]]
    volume = raw["Volume"] if isinstance(raw.columns, pd.MultiIndex) else raw[["Volume"]]
    if not isinstance(close, pd.DataFrame):
        close = close.to_frame()
    if len(symbols) == 1 and symbols[0] not in close.columns:
        close.columns = symbols
        volume.columns = symbols

    quotes: list[dict[str, Any]] = []
    for sym in symbols:
        if sym not in close.columns:
            continue
        s = close[sym].dropna()
        if s.empty:
            continue
        price = float(s.iloc[-1])
        prev = float(s.iloc[-2]) if len(s) >= 2 else price
        change = price - prev
        change_pct = (change / prev * 100) if prev else 0.0
        vol = 0.0
        if sym in volume.columns:
            vs = volume[sym].dropna()
            if not vs.empty:
                vol = float(vs.iloc[-1])
        quotes.append({
            "symbol": sym,
            "price": round(price, 2),
            "prev": round(prev, 2),
            "change": round(change, 2),
            "change_pct": round(change_pct, 2),
            "volume": vol,
            "dollar_vol": round(price * vol, 2),
        })

    if not quotes:
        raise RuntimeError("No usable quotes")

    return {
        "quotes": quotes,
        "status": "live",
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


async def _get_candles(symbol: str, tf: str) -> dict[str, Any]:
    key = f"{symbol}:{tf}"
    now = time.time()
    cached = _candle_cache.get(key)
    if cached and (now - cached[0]) < CANDLE_TTL:
        return cached[1]

    async with _lock_for(_candle_locks, key):
        cached = _candle_cache.get(key)
        if cached and (time.time() - cached[0]) < CANDLE_TTL:
            return cached[1]
        try:
            data = await asyncio.get_event_loop().run_in_executor(
                None, _download_candles, symbol, tf
            )
            _candle_cache[key] = (time.time(), data)
            return data
        except Exception as e:  # noqa: BLE001
            log.warning("candle fetch failed for %s/%s: %s", symbol, tf, e)
            if cached:
                stale = dict(cached[1])
                stale["status"] = "stale"
                return stale
            raise HTTPException(status_code=502, detail=f"ไม่สามารถดึงข้อมูล {symbol}: {e}")


async def _get_quotes(symbols: list[str]) -> dict[str, Any]:
    key = ",".join(sorted(symbols))
    now = time.time()
    cached = _quote_cache.get(key)
    if cached and (now - cached[0]) < QUOTE_TTL:
        return cached[1]

    async with _lock_for(_quote_locks, key):
        cached = _quote_cache.get(key)
        if cached and (time.time() - cached[0]) < QUOTE_TTL:
            return cached[1]
        try:
            data = await asyncio.get_event_loop().run_in_executor(
                None, _download_quotes, symbols
            )
            _quote_cache[key] = (time.time(), data)
            return data
        except Exception as e:  # noqa: BLE001
            log.warning("quote fetch failed: %s", e)
            if cached:
                stale = dict(cached[1])
                stale["status"] = "stale"
                return stale
            raise HTTPException(status_code=502, detail=f"ไม่สามารถดึงราคา watchlist: {e}")


def register(app: FastAPI) -> None:
    @app.get("/api/terminal/symbols")
    async def api_terminal_symbols():
        return {"symbols": DEFAULT_WATCHLIST, "timeframes": list(TIMEFRAMES.keys())}

    @app.get("/api/terminal/candles")
    async def api_terminal_candles(symbol: str = "NVDA", tf: str = "1h"):
        symbol = symbol.strip().upper()
        if tf not in TIMEFRAMES:
            raise HTTPException(status_code=400, detail=f"timeframe ไม่ถูกต้อง: {tf}")
        return await _get_candles(symbol, tf)

    @app.get("/api/terminal/quotes")
    async def api_terminal_quotes(symbols: str = ""):
        syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
        if not syms:
            syms = DEFAULT_WATCHLIST
        return await _get_quotes(syms)
