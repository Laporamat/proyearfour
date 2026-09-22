"""
portfolio_analytics.py — Advanced portfolio analytics endpoints.

Exposes:
  POST /api/portfolio/rebalance  → rebalancing suggestions based on MPT + regime
  GET  /api/portfolio/backtest   → backtest buy&hold vs MPT vs regime strategies
  GET  /api/portfolio/dividends   → dividend history for user's holdings
"""
from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf
from fastapi import FastAPI, Request
from pydantic import BaseModel

from auth import _current_user, db
from yh import USD_TICKERS, FX_TICKER, FX_FALLBACK

log = logging.getLogger("portfolio_analytics")
OUTPUT_DIR = Path("output")
TRADING_DAYS = 252


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
async def _require_user(request: Request) -> dict:
    user = await _current_user(request)
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def _parse_optimal_weights() -> dict[str, float]:
    csv = OUTPUT_DIR / "optimal_portfolio.csv"
    if not csv.exists():
        return {}
    raw = pd.read_csv(csv).iloc[0].get("weights", "") or ""
    return {
        t: float(v)
        for t, v in re.findall(r"'([^']+)':\s*(?:np\.float64\()?(-?[\d.eE+]+)", raw)
    }


def _get_current_regime() -> dict:
    csv = OUTPUT_DIR / "regime_predictions.csv"
    if not csv.exists():
        return {"regime": "Neutral", "bull": 33, "neutral": 34, "bear": 33}
    df = pd.read_csv(csv, index_col=0, parse_dates=True).sort_index()
    latest = df.iloc[-1]
    return {
        "regime": latest["regime_label"],
        "bull": round(float(latest["prob_bull"]) * 100, 1),
        "neutral": round(float(latest["prob_neutral"]) * 100, 1),
        "bear": round(float(latest["prob_bear"]) * 100, 1),
    }


# ─────────────────────────────────────────────
# Rebalancing
# ─────────────────────────────────────────────
class RebalanceIn(BaseModel):
    holdings: list[dict]  # [{ticker, shares, buyPrice, ...}]


def _rebalance_logic(holdings: list[dict], live_prices: dict[str, float]) -> dict:
    # Compute current allocation by value
    user_values: dict[str, float] = {}
    total_value = 0.0
    for h in holdings:
        ticker = h["ticker"]
        price = live_prices.get(ticker, h.get("buyPrice", 0))
        val = price * h["shares"]
        user_values[ticker] = user_values.get(ticker, 0) + val
        total_value += val

    if total_value <= 0:
        return {"suggestions": [], "totalValue": 0, "regime": _get_current_regime()}

    current_weights = {t: v / total_value for t, v in user_values.items()}

    # Get MPT optimal weights
    optimal = _parse_optimal_weights()
    regime = _get_current_regime()

    # Adjust target weights based on regime
    # In Bear: shift toward bonds/safe assets (reduce equity exposure)
    # In Bull: follow MPT more closely
    # In Neutral: slight tilt toward MPT
    if not optimal:
        # No MPT data — use equal weight as target
        target_weights = {t: 1.0 / len(user_values) for t in user_values}
    else:
        # Regime adjustment: scale equity weights
        regime_mult = {"Bull": 1.0, "Neutral": 0.9, "Bear": 0.7}.get(regime["regime"], 1.0)

        # Identify safe assets (bonds) in optimal
        safe_assets = {"TLT", "IEF", "SHY", "GLD", "BIL"}
        target = {}
        for t, w in optimal.items():
            if t in safe_assets:
                # Increase safe allocation in bear markets
                safe_boost = {"Bull": 1.0, "Neutral": 1.2, "Bear": 1.6}.get(regime["regime"], 1.0)
                target[t] = w * safe_boost
            else:
                target[t] = w * regime_mult

        # Normalize
        total = sum(target.values())
        if total > 0:
            target = {t: w / total for t, w in target.items()}

        # Only keep tickers the user actually holds + those in optimal
        all_tickers = set(user_values.keys()) | set(target.keys())
        target_weights = {t: target.get(t, 0) for t in all_tickers}

    # Generate suggestions
    suggestions = []
    for ticker in sorted(all_tickers if 'all_tickers' in dir() else user_values.keys()):
        cw = current_weights.get(ticker, 0)
        tw = target_weights.get(ticker, 0)
        diff = tw - cw  # positive = need to buy, negative = need to sell
        diff_pct = abs(diff) * 100

        if diff_pct < 1.0:  # threshold: ignore <1% drift
            continue

        current_val = user_values.get(ticker, 0)
        target_val = tw * total_value
        trade_value = target_val - current_val
        price = live_prices.get(ticker, 0)
        shares_needed = int(abs(trade_value) / price) if price > 0 else 0

        action = "BUY" if trade_value > 0 else "SELL"
        suggestions.append({
            "ticker": ticker,
            "action": action,
            "currentWeight": round(cw * 100, 2),
            "targetWeight": round(tw * 100, 2),
            "drift": round(diff_pct, 2),
            "tradeValue": round(abs(trade_value), 2),
            "sharesNeeded": shares_needed,
            "currentValue": round(current_val, 2),
            "targetValue": round(target_val, 2),
        })

    suggestions.sort(key=lambda x: -x["drift"])

    return {
        "suggestions": suggestions,
        "totalValue": round(total_value, 2),
        "regime": regime,
        "currentWeights": {t: round(w * 100, 2) for t, w in current_weights.items()},
        "targetWeights": {t: round(w * 100, 2) for t, w in target_weights.items()},
    }


