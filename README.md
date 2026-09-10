# QuantAI Portfolio System

ระบบวิเคราะห์และจัดพอร์ตการลงทุนอัตโนมัติ — MPT Optimizer + Market Regime Classifier + AI Chat พร้อมกราฟ interactive

![stack](https://img.shields.io/badge/Python-3.12-blue) ![stack](https://img.shields.io/badge/FastAPI-0.111-green) ![stack](https://img.shields.io/badge/React-19-61dafb) ![stack](https://img.shields.io/badge/Vite-8-purple)

---

## ภาพรวม

```
┌─────────────────────────────────────────────────────┐
│                   Web UI  :5173                     │
│  ┌──────────────────────┐  ┌──────────────────────┐ │
│  │   Dashboard          │  │    AI Chat           │ │
│  │  • KPI (Sharpe/Ret)  │  │  • Function Calling  │ │
│  │  • Line Chart        │◄─│  • กราฟขยับอัตโนมัติ │ │
│  │  • Pie Chart         │  │  • Suggested prompts │ │
│  │  • Regime bars       │  └──────────────────────┘ │
│  └──────────────────────┘                           │
└───────────────────────┬─────────────────────────────┘
                        │ Vite proxy /api/* 
┌───────────────────────▼─────────────────────────────┐
│               FastAPI Backend  :8001                │
│  yh.py      → Data Pipeline  (25 assets, THB)      │
│  mpt.py     → MPT Optimizer  (Max Sharpe)           │
│  regime.py  → Random Forest  (Bull/Neutral/Bear)    │
│  main.py    → REST API + LLM Function Calling       │
└─────────────────────────────────────────────────────┘
```

---

## โครงสร้างโปรเจค

```
proyearfour/
├── .gitignore
├── README.md
│
├── backend/
│   ├── .env                    ← API keys (ห้าม commit)
│   ├── main.py                 ← FastAPI + LLM Function Calling
│   ├── yh.py                   ← Data Pipeline
│   ├── mpt.py                  ← MPT Optimizer
│   ├── regime.py               ← Market Regime Classifier
│   ├── requirements.txt
│   └── output/                 ← CSV + model (auto-generated)
│       ├── prices_clean_thb.csv
│       ├── daily_returns.csv
│       ├── optimal_portfolio.csv
│       ├── regime_predictions.csv
│       └── ...
│
└── frontend/
    ├── vite.config.js          ← proxy /api → :8001
    ├── package.json
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── index.css           ← design system (dark glassmorphism)
        ├── context/
        │   └── ChartContext.jsx ← global state (chat → charts)
        ├── hooks/
        │   └── useApi.js       ← fetch wrapper + safe JSON parser
        ├── components/
        │   ├── Layout.jsx / .module.css
        │   ├── StatCard.jsx / .module.css
        │   ├── RunButton.jsx / .module.css
        │   ├── PortfolioPieChart.jsx / .module.css
        │   └── ReturnsLineChart.jsx / .module.css
        └── pages/
            ├── Dashboard.jsx / .module.css
            └── Chat.jsx / .module.css
```

---

## สินทรัพย์ 25 ตัว (หน่วย THB)

| กลุ่ม | Tickers |
|---|---|
| 🇺🇸 US Stocks (10) | AAPL · MSFT · GOOGL · AMZN · NVDA · TSLA · META · JNJ · V · JPM |
| 🇹🇭 Thai Stocks (10) | PTT.BK · AOT.BK · CPALL.BK · BDMS.BK · DELTA.BK · GULF.BK · ADVANC.BK · SCB.BK · KBANK.BK · PTTEP.BK |
| 🏦 Bonds / Safe (5) | TLT · IEF · SHY · GLD · BIL |

---

## ติดตั้ง

### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend
```bash
cd backend
pip install -r requirements.txt
```

### Frontend
```bash
cd frontend
npm install
```

---

## ตั้งค่า

สร้างไฟล์ `backend/.env`:
```env
OPENAI_API_KEY=sk-...
```

> ถ้าไม่มี key ระบบ fallback เป็น rule-based อัตโนมัติ — ใช้งานได้ทันที

---

## รันระบบ

### ขั้นที่ 1 — สร้างข้อมูล (ครั้งแรก หรือเมื่อต้องการ update)

```bash
cd backend

python yh.py        # ดึงราคา + clean (ใช้เวลา ~30 วินาที)
python mpt.py       # คำนวณพอร์ต Max Sharpe
python regime.py    # เทรน Random Forest
```

### ขั้นที่ 2 — รัน Backend

```bash
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

Swagger UI → `http://127.0.0.1:8001/docs`

### ขั้นที่ 3 — รัน Frontend

```bash
cd frontend
npm run dev
```

เปิดเบราว์เซอร์ → `http://localhost:5173`

---

## API Endpoints

| Method | Path | หน้าที่ |
|---|---|---|
| `GET` | `/health` | สถานะ server + openai_sdk |
| `POST` | `/api/pipeline` | ดึงและ clean ข้อมูลราคา |
| `POST` | `/api/mpt` | รัน MPT optimizer |
| `POST` | `/api/regime` | รัน Market Regime classifier |
| `POST` | `/api/chat` | AI chat + Function Calling |
| `GET` | `/api/portfolio/latest` | พอร์ตล่าสุด |
| `GET` | `/api/regime/latest` | Regime + probability ล่าสุด |
| `GET` | `/api/prices?n=N` | ราคาล่าสุด N วัน |
| `GET` | `/api/returns-history?period=1y` | Cumulative return (6m / 1y / 3y / all) |

---

## AI Chat — วิธีทำงาน

### Mode 1: OpenAI Function Calling (ต้องมี API key)
LLM อ่านคำถามภาษาไทย → เลือก tool เองอัตโนมัติ → รัน → สรุปคำตอบ

### Mode 2: Rule-based Fallback (ไม่ต้องมี key)
| คำที่พูดถึง | Tool ที่เรียก |
|---|---|
| portfolio · sharpe · mpt · จัดพอร์ต | `optimize_portfolio` |
| bull · bear · regime · สภาวะ · ตลาด | `classify_market_regime` |
| price · ราคา · ล่าสุด · หุ้น | `get_latest_prices` |
| pipeline · อัพเดท · data | `run_data_pipeline` |

**กราฟขยับอัตโนมัติ** — ทุกครั้งที่ chat ได้รับ tool results → ChartContext dispatch → Pie + Line chart re-animate

---

## ผลลัพธ์จริง (ข้อมูล Jan 2020 – Sep 2026)

| ตัวชี้วัด | ค่า |
|---|---|
| Sharpe Ratio (Max Sharpe Portfolio) | **1.94** |
| Annualized Return | **31.3%** |
| Annualized Volatility | **15.1%** |
| Market Regime ล่าสุด | **Neutral (98.2%)** |
| CV F1-macro (Random Forest) | **0.9387** |
| ช่วงข้อมูล | 2020-01 → 2026-09 (1,739 วัน) |

### Top-5 Portfolio Weights (Max Sharpe)
| Ticker | น้ำหนัก | กลุ่ม |
|---|---|---|
| GLD | 21.87% | 🏦 Bond/Safe |
| SCB.BK | 20.04% | 🇹🇭 Thai |
| JNJ | 14.57% | 🇺🇸 US |
| NVDA | 13.61% | 🇺🇸 US |
| DELTA.BK | 11.31% | 🇹🇭 Thai |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Data | yfinance · pandas · numpy |
| Quant | scipy (SLSQP) · scikit-learn (Random Forest) |
| Backend | FastAPI · uvicorn · pydantic |
| LLM | OpenAI API (gpt-4o-mini) · Function Calling |
| Frontend | React 19 · Vite 8 · Recharts · React Router |
| Styling | CSS Modules · Dark glassmorphism |

---

## Notes

- **API Key**: อย่าแชร์ key ใน public repo — ไฟล์ `.env` อยู่ใน `.gitignore` แล้ว
- **Port**: Backend รันบน `127.0.0.1:8001` · Frontend proxy `/api/*` → backend อัตโนมัติ
- **Regime Bug**: prob_xxx เก็บเป็น fraction (0.002 = 0.2%) — frontend คูณ 100 ครั้งเดียว
