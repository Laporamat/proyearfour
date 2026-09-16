# QuantAI Portfolio System

ระบบวิเคราะห์และจัดพอร์ตการลงทุนอัตโนมัติ — **MPT Optimizer + Market Regime Classifier + AI Chat + Live Prices** พร้อม landing page และ Google login

![Python](https://img.shields.io/badge/Python-3.12-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green) ![React](https://img.shields.io/badge/React-19-61dafb) ![Vite](https://img.shields.io/badge/Vite-8-purple) ![MongoDB](https://img.shields.io/badge/MongoDB-7-47a248) ![Auth](https://img.shields.io/badge/Auth-Google_OAuth-ea4335)

---

## ✨ ฟีเจอร์ล่าสุด

- 🎨 **Clean minimal UI** — light theme, ตัวอักษร Geist, single blue accent, ไม่มี glow/gradient
- 🏠 **Landing page** ที่ `/` — hero, 6 features, 3-step how-it-works, stack strip, final CTA
- 🔐 **Google OAuth (จริง)** ผ่าน Emergent-managed Auth — session 7 วัน, httpOnly cookie, `ProtectedRoute` กันเข้าโดยไม่ล็อกอิน
- ⚡ **Live prices auto-fetch** — ยิงตรง Yahoo Finance ทุก 60 วิ ไม่ต้องกด Pipeline, มี Live badge + FX rate + 1D % change column
- 🚀 **Auto-bootstrap pipeline** — เมื่อ backend start จะ run pipeline + MPT + Regime ในพื้นหลังทีเดียว dashboard พร้อมใช้เอง
- 💬 **AI Chat with Function Calling** — คุยเป็นภาษาไทย, LLM เรียก tool เอง, กราฟขยับตาม tool results

---

## 🗺️ ภาพรวม

```
                            ┌────────────────────────────┐
                            │  Landing  /                │
                            │  Login    /login           │
                            └────────────┬───────────────┘
                                         ↓
                            🔐 Emergent Google OAuth
                                         ↓
┌────────────────────────────────────────────────────────┐
│                Protected — Layout                       │
│  ┌────────────────────┐  ┌────────────────────────┐    │
│  │   Dashboard        │  │   AI Chat              │    │
│  │  • Live badge      │  │  • Function Calling    │    │
│  │  • KPIs (Sharpe)   │◄─│  • Suggested prompts   │    │
│  │  • Pie + Line      │  │  • Auto-update charts  │    │
│  │  • Price table     │  └────────────────────────┘    │
│  │    (with 1D %)     │                                │
│  └────────────────────┘                                │
└────────────────────────┬───────────────────────────────┘
                         │ /api/* (same-origin fetch)
┌────────────────────────▼───────────────────────────────┐
│                FastAPI Backend  :8001                   │
│  auth.py    → Google OAuth session + cookies           │
│  live.py    → Live prices (Yahoo, TTL 60s) + bootstrap │
│  yh.py      → Data pipeline (25 assets → THB)          │
│  mpt.py     → MPT optimizer (Max Sharpe)               │
│  regime.py  → Random Forest classifier                 │
│  main.py    → REST + LLM Function Calling              │
│  server.py  → supervisor entrypoint (mounts modules)   │
└────────────────────────┬───────────────────────────────┘
                         │
                ┌────────▼────────┐
                │  MongoDB :27017 │
                │  users          │
                │  user_sessions  │
                └─────────────────┘
```

---

## 📁 โครงสร้างโปรเจกต์

```
proyearfour/
├── README.md
├── .gitignore
├── auth_testing.md              ← auth testing playbook
├── memory/
│   ├── PRD.md
│   └── test_credentials.md      ← demo cookie for local testing
│
├── backend/
│   ├── .env                     ← MONGO_URL, DB_NAME, OPENAI_*
│   ├── server.py                ← supervisor entrypoint (imports below)
│   ├── main.py                  ← FastAPI app + REST + LLM
│   ├── live.py                  ← Live prices + auto-bootstrap
│   ├── auth.py                  ← Google OAuth session mgmt
│   ├── yh.py                    ← Data pipeline
│   ├── mpt.py                   ← MPT optimizer
│   ├── regime.py                ← Market regime classifier
│   ├── requirements.txt
│   ├── tests/
│   │   └── test_auth.py         ← pytest coverage (8 tests)
│   └── output/                  ← CSV artifacts (auto-generated)
│
└── frontend/
    ├── .env                     ← REACT_APP_BACKEND_URL
    ├── vite.config.js           ← host 0.0.0.0:3000, /api proxy
    ├── package.json
    └── src/
        ├── App.jsx              ← Router + AuthProvider
        ├── main.jsx
        ├── index.css            ← design tokens (light theme, Geist)
        ├── context/
        │   ├── AuthContext.jsx  ← useAuth() + /me check
        │   └── ChartContext.jsx ← global chart state
        ├── hooks/
        │   └── useApi.js        ← fetch wrapper (credentials: include)
        ├── components/
        │   ├── Layout.jsx       ← sidebar + user chip + logout
        │   ├── ProtectedRoute.jsx
        │   ├── StatCard.jsx
        │   ├── RunButton.jsx
        │   ├── PortfolioPieChart.jsx
        │   ├── ReturnsLineChart.jsx
        │   └── PriceTable.jsx   ← now shows 1D % column
        └── pages/
            ├── Landing.jsx      ← public
            ├── Login.jsx        ← Google button
            ├── AuthCallback.jsx ← OAuth return handler
            ├── Dashboard.jsx    ← protected
            └── Chat.jsx         ← protected
```

---

## 💼 สินทรัพย์ 25 ตัว (แปลงเป็น THB อัตโนมัติ)

| กลุ่ม | Tickers |
|---|---|
| 🇺🇸 US Stocks (10) | AAPL · MSFT · GOOGL · AMZN · NVDA · TSLA · META · JNJ · V · JPM |
| 🇹🇭 Thai Stocks (10) | PTT.BK · AOT.BK · CPALL.BK · BDMS.BK · DELTA.BK · GULF.BK · ADVANC.BK · SCB.BK · KBANK.BK · PTTEP.BK |
| 🏦 Bonds / Safe (5) | TLT · IEF · SHY · GLD · BIL |

FX: `THB=X` (Yahoo) — ราคาสด, cache 60 s

---

## 🚀 ติดตั้ง & รัน

### Prerequisites
- Python 3.11+
- Node.js 18+ (แนะนำ 20)
- **MongoDB 7+** (สำหรับ auth session)
- Yarn: `npm install -g yarn`

### 1. Backend

```bash
cd backend

# venv (แนะนำ)
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate

pip install -r requirements.txt

# สร้าง .env
cat > .env <<'ENV'
MONGO_URL=mongodb://localhost:27017
DB_NAME=quantai
OPENAI_API_KEY=sk-...                # ทางเลือก — ถ้าไม่มีจะ fallback rule-based
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
ENV

# รัน
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

> Backend จะ auto-run pipeline + MPT + Regime ครั้งแรกในพื้นหลัง (~30 s)  
> Swagger UI → `http://localhost:8001/docs`

### 2. Frontend

```bash
cd frontend
yarn install

# .env
echo REACT_APP_BACKEND_URL=http://localhost:8001 > .env

yarn dev          # → http://localhost:3000
# หรือ yarn start (พอร์ต 3000, bind 0.0.0.0)
```

### 3. เข้าใช้งาน

- เปิด `http://localhost:3000` → Landing page
- คลิก **Sign in** → **Continue with Google**
- หลังยืนยันจะเด้งกลับ `/dashboard` (session 7 วัน)

---

## 🔐 Authentication

ใช้ **Emergent-managed Google OAuth** — ไม่ต้อง config OAuth client เอง

### Flow
1. Landing → คลิก "Sign in" → `/login`
2. Login → คลิก "Continue with Google"
3. Redirect ไป `https://auth.emergentagent.com/?redirect={origin}/dashboard`
4. Google auth เสร็จ → กลับมาที่ `/dashboard#session_id=xxx`
5. `AuthCallback` POST session_id → backend → รับ `session_token` (7 วัน)
6. Backend set httpOnly cookie + insert MongoDB session
7. Route ต่อไปทั้งหมด ProtectedRoute เช็คผ่าน `/api/auth/me`

### API
| Method | Path | หน้าที่ |
|---|---|---|
| `POST` | `/api/auth/session` | แลก session_id → session_token |
| `GET`  | `/api/auth/me` | คืน user JSON (cookie หรือ Bearer) |
| `POST` | `/api/auth/logout` | ลบ session + cookie |

### Test ท้องถิ่น (ข้าม Google จริง)
```bash
mongosh --eval "
use('quantai');
db.users.replaceOne({user_id:'user_demo'},{
  user_id:'user_demo', email:'demo@quantai.local', name:'Demo User',
  picture:'https://ui-avatars.com/api/?name=Demo+User&background=2f5bd6&color=fff',
  created_at:new Date(), last_login:new Date()
},{upsert:true});
db.user_sessions.insertOne({
  user_id:'user_demo', session_token:'demo_session_persistent',
  expires_at:new Date(Date.now()+7*24*60*60*1000), created_at:new Date()
});"
```
แล้ว set cookie `session_token=demo_session_persistent` ในเบราว์เซอร์

---

## 📡 API Endpoints

### Data & Portfolio
| Method | Path | หน้าที่ |
|---|---|---|
| `GET`  | `/health` | สถานะ server + openai_sdk |
| `GET`  | `/api/prices/live` | **NEW** ราคาสด + 1D % change + FX (cache 60 s) |
| `GET`  | `/api/prices?n=N` | ราคาย้อนหลัง N แถวจาก CSV |
| `POST` | `/api/pipeline` | manual re-run data pipeline |
| `POST` | `/api/mpt` | manual re-run MPT optimizer |
| `POST` | `/api/regime` | manual re-run regime classifier |
| `GET`  | `/api/portfolio/latest` | พอร์ตล่าสุด |
| `GET`  | `/api/regime/latest` | Regime + probability ล่าสุด |
| `GET`  | `/api/returns-history?period=1y` | Cumulative return (6m/1y/3y/all) |
| `POST` | `/api/chat` | AI chat + Function Calling |

### Auth (ดูหัวข้อด้านบน)

---

## 🤖 AI Chat — วิธีทำงาน

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

## 📊 ผลลัพธ์จริง (ข้อมูล Jan 2020 – Sep 2026)

| ตัวชี้วัด | ค่า | สูตรคำนวณ | 
|---|---|---|
| Sharpe Ratio (Max Sharpe Portfolio) | **1.94** | $\text{Sharpe} = \frac{R_p - R_f}{\sigma_p}$(ผลตอบแทนพอร์ต - อัตราดอกเบี้ยไร้ความเสี่ยง) / ความผันผวนพอร์ต |
| Annualized Return | **31.3%** |$\text{Ann. Return} = \left( 1 + R_{\text{total}} \right)^{\frac{365}{N}} - 1$(แปลงผลตอบแทนสะสมตลอดช่วงเวลาให้อยู่ในรูปอัตราต่อปี)|
| Annualized Volatility | **15.1%** | $\text{Ann. Volatility} = \sigma_{\text{daily}} \times \sqrt{252}$(ค่าเบี่ยงเบนมาตรฐานของผลตอบแทนรายวัน คูณด้วยรากที่สองของ 252 วันทำการ) |
| Market Regime ล่าสุด | **Neutral (96.2%)** | ประเมินผ่านโมเดลจำแนกประเภท (Classification Model) |
| CV F1-macro (Random Forest) | **0.94** | $\text{F1} = 2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}}$ และหาค่าเฉลี่ยข้ามคลาส |
| Live refresh latency | **< 10 s** (cached 60 s) | วัดเวลาตอบสนองของระบบ |
| ช่วงข้อมูล | 2020-01 → 2026-09 | ระยะเวลาข้อมูลย้อนหลัง (~1,700 วัน) |

