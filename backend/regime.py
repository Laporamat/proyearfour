"""
Market Regime Classification
==============================
สภาวะตลาด 3 ระดับ:
  0 = Bear  — ตลาดขาลง (return ต่ำ, vol สูง)
  1 = Neutral — ตลาดทรงตัว
  2 = Bull  — ตลาดขาขึ้น (return สูง, vol ต่ำ)

Features ที่ใช้:
  - Rolling 20d / 60d return
  - Rolling 20d volatility
  - Rolling 20d / 60d Sharpe-like ratio
  - Momentum (RSI-proxy)
  - Market breadth (% สินทรัพย์ > MA20)

โมเดล:
  - Random Forest Classifier (primary)
  - Label สร้างจาก rule-based (unsupervised bootstrap)
  - Cross-validation + Feature Importance
"""

import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import TimeSeriesSplit, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, confusion_matrix
import joblib

warnings.filterwarnings("ignore")

OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)

REGIME_LABELS = {0: "Bear", 1: "Neutral", 2: "Bull"}
LOOKBACK_SHORT = 20    # วัน
LOOKBACK_LONG  = 60    # วัน
RISK_FREE_DAILY = 0.02 / 252


# ─────────────────────────────────────────────
# FEATURE ENGINEERING
# ─────────────────────────────────────────────

def build_features(prices: pd.DataFrame) -> pd.DataFrame:
    """
    สร้าง feature matrix จากราคา clean (หน่วย THB)
    ใช้ index fund สังเคราะห์ = ค่าเฉลี่ยของทุกสินทรัพย์ (equal-weight)
    """
    # Equal-weight market index
    norm = prices / prices.iloc[0]              # normalize to 1 at start
    index_price = norm.mean(axis=1)             # synthetic market index

    returns_daily = index_price.pct_change()

    feat = pd.DataFrame(index=prices.index)

    # Rolling returns
    feat["ret_20d"]  = index_price.pct_change(LOOKBACK_SHORT)
    feat["ret_60d"]  = index_price.pct_change(LOOKBACK_LONG)

    # Rolling volatility
    feat["vol_20d"]  = returns_daily.rolling(LOOKBACK_SHORT).std() * np.sqrt(252)
    feat["vol_60d"]  = returns_daily.rolling(LOOKBACK_LONG).std()  * np.sqrt(252)

    # Rolling Sharpe-like ratio
    feat["sharpe_20d"] = (
        returns_daily.rolling(LOOKBACK_SHORT).mean() - RISK_FREE_DAILY
    ) / (returns_daily.rolling(LOOKBACK_SHORT).std() + 1e-8)

    feat["sharpe_60d"] = (
        returns_daily.rolling(LOOKBACK_LONG).mean() - RISK_FREE_DAILY
    ) / (returns_daily.rolling(LOOKBACK_LONG).std() + 1e-8)

    # Momentum — RSI proxy (avg gain / avg loss over 14d)
    delta = returns_daily.copy()
    gain  = delta.clip(lower=0).rolling(14).mean()
    loss  = (-delta).clip(lower=0).rolling(14).mean()
    feat["rsi_14"] = 100 - (100 / (1 + gain / (loss + 1e-8)))

    # Trend: price vs MA
    feat["price_vs_ma20"] = (index_price / index_price.rolling(20).mean()) - 1
    feat["price_vs_ma60"] = (index_price / index_price.rolling(60).mean()) - 1

    # Market breadth — % ของสินทรัพย์ที่ราคา > MA20
    ma20 = prices.rolling(20).mean()
    feat["breadth_20d"] = (prices > ma20).mean(axis=1)

    # Vol regime — ratio of short/long vol
    feat["vol_ratio"]   = feat["vol_20d"] / (feat["vol_60d"] + 1e-8)

    feat = feat.dropna()
    return feat


# ─────────────────────────────────────────────
# RULE-BASED LABEL GENERATION
# ─────────────────────────────────────────────

def generate_labels(feat: pd.DataFrame) -> pd.Series:
    """
    สร้าง label สภาวะตลาดจาก rule เพื่อ bootstrap การเทรน
    Bull   : ret_60d > 0 AND vol_20d < median(vol_20d) AND sharpe_20d > 0
    Bear   : ret_60d < 0 AND vol_20d > median(vol_20d) AND sharpe_20d < 0
    Neutral: อื่นๆ
    """
    med_vol = feat["vol_20d"].median()

    conditions = [
        # Bull
        (feat["ret_60d"] > 0.02)
        & (feat["vol_20d"] < med_vol)
        & (feat["sharpe_20d"] > 0.05),
        # Bear
        (feat["ret_60d"] < -0.02)
        & (feat["vol_20d"] > med_vol)
        & (feat["sharpe_20d"] < -0.05),
    ]
    choices = [2, 0]
    labels = pd.Series(
        np.select(conditions, choices, default=1),
        index=feat.index,
        name="regime",
    )
    return labels


