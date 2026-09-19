# QuantAI Portfolio System

ระบบวิเคราะห์และจัดพอร์ตการลงทุนอัตโนมัติ — **MPT Optimizer + Market Regime Classifier + AI Chat + Live Prices** พร้อม landing page และ Google login

![Python](https://img.shields.io/badge/Python-3.12-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green) ![React](https://img.shields.io/badge/React-19-61dafb) ![Vite](https://img.shields.io/badge/Vite-8-purple) ![MongoDB](https://img.shields.io/badge/MongoDB-7-47a248) ![Auth](https://img.shields.io/badge/Auth-Google_OAuth-ea4335)

---

## ✨ ฟีเจอร์ล่าสุด

- 🎨 **Clean minimal UI** — light theme, ตัวอักษร Geist, single blue accent, ไม่มี glow/gradient
- 🏠 **Landing page** ที่ `/` — hero, 6 features, 3-step how-it-works, stack strip, final CTA
- 🔐 **Google OAuth (จริง)** ผ่าน Emergent-managed Auth — session 7 วัน, httpOnly cookie, `ProtectedRoute` กันเข้าโดยไม่ล็อกอิน
- ⚡ **Live prices auto-fetch** — ยิงตรง Yahoo Finance ทุก 60 วิ ไม่ต้องกด Pipeline, มี Live badge + FX rate + 1D % change column
- 📈 **Cumulative Return chart (ข้อมูลจริง)** — คิดผลตอบแทนแบบทบต้นจริง rebase เริ่มที่ 0% ณ ต้นช่วง เลือกช่วงได้ **1d · 1w · 1m · 3m · 6m · 1y · 3y · all**
- 🥧 **Portfolio Allocation (แผนภูมิแท่ง)** — bar chart เต็มความกว้าง ขนาดเท่ากับ Cumulative Return เรียงน้ำหนักมาก→น้อย + แถบ Sharpe/Return/Volatility
- 🔎 **KPI Detail Pages (ข้อมูลจริง)** — กดการ์ด KPI ทั้ง 4 ใบเปิดหน้า `/analysis/<metric>` แสดงกราฟจริง: Efficient Frontier + Monte Carlo 10,000 พอร์ต, การเติบโตสะสมเทียบ benchmark, Regime probability timeline และ Random Forest feature importance
- 📰 **ข่าวหุ้นรวมทั้งพอร์ต** — การ์ด "ข่าวล่าสุด" ใต้ AI Chat ดึงจาก Yahoo Finance (25 ตัว) รวม + dedupe + เรียงตามเวลา พร้อม thumbnail/แหล่งที่มา/ลิงก์
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
| `GET`  | `/api/returns-history?period=1y` | Cumulative return จริง (compounding, rebase 0%) — `1d`/`1w`/`1m`/`3m`/`6m`/`1y`/`3y`/`all` |
| `GET`  | `/api/news?limit=30` | **NEW** ข่าวรวมทั้งพอร์ต (Yahoo, dedupe + sort ตามเวลา, cache 10 นาที) |
| `GET`  | `/api/analysis/mpt` | **NEW** ข้อมูลหน้า KPI: Efficient Frontier + Monte Carlo + optimal + growth vs benchmark + weights |
| `GET`  | `/api/analysis/regime` | **NEW** ข้อมูลหน้า Regime: current probs + probability timeline + day distribution + RF feature importance |
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
- **Cumulative Return**: คำนวณจาก `daily_returns.csv` (decimal) แบบทบต้น `(1+r).cumprod()` แล้ว rebase ให้เริ่มที่ 0% ณ ต้นช่วง — ช่วงสั้น (1d–6m) เป็นจุดรายวัน, `1y` รายสัปดาห์, `3y`/`all` รายเดือน (ข้อมูล end-of-day, ไม่มี intraday)
- **Live cache TTL**: 60 s — แก้ได้ที่ `backend/live.py` (`CACHE_TTL`)
- **Session TTL**: 7 วัน — แก้ได้ที่ `backend/auth.py` (`SESSION_TTL_DAYS`)
- **Deployment**: ใช้ `server:app` เป็น entrypoint (ไม่ใช่ `main:app`) เพราะ `server.py` ต้อง register `live` และ `auth` modules
- **Not investment advice** — ข้อมูลจาก Yahoo Finance อาจ delay 15 นาที

---

## 🔧 Changelog (ล่าสุด 2026-09)

- แก้บั๊ก **Market Regime ไม่ขึ้นข้อมูล** — ต้นเหตุคือ dependency หาย (`cloudpickle`, `narwhals`, `threadpoolctl`) ทำให้ Random Forest classifier crash และไม่สร้าง `regime_predictions.csv`; ติดตั้งครบแล้ว regime ทำงานปกติ
- เพิ่ม **KPI Detail Pages** — กดการ์ด Sharpe/Return/Volatility/Regime เปิดหน้า `/analysis/<metric>` แสดงกราฟข้อมูลจริง (`backend/analysis.py` + `frontend/src/pages/MetricAnalysis.jsx`, StatCard คลิกได้ผ่าน prop `to`)
- ปรับ **Portfolio Allocation** เป็นแผนภูมิแท่งเต็มความกว้าง (ขนาดเท่า Cumulative Return) และย้าย **ข่าวล่าสุด** ไปใต้ AI Chat
- เพิ่มการ์ด **ข่าวล่าสุด** — รวมข่าวทั้ง 25 ตัวจาก Yahoo Finance, dedupe, เรียงตามเวลา (`backend/news.py` + `frontend/src/components/NewsFeed.jsx`)
- แก้บั๊ก **Cumulative Return** ที่หารด้วย 100 ซ้ำซ้อนจนค่าเพี้ยน → เปลี่ยนเป็นทบต้นจริง + rebase 0% ณ ต้นช่วง
- เพิ่มช่วงเวลา **1d / 1w / 1m / 3m / 6m / 1y / 3y / all** (เดิมมีแค่ 6m/1y/3y/all)
- ซ่อม dependency ของ `yfinance` ที่หายไป (`pytz`, `beautifulsoup4`, `multitasking`, `peewee`, `lxml`, `html5lib`) — pipeline ดึงข้อมูลจริงได้แล้ว

# 🚀 QuantAI Portfolio System
A Production-Ready Quantitative Investment & Asset Management Platform

---

## 🌟 ภาพรวมระบบ (System Overview)
**QuantAI Portfolio System** เป็นแพลตฟอร์มวิเคราะห์การลงทุนและพอร์ตสินทรัพย์ระดับโปรดักชัน ที่ผสานรวมเทคโนโลยี Frontend ทันสมัย (`React` + `Vite`) เข้ากับ Backend ประสิทธิภาพสูง (`FastAPI` + `MongoDB`) พร้อมขับเคลื่อนด้วยโมเดล Machine Learning & Quantitative Finance ที่ประมวลผลจากข้อมูลจริงแบบ Real-time ไม่มี Mock Data

---

## 🛠️ รายละเอียดสถาปัตยกรรมและฟีเจอร์

### 1. 🖥️ Frontend (`React` + `Vite`)
* **Cumulative Return Chart:** กราฟผลตอบแทนทบต้นคำนวณจากข้อมูลจริง Rebase ที่ $0\%$ ณ ต้นช่วง สามารถเลือกช่วงเวลาได้หลากหลาย ($1d, 1w, 1m, 3m, 6m, 1y, 3y, \text{all}$) พร้อมตัวเลือกแสดงหุ้นครบทั้ง $25$ ตัว ปุ่มเลือกทั้งหมด/ล้าง และตัวนับจำนวน
* **Portfolio Allocation:** แผนภูมิแท่งเต็มความกว้าง ดีไซน์สมมาตรกับกราฟผลตอบแทน พร้อมแถบสรุปค่า Sharpe, Return และ Volatility
* **KPI Detail Pages:** หน้าวิเคราะห์เชิงลึกสำหรับการ์ด KPI ทั้ง $4$ ใบ (กดเข้าผ่าน `/analysis/<metric>`) แสดงกราฟข้อมูลจริง เช่น Efficient Frontier, Monte Carlo Simulation, Growth vs Benchmark, Regime Timeline และ Feature Importance
* **Live News Feed:** การ์ดข่าวหุ้นล่าสุดใต้ AI Chat พร้อม Thumbnail, แหล่งที่มา และเวลาแสดงผลภาษาไทย
* **Real-time Engine:** ระบบราคาอัตโนมัติ (Live Prices Auto-refresh ทุก $60$ วินาที) พร้อม FX Badge, ตารางราคา และ AI Chat Panel
* **Security & UI:** หน้า Landing Page, ระบบ Google Login, ProtectedRoute และธีม Minimal โทนสีฟ้าสะอาดตา

### 2. ⚙️ Backend (`FastAPI` + `MongoDB`)
* **API Endpoints ครบครัน:** รองรับ `/api/pipeline`, `/api/mpt`, `/api/regime`, `/api/portfolio/latest`, `/api/regime/latest`, `/api/returns-history`, `/api/prices/live`, `/api/news`, `/api/analysis/mpt` และ `/api/analysis/regime`
* **AI Chat with Function Calling:** ระบบผู้ช่วยอัจฉริยะที่ให้ LLM สามารถเรียกใช้เครื่องมือ (Tools) ในระบบได้ด้วยตัวเอง
* **Auto-bootstrap:** เริ่มต้นระบบเซิร์ฟเวอร์พร้อมรัน Data Pipeline, MPT และ Regime ทันทีโดยอัตโนมัติ
* **Dependency Stability:** แก้ไขปัญหาการติดตั้งระบบพึ่งพา (yfinance stack, ML stack เช่น `cloudpickle`, `narwhals`, `threadpoolctl`) เพื่อความเสถียรสูงสุดในการดึงข้อมูลจริง
* **Authentication:** ระบบ Emergent Google OAuth (Session อายุ $7$ วัน พร้อม HTTP-Only Cookie)

### 3. 🤖 Machine Learning & Quant Engine
* **Data Pipeline (`yh.py`):** ดึงข้อมูลราคาหุ้น US, หุ้นไทย (`.BK`) และพันธบัตร รวม $25$ สินทรัพย์จาก Yahoo Finance แปลงค่าเงินเป็น THB และทำ Data Cleaning จนได้ Daily Returns จริง
* **MPT Optimizer (`mpt.py`):** คำนวณ Max-Sharpe Portfolio, Efficient Frontier และจำลอง Monte Carlo Simulation กว่า $10,000$ พอร์ต (ให้ผลลัพธ์เด่น: Sharpe $1.93$, Return $31\%$, Volatility $15\%$)
* **Market Regime Classifier (`regime.py`):** โมเดล Random Forest วิเคราะห์จาก $11$ ฟีเจอร์หลัก (Momentum, Volatility, Breadth, RSI ฯลฯ) ทำการทดสอบด้วย TimeSeriesSplit CV ได้ค่า F1 Score สูงถึง $0.93$ ทำนายภาวะตลาด Bull / Neutral / Bear รายวัน (สถานะล่าสุด: Neutral $93.6\%$)

---

## ✅ สถานะการดำเนินงาน (Status)
* **Testing:** ผ่านการทดสอบโดย Testing Agent เต็มรูปแบบ $100\%$ ทั้งในส่วนของ Backend และ Frontend ในรอบล่าสุด
* **Data Integrity:** ข้อมูลทั้งหมดเป็น **ข้อมูลจริง (Real Data)** จากตลาดการเงิน ไม่มีข้อมูลจำลอง (No Mock Data)

---

## 📋 แผนงานในอนาคต (Backlog)
รายการฟีเจอร์เสริมที่เตรียมพัฒนาต่อในเฟสถัดไป:
* **Group Filter:** ตัวกรองแยกกลุ่มสินทรัพย์ (US / Thai / Bond) บนกราฟ Return
* **Benchmark Overlay:** แสดงเส้นพอร์ตรวมทับลงบนกราฟรายตัว
* **Model Card:** เพิ่มการแสดง Confusion Matrix สำหรับหน้า Market Regime
* **Advanced MPT:** เปรียบเทียบพอร์ต Min-Vol / Max-Return บน Efficient Frontier
* **PDF Export:** ฟังก์ชันส่งออกหน้าวิเคราะห์รายงานเป็นไฟล์ PDF


# 📈 Quantitative Portfolio Engine & Market Regime Framework

แพลตฟอร์มวิเคราะห์การลงทุนเชิงปริมาณ (Quant Platform) แบบครบวงจร ครอบคลุมตั้งแต่นำเข้าข้อมูลจริง, คำนวณ MPT Portfolio Optimization, วิเคราะห์สภาวะตลาดด้วย ML Engine ไปจนถึงระบบผู้ช่วยอัจฉริยะ (AI Chat Tool Calling)

---

## ✅ Completed Features (Phase 1 Delivered)

### 🖥️ Frontend Stack (`React` + `Vite`)
- [x] **Cumulative Return Chart**: กราฟผลตอบแทนทบต้นคำนวณจากข้อมูลจริง Rebase ที่ $0\%$ ณ ต้นช่วง ปรับช่วงเวลาได้ ($1d$ ถึง $\text{all}$) พร้อม Toggle เลือกหุ้น 25 ตัวครบถ้วน
- [x] **Portfolio Allocation**: แผนภูมิแท่งเต็มความกว้าง แสดงสัดส่วนการลงทุนพร้อม แถบสรุปค่า Sharpe, Return และ Volatility
- [x] **KPI Detail Pages**: หน้าวิเคราะห์เชิงลึกสำหรับ KPI Cards ผ่าน Route `/analysis/<metric>` (Efficient Frontier, Monte Carlo Simulation, Growth vs Benchmark, Regime Timeline, Feature Importance)
- [x] **Live News Feed & Price Engine**: ข่าวหุ้นล่าสุดและราคา Real-time Auto-refresh ทุก 60 วินาที พร้อม FX Badge และตารางราคา
- [x] **Security & UI Core**: หน้า Landing Page, ระบบ Google Login, ProtectedRoute ในดีไซน์ Minimal โทนสีฟ้า

### ⚙️ Backend & Infrastructure (`FastAPI` + `MongoDB`)
- [x] **RESTful APIs**: รองรับ Endpoints ครบถ้วน (`/api/pipeline`, `/api/mpt`, `/api/regime`, `/api/returns-history`, `/api/news` ฯลฯ)
- [x] **AI Chat with Function Calling**: ระบบผู้ช่วยอัจฉริยะที่ LLM สามารถเรียกใช้เครื่องมือวิเคราะห์ภายในระบบได้ด้วยตนเอง
- [x] **Auto-bootstrap & Dependency Management**: เริ่มต้นเซิร์ฟเวอร์พร้อมรัน Data Pipeline/MPT/Regime โดยอัตโนมัติ พร้อมแก้ปัญหา Dependency Stack (`yfinance`, ML libs)
- [x] **Authentication**: ระบบ Emergent Google OAuth พร้อม Session 7 วัน ผ่าน HTTP-Only Cookie

### 🤖 Machine Learning & Quant Engine
- [x] **Data Pipeline (`yh.py`)**: ดึงและทำความสะอาดข้อมูล US Stocks, Thai Stocks (`.BK`) และ Bonds รวม 25 สินทรัพย์ แปลงสกุลเงินเป็น THB
- [x] **MPT Optimizer (`mpt.py`)**: คำนวณ Max-Sharpe Portfolio, Efficient Frontier และ Monte Carlo Simulation กว่า 10,000 พอร์ต (Sharpe $1.93$, Return $31\%$, Volatility $15\%$)
- [x] **Market Regime Classifier (`regime.py`)**: โมเดล Random Forest วิเคราะห์ 11 ฟีเจอร์หลัก (RSI, Momentum, Volatility) ประเมินผ่าน TimeSeriesSplit CV ได้ F1 Score $0.93$ (สถานะปัจจุบัน: Neutral $93.6\%$)

---

## 🚀 Product Roadmap & Backlog

### 📌 Phase 2: High Priority (UX/UI & Advanced Optimization)

| Status | Task | Category | Description |
| :---: | :--- | :---: | :--- |
| 🔲 | **Group Asset Filter** | `Frontend` | เพิ่มตัวกรองแยกกลุ่มสินทรัพย์ (US Stocks / Thai Stocks / Bonds) บน Return Chart |
| 🔲 | **Benchmark Overlay & Comparison** | `Frontend` | แสดงเส้นพอร์ตรวมทับกราฟรายตัว พร้อมตัวเลือกเทียบกับ Index จริง (S&P 500, SET50) |
| 🔲 | **Interactive Frontier Inspector** | `Frontend` | คลิก/Hover จุดบนเส้น Efficient Frontier เพื่อดู Weight Allocation ณ จุดนั้นทันที |
| 🔲 | **Advanced MPT Extensions** | `Quant Engine` | คำนวณและเปรียบเทียบพอร์ต Min-Vol vs Max-Return vs Max-Sharpe บน Efficient Frontier |
| 🔲 | **Server-side PDF Export Engine** | `Reporting` | พัฒนาระบบ Generate PDF Report ความละเอียดสูง (รวมตารางพอร์ต, กราฟ, Risk Metrics และ AI Summary) |

### 🔬 Phase 3: Medium Priority (ML Interpretability & Backtesting)

#### 🤖 Machine Learning & Explainability
- [ ] **Regime Model Card**: แสดง Confusion Matrix, Classification Report (Precision, Recall, F1) และ ROC-AUC Curve บน UI
- [ ] **Explainable AI (XAI) via SHAP**: ส่งค่า SHAP Values ของ Top Features รายวัน ให้ AI Chat ช่วยอธิบายเหตุผลเบื้องหลังการทำนายสภาวะตลาด
- [ ] **Concept Drift Detection**: ตรวจจับพฤติกรรมราคาที่เปลี่ยนไปจาก Training Set เพื่อแจ้งเตือนการ Retrain โมเดล

#### 📊 Backtesting Engine
- [ ] **Out-of-Sample Walk-Forward Backtest**: ระบบทดสอบพอร์ตย้อนหลังแบบ Walk-Forward (เช่น Train 3 ปี / Test 6 เดือน) เพื่อป้องกัน Look-ahead Bias
- [ ] **Transaction Cost & Friction Models**: รวมค่าธรรมเนียมการซื้อขาย (Fees), Slippage และต้นทุน FX (USD/THB) เข้าในการคำนวณ Return จริง

### 🛡️ Phase 4: Long-term / Institutional Grade (Risk & Advanced Analytics)

> #### 📉 Downside Risk & Stress Testing
> * **Institutional Risk Metrics**: คำนวณ Value at Risk (VaR 95%/99%), Conditional VaR (CVaR / Expected Shortfall), Max Drawdown (MDD) และ Drawdown Duration
> * **Scenario Analysis**: จำลองผลกระทบพอร์ตเทียบกับวิกฤตการณ์ในอดีต (เช่น 2020 COVID Drop, 2022 Fed Rate Hike)

> #### 🧬 Advanced Portfolio Engineering
> * **Black-Litterman Model**: รวมมุมมองตลาด (User Views / AI Signals) เข้ากับ Equilibrium Return
> * **Hierarchical Risk Parity (HRP)**: จัดกลุ่มสินทรัพย์และกระจายความเสี่ยงด้วย Machine Learning Clustering
