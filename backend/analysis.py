"""
analysis.py — Detail-page data endpoints (real data behind each KPI).

Exposes:
  * GET /api/analysis/mpt     → Efficient Frontier + Monte Carlo cloud + optimal
                                point + optimal-portfolio cumulative growth.
  * GET /api/analysis/regime  → Regime probability timeline + distribution +
                                Random-Forest feature importance.

All numbers are derived from the CSV/PKL artefacts produced by the pipeline —
nothing is mocked.
"""
from __future__ import annotations

import re
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException

OUTPUT_DIR = Path("output")

# feature order must match regime.build_features()
REGIME_FEATURES = [
    "ret_20d", "ret_60d", "vol_20d", "vol_60d", "sharpe_20d", "sharpe_60d",
    "rsi_14", "price_vs_ma20", "price_vs_ma60", "breadth_20d", "vol_ratio",
]


def _parse_optimal_weights() -> dict[str, float]:
    csv = OUTPUT_DIR / "optimal_portfolio.csv"
    if not csv.exists():
        return {}
    raw = pd.read_csv(csv).iloc[0].get("weights", "") or ""
    return {
        t: float(v)
        for t, v in re.findall(r"'([^']+)':\s*(?:np\.float64\()?(-?[\d.eE+]+)", raw)
    }


def register(app: FastAPI) -> None:

    @app.get("/api/analysis/mpt")
    async def analysis_mpt():
        ef = OUTPUT_DIR / "efficient_frontier.csv"
        mc = OUTPUT_DIR / "monte_carlo_portfolios.csv"
        opt = OUTPUT_DIR / "optimal_portfolio.csv"
        if not opt.exists():
            raise HTTPException(404, "ยังไม่มีข้อมูล MPT — กรุณารัน optimizer ก่อน")

        # optimal point (return/vol already stored as %)
        orow = pd.read_csv(opt).iloc[0]
        optimal = {
            "ret":    round(float(orow["annualized_return"]), 2),
            "vol":    round(float(orow["annualized_volatility"]), 2),
            "sharpe": round(float(orow["sharpe_ratio"]), 3),
        }

        # monte carlo cloud (ret/vol/sharpe stored as decimals → %)
        monte_carlo = []
        if mc.exists():
            dfm = pd.read_csv(mc, usecols=["return", "volatility", "sharpe"])
            step = max(1, len(dfm) // 2200)
            dfm = dfm.iloc[::step]
            monte_carlo = [
                {"ret": round(r * 100, 2), "vol": round(v * 100, 2), "sharpe": round(s, 3)}
                for r, v, s in zip(dfm["return"], dfm["volatility"], dfm["sharpe"])
            ]

        # efficient frontier line — keep only the efficient (upper) envelope
        frontier = []
        if ef.exists():
            dff = pd.read_csv(ef).sort_values("volatility")
            running_max = -1e18
            for r, v in zip(dff["return"], dff["volatility"]):
                if r > running_max:
                    running_max = r
                    frontier.append({"ret": round(r * 100, 2), "vol": round(v * 100, 2)})

        # optimal-portfolio cumulative growth vs equal-weight benchmark
        performance = []
        dr = OUTPUT_DIR / "daily_returns.csv"
        weights = _parse_optimal_weights()
        if dr.exists() and weights:
            rets = pd.read_csv(dr, index_col=0, parse_dates=True).sort_index()
            if rets.abs().mean().mean() > 1:
                rets = rets / 100
            cols = [c for c in weights if c in rets.columns]
            w = pd.Series({c: weights[c] for c in cols})
            w = w / w.sum() if w.sum() else w
            port_daily = (rets[cols] * w).sum(axis=1)
            bench_daily = rets.mean(axis=1)  # equal-weight
            port_growth = ((1 + port_daily).cumprod() - 1) * 100
            bench_growth = ((1 + bench_daily).cumprod() - 1) * 100
            m_port = port_growth.resample("ME").last()
            m_bench = bench_growth.resample("ME").last()
            performance = [
                {"date": idx.strftime("%b %y"),
                 "portfolio": round(float(p), 2),
                 "benchmark": round(float(b), 2)}
                for idx, p, b in zip(m_port.index, m_port.values, m_bench.values)
                if pd.notna(p)
            ]

        top_weights = sorted(
            ({"name": t, "weight": round(w * 100, 2)} for t, w in weights.items() if w > 0.005),
            key=lambda x: -x["weight"],
        )

        return {
            "optimal": optimal,
            "monte_carlo": monte_carlo,
            "frontier": frontier,
            "performance": performance,
            "weights": top_weights,
        }

    @app.get("/api/analysis/regime")
    async def analysis_regime():
        csv = OUTPUT_DIR / "regime_predictions.csv"
        if not csv.exists():
            raise HTTPException(404, "ยังไม่มีข้อมูล Regime — กรุณารัน classifier ก่อน")

        df = pd.read_csv(csv, index_col=0, parse_dates=True).sort_index()

        # weekly-sampled probability timeline (%)
        weekly = df[["prob_bull", "prob_neutral", "prob_bear"]].resample("W").mean().dropna()
        timeline = [
            {"date": idx.strftime("%b %y"),
             "bull": round(float(r.prob_bull) * 100, 1),
             "neutral": round(float(r.prob_neutral) * 100, 1),
             "bear": round(float(r.prob_bear) * 100, 1)}
            for idx, r in weekly.iterrows()
        ]

        counts = df["regime_label"].value_counts().to_dict()
        distribution = [
            {"name": k, "days": int(counts.get(k, 0))}
            for k in ["Bull", "Neutral", "Bear"]
        ]

        latest = df.iloc[-1]
        current = {
            "date": str(df.index[-1].date()),
            "regime": latest["regime_label"],
            "bull": round(float(latest["prob_bull"]) * 100, 1),
            "neutral": round(float(latest["prob_neutral"]) * 100, 1),
            "bear": round(float(latest["prob_bear"]) * 100, 1),
        }

        # feature importance from trained Random Forest
        importance = []
        model_path = OUTPUT_DIR / "regime_model_random_forest.pkl"
        if model_path.exists():
            try:
                import joblib
                pipe = joblib.load(model_path)
                clf = pipe["clf"] if hasattr(pipe, "__getitem__") else pipe
                imp = getattr(clf, "feature_importances_", None)
                if imp is not None:
                    pairs = sorted(zip(REGIME_FEATURES, imp), key=lambda x: -x[1])
                    importance = [
                        {"feature": f, "importance": round(float(v) * 100, 2)}
                        for f, v in pairs
                    ]
            except Exception:  # noqa: BLE001
                importance = []

        return {
            "current": current,
            "timeline": timeline,
            "distribution": distribution,
            "importance": importance,
            "total_days": int(len(df)),
        }
