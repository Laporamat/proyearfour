"""
FastAPI Backend — Quant AI Assistant
======================================
Endpoints:
  GET  /health                  — health check
  POST /api/pipeline            — รัน data pipeline (yh.py)
  POST /api/mpt                 — รัน MPT optimizer
  POST /api/regime              — รัน Market Regime classifier
  POST /api/chat                — LLM chat พร้อม Function Calling
  GET  /api/portfolio/latest    — ดึง optimal portfolio ล่าสุด
  GET  /api/regime/latest       — ดึงสภาวะตลาดล่าสุด
  GET  /api/prices              — ดึงราคาล่าสุด N แถว

LLM Function Calling:
  LLM (OpenAI-compatible) จะ parse คำถามผู้ใช้ แล้วเรียก tool ที่ถูกต้องโดยอัตโนมัติ
  รองรับ: OpenAI, Azure OpenAI, Ollama (openai-compatible)
"""

import os
import json
import uuid
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Any

import pandas as pd
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# โหลด .env ถ้ามี (ไม่ต้องติดตั้ง python-dotenv — อ่านไฟล์เอง)
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    for _line in _env_path.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

# ─── optional LLM client (OpenAI SDK) ───
try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

OUTPUT_DIR = Path("output")

app = FastAPI(
    title="Quant AI Assistant",
    description="MPT Portfolio Optimizer + Market Regime Classifier พร้อม LLM Function Calling",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# PYDANTIC SCHEMAS
# ─────────────────────────────────────────────

class PipelineRequest(BaseModel):
    start_date: str = Field("2020-01-01", description="วันเริ่มต้น YYYY-MM-DD")
    end_date:   str = Field(
        default_factory=lambda: datetime.today().strftime("%Y-%m-%d"),
        description="วันสิ้นสุด"
    )

class MPTRequest(BaseModel):
    objective:     str   = Field("max_sharpe", description="max_sharpe | min_vol | max_return")
    top_n:         int | None = Field(None, description="เลือกเฉพาะ top N สินทรัพย์ (None = ทั้งหมด)")
    returns_csv:   str   = Field("output/daily_returns.csv")

class RegimeRequest(BaseModel):
    model_config = {"protected_namespaces": ()}
    model_type:  str  = Field("random_forest", description="random_forest | gradient_boosting")
    prices_csv:  str  = Field("output/prices_clean_thb.csv")
    save_model:  bool = Field(True)

class ChatRequest(BaseModel):
    model_config = {"protected_namespaces": ()}
    message:     str  = Field(...,  min_length=1, max_length=4000, description="ข้อความจากผู้ใช้")
    model:       str  = Field("gpt-4o-mini", description="ชื่อ LLM model")
    api_key:     str | None = Field(None, description="OpenAI API key (ถ้าไม่ใส่ ใช้ ENV)")
    base_url:    str | None = Field(None, description="base_url สำหรับ Ollama หรือ Azure")
    history:     list[dict] = Field(default_factory=list, description="ประวัติการสนทนา")

class ChatResponse(BaseModel):
    reply:        str
    tool_calls:   list[dict] = []
    tool_results: list[dict] = []


# ─────────────────────────────────────────────
# LLM TOOL DEFINITIONS (Function Calling)
# ─────────────────────────────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "run_data_pipeline",
            "description": (
                "ดึงข้อมูลราคาหุ้น US, Thai, Bonds จาก Yahoo Finance "
                "แปลงเป็น THB และทำ data cleaning ก่อนการวิเคราะห์"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": "วันเริ่มต้น รูปแบบ YYYY-MM-DD เช่น 2020-01-01",
                    },
                    "end_date": {
                        "type": "string",
                        "description": "วันสิ้นสุด รูปแบบ YYYY-MM-DD",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "optimize_portfolio",
            "description": (
                "คำนวณพอร์ตการลงทุนที่เหมาะสมที่สุดด้วย Modern Portfolio Theory (MPT) "
                "หา Sharpe Ratio สูงสุด หรือ Volatility ต่ำสุด หรือ Return สูงสุด "
                "พร้อม Efficient Frontier และ Monte Carlo Simulation"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "objective": {
                        "type": "string",
                        "enum": ["max_sharpe", "min_vol", "max_return"],
                        "description": "เป้าหมายการ optimize",
                    },
                    "top_n": {
                        "type": "integer",
                        "description": "จำนวนสินทรัพย์ที่ต้องการใช้ (เลือก top N จาก Sharpe สูงสุด)",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "classify_market_regime",
            "description": (
                "วิเคราะห์และจำแนกสภาวะตลาดปัจจุบัน (Bull/Bear/Neutral) "
                "ด้วย Random Forest โดยใช้ข้อมูลย้อนหลัง"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "model_type": {
                        "type": "string",
                        "enum": ["random_forest", "gradient_boosting"],
                        "description": "ประเภทโมเดล ML ที่ต้องการใช้",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "portfolio_summaryget_",
            "description": "ดึงผลการคำนวณพอร์ตล่าสุด (น้ำหนักสินทรัพย์, Sharpe, Return, Volatility)",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_regime_summary",
            "description": "ดึงสภาวะตลาดล่าสุดพร้อม probability (Bull/Neutral/Bear)",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
        {
        "type": "function",
        "function": {
            "name": "get_live_quotes",
            "description": "ดึงราคาสดล่าสุด (THB) และ % เปลี่ยนแปลง 1 วันของสินทรัพย์ 25 ตัว พร้อมอัตรา FX บาท/ดอลลาร์",
            "parameters": {
                "type": "object",
                "properties": {
                    "tickers": {
                        "type": "array", "items": {"type": "string"},
                        "description": "รายชื่อ ticker ที่ต้องการ เช่น ['AAPL','PTT.BK'] (ว่าง = ทั้งหมด)",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_stock_news",
            "description": "ดึงข่าวล่าสุดจาก Yahoo Finance ของหุ้นในระบบ หรือของ ticker ที่ระบุ",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticker": {"type": "string", "description": "ticker เช่น NVDA (ว่าง = ข่าวรวมทุกตัว)"},
                    "limit": {"type": "integer", "description": "จำนวนข่าวสูงสุด (default 8)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_latest_prices",
            "description": "ดึงราคาสินทรัพย์ล่าสุด (หน่วย THB) พร้อม daily return",
            "parameters": {
                "type": "object",
                "properties": {
                    "n_rows": {
                        "type": "integer",
                        "description": "จำนวนวันย้อนหลังที่ต้องการดู (default 5)",
                    },
                },
                "required": [],
            },
        },
    },
]

SYSTEM_PROMPT = (
    "คุณคือ Quantix AI ผู้ช่วยด้านการลงทุนในแอป Quantix Portfolio System ตอบเป็นภาษาไทยเสมอ "
    "(ถ้าผู้ใช้พิมพ์ภาษาอื่นให้ตอบภาษานั้น) กระชับ ชัดเจน ใช้ markdown ได้ (ห้ามใช้ LaTeX ให้เขียนสูตรเป็นข้อความธรรมดา)\n"
    "ขอบเขต: ตอบได้ทุกคำถามที่เกี่ยวกับการลงทุนและการเงิน เช่น หุ้นไทย/ต่างประเทศ กองทุน ETF พันธบัตร ทองคำ คริปโต "
    "เศรษฐกิจมหภาค ดอกเบี้ย ภาษีการลงทุน การวางแผนการเงิน การวิเคราะห์ปัจจัยพื้นฐาน/เทคนิค ความเสี่ยง "
    "ทฤษฎีพอร์ต (MPT, Sharpe) และวิธีใช้ฟีเจอร์ในแอปนี้\n"
    "ถ้าคำถามไม่เกี่ยวกับการลงทุนหรือการเงิน ให้ปฏิเสธอย่างสุภาพสั้นๆ ว่าตอบได้เฉพาะเรื่องการลงทุน "
    "แล้วเสนอตัวอย่างคำถามด้านการลงทุน 2-3 ข้อ — ห้ามตอบเนื้อหานอกขอบเขต\n"
    "ข้อมูลในระบบ: สินทรัพย์ 25 ตัว (หุ้น US, หุ้นไทย .BK, ETF พันธบัตร, ทองคำ) ราคาเป็นบาท "
    "เมื่อคำถามเกี่ยวกับพอร์ต ราคา สภาวะตลาด หรือข่าว ให้เรียก tools เพื่อใช้ข้อมูลจริงก่อนตอบ "
    "(ใช้ get_live_quotes / get_portfolio_summary / get_regime_summary / get_stock_news ก่อนเสมอ "
    "ห้ามเรียก run_data_pipeline, optimize_portfolio หรือ classify_market_regime เว้นแต่ผู้ใช้ขอให้อัปเดตข้อมูล/คำนวณใหม่ชัดเจน) "
    "ถ้าไม่มีข้อมูลใน tools ให้ตอบจากความรู้ทั่วไปและบอกว่าข้อมูลอาจไม่เป็นปัจจุบัน ห้ามแต่งตัวเลข\n"
    "เมื่อให้คำแนะนำการลงทุน ให้ลงท้ายสั้นๆ ว่าเป็นข้อมูลเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน"
)

# ─────────────────────────────────────────────
# TOOL EXECUTION
# ─────────────────────────────────────────────

async def execute_tool(name: str, args: dict) -> dict:
    """dispatch tool calls → quant modules"""

    if name == "run_data_pipeline":
        from yh import run_pipeline
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: run_pipeline(
                start=args.get("start_date", "2020-01-01"),
                end=args.get("end_date", datetime.today().strftime("%Y-%m-%d")),
            )
        )
        return {
            "status": "success",
            "rows": len(result),
            "assets": len(result.columns),
            "message": f"ดึงข้อมูลสำเร็จ {len(result.columns)} สินทรัพย์ {len(result)} วัน",
        }

    elif name == "optimize_portfolio":
        from mpt import run_mpt
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: run_mpt(
                objective=args.get("objective", "max_sharpe"),
                top_n=args.get("top_n"),
            )
        )
        opt = result["optimal_portfolio"]
        top5 = sorted(opt["weights"].items(), key=lambda x: -x[1])[:5]
        return {
            "status":                "success",
            "objective":             opt["objective"],
            "sharpe_ratio":          round(float(opt["sharpe_ratio"]), 4),
            "annualized_return":     round(float(opt["annualized_return"]), 4),
            "annualized_volatility": round(float(opt["annualized_volatility"]), 4),
            "top5_weights":          {t: round(w * 100, 4) for t, w in top5},
            "all_weights":           {t: round(w, 6) for t, w in opt["weights"].items()},
            "monte_carlo_best_sharpe": result["monte_carlo_summary"]["best_sharpe_mc"],
        }

    elif name == "classify_market_regime":
        from regime import run_regime
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: run_regime(model_type=args.get("model_type", "random_forest"))
        )
        curr = result["current_regime"]
        return {
            "status":       "success",
            "date":         curr["date"],
            "regime":       curr["regime_label"],
            "prob_bull":    round(float(curr["prob_bull"]), 4),
            "prob_neutral": round(float(curr["prob_neutral"]), 4),
            "prob_bear":    round(float(curr["prob_bear"]), 4),
            "cv_f1":        result["cv_f1_mean"],
        }

    elif name == "get_portfolio_summary":
        csv = OUTPUT_DIR / "optimal_portfolio.csv"
        if not csv.exists():
            return {"status": "error", "message": "ยังไม่มีข้อมูล กรุณารัน optimize_portfolio ก่อน"}
        df = pd.read_csv(csv)
        row = df.iloc[0].to_dict()
        # parse weights — CSV stored dict with numpy wrappers like {'AAPL': np.float64(0.1)}
        import re
        raw = row.get("weights", "") or ""
        weights = {t: float(v) for t, v in re.findall(r"'([^']+)':\s*(?:np\.float64\()?(-?[\d.]+)", raw)}
        top5 = sorted(weights.items(), key=lambda x: -x[1])[:5]
        return {
            "sharpe_ratio":          round(float(row.get("sharpe_ratio", 0)), 4),
            "annualized_return":     round(float(row.get("annualized_return", 0)), 4),
            "annualized_volatility": round(float(row.get("annualized_volatility", 0)), 4),
            "top5_weights":          {t: round(w * 100, 4) for t, w in top5},
            "all_weights":           {t: round(w, 6) for t, w in list(weights.items())},
        }

    elif name == "get_regime_summary":
        csv = OUTPUT_DIR / "regime_predictions.csv"
        if not csv.exists():
            return {"status": "error", "message": "ยังไม่มีข้อมูล กรุณารัน classify_market_regime ก่อน"}
        df = pd.read_csv(csv, index_col=0, parse_dates=True)
        latest = df.iloc[-1]
        return {
            "date":         str(df.index[-1].date()),
            "regime":       latest["regime_label"],
            "prob_bull":    round(float(latest["prob_bull"]), 4),
            "prob_neutral": round(float(latest["prob_neutral"]), 4),
            "prob_bear":    round(float(latest["prob_bear"]), 4),
        }

    elif name == "get_latest_prices":
        csv = OUTPUT_DIR / "prices_clean_thb.csv"
        if not csv.exists():
            return {"status": "error", "message": "ยังไม่มีข้อมูล กรุณารัน data pipeline ก่อน"}
        n = int(args.get("n_rows", 5))
        df = pd.read_csv(csv, index_col=0, parse_dates=True)
        latest = df.tail(n).round(2)
        return {
            "date_range": f"{latest.index[0].date()} → {latest.index[-1].date()}",
            "prices":     latest.iloc[-1].to_dict(),
        }
    elif name == "get_live_quotes":
        from live import get_live_snapshot
        snap = await get_live_snapshot()
        want = {t.upper() for t in (args.get("tickers") or [])}
        keep = lambda d: {k: v for k, v in d.items() if not want or k in want}  # noqa: E731
        return {
            "date": snap.get("date"), "status": snap.get("status"),
            "fx_thb_per_usd": snap.get("fx_thb_per_usd"),
            "prices_thb": keep(snap.get("prices", {})),
            "change_1d_pct": keep(snap.get("changes", {})),
        }

    elif name == "get_stock_news":
        limit = int(args.get("limit") or 8)
        ticker = (args.get("ticker") or "").upper().strip()
        if ticker:
            from news import _fetch_search
            items = await asyncio.get_running_loop().run_in_executor(None, _fetch_search, ticker)
        else:
            from news import get_news
            items = await get_news()
        return {"news": [{k: n.get(k) for k in ("ticker", "title", "publisher", "published", "url")} for n in items[:limit]]}

    else:
        return {"status": "error", "message": f"ไม่รู้จัก tool: {name}"}

# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "openai_sdk": OPENAI_AVAILABLE,
        "output_files": [f.name for f in OUTPUT_DIR.glob("*.csv")] if OUTPUT_DIR.exists() else [],
    }


@app.post("/api/pipeline")
async def api_pipeline(req: PipelineRequest, bg: BackgroundTasks):
    """รัน data pipeline — ดึงราคาและ clean data"""
    try:
        result = await execute_tool("run_data_pipeline", req.model_dump())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/mpt")
async def api_mpt(req: MPTRequest):
    """รัน MPT optimizer"""
    try:
        result = await execute_tool("optimize_portfolio", req.model_dump())
        return result
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="ไม่พบไฟล์ daily_returns.csv — กรุณารัน /api/pipeline ก่อน"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/regime")
async def api_regime(req: RegimeRequest):
    """รัน Market Regime classifier"""
    try:
        result = await execute_tool("classify_market_regime", req.model_dump())
        return result
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="ไม่พบไฟล์ prices_clean_thb.csv — กรุณารัน /api/pipeline ก่อน"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/portfolio/latest")
async def api_portfolio_latest():
    return await execute_tool("get_portfolio_summary", {})


@app.get("/api/regime/latest")
async def api_regime_latest():
    return await execute_tool("get_regime_summary", {})


@app.get("/api/prices")
async def api_prices(n: int = 5):
    return await execute_tool("get_latest_prices", {"n_rows": n})


@app.get("/api/returns-history")
async def api_returns_history(period: str = "1y"):
    """
    คืน cumulative return (%) จริง (rebased เป็น 0% ณ ต้นช่วง) สำหรับ line chart
    period: '1d' | '1w' | '1m' | '3m' | '6m' | '1y' | '3y' | 'all'
    ข้อมูลเป็น end-of-day ต่อวัน — คำนวณด้วย compounding จาก daily returns จริง
    """
    csv = OUTPUT_DIR / "daily_returns.csv"
    if not csv.exists():
        raise HTTPException(
            status_code=404,
            detail="ไม่พบ daily_returns.csv — กรุณารัน /api/pipeline ก่อน"
        )

    df = pd.read_csv(csv, index_col=0, parse_dates=True).sort_index()

    # ใช้ได้ทุกตัว (เลือกแสดงฝั่ง frontend) — เรียงชื่อให้คงที่
    df = df.reindex(sorted(df.columns), axis=1)
    all_tickers = list(df.columns)

    # daily_returns.csv เก็บเป็น decimal (0.01 = 1%) — guard เผื่อเก็บเป็น %
    if not df.empty and df.abs().mean().mean() > 1:
        df = df / 100

    if df.empty:
        return {"period": period, "tickers": [], "data": []}

    # กรองช่วงเวลา (อ้างอิงจากวันข้อมูลล่าสุด ไม่ใช่ today เพื่อไม่ให้ช่วงว่าง)
    now = df.index.max()
    cutoff_map = {
        "1d":  now - pd.Timedelta(days=1),
        "1w":  now - pd.Timedelta(weeks=1),
        "1m":  now - pd.DateOffset(months=1),
        "3m":  now - pd.DateOffset(months=3),
        "6m":  now - pd.DateOffset(months=6),
        "1y":  now - pd.DateOffset(years=1),
        "3y":  now - pd.DateOffset(years=3),
        "all": df.index.min(),
    }
    cutoff = cutoff_map.get(period, cutoff_map["1y"])
    sliced = df[df.index >= cutoff]
    if len(sliced) < 2:
        sliced = df.tail(2)

    # cumulative return จริงด้วย compounding แล้ว rebase ให้เริ่มที่ 0% ณ ต้นช่วง
    # (rebase แต่ละคอลัมน์จากค่าแรกที่ valid — รองรับหุ้นที่เริ่มมีข้อมูลทีหลัง)
    growth = (1 + sliced).cumprod()
    base = {c: growth[c].loc[growth[c].first_valid_index()]
            for c in growth.columns if growth[c].first_valid_index() is not None}
    cum = (growth.div(pd.Series(base), axis=1) - 1) * 100

    # ลดจำนวนจุดให้กราฟอ่านง่าย ตามความยาวของช่วง
    gran = {
        "1d": "D", "1w": "D", "1m": "D", "3m": "D", "6m": "D",
        "1y": "W", "3y": "ME", "all": "ME",
    }.get(period, "W")
    if gran != "D":
        cum = cum.resample(gran).last().dropna(how="all")

    fmt = "%b %y" if gran == "ME" else "%d %b"
    labels = cum.index.strftime(fmt)

    records = []
    for lbl, (_, row) in zip(labels, cum.iterrows()):
        entry = {"date": lbl}
        entry.update({k: round(float(v), 2) for k, v in row.items() if pd.notna(v)})
        records.append(entry)

    return {"period": period, "tickers": all_tickers, "data": records}


@app.post("/api/chat", response_model=ChatResponse)
async def api_chat(req: ChatRequest, request: Request):
    """
    LLM chat endpoint พร้อม Function Calling
    - ถ้ามี EMERGENT_LLM_KEY → ใช้ LLM จริง
    - ถ้าไม่มี หรือ LLM error → fallback rule-based keyword matching
    """
    from auth import _current_user
    if not await _current_user(request):
        raise HTTPException(status_code=401, detail="กรุณาเข้าสู่ระบบก่อนใช้ AI Chat")
    tool_calls_log:  list[dict] = []
    tool_results_log: list[dict] = []

    # ── Path A: OpenAI Function Calling ──────────────────────────────
    if os.environ.get("EMERGENT_LLM_KEY"):
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            history = [
                {"role": h["role"], "content": str(h.get("content", ""))}
                for h in req.history[-10:]
                if h.get("role") in ("user", "assistant") and h.get("content")
            ]
            chat = LlmChat(
                api_key=os.environ["EMERGENT_LLM_KEY"],
                session_id=f"chat-{uuid.uuid4().hex}",
                system_message=SYSTEM_PROMPT,
                initial_messages=[{"role": "system", "content": SYSTEM_PROMPT}, *history],
            ).with_model("openai", os.environ["LLM_MODEL"]).with_tools(TOOLS, tool_choice="auto")

            resp = await chat.send_message_with_tools(UserMessage(text=req.message))
            
           # วนลูปจัดการ Tool Calls (สูงสุด 5 รอบ เผื่อโมเดลเรียกต่อเนื่อง)
            for _ in range(5):
                if not resp.tool_calls:
                    break
                for tc in resp.tool_calls:
                    args = tc.arguments or {}
                    result = None
                    
                    # ตรวจสอบว่าเคยเรียก Tool ตัวนี้ด้วย Args นี้ไปแล้วหรือยัง (Cache ผลลัพธ์เดิม)
                    for prev_call, prev_res in zip(tool_calls_log, tool_results_log):
                        if prev_call["tool"] == tc.name and prev_call["args"] == args:
                            result = prev_res["result"]
                    
                    if result is None:
                        tool_calls_log.append({"tool": tc.name, "args": args})
                        try:
                            result = await execute_tool(tc.name, args)
                        except Exception as tool_err:  # noqa: BLE001
                            result = {"status": "error", "message": str(tool_err)}
                        tool_results_log.append({"tool": tc.name, "result": result})
                    
                    chat.add_tool_result(tc.id, json.dumps(result, ensure_ascii=False, default=str))
                # ส่งผลลัพธ์ Tool กลับไปให้ LLM ประมวลผลต่อ
                resp = await chat.send_message_with_tools()

            # เมื่อจัดการ Tool ครบหรือไม่มี Tool แล้ว ให้ส่งคำตอบกลับไปหา Client
            return ChatResponse(
                reply=resp.content or "ขออภัยครับ ตอนนี้ยังสรุปคำตอบไม่ได้ ลองถามใหม่อีกครั้ง",
                tool_calls=tool_calls_log,
                tool_results=tool_results_log
            )

        except Exception as llm_err:
            import logging
            logging.warning("LLM error → rule-based fallback: %s", llm_err)
            tool_calls_log, tool_results_log = [], []
            # (ถ้ามี Rule-based fallback ต่อ ให้เขียนโค้ดต่อตรงนี้ หรือส่ง Response เปล่ากลับไป)
    # ── Path B: Rule-based fallback ──────────────────────────────────
    msg_lower = req.message.lower()
    reply_parts: list[str] = []
    keywords_map = {
        ("portfolio", "mpt", "sharpe", "weight", "allocat",
         "\u0e1e\u0e2d\u0e23\u0e4c\u0e15",
         "\u0e19\u0e49\u0e33\u0e2b\u0e19\u0e31\u0e01"): "get_portfolio_summary",
        ("regime", "bull", "bear", "neutral", "market",
         "\u0e2a\u0e20\u0e32\u0e27\u0e30",
         "\u0e15\u0e25\u0e32\u0e14"): "get_regime_summary",
        ("price", "latest", "\u0e23\u0e32\u0e04\u0e32",
         "\u0e25\u0e48\u0e32\u0e2a\u0e38\u0e14",
         "\u0e2b\u0e38\u0e49\u0e19"): "get_live_quotes",
    }
    matched_tools: list[str] = []
    for keywords, tool_name in keywords_map.items():
        if any(k in msg_lower for k in keywords):
            matched_tools.append(tool_name)

    if matched_tools:
        for tool_name in matched_tools:
            result = await execute_tool(tool_name, {})
            tool_calls_log.append({"tool": tool_name, "args": {}})
            tool_results_log.append({"tool": tool_name, "result": result})
            reply_parts.append(
                f"**{tool_name}**: {json.dumps(result, ensure_ascii=False, indent=2)}"
            )
        reply = "⚠️ AI ไม่พร้อมใช้งานชั่วคราว — แสดงข้อมูลจากระบบแทน (ดูรายละเอียดในการ์ดด้านล่าง)"
    else:
        reply = (
            "สวัสดีครับ! ผมเป็น Quant AI Assistant ช่วยได้เรื่อง:\n"
            "- 📊 ดึงและอัพเดทข้อมูลราคาหุ้น\n"
            "- 💼 จัดพอร์ตด้วย MPT / หา Sharpe Ratio สูงสุด\n"
            "- 📈 วิเคราะห์สภาวะตลาด (Bull/Bear/Neutral)\n"
            "- 💰 ดูราคาหุ้นล่าสุด\n\n"
            "ลองถามว่า: 'จัดพอร์ตให้หน่อย' หรือ 'ตลาดตอนนี้เป็นยังไง'"
        )

    return ChatResponse(reply=reply,
                        tool_calls=tool_calls_log,
                        tool_results=tool_results_log)


# ─────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
