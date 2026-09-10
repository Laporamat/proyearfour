"""
Data Pipeline & Clean Data — Quant Project
==========================================
สินทรัพย์ 25 ตัว:
  US Stocks (10) : AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, META, JNJ, V, JPM
  Thai Stocks (10): PTT.BK, AOT.BK, CPALL.BK, BDMS.BK, DELTA.BK,
                    GULF.BK, ADVANC.BK, SCB.BK, KBANK.BK, PTTEP.BK
  Bonds/Safe (5) : TLT, IEF, SHY, GLD, BIL

ขั้นตอน:
  1. ดึงราคา Adjusted Close จาก Yahoo Finance
  2. ดึงอัตราแลกเปลี่ยน USD/THB แบบ time-series (ไม่ใช่แค่ค่าเดียว)
  3. แปลง USD → THB เฉพาะหุ้น US + Bonds
  4. Forward Fill → Backward Fill เพื่อจัดการวันหยุดที่ไม่ตรงกัน
  5. Data Cleaning: ลบแถวที่ missing ทั้งหมด, ตรวจจับ outlier, validate
  6. Export ผลลัพธ์เป็น CSV + สรุป report
"""

import sys
import logging
import warnings
from pathlib import Path
from datetime import datetime

import pandas as pd
import numpy as np
import yfinance as yf

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
START_DATE = "2020-01-01"
END_DATE   = datetime.today().strftime("%Y-%m-%d")
OUTPUT_DIR = Path("output")

# 25 สินทรัพย์เป้าหมาย
US_STOCKS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA",
             "TSLA", "META", "JNJ", "V", "JPM"]

THAI_STOCKS = ["PTT.BK", "AOT.BK", "CPALL.BK", "BDMS.BK", "DELTA.BK",
               "GULF.BK", "ADVANC.BK", "SCB.BK", "KBANK.BK", "PTTEP.BK"]

BONDS = ["TLT", "IEF", "SHY", "GLD", "BIL"]

ALL_TICKERS   = US_STOCKS + THAI_STOCKS + BONDS
USD_TICKERS   = US_STOCKS + BONDS          # ตัวที่ต้องแปลง USD → THB
FX_TICKER     = "THB=X"                    # USD/THB จาก Yahoo Finance
FX_FALLBACK   = 35.0                       # ค่าสำรองถ้าดึง FX ไม่ได้

# Outlier threshold — ถ้า daily return เกิน ±50% ถือว่า suspect
OUTLIER_THRESHOLD = 0.50

