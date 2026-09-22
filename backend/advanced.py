"""
advanced.py — Advanced analytics endpoints.

  GET  /api/rebalancing               — Rebalancing suggestions (MPT + regime)
  GET  /api/backtest?strategy=…       — Backtesting (buy_hold | mpt | regime | all)
  GET  /api/dividends                  — Dividend history (yfinance)
  POST /api/regime/retrain             — Retrain regime model with latest data
  GET  /api/alt-data                   — Alternative data (VIX, Fear/Greed proxy, macro)
  GET  /api/tax-report                 — Tax info (TH)
  POST /api/tax-report/calculate      — Calculate tax from holdings
  GET  /api/options/{ticker}           — Options chain (yfinance)
"""
from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf
from fastapi import FastAPI, HTTPException, Query, Request
from pydantic import BaseModel

from yh import ALL_TICKERS, USD_TICKERS, THAI_STOCKS, US_STOCKS, BONDS, FX_TICKER, FX_FALLBACK
from live import get_live_snapshot

log = logging.getLogger("advanced")

OUTPUT_DIR = Path("output")
TRADING_DAYS = 252

# ── Thailand tax constants ──
TH_DIVIDEND_TAX = 0.10
TH_CG_NOTE = "หุ้นในตลาดหลักทรัพย์ฯ: กำไรการขายไม่ต้องเสียภาษีสำหรับบุคคลธรรมดา (ประมวลรัษฎากรรม ม.42 ทวิ)"

_bond_set = set(BONDS)


def _parse_weights(raw: str) -> dict[str, float]:
    return {t: float(v) for t, v in re.findall(r"'([^']+)':\s*(?:np\.float64\()?(-?[\d.]+)", raw)}


