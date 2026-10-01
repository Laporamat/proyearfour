"""
omarket.py — OpenMarket Data API proxy (crypto market data) for the /terminal page.

The OpenMarket API key is a SERVER-SIDE credential (never exposed to the browser),
so all requests are proxied here. Results are cached with a short TTL because the
free tier is rate-limited (10 weight/min, 1000/day); candle requests cost weight,
metadata/markets requests are weight-0.

Endpoints:
  * GET /api/om/candles?symbol=BTCUSDT&tf=1h       → OHLCV candles for one market
  * GET /api/om/markets?filter=&limit=40           → top markets by 24h volume (watchlist/search)
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException

log = logging.getLogger("omarket")

OM_BASE = "https://api.openmarket.xyz"
OM_KEY = os.environ.get("OPENMARKET_KEY", "")
DEFAULT_EXCHANGE = "BINANCE_FUTURES"
CANDLE_TYPE = "TRADE_SIDE_AGNOSTIC_AGG"
TARGET_CANDLES = 500
# Free tier serves a limited rolling history window (~6 days). Keep requests inside it.
MAX_LOOKBACK_SECONDS = 500_000

# tf -> (interval enum, seconds per candle). Only timeframes that fit the free-tier
# lookback window are offered (1d/1w would yield too few bars).
TIMEFRAMES: dict[str, tuple[str, int]] = {
    "1m":  ("MINUTE", 60),
    "5m":  ("FIVE_MINUTES", 300),
    "15m": ("FIFTEEN_MINUTES", 900),
    "30m": ("THIRTY_MINUTES", 1800),
    "1h":  ("HOUR", 3600),
    "4h":  ("FOUR_HOURS", 14400),
}

CANDLE_TTL = 20
MARKET_TTL = 20

_candle_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_market_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_candle_locks: dict[str, asyncio.Lock] = {}
_market_locks: dict[str, asyncio.Lock] = {}


def _lock_for(store: dict[str, asyncio.Lock], key: str) -> asyncio.Lock:
    lk = store.get(key)
    if lk is None:
        lk = asyncio.Lock()
        store[key] = lk
    return lk


def _num(x: Any, fallback: float = 0.0) -> float:
    try:
        f = float(x)
    except (TypeError, ValueError):
        return fallback
    return fallback if f != f else f


async def _om_get(path: str, params: list[tuple[str, Any]]) -> dict[str, Any]:
    if not OM_KEY:
        raise HTTPException(status_code=503, detail="OPENMARKET_KEY ยังไม่ได้ตั้งค่าในเซิร์ฟเวอร์")
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            f"{OM_BASE}{path}",
            params=params,
            headers={"X-OpenMarket-Key": OM_KEY},
        )
    if r.status_code == 429:
        raise RuntimeError("rate_limited")
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"OpenMarket error {r.status_code}: {r.text[:160]}")
    return r.json()


def _parse_candles(data: dict[str, Any]) -> list[dict[str, Any]]:
    series = data.get("series") or []
    if not series:
        return []
    points = series[0].get("points") or []
    out: list[dict[str, Any]] = []
    for wrap in points:
        p = wrap.get("Point") or {}
        ts = (p.get("timestamp") or {}).get("s")
        close = p.get("close")
        if ts is None or close is None:
            continue
        out.append({
            "t": int(ts) * 1000,
            "o": round(_num(p.get("open"), close), 8),
            "h": round(_num(p.get("high"), close), 8),
            "l": round(_num(p.get("low"), close), 8),
            "c": round(_num(close), 8),
            "v": round(_num(p.get("volume"), 0.0), 2),
        })
    out.sort(key=lambda c: c["t"])
    return out


async def _fetch_candles(exchange: str, symbol: str, tf: str) -> dict[str, Any]:
    interval, secs = TIMEFRAMES[tf]
    period = min(secs * TARGET_CANDLES, MAX_LOOKBACK_SECONDS)
    frm = int(time.time()) - period
    params: list[tuple[str, Any]] = [
        ("type", CANDLE_TYPE),
        ("exchange", exchange),
        ("rawSymbol", symbol),
        ("interval", interval),
        ("from", frm),
        ("period", period),
        ("gapfill", "true"),
        ("transform.normalize.quote", "USD"),
    ]
    data = await _om_get("/v1/points", params)
    candles = _parse_candles(data)
    return {
        "symbol": symbol,
        "exchange": exchange,
        "tf": tf,
        "candles": candles,
        "status": "live",
    }


async def _fetch_markets(filt: str, limit: int) -> dict[str, Any]:
    params: list[tuple[str, Any]] = [
        ("exchange", DEFAULT_EXCHANGE),
        ("pageSize", limit),
        ("sortCriteria.field", "VOLUME_24H"),
        ("sortCriteria.direction", "SORT_DIRECTION_DESC"),
        ("distinct", "true"),
    ]
    if filt:
        params.append(("symbolFilter", filt))
    data = await _om_get("/v1/markets", params)
    rows = data.get("symbols") or []
    markets: list[dict[str, Any]] = []
    for m in rows:
        markets.append({
            "exchange": m.get("exchange", DEFAULT_EXCHANGE),
            "rawSymbol": m.get("rawSymbol"),
            "normalizedSymbol": m.get("normalizedSymbol"),
            "coin": m.get("coin"),
            "coinName": m.get("coinName") or m.get("coin"),
            "price": _num(m.get("lastPrice")),
            "change_pct": round(_num(m.get("priceChange24h")) * 100, 2),
            "volume_usd": _num(m.get("volume24hUsd") or m.get("volume24h")),
            "icon": m.get("iconUrl") or "",
            "sparkline": [_num(x) for x in (m.get("prices") or [])],
        })
    return {"markets": markets, "status": "live"}


async def _cached(store, locks, key, ttl, fetch):
    now = time.time()
    hit = store.get(key)
    if hit and (now - hit[0]) < ttl:
        return hit[1]
    async with _lock_for(locks, key):
        hit = store.get(key)
        if hit and (time.time() - hit[0]) < ttl:
            return hit[1]
        try:
            data = await fetch()
            store[key] = (time.time(), data)
            return data
        except HTTPException:
            raise
        except Exception as e:  # noqa: BLE001
            log.warning("OpenMarket fetch failed for %s: %s", key, e)
            if hit:
                stale = dict(hit[1])
                stale["status"] = "stale"
                return stale
            detail = "OpenMarket โดนจำกัดอัตราการเรียก (rate limit) — รอสักครู่" if str(e) == "rate_limited" \
                else f"ดึงข้อมูล OpenMarket ไม่สำเร็จ: {e}"
            raise HTTPException(status_code=502, detail=detail)


def register(app: FastAPI) -> None:
    @app.get("/api/om/timeframes")
    async def api_om_timeframes():
        return {"timeframes": list(TIMEFRAMES.keys()), "exchange": DEFAULT_EXCHANGE}

    @app.get("/api/om/candles")
    async def api_om_candles(symbol: str = "BTCUSDT", tf: str = "1h", exchange: str = DEFAULT_EXCHANGE):
        symbol = symbol.strip().upper()
        exchange = exchange.strip().upper()
        if tf not in TIMEFRAMES:
            raise HTTPException(status_code=400, detail=f"timeframe ไม่ถูกต้อง: {tf}")
        key = f"{exchange}:{symbol}:{tf}"
        return await _cached(_candle_cache, _candle_locks, key, CANDLE_TTL,
                             lambda: _fetch_candles(exchange, symbol, tf))

    @app.get("/api/om/markets")
    async def api_om_markets(filter: str = "", limit: int = 40):
        filt = filter.strip()
        limit = max(1, min(limit, 100))
        key = f"{filt.lower()}:{limit}"
        return await _cached(_market_cache, _market_locks, key, MARKET_TTL,
                             lambda: _fetch_markets(filt, limit))
