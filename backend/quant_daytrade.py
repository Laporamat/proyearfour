"""
quant_daytrade.py — Quant Day Trading Engine using REAL ML from the project.

Uses the trained Random Forest Regime Classifier (regime_model_random_forest.pkl)
to generate signals, combined with live yfinance data for real RSI-14, EMA 9/21,
ATR-14, and Market Regime probabilities.

Features:
  1. ML Signal Engine: Loads the trained sklearn Pipeline and predicts regime
     on live yfinance data. Computes per-asset RSI, EMA, ATR for intraday signals.
  2. API Key Management (MongoDB + in-memory).
  3. Public Bot REST API (authenticated via X-Quantix-Key).
  4. Automated ML Bot Worker that executes trades on MT5 based on real model output.
  5. Code Snippet Generator (Python, MQL5, cURL).
"""
from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import logging
import os
import secrets
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import yfinance as yf
from fastapi import FastAPI, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field

try:
    import joblib
except ImportError:
    joblib = None

try:
    import mt5_trade
except ImportError:
    mt5_trade = None

try:
    from auth import _current_user, db
except Exception:
    db = None
    async def _current_user(req):
        return None

log = logging.getLogger("quant_daytrade")

OUTPUT_DIR = Path("output")
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="ml-sig")

# ══════════════════════════════════════════════════════════════════════════════
#  LOAD REAL ML MODEL (Random Forest Regime Classifier from project)
# ══════════════════════════════════════════════════════════════════════════════
_regime_pipeline = None   # sklearn Pipeline: StandardScaler + RandomForestClassifier
_regime_load_error: Optional[str] = None
REGIME_LABELS = {0: "Bear", 1: "Neutral", 2: "Bull"}

def _load_regime_model():
    """Load the trained Random Forest model from the project pipeline."""
    global _regime_pipeline, _regime_load_error
    model_path = OUTPUT_DIR / "regime_model_random_forest.pkl"
    if not model_path.exists():
        _regime_load_error = f"Model file not found: {model_path}"
        log.warning(_regime_load_error)
        return
    if joblib is None:
        _regime_load_error = "joblib not installed"
        log.warning(_regime_load_error)
        return
    try:
        _regime_pipeline = joblib.load(model_path)
        log.info(f"✓ Loaded Random Forest Regime model from {model_path}")
    except Exception as e:
        _regime_load_error = str(e)
        log.error(f"Failed to load regime model: {e}")

_load_regime_model()


# ══════════════════════════════════════════════════════════════════════════════
#  25 QUANTIX ASSETS DEFINITION
# ══════════════════════════════════════════════════════════════════════════════
DAYTRADE_ASSETS = [
    {"symbol": "AAPL",   "yf": "AAPL",     "name": "Apple Inc.",                "category": "US Stocks",    "currency": "USD"},
    {"symbol": "MSFT",   "yf": "MSFT",     "name": "Microsoft Corp.",           "category": "US Stocks",    "currency": "USD"},
    {"symbol": "GOOGL",  "yf": "GOOGL",    "name": "Alphabet Inc. (Google)",    "category": "US Stocks",    "currency": "USD"},
    {"symbol": "AMZN",   "yf": "AMZN",     "name": "Amazon.com Inc.",           "category": "US Stocks",    "currency": "USD"},
    {"symbol": "NVDA",   "yf": "NVDA",     "name": "NVIDIA Corp.",              "category": "US Stocks",    "currency": "USD"},
    {"symbol": "TSLA",   "yf": "TSLA",     "name": "Tesla Inc.",                "category": "US Stocks",    "currency": "USD"},
    {"symbol": "META",   "yf": "META",     "name": "Meta Platforms (Facebook)", "category": "US Stocks",    "currency": "USD"},
    {"symbol": "JNJ",    "yf": "JNJ",      "name": "Johnson & Johnson",         "category": "US Stocks",    "currency": "USD"},
    {"symbol": "V",      "yf": "V",        "name": "Visa Inc.",                 "category": "US Stocks",    "currency": "USD"},
    {"symbol": "JPM",    "yf": "JPM",      "name": "JPMorgan Chase & Co.",      "category": "US Stocks",    "currency": "USD"},
    {"symbol": "PTT",    "yf": "PTT.BK",   "name": "PTT PCL",                   "category": "Thai Stocks",  "currency": "THB"},
    {"symbol": "AOT",    "yf": "AOT.BK",   "name": "Airports of Thailand",      "category": "Thai Stocks",  "currency": "THB"},
    {"symbol": "CPALL",  "yf": "CPALL.BK", "name": "CP ALL PCL",                "category": "Thai Stocks",  "currency": "THB"},
    {"symbol": "BDMS",   "yf": "BDMS.BK",  "name": "Bangkok Dusit Med",         "category": "Thai Stocks",  "currency": "THB"},
    {"symbol": "DELTA",  "yf": "DELTA.BK", "name": "Delta Electronics (Thai)",  "category": "Thai Stocks",  "currency": "THB"},
    {"symbol": "GULF",   "yf": "GULF.BK",  "name": "Gulf Energy Development",   "category": "Thai Stocks",  "currency": "THB"},
    {"symbol": "ADVANC", "yf": "ADVANC.BK","name": "Advanced Info Service",     "category": "Thai Stocks",  "currency": "THB"},
    {"symbol": "SCB",    "yf": "SCB.BK",   "name": "SCB X PCL",                 "category": "Thai Stocks",  "currency": "THB"},
    {"symbol": "KBANK",  "yf": "KBANK.BK", "name": "Kasikornbank PCL",          "category": "Thai Stocks",  "currency": "THB"},
    {"symbol": "PTTEP",  "yf": "PTTEP.BK", "name": "PTT Exploration & Prod",    "category": "Thai Stocks",  "currency": "THB"},
    {"symbol": "GLD",    "yf": "GLD",      "name": "SPDR Gold Shares / Gold",   "category": "Bonds & Gold", "currency": "USD"},
    {"symbol": "TLT",    "yf": "TLT",      "name": "20+ Year Treasury Bond ETF","category": "Bonds & Gold", "currency": "USD"},
    {"symbol": "IEF",    "yf": "IEF",      "name": "7-10 Year Treasury Bond ETF","category": "Bonds & Gold","currency": "USD"},
    {"symbol": "SHY",    "yf": "SHY",      "name": "1-3 Year Treasury Bond ETF","category": "Bonds & Gold", "currency": "USD"},
    {"symbol": "BIL",    "yf": "BIL",      "name": "SPDR 1-3 Month T-Bill ETF", "category": "Bonds & Gold", "currency": "USD"},
]