# ═══════════════════════════════════════════════
# REGISTRATION
# ═══════════════════════════════════════════════
def register(app: FastAPI) -> None:

    # ── Rebalancing ──────────────────────────
    @app.get("/api/rebalancing")
    async def api_rebalancing():
        opt_csv = OUTPUT_DIR / "optimal_portfolio.csv"
        if not opt_csv.exists():
            raise HTTPException(404, "ยังไม่มีข้อมูล MPT — กรุณารัน pipeline ก่อน")
        opt_df = pd.read_csv(opt_csv)
        optimal_weights = _parse_weights(opt_df.iloc[0].get("weights", "") or "")

        # Regime
        regime_csv = OUTPUT_DIR / "regime_predictions.csv"
        regime_label, regime_probs = "Neutral", {"bull": 0, "neutral": 1, "bear": 0}
        if regime_csv.exists():
            rdf = pd.read_csv(regime_csv, index_col=0, parse_dates=True)
            latest = rdf.iloc[-1]
            regime_label = latest["regime_label"]
            regime_probs = {
                "bull": float(latest["prob_bull"]),
                "neutral": float(latest["prob_neutral"]),
                "bear": float(latest["prob_bear"]),
            }

        # Regime-based adjustment
        adj_map = {"Bull": +0.05, "Neutral": 0.0, "Bear": -0.10}
        shift = adj_map.get(regime_label, 0.0)
        bond_tickers = [t for t in optimal_weights if t in _bond_set]
        stock_tickers = [t for t in optimal_weights if t not in _bond_set]

        adjusted = {}
        for t, w in optimal_weights.items():
            if t in _bond_set:
                adjusted[t] = w + (-shift / max(len(bond_tickers), 1))
            else:
                adjusted[t] = w + (shift / max(len(stock_tickers), 1))
            adjusted[t] = max(0, adjusted[t])

        total = sum(adjusted.values())
        if total > 0:
            adjusted = {t: w / total for t, w in adjusted.items()}

        suggestions = []
        for t, w in adjusted.items():
            suggestions.append({
                "ticker": t,
                "weight": round(w * 100, 2),
                "group": "Bond" if t in _bond_set else ("Thai" if t.endswith(".BK") else "US"),
                "action": "Buy" if w > 0.05 else ("Hold" if w > 0.01 else "Reduce"),
            })
        suggestions.sort(key=lambda x: -x["weight"])

        note_map = {"Bull": "เพิ่มหุ้น ลดพันธบัตร", "Bear": "เพิ่มพันธบัตร ลดหุ้น", "Neutral": "รักษาสัดส่วน"}
        return {
            "regime": regime_label,
            "regime_probs": regime_probs,
            "weights": suggestions,
            "note": f"ปรับตามสภาวะตลาด {regime_label} — {note_map.get(regime_label, '')}",
        }

    # ── Backtesting ──────────────────────────
    @app.get("/api/backtest")
    async def api_backtest(strategy: str = "all", period: str = "1y"):
        prices_csv = OUTPUT_DIR / "prices_clean_thb.csv"
        if not prices_csv.exists():
            raise HTTPException(404, "ยังไม่มีข้อมูลราคา — กรุณารัน pipeline ก่อน")

        prices = pd.read_csv(prices_csv, index_col=0, parse_dates=True).sort_index()
        returns = prices.pct_change().dropna(how="all")

        now = returns.index.max()
        cutoff_map = {
            "1d": now - pd.Timedelta(days=1), "1w": now - pd.Timedelta(weeks=1),
            "1m": now - pd.DateOffset(months=1), "3m": now - pd.DateOffset(months=3),
            "6m": now - pd.DateOffset(months=6), "1y": now - pd.DateOffset(years=1),
            "3y": now - pd.DateOffset(years=3), "all": returns.index.min(),
        }
        cutoff = cutoff_map.get(period, cutoff_map["1y"])
        ret = returns[returns.index >= cutoff]
        if len(ret) < 5:
            ret = returns.tail(60)

        tickers = [c for c in ret.columns if not c.startswith("FX")]
        ret = ret[tickers]

        def _stats(port_ret):
            cum = (1 + port_ret).cumprod() - 1
            sharpe = ((port_ret.mean() * TRADING_DAYS - 0.02) /
                      (port_ret.std() * np.sqrt(TRADING_DAYS))) if port_ret.std() > 0 else 0
            mdd = float((cum - cum.cummax()).min() * 100)
            return {
                "cumulative_return": round(float(cum.iloc[-1]) * 100, 2),
                "sharpe": round(float(sharpe), 4),
                "max_drawdown": round(mdd, 2),
                "data": [{"date": str(d.date()), "value": round(float(v) * 100, 2)}
                         for d, v in cum.items()],
            }

        strategies = {}

        if strategy in ("buy_hold", "all"):
            eq_w = np.array([1 / len(tickers)] * len(tickers))
            strategies["buy_hold"] = {"label": "Buy & Hold (Equal Weight)", **_stats((ret[tickers] * eq_w).sum(axis=1))}

        if strategy in ("mpt", "all"):
            opt_csv = OUTPUT_DIR / "optimal_portfolio.csv"
            if opt_csv.exists():
                opt_w = _parse_weights(pd.read_csv(opt_csv).iloc[0].get("weights", "") or "")
                w_arr = np.array([opt_w.get(t, 0) for t in tickers])
                if w_arr.sum() > 0:
                    w_arr = w_arr / w_arr.sum()
                    strategies["mpt"] = {"label": "MPT Max-Sharpe", **_stats((ret[tickers] * w_arr).sum(axis=1))}

        if strategy in ("regime", "all"):
            regime_csv = OUTPUT_DIR / "regime_predictions.csv"
            if regime_csv.exists():
                rdf = pd.read_csv(regime_csv, index_col=0, parse_dates=True)
                bond_idx = [i for i, t in enumerate(tickers) if t in _bond_set]
                stock_idx = [i for i, t in enumerate(tickers) if t not in _bond_set]

                w_agg = np.zeros(len(tickers))
                w_def = np.zeros(len(tickers))
                if stock_idx:
                    w_agg[stock_idx] = 1 / len(stock_idx) * 0.85
                    w_def[stock_idx] = 1 / len(stock_idx) * 0.40
                if bond_idx:
                    w_agg[bond_idx] = 1 / len(bond_idx) * 0.15
                    w_def[bond_idx] = 1 / len(bond_idx) * 0.60

                port_rets = []
                for date, row in ret.iterrows():
                    regime_rows = rdf.loc[:date]
                    if len(regime_rows) == 0:
                        w = w_agg
                    else:
                        r = regime_rows.iloc[-1]["regime_label"]
                        w = w_agg if r == "Bull" else (w_def if r == "Bear" else (w_agg + w_def) / 2)
                    port_rets.append(float(np.dot(row[tickers].fillna(0).values, w)))

                strategies["regime"] = {"label": "Regime-Based (Dynamic)", **_stats(pd.Series(port_rets, index=ret.index))}

        if not strategies:
            raise HTTPException(404, "ไม่สามารถคำนวณ backtest ได้ — ข้อมูลไม่เพียงพอ")
        return {"period": period, "strategies": strategies}

    # ── Dividends ────────────────────────────
    @app.get("/api/dividends")
    async def api_dividends(tickers: str = ""):
        target = tickers.split(",") if tickers else ALL_TICKERS

        def _fetch():
            results = []
            for t in target[:15]:
                try:
                    tk = yf.Ticker(t)
                    divs = tk.dividends
                    if divs is not None and not divs.empty:
                        if t in USD_TICKERS:
                            try:
                                snap = asyncio.run(get_live_snapshot())
                                fx = snap.get("fx_thb_per_usd", FX_FALLBACK)
                            except Exception:
                                fx = FX_FALLBACK
                            divs = divs * fx
                        recent = divs.tail(12)
                        for date, amount in recent.items():
                            results.append({
                                "ticker": t, "date": str(date.date()),
                                "amount": round(float(amount), 4),
                            })
                except Exception as e:
                    log.debug("dividend %s: %s", t, e)
            return results

        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(None, _fetch)

        summary = {}
        for r in data:
            t = r["ticker"]
            if t not in summary:
                summary[t] = {"ticker": t, "count": 0, "total": 0.0, "last_date": ""}
            summary[t]["count"] += 1
            summary[t]["total"] = round(summary[t]["total"] + r["amount"], 4)
            if r["date"] > summary[t]["last_date"]:
                summary[t]["last_date"] = r["date"]

        return {"dividends": data, "summary": list(summary.values()), "currency": "THB"}

    # ── ML Retrain ──────────────────────────
    @app.post("/api/regime/retrain")
    async def api_retrain():
        from regime import run_regime

        def _do():
            return run_regime(model_type="random_forest")

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _do)
        return {
            "status": "success",
            "current_regime": result["current_regime"],
            "cv_f1": result["cv_f1_mean"],
            "message": f"โมเดล retrain เสร็จ — สภาวะตลาดล่าสุด: {result['current_regime']['regime_label']}",
        }

    # ── Alternative Data ────────────────────
    @app.get("/api/alt-data")
    async def api_alt_data():
        def _fetch():
            data = {"indicators": {}, "sentiment": {}}

            # VIX
            try:
                vix = yf.download("^VIX", period="5d", auto_adjust=True, progress=False)
                if not vix.empty:
                    close = vix["Close"] if isinstance(vix.columns, pd.MultiIndex) else vix[["Close"]]
                    latest = float(close.iloc[-1].dropna().iloc[-1])
                    data["indicators"]["vix"] = round(latest, 2)
                    data["sentiment"]["vix_label"] = (
                        "Extreme Fear" if latest > 30 else "Fear" if latest > 20
                        else "Neutral" if latest > 15 else "Greed"
                    )
            except Exception as e:
                log.debug("VIX: %s", e)

            # Fear & Greed proxy
            try:
                p_csv = OUTPUT_DIR / "prices_clean_thb.csv"
                if p_csv.exists():
                    pdf = pd.read_csv(p_csv, index_col=0, parse_dates=True)
                    norm = pdf / pdf.iloc[0]
                    idx = norm.mean(axis=1)
                    ret_20 = idx.pct_change(20).iloc[-1]
                    ret_60 = idx.pct_change(60).iloc[-1]
                    score = max(0, min(100, 50 + float(ret_20) * 200 + float(ret_60) * 100))
                    data["sentiment"]["fear_greed_score"] = round(score, 1)
                    data["sentiment"]["fear_greed_label"] = (
                        "Extreme Greed" if score > 75 else "Greed" if score > 55
                        else "Neutral" if score > 45 else "Fear" if score > 25 else "Extreme Fear"
                    )
            except Exception as e:
                log.debug("f/g: %s", e)

            # Macro indicators
            for name, tk in {"us10y": "^TNX", "dxy": "DX-Y.NYB", "gold": "GC=F"}.items():
                try:
                    d = yf.download(tk, period="5d", auto_adjust=True, progress=False)
                    if not d.empty:
                        c = d["Close"] if isinstance(d.columns, pd.MultiIndex) else d[["Close"]]
                        val = float(c.iloc[-1].dropna().iloc[-1])
                        data["indicators"][name] = round(val, 2)
                except Exception:
                    pass

            return data

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _fetch)

    # ── Tax Report ─────────────────────────
    @app.get("/api/tax-report")
    async def api_tax_report():
        return {
            "tax_year": datetime.now().year,
            "country": "Thailand",
            "capital_gains": {"taxable": False, "note": TH_CG_NOTE},
            "dividend_tax": {"rate": "10%", "note": "หัก ณ ที่จ่าย 10% สำหรับเงินปันผลหุ้น SET"},
            "form": "ภพ.50",
        }

    class TaxCalcIn(BaseModel):
        holdings: list[dict] = []
        dividends: list[dict] = []

    @app.post("/api/tax-report/calculate")
    async def api_tax_calc(inp: TaxCalcIn):
        total_cost = sum(h.get("buyPrice", 0) * h.get("shares", 0) for h in inp.holdings)
        total_value = sum(h.get("currentPrice", 0) * h.get("shares", 0) for h in inp.holdings)
        unrealized_pl = total_value - total_cost
        unrealized_pct = (unrealized_pl / total_cost * 100) if total_cost > 0 else 0
        total_dividends = sum(d.get("amount", 0) for d in inp.dividends)
        dividend_tax = total_dividends * TH_DIVIDEND_TAX

        return {
            "tax_year": datetime.now().year,
            "holdings_count": len(inp.holdings),
            "total_cost": round(total_cost, 2),
            "total_value": round(total_value, 2),
            "unrealized_pl": round(unrealized_pl, 2),
            "unrealized_pl_pct": round(unrealized_pct, 2),
            "capital_gains_tax": 0,
            "capital_gains_note": TH_CG_NOTE,
            "total_dividends": round(total_dividends, 2),
            "dividend_tax": round(dividend_tax, 2),
            "dividend_tax_rate": "10%",
            "total_estimated_tax": round(dividend_tax, 2),
            "form": "ภพ.50",
        }

    # ── Options ─────────────────────────────
    @app.get("/api/options/{ticker}")
    async def api_options(ticker: str, expiry: str = ""):
        def _fetch():
            try:
                tk = yf.Ticker(ticker.upper())
                expirations = tk.options
                if not expirations:
                    return {"error": "ไม่มี options สำหรับหุ้นนี้", "expirations": []}
                exp = expiry if expiry in expirations else expirations[0]
                chain = tk.option_chain(exp)
                try:
                    spot = float(tk.fast_info.get("last_price", 0) or 0)
                    if spot == 0:
                        spot = float(tk.history(period="1d")["Close"].iloc[-1])
                except Exception:
                    try:
                        spot = float(tk.history(period="1d")["Close"].iloc[-1])
                    except Exception:
                        spot = 0.0

                def _parse(df, opt_type):
                    if df is None or df.empty:
                        return []
                    rows = []
                    for _, r in df.iterrows():
                        rows.append({
                            "strike": round(float(r.get("strike", 0)), 2),
                            "lastPrice": round(float(r.get("lastPrice", 0)), 2),
                            "bid": round(float(r.get("bid", 0)), 2),
                            "ask": round(float(r.get("ask", 0)), 2),
                            "volume": int(r.get("volume", 0) or 0) if pd.notna(r.get("volume", 0)) else 0,
                            "openInterest": int(r.get("openInterest", 0) or 0) if pd.notna(r.get("openInterest", 0)) else 0,
                            "impliedVolatility": round(float(r.get("impliedVolatility", 0)), 4),
                            "inTheMoney": bool(r.get("inTheMoney", False)),
                        })
                    return rows

                return {
                    "ticker": ticker.upper(),
                    "spot": round(spot, 2),
                    "expiry": exp,
                    "expirations": list(expirations[:10]),
                    "calls": _parse(chain.calls, "call"),
                    "puts": _parse(chain.puts, "put"),
                }
            except Exception as e:
                return {"error": str(e)}

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _fetch)

    # ── Multi-currency live prices ──────────
    @app.get("/api/prices/live-multi")
    async def api_prices_live_multi(currency: str = "THB"):
        snapshot = await get_live_snapshot()
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

    log.info("advanced endpoints registered ✓")
