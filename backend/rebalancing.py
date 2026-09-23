"""
Rebalancing Suggestions
========================
แนะนำการปรับสัดส่วนพอร์ตตาม MPT + สภาวะตลาดปัจจุบัน

Logic:
  1. คำนวณสัดส่วนปัจจุบันของผู้ใช้ (จาก holdings × live prices)
  2. ดึงน้ำหนัก MPT ที่เหมาะสมที่สุดจาก CSV
  3. ดึงสภาวะตลาดล่าสุด (Bull/Neutral/Bear)
  4. ปรับน้ำหนัก MPT ตามสภาวะตลาด:
     - Bull   → เพิ่มความเสี่ยง (เน้น equity)
     - Bear   → ลดความเสี่ยง (เน้น bonds/safe)
     - Neutral → ใช้ MPT เดิม
  5. คำนวณการปรับสัดส่วน: ซื้อ/ขาย/ถือ พร้อมจำนวนเงิน
"""
from __future__ import annotations

import re
import logging
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel, Field

from auth import _current_user, db
from live import get_live_snapshot

log = logging.getLogger("rebalancing")

OUTPUT_DIR = Path("output")

# Regime-based tilt factors — เพิ่ม/ลดน้ำหนัก equity ตามสภาวะตลาด
# สินทรัพย์ปลอดภัย (bonds/gold) จะถูกปรับในทิศทางตรงกันข้าม
SAFE_TICKERS = {"TLT", "IEF", "SHY", "GLD", "BIL"}

REGIME_TILT = {
    "Bull":     {"equity_factor": 1.15, "safe_factor": 0.60},   # เพิ่ม equity 15%, ลด safe 40%
    "Bear":     {"equity_factor": 0.55, "safe_factor": 1.80},   # ลด equity 45%, เพิ่ม safe 80%
    "Neutral":  {"equity_factor": 1.00, "safe_factor": 1.00},   # ใช้ MPT เดิม
}


def _parse_optimal_weights() -> dict[str, float]:
    csv = OUTPUT_DIR / "optimal_portfolio.csv"
    if not csv.exists():
        return {}
    raw = pd.read_csv(csv).iloc[0].get("weights", "") or ""
    return {
        t: float(v)
        for t, v in re.findall(r"'([^']+)':\s*(?:np\.float64\()?(-?[\d.eE+]+)", raw)
    }


def _get_current_regime() -> dict | None:
    csv = OUTPUT_DIR / "regime_predictions.csv"
    if not csv.exists():
        return None
    df = pd.read_csv(csv, index_col=0, parse_dates=True).sort_index()
    latest = df.iloc[-1]
    return {
        "regime": latest["regime_label"],
        "prob_bull": float(latest["prob_bull"]),
        "prob_neutral": float(latest["prob_neutral"]),
        "prob_bear": float(latest["prob_bear"]),
    }


def _apply_regime_tilt(weights: dict[str, float], regime: str | None) -> dict[str, float]:
    """ปรับน้ำหนัก MPT ตามสภาวะตลาด"""
    if not regime or regime not in REGIME_TILT:
        return dict(weights)

    tilt = REGIME_TILT[regime]
    adjusted = {}
    for ticker, w in weights.items():
        if ticker in SAFE_TICKERS:
            adjusted[ticker] = w * tilt["safe_factor"]
        else:
            adjusted[ticker] = w * tilt["equity_factor"]

    # normalize ให้ผลรวม = 1
    total = sum(adjusted.values())
    if total > 0:
        adjusted = {t: w / total for t, w in adjusted.items()}

    return adjusted


