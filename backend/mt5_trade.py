"""
mt5_trade.py — MetaTrader 5 Live Trading Module for Quantix Portfolio.

Modes:
1. Native MT5: When backend runs directly on Windows host with MetaTrader 5 terminal.
2. Windows MT5 Bridge: When backend runs in Docker and connects to host.docker.internal:8002.
3. Paper Trading (Simulation): Realistic simulation using **real yfinance prices**.
     Tracks balance, equity, floating P/L, margin, and open positions with live market data.
"""
from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import logging
import os
import random
import re
import threading
import time
from typing import Any, Optional

import httpx
import yfinance as yf
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator

log = logging.getLogger("mt5_trade")

try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    mt5 = None
    MT5_AVAILABLE = False
    log.info("Native MetaTrader5 not available. Paper Trading will use yfinance live prices.")

# ใช้ worker 2 thread + lock เพื่อลดอาการ IPC timeout (-10005) จากการเรียก mt5 ซ้อนกันหลาย thread
# max_workers=2 ให้มี 1 thread สำรองป้องกัน deadlock เมื่อ yfinance และ MT5 ถูกเรียกพร้อมกัน
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="mt5-worker")
_mt5_lock = threading.Lock()
_MT5_EXEC_TIMEOUT = 15.0  # seconds — max time to wait for a native MT5 / yfinance call

DEFAULT_PATH = r"C:\Program Files\MetaTrader 5\terminal64.exe"
BRIDGE_URLS = [
    os.environ.get("MT5_BRIDGE_URL", "http://host.docker.internal:8002"),
    "http://127.0.0.1:8002",
    "http://localhost:8002",
]

# MT5 Default Credentials for Auto-Connect
DEFAULT_MT5_LOGIN = int(os.environ.get("MT5_DEFAULT_LOGIN", 26462314))
DEFAULT_MT5_PASSWORD = os.environ.get("MT5_DEFAULT_PASSWORD", "#d1rnoPM")
DEFAULT_MT5_SERVER = os.environ.get("MT5_DEFAULT_SERVER", "VantageMarkets-Demo")
QUANTIX_25_ASSETS = [
    # 🇺🇸 US Stocks (10)
    {"symbol": "AAPL",  "name": "Apple Inc.",                "category": "US Stocks", "alt": ["AAPL", "AAPLUSD", "AAPL.US", "#AAPL", "AAPL_US"]},
    {"symbol": "MSFT",  "name": "Microsoft Corp.",           "category": "US Stocks", "alt": ["MSFT", "MSFTUSD", "MSFT.US", "#MSFT", "MSFT_US"]},
    {"symbol": "GOOGL", "name": "Alphabet Inc. (Google)",    "category": "US Stocks", "alt": ["GOOGLUSD", "GOOGL", "GOOG", "GOOGL.US", "#GOOGL"]},
    {"symbol": "AMZN",  "name": "Amazon.com Inc.",           "category": "US Stocks", "alt": ["AMZNUSD", "AMZN", "AMZN.US", "#AMZN", "AMZN_US"]},
    {"symbol": "NVDA",  "name": "NVIDIA Corp.",              "category": "US Stocks", "alt": ["NVDAUSD", "NVDA", "NVDA.US", "#NVDA", "NVDA_US"]},
    {"symbol": "TSLA",  "name": "Tesla Inc.",                "category": "US Stocks", "alt": ["TSLA", "TSLAUSD", "TSLA.US", "#TSLA", "TSLA_US"]},
    {"symbol": "META",  "name": "Meta Platforms (Facebook)", "category": "US Stocks", "alt": ["META", "METAUSD", "FB", "META.US", "#META"]},
    {"symbol": "JNJ",   "name": "Johnson & Johnson",         "category": "US Stocks", "alt": ["JNJ", "JNJUSD", "JNJ.US", "#JNJ", "JNJ_US"]},
    {"symbol": "V",     "name": "Visa Inc.",                 "category": "US Stocks", "alt": ["VUSD", "V", "V.US", "#V", "V_US"]},
    {"symbol": "JPM",   "name": "JPMorgan Chase & Co.",      "category": "US Stocks", "alt": ["JPM", "JPMUSD", "JPM.US", "#JPM", "JPM_US"]},

    # 🇹🇭 Thai Stocks (10)
    {"symbol": "PTT",   "name": "PTT PCL",                   "category": "Thai Stocks", "alt": ["PTT", "PTT.BK", "PTT_TH"]},
    {"symbol": "AOT",   "name": "Airports of Thailand",      "category": "Thai Stocks", "alt": ["AOT", "AOT.BK", "AOT_TH"]},
    {"symbol": "CPALL", "name": "CP ALL PCL",                "category": "Thai Stocks", "alt": ["CPALL", "CPALL.BK", "CPALL_TH"]},
    {"symbol": "BDMS",  "name": "Bangkok Dusit Med",         "category": "Thai Stocks", "alt": ["BDMS", "BDMS.BK", "BDMS_TH"]},
    {"symbol": "DELTA", "name": "Delta Electronics (Thai)",  "category": "Thai Stocks", "alt": ["DELTA", "DELTA.BK", "DELTA_TH"]},
    {"symbol": "GULF",  "name": "Gulf Energy Development",   "category": "Thai Stocks", "alt": ["GULF", "GULF.BK", "GULF_TH"]},
    {"symbol": "ADVANC","name": "Advanced Info Service",     "category": "Thai Stocks", "alt": ["ADVANC", "ADVANC.BK", "ADVANC_TH"]},
    {"symbol": "SCB",   "name": "SCB X PCL",                 "category": "Thai Stocks", "alt": ["SCB", "SCB.BK", "SCB_TH"]},
    {"symbol": "KBANK", "name": "Kasikornbank PCL",          "category": "Thai Stocks", "alt": ["KBANK", "KBANK.BK", "KBANK_TH"]},
    {"symbol": "PTTEP", "name": "PTT Exploration & Prod",    "category": "Thai Stocks", "alt": ["PTTEP", "PTTEP.BK", "PTTEP_TH"]},

    # 🛡️ Safe Assets & Bonds (5)
    {"symbol": "GLD",   "name": "SPDR Gold / Spot Gold",     "category": "Safe / Commodities", "alt": ["GLD", "XAUUSD", "GOLD", "XAUUSDm", "XAUUSD+"]},
    {"symbol": "TLT",   "name": "20+ Year Treasury Bond ETF","category": "Safe / Bonds", "alt": ["TLT", "TLT.US", "#TLT"]},
    {"symbol": "IEF",   "name": "7-10 Year Treasury Bond ETF","category": "Safe / Bonds", "alt": ["USNote10Y", "IEF", "IEF.US", "#IEF"]},
    {"symbol": "SHY",   "name": "1-3 Year Treasury Bond ETF","category": "Safe / Bonds", "alt": ["USTUSD", "SHY", "SHY.US", "#SHY"]},
    {"symbol": "BIL",   "name": "SPDR 1-3 Month T-Bill ETF", "category": "Safe / Bonds", "alt": ["BIL", "BIL.US", "#BIL"]},
]

# Map base symbol -> yfinance ticker (Thai stocks need .BK suffix for yfinance)
_SYMBOL_TO_YF = {}
_THAI_SYMBOLS = set()
for _a in QUANTIX_25_ASSETS:
    s = _a["symbol"]
    if _a["category"] == "Thai Stocks":
        _SYMBOL_TO_YF[s] = f"{s}.BK"
        _THAI_SYMBOLS.add(s)
    else:
        _SYMBOL_TO_YF[s] = s

# Fallback prices in case yfinance is temporarily unreachable
QUANTIX_25_BASE_PRICES = {
    "AAPL": 228.40, "MSFT": 420.10, "GOOGL": 178.50, "AMZN": 204.30, "NVDA": 142.50,
    "TSLA": 345.00, "META": 580.20, "JNJ": 156.80, "V": 295.40, "JPM": 245.60,
    "PTT": 31.50, "AOT": 60.25, "CPALL": 64.50, "BDMS": 28.00, "DELTA": 155.00,
    "GULF": 63.25, "ADVANC": 285.00, "SCB": 112.50, "KBANK": 152.00, "PTTEP": 132.50,
    "GLD": 248.50, "TLT": 92.40, "IEF": 94.80, "SHY": 81.70, "BIL": 91.80,
}

ALLOWED_SYMBOLS_SET = (
    {a["symbol"] for a in QUANTIX_25_ASSETS}
    | {a["symbol"] + ".BK" for a in QUANTIX_25_ASSETS}
    | {alt for a in QUANTIX_25_ASSETS for alt in a.get("alt", [])}
)


def _sanitize_comment(comment: Optional[str], fallback: str = "QuantixTrade") -> str:
    """แปลง comment ให้เป็น ASCII ปลอดภัย ความยาวไม่เกิน 28 ตัวอักษร (แก้ Error -2 Invalid comment)."""
    raw = str(comment or "").strip()
    ascii_only = re.sub(r"[^A-Za-z0-9 _\-.]", "", raw).strip()
    cleaned = re.sub(r"\s+", "_", ascii_only)
    if not cleaned:
        cleaned = fallback
    return cleaned[:28]


# ══════════════════════════════════════════════════════════════════════════════
#  REAL-TIME PRICE ENGINE (yfinance) — cached, shared by Paper Trading
# ══════════════════════════════════════════════════════════════════════════════
_price_cache: dict[str, dict] = {}
_PRICE_TTL = 10
_micro_drift: dict[str, float] = {}  # symbol -> drift percent offset