# ─────────────────────────────────────────────
# Backtesting
# ─────────────────────────────────────────────
def _run_backtest_logic(holdings: list[dict]) -> dict:
    """Backtest buy&hold vs MPT vs regime-based on historical data."""
    prices_csv = OUTPUT_DIR / "prices_clean_thb.csv"
    returns_csv = OUTPUT_DIR / "daily_returns.csv"
    regime_csv = OUTPUT_DIR / "regime_predictions.csv"

    if not prices_csv.exists() or not returns_csv.exists():
        return {"error": "ยังไม่มีข้อมูลพอ — กรุณารัน pipeline ก่อน"}

    prices = pd.read_csv(prices_csv, index_col=0, parse_dates=True).sort_index()
    returns = pd.read_csv(returns_csv, index_col=0, parse_dates=True).sort_index()
    if returns.abs().mean().mean() > 1:
        returns = returns / 100

    optimal_w = _parse_optimal_weights()
    regime_df = pd.read_csv(regime_csv, index_col=0, parse_dates=True).sort_index() if regime_csv.exists() else None

    # Use last 2 years for backtest
    cutoff = prices.index[-1] - timedelta(days=730)
    prices_bt = prices[prices.index >= cutoff]
    returns_bt = returns[returns.index >= cutoff]

    if prices_bt.empty or returns_bt.empty:
        return {"error": "ไม่มีข้อมูลย้อนหลังเพียงพอ"}

    # Strategy 1: Buy & Hold (equal weight of user's holdings)
    user_tickers = [h["ticker"] for h in holdings]
    bt_tickers = [t for t in user_tickers if t in returns_bt.columns]

    if not bt_tickers:
        bt_tickers = list(returns_bt.columns[:5])

    eq_weight = pd.Series(1.0 / len(bt_tickers), index=bt_tickers)
    bh_daily = (returns_bt[bt_tickers] * eq_weight).sum(axis=1)
    bh_cum = ((1 + bh_daily).cumprod() - 1) * 100

    # Strategy 2: MPT optimal weights
    if optimal_w:
        mpt_tickers = [t for t in optimal_w if t in returns_bt.columns]
        mpt_w = pd.Series({t: optimal_w[t] for t in mpt_tickers})
        if mpt_w.sum() > 0:
            mpt_w = mpt_w / mpt_w.sum()
        mpt_daily = (returns_bt[mpt_tickers] * mpt_w).sum(axis=1)
    else:
        mpt_daily = bh_daily.copy()
    mpt_cum = ((1 + mpt_daily).cumprod() - 1) * 100

    # Strategy 3: Regime-based (adjust allocation based on regime)
    if regime_df is not None:
        regime_bt = regime_df[regime_df.index >= cutoff]
        # In Bull: 80% MPT / 20% safe; Bear: 30% MPT / 70% safe; Neutral: 60/40
        safe_assets = ["TLT", "IEF", "SHY", "GLD", "BIL"]
        safe_tickers = [t for t in safe_assets if t in returns_bt.columns]
        if safe_tickers and mpt_tickers:
            safe_w = pd.Series(1.0 / len(safe_tickers), index=safe_tickers)
            regime_daily = pd.Series(0.0, index=returns_bt.index)
            for date, row in regime_bt.iterrows():
                if date not in returns_bt.index:
                    continue
                label = row.get("regime_label", "Neutral")
                if label == "Bull":
                    mpt_alloc, safe_alloc = 0.85, 0.15
                elif label == "Bear":
                    mpt_alloc, safe_alloc = 0.30, 0.70
                else:
                    mpt_alloc, safe_alloc = 0.60, 0.40
                mpt_ret = (returns_bt.loc[date, mpt_tickers] * mpt_w).sum()
                safe_ret = (returns_bt.loc[date, safe_tickers] * safe_w).sum()
                regime_daily.loc[date] = mpt_alloc * mpt_ret + safe_alloc * safe_ret
            regime_daily = regime_daily.dropna()
        else:
            regime_daily = mpt_daily.copy()
    else:
        regime_daily = mpt_daily.copy()
    regime_cum = ((1 + regime_daily).cumprod() - 1) * 100

    # Monthly samples for charting
    def _monthly(series):
        m = series.resample("ME").last()
        return [{"date": idx.strftime("%b %y"), "value": round(float(v), 2)}
                for idx, v in m.items() if pd.notna(v)]

    # Stats
    def _stats(daily):
        ret = float(((1 + daily).prod() - 1) * 100)
        vol = float(daily.std() * np.sqrt(TRADING_DAYS) * 100)
        sharpe = (daily.mean() * TRADING_DAYS - 0.02) / vol if vol > 0 else 0
        max_dd = float((((1 + daily).cumprod() / (1 + daily).cumprod().cummax()) - 1).min() * 100)
        return {
            "totalReturn": round(ret, 2),
            "annualizedVol": round(vol, 2),
            "sharpe": round(sharpe, 3),
            "maxDrawdown": round(max_dd, 2),
        }

    return {
        "buyHold": {
            "stats": _stats(bh_daily),
            "curve": _monthly(bh_cum),
            "tickers": bt_tickers,
        },
        "mpt": {
            "stats": _stats(mpt_daily),
            "curve": _monthly(mpt_cum),
            "tickers": mpt_tickers if optimal_w else bt_tickers,
        },
        "regime": {
            "stats": _stats(regime_daily),
            "curve": _monthly(regime_cum),
        },
        "period": {
            "start": prices_bt.index[0].strftime("%Y-%m-%d"),
            "end": prices_bt.index[-1].strftime("%Y-%m-%d"),
        },
    }