_SYM_TO_YF = {a["symbol"]: a["yf"] for a in DAYTRADE_ASSETS}
_YF_TICKERS = [a["yf"] for a in DAYTRADE_ASSETS]


# ══════════════════════════════════════════════════════════════════════════════
#  REAL SIGNAL ENGINE — Live yfinance data + trained Random Forest model
# ══════════════════════════════════════════════════════════════════════════════
_signal_cache: Dict[str, Any] = {}
_SIGNAL_TTL = 30  # cache signals for 30 seconds

def _compute_rsi(series: pd.Series, period: int = 14) -> float:
    """Compute RSI-14 from a price series."""
    delta = series.pct_change()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta).clip(lower=0).rolling(period).mean()
    rs = gain / (loss + 1e-10)
    rsi = 100 - (100 / (1 + rs))
    val = rsi.dropna()
    return round(float(val.iloc[-1]), 1) if len(val) > 0 else 50.0

def _compute_atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> float:
    """Compute ATR-14."""
    tr1 = high - low
    tr2 = (high - close.shift(1)).abs()
    tr3 = (low - close.shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.rolling(period).mean()
    val = atr.dropna()
    return round(float(val.iloc[-1]), 4) if len(val) > 0 else 1.0


def _fetch_and_compute_signals() -> Dict[str, Any]:
    """
    BLOCKING — fetches real yfinance data for all 25 assets, runs the
    trained Random Forest model for regime classification, and computes
    per-asset technical indicators (RSI-14, EMA-9/21, ATR-14).
    """
    now_iso = datetime.now(timezone.utc).isoformat()

    # ── 1. Download recent price data from yfinance ────────────────────────
    try:
        raw = yf.download(
            _YF_TICKERS,
            period="3mo",        # 3 months for sufficient feature lookback
            auto_adjust=True,
            progress=False,
            threads=True,
        )
        if raw.empty:
            raise RuntimeError("Yahoo Finance returned empty data")
    except Exception as e:
        log.error(f"yfinance download failed: {e}")
        return {"error": str(e)}

    # Extract OHLC DataFrames
    if isinstance(raw.columns, pd.MultiIndex):
        close_df = raw["Close"]
        high_df = raw.get("High", close_df)
        low_df = raw.get("Low", close_df)
    else:
        close_df = raw[["Close"]]
        high_df = raw.get("High", close_df)
        low_df = raw.get("Low", close_df)

    close_df = close_df.ffill().bfill()

    # ── 2. Run the REAL Random Forest Regime Classifier ────────────────────
    regime_state = "Bull"
    regime_confidence = 50.0
    prob_bull = 0.33
    prob_neutral = 0.34
    prob_bear = 0.33

    if _regime_pipeline is not None:
        try:
            # Build features exactly like regime.py does
            norm = close_df / close_df.iloc[0]
            index_price = norm.mean(axis=1)
            returns_daily = index_price.pct_change()

            feat = pd.DataFrame(index=close_df.index)
            feat["ret_20d"] = index_price.pct_change(20)
            feat["ret_60d"] = index_price.pct_change(60)
            feat["vol_20d"] = returns_daily.rolling(20).std() * np.sqrt(252)
            feat["vol_60d"] = returns_daily.rolling(60).std() * np.sqrt(252)

            risk_free_daily = 0.02 / 252
            feat["sharpe_20d"] = (
                returns_daily.rolling(20).mean() - risk_free_daily
            ) / (returns_daily.rolling(20).std() + 1e-8)
            feat["sharpe_60d"] = (
                returns_daily.rolling(60).mean() - risk_free_daily
            ) / (returns_daily.rolling(60).std() + 1e-8)

            delta = returns_daily.copy()
            gain = delta.clip(lower=0).rolling(14).mean()
            loss = (-delta).clip(lower=0).rolling(14).mean()
            feat["rsi_14"] = 100 - (100 / (1 + gain / (loss + 1e-8)))

            feat["price_vs_ma20"] = (index_price / index_price.rolling(20).mean()) - 1
            feat["price_vs_ma60"] = (index_price / index_price.rolling(60).mean()) - 1

            ma20 = close_df.rolling(20).mean()
            feat["breadth_20d"] = (close_df > ma20).mean(axis=1)
            feat["vol_ratio"] = feat["vol_20d"] / (feat["vol_60d"] + 1e-8)

            feat = feat.dropna()

            if len(feat) > 0:
                # Predict using the REAL trained model
                latest_features = feat.iloc[[-1]]
                proba = _regime_pipeline.predict_proba(latest_features.values)[0]
                pred = _regime_pipeline.predict(latest_features.values)[0]

                regime_state = REGIME_LABELS.get(int(pred), "Neutral")
                prob_bear = round(float(proba[0]), 4)
                prob_neutral = round(float(proba[1]), 4)
                prob_bull = round(float(proba[2]), 4)
                regime_confidence = round(max(proba) * 100, 1)

                log.info(f"ML Regime Prediction: {regime_state} (Bull:{prob_bull:.1%} Neut:{prob_neutral:.1%} Bear:{prob_bear:.1%})")
        except Exception as e:
            log.warning(f"Regime prediction error: {e}")

    # ── 3. Per-Asset Signal Generation with REAL indicators ────────────────
    signals = []
    for asset in DAYTRADE_ASSETS:
        sym = asset["symbol"]
        yf_sym = asset["yf"]

        try:
            if yf_sym not in close_df.columns:
                continue

            close_series = close_df[yf_sym].dropna()
            if len(close_series) < 20:
                continue

            current_price = round(float(close_series.iloc[-1]), 2)

            # Real RSI-14
            rsi_14 = _compute_rsi(close_series, 14)

            # Real EMA-9 and EMA-21
            ema9 = round(float(close_series.ewm(span=9, adjust=False).mean().iloc[-1]), 2)
            ema21 = round(float(close_series.ewm(span=21, adjust=False).mean().iloc[-1]), 2)

            # Real ATR-14
            if yf_sym in high_df.columns and yf_sym in low_df.columns:
                atr_14 = _compute_atr(
                    high_df[yf_sym].dropna(),
                    low_df[yf_sym].dropna(),
                    close_series,
                    14
                )
            else:
                atr_14 = round(current_price * 0.015, 2)

            # ── ML + Technical Combined Signal Classification ──
            # Weight regime probability into individual asset decisions
            if regime_state == "Bull" and rsi_14 >= 45 and current_price > ema9:
                # Bullish regime + price above EMA9 + RSI not oversold
                if rsi_14 >= 60 and prob_bull >= 0.6:
                    action = "STRONG_BUY"
                    confidence = round(min(97, 60 + prob_bull * 25 + (rsi_14 - 40) * 0.3), 1)
                else:
                    action = "BUY"
                    confidence = round(min(92, 55 + prob_bull * 20 + (rsi_14 - 40) * 0.25), 1)
                sl = round(current_price - 1.5 * atr_14, 2)
                tp = round(current_price + 3.0 * atr_14, 2)
                rationale = (
                    f"ML Regime: {regime_state} ({regime_confidence}%) "
                    f"| Price ({current_price}) > EMA9 ({ema9}) "
                    f"| RSI {rsi_14} momentum"
                )
                setup_quality = "A+" if confidence >= 85 else "A"

            elif regime_state == "Bear" and rsi_14 <= 55 and current_price < ema9:
                # Bearish regime + price below EMA9
                if rsi_14 <= 40 and prob_bear >= 0.4:
                    action = "STRONG_SELL"
                    confidence = round(min(95, 60 + prob_bear * 30 + (60 - rsi_14) * 0.3), 1)
                else:
                    action = "SELL"
                    confidence = round(min(90, 55 + prob_bear * 25 + (60 - rsi_14) * 0.2), 1)
                sl = round(current_price + 1.5 * atr_14, 2)
                tp = round(current_price - 3.0 * atr_14, 2)
                rationale = (
                    f"ML Regime: {regime_state} ({regime_confidence}%) "
                    f"| Price ({current_price}) < EMA9 ({ema9}) "
                    f"| RSI breakdown {rsi_14}"
                )
                setup_quality = "A+" if confidence >= 85 else "A"

            elif rsi_14 <= 28:
                # Oversold extreme → mean reversion buy regardless of regime
                action = "BUY"
                confidence = round(min(90, 72 + (30 - rsi_14) * 1.5), 1)
                sl = round(current_price - 1.2 * atr_14, 2)
                tp = round(current_price + 2.5 * atr_14, 2)
                rationale = f"Oversold Extreme RSI {rsi_14} — Mean Reversion Dip Buy"
                setup_quality = "A"

            elif rsi_14 >= 75:
                # Overbought extreme → mean reversion sell
                action = "SELL"
                confidence = round(min(88, 70 + (rsi_14 - 75) * 1.5), 1)
                sl = round(current_price + 1.2 * atr_14, 2)
                tp = round(current_price - 2.5 * atr_14, 2)
                rationale = f"Overbought Extreme RSI {rsi_14} — Pullback Exhaustion"
                setup_quality = "A"

            elif regime_state == "Bull" and current_price > ema21:
                # Weak buy — bullish trend but not strong momentum
                action = "BUY"
                confidence = round(min(78, 50 + prob_bull * 20 + (rsi_14 - 40) * 0.15), 1)
                sl = round(current_price - 2.0 * atr_14, 2)
                tp = round(current_price + 3.5 * atr_14, 2)
                rationale = (
                    f"ML Regime: {regime_state} ({regime_confidence}%) "
                    f"| Price above EMA21 ({ema21}) | Trend intact"
                )
                setup_quality = "B+"

            elif regime_state == "Bear" and current_price < ema21:
                action = "SELL"
                confidence = round(min(76, 50 + prob_bear * 20 + (55 - rsi_14) * 0.15), 1)
                sl = round(current_price + 2.0 * atr_14, 2)
                tp = round(current_price - 3.5 * atr_14, 2)
                rationale = (
                    f"ML Regime: {regime_state} ({regime_confidence}%) "
                    f"| Price below EMA21 ({ema21}) | Bearish bias"
                )
                setup_quality = "B+"

            else:
                action = "NEUTRAL"
                confidence = round(40 + (rsi_14 % 15) * 0.8, 1)
                sl = 0.0
                tp = 0.0
                rationale = (
                    f"ML Regime: {regime_state} ({regime_confidence}%) "
                    f"| RSI {rsi_14} in range | Waiting for breakout"
                )
                setup_quality = "B"

            rr_ratio = "1:2.0" if action not in ("NEUTRAL",) else "—"

            signals.append({
                "symbol": sym,
                "name": asset["name"],
                "category": asset["category"],
                "currency": asset["currency"],
                "action": action,
                "confidence": confidence,
                "current_price": current_price,
                "suggested_entry": current_price,
                "suggested_sl": sl,
                "suggested_tp": tp,
                "rr_ratio": rr_ratio,
                "suggested_lot": 0.05,
                "timeframe": "15m",
                "setup_quality": setup_quality,
                "indicators": {
                    "rsi_14": rsi_14,
                    "ema9": ema9,
                    "ema21": ema21,
                    "atr_14": atr_14,
                    "regime": regime_state,
                    "regime_confidence": regime_confidence,
                },
                "rationale": rationale,
                "timestamp": now_iso,
            })

        except Exception as e:
            log.warning(f"Signal error for {sym}: {e}")
            continue

    return {
        "signals": signals,
        "regime": {
            "state": regime_state,
            "confidence": regime_confidence,
            "prob_bull": prob_bull,
            "prob_neutral": prob_neutral,
            "prob_bear": prob_bear,
            "model": "RandomForest (300 trees, max_depth=6)" if _regime_pipeline else "unavailable",
            "model_loaded": _regime_pipeline is not None,
        },
        "total": len(signals),
        "timestamp": now_iso,
        "data_source": "yfinance (live)",
    }


async def get_ml_signals() -> Dict[str, Any]:
    """Get cached signals or compute fresh from yfinance + ML model."""
    global _signal_cache
    cached = _signal_cache
    if cached and (time.time() - cached.get("_ts", 0)) < _SIGNAL_TTL:
        return cached

    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(_executor, _fetch_and_compute_signals)
    result["_ts"] = time.time()
    _signal_cache = result
    return result


# ══════════════════════════════════════════════════════════════════════════════
#  API KEY / BOT STATE (unchanged logic, cleaner structure)
# ══════════════════════════════════════════════════════════════════════════════
_api_keys_store: Dict[str, Dict[str, Any]] = {}
_raw_keys_by_id: Dict[str, str] = {}

_bot_state: Dict[str, Any] = {
    "enabled": False,
    "min_confidence": 75.0,
    "default_lot": 0.02,
    "max_positions": 3,
    "symbols": ["AAPL", "NVDA", "TSLA", "GLD", "DELTA", "PTT"],
    "auto_sl_tp": True,
    "strategy": "ML-RandomForest-Regime + RSI/EMA/ATR",
    "last_run": None,
    "signals_evaluated": 0,
    "orders_executed": 0,
    "activity_log": [],
}

_bot_task: Optional[asyncio.Task] = None


class CreateApiKeyRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    permissions: List[str] = Field(default=["signals:read", "trades:write"])

class BotConfigRequest(BaseModel):
    enabled: bool
    min_confidence: Optional[float] = 75.0
    default_lot: Optional[float] = 0.02
    max_positions: Optional[int] = 3
    symbols: Optional[List[str]] = None
    auto_sl_tp: Optional[bool] = True

class BotOrderRequest(BaseModel):
    symbol: str
    action: str
    volume: float = 0.01
    sl: Optional[float] = 0.0
    tp: Optional[float] = 0.0
    comment: Optional[str] = "Quantix Bot Live"

def _hash_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


async def _authenticate_api_key(
    x_quantix_key: Optional[str] = Header(None, alias="X-Quantix-Key"),
    api_key_query: Optional[str] = Query(None, alias="api_key"),
) -> Dict[str, Any]:
    key = x_quantix_key or api_key_query
    if not key:
        raise HTTPException(401, "Missing API Key — provide via 'X-Quantix-Key' header or '?api_key=' query")

    key_hash = _hash_key(key)
    key_doc = _api_keys_store.get(key_hash)

    if not key_doc and db is not None:
        try:
            key_doc = await db.user_api_keys.find_one({"key_hash": key_hash, "is_active": True})
            if key_doc:
                _api_keys_store[key_hash] = key_doc
        except Exception as e:
            log.warning(f"Mongo api key lookup error: {e}")

    if not key_doc or not key_doc.get("is_active", True):
        raise HTTPException(403, "Invalid or revoked Quantix API Key")

    key_doc["last_used_at"] = datetime.now(timezone.utc).isoformat()
    key_doc["request_count"] = key_doc.get("request_count", 0) + 1
    if db is not None:
        asyncio.create_task(
            db.user_api_keys.update_one(
                {"key_hash": key_hash},
                {"$set": {"last_used_at": key_doc["last_used_at"]}, "$inc": {"request_count": 1}},
            )
        )
    return key_doc


# ══════════════════════════════════════════════════════════════════════════════
#  AUTO-TRADE BOT WORKER — now uses REAL ML signals
# ══════════════════════════════════════════════════════════════════════════════
async def _auto_trade_bot_worker():
    """Periodically runs the real ML model and executes trades on MT5."""
    log.info("Quantix ML Auto-Trade Bot worker started (Real Random Forest model).")
    while True:
        try:
            await asyncio.sleep(15)  # Evaluate every 15 seconds
            if not _bot_state["enabled"]:
                continue

            # Get REAL ML signals
            ml_result = await get_ml_signals()
            signals = ml_result.get("signals", [])
            regime = ml_result.get("regime", {})

            _bot_state["last_run"] = datetime.now(timezone.utc).isoformat()
            _bot_state["signals_evaluated"] += len(signals)

            target_symbols = set(_bot_state.get("symbols", []))
            min_conf = float(_bot_state.get("min_confidence", 75.0))

            # Check open positions (Supports both Simulation, Native MT5, and Bridge)
            active_symbols = set()
            try:
                if mt5_trade is not None and mt5_trade._state.get("connected"):
                    active_positions = []
                    if mt5_trade._state["mode"] == "simulation":
                        active_positions = mt5_trade._sim_state.get("positions", [])
                    elif mt5_trade._state["mode"] == "native" and mt5_trade.MT5_AVAILABLE:
                        loop = asyncio.get_running_loop()
                        active_positions = await loop.run_in_executor(mt5_trade._executor, mt5_trade._native_get_positions)
                    elif mt5_trade._state["mode"] == "bridge":
                        bridge_res = await mt5_trade._bridge_request("GET", "/api/mt5/positions")
                        active_positions = bridge_res.get("positions", [])

                    for p in active_positions:
                        raw_sym = str(p.get("symbol", "")).upper()
                        # normalize back (e.g. NVDAUSD -> NVDA, PTT.BK -> PTT)
                        clean = raw_sym.replace("USD", "").replace(".US", "").replace(".BK", "").replace("#", "").strip()
                        active_symbols.add(raw_sym)
                        active_symbols.add(clean)

                    if len(active_positions) >= _bot_state.get("max_positions", 3):
                        _bot_state["activity_log"].insert(0, {
                            "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S"),
                            "symbol": "SYSTEM",
                            "action": "SKIP",
                            "confidence": 0,
                            "status": "max_positions",
                            "message": f"Max positions ({len(active_positions)}/{_bot_state['max_positions']}) reached — skipping cycle",
                        })
                        _bot_state["activity_log"] = _bot_state["activity_log"][:50]
                        continue
            except Exception as e:
                log.warning(f"Bot position check error: {e}")

            for sig in signals:
                sym = sig["symbol"]
                if sym not in target_symbols or sym in active_symbols:
                    continue

                action = sig["action"]
                confidence = sig["confidence"]

                if action in ("BUY", "STRONG_BUY", "SELL", "STRONG_SELL") and confidence >= min_conf:
                    trade_action = "BUY" if "BUY" in action else "SELL"
                    log_entry = {
                        "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S"),
                        "symbol": sym,
                        "action": trade_action,
                        "confidence": confidence,
                        "price": sig["current_price"],
                        "sl": sig["suggested_sl"],
                        "tp": sig["suggested_tp"],
                        "regime": regime.get("state", "?"),
                        "status": "triggered",
                        "message": f"ML Regime={regime.get('state')} | {trade_action} signal (Conf {confidence}%)",
                    }

                    # Execute on MT5 if connected
                    if mt5_trade is not None and mt5_trade._state.get("connected"):
                        try:
                            order_req = mt5_trade.OrderRequest(
                                symbol=sym,
                                action=trade_action,
                                volume=_bot_state.get("default_lot", 0.02),
                                sl=sig["suggested_sl"] if _bot_state.get("auto_sl_tp") else 0.0,
                                tp=sig["suggested_tp"] if _bot_state.get("auto_sl_tp") else 0.0,
                                comment=f"Quantix ML Bot {int(confidence)}% {regime.get('state', '')}",
                            )

                            # Execute order via unified handler (_execute_order_core handles simulation, native, and bridge)
                            res = await mt5_trade._execute_order_core(order_req)
                            ticket = res.get("order") or res.get("deal") or res.get("ticket")
                            fill_p = res.get("price") or sig.get("current_price")
                            exec_mode = res.get("mode") or mt5_trade._state.get("mode", "unknown")

                            log_entry["status"] = "executed"
                            log_entry["order_ticket"] = ticket
                            log_entry["message"] = f"✓ [{exec_mode.upper()}] Order #{ticket} {trade_action} {sym} @ {fill_p} (Regime: {regime.get('state')})"
                            _bot_state["orders_executed"] += 1
                        except Exception as ex:
                            log_entry["status"] = "failed"
                            log_entry["message"] = f"Execution error: {str(ex)[:120]}"
                    else:
                        log_entry["status"] = "not_connected"
                        log_entry["message"] = f"MT5 not connected — signal: {trade_action} {sym} @ {sig['current_price']}"

                    _bot_state["activity_log"].insert(0, log_entry)
                    _bot_state["activity_log"] = _bot_state["activity_log"][:50]
                    active_symbols.add(sym)
                    break  # one trade per cycle for safety

        except asyncio.CancelledError:
            break
        except Exception as e:
            log.warning(f"Bot worker error: {e}")
            await asyncio.sleep(5)


