"""news_eda.py — Exploratory analysis of latest Yahoo news per portfolio ticker."""
from __future__ import annotations

import asyncio
import logging
import re
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any

import yfinance as yf
from fastapi import FastAPI, HTTPException, Query, Request

from auth import _current_user
from live import get_live_snapshot
from portfolio_manager import _get_or_init_portfolios
from yh import ALL_TICKERS

log = logging.getLogger("news_eda")

PER_TICKER = 10
CACHE_TTL = 900
_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}

POS_WORDS = {
    "surge", "surges", "soar", "soars", "jump", "jumps", "rally", "rallies", "gain", "gains",
    "rise", "rises", "beat", "beats", "record", "growth", "upgrade", "upgraded", "strong",
    "bullish", "boost", "boosts", "profit", "profits", "outperform", "buy", "high", "higher",
    "win", "wins", "positive", "optimism", "climb", "climbs", "rebound", "best", "top", "opportunity",
}
NEG_WORDS = {
    "fall", "falls", "drop", "drops", "plunge", "plunges", "slump", "slumps", "crash", "loss",
    "losses", "miss", "misses", "downgrade", "downgraded", "weak", "bearish", "cut", "cuts",
    "lawsuit", "probe", "risk", "risks", "fear", "fears", "decline", "declines", "sell", "selloff",
    "lower", "low", "tumble", "tumbles", "warning", "worst", "concern", "concerns", "dives", "lost",
}
STOP = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "is", "are", "as", "at",
    "by", "from", "its", "it", "this", "that", "be", "was", "has", "have", "will", "after", "over",
    "into", "about", "what", "why", "how", "you", "your", "can", "could", "more", "than", "now",
    "new", "says", "say", "stock", "stocks", "shares", "inc", "corp", "vs", "up", "down", "s",
    "but", "not", "just", "may", "should", "would", "these", "here", "their", "his", "her", "out",
    "one", "two", "all", "is", "we", "our", "they", "-", "q", "it's", "–", "—", "&",
}
_WORD = re.compile(r"[A-Za-z][A-Za-z'\-]+")


def _sentiment(title: str) -> tuple[float, str]:
    words = [w.lower() for w in _WORD.findall(title)]
    p = sum(w in POS_WORDS for w in words)
    n = sum(w in NEG_WORDS for w in words)
    if p == n:
        return 0.0, "neutral"
    score = round((p - n) / (p + n), 2)
    return score, "positive" if score > 0 else "negative"


def _fetch(ticker: str) -> list[dict[str, Any]]:
    hit = _cache.get(ticker)
    if hit and time.time() - hit[0] < CACHE_TTL:
        return hit[1]
    try:
        raw = yf.Search(ticker, news_count=PER_TICKER, max_results=1).news or []
    except Exception as e:  # noqa: BLE001
        log.debug("eda news failed for %s: %s", ticker, e)
        return hit[1] if hit else []
    out = []
    for it in raw:
        related = it.get("relatedTickers") or []
        if not it.get("title") or (related and ticker not in related):
            continue
        ts = it.get("providerPublishTime")
        score, label = _sentiment(it["title"])
        out.append({
            "id": it.get("uuid"),
            "ticker": ticker,
            "title": it["title"],
            "publisher": it.get("publisher") or "Unknown",
            "url": it.get("link"),
            "published": datetime.fromtimestamp(ts, timezone.utc).isoformat().replace("+00:00", "Z") if ts else None,
            "sentiment": score,
            "label": label,
        })
    _cache[ticker] = (time.time(), out)
    return out

def _analyze(articles: list[dict[str, Any]], tickers: list[str], changes: dict[str, float]) -> dict[str, Any]:
    by_t: dict[str, dict[str, Any]] = {t: {"ticker": t, "count": 0, "positive": 0, "neutral": 0, "negative": 0, "_s": 0.0} for t in tickers}
    by_day: dict[str, Counter] = defaultdict(Counter)
    pubs: Counter = Counter()
    words: Counter = Counter()
    for a in articles:
        row = by_t[a["ticker"]]
        row["count"] += 1
        row[a["label"]] += 1
        row["_s"] += a["sentiment"]
        pubs[a["publisher"]] += 1
        if a["published"]:
            day = a["published"][:10]
            by_day[day]["count"] += 1
            by_day[day][a["label"]] += 1
        words.update(w.lower() for w in _WORD.findall(a["title"]) if w.lower() not in STOP and len(w) > 2)

    ticker_rows = []
    for row in by_t.values():
        s = row.pop("_s")
        row["avg_sentiment"] = round(s / row["count"], 3) if row["count"] else 0.0
        row["change_1d"] = changes.get(row["ticker"])
        ticker_rows.append(row)
    ticker_rows.sort(key=lambda r: r["count"], reverse=True)

    labels = Counter(a["label"] for a in articles)
    dates = sorted(by_day)
    return {
        "summary": {
            "articles": len(articles),
            "tickers_with_news": sum(1 for r in ticker_rows if r["count"]),
            "tickers_total": len(tickers),
            "publishers": len(pubs),
            "avg_sentiment": round(sum(a["sentiment"] for a in articles) / len(articles), 3) if articles else 0.0,
            "positive": labels["positive"], "neutral": labels["neutral"], "negative": labels["negative"],
            "date_from": dates[0] if dates else None,
            "date_to": dates[-1] if dates else None,
        },
        "by_ticker": ticker_rows,
        "by_day": [{"date": d, "count": by_day[d]["count"], "positive": by_day[d]["positive"],
                    "neutral": by_day[d]["neutral"], "negative": by_day[d]["negative"]} for d in dates],
        "publishers": [{"publisher": p, "count": c} for p, c in pubs.most_common(10)],
        "top_words": [{"word": w, "count": c} for w, c in words.most_common(30)],
        "articles": sorted(articles, key=lambda a: a["published"] or "", reverse=True),
    }


async def _user_tickers(request: Request) -> list[str]:
    user = await _current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    portfolios = await _get_or_init_portfolios(user["user_id"])
    return sorted({h["ticker"] for p in portfolios for h in p.get("items", [])})


def register(app: FastAPI) -> None:
    @app.get("/api/news/eda")
    async def api_news_eda(request: Request, scope: str = Query("all", pattern="^(all|mine)$")):
        tickers = list(ALL_TICKERS) if scope == "all" else await _user_tickers(request)
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor(max_workers=8) as ex:
            chunks = await asyncio.gather(*[loop.run_in_executor(ex, _fetch, t) for t in tickers])
        seen: set[str] = set()
        articles = []
        for a in (x for c in chunks for x in c):
            key = f'{a["ticker"]}:{a["id"] or a["title"]}'
            if key not in seen:
                seen.add(key)
                articles.append(a)
        try:
            changes = (await get_live_snapshot()).get("changes", {})
        except Exception:  # noqa: BLE001
            changes = {}
        result = _analyze(articles, tickers, changes)
        result["scope"] = scope
        result["fetched_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        return result
