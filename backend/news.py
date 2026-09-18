"""
news.py — Aggregated portfolio news (Yahoo Finance) with in-memory TTL cache.

Exposes:
  * GET /api/news  → latest news across all 25 portfolio tickers, deduped,
                     sorted newest-first. Free (no API key), reuses yfinance.

Fetches per-ticker news concurrently and caches the merged result for
`CACHE_TTL` seconds to keep latency low.
"""
from __future__ import annotations

import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any

import yfinance as yf
from fastapi import FastAPI

from yh import ALL_TICKERS

log = logging.getLogger("news")

CACHE_TTL = 600          # seconds — merged news snapshot reuse window
PER_TICKER = 4           # max headlines pulled per ticker before merge
MAX_ITEMS = 40           # cap on merged list

_cache: list[dict[str, Any]] | None = None
_cache_ts: float = 0.0
_lock = asyncio.Lock()


def _fetch_one(ticker: str) -> list[dict[str, Any]]:
    try:
        items = yf.Ticker(ticker).news or []
    except Exception as e:  # noqa: BLE001
        log.debug("news fetch failed for %s: %s", ticker, e)
        return []

    out: list[dict[str, Any]] = []
    for it in items[:PER_TICKER]:
        c = it.get("content") or {}
        title = c.get("title")
        if not title:
            continue
        url = (c.get("clickThroughUrl") or c.get("canonicalUrl") or {}).get("url")
        thumb = None
        res = (c.get("thumbnail") or {}).get("resolutions") or []
        if res:
            # prefer a small resolution for the card thumbnail
            small = [r for r in res if r.get("tag") and r["tag"] != "original"]
            thumb = (small[0] if small else res[0]).get("url")
        out.append({
            "id":        c.get("id") or it.get("id"),
            "ticker":    ticker,
            "title":     title,
            "summary":   (c.get("summary") or c.get("description") or "").strip(),
            "publisher": (c.get("provider") or {}).get("displayName", ""),
            "url":       url,
            "thumbnail": thumb,
            "published": c.get("pubDate") or c.get("displayTime"),
        })
    return out


def _parse_ts(item: dict[str, Any]) -> datetime:
    p = item.get("published") or ""
    try:
        return datetime.fromisoformat(p.replace("Z", "+00:00"))
    except Exception:  # noqa: BLE001
        return datetime.min.replace(tzinfo=timezone.utc)


def _download_all() -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        for chunk in ex.map(_fetch_one, ALL_TICKERS):
            merged.extend(chunk)

    # dedupe by id (fallback title) — same story surfaces on multiple tickers
    seen: set[str] = set()
    uniq: list[dict[str, Any]] = []
    for n in merged:
        key = str(n.get("id") or n.get("title"))
        if key in seen:
            continue
        seen.add(key)
        uniq.append(n)

    uniq.sort(key=_parse_ts, reverse=True)
    return uniq[:MAX_ITEMS]


async def get_news(force: bool = False) -> list[dict[str, Any]]:
    global _cache, _cache_ts
    now = time.time()
    if not force and _cache and (now - _cache_ts) < CACHE_TTL:
        return _cache

    async with _lock:
        if not force and _cache and (time.time() - _cache_ts) < CACHE_TTL:
            return _cache
        try:
            data = await asyncio.get_event_loop().run_in_executor(None, _download_all)
            _cache = data
            _cache_ts = time.time()
            return data
        except Exception as e:  # noqa: BLE001
            log.warning("news download failed: %s", e)
            return _cache or []


def register(app: FastAPI) -> None:
    @app.get("/api/news")
    async def api_news(limit: int = 30, force: bool = False):
        items = await get_news(force=force)
        items = items[:limit]
        return {
            "count": len(items),
            "items": items,
            "fetched_at": datetime.now().isoformat(timespec="seconds"),
        }

    @app.on_event("startup")
    async def _warm_news() -> None:
        asyncio.create_task(get_news(force=True))