# ─────────────────────────────────────────────
# Dividends
# ─────────────────────────────────────────────
def _fetch_dividends(tickers: list[str]) -> dict:
    """Fetch dividend history for given tickers using yfinance."""
    results = {}
    for ticker in tickers:
        try:
            info = yf.Ticker(ticker)
            divs = info.dividends
            if divs is not None and not divs.empty:
                # Last 3 years
                cutoff = datetime.now() - timedelta(days=1095)
                divs_recent = divs[divs.index >= cutoff]
                if divs_recent.empty:
                    results[ticker] = {"annualDividend": 0, "yield": 0, "history": []}
                    continue

                annual_total = float(divs_recent.groupby(divs_recent.index.year).sum().mean())
                # Get current price for yield calc
                hist = info.history(period="5d")
                current_price = float(hist["Close"].iloc[-1]) if not hist.empty else 0
                div_yield = (annual_total / current_price * 100) if current_price > 0 else 0

                # For USD tickers, convert dividend to THB
                is_usd = ticker in USD_TICKERS
                fx_rate = FX_FALLBACK
                if is_usd:
                    try:
                        fx = yf.Ticker(FX_TICKER)
                        fx_hist = fx.history(period="5d")
                        if not fx_hist.empty:
                            fx_rate = float(fx_hist["Close"].iloc[-1])
                    except Exception:
                        pass

                history = [
                    {
                        "date": idx.strftime("%Y-%m-%d"),
                        "amount": round(float(val) * (fx_rate if is_usd else 1), 4),
                        "amountTHB": round(float(val) * (fx_rate if is_usd else 1), 4),
                    }
                    for idx, val in divs_recent.items()
                ]

                results[ticker] = {
                    "annualDividend": round(annual_total * (fx_rate if is_usd else 1), 2),
                    "yield": round(div_yield, 2),
                    "history": history[-20:],  # last 20 payments
                    "currency": "THB" if is_usd else "THB",
                }
            else:
                results[ticker] = {"annualDividend": 0, "yield": 0, "history": []}
        except Exception as e:
            log.warning("dividend fetch failed for %s: %s", ticker, e)
            results[ticker] = {"annualDividend": 0, "yield": 0, "history": [], "error": str(e)}
    return results


# ─────────────────────────────────────────────
# Registration
# ─────────────────────────────────────────────
def register(app: FastAPI) -> None:

    @app.post("/api/portfolio/rebalance")
    async def rebalance(request: Request, inp: RebalanceIn):
        await _require_user(request)
        loop = asyncio.get_event_loop()

        # Get live prices
        from live import get_live_snapshot
        try:
            snapshot = await get_live_snapshot()
            live_prices = snapshot.get("prices", {})
        except Exception:
            live_prices = {}

        result = await loop.run_in_executor(None, _rebalance_logic, inp.holdings, live_prices)
        return result

    @app.get("/api/portfolio/backtest")
    async def backtest(request: Request):
        user = await _require_user(request)
        loop = asyncio.get_event_loop()

        # Get user's holdings
        doc = await db.user_portfolios.find_one({"user_id": user["user_id"]})
        holdings = doc.get("items", []) if doc else []

        result = await loop.run_in_executor(None, _run_backtest_logic, holdings)
        return result

    @app.get("/api/portfolio/dividends")
    async def dividends(request: Request):
        user = await _require_user(request)
        loop = asyncio.get_event_loop()

        doc = await db.user_portfolios.find_one({"user_id": user["user_id"]})
        holdings = doc.get("items", []) if doc else []
        tickers = list({h["ticker"] for h in holdings})

        if not tickers:
            return {"dividends": {}, "totalAnnual": 0, "totalYield": 0}

        results = await loop.run_in_executor(None, _fetch_dividends, tickers)

        total_annual = sum(d.get("annualDividend", 0) for d in results.values())
        return {
            "dividends": results,
            "totalAnnual": round(total_annual, 2),
        }