def _apply_sim_micro_volatility(symbol: str, base_price: float) -> tuple[float, float, float]:
    """Generates continuous realistic bid/ask ticks for simulation desk 24/7."""
    drift = _micro_drift.get(symbol, 0.0)
    # Mean-reverting random walk (90% persistence, 10% market noise)
    step = random.uniform(-0.0012, 0.0012)
    drift = (drift * 0.90) + step
    drift = max(-0.02, min(0.02, drift))  # cap drift at +/- 2.0%
    _micro_drift[symbol] = drift

    sim_last = round(base_price * (1.0 + drift), 2)
    spread = round(max(0.02, sim_last * 0.0008), 2)
    sim_bid = round(sim_last - (spread / 2.0), 2)
    sim_ask = round(sim_last + (spread / 2.0), 2)
    return sim_bid, sim_ask, sim_last


def _yf_fetch_price(symbol: str) -> dict:
    """Fetch real-time price from yfinance for a single symbol. BLOCKING — run in executor."""
    yf_ticker = _SYMBOL_TO_YF.get(symbol, symbol)
    try:
        tk = yf.Ticker(yf_ticker)
        info = tk.fast_info
        price = getattr(info, "last_price", None)
        if price is None or price <= 0:
            hist = tk.history(period="1d")
            if not hist.empty:
                price = float(hist["Close"].iloc[-1])
            else:
                price = QUANTIX_25_BASE_PRICES.get(symbol, 100.0)
        price = float(price)
    except Exception as e:
        log.warning(f"yfinance price fetch failed for {symbol}/{yf_ticker}: {e}")
        price = QUANTIX_25_BASE_PRICES.get(symbol, 100.0)

    if symbol in _THAI_SYMBOLS:
        spread_pct = 0.0012
    elif symbol in ("GLD", "TLT", "IEF", "SHY", "BIL"):
        spread_pct = 0.0005
    else:
        spread_pct = 0.0003

    half_spread = price * spread_pct / 2
    bid = round(price - half_spread, 4)
    ask = round(price + half_spread, 4)

    return {
        "symbol": symbol,
        "yf_ticker": yf_ticker,
        "bid": round(bid, 2),
        "ask": round(ask, 2),
        "last": round(price, 2),
        "spread": round(ask - bid, 4),
        "time": int(time.time()),
    }


def _fetch_ohlc_candles(symbol: str, period: str = "1mo", interval: str = "1d") -> list[dict]:
    """Fetch real historical OHLC candles from yfinance for lightweight-charts."""
    import math
    clean = symbol.strip().upper().replace(".BK", "").replace(".US", "")
    yf_ticker = _SYMBOL_TO_YF.get(clean, clean)
    try:
        tk = yf.Ticker(yf_ticker)
        df = tk.history(period=period, interval=interval)
        if df.empty:
            df = tk.history(period="3mo", interval="1d")

        candles = []
        if not df.empty:
            df = df.dropna(subset=["Open", "High", "Low", "Close"])
            for idx, row in df.iterrows():
                o, h, l, c = float(row["Open"]), float(row["High"]), float(row["Low"]), float(row["Close"])
                if math.isnan(o) or math.isnan(h) or math.isnan(l) or math.isnan(c) or o <= 0 or c <= 0:
                    continue

                if hasattr(idx, "timestamp"):
                    ts = int(idx.timestamp())
                else:
                    ts = int(time.time())
                candles.append({
                    "time": ts,
                    "open": round(o, 2),
                    "high": round(h, 2),
                    "low": round(l, 2),
                    "close": round(c, 2),
                    "volume": int(row.get("Volume", 0) if not math.isnan(row.get("Volume", 0)) else 0),
                })
            if candles:
                return candles
    except Exception as e:
        log.warning(f"Failed to fetch candles for {symbol}: {e}")

    # Fallback synthetic realistic candles if yfinance is temporarily unreachable
    base = QUANTIX_25_BASE_PRICES.get(clean, 100.0)
    now_ts = int(time.time())
    candles = []
    p = base * 0.95
    for i in range(30, -1, -1):
        ts = now_ts - (i * 86400)
        chg = (hash(f"{clean}-{i}") % 100 - 48) / 1000.0
        p_open = round(p, 2)
        p_close = round(p * (1.0 + chg), 2)
        p_high = round(max(p_open, p_close) * 1.008, 2)
        p_low = round(min(p_open, p_close) * 0.992, 2)
        p = p_close
        candles.append({
            "time": ts,
            "open": p_open,
            "high": p_high,
            "low": p_low,
            "close": p_close,
            "volume": 50000 + (hash(f"vol-{i}") % 80000),
        })
    return candles


async def _get_live_price(symbol: str) -> dict:
    """Get cached live price or fetch fresh from yfinance with simulation micro-ticks."""
    clean = symbol.strip().upper().replace(".BK", "").replace(".US", "")
    cached = _price_cache.get(clean)

    if not cached or (time.time() - cached.get("ts", 0)) >= _PRICE_TTL:
        loop = asyncio.get_running_loop()
        try:
            data = await asyncio.wait_for(
                loop.run_in_executor(_executor, _yf_fetch_price, clean),
                timeout=_MT5_EXEC_TIMEOUT
            )
        except asyncio.TimeoutError:
            log.warning(f"yfinance price fetch timed out for {clean} — using fallback price")
            fallback = QUANTIX_25_BASE_PRICES.get(clean, 100.0)
            data = {
                "symbol": clean, "bid": round(fallback * 0.9995, 2),
                "ask": round(fallback * 1.0005, 2), "last": fallback,
                "spread": round(fallback * 0.001, 4), "time": int(time.time()),
                "source": "fallback_timeout",
            }
        data["ts"] = time.time()
        _price_cache[clean] = data
    else:
        data = dict(cached)

    # If running in simulation desk, apply realistic live micro-volatility ticks
    if _state.get("mode") == "simulation":
        sim_bid, sim_ask, sim_last = _apply_sim_micro_volatility(clean, data.get("last", 100.0))
        data["bid"] = sim_bid
        data["ask"] = sim_ask
        data["last"] = sim_last
        data["spread"] = round(sim_ask - sim_bid, 2)
        data["time"] = int(time.time())

    return data


import json
from pathlib import Path

SIM_STATE_FILE = Path("output") / "demo_trade_state.json"

# ══════════════════════════════════════════════════════════════════════════════
#  CONNECTION & SIM STATE (Default to Paper Trading mode: autonomous & always ready)
# ══════════════════════════════════════════════════════════════════════════════
_state = {
    "connected": True,
    "mode": "simulation",  # "simulation" (Demo Account), "native", or "bridge"
    "login": 889900,
    "server": "Quantix Demo Trading",
    "last_error": None,
    "terminal_path": None,
}

_sim_state = {
    "account": {
        "login": 889900,
        "name": "Quantix Demo Account",
        "server": "Quantix Demo Trading",
        "currency": "USD",
        "balance": 10000.0,
        "equity": 10000.0,
        "profit": 0.0,
        "holdings_value": 0.0,
        "margin": 0.0,
        "margin_free": 10000.0,
        "margin_level": 100.0,
        "leverage": 1,
    },
    "positions": [],
    "ticket_counter": 5001,
    "trade_history": [],
}