def compute_rebalancing(
    holdings: list[dict],
    live_prices: dict[str, float],
    mpt_weights: dict[str, float],
    regime: dict | None,
) -> dict:
    """
    คำนวณคำแนะนำการปรับสัดส่วนพอร์ต

    คืน dict ที่มี:
      - current_allocation: สัดส่วนปัจจุบันของผู้ใช้
      - target_allocation: สัดส่วนเป้าหมาย (MPT + regime tilt)
      - suggestions: รายการซื้อ/ขาย/ถือ
      - regime: สภาวะตลาดปัจจุบัน
      - total_value: มูลค่าพอร์ตปัจจุบัน
    """
    # 1. คำนวณมูลค่าปัจจุบันแต่ละตัว
    values = {}
    total_value = 0.0
    for h in holdings:
        ticker = h["ticker"]
        price = live_prices.get(ticker)
        if price is None:
            # ใช้ราคาซื้อเป็น fallback
            price = h.get("buyPrice", 0)
        val = price * h["shares"]
        values[ticker] = values.get(ticker, 0) + val
        total_value += val

    if total_value == 0:
        return {
            "total_value": 0,
            "regime": regime,
            "current_allocation": [],
            "target_allocation": [],
            "suggestions": [],
        }

    # 2. สัดส่วนปัจจุบัน
    current_alloc = {t: v / total_value for t, v in values.items()}

    # 3. ปรับ MPT weights ตาม regime
    regime_label = regime.get("regime") if regime else None
    target_weights = _apply_regime_tilt(mpt_weights, regime_label)

    # 4. รวม tickers ที่มีในพอร์ตผู้ใช้ + MPT
    all_tickers = sorted(set(list(current_alloc.keys()) + list(target_weights.keys())))

    suggestions = []
    for ticker in all_tickers:
        current_w = current_alloc.get(ticker, 0)
        target_w = target_weights.get(ticker, 0)
        current_val = values.get(ticker, 0)
        target_val = target_w * total_value
        diff_val = target_val - current_val
        diff_pct = (target_w - current_w) * 100

        # กำหนด action
        if diff_val > total_value * 0.01:  # เกิน 1% ของพอร์ต
            action = "buy"
        elif diff_val < -total_value * 0.01:
            action = "sell"
        else:
            action = "hold"

        suggestions.append({
            "ticker": ticker,
            "current_weight": round(current_w * 100, 2),
            "target_weight": round(target_w * 100, 2),
            "current_value": round(current_val, 2),
            "target_value": round(target_val, 2),
            "diff_value": round(diff_val, 2),
            "diff_pct": round(diff_pct, 2),
            "action": action,
        })

    # เรียงตาม |diff| มากไปน้อย
    suggestions.sort(key=lambda x: abs(x["diff_value"]), reverse=True)

    return {
        "total_value": round(total_value, 2),
        "regime": regime,
        "current_allocation": [
            {"ticker": t, "weight": round(w * 100, 2)}
            for t, w in sorted(current_alloc.items(), key=lambda x: -x[1])
        ],
        "target_allocation": [
            {"ticker": t, "weight": round(w * 100, 2)}
            for t, w in sorted(target_weights.items(), key=lambda x: -x[1])
            if w > 0.001
        ],
        "suggestions": suggestions,
    }


# ─────────────────────────────────────────────
# API Registration
# ─────────────────────────────────────────────

class RebalanceRequest(BaseModel):
    holdings: list[dict] = Field(..., description="รายการ holdings ของผู้ใช้")


def register(app: FastAPI) -> None:

    @app.post("/api/rebalancing/suggestions")
    async def rebalancing_suggestions(request: Request, inp: RebalanceRequest):
        """คำนวณคำแนะนำการปรับสัดส่วนพอร์ต"""
        user = await _current_user(request)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        if not inp.holdings:
            return {"suggestions": [], "message": "ไม่มีหุ้นในพอร์ต"}

        # ดึง live prices
        try:
            snapshot = await get_live_snapshot()
            live_prices = snapshot.get("prices", {})
        except Exception as e:
            log.warning("live prices unavailable: %s", e)
            live_prices = {}

        # ดึง MPT weights
        mpt_weights = _parse_optimal_weights()
        if not mpt_weights:
            raise HTTPException(
                status_code=404,
                detail="ยังไม่มีข้อมูล MPT — กรุณารัน optimizer ก่อน"
            )

        # ดึง regime
        regime = _get_current_regime()

        result = compute_rebalancing(inp.holdings, live_prices, mpt_weights, regime)
        return result

    @app.get("/api/rebalancing/regime-tilt")
    async def regime_tilt_info():
        """ส่งข้อมูล regime tilt factors ให้ frontend แสดง"""
        regime = _get_current_regime()
        return {
            "regime": regime,
            "tilt_factors": {
                k: v for k, v in REGIME_TILT.items()
            },
        }