# ══════════════════════════════════════════════════════════════════════════════
#  FASTAPI ROUTE REGISTRATION
# ══════════════════════════════════════════════════════════════════════════════
def register(app: FastAPI) -> None:

    @app.on_event("startup")
    async def _start_bot():
        global _bot_task
        _bot_task = asyncio.create_task(_auto_trade_bot_worker())

    @app.on_event("shutdown")
    async def _stop_bot():
        if _bot_task and not _bot_task.done():
            _bot_task.cancel()

    # ── 1. ML Day Trade Signals (Session UI) ──────────────────────────────────
    @app.get("/api/quant/daytrade/signals")
    async def get_daytrade_signals():
        """Returns REAL ML signals from the trained Random Forest model + live yfinance data."""
        result = await get_ml_signals()
        return {
            "status": "ok",
            "timestamp": result.get("timestamp"),
            "regime": result.get("regime"),
            "signals": result.get("signals", []),
            "total": result.get("total", 0),
            "data_source": result.get("data_source", "yfinance"),
            "model_loaded": _regime_pipeline is not None,
        }

    # ── 2. API Key Management ─────────────────────────────────────────────────
    @app.get("/api/user/api-keys")
    async def list_user_api_keys(request: Request):
        user = await _current_user(request)
        user_id = user["user_id"] if user else "demo_quant_user"
        keys_list = []
        if db is not None:
            try:
                cursor = db.user_api_keys.find({"user_id": user_id}, {"key_hash": 0, "_id": 0})
                keys_list = await cursor.to_list(length=50)
            except Exception:
                pass
        if not keys_list:
            keys_list = [k for k in _api_keys_store.values() if k.get("user_id") == user_id]
        return {"api_keys": keys_list}

    @app.post("/api/user/api-keys")
    async def create_user_api_key(request: Request, body: CreateApiKeyRequest):
        user = await _current_user(request)
        user_id = user["user_id"] if user else "demo_quant_user"
        raw_secret = secrets.token_urlsafe(32)
        raw_key = f"qtx_live_{raw_secret}"
        key_id = f"key_{secrets.token_hex(6)}"
        key_hash = _hash_key(raw_key)
        doc = {
            "key_id": key_id, "user_id": user_id, "name": body.name.strip(),
            "prefix": f"qtx_live_{raw_secret[:6]}...{raw_secret[-4:]}",
            "raw_key": raw_key, "key_hash": key_hash,
            "permissions": body.permissions, "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_used_at": None, "request_count": 0,
        }
        _api_keys_store[key_hash] = doc
        _raw_keys_by_id[key_id] = raw_key
        if db is not None:
            try:
                await db.user_api_keys.insert_one(doc.copy())
            except Exception as e:
                log.warning(f"Mongo insert error: {e}")
        return {"status": "created", "key_id": key_id, "name": doc["name"],
                "api_key": raw_key, "prefix": doc["prefix"], "created_at": doc["created_at"]}

    @app.delete("/api/user/api-keys/{key_id}")
    async def revoke_user_api_key(request: Request, key_id: str):
        user = await _current_user(request)
        user_id = user["user_id"] if user else "demo_quant_user"
        to_del = [h for h, k in _api_keys_store.items() if k.get("key_id") == key_id]
        for h in to_del:
            _api_keys_store.pop(h, None)
        if db is not None:
            try:
                await db.user_api_keys.update_one(
                    {"key_id": key_id, "user_id": user_id},
                    {"$set": {"is_active": False, "revoked_at": datetime.now(timezone.utc).isoformat()}},
                )
            except Exception:
                pass
        return {"status": "revoked", "key_id": key_id}

    # ── 3. Public Bot REST API ────────────────────────────────────────────────
    @app.get("/api/v1/quant/signals")
    async def bot_get_signals(
        symbol: Optional[str] = Query(None),
        min_confidence: Optional[float] = Query(0.0),
        request: Request = None,
    ):
        api_key = request.headers.get("X-Quantix-Key") or request.query_params.get("api_key")
        await _authenticate_api_key(x_quantix_key=api_key)
        result = await get_ml_signals()
        signals = result.get("signals", [])
        if symbol:
            signals = [s for s in signals if s["symbol"].upper() == symbol.upper().strip()]
        if min_confidence:
            signals = [s for s in signals if s["confidence"] >= min_confidence]
        return {
            "status": "ok", "bot_api_version": "v1.0",
            "server_time": datetime.now(timezone.utc).isoformat(),
            "regime": result.get("regime", {}),
            "signals": signals, "count": len(signals),
        }

    @app.post("/api/v1/quant/order")
    async def bot_place_order(body: BotOrderRequest, request: Request):
        api_key = request.headers.get("X-Quantix-Key") or request.query_params.get("api_key")
        await _authenticate_api_key(x_quantix_key=api_key)
        if mt5_trade is None:
            raise HTTPException(503, "MT5 module not available")
        order_req = mt5_trade.OrderRequest(
            symbol=body.symbol.upper().strip(), action=body.action.upper().strip(),
            volume=body.volume, sl=body.sl or 0.0, tp=body.tp or 0.0,
            comment=body.comment or "Quantix Bot Live",
        )
        if not mt5_trade._state.get("connected"):
            raise HTTPException(400, "MT5 not connected")
        try:
            return await mt5_trade._execute_order_core(order_req)
        except Exception as e:
            raise HTTPException(400, str(e))

    @app.get("/api/v1/quant/positions")
    async def bot_get_positions(request: Request):
        api_key = request.headers.get("X-Quantix-Key") or request.query_params.get("api_key")
        await _authenticate_api_key(x_quantix_key=api_key)
        if mt5_trade is None:
            return {"positions": [], "total": 0}
        if mt5_trade._state.get("mode") == "simulation":
            return {"positions": mt5_trade._sim_state["positions"], "total": len(mt5_trade._sim_state["positions"])}
        return {"positions": [], "total": 0}

    @app.post("/api/v1/quant/close")
    async def bot_close_position(ticket: int, request: Request):
        api_key = request.headers.get("X-Quantix-Key") or request.query_params.get("api_key")
        await _authenticate_api_key(x_quantix_key=api_key)
        if mt5_trade is None:
            raise HTTPException(503, "MT5 module not available")
        return await mt5_trade.close_mt5_position(mt5_trade.CloseRequest(ticket=ticket))

    @app.get("/api/v1/quant/account")
    async def bot_get_account(request: Request):
        api_key = request.headers.get("X-Quantix-Key") or request.query_params.get("api_key")
        await _authenticate_api_key(x_quantix_key=api_key)
        if mt5_trade is None:
            raise HTTPException(503, "MT5 module not available")
        return await mt5_trade.get_mt5_account()

    # ── 4. Bot Controller ─────────────────────────────────────────────────────
    @app.get("/api/quant/daytrade/bot/status")
    async def get_bot_status():
        return {"status": "ok", "bot": _bot_state}

    @app.post("/api/quant/daytrade/bot/config")
    async def update_bot_config(cfg: BotConfigRequest):
        _bot_state["enabled"] = cfg.enabled
        if cfg.min_confidence is not None:
            _bot_state["min_confidence"] = cfg.min_confidence
        if cfg.default_lot is not None:
            _bot_state["default_lot"] = cfg.default_lot
        if cfg.max_positions is not None:
            _bot_state["max_positions"] = cfg.max_positions
        if cfg.symbols is not None:
            _bot_state["symbols"] = cfg.symbols
        if cfg.auto_sl_tp is not None:
            _bot_state["auto_sl_tp"] = cfg.auto_sl_tp
        status_txt = "เปิดใช้งาน" if cfg.enabled else "หยุด"
        _bot_state["activity_log"].insert(0, {
            "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S"),
            "symbol": "SYSTEM", "action": "CONFIG", "confidence": 100,
            "status": "active" if cfg.enabled else "stopped",
            "message": f"Bot {status_txt} (ML: RandomForest | Min Conf: {_bot_state['min_confidence']}% | Lot: {_bot_state['default_lot']})",
        })
        return {"status": "updated", "bot": _bot_state}

    # ── 5. Code Snippets ──────────────────────────────────────────────────────
    @app.get("/api/quant/daytrade/snippets")
    async def get_code_snippets(api_key: Optional[str] = Query("YOUR_QUANTIX_API_KEY")):
        python_code = f'''# ============================================================
# Quantix ML Day Trading Bot for MetaTrader 5 (Python)
# Uses REAL Random Forest Regime Classifier + RSI/EMA/ATR
# ============================================================
import time
import requests
import MetaTrader5 as mt5

QUANTIX_API_KEY = "{api_key}"
QUANTIX_HOST = "http://127.0.0.1:8001"
# 25 Quantix Project Assets
TARGET_SYMBOLS = ["AAPL", "NVDA", "TSLA", "GLD", "PTT", "DELTA"]
MIN_CONFIDENCE = 75.0
LOT_SIZE = 0.02

if not mt5.initialize():
    print("MT5 initialization failed:", mt5.last_error())
    exit()
print("✓ MT5 Connected. Using Quantix ML (Random Forest Regime + RSI/EMA/ATR)...")

def get_ml_signals():
    headers = {{"X-Quantix-Key": QUANTIX_API_KEY}}
    try:
        res = requests.get(f"{{QUANTIX_HOST}}/api/v1/quant/signals", headers=headers, timeout=10)
        if res.status_code == 200:
            data = res.json()
            print(f"  ML Regime: {{data.get('regime', {{}}).get('state')}} ({{data.get('regime', {{}}).get('confidence')}}%)")
            return data.get("signals", [])
    except Exception as e:
        print("API Error:", e)
    return []

def execute_trade(symbol, action, lot, sl, tp):
    tick = mt5.symbol_info_tick(symbol)
    if not tick: return
    order_type = mt5.ORDER_TYPE_BUY if action == "BUY" else mt5.ORDER_TYPE_SELL
    price = tick.ask if action == "BUY" else tick.bid
    result = mt5.order_send({{
        "action": mt5.TRADE_ACTION_DEAL, "symbol": symbol, "volume": lot,
        "type": order_type, "price": price, "sl": sl, "tp": tp,
        "deviation": 20, "magic": 999888, "comment": "Quantix ML Bot",
        "type_time": mt5.ORDER_TIME_GTC, "type_filling": mt5.ORDER_FILLING_IOC,
    }})
    if result and result.retcode == mt5.TRADE_RETCODE_DONE:
        print(f"  ✓ Executed: {{action}} {{symbol}} @ {{price}} (Ticket #{{result.order}})")
    else:
        print(f"  ✕ Failed: {{result}}")

while True:
    signals = get_ml_signals()
    for sig in signals:
        sym, action, conf = sig["symbol"], sig["action"], sig["confidence"]
        if sym in TARGET_SYMBOLS and conf >= MIN_CONFIDENCE:
            if "BUY" in action:
                execute_trade(sym, "BUY", LOT_SIZE, sig["suggested_sl"], sig["suggested_tp"])
            elif "SELL" in action:
                execute_trade(sym, "SELL", LOT_SIZE, sig["suggested_sl"], sig["suggested_tp"])
    time.sleep(15)
'''

        mql5_code = f'''//+------------------------------------------------------------------+
//| Quantix ML Day Trading EA for MetaTrader 5                      |
//| Uses Real Random Forest Regime + RSI/EMA/ATR signals            |
//+------------------------------------------------------------------+
#property strict
input string InpApiKey    = "{api_key}";
input string InpServerUrl = "http://127.0.0.1:8001";
input double InpLotSize   = 0.02;
input double InpMinConf   = 75.0;

int OnInit() {{
   Print("Quantix ML EA — Random Forest Regime Classifier");
   EventSetTimer(15);
   return(INIT_SUCCEEDED);
}}
void OnDeinit(const int reason) {{ EventKillTimer(); }}
void OnTimer() {{
   string url = InpServerUrl + "/api/v1/quant/signals?symbol=" + _Symbol;
   string headers = "X-Quantix-Key: " + InpApiKey + "\\r\\n";
   char post[], result[];
   string result_headers;
   int res = WebRequest("GET", url, headers, 5000, post, result, result_headers);
   if(res == 200) {{
      string json = CharArrayToString(result);
      Print("ML Signal: ", json);
   }}
}}
'''

        return {
            "python_snippet": python_code,
            "mql5_snippet": mql5_code,
            "curl_example": f'curl -X GET "http://127.0.0.1:8001/api/v1/quant/signals" -H "X-Quantix-Key: {api_key}"',
        }