def _save_sim_state():
    """Persist Demo Paper Trading state so balance/positions survive restarts & logout."""
    try:
        SIM_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(SIM_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(_sim_state, f, ensure_ascii=False, indent=2)
    except Exception as e:
        log.warning(f"Failed to save demo_trade_state: {e}")

def _load_sim_state():
    """Load persisted Demo Paper Trading state from disk."""
    global _sim_state
    if SIM_STATE_FILE.exists():
        try:
            with open(SIM_STATE_FILE, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if isinstance(loaded, dict) and "account" in loaded:
                    _sim_state = loaded
                    log.info(f"✓ Loaded persistent Demo account balance: ${_sim_state['account']['balance']}")
        except Exception as e:
            log.warning(f"Failed to load demo_trade_state: {e}")

_load_sim_state()


# ══════════════════════════════════════════════════════════════════════════════
#  CROSS-MODULE SYNC: Quant Day Trade → My Portfolio / Rebalance / Backtest
# ══════════════════════════════════════════════════════════════════════════════

async def _sync_trade_to_portfolios(symbol: str, action: str, shares: float, fill_price: float, user_id: Optional[str] = None):
    """
    Sync executed DayTrade/MT5 deal to My Portfolio collection (user_multi_portfolios in MongoDB).
    Ensures that buying or selling in Quant Day Trade immediately updates:
      - My Portfolio holdings, values & P/L
      - Rebalancing suggestions
      - Backtesting real portfolio
    """
    try:
        from auth import db
        from live import get_live_snapshot
        from yh import USD_TICKERS

        clean_sym = symbol.upper().replace(".BK", "").replace(".US", "").strip()

        # FX conversion if needed (My Portfolio stores buyPrice in THB)
        fx_rate = 35.0
        try:
            snap = await get_live_snapshot()
            fx_rate = snap.get("fx_thb_per_usd", 35.0)
        except Exception:
            pass

        is_usd = clean_sym in USD_TICKERS or clean_sym in (
            "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "JNJ", "V", "JPM", "GLD", "TLT", "IEF", "SHY", "BIL"
        )
        price_thb = round(fill_price * fx_rate, 2) if is_usd else round(fill_price, 2)
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        target_user_ids = []
        if user_id:
            target_user_ids = [user_id]
        else:
            users = await db.users.find({}, {"user_id": 1}).to_list(50)
            if users:
                target_user_ids = [u["user_id"] for u in users]
            else:
                docs = await db.user_multi_portfolios.find({}, {"user_id": 1}).to_list(50)
                target_user_ids = [d["user_id"] for d in docs]

        for uid in target_user_ids:
            doc = await db.user_multi_portfolios.find_one({"user_id": uid})
            if not doc or not doc.get("portfolios"):
                default_p = {
                    "id": f"p_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
                    "name": "พอร์ตหลัก",
                    "icon": "📊",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "items": [],
                }
                portfolios = [default_p]
            else:
                portfolios = doc["portfolios"]

            active_p = portfolios[0]
            items = active_p.setdefault("items", [])

            match_idx = -1
            for i, itm in enumerate(items):
                if itm.get("ticker", "").upper().replace(".BK", "").strip() == clean_sym:
                    match_idx = i
                    break

            if action.upper() == "BUY":
                if match_idx >= 0:
                    old_item = items[match_idx]
                    old_sh = float(old_item.get("shares", 0))
                    new_sh = old_sh + float(shares)
                    old_cost = float(old_item.get("buyPrice", price_thb)) * old_sh
                    new_cost = old_cost + (price_thb * float(shares))
                    old_item["shares"] = round(new_sh, 4)
                    old_item["buyPrice"] = round(new_cost / new_sh, 2) if new_sh > 0 else price_thb
                    old_item["buyDate"] = today_str
                else:
                    new_item = {
                        "id": f"h_dt_{int(time.time() * 1000)}_{clean_sym}",
                        "ticker": clean_sym,
                        "shares": round(float(shares), 4),
                        "buyDate": today_str,
                        "buyPrice": price_thb,
                    }
                    items.append(new_item)

            elif action.upper() in ("SELL", "CLOSE"):
                if match_idx >= 0:
                    old_item = items[match_idx]
                    old_sh = float(old_item.get("shares", 0))
                    if old_sh <= float(shares) + 0.001:
                        items.pop(match_idx)
                    else:
                        old_item["shares"] = round(old_sh - float(shares), 4)

            await db.user_multi_portfolios.update_one(
                {"user_id": uid},
                {"$set": {"portfolios": portfolios}},
                upsert=True
            )
            log.info(f"✓ Synced {action} {clean_sym} ({shares} shares @ ฿{price_thb}) to My Portfolio for user {uid}")
    except Exception as e:
        log.warning(f"Portfolio sync warning: {e}")


async def _sync_all_open_positions_to_portfolio():
    """Sync all currently open Quant Day Trade positions into My Portfolio."""
    try:
        from auth import db
        from live import get_live_snapshot
        from yh import USD_TICKERS

        users = await db.users.find({}, {"user_id": 1}).to_list(50)
        target_uids = [u["user_id"] for u in users] if users else []
        if not target_uids:
            docs = await db.user_multi_portfolios.find({}, {"user_id": 1}).to_list(50)
            target_uids = [d["user_id"] for d in docs]

        if not target_uids:
            return

        fx_rate = 35.0
        try:
            snap = await get_live_snapshot()
            fx_rate = snap.get("fx_thb_per_usd", 35.0)
        except Exception:
            pass

        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        for uid in target_uids:
            doc = await db.user_multi_portfolios.find_one({"user_id": uid})
            if not doc or not doc.get("portfolios"):
                default_p = {
                    "id": f"p_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
                    "name": "พอร์ตหลัก",
                    "icon": "📊",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "items": [],
                }
                portfolios = [default_p]
            else:
                portfolios = doc["portfolios"]

            active_p = portfolios[0]
            existing_items = active_p.setdefault("items", [])

            # Active symbols currently held in DayTrade
            open_positions = _sim_state.get("positions", [])
            open_symbols = {pos["symbol"].upper().replace(".BK", "").replace(".US", "").strip() for pos in open_positions}

            # Remove DayTrade holdings that have been liquidated/closed
            active_p["items"] = [
                itm for itm in existing_items
                if not (itm.get("id", "").startswith("h_dt_") and itm.get("ticker", "").upper().replace(".BK", "").strip() not in open_symbols)
            ]
            existing_items = active_p["items"]
            existing_map = {itm["ticker"].upper().replace(".BK", "").strip(): itm for itm in existing_items}

            # Map open positions from DayTrade into My Portfolio
            for pos in open_positions:
                sym = pos["symbol"].upper().replace(".BK", "").replace(".US", "").strip()
                vol = float(pos.get("volume", 1.0))
                p_open = float(pos.get("price_open", 100.0))
                is_thai = sym in _THAI_SYMBOLS
                # If Thai stock, p_open in DayTrade is USD (e.g. ~1.10), convert to THB (37.33)
                if is_thai:
                    price_thb = round(p_open * fx_rate, 2) if p_open < 10.0 else round(p_open, 2)
                else:
                    price_thb = round(p_open * fx_rate, 2)

                if sym in existing_map:
                    existing_map[sym]["shares"] = vol
                    existing_map[sym]["buyPrice"] = price_thb
                else:
                    new_item = {
                        "id": f"h_dt_{int(time.time()*1000)}_{sym}",
                        "ticker": sym,
                        "shares": vol,
                        "buyDate": today_str,
                        "buyPrice": price_thb,
                    }
                    existing_items.append(new_item)
                    existing_map[sym] = new_item

            await db.user_multi_portfolios.update_one(
                {"user_id": uid},
                {"$set": {"portfolios": portfolios}},
                upsert=True
            )
            log.info(f"✓ Synced {len(open_positions)} DayTrade positions to My Portfolio for {uid}")
    except Exception as e:
        log.warning(f"Failed to sync all positions to portfolio: {e}")


# ── Pydantic Request Models ───────────────────────────────────────────────────

class ConnectRequest(BaseModel):
    login: Optional[int] = Field(None, description="MT5 Account Number")
    password: Optional[str] = Field(None, description="MT5 Password")
    server: Optional[str] = Field(None, description="MT5 Broker Server")
    path: Optional[str] = Field(None, description="Path to terminal64.exe")
    force_simulation: Optional[bool] = Field(False, description="Force Paper Trading mode")


class OrderRequest(BaseModel):
    symbol: str = Field(..., description="Must be one of the 25 Quantix assets")
    action: str = Field(..., description="BUY or SELL")
    volume: float = Field(..., gt=0, description="Order volume in lots")
    sl: Optional[float] = Field(0.0, description="Stop Loss price")
    tp: Optional[float] = Field(0.0, description="Take Profit price")
    deviation: Optional[int] = Field(20, description="Max slippage in points")
    comment: Optional[str] = Field("QuantixLive", description="Order comment")

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        val = str(v or "").strip().upper()
        if val not in ("BUY", "SELL"):
            raise ValueError("action ต้องเป็น BUY หรือ SELL เท่านั้น")
        return val

    @field_validator("comment")
    @classmethod
    def validate_comment(cls, v: Optional[str]) -> str:
        return _sanitize_comment(v, fallback="QuantixLive")


class CloseRequest(BaseModel):
    ticket: int = Field(..., description="Position ticket ID to close")


class RebalanceTradeRequest(BaseModel):
    allocations: dict[str, float] = Field(..., description="Symbol to target weight")
    total_risk_equity: Optional[float] = Field(None, description="Equity portion to allocate")
    comment: Optional[str] = Field("QuantixRebalance", description="Order comment")

    @field_validator("comment")
    @classmethod
    def validate_comment(cls, v: Optional[str]) -> str:
        return _sanitize_comment(v, fallback="QuantixRebalance")


# ══════════════════════════════════════════════════════════════════════════════
#  PAPER TRADING ENGINE — Realistic P/L with live yfinance prices
# ══════════════════════════════════════════════════════════════════════════════

async def _sim_update_positions():
    positions_to_close = []

    try:
        from live import get_live_snapshot
        snap = get_live_snapshot()
        fx_rate = float(snap.get("fx_rate") or snap.get("fx_thb_per_usd") or 35.0)
    except Exception:
        fx_rate = 35.0

    for pos in _sim_state["positions"]:
        try:
            live = await _get_live_price(pos["symbol"])
            raw_price = live["bid"] if pos["type"] == "BUY" else live["ask"]
            sym = pos["symbol"].upper().replace(".BK", "").replace(".US", "").strip()
            is_thai = sym in _THAI_SYMBOLS

            # If Thai stock, raw_price is in THB, convert to USD for USD-denominated MT5 account
            current_price = round(raw_price / fx_rate, 2) if is_thai else round(raw_price, 2)
            if is_thai and pos.get("price_open", 0) > 10.0:
                pos["price_open"] = round(pos["price_open"] / fx_rate, 2)

            pos["price_current"] = current_price
            volume = float(pos.get("volume", 1.0))
            cost_basis = pos.get("cost_basis", round(pos["price_open"] * volume, 2))
            if is_thai and cost_basis > 10.0:
                cost_basis = round(cost_basis / fx_rate, 2)
            pos["cost_basis"] = round(cost_basis, 2)
            market_val = round(current_price * volume, 2)
            pos["market_value"] = market_val
            pos["profit"] = round(market_val - pos["cost_basis"], 2)
            if pos["price_open"] > 0:
                pos["profit_pct"] = round(((current_price - pos["price_open"]) / pos["price_open"]) * 100, 2)
            else:
                pos["profit_pct"] = 0.0

            sl = pos.get("sl", 0.0) or 0.0
            tp = pos.get("tp", 0.0) or 0.0
            if is_thai:
                if sl > 10.0:
                    sl = round(sl / fx_rate, 2)
                    pos["sl"] = sl
                if tp > 10.0:
                    tp = round(tp / fx_rate, 2)
                    pos["tp"] = tp

            if pos["type"] == "BUY":
                if sl > 0 and current_price <= sl:
                    pos["close_reason"] = "SL_HIT"
                    positions_to_close.append(pos)
                elif tp > 0 and current_price >= tp:
                    pos["close_reason"] = "TP_HIT"
                    positions_to_close.append(pos)
            else:
                if sl > 0 and current_price >= sl:
                    pos["close_reason"] = "SL_HIT"
                    positions_to_close.append(pos)
                elif tp > 0 and current_price <= tp:
                    pos["close_reason"] = "TP_HIT"
                    positions_to_close.append(pos)

        except Exception as e:
            log.warning(f"Price update error for {pos['symbol']}: {e}")

    for pos in positions_to_close:
        reason = pos.pop("close_reason", "SL/TP")
        volume = float(pos.get("volume", 1.0))
        sale_proceeds = round(pos["price_current"] * volume, 2)
        # Credit full sale proceeds back to cash balance
        _sim_state["account"]["balance"] = round(
            _sim_state["account"]["balance"] + sale_proceeds, 2
        )
        realized_pl = pos["profit"]
        _sim_state["trade_history"].insert(0, {
            "ticket": pos["ticket"],
            "symbol": pos["symbol"],
            "type": pos["type"],
            "volume": volume,
            "price_open": pos["price_open"],
            "price_close": pos["price_current"],
            "cost_basis": pos.get("cost_basis", round(pos["price_open"] * volume, 2)),
            "proceeds": sale_proceeds,
            "profit": realized_pl,
            "profit_pct": pos.get("profit_pct", 0.0),
            "close_reason": reason,
            "closed_at": datetime.now(timezone.utc).isoformat(),
        })
        _sim_state["positions"].remove(pos)

    if positions_to_close:
        await _sync_all_open_positions_to_portfolio()

    # Spot Cash Accounting (No leverage debt, pure Cash + Holdings)
    total_holdings_value = round(sum(p.get("market_value", p["price_current"] * float(p.get("volume", 1.0))) for p in _sim_state["positions"]), 2)
    total_floating_pl = round(sum(p.get("profit", 0.0) for p in _sim_state["positions"]), 2)
    cash_balance = round(_sim_state["account"]["balance"], 2)

    _sim_state["account"]["balance"] = cash_balance
    _sim_state["account"]["holdings_value"] = total_holdings_value
    _sim_state["account"]["profit"] = total_floating_pl
    _sim_state["account"]["equity"] = round(cash_balance + total_holdings_value, 2)
    _sim_state["account"]["margin"] = total_holdings_value
    _sim_state["account"]["margin_free"] = cash_balance
    _sim_state["account"]["margin_level"] = 100.0 if total_holdings_value > 0 else 0.0
    _sim_state["account"]["leverage"] = 1

    # Save to disk
    _save_sim_state()


# ── Bridge Client Helper ──────────────────────────────────────────────────────

async def _probe_bridge() -> Optional[str]:
    for b_url in BRIDGE_URLS:
        try:
            async with httpx.AsyncClient(timeout=1.5) as client:
                res = await client.get(f"{b_url}/health")
                if res.status_code == 200:
                    return b_url
        except Exception:
            continue
    return None


async def _bridge_request(method: str, path: str, json_data: Any = None) -> Any:
    bridge_url = await _probe_bridge()
    if not bridge_url:
        return None
    url = f"{bridge_url}{path}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        if method.upper() == "GET":
            res = await client.get(url)
        elif method.upper() == "POST":
            res = await client.post(url, json=json_data)
        else:
            raise ValueError(f"Unsupported method {method}")

        if res.status_code != 200:
            detail = res.text
            try:
                detail = res.json().get("detail", detail)
            except Exception:
                pass
            raise RuntimeError(f"Bridge error ({res.status_code}): {detail}")
        return res.json()


# ── Native MT5 Symbol Matcher ─────────────────────────────────────────────────

def _resolve_broker_symbol(symbol: str) -> str:
    """Smart resolve symbol based on broker naming conventions (e.g. VantageMarkets, IC Markets, Pepperstone)."""
    if not MT5_AVAILABLE:
        return symbol
    clean_sym = symbol.replace(".BK", "").strip().upper()

    # 1. Exact match in broker symbols
    info = mt5.symbol_info(clean_sym)
    if info:
        return clean_sym

    # 2. Match against QUANTIX_25_ASSETS alt list
    for asset in QUANTIX_25_ASSETS:
        if asset["symbol"] == clean_sym or asset["symbol"] == symbol:
            for alt in asset.get("alt", []):
                info = mt5.symbol_info(alt)
                if info:
                    return alt

    # 3. Dynamic candidate check (Common broker prefixes/suffixes)
    # VantageMarkets uses: NVDAUSD, AMZNUSD, GOOGLUSD, AAPL, SPY, GLD, etc.
    candidates = [
        f"{clean_sym}USD",
        f"{clean_sym}.US",
        f"#{clean_sym}",
        f"{clean_sym}_US",
        f"{clean_sym}m",
        f"{clean_sym}+",
        f"{clean_sym}.24H",
    ]
    if clean_sym in ("GLD", "GOLD"):
        candidates.extend(["XAUUSD", "GOLD", "XAUUSDm", "XAUUSD+"])
    for cand in candidates:
        info = mt5.symbol_info(cand)
        if info:
            return cand

    # 4. Search all symbols from broker if not found yet
    try:
        all_syms = mt5.symbols_get()
        if all_syms:
            for s in all_syms:
                s_name = s.name.upper()
                if s_name == clean_sym or s_name.startswith(clean_sym) or s_name.endswith(clean_sym):
                    return s.name
    except Exception:
        pass

    return clean_sym


# ── Native MT5 Helpers (Windows Host) ─────────────────────────────────────────

def _native_format_account(acc: Any) -> dict[str, Any]:
    if acc is None:
        return {}
    return {
        "login": acc.login,
        "trade_mode": "Demo" if acc.trade_mode == 0 else "Contest" if acc.trade_mode == 1 else "Real",
        "name": acc.name,
        "server": acc.server,
        "currency": acc.currency,
        "company": acc.company,
        "balance": round(float(acc.balance), 2),
        "equity": round(float(acc.equity), 2),
        "profit": round(float(acc.profit), 2),
        "margin": round(float(acc.margin), 2),
        "margin_free": round(float(acc.margin_free), 2),
        "margin_level": round(float(acc.margin_level), 2) if acc.margin > 0 else 0.0,
        "leverage": int(acc.leverage),
    }


def _native_init_and_login(login=None, password=None, server=None, path=None):
    with _mt5_lock:
        if not MT5_AVAILABLE:
            raise RuntimeError("ไม่พบไลบรารี MetaTrader5 ใน Python ตัวที่รัน Backend")

        target_path = path or _state.get("terminal_path") or DEFAULT_PATH

        # 1. ลองเกาะเข้าโปรแกรม MT5 ที่เปิดค้างไว้อยู่แล้วก่อนโดยไม่ระบุ path (แก้ Error -6)
        initialized = mt5.initialize(timeout=15000)
        if not initialized and target_path and os.path.exists(target_path):
            initialized = mt5.initialize(path=target_path, timeout=15000)

        if not initialized:
            err = mt5.last_error()
            _state["connected"] = False
            _state["last_error"] = str(err)
            raise RuntimeError(f"เปิดการเชื่อมต่อ MT5 ไม่สำเร็จ: {err} (ตรวจสอบว่าเปิด MT5 และรันสิทธิ์ Administrator ตรงกัน)")

        # 2. เช็คว่าบัญชีที่ล็อกอินค้างไว้ตรงกับที่ระบุหรือไม่ ถ้าไม่ตรงค่อยสั่ง login ใหม่
        acc = mt5.account_info()
        need_login = False
        if login:
            if acc is None or int(acc.login) != int(login):
                need_login = True
            elif server and str(acc.server).strip() != str(server).strip():
                need_login = True

        if need_login:
            if not password or not server:
                raise RuntimeError(f"บัญชีปัจจุบันใน MT5 ไม่ใช่ #{login} กรุณาระบุ Password และ Server ให้ครบ")
            if not mt5.login(login=int(login), password=str(password), server=str(server)):
                err = mt5.last_error()
                _state["connected"] = False
                _state["last_error"] = str(err)
                raise RuntimeError(f"ล็อกอินบัญชี #{login} บน {server} ไม่สำเร็จ: {err}")
            acc = mt5.account_info()

        if not acc:
            err = mt5.last_error()
            raise RuntimeError(f"เชื่อมต่อ Terminal ได้ แต่ดึงข้อมูลบัญชีไม่สำเร็จ: {err}")

        _state["connected"] = True
        _state["mode"] = "native"
        _state["login"] = acc.login
        _state["server"] = acc.server
        _state["last_error"] = None
        _state["terminal_path"] = target_path
        return _native_format_account(acc)


def _native_get_account():
    with _mt5_lock:
        if not MT5_AVAILABLE:
            return {}
        if not _state["connected"]:
            try:
                # 1. ลองเกาะ MT5 ปัจจุบัน
                if mt5.initialize(timeout=5000):
                    acc = mt5.account_info()
                    # ถ้าเปิดค้างไว้และล็อกอินตรงกับบัญชี Default หรือมีบัญชีทำงานอยู่แล้ว
                    if acc and acc.login:
                        if DEFAULT_MT5_LOGIN and int(acc.login) != DEFAULT_MT5_LOGIN:
                            # ล็อกอินสลับมายังบัญชี Default อัตโนมัติ
                            mt5.login(login=DEFAULT_MT5_LOGIN, password=DEFAULT_MT5_PASSWORD, server=DEFAULT_MT5_SERVER)
                            acc = mt5.account_info()
                        if acc:
                            _state["connected"] = True
                            _state["mode"] = "native"
                            _state["login"] = acc.login
                            _state["server"] = acc.server
                            return _native_format_account(acc)
                # 2. ถ้ายังไม่ล็อกอิน ให้ล็อกอินด้วย Default Credentials
                if DEFAULT_MT5_LOGIN and DEFAULT_MT5_PASSWORD:
                    if mt5.initialize(timeout=8000):
                        if mt5.login(login=DEFAULT_MT5_LOGIN, password=DEFAULT_MT5_PASSWORD, server=DEFAULT_MT5_SERVER):
                            acc = mt5.account_info()
                            if acc:
                                _state["connected"] = True
                                _state["mode"] = "native"
                                _state["login"] = acc.login
                                _state["server"] = acc.server
                                return _native_format_account(acc)
            except Exception as e:
                log.warning(f"Auto-connect native MT5 error: {e}")
            return {}
        acc = mt5.account_info()
        return _native_format_account(acc) if acc else {}


def _native_get_positions():
    with _mt5_lock:
        if not MT5_AVAILABLE or not _state["connected"]:
            return []
        raw = mt5.positions_get()
        if not raw:
            return []
        res = []
        for pos in raw:
            t_dt = datetime.fromtimestamp(pos.time, tz=timezone.utc)
            res.append({
                "ticket": int(pos.ticket),
                "symbol": str(pos.symbol),
                "type": "BUY" if pos.type == mt5.ORDER_TYPE_BUY else "SELL",
                "volume": round(float(pos.volume), 2),
                "price_open": float(pos.price_open),
                "price_current": float(pos.price_current),
                "sl": float(pos.sl),
                "tp": float(pos.tp),
                "profit": round(float(pos.profit), 2),
                "swap": round(float(pos.swap), 2),
                "time": t_dt.strftime("%Y-%m-%d %H:%M:%S UTC"),
                "comment": str(pos.comment or ""),
            })
        return res


def _native_send_order(req: OrderRequest):
    with _mt5_lock:
        if not MT5_AVAILABLE or not _state["connected"]:
            raise RuntimeError("MT5 is not connected.")
        broker_sym = _resolve_broker_symbol(req.symbol)
        sym_info = mt5.symbol_info(broker_sym)
        if not sym_info:
            raise RuntimeError(f"Symbol '{req.symbol}' (mapped to '{broker_sym}') is not available at this broker.")
        if not sym_info.visible:
            mt5.symbol_select(broker_sym, True)
        tick = mt5.symbol_info_tick(broker_sym)
        price = 0.0
        action = req.action.upper()
        order_type = mt5.ORDER_TYPE_BUY if action == "BUY" else mt5.ORDER_TYPE_SELL

        if tick and (tick.ask > 0 or tick.bid > 0):
            price = tick.ask if action == "BUY" else tick.bid
        else:
            # Fallback to last M1 bar close if live tick stream is paused or market closed
            rates = mt5.copy_rates_from_pos(broker_sym, mt5.TIMEFRAME_M1, 0, 1)
            if rates is not None and len(rates) > 0 and rates[0][4] > 0:
                price = float(rates[0][4])
            else:
                raise RuntimeError(f"Cannot get live tick or candle price for '{broker_sym}'. Market may be closed.")

        if not price or float(price) <= 0:
            raise RuntimeError(f"Invalid tick price ({price}) for '{broker_sym}'.")

        # Adjust volume according to broker symbol requirements (min volume, step)
        target_volume = float(req.volume)
        if sym_info.volume_min > 0 and target_volume < sym_info.volume_min:
            target_volume = float(sym_info.volume_min)
        if sym_info.volume_step > 0:
            steps = round((target_volume - sym_info.volume_min) / sym_info.volume_step)
            target_volume = sym_info.volume_min + (steps * sym_info.volume_step)
        if sym_info.volume_max > 0 and target_volume > sym_info.volume_max:
            target_volume = float(sym_info.volume_max)
        target_volume = round(target_volume, 2)

        filling = (
            mt5.ORDER_FILLING_IOC if (sym_info.filling_mode & 2)
            else mt5.ORDER_FILLING_FOK if (sym_info.filling_mode & 1)
            else mt5.ORDER_FILLING_RETURN
        )
        safe_comment = _sanitize_comment(req.comment, fallback="QuantixTrade")

        trade_req = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": broker_sym,
            "volume": target_volume,
            "type": order_type,
            "price": float(price),
            "sl": float(req.sl) if req.sl else 0.0,
            "tp": float(req.tp) if req.tp else 0.0,
            "deviation": int(req.deviation or 20),
            "magic": 202611,
            "comment": safe_comment,
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": filling,
        }
        result = mt5.order_send(trade_req)
        if result is None:
            raise RuntimeError(f"Order failed: {mt5.last_error()}")
        if result.retcode == 10030:
            for alt in [mt5.ORDER_FILLING_FOK, mt5.ORDER_FILLING_RETURN]:
                trade_req["type_filling"] = alt
                result = mt5.order_send(trade_req)
                if result and result.retcode == mt5.TRADE_RETCODE_DONE:
                    break
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            err_msg = f"Broker rejected trade: {result.comment} (code {result.retcode})"
            if result.retcode == 10027:
                err_msg += " -> กรุณากดเปิดปุ่ม 'Algo Trading' (AutoTrading) บนแถบเครื่องมือของโปรแกรม MT5 ให้เป็นสีเขียว"
            raise RuntimeError(err_msg)
        return {
            "success": True,
            "order": int(result.order),
            "deal": int(result.deal),
            "volume": float(result.volume),
            "price": float(result.price),
            "retcode": int(result.retcode),
            "comment": str(result.comment),
            "symbol": broker_sym,
            "action": action,
        }


def _native_close(ticket: int):
    with _mt5_lock:
        positions = mt5.positions_get(ticket=ticket)
        if not positions:
            raise RuntimeError(f"Position #{ticket} not found or already closed.")
        pos = positions[0]
        symbol = pos.symbol
        tick = mt5.symbol_info_tick(symbol)
        if not tick:
            raise RuntimeError(f"Cannot get tick price for '{symbol}'.")
        close_type = mt5.ORDER_TYPE_SELL if pos.type == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY
        price = tick.bid if pos.type == mt5.ORDER_TYPE_BUY else tick.ask
        sym_info = mt5.symbol_info(symbol)
        filling = (
            mt5.ORDER_FILLING_IOC if (sym_info.filling_mode & 2)
            else mt5.ORDER_FILLING_FOK if (sym_info.filling_mode & 1)
            else mt5.ORDER_FILLING_RETURN
        )
        req = {
            "action": mt5.TRADE_ACTION_DEAL,
            "position": int(pos.ticket),
            "symbol": symbol,
            "volume": float(pos.volume),
            "type": close_type,
            "price": float(price),
            "deviation": 20,
            "magic": 202611,
            "comment": "QuantixClose",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": filling,
        }
        result = mt5.order_send(req)
        if result is None:
            raise RuntimeError(f"Close failed: {mt5.last_error()}")
        if result.retcode == 10030:
            for alt in [mt5.ORDER_FILLING_FOK, mt5.ORDER_FILLING_RETURN]:
                req["type_filling"] = alt
                result = mt5.order_send(req)
                if result and result.retcode == mt5.TRADE_RETCODE_DONE:
                    break
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            raise RuntimeError(f"Close rejected: {result.comment} (code {result.retcode})")
        return {
            "success": True,
            "ticket": ticket,
            "deal": int(result.deal),
            "price": float(result.price),
            "volume": float(result.volume),
            "comment": str(result.comment),
        }


# ══════════════════════════════════════════════════════════════════════════════
#  CORE ORDER EXECUTION (Shared by FastAPI Routes & Internal Bot)
# ══════════════════════════════════════════════════════════════════════════════

async def _execute_order_core(req: OrderRequest) -> dict[str, Any]:
    """Internal core order execution handler for simulation, bridge, and native MT5."""
    if not _state["connected"]:
        raise RuntimeError("กรุณาเชื่อมต่อ MT5 ก่อนส่งคำสั่ง")

    safe_comment = _sanitize_comment(req.comment, fallback="QuantixTrade")

    if _state["mode"] == "simulation":
        live = await _get_live_price(req.symbol)
        action_upper = req.action.upper().strip()
        fill_price = live["ask"] if action_upper == "BUY" else live["bid"]
        sym_clean = req.symbol.upper().replace(".BK", "").replace(".US", "").strip()
        shares = float(req.volume)
        is_thai = sym_clean in _THAI_SYMBOLS

        try:
            from live import get_live_snapshot
            snap = get_live_snapshot()
            fx_rate = float(snap.get("fx_rate") or snap.get("fx_thb_per_usd") or 35.0)
        except Exception:
            fx_rate = 35.0

        # For Thai stocks, live price is in THB; convert to USD for USD-denominated DayTrade account
        fill_price_usd = round(fill_price / fx_rate, 2) if is_thai else round(fill_price, 2)

        if action_upper == "BUY":
            cost = round(fill_price_usd * shares, 2)
            avail_cash = _sim_state["account"]["balance"]
            if cost > avail_cash:
                raise RuntimeError(
                    f"เงินสดไม่เพียงพอ — ต้องการซื้อ ${cost:.2f} ({shares:g} หุ้น @ ${fill_price_usd:.2f}) แต่มีเงินสดคงเหลือ ${_sim_state['account']['balance']:.2f}"
                )

            # Deduct exact stock purchase cost directly from Cash Balance
            _sim_state["account"]["balance"] = round(_sim_state["account"]["balance"] - cost, 2)
            ticket = _sim_state["ticket_counter"]
            _sim_state["ticket_counter"] += 1

            pos = {
                "ticket": ticket,
                "symbol": sym_clean,
                "type": "BUY",
                "volume": shares,
                "price_open": fill_price_usd,
                "price_current": fill_price_usd,
                "cost_basis": cost,
                "market_value": cost,
                "sl": round(req.sl / fx_rate, 2) if (is_thai and req.sl and req.sl > 10.0) else (req.sl or 0.0),
                "tp": round(req.tp / fx_rate, 2) if (is_thai and req.tp and req.tp > 10.0) else (req.tp or 0.0),
                "profit": 0.0,
                "profit_pct": 0.0,
                "commission": 0.0,
                "swap": 0.0,
                "time": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
                "comment": safe_comment,
            }
            _sim_state["positions"].insert(0, pos)
            await _sim_update_positions()
            await _sync_all_open_positions_to_portfolio()

            return {
                "status": "done",
                "order": ticket,
                "deal": ticket,
                "price": fill_price_usd,
                "volume": shares,
                "action": "BUY",
                "symbol": sym_clean,
                "cost": cost,
                "cash_remaining": _sim_state["account"]["balance"],
                "mode": "simulation",
                "note": f"ซื้อสำเร็จ: ตัดเงินสด ${cost:.2f} ({shares:g} หุ้น @ ${fill_price_usd:.2f}) เงินสดคงเหลือ ${_sim_state['account']['balance']:.2f}",
            }

        elif action_upper == "SELL":
            # Spot cash: SELL closes / liquidates holding and returns full cash proceeds to Balance
            match = [p for p in _sim_state["positions"] if p["symbol"] == sym_clean]
            if not match:
                raise RuntimeError(
                    f"บัญชีเงินสด (Spot Cash) ไม่มีหุ้น {sym_clean} ในพอร์ต จึงไม่สามารถขายได้ — กรุณาส่งคำสั่ง BUY เพื่อถือหุ้นก่อน"
                )
            p = match[0]
            pos_vol = float(p.get("volume", 1.0))
            sell_vol = min(shares, pos_vol)
            sale_proceeds = round(fill_price_usd * sell_vol, 2)
            cost_basis_portion = round(p.get("cost_basis", p["price_open"] * pos_vol) * (sell_vol / pos_vol), 2)
            realized_pl = round(sale_proceeds - cost_basis_portion, 2)

            # Credit full sale proceeds back to cash balance
            _sim_state["account"]["balance"] = round(_sim_state["account"]["balance"] + sale_proceeds, 2)

            ticket = _sim_state["ticket_counter"]
            _sim_state["ticket_counter"] += 1

            _sim_state["trade_history"].insert(0, {
                "ticket": ticket,
                "symbol": sym_clean,
                "type": "SELL",
                "volume": sell_vol,
                "price_open": p["price_open"],
                "price_close": fill_price_usd,
                "cost_basis": cost_basis_portion,
                "proceeds": sale_proceeds,
                "profit": realized_pl,
                "profit_pct": round(((fill_price_usd - p["price_open"]) / p["price_open"]) * 100, 2) if p["price_open"] > 0 else 0.0,
                "close_reason": "MANUAL_SELL",
                "closed_at": datetime.now(timezone.utc).isoformat(),
            })

            if sell_vol >= pos_vol:
                _sim_state["positions"].remove(p)
            else:
                p["volume"] = round(pos_vol - sell_vol, 4)
                p["cost_basis"] = round(p["cost_basis"] - cost_basis_portion, 2)

            await _sim_update_positions()
            await _sync_all_open_positions_to_portfolio()

            return {
                "status": "done",
                "order": ticket,
                "deal": ticket,
                "price": fill_price_usd,
                "volume": sell_vol,
                "action": "SELL",
                "symbol": sym_clean,
                "proceeds": sale_proceeds,
                "profit": realized_pl,
                "cash_remaining": _sim_state["account"]["balance"],
                "mode": "simulation",
                "note": f"ขายสำเร็จ: ได้รับเงินสดคืน ${sale_proceeds:.2f} (กำไร/ขาดทุน ${realized_pl:+.2f}) เงินสดรวม ${_sim_state['account']['balance']:.2f}",
            }

    sym_clean = req.symbol.upper().replace(".BK", "").replace(".US", "").strip()
    if sym_clean not in ALLOWED_SYMBOLS_SET and req.symbol.upper() not in ALLOWED_SYMBOLS_SET:
        raise RuntimeError(f"สินทรัพย์ '{req.symbol}' ไม่อยู่ใน 25 ตัวของ Quantix")

    if _state["mode"] == "bridge":
        payload = req.model_dump() if hasattr(req, "model_dump") else req.dict()
        payload["comment"] = safe_comment
        return await _bridge_request("POST", "/api/mt5/order", payload)

    if _state["mode"] == "native" and MT5_AVAILABLE:
        loop = asyncio.get_running_loop()
        try:
            return await asyncio.wait_for(
                loop.run_in_executor(_executor, _native_send_order, req),
                timeout=_MT5_EXEC_TIMEOUT
            )
        except asyncio.TimeoutError:
            raise RuntimeError(f"MT5 order execution timed out after {_MT5_EXEC_TIMEOUT}s — MT5 terminal may be unresponsive")

    raise RuntimeError("ไม่สามารถส่งคำสั่งได้ — MT5 ยังไม่ได้เชื่อมต่อ")


async def place_mt5_order(
    symbol: Any,
    action: Optional[str] = None,
    volume: Optional[float] = None,
    sl: float = 0.0,
    tp: float = 0.0,
    comment: str = "QuantixMLBot",
    deviation: int = 20,
) -> dict[str, Any]:
    """รองรับการเรียกใช้ทั้งแบบส่ง OrderRequest/dict ก้อนเดียว และแบบแยกส่งพารามิเตอร์"""
    if isinstance(symbol, OrderRequest):
        req = symbol
    elif isinstance(symbol, dict):
        req = OrderRequest(**symbol)
    else:
        if action is None or volume is None:
            raise ValueError("ต้องระบุทั้ง action และ volume เมื่อส่ง symbol เป็นข้อความ")
        req = OrderRequest(
            symbol=str(symbol),
            action=action,
            volume=volume,
            sl=sl,
            tp=tp,
            deviation=deviation,
            comment=_sanitize_comment(comment, fallback="QuantixMLBot"),
        )
    return await _execute_order_core(req)


async def close_mt5_position_direct(ticket: int, reason: str = "BOT_EXIT") -> dict[str, Any]:
    """Programmatic helper to close a position — used by Auto-Trade Bot and Rebalancer."""
    if _state["mode"] == "simulation":
        match = [p for p in _sim_state["positions"] if p["ticket"] == ticket]
        if not match:
            raise RuntimeError(f"Position Ticket #{ticket} not found in simulation")
        p = match[0]
        live = await _get_live_price(p["symbol"])
        close_price = live["bid"] if p["type"] == "BUY" else live["ask"]
        is_thai = p["symbol"] in _THAI_SYMBOLS
        try:
            from live import get_live_snapshot
            snap = get_live_snapshot()
            fx_rate = float(snap.get("fx_rate") or snap.get("fx_thb_per_usd") or 35.0)
        except Exception:
            fx_rate = 35.0

        close_price_usd = round(close_price / fx_rate, 2) if is_thai else round(close_price, 2)
        volume = float(p.get("volume", 1.0))
        sale_proceeds = round(close_price_usd * volume, 2)
        cost_basis = p.get("cost_basis", round(p["price_open"] * volume, 2))
        realized_pl = round(sale_proceeds - cost_basis, 2)

        _sim_state["positions"].remove(p)
        # Credit full sale proceeds back to cash balance
        _sim_state["account"]["balance"] = round(
            _sim_state["account"]["balance"] + sale_proceeds, 2
        )
        _sim_state["trade_history"].insert(0, {
            "ticket": p["ticket"],
            "symbol": p["symbol"],
            "type": p["type"],
            "volume": volume,
            "price_open": p["price_open"],
            "price_close": close_price_usd,
            "cost_basis": cost_basis,
            "proceeds": sale_proceeds,
            "profit": realized_pl,
            "profit_pct": round(((close_price_usd - p["price_open"]) / p["price_open"]) * 100, 2) if p["price_open"] > 0 else 0.0,
            "close_reason": reason,
            "closed_at": datetime.now(timezone.utc).isoformat(),
        })
        _sim_state["trade_history"] = _sim_state["trade_history"][:100]
        await _sim_update_positions()
        _save_sim_state()
        await _sync_all_open_positions_to_portfolio()
        return {
            "ticket": ticket,
            "status": "closed",
            "price_close": close_price_usd,
            "proceeds": sale_proceeds,
            "profit": realized_pl,
            "close_reason": reason,
            "mode": "simulation",
        }

    if _state["mode"] == "bridge":
        return await _bridge_request("POST", "/api/mt5/close", {"ticket": ticket})

    if _state["mode"] == "native" and MT5_AVAILABLE:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(_executor, _native_close, ticket)

    raise RuntimeError("Trading Desk ยังไม่ได้เชื่อมต่อ")


# ══════════════════════════════════════════════════════════════════════════════
#  FASTAPI ROUTE REGISTRATION
# ══════════════════════════════════════════════════════════════════════════════

def register(app: FastAPI) -> None:

    # ── Status ────────────────────────────────────────────────────────────────
    @app.get("/api/mt5/status")
    async def get_mt5_status():
        if _state["mode"] == "simulation":
            await _sim_update_positions()
            return {
                "available": True,
                "connected": True,
                "mode": "simulation",
                "login": _sim_state["account"]["login"],
                "server": _sim_state["account"]["server"],
                "account": _sim_state["account"],
            }

        bridge_url = await _probe_bridge()
        if bridge_url:
            try:
                data = await _bridge_request("GET", "/api/mt5/status")
                if data and data.get("account"):
                    _state["connected"] = True
                    _state["mode"] = "bridge"
                    return {**data, "bridge_url": bridge_url, "mode": "bridge"}
            except Exception:
                pass

        if MT5_AVAILABLE:
            loop = asyncio.get_running_loop()
            try:
                acc = await asyncio.wait_for(
                    loop.run_in_executor(_executor, _native_get_account),
                    timeout=_MT5_EXEC_TIMEOUT
                )
            except asyncio.TimeoutError:
                acc = None
            if acc and acc.get("login"):
                _state["connected"] = True
                _state["mode"] = "native"
                return {
                    "available": True,
                    "connected": True,
                    "mode": "native",
                    "login": acc.get("login"),
                    "server": acc.get("server"),
                    "account": acc,
                }

        return {
            "available": MT5_AVAILABLE,
            "connected": False,
            "mode": "disconnected",
            "account": None,
        }

    # ── Connect ───────────────────────────────────────────────────────────────
    @app.post("/api/mt5/connect")
    async def connect_mt5(req: ConnectRequest):
        # If user explicitly wants simulation OR default mode is simulation
        if req.force_simulation or _state["mode"] == "simulation":
            _state["connected"] = True
            _state["mode"] = "simulation"
            _state["login"] = _sim_state["account"]["login"]
            _state["server"] = _sim_state["account"]["server"]
            _save_sim_state()
            return {
                "status": "connected",
                "mode": "simulation",
                "account": _sim_state["account"],
                "note": "เชื่อมต่อ Demo Trading สำเร็จ — ส่งคำสั่งเทรดได้ทันที",
            }

        return {
            "status": "connected",
            "mode": "simulation",
            "account": _sim_state["account"],
            "note": "เชื่อมต่อ Demo Trading สำเร็จ",
        }

        bridge_url = await _probe_bridge()
        if bridge_url:
            try:
                payload = req.model_dump() if hasattr(req, "model_dump") else req.dict()
                res = await _bridge_request("POST", "/api/mt5/connect", payload)
                _state["connected"] = True
                _state["mode"] = "bridge"
                return res
            except Exception as e:
                log.warning(f"Bridge connection error: {e}")

        if not MT5_AVAILABLE:
            raise HTTPException(
                status_code=400,
                detail="ไม่พบไลบรารี MetaTrader5 ใน Python ตัวที่รัน Backend",
            )

        loop = asyncio.get_running_loop()
        try:
            acc = await loop.run_in_executor(
                _executor,
                _native_init_and_login,
                req.login,
                req.password,
                req.server,
                req.path,
            )
            return {
                "status": "connected",
                "mode": "native",
                "account": acc,
                "note": f"เชื่อมต่อ MT5 จริงสำเร็จ (บัญชี #{acc['login']} @ {acc['server']})",
            }
        except Exception as e:
            log.error(f"Native MT5 connect failed: {e}")
            raise HTTPException(status_code=400, detail=str(e))

    # ── Reset Demo Balance ────────────────────────────────────────────────────
    @app.post("/api/mt5/reset-demo")
    async def reset_demo_account():
        """Reset the demo trading account to initial $10,000 balance."""
        global _sim_state
        _sim_state = {
            "account": {
                "login": 889900,
                "name": "Quantix Demo Account",
                "server": "Quantix Demo Trading",
                "currency": "USD",
                "balance": 10000.0,
                "equity": 10000.0,
                "profit": 0.0,
                "holdings_value": 0.0,
                "margin": 0.0,
                "margin_free": 10000.0,
                "margin_level": 100.0,
                "leverage": 1,
            },
            "positions": [],
            "ticket_counter": 5001,
            "trade_history": [],
        }
        _save_sim_state()
        return {"status": "ok", "account": _sim_state["account"]}

    # ── Disconnect ────────────────────────────────────────────────────────────
    @app.post("/api/mt5/disconnect")
    async def disconnect_mt5():
        bridge_url = await _probe_bridge()
        if bridge_url and _state["mode"] == "bridge":
            try:
                await _bridge_request("POST", "/api/mt5/disconnect")
            except Exception:
                pass
        if MT5_AVAILABLE and _state["mode"] == "native":
            def _shutdown():
                with _mt5_lock:
                    mt5.shutdown()
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(_executor, _shutdown)

        _state["connected"] = False
        _state["mode"] = "disconnected"
        _state["login"] = None
        _state["server"] = None
        return {"status": "disconnected"}

    # ── Account ───────────────────────────────────────────────────────────────
    @app.get("/api/mt5/account")
    async def get_mt5_account():
        if _state["mode"] == "simulation":
            await _sim_update_positions()
            acc = dict(_sim_state["account"])
            # Recalculate holdings_value from live positions (always consistent with /positions)
            positions = _sim_state.get("positions", [])
            live_hv = round(sum(p.get("market_value", p.get("price_current", 0) * float(p.get("volume", 1))) for p in positions), 2)
            live_pl = round(sum(p.get("profit", 0) for p in positions), 2)
            acc["holdings_value"] = live_hv
            acc["profit"] = live_pl
            acc["equity"] = round(acc["balance"] + live_hv, 2)
            acc["position_count"] = len(positions)
            # Attach FX rate for frontend THB conversion
            try:
                from live import get_live_snapshot
                snap = get_live_snapshot()
                acc["fx_thb_per_usd"] = float(snap.get("fx_thb_per_usd") or 35.0)
            except Exception:
                acc["fx_thb_per_usd"] = 35.0
            return acc
        if _state["mode"] == "bridge":
            return await _bridge_request("GET", "/api/mt5/account")
        if _state["mode"] == "native" and MT5_AVAILABLE:
            loop = asyncio.get_running_loop()
            acc = await loop.run_in_executor(_executor, _native_get_account)
            if not acc:
                raise HTTPException(status_code=400, detail="ยังไม่ได้เชื่อมต่อบัญชี MT5 จริง")
            return acc
        raise HTTPException(status_code=400, detail="ยังไม่ได้เชื่อมต่อบัญชี MT5")

    # ── Positions ─────────────────────────────────────────────────────────────
    @app.get("/api/mt5/positions")
    async def get_mt5_positions():
        if _state["mode"] == "simulation":
            await _sim_update_positions()
            return {"positions": _sim_state["positions"], "total": len(_sim_state["positions"])}
        if _state["mode"] == "bridge":
            return await _bridge_request("GET", "/api/mt5/positions")
        if _state["mode"] == "native" and MT5_AVAILABLE:
            loop = asyncio.get_running_loop()
            pos = await loop.run_in_executor(_executor, _native_get_positions)
            return {"positions": pos, "total": len(pos)}
        return {"positions": [], "total": 0}

    # ── Trade History ─────────────────────────────────────────────────────────
    @app.get("/api/mt5/history")
    async def get_mt5_history():
        """Returns closed trade history for simulation, native, and bridge modes."""
        if _state["mode"] == "simulation":
            return {
                "trades": _sim_state.get("trade_history", []),
                "total": len(_sim_state.get("trade_history", [])),
            }

        if _state["mode"] == "bridge":
            try:
                return await _bridge_request("GET", "/api/mt5/history")
            except Exception:
                return {"trades": [], "total": 0}

        if _state["mode"] == "native" and MT5_AVAILABLE:
            def _fetch_native_history():
                with _mt5_lock:
                    from_dt = datetime.now(timezone.utc) - timedelta(days=30)
                    to_dt = datetime.now(timezone.utc) + timedelta(days=1)
                    deals = mt5.history_deals_get(from_dt, to_dt)
                    if not deals:
                        return []
                    out = []
                    # Filter only exit deals (entry == 1 means exit / close of a position)
                    for d in reversed(deals):
                        if d.entry == 1:
                            t_dt = datetime.fromtimestamp(d.time, tz=timezone.utc)
                            out.append({
                                "ticket": int(d.position_id or d.order or d.ticket),
                                "deal_ticket": int(d.ticket),
                                "symbol": str(d.symbol),
                                "type": "SELL" if d.type == 1 else "BUY",
                                "volume": round(float(d.volume), 2),
                                "price_close": float(d.price),
                                "profit": round(float(d.profit), 2),
                                "commission": round(float(d.commission), 2),
                                "swap": round(float(d.swap), 2),
                                "close_reason": str(d.comment or "CLOSED"),
                                "closed_at": t_dt.strftime("%Y-%m-%d %H:%M:%S UTC"),
                            })
                    return out

            loop = asyncio.get_running_loop()
            try:
                native_trades = await loop.run_in_executor(_executor, _fetch_native_history)
                return {"trades": native_trades, "total": len(native_trades)}
            except Exception as e:
                log.warning(f"Error fetching native MT5 history: {e}")
                return {"trades": [], "total": 0}

        return {"trades": [], "total": 0}

    # ── Symbols ───────────────────────────────────────────────────────────────
    @app.get("/api/mt5/symbols")
    async def get_mt5_symbols():
        return {"symbols": QUANTIX_25_ASSETS}

    # ── Candlesticks / OHLC Data for Lightweight Charts ───────────────────────
    @app.get("/api/mt5/candles")
    async def get_mt5_candles(symbol: str = "AAPL", period: str = "1mo", interval: str = "1d"):
        clean = symbol.strip().upper().replace(".BK", "").replace(".US", "")
        loop = asyncio.get_running_loop()
        candles = await loop.run_in_executor(_executor, _fetch_ohlc_candles, clean, period, interval)
        return {"symbol": clean, "candles": candles, "total": len(candles)}

    # ── Tick (Live Price) ─────────────────────────────────────────────────────
    @app.get("/api/mt5/tick")
    async def get_mt5_tick(symbol: str):
        if _state["mode"] == "simulation":
            return await _get_live_price(symbol)

        if _state["mode"] == "bridge":
            return await _bridge_request("GET", f"/api/mt5/tick?symbol={symbol}")

        if _state["mode"] == "native" and MT5_AVAILABLE:
            def _fetch():
                with _mt5_lock:
                    broker_sym = _resolve_broker_symbol(symbol)
                    sym_info = mt5.symbol_info(broker_sym)
                    if not sym_info:
                        raise RuntimeError(f"ไม่พบสินทรัพย์ '{symbol}' (หรือ '{broker_sym}') บนโบรกเกอร์นี้")
                    if not sym_info.visible:
                        mt5.symbol_select(broker_sym, True)
                    t = mt5.symbol_info_tick(broker_sym)
                    bid = t.bid if t and t.bid > 0 else 0.0
                    ask = t.ask if t and t.ask > 0 else 0.0
                    last = t.last if t and t.last > 0 else 0.0

                    if bid <= 0 or ask <= 0:
                        # Fallback to last M1 candle close
                        rates = mt5.copy_rates_from_pos(broker_sym, mt5.TIMEFRAME_M1, 0, 1)
                        if rates is not None and len(rates) > 0 and rates[0][4] > 0:
                            c = float(rates[0][4])
                            bid = c
                            ask = round(c * 1.0005, 2)
                            last = c

                    if bid <= 0 or ask <= 0:
                        raise RuntimeError(f"ไม่มีราคา Real-time สำหรับ {symbol} ({broker_sym}) — ตลาดอาจปิดทำการ")

                    return {
                        "symbol": symbol.strip().upper(),
                        "broker_symbol": broker_sym,
                        "bid": bid,
                        "ask": ask,
                        "last": last,
                        "spread": round(ask - bid, 5),
                        "volume": t.volume if t else 0,
                        "time": t.time if t else 0,
                    }
            loop = asyncio.get_running_loop()
            try:
                return await loop.run_in_executor(_executor, _fetch)
            except Exception as e:
                raise HTTPException(status_code=400, detail=str(e))

        raise HTTPException(status_code=400, detail="MT5 ยังไม่ได้เชื่อมต่อ")

    # ── Place Order ───────────────────────────────────────────────────────────
    @app.post("/api/mt5/order")
    async def api_place_mt5_order(req: OrderRequest):
        try:
            return await _execute_order_core(req)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    # ── Close Single Position ─────────────────────────────────────────────────
    @app.post("/api/mt5/close")
    async def close_mt5_position(req: CloseRequest):
        if _state["mode"] == "simulation":
            res = await close_mt5_position_direct(req.ticket, reason="MANUAL")
            await _sync_all_open_positions_to_portfolio()
            return res

        if _state["mode"] == "bridge":
            payload = req.model_dump() if hasattr(req, "model_dump") else req.dict()
            return await _bridge_request("POST", "/api/mt5/close", payload)
        if _state["mode"] == "native" and MT5_AVAILABLE:
            loop = asyncio.get_running_loop()
            try:
                return await loop.run_in_executor(_executor, _native_close, req.ticket)
            except Exception as e:
                raise HTTPException(status_code=400, detail=str(e))
        raise HTTPException(status_code=400, detail="MT5 ยังไม่ได้เชื่อมต่อ")

    # ── Close All ─────────────────────────────────────────────────────────────
    @app.post("/api/mt5/close-all")
    async def close_all_mt5_positions():
        if _state["mode"] == "simulation":
            results = []
            for p in list(_sim_state["positions"]):
                try:
                    res = await close_mt5_position_direct(p["ticket"], reason="PANIC_CLOSE_ALL")
                    results.append(res)
                except Exception as ex:
                    results.append({"ticket": p["ticket"], "status": "error", "error": str(ex)})
            await _sync_all_open_positions_to_portfolio()
            return {"results": results, "total_closed": len(results)}

        if _state["mode"] == "bridge":
            return await _bridge_request("POST", "/api/mt5/close-all")
        if _state["mode"] == "native" and MT5_AVAILABLE:
            loop = asyncio.get_running_loop()
            positions = await loop.run_in_executor(_executor, _native_get_positions)
            res = []
            for p in positions:
                try:
                    c = await loop.run_in_executor(_executor, _native_close, p["ticket"])
                    res.append({"ticket": p["ticket"], "status": "closed", **c})
                except Exception as ex:
                    res.append({"ticket": p["ticket"], "status": "error", "error": str(ex)})
            await _sync_all_open_positions_to_portfolio()
            return {"results": res, "total_closed": len(res)}
        raise HTTPException(status_code=400, detail="MT5 ยังไม่ได้เชื่อมต่อ")

    # ── Auto-Rebalance via MT5 ────────────────────────────────────────────────
    @app.post("/api/mt5/auto-rebalance")
    async def auto_rebalance_mt5(req: RebalanceTradeRequest):
        if not _state["connected"]:
            raise HTTPException(status_code=400, detail="กรุณาเชื่อมต่อ MT5 ก่อนปรับพอร์ต")

        if _state["mode"] == "bridge":
            acc = await _bridge_request("GET", "/api/mt5/account")
        elif _state["mode"] == "simulation":
            await _sim_update_positions()
            acc = _sim_state["account"]
        else:
            loop = asyncio.get_running_loop()
            acc = await loop.run_in_executor(_executor, _native_get_account)

        if not acc or not acc.get("equity"):
            raise HTTPException(status_code=400, detail="ไม่พบข้อมูลยอดเงิน Equity")

        real_equity = float(req.total_risk_equity or acc["equity"])
        orders_placed = []

        try:
            from live import get_live_snapshot
            snap = get_live_snapshot()
            fx_rate = float(snap.get("fx_rate") or snap.get("fx_thb_per_usd") or 35.0)
        except Exception:
            fx_rate = 35.0

        for raw_sym, weight in req.allocations.items():
            sym = raw_sym.replace(".BK", "").strip().upper()
            if sym not in ALLOWED_SYMBOLS_SET or weight <= 0.01:
                continue
            target_val = real_equity * float(weight)
            # Spot cash: shares = target_val / price
            try:
                live_p = await _get_live_price(sym)
                fill_p = live_p.get("ask") or 100.0
                if sym in _THAI_SYMBOLS:
                    target_val_curr = target_val * fx_rate
                    shares = max(1.0, round(target_val_curr / fill_p, 0)) if fill_p > 0 else 1.0
                else:
                    shares = max(1.0, round(target_val / fill_p, 0)) if fill_p > 0 else 1.0
            except Exception:
                shares = 1.0

            order_req = OrderRequest(
                symbol=sym,
                action="BUY",
                volume=shares,
                comment=_sanitize_comment(req.comment, fallback="QuantixRebalance"),
            )
            try:
                res = await _execute_order_core(order_req)
                orders_placed.append(res)
            except Exception as ex:
                orders_placed.append({"symbol": sym, "success": False, "error": str(ex)})

        return {
            "status": "rebalance_complete",
            "mode": _state["mode"],
            "real_equity_used": real_equity,
            "orders": orders_placed,
        }

    # ── Manual Trigger for Cross-Module Sync ─────────────────────────────────
    @app.post("/api/mt5/sync-portfolio")
    async def api_sync_daytrade_to_portfolio():
        """Sync current DayTrade open positions to My Portfolio immediately."""
        await _sync_all_open_positions_to_portfolio()
        return {"status": "ok", "message": "ซิงค์หุ้นจาก Quant Day Trade ไปยัง My Portfolio เรียบร้อยแล้ว"}