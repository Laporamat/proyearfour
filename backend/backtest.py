"""
Backtesting Engine
===================
ทดสอบกลยุทธ์การลงทุนย้อนหลัง:
  1. Buy & Hold — ถือ equal-weight ตั้งแต่ต้น ไม่ปรับพอร์ต
  2. MPT — หา optimal weights ช่วงแรก แล้ว rebalance ทุกเดือน
  3. Regime-based — ปรับสัดส่วน equity/bond ตามสภาวะตลาด

Metrics: CAGR, Sharpe Ratio, Max Drawdown, Volatility, Total Return
"""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query

log = logging.getLogger("backtest")

OUTPUT_DIR = Path("output")
TRADING_DAYS = 252
RISK_FREE_RATE = 0.02

SAFE_TICKERS = {"TLT", "IEF", "SHY", "GLD", "BIL"}

# Regime-based allocation: (equity_weight, safe_weight)
REGIME_ALLOCATION = {
    "Bull":    (0.80, 0.20),
    "Neutral": (0.60, 0.40),
    "Bear":    (0.30, 0.70),
}


def _load_prices() -> pd.DataFrame:
    csv = OUTPUT_DIR / "prices_clean_thb.csv"
    if not csv.exists():
        raise FileNotFoundError("ไม่พบ prices_clean_thb.csv — กรุณารัน pipeline ก่อน")
    df = pd.read_csv(csv, index_col=0, parse_dates=True).sort_index()
    return df


def _load_regime_predictions() -> pd.DataFrame | None:
    csv = OUTPUT_DIR / "regime_predictions.csv"
    if not csv.exists():
        return None
    df = pd.read_csv(csv, index_col=0, parse_dates=True).sort_index()
    return df


def _load_mpt_weights() -> dict[str, float]:
    """ดึง MPT optimal weights จาก CSV"""
    import re
    csv = OUTPUT_DIR / "optimal_portfolio.csv"
    if not csv.exists():
        return {}
    raw = pd.read_csv(csv).iloc[0].get("weights", "") or ""
    return {
        t: float(v)
        for t, v in re.findall(r"'([^']+)':\s*(?:np\.float64\()?(-?[\d.eE+]+)", raw)
    }


def _compute_metrics(returns: pd.Series) -> dict:
    """คำนวณ performance metrics จาก daily returns series"""
    if returns.empty or returns.std() == 0:
        return {
            "total_return": 0.0,
            "cagr": 0.0,
            "sharpe": 0.0,
            "max_drawdown": 0.0,
            "volatility": 0.0,
        }

    total_return = (1 + returns).prod() - 1
    n_days = len(returns)
    years = n_days / TRADING_DAYS
    cagr = (1 + total_return) ** (1 / years) - 1 if years > 0 else 0

    ann_vol = returns.std() * np.sqrt(TRADING_DAYS)
    ann_ret = returns.mean() * TRADING_DAYS
    sharpe = (ann_ret - RISK_FREE_RATE) / ann_vol if ann_vol > 0 else 0

    # Max drawdown
    cumulative = (1 + returns).cumprod()
    running_max = cumulative.expanding().max()
    drawdown = (cumulative - running_max) / running_max
    max_dd = drawdown.min()

    return {
        "total_return": round(float(total_return) * 100, 2),
        "cagr": round(float(cagr) * 100, 2),
        "sharpe": round(float(sharpe), 4),
        "max_drawdown": round(float(max_dd) * 100, 2),
        "volatility": round(float(ann_vol) * 100, 2),
    }


def _backtest_buy_hold(prices: pd.DataFrame) -> tuple[pd.Series, dict]:
    """Buy & Hold: equal weight ถือตลอด"""
    tickers = [c for c in prices.columns if c in prices.dropna(axis=1, how="all").columns]
    n = len(tickers)
    if n == 0:
        return pd.Series(dtype=float), {}

    weights = pd.Series(1.0 / n, index=tickers)
    returns = prices[tickers].pct_change().fillna(0)
    port_returns = (returns * weights).sum(axis=1)
    equity = (1 + port_returns).cumprod()

    metrics = _compute_metrics(port_returns)
    return port_returns, metrics


def _backtest_mpt(prices: pd.DataFrame, mpt_weights: dict[str, float],
                  rebalance_freq: str = "ME") -> tuple[pd.Series, dict]:
    """MPT: ใช้ optimal weights และ rebalance ตามช่วงเวลาที่กำหนด"""
    if not mpt_weights:
        return pd.Series(dtype=float), {}

    tickers = [t for t in mpt_weights if t in prices.columns]
    if not tickers:
        return pd.Series(dtype=float), {}

    w = pd.Series({t: mpt_weights[t] for t in tickers})
    w = w / w.sum()

    returns = prices[tickers].pct_change().fillna(0)

    # Rebalance: ทุกช่วงเวลา คืนน้ำหนักกลับเป็น w
    # คำนวณ portfolio returns โดย rebalance ทุกเดือน
    port_returns = pd.Series(0.0, index=prices.index)

    # แบ่งช่วง rebalance
    groups = returns.groupby(pd.Grouper(freq=rebalance_freq))

    current_weights = w.copy()
    for period_start, group in groups:
        if group.empty:
            continue
        # คำนวณ returns ในช่วงนี้ด้วย current_weights
        period_port = (group * current_weights).sum(axis=1)
        port_returns.loc[group.index] = period_port

        # อัพเดต weights หลัง rebalance (กลับเป็น target weights)
        current_weights = w.copy()

    metrics = _compute_metrics(port_returns)
    return port_returns, metrics


def _backtest_regime(prices: pd.DataFrame, regime_df: pd.DataFrame | None) -> tuple[pd.Series, dict]:
    """Regime-based: ปรับ allocation ตามสภาวะตลาด"""
    if regime_df is None or regime_df.empty:
        return pd.Series(dtype=float), {}

    tickers = [c for c in prices.columns if c in prices.dropna(axis=1, how="all").columns]
    equity_tickers = [t for t in tickers if t not in SAFE_TICKERS]
    safe_tickers = [t for t in tickers if t in SAFE_TICKERS]

    if not equity_tickers and not safe_tickers:
        return pd.Series(dtype=float), {}

    returns = prices[tickers].pct_change().fillna(0)

    # สร้าง weight series ตาม regime
    # ใช้ regime label ของวันล่าสุดที่มีใน regime_df (forward fill)
    regime_aligned = regime_df["regime_label"].reindex(prices.index, method="ffill").fillna("Neutral")

    port_returns = pd.Series(0.0, index=prices.index)

    for date in prices.index:
        regime = regime_aligned.get(date, "Neutral")
        eq_w, safe_w = REGIME_ALLOCATION.get(regime, REGIME_ALLOCATION["Neutral"])

        n_eq = len(equity_tickers)
        n_safe = len(safe_tickers)

        if n_eq > 0 and n_safe > 0:
            weights = pd.Series(0.0, index=tickers)
            for t in equity_tickers:
                weights[t] = eq_w / n_eq
            for t in safe_tickers:
                weights[t] = safe_w / n_safe
        elif n_eq > 0:
            weights = pd.Series(1.0 / n_eq, index=equity_tickers)
            weights = weights.reindex(tickers, fill_value=0)
        elif n_safe > 0:
            weights = pd.Series(1.0 / n_safe, index=safe_tickers)
            weights = weights.reindex(tickers, fill_value=0)
        else:
            continue

        if date in returns.index:
            port_returns.loc[date] = (returns.loc[date] * weights).sum()

    metrics = _compute_metrics(port_returns)
    return port_returns, metrics


def run_backtest(period: str = "all") -> dict:
    """
    รัน backtest เปรียบเทียบ 3 กลยุทธ์

    period: '1y' | '3y' | 'all'
    คืน dict ที่มี: strategies, comparison, equity_curves
    """
    prices = _load_prices()

    # กรองช่วงเวลา
    if period != "all":
        cutoff_map = {
            "1y": pd.DateOffset(years=1),
            "3y": pd.DateOffset(years=3),
        }
        cutoff = prices.index.max() - cutoff_map.get(period, pd.DateOffset(years=1))
        prices = prices[prices.index >= cutoff]

    if len(prices) < 30:
        raise ValueError("ข้อมูลไม่เพียงพอสำหรับ backtest (ต้องการอย่างน้อย 30 วัน)")

    regime_df = _load_regime_predictions()
    mpt_weights = _load_mpt_weights()

    # รัน 3 กลยุทธ์
    bh_returns, bh_metrics = _backtest_buy_hold(prices)
    mpt_returns, mpt_metrics = _backtest_mpt(prices, mpt_weights)
    reg_returns, reg_metrics = _backtest_regime(prices, regime_df)

    # สร้าง equity curves (rebase ให้เริ่มที่ 100)
    def _equity_curve(returns):
        if returns.empty:
            return []
        cum = (1 + returns).cumprod() * 100
        # resample รายเดือนเพื่อลดจำนวนจุด
        monthly = cum.resample("ME").last()
        return [
            {"date": idx.strftime("%b %y"), "value": round(float(v), 2)}
            for idx, v in monthly.items() if pd.notna(v)
        ]

    strategies = [
        {
            "name": "Buy & Hold",
            "description": "ถือ equal-weight ทุกสินทรัพย์ ไม่ปรับพอร์ต",
            "metrics": bh_metrics,
            "equity_curve": _equity_curve(bh_returns),
            "color": "var(--c1)",
        },
        {
            "name": "MPT Optimized",
            "description": "หา optimal weights และ rebalance ทุกเดือน",
            "metrics": mpt_metrics,
            "equity_curve": _equity_curve(mpt_returns),
            "color": "var(--c2)",
        },
        {
            "name": "Regime-Based",
            "description": "ปรับ equity/bond allocation ตามสภาวะตลาด (Bull/Bear/Neutral)",
            "metrics": reg_metrics,
            "equity_curve": _equity_curve(reg_returns),
            "color": "var(--c5)",
        },
    ]

    # สร้าง comparison table
    comparison = []
    for s in strategies:
        m = s["metrics"]
        comparison.append({
            "strategy": s["name"],
            "total_return": m.get("total_return", 0),
            "cagr": m.get("cagr", 0),
            "sharpe": m.get("sharpe", 0),
            "max_drawdown": m.get("max_drawdown", 0),
            "volatility": m.get("volatility", 0),
        })

    return {
        "period": period,
        "start_date": str(prices.index[0].date()),
        "end_date": str(prices.index[-1].date()),
        "n_days": len(prices),
        "strategies": strategies,
        "comparison": comparison,
    }


# ─────────────────────────────────────────────
# API Registration
# ─────────────────────────────────────────────

def register(app: FastAPI) -> None:

    @app.get("/api/backtest")
    async def api_backtest(period: str = Query("all", regex="^(1y|3y|all)$")):
        """รัน backtest เปรียบเทียบ 3 กลยุทธ์"""
        try:
            result = run_backtest(period=period)
            return result
        except FileNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            log.exception("backtest error")
            raise HTTPException(status_code=500, detail=str(e))