### Top-5 Portfolio Weights (Max Sharpe)
## $$\text{Sharpe Ratio} = \frac{R_p - R_f}{\sigma_p}$$
| Ticker | น้ำหนัก | กลุ่ม |
|---|---|---|
| GLD | 21.9% | 🏦 Bond |
| SCB.BK | 20.1% | 🇹🇭 Thai |
| JNJ | 14.5% | 🇺🇸 US |
| NVDA | 13.6% | 🇺🇸 US |
| DELTA.BK | 11.3% | 🇹🇭 Thai |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Data | yfinance · pandas · numpy · curl_cffi |
| Quant | scipy (SLSQP) · scikit-learn (Random Forest) |
| Backend | FastAPI · uvicorn · pydantic · motor (async MongoDB) |
| Auth | Emergent-managed Google OAuth · httpx |
| LLM | OpenAI-compatible (gpt-4o-mini) · Function Calling |
| Storage | MongoDB (users + sessions) · CSV (prices + weights) |
| Frontend | React 19 · Vite 8 · Recharts · React Router 7 |
| Styling | CSS Modules · Geist font · light theme |
| Testing | pytest (backend) · Playwright (E2E) |

---

## 🧪 Testing

### Backend
```bash
cd backend && python -m pytest tests/ -v
# 8/8 auth tests pass
```

### Manual smoke
```bash
# Live prices
curl http://localhost:8001/api/prices/live | jq .

# Auth (needs seeded session)
curl -H "Cookie: session_token=demo_session_persistent" \
     http://localhost:8001/api/auth/me
```

---

## 📝 Notes

- **API Key**: `.env` อยู่ใน `.gitignore` — อย่า commit ขึ้น repo
- **Ports**: Backend `:8001` · Frontend `:3000` (dev) — same-origin ในการ deploy จริง (nginx / preview) เพื่อให้ cookies ทำงาน
- **Regime probs**: เก็บเป็น fraction (0.962 = 96.2%) — frontend คูณ 100 ครั้งเดียว
- **Live cache TTL**: 60 s — แก้ได้ที่ `backend/live.py` (`CACHE_TTL`)
- **Session TTL**: 7 วัน — แก้ได้ที่ `backend/auth.py` (`SESSION_TTL_DAYS`)
- **Deployment**: ใช้ `server:app` เป็น entrypoint (ไม่ใช่ `main:app`) เพราะ `server.py` ต้อง register `live` และ `auth` modules
- **Not investment advice** — ข้อมูลจาก Yahoo Finance อาจ delay 15 นาที