# ─────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────
OUTPUT_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(OUTPUT_DIR / "pipeline.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# STEP 1: ดึงราคา Adjusted Close
# ─────────────────────────────────────────────
def fetch_prices(tickers: list[str], start: str, end: str) -> pd.DataFrame:
    log.info("STEP 1 — ดึงราคา Adjusted Close (%s → %s) จำนวน %d ตัว",
             start, end, len(tickers))
    
    # yfinance ≥ 0.2.x ใช้ auto_adjust=True แทน Adj Close โดยตรง
    raw = yf.download(
        tickers,
        start=start,
        end=end,
        auto_adjust=True,
        progress=False,
        threads=True,
    )

    # ดึงเฉพาะ Close (= Adj Close เมื่อ auto_adjust=True)
    if isinstance(raw.columns, pd.MultiIndex):
        prices = raw["Close"].copy()
    else:
        prices = raw[["Close"]].copy()
        prices.columns = tickers[:1]

    # ตรวจว่าได้ครบ 25 ตัวไหม
    missing_tickers = set(tickers) - set(prices.columns)
    if missing_tickers:
        log.warning("ไม่พบข้อมูลของ: %s", missing_tickers)
    else:
        log.info("ดึงข้อมูลครบทุกตัว ✓")

    log.info("Shape หลังดึง: %s", prices.shape)
    return prices


# ─────────────────────────────────────────────
# STEP 2: ดึง USD/THB time-series
# ─────────────────────────────────────────────
def fetch_fx_series(start: str, end: str) -> pd.Series:
    log.info("STEP 2 — ดึงอัตราแลกเปลี่ยน USD/THB (%s → %s)", start, end)
    try:
        fx_raw = yf.download(
            FX_TICKER,
            start=start,
            end=end,
            auto_adjust=True,
            progress=False,
        )
        if isinstance(fx_raw.columns, pd.MultiIndex):
            fx = fx_raw["Close"].squeeze()
        else:
            fx = fx_raw["Close"].squeeze()

        if fx.empty:
            raise ValueError("ดึง FX ได้ DataFrame ว่างเปล่า")

        # Forward-fill ช่องว่างของ FX (วันหยุด)
        fx = fx.ffill().bfill()
        log.info("ได้อัตราแลกเปลี่ยน %d วัน (ล่าสุด: %.4f THB/USD)",
                 len(fx), fx.iloc[-1])
        return fx

    except Exception as exc:
        log.warning("ดึง FX ไม่ได้ (%s) — ใช้ค่าสำรอง %.2f", exc, FX_FALLBACK)
        return pd.Series(dtype=float)   # คืน Series ว่าง → จะใช้ fallback


# ─────────────────────────────────────────────
# STEP 3: แปลง USD → THB
# ─────────────────────────────────────────────
def convert_usd_to_thb(prices: pd.DataFrame, fx: pd.Series) -> pd.DataFrame:
    log.info("STEP 3 — แปลง USD → THB สำหรับ %d ตัว", len(USD_TICKERS))
    df = prices.copy()

    if fx.empty:
        # ไม่มี time-series → ใช้ fallback constant
        log.warning("ใช้ FX fallback คงที่: %.2f THB/USD", FX_FALLBACK)
        for t in USD_TICKERS:
            if t in df.columns:
                df[t] = df[t] * FX_FALLBACK
    else:
        # align index: reindex FX ให้ตรงกับ index ของ prices แล้ว ffill
        fx_aligned = fx.reindex(df.index).ffill().bfill()
        if fx_aligned.isna().all():
            log.warning("FX ไม่สามารถ align ได้ — ใช้ค่าสำรอง %.2f", FX_FALLBACK)
            fx_aligned = fx_aligned.fillna(FX_FALLBACK)

        for t in USD_TICKERS:
            if t in df.columns:
                df[t] = df[t] * fx_aligned

    log.info("แปลงสกุลเงินเสร็จ ✓  (ทุกตัวอยู่ในหน่วย THB)")
    return df


# ─────────────────────────────────────────────
# STEP 4: จัดการ Missing Values
# ─────────────────────────────────────────────
def handle_missing(df: pd.DataFrame) -> pd.DataFrame:
    log.info("STEP 4 — จัดการ Missing Values")

    before = df.isna().sum().sum()
    log.info("  จำนวน NaN ก่อน fill: %d", before)

    # Forward Fill ก่อน (ใช้ราคาวันก่อนหน้า — เหมาะกับวันหยุดตลาด)
    df = df.ffill()

    # Backward Fill สำหรับช่วงต้น time-series ที่ยังไม่มีราคา
    df = df.bfill()

    after = df.isna().sum().sum()
    log.info("  จำนวน NaN หลัง fill:  %d", after)

    # ถ้า column ใด NaN ทั้งคอลัมน์ (สินทรัพย์ไม่มีข้อมูลเลย) → drop
    all_nan_cols = df.columns[df.isna().all()].tolist()
    if all_nan_cols:
        log.warning("  Drop columns ที่ไม่มีข้อมูลเลย: %s", all_nan_cols)
        df = df.drop(columns=all_nan_cols)

    return df


# ─────────────────────────────────────────────
# STEP 5: Data Cleaning — Outlier Detection
# ─────────────────────────────────────────────
def clean_data(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    log.info("STEP 5 — Data Cleaning & Outlier Detection")

    # คำนวณ daily return
    returns = df.pct_change()

    # หา cell ที่ return เกิน threshold
    outlier_mask = returns.abs() > OUTLIER_THRESHOLD
    n_outliers = outlier_mask.sum().sum()

    if n_outliers > 0:
        log.warning("  พบ outlier (|return| > %.0f%%): %d จุด",
                    OUTLIER_THRESHOLD * 100, n_outliers)

        # บันทึก outlier report ไว้ก่อน
        outlier_report = returns[outlier_mask].stack().reset_index()
        outlier_report.columns = ["Date", "Ticker", "Return"]
        outlier_report["Price"] = df.stack()[outlier_report.set_index(["Date","Ticker"]).index].values

        # แทนที่ค่า outlier ด้วย NaN แล้ว forward-fill ใหม่
        df_clean = df.copy()
        price_outlier_mask = outlier_mask.shift(1).fillna(False) | outlier_mask
        df_clean[price_outlier_mask] = np.nan
        df_clean = df_clean.ffill().bfill()
        log.info("  แทนที่ outlier ด้วย forward-fill ✓")
    else:
        log.info("  ไม่พบ outlier ✓")
        outlier_report = pd.DataFrame(columns=["Date", "Ticker", "Return", "Price"])
        df_clean = df.copy()

    # ลบแถวที่ว่างหมด (เช่น วันหยุดที่ทุกตลาดปิด)
    rows_before = len(df_clean)
    df_clean = df_clean.dropna(how="all")
    rows_dropped = rows_before - len(df_clean)
    if rows_dropped:
        log.info("  ลบ %d แถวที่ NaN ทั้งหมด", rows_dropped)

    # ตรวจสอบ negative prices (ไม่ควรเกิด)
    neg_mask = (df_clean < 0)
    n_neg = neg_mask.sum().sum()
    if n_neg > 0:
        log.warning("  พบราคาติดลบ %d จุด — แทนที่ด้วย NaN แล้ว ffill", n_neg)
        df_clean[neg_mask] = np.nan
        df_clean = df_clean.ffill().bfill()

    log.info("  Shape สุดท้าย: %s", df_clean.shape)
    return df_clean, outlier_report


# ─────────────────────────────────────────────
# STEP 6: Export & Summary Report
# ─────────────────────────────────────────────
def export_and_report(df: pd.DataFrame, outliers: pd.DataFrame) -> None:
    log.info("STEP 6 — Export ผลลัพธ์")

    # บันทึกราคา clean
    price_path = OUTPUT_DIR / "prices_clean_thb.csv"
    df.to_csv(price_path)
    log.info("  บันทึกราคา → %s", price_path)

    # บันทึก daily returns
    returns = df.pct_change().dropna(how="all")
    returns_path = OUTPUT_DIR / "daily_returns.csv"
    returns.to_csv(returns_path)
    log.info("  บันทึก daily returns → %s", returns_path)

    # บันทึก outlier report
    if not outliers.empty:
        outlier_path = OUTPUT_DIR / "outlier_report.csv"
        outliers.to_csv(outlier_path, index=False)
        log.info("  บันทึก outlier report → %s", outlier_path)

    # สรุป summary
    summary_lines = [
        "=" * 60,
        "PIPELINE SUMMARY REPORT",
        f"วันที่รัน : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"ช่วงข้อมูล: {START_DATE} → {END_DATE}",
        f"จำนวนสินทรัพย์: {len(df.columns)} ตัว",
        f"จำนวนวันซื้อขาย: {len(df)} วัน",
        f"จำนวน NaN คงเหลือ: {df.isna().sum().sum()} จุด",
        "",
        "สินทรัพย์ที่มีข้อมูล:",
    ]
    for category, tickers in [("US Stocks", US_STOCKS),
                               ("Thai Stocks", THAI_STOCKS),
                               ("Bonds/Safe", BONDS)]:
        present = [t for t in tickers if t in df.columns]
        summary_lines.append(f"  {category:15s}: {len(present)}/{len(tickers)}  {present}")

    summary_lines += [
        "",
        "ราคาล่าสุด (THB):",
        df.iloc[-1].to_string(),
        "",
        "สถิติพื้นฐาน Daily Return (%):",
        (returns * 100).describe().round(4).to_string(),
        "=" * 60,
    ]

    summary_text = "\n".join(summary_lines)
    summary_path = OUTPUT_DIR / "summary_report.txt"
    summary_path.write_text(summary_text, encoding="utf-8")
    log.info("  บันทึก summary → %s", summary_path)
    print("\n" + summary_text)


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def run_pipeline(start: str = START_DATE, end: str = END_DATE) -> pd.DataFrame:
    log.info("=" * 60)
    log.info("เริ่ม Data Pipeline  [%s → %s]", start, end)
    log.info("=" * 60)

    prices   = fetch_prices(ALL_TICKERS, start, end)
    fx       = fetch_fx_series(start, end)
    prices   = convert_usd_to_thb(prices, fx)
    prices   = handle_missing(prices)
    prices, outliers = clean_data(prices)
    export_and_report(prices, outliers)

    log.info("Pipeline เสร็จสมบูรณ์ ✓")
    return prices


if __name__ == "__main__":
    df = run_pipeline()
