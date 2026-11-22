"""
news.py — Aggregated portfolio news (Yahoo Finance) with in-memory TTL cache.

Exposes:
  * GET /api/news  → latest news across portfolio tickers, deduped,
                     sorted newest-first. Free (no API key), uses yfinance Search.
"""
from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import logging
import time
from typing import Any

import yfinance as yf
from fastapi import FastAPI

log = logging.getLogger("news")

CACHE_TTL = 300          # 5 minutes cache
PER_TICKER = 4           # headlines per ticker
MAX_ITEMS = 30           # max merged news
FORCE_MIN_INTERVAL = 20  # seconds

# Focus on active liquid project tickers for fast news fetching
NEWS_TICKERS = [
    "AAPL", "NVDA", "MSFT", "TSLA", "GOOGL", "AMZN", "META",
    "GLD", "TLT", "JPM", "PTT.BK", "DELTA.BK", "AOT.BK", "CPALL.BK",
]

_cache: list[dict[str, Any]] | None = None
_cache_ts: float = 0.0
_lock = asyncio.Lock()


def _fetch_ticker_news(ticker: str) -> list[dict[str, Any]]:
    clean_sym = ticker.replace(".BK", "").strip().upper()
    raw_items = []

    # 1. Primary: yf.Search (robust and active)
    try:
        search_res = yf.Search(clean_sym, news_count=PER_TICKER, max_results=2)
        raw_items = getattr(search_res, "news", []) or []
    except Exception as e:
        log.debug("yf.Search news error for %s: %s", ticker, e)

    # 2. Fallback: yf.Ticker
    if not raw_items:
        try:
            raw_items = yf.Ticker(clean_sym).news or []
        except Exception:
            pass

    out: list[dict[str, Any]] = []
    for it in raw_items[:PER_TICKER]:
        c = it.get("content") or {}
        title = it.get("title") or c.get("title")
        if not title:
            continue

        url = it.get("link") or (c.get("clickThroughUrl") or c.get("canonicalUrl") or {}).get("url")
        publisher = it.get("publisher") or (c.get("provider") or {}).get("displayName", "Market News")
        item_id = str(it.get("uuid") or it.get("id") or c.get("id") or title)

        # Thumbnail extraction
        thumb = None
        raw_thumb = it.get("thumbnail") or c.get("thumbnail")
        if isinstance(raw_thumb, dict):
            res = raw_thumb.get("resolutions") or []
            if res:
                # Prefer medium/small resolution for feed card
                small = [r for r in res if r.get("tag") and r["tag"] != "original"]
                thumb = (small[0] if small else res[0]).get("url")
            elif raw_thumb.get("url"):
                thumb = raw_thumb.get("url")
        elif isinstance(raw_thumb, str):
            thumb = raw_thumb

        # Published date parsing
        pub_iso = None
        ts = it.get("providerPublishTime")
        if ts:
            try:
                pub_iso = datetime.fromtimestamp(ts, timezone.utc).isoformat().replace("+00:00", "Z")
            except Exception:
                pass
        if not pub_iso:
            pub_iso = c.get("pubDate") or c.get("displayTime")
        if not pub_iso:
            pub_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        summary = (it.get("summary") or c.get("summary") or c.get("description") or "").strip()

        out.append({
            "id": item_id,
            "ticker": clean_sym,
            "title": title,
            "summary": summary,
            "publisher": publisher,
            "url": url or "#",
            "thumbnail": thumb,
            "published": pub_iso,
        })
    return out


def _parse_ts(item: dict[str, Any]) -> datetime:
    p = item.get("published") or ""
    try:
        return datetime.fromisoformat(p.replace("Z", "+00:00"))
    except Exception:
        return datetime.min.replace(tzinfo=timezone.utc)


def _download_all() -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=6) as ex:
        for chunk in ex.map(_fetch_ticker_news, NEWS_TICKERS):
            merged.extend(chunk)

    # Deduplicate by title or id
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
    if force and _cache and (now - _cache_ts) < FORCE_MIN_INTERVAL:
        force = False
    if not force and _cache and (now - _cache_ts) < CACHE_TTL and len(_cache) > 0:
        return _cache

    async with _lock:
        if not force and _cache and (time.time() - _cache_ts) < CACHE_TTL and len(_cache) > 0:
            return _cache
        try:
            data = await asyncio.get_event_loop().run_in_executor(None, _download_all)
            if data:
                _cache = data
                _cache_ts = time.time()
            return _cache or data or []
        except Exception as e:
            log.warning("News download error: %s", e)
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
