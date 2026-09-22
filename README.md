# Quantix Portfolio System

ระบบวิเคราะห์และจัดพอร์ตการลงทุนอัตโนมัติ — **MPT Optimizer + Market Regime Classifier + AI Chat + Live Prices + My Portfolio + Watchlist**

![Python](https://img.shields.io/badge/Python-3.12-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.141-green) ![React](https://img.shields.io/badge/React-19-61dafb) ![Vite](https://img.shields.io/badge/Vite-8-purple) ![MongoDB](https://img.shields.io/badge/MongoDB-7-47a248) ![Auth](https://img.shields.io/badge/Auth-Google_OAuth-ea4335)

---

## 📑 สารบัญ

- [✨ ฟีเจอร์ทั้งหมด](#-ฟีเจอร์ทั้งหมด)
- [🗺️ ภาพรวมระบบ](#️-ภาพรวมระบบ)
- [📁 โครงสร้างโปรเจกต์](#-โครงสร้างโปรเจกต์)
- [💼 สินทรัพย์ 25 ตัว](#-สินทรัพย์-25-ตัว)
- [🚀 ติดตั้ง & รัน](#-ติดตั้ง--รัน)
- [🔐 Authentication](#-authentication)
- [📡 API Endpoints](#-api-endpoints)
- [🤖 AI Chat](#-ai-chat)
- [📊 ผลลัพธ์จริง](#-ผลลัพธ์จริง)
- [🛠 Tech Stack](#-tech-stack)
- [🧪 Testing](#-testing)
- [🛣️ Roadmap — แผนอนาคต](#️-roadmap--แผนอนาคต)
- [📝 Notes](#-notes)

---

## ✨ ฟีเจอร์ทั้งหมด

### 🏠 หน้าสาธารณะ

- **Landing page** ที่ `/` — hero, 6 features, 3-step how-it-works, stack strip, final CTA
- **Login** ที่ `/login` — Google OAuth หรืออีเมล/รหัสผ่าน
- **Register** ที่ `/register` — สมัครด้วยอีเมล + ยืนยัน OTP 6 หลัก
- **Forgot/Reset Password** — รีเซ็ตรหัสผ่านทางอีเมล (Resend)

### 📊 Dashboard (`/dashboard`)

- **Live badge** — สถานะ Live/Stale + FX rate ฿/$ + วันที่ข้อมูล
- **4 KPI Cards** — Sharpe Ratio, Annual Return, Volatility, Market Regime (กดได้ → เปิดหน้าวิเคราะห์)
- **Cumulative Return chart** — ผลตอบแทนสะสมจริง (compounding, rebase 0%) เลือกช่วง 1d·1w·1m·3m·6m·1y·3y·all และเลือกหุ้นได้ทุกตัว (25 ตัว)
- **Portfolio Allocation** — bar chart เรียงน้ำหนักมาก→น้อย + แถบ Sharpe/Return/Volatility
- **Regime card** — แถบความน่าจะเป็น Bull/Neutral/Bear
- **Price Table** — ราคาสด 25 ตัว + 1D % change + flash สีเมื่อราคาเปลี่ยน + ค้นหา/กรองตามกลุ่ม
- **AI Chat** (embedded) — คุยกับ AI ในแดชบอร์ด กราฟขยับตามคำตอบ
- **News Feed** — ข่าวหุ้นรวม 25 ตัวจาก Yahoo Finance พร้อม thumbnail/แหล่งที่มา/ลิงก์

### 💬 AI Chat (`/chat`)

- **Function Calling** — LLM เรียก tool เอง (pipeline, MPT, regime, prices)
- **Rule-based fallback** — ไม่ต้องมี API key ก็ใช้ได้ (จับคำสำคัญ → เรียก tool)
- **Suggested prompts** — 6 คำถามแนะนำ
- **Tool result cards** — แสดงผล tool call แบบ collapsible
- **Auto-update charts** — กราฟใน Dashboard ขยับอัตโนมัติตาม tool results

### 🔎 KPI Detail Pages (`/analysis/:metric`)

- **Sharpe Ratio** — Efficient Frontier + Monte Carlo 10,000 พอร์ต + การเติบโตสะสมเทียบ benchmark + น้ำหนักสินทรัพย์
- **Annual Return** — กราฟการเติบโตสะสมของพอร์ต Max-Sharpe
- **Volatility** — ตำแหน่งพอร์ตบน Efficient Frontier (มุมซ้ายบน = ดีสุด)
- **Market Regime** — ความน่าจะเป็นตามเวลา + จำนวนวันในแต่ละสภาวะ + Random Forest feature importance

### 💼 My Portfolio (`/portfolio`)

- **เพิ่มหุ้นที่ซื้อ** — เลือกจาก 25 ตัว + จำนวนหุ้น + วันที่ซื้อ → ระบบดึงราคาปิดของวันนั้นให้อัตโนมัติ (แปลงเป็น THB)
- **ตาราง P/L** — ราคาซื้อ, ราคาปัจจุบัน (live), มูลค่า, กำไร/ขาดทุน (฿ + %) เปลี่ยนสีเขียว/แดง
- **สรุปยอดรวม** — ต้นทุนรวม, มูลค่าปัจจุบัน, กำไร/ขาดทุนรวม, ผลตอบแทนรวม %
- **เทียบพอร์ต vs MPT** — เปรียบเทียบสัดส่วนพอร์ตจริงของคุณกับพอร์ตที่ MPT แนะนำ พร้อมแผนภูมิเทียบข้างกัน
- **บันทึกใน localStorage** — ไม่หายเมื่อรีเฟรช
- **Auto-refresh** — ดึงราคา live ทุก 60 วิ

### 👁️ Watchlist (`/watchlist`)

- **เพิ่มหุ้นที่สนใจ** — เลือกจาก 25 ตัว + ตั้งราคาเป้าหมาย + หมายเหตุ
- **ตารางติดตาม** — ราคาปัจจุบัน, ราคาเป้าหมาย, ห่างจากเป้า (%), สถานะ 🎯 ถึงเป้าแล้ว
- **บันทึกใน localStorage** — ไม่หายเมื่อรีเฟรช
- **Auto-refresh** — ดึงราคา live ทุก 60 วิ

### ⚙️ ฟีเจอร์เบื้องหลัง

- **Auto-bootstrap pipeline** — backend start แล้ว run pipeline + MPT + Regime ในพื้นหลังทีเดียว
- **Live prices auto-fetch** — ยิงตรง Yahoo Finance ทุก 60 วิ ไม่ต้องกด Pipeline
- **FX conversion** — แปลงหุ้น US เป็น THB ด้วยอัตราแลกเปลี่ยนสด (THB=X)
- **Historical price lookup** — ดึงราคาหุ้นย้อนหลังในวันที่กำหนด สำหรับ My Portfolio

---

## 🗺️ ภาพรวมระบบ

```
                              ┌────────────────────────────┐
                              │  Landing  /                │
                              │  Login    /login           │
                              │  Register /register        │
                              └────────────┬───────────────┘
                                           ↓
                              🔐 Google OAuth / Email+OTP
                                           ↓
┌──────────────────────────────────────────────────────────────┐
│                    Protected — Layout (sidebar)               │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │Dashboard │  │ AI Chat  │  │  My      │  │Watchlist │       │
│  │·KPIs     │  │·Function│  │Portfolio │  │·Target   │       │
│  │·Charts   │  │ Calling  │  │·P/L live │  │ prices   │       │
│  │·Prices   │  │·Auto-    │  │·vs MPT  │  │·Status   │       │
│  │·News     │  │ update   │  │ compare  │  │          │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  KPI Detail Pages  /analysis/:metric                  │    │
│  │  Efficient Frontier · Monte Carlo · Regime Timeline  │    │
│  └──────────────────────────────────────────────────────┘    │
└────────────────────────┬─────────────────────────────────────┘
                         │ /api/* (Vite proxy → same-origin)
┌────────────────────────▼─────────────────────────────────────┐
│                  FastAPI Backend  :8001                       │
│  server.py    → supervisor (mounts all modules)              │
│  main.py      → REST + LLM Function Calling                  │
│  live.py      → Live prices (Yahoo, TTL 60s) + bootstrap     │
│  auth.py      → Google OAuth + Email/OTP + session mgmt      │
│  yh.py        → Data pipeline (25 assets → THB)              │
│  mpt.py       → MPT optimizer (Max Sharpe / Min Vol)         │
│  regime.py    → Random Forest classifier (Bull/Bear/Neutral) │
│  analysis.py  → Efficient Frontier + Monte Carlo data        │
│  news.py      → Aggregated portfolio news (Yahoo)            │
│  myportfolio.py → Historical price at date (THB)             │
│  mailer.py    → Resend email (OTP + password reset)          │
└────────────────────────┬─────────────────────────────────────┘
                         │
                ┌────────▼────────┐
                │  MongoDB :27017  │
                │  users           │
                │  user_sessions   │
                │  email_otps      │
                │  password_reset  │
                └─────────────────┘
```

---

## 📁 โครงสร้างโปรเจกต์

```
proyearfour/
├── README.md
├── AGENTS.md                    ← Base44 dev notes
├── auth_testing.md              ← auth testing playbook
├── docker-compose.base44.yml    ← Docker Compose (dev)
├── backend.Dockerfile           ← Backend image (deps only)
├── .base44/environment.json     ← Base44 metadata
├── memory/
│   ├── PRD.md
│   └── test_credentials.md
│
├── backend/
│   ├── server.py                ← supervisor entrypoint
│   ├── main.py                  ← FastAPI app + REST + LLM
│   ├── live.py                  ← Live prices + auto-bootstrap
│   ├── auth.py                  ← Google OAuth + Email/OTP
│   ├── yh.py                    ← Data pipeline (25 assets)
│   ├── mpt.py                   ← MPT optimizer
│   ├── regime.py                ← Market regime classifier
│   ├── analysis.py              ← KPI detail page data
│   ├── news.py                  ← Portfolio news aggregator
│   ├── myportfolio.py           ← Historical price lookup
│   ├── mailer.py                ← Resend email integration
│   ├── requirements.txt
│   ├── tests/
│   │   └── test_auth.py
│   └── output/                  ← CSV artifacts (auto-generated)
│
└── frontend/
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
        │   └── useApi.js        ← fetch wrapper + API helpers
        ├── components/
        │   ├── Layout.jsx       ← sidebar + nav + user chip
        │   ├── ProtectedRoute.jsx
        │   ├── StatCard.jsx
        │   ├── RunButton.jsx
        │   ├── PortfolioPieChart.jsx
        │   ├── ReturnsLineChart.jsx
        │   ├── PriceTable.jsx
        │   ├── NewsFeed.jsx
        │   └── PortfolioComparison.jsx  ← My Portfolio vs MPT
        └── pages/
            ├── Landing.jsx
            ├── Login.jsx
            ├── Register.jsx
            ├── AuthCallback.jsx
            ├── PasswordFlow.jsx
            ├── Dashboard.jsx
            ├── Chat.jsx
            ├── MetricAnalysis.jsx
            ├── MyPortfolio.jsx
            └── Watchlist.jsx
```

---

## 💼 สินทรัพย์ 25 ตัว (แปลงเป็น THB อัตโนมัติ)

| กลุ่ม | Tickers |
|---|---|
| 🇺🇸 US Stocks (10) | AAPL · MSFT · GOOGL · AMZN · NVDA · TSLA · META · JNJ · V · JPM |
| 🇹🇭 Thai Stocks (10) | PTT.BK · AOT.BK · CPALL.BK · BDMS.BK · DELTA.BK · GULF.BK · ADVANC.BK · SCB.BK · KBANK.BK · PTTEP.BK |
| 🏦 Bonds / Safe (5) | TLT · IEF · SHY · GLD · BIL |

FX: `THB=X` (Yahoo) — ราคาสด, cache 60 วินาที

---

## 🚀 ติดตั้ง & รัน

### วิธีที่ 1: Docker Compose (แนะนำ)

```bash
# สร้างและรันทุก service (MongoDB + Backend + Frontend)
docker compose -f docker-compose.base44.yml up -d --build

# ตรวจสอบสถานะ
docker compose -f docker-compose.base44.yml ps

# ดู logs
docker compose -f docker-compose.base44.yml logs -f backend
docker compose -f docker-compose.base44.yml logs -f frontend
```

เปิด `http://localhost:3000` → Landing page

### วิธีที่ 2: รันแยกส่วน (Manual)

#### Prerequisites
- Python 3.12+
- Node.js 22+
- MongoDB 7+

#### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# สร้าง .env
cat > .env <<'ENV'
MONGO_URL=mongodb://localhost:27017
DB_NAME=quantai
OPENAI_API_KEY=sk-...          # ทางเลือก
OPENAI_MODEL=gpt-4o-mini
ENV

uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

> Backend จะ auto-run pipeline + MPT + Regime ครั้งแรกในพื้นหลัง (~30 วินาที)
> Swagger UI → `http://localhost:8001/docs`

#### Frontend

```bash
cd frontend
npm install
npm run dev          # → http://localhost:3000
```

#### เข้าใช้งาน

- เปิด `http://localhost:3000` → Landing page
- คลิก **Sign in** → **Continue with Google** หรือสมัครด้วยอีเมล
- หลังยืนยันจะเด้งไป `/dashboard` (session 7 วัน)

---

## 🔐 Authentication

รองรับ 2 วิธี:

### 1. Google OAuth (Emergent-managed)
1. Login → คลิก "Continue with Google"
2. Redirect ไป `https://auth.emergentagent.com/?redirect={origin}/dashboard`
3. Google auth เสร็จ → กลับมาที่ `/dashboard#session_id=xxx`
4. `AuthCallback` POST session_id → backend → รับ `session_token` (7 วัน)
5. Backend set httpOnly cookie + insert MongoDB session

### 2. Email + Password + OTP
1. Register → กรอกชื่อ/อีเมล/รหัสผ่าน
2. รับ OTP 6 หลักทางอีเมล (Resend)
3. ยืนยัน OTP → ล็อกอินอัตโนมัติ
4. ลืมรหัสผ่าน → รีเซ็ตทางอีเมล

### Auth API
| Method | Path | หน้าที่ |
|---|---|---|
| `POST` | `/api/auth/session` | แลก session_id → session_token (Google) |
| `POST` | `/api/auth/register` | สมัครอีเมล + ส่ง OTP |
| `POST` | `/api/auth/verify-otp` | ยืนยัน OTP → ล็อกอิน |
| `POST` | `/api/auth/resend-otp` | ส่ง OTP ใหม่ |
| `POST` | `/api/auth/login` | ล็อกอินด้วยอีเมล/รหัสผ่าน |
| `POST` | `/api/auth/forgot-password` | ขอรีเซ็ตรหัสผ่าน |
| `POST` | `/api/auth/reset-password` | ตั้งรหัสผ่านใหม่ |
| `GET`  | `/api/auth/me` | ตรวจสอบ session ปัจจุบัน |
| `POST` | `/api/auth/logout` | ออกจากระบบ |

---

## 📡 API Endpoints

### Data & Portfolio
| Method | Path | หน้าที่ |
|---|---|---|
| `GET`  | `/health` | สถานะ server + output files |
| `GET`  | `/api/prices/live` | ราคาสด + 1D % change + FX (cache 60s) |
| `GET`  | `/api/prices?n=N` | ราคาย้อนหลัง N แถวจาก CSV |
| `GET`  | `/api/price/at?ticker=X&date=YYYY-MM-DD` | ราคาปิดของหุ้นในวันที่กำหนด (THB) |
| `POST` | `/api/pipeline` | manual re-run data pipeline |
| `POST` | `/api/mpt` | manual re-run MPT optimizer |
| `POST` | `/api/regime` | manual re-run regime classifier |
| `GET`  | `/api/portfolio/latest` | พอร์ตล่าสุด (weights, Sharpe, Return, Vol) |
| `GET`  | `/api/regime/latest` | Regime + probability ล่าสุด |
| `GET`  | `/api/returns-history?period=1y` | Cumulative return จริง — `1d`/`1w`/`1m`/`3m`/`6m`/`1y`/`3y`/`all` |
| `GET`  | `/api/news?limit=30` | ข่าวรวมทั้งพอร์ต (Yahoo, dedupe, cache 10 นาที) |
| `GET`  | `/api/analysis/mpt` | Efficient Frontier + Monte Carlo + optimal + growth + weights |
| `GET`  | `/api/analysis/regime` | Regime probs timeline + distribution + feature importance |
| `POST` | `/api/chat` | AI chat + Function Calling |

---

## 🤖 AI Chat

### Mode 1: OpenAI Function Calling (ต้องมี API key)
LLM อ่านคำถามภาษาไทย → เลือก tool เองอัตโนมัติ → รัน → สรุปคำตอบ

### Mode 2: Rule-based Fallback (ไม่ต้องมี key)
| คำที่พูดถึง | Tool ที่เรียก |
|---|---|
| portfolio · sharpe · mpt · จัดพอร์ต | `optimize_portfolio` |
| bull · bear · regime · สภาวะ · ตลาด | `classify_market_regime` |
| price · ราคา · ล่าสุด · หุ้น | `get_latest_prices` |
| pipeline · อัพเดท · data | `run_data_pipeline` |

กราฟขยับอัตโนมัติ — ทุกครั้งที่ chat ได้รับ tool results → ChartContext dispatch → charts re-animate

---

## 📊 ผลลัพธ์จริง (ข้อมูล Jan 2020 – Present)

| ตัวชี้วัด | ค่า | สูตร |
|---|---|---|
| Sharpe Ratio (Max Sharpe) | **1.94** | (ผลตอบแทนพอร์ต − อัตราดอกเบี้ยไร้ความเสี่ยง) ÷ ความผันผวนพอร์ต |
| Annualized Return | **31.3%** | (1 + ผลตอบแทนสะสม)^(365/N) − 1 |
| Annualized Volatility | **15.1%** | ส่วนเบี่ยงเบนมาตรฐานรายวัน × √252 |
| Market Regime ล่าสุด | **Neutral (96.2%)** | Random Forest classification |
| CV F1-macro (Random Forest) | **0.94** | ค่าเฉลี่ย F1 ข้ามคลาส (5-fold CV) |
| Live refresh latency | **< 10s** (cached 60s) | วัดเวลาตอบสนอง |
| ช่วงข้อมูล | 2020-01 → Present | ~1,700 วันทำการ |

### Top-5 Portfolio Weights (Max Sharpe)
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
| Auth | Emergent Google OAuth · bcrypt · httpx |
| Email | Resend (OTP + password reset) |
| LLM | OpenAI-compatible (gpt-4o-mini) · Function Calling |
| Storage | MongoDB (users + sessions) · CSV (prices + weights) |
| Frontend | React 19 · Vite 8 · Recharts · React Router 7 |
| Styling | CSS Modules · Geist font · light theme |
| Testing | pytest (backend) |
| DevOps | Docker Compose · Base44 |

---

## 🧪 Testing

### Backend
```bash
cd backend && python -m pytest tests/ -v
# 8/8 auth tests pass
```

### Manual smoke
```bash
# Health check
curl http://localhost:8001/health | jq .

# Live prices
curl http://localhost:8001/api/prices/live | jq .

# Historical price
curl "http://localhost:8001/api/price/at?ticker=AAPL&date=2024-01-15" | jq .

# Auth (needs seeded session)
curl -H "Cookie: session_token=demo_session_persistent" \
     http://localhost:8001/api/auth/me
```

---

## 🛣️ Roadmap — แผนอนาคต

### ✅ ทำเสร็จแล้ว
- [x] Landing page + Google OAuth + Email/OTP
- [x] Dashboard: KPIs, charts, price table, news feed
- [x] AI Chat with Function Calling + rule-based fallback
- [x] KPI Detail Pages (Efficient Frontier, Monte Carlo, Regime)
- [x] Live prices auto-fetch (60s) + FX conversion
- [x] My Portfolio — track holdings, P/L, historical price lookup
- [x] Watchlist — track stocks with price targets
- [x] Portfolio Comparison — your holdings vs MPT optimal
- [x] Docker Compose dev setup

### 🔜 ระยะสั้น (Short-term) Done
- [x] **Dark mode** — theme toggle (light/dark) สำหรับใช้กลางคืน
- [x] **Settings/Profile page** — จัดการบัญชี, เปลี่ยนรหัสผ่าน, ลบบัญชี
- [x] **Export Portfolio CSV** — ดาวน์โหลดตาราง My Portfolio เป็น CSV
- [x] **Price Alert notifications** — แจ้งเตือนทางอีเมลเมื่อราคาถึงเป้าหมายใน Watchlist
- [x] **Portfolio persistence** — บันทึก My Portfolio และ Watchlist ใน MongoDB (ปัจจุบันเก็บใน localStorage)
- [x] **More tickers** — เพิ่มหุ้นนอกเหนือ 25 ตัว (ให้ผู้ใช้เพิ่มเอง)
-------------------------------------(ยังไม่ได้ทำ)--------------------------------------
### 🎯 ระยะกลาง (Mid-term)
- [ ] **Rebalancing suggestions** — แนะนำการปรับสัดส่วนพอร์ตตาม MPT + สภาวะตลาดปัจจุบัน
- [ ] **Backtesting** — ทดสอบกลยุทธ์การลงทุนย้อนหลัง (buy & hold vs MPT vs regime-based)
- [ ] **Dividend tracking** — ติดตามเงินปันผล + ผลตอบแทนรวม (total return)
- [ ] **Multi-currency** — รองรับการดูพอร์ตในหลายสกุลเงิน (THB/USD)
- [ ] **Custom portfolios** — สร้างหลายพอร์ต (เช่น พอร์ตเกษียณ, พอร์ตเก็งกำไร)
- [ ] **Mobile responsive** — ปรับ layout ให้ใช้งานบนมือถือได้เต็มรูปแบบ

### 🚀 ระยะยาว (Long-term)
- [ ] **Real-time trading** — เชื่อมต่อ broker API (เช่น Interactive Brokers, Sarathull)
- [ ] **Options analysis** — วิเคราะห์ options (Greeks, implied volatility)
- [ ] **Social features** — แชร์พอร์ต, ติดตามผู้ลงทุนคนอื่น
- [ ] **ML model retraining** — ฝึกโมเดล Regime ใหม่อัตโนมัติเมื่อมีข้อมูลใหม่
- [ ] **Alternative data** — ดึงข้อมูลจากแหล่งอื่น (sentiment, on-chain, macro indicators)
- [ ] **Tax reporting** — คำนวณภาษีจากกำไรการลงทุน (ภพ.50)
- [ ] **Mobile app** — React Native หรือ PWA

---

## 📝 Notes

- **API Keys**: `OPENAI_API_KEY` และ `RESEND_API_KEY` เป็นทางเลือก — แอปทำงานได้โดยไม่ต้องมี (AI Chat ใช้ rule-based, อีเมลข้ามไป)
- **Ports**: Backend `:8001` · Frontend `:3000` — Vite proxy ทำให้เป็น same-origin (cookies ทำงานได้)
- **Regime probs**: เก็บเป็น fraction (0.962 = 96.2%) — frontend คูณ 100 ครั้งเดียว
- **Cumulative Return**: คำนวณจาก `daily_returns.csv` แบบทบต้น `(1+r).cumprod()` แล้ว rebase 0% ณ ต้นช่วง
- **Live cache TTL**: 60 วินาที — แก้ได้ที่ `backend/live.py` (`CACHE_TTL`)
- **Session TTL**: 7 วัน — แก้ได้ที่ `backend/auth.py` (`SESSION_TTL_DAYS`)
- **Deployment**: ใช้ `server:app` เป็น entrypoint (ไม่ใช่ `main:app`) เพราะ `server.py` ต้อง register ทุก module
- **My Portfolio & Watchlist**: ปัจจุบันเก็บใน localStorage — ข้อมูลอยู่เฉพาะในเบราว์เซอร์นั้น
- **Not investment advice** — ข้อมูลจาก Yahoo Finance อาจ delay 15 นาที

---

© 2026 QuantAI · Portfolio System · Not investment advice