# ─────────────────────────────────────────────
# MODEL TRAINING
# ─────────────────────────────────────────────

def train_regime_model(
    feat: pd.DataFrame,
    labels: pd.Series,
    model_type: str = "random_forest",
) -> tuple:
    """
    เทรน Random Forest / Gradient Boosting ด้วย TimeSeriesSplit CV
    คืน (trained_pipeline, cv_scores, report_str)
    """
    X = feat.values
    y = labels.values

    if model_type == "gradient_boosting":
        clf = GradientBoostingClassifier(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            random_state=42,
        )
    else:  # random_forest (default)
        clf = RandomForestClassifier(
            n_estimators=300,
            max_depth=6,
            min_samples_leaf=10,
            max_features="sqrt",
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )

    pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("clf",    clf),
    ])

    # Time-series cross validation (ห้ามใช้ shuffle — preserve temporal order)
    tscv = TimeSeriesSplit(n_splits=5)
    cv_scores = cross_val_score(pipe, X, y, cv=tscv, scoring="f1_macro")

    # เทรนทั้งชุด
    pipe.fit(X, y)

    # Evaluation บน full training set
    y_pred = pipe.predict(X)
    report = classification_report(y, y_pred, target_names=["Bear", "Neutral", "Bull"])

    print(f"\n{'='*55}")
    print(f"  MARKET REGIME MODEL — {model_type.upper()}")
    print(f"{'='*55}")
    print(f"  TimeSeriesSplit CV F1-macro: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
    print(f"\n  Classification Report (in-sample):\n{report}")

    # Feature Importance
    if hasattr(pipe["clf"], "feature_importances_"):
        importances = pd.Series(
            pipe["clf"].feature_importances_,
            index=feat.columns,
        ).sort_values(ascending=False)
        print("  Feature Importance (Top 10):")
        print(importances.head(10).to_string())

    print(f"{'='*55}\n")

    return pipe, cv_scores, report


# ─────────────────────────────────────────────
# PREDICTION
# ─────────────────────────────────────────────

def predict_regime(
    pipe,
    feat: pd.DataFrame,
) -> pd.DataFrame:
    """
    ทำนายสภาวะตลาดและ probability แต่ละวัน
    คืน DataFrame ที่มีคอลัมน์: regime, regime_label, prob_bear, prob_neutral, prob_bull
    """
    proba = pipe.predict_proba(feat.values)
    pred  = pipe.predict(feat.values)

    result = pd.DataFrame({
        "regime":       pred,
        "regime_label": [REGIME_LABELS[r] for r in pred],
        "prob_bear":    proba[:, 0],
        "prob_neutral": proba[:, 1],
        "prob_bull":    proba[:, 2],
    }, index=feat.index)

    return result


# ─────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────

def run_regime(
    prices_csv: str = "output/prices_clean_thb.csv",
    model_type: str = "random_forest",
    save_model: bool = True,
) -> dict:
    """
    Entry point — โหลดข้อมูล, สร้าง features, เทรน, ทำนาย, export
    คืน dict ที่มี: current_regime, regime_history, model_performance
    """
    prices = pd.read_csv(prices_csv, index_col=0, parse_dates=True)

    # Features & Labels
    feat   = build_features(prices)
    labels = generate_labels(feat)

    # Label distribution
    dist = labels.value_counts().rename(REGIME_LABELS)
    print("Label distribution:\n", dist.to_string())

    # Train
    pipe, cv_scores, report = train_regime_model(feat, labels, model_type)

    # Predict full history
    predictions = predict_regime(pipe, feat)

    # Export
    predictions.to_csv(OUTPUT_DIR / "regime_predictions.csv")

    if save_model:
        model_path = OUTPUT_DIR / f"regime_model_{model_type}.pkl"
        joblib.dump(pipe, model_path)
        print(f"  โมเดลบันทึกที่: {model_path}")

    # Current regime (วันล่าสุด)
    latest = predictions.iloc[-1]
    print(f"\n  สภาวะตลาดล่าสุด ({predictions.index[-1].date()}): "
          f"{latest['regime_label']} "
          f"(Bull:{latest['prob_bull']:.1%} | Neutral:{latest['prob_neutral']:.1%} | Bear:{latest['prob_bear']:.1%})")

    return {
        "current_regime": {
            "date":          str(predictions.index[-1].date()),
            "regime":        int(latest["regime"]),
            "regime_label":  latest["regime_label"],
            "prob_bull":     round(float(latest["prob_bull"]), 4),
            "prob_neutral":  round(float(latest["prob_neutral"]), 4),
            "prob_bear":     round(float(latest["prob_bear"]), 4),
        },
        "regime_counts":     dist.to_dict(),
        "cv_f1_mean":        round(float(cv_scores.mean()), 4),
        "cv_f1_std":         round(float(cv_scores.std()), 4),
        "regime_history_csv": str(OUTPUT_DIR / "regime_predictions.csv"),
    }


if __name__ == "__main__":
    result = run_regime()
