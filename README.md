# Quantix Institutional Portfolio & Autonomous Quant Day Trading System 🚀💎

ระบบวิเคราะห์ จัดพอร์ตการลงทุน และบอทเทรดอัจฉริยะระดับสถาบันการเงิน — **Modern Portfolio Theory (MPT) + Machine Learning Market Regime + 24/7 Autonomous Day Trading Engine + Interactive TradingView Charting + Dynamic Rebalancing + Multi-Portfolio & Dividend Tracking**

![Python](https://img.shields.io/badge/Python-3.12-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.141-green) ![React](https://img.shields.io/badge/React-19-61dafb) ![Vite](https://img.shields.io/badge/Vite-8-purple) ![TradingView](https://img.shields.io/badge/TradingView-Lightweight_Charts_4.2-blueviolet) ![MongoDB](https://img.shields.io/badge/MongoDB-7-47a248) ![License](https://img.shields.io/badge/License-MIT-orange)

---

## 📑 สารบัญ

- [✨ ฟีเจอร์หลักของระบบ (Core Features)](#-ฟีเจอร์หลักของระบบ-core-features)
  - [1. Quant Day Trading Terminal & TradingView Chart](#1--quant-day-trading-terminal--tradingview-chart-mt5)
  - [2. 24/7 Autonomous ML Quant Bot](#2--247-autonomous-ml-quant-bot)
  - [3. Institutional Executive Dashboard](#3--institutional-executive-dashboard-dashboard)
  - [4. My Portfolio & Cash Balance Synchronization](#4--my-portfolio--cash-balance-synchronization-portfolio)
  - [5. Dynamic Rebalancing & Regime Tilting](#5-️-dynamic-rebalancing--regime-tilting-rebalancing)
  - [6. Historical Multi-Strategy Backtesting Desk](#6--historical-multi-strategy-backtesting-desk-backtesting)
- [🗺️ ภาพรวมสถาปัตยกรรมระบบ (System Architecture)](#️-ภาพรวมสถาปัตยกรรมระบบ-system-architecture)
- [📁 โครงสร้างโปรเจกต์ (Project Structure)](#-โครงสร้างโปรเจกต์-project-structure)
- [💼 สินทรัพย์ Benchmark ที่รองรับ (25 Assets Universe)](#-สินทรัพย์-benchmark-ที่รองรับ-25-assets-universe)
- [🤖 กลไกการทำงานของ Machine Learning & Quant Engine](#-กลไกการทำงานของ-machine-learning--quant-engine)
- [🚀 คู่มือการติดตั้ง & รันระบบ (Quickstart Guide)](#-คู่มือการติดตั้ง--รันระบบ-quickstart-guide)
- [📡 รายการ API Endpoints (API Reference)](#-รายการ-api-endpoints-api-reference)
- [📊 สถิติและผลลัพธ์ประสิทธิภาพ (Performance Benchmark)](#-สถิติและผลลัพธ์ประสิทธิภาพ-performance-benchmark)
- [🛠 Tech Stack & Dependencies](#-tech-stack--dependencies)

---

## ✨ ฟีเจอร์หลักของระบบ (Core Features)

### 1. ⚡ Quant Day Trading Terminal & TradingView Chart (`/mt5`)
- **Professional Candlestick Chart (TradingView Lightweight Charts 4.2)**:
  - **Intraday Timeframes สำหรับ Day Trading**:
    - `1D` : กราฟแท่งเทียนความละเอียด 5 นาที (**5m**) สำหรับ Scalping และติดตามราคาระหว่างวัน
    - `5D` : กราฟแท่งเทียนความละเอียด 15 นาที (**15m**) (Default) สำหรับจับรอบเทรด 5 วันทำการ
    - `1MO`: กราฟแท่งเทียนความละเอียด 1 ชั่วโมง (**1h**) สำหรับ Swing Trading
    - `3MO` & `1Y`: กราฟแท่งเทียนรายวัน (**1d**) สำหรับดูทิศทางและแนวโน้มภาพใหญ่
  - **Technical Indicator Overlays**:
    - **EMA 9** (Exponential Moving Average 9 - Cyan `#06b6d4`)
    - **EMA 21** (Exponential Moving Average 21 - Orange `#f97316`)
    - **Volume Histogram**: แท่งปริมาณการซื้อขายแยกสีเขียว/แดงตามทิศทางแท่งเทียน
    - ปุ่มเปิด/ปิด Indicator แต่ละตัวได้อย่างอิสระบนชาร์ต
  - **Interactive Crosshair HUD**: แถบแสดงค่าราคา Open, High, Low, Close, % Change, Volume และค่า EMA แบบ Real-time ตามตำแหน่งเมาส์
  - **Dynamic Price Lines**: แสดงเส้นแนวนอนบอกตำแหน่งต้นทุนออเดอร์ (Entry), Stop Loss (เส้นประสีแดง) และ Take Profit (เส้นประสีเขียว) พร้อมป้ายราคาเป้าหมาย
- **Quantix Demo Trading Desk ($10,000)**: ระบบบัญชีเทรดจำลอง Paper Trading คำนวณแบบ Real-time Tick จากราคาตลาดจริง (Yahoo Finance Streaming)
- **Institutional Performance Blotter**:
  - Closed Win Rate (%)
  - Profit Factor
  - Realized Net P/L ($)
  - Total Order Executions
  - ปุ่ม **Export CSV** ดาวน์โหลดประวัติการซื้อขายทั้งหมดเป็นสเปรดชีต
- **Precision Order Pad**:
  - ปุ่มสไนเปอร์ออเดอร์ทันที: `⚡ Scalp BUY 0.02` และ `⚡ Scalp SELL 0.02`
  - สวิตช์ **Auto ML Risk (1:2 R:R)** คำนวณ SL/TP อัตโนมัติจากโมเดล Machine Learning
  - ปุ่ม **Risk Presets (1%, 2%, 5%)** คำนวณ Lot Size ตามความเสี่ยงของพอร์ต
  - ปุ่ม `🔄 รีเซ็ตเงิน $10K` คืนค่ายอดเงินกลับเป็น $10,000.00 ตั้งต้น

---

### 2. 🤖 24/7 Autonomous ML Quant Bot
- **ทำงานเป็น Background Worker Service** บน FastAPI รันต่อเนื่องตลอด 24 ชั่วโมง แม้ผู้ใช้ปิดเบราว์เซอร์หรือ Logout
- **Full Universe Scanning (25 Assets)**: สแกนสัญญาณและประเมินสภาวะตลาดของสินทรัพย์ทั้ง 25 ตัวทุก ๆ 15 วินาที
- **Concurrent Positions Capacity**: ขยายขีดความสามารถรองรับการเปิดสถานะพร้อมกันได้สูงสุดถึง **8 Positions**
- **Adaptive Take Profit & Risk Management**:
  - เกณฑ์การปิดทำกำไรแบบสัดส่วน: กำไร `>= 0.65%` หรือ `>= $1.50` ต่อไม้ (รองรับทั้งหุ้นราคาสูงอย่าง US Tech และหุ้นราคาหลักสิบบาทอย่าง PTT)
  - กลไก Trailing Profit Protection & Stop Loss ป้องกันความเสี่ยงจากการพลิกกลับของแนวโน้ม
  - รองรับโหมด Spot Cash Trading (เข้าซื้อหุ้นจริง ปลอดภัย ไร้ภาระยืมหุ้น Short-selling)
- **Persistent State**: บันทึกคำสั่งซื้อขายและสถานะการทำงานลงไฟล์ `output/demo_trade_state.json` และ `output/daytrade_bot_state.json` อัตโนมัติ

---

### 3. 📊 Institutional Executive Dashboard (`/dashboard`)
- **ดีไซน์ระดับสถาบันการเงิน (Commercial Institutional Grade)** สะอาด ชัดเจน มินิมอล ไม่มีองค์ประกอบจำลองที่ไม่เชื่อมต่อจริง
- **4 Real-time Core Metrics**:
  - **MPT Max Sharpe Ratio**: อัตราส่วนผลตอบแทนต่อความเสี่ยงที่ดีที่สุด
  - **Annualized Expected Return**: ผลตอบแทนคาดการณ์ทบต้นต่อปี
  - **Portfolio Volatility**: ความผันผวนของพอร์ตการลงทุน
  - **Market Regime**: สภาวะตลาดปัจจุบัน (Bullish / Neutral / Bearish) พร้อมระดับความมั่นใจ (%)
- **Live Synchronized Cumulative Return Chart**: กราฟผลตอบแทนสะสมอัปเดตแบบเรียลไทม์จนถึงวันและเวลาปัจจุบัน (ไม่ค้างประวัติเก่า)
- **Market Telemetry & Watch Overview**: สรุปราคาสด สัดส่วน และข่าวสารตลาดแบบ Live Stream

---

### 4. 💼 My Portfolio & Cash Balance Synchronization (`/portfolio`)
- **เชื่อมโยงข้อมูลเงินสดจริงแบบ Real-time (Live Synchronized)**:
  - เชื่อมโยงบัญชีเงินสดเข้ากับ Trading Desk (`/api/mt5/account`)
  - **5 Metric Summary Cards ที่เชื่อมโยงกัน 100%**:
    1. **Total Equity**: มูลค่าพอร์ตรวมคำนวณจาก `Cash Balance + Holdings Value`
    2. **Cash Balance**: ยอดเงินสดคงเหลือในบัญชีเทรด
    3. **Holdings Value**: มูลค่าตลาดปัจจุบันของหุ้นที่ถือครอง (คำนวณจากราคา Live ล่าสุด)
    4. **Total Cost Basis**: ต้นทุนรวมที่ซื้อจริง
    5. **Unrealized Net P/L**: กำไร/ขาดทุนที่ยังไม่เกิดขึ้นจริง ทั้งในรูปจำนวนเงิน ($) และเปอร์เซ็นต์ (%)
- **Multi-Portfolio Management**: รองรับการสร้างและจัดการหลายพอร์ตพร้อมกัน (เช่น พอร์ตเกษียณ, พอร์ตเทรดระยะสั้น, พอร์ตปันผล)
- **Dividend Tracking**: ดึงประวัติและคำนวณผลตอบแทนจากเงินปันผลจริงผ่าน Yahoo Finance
- **Multi-Currency Toggle**: สลับการแสดงผลมูลค่าทั้งพอร์ตระหว่างสกุลเงินบาท (THB) และดอลลาร์สหรัฐ (USD) ผ่านอัตราแลกเปลี่ยน Live FX Rate
- **CSV Holdings Export**: ส่งออกรายการพอร์ตการลงทุนเป็นไฟล์ CSV ได้ทันที

---

### 5. ⚖️ Dynamic Rebalancing & Regime Tilting (`/rebalancing`)
- คำนวณเปรียบเทียบสัดส่วนพอร์ตจริงของผู้ใช้เทียบกับ **สัดส่วนที่เหมาะสมที่สุดตามทฤษฎี MPT (Max Sharpe Portfolio)**
- **Regime Tilting Matrix**: ปรับน้ำหนักการลงทุนตามสภาวะตลาดที่จำแนกได้จาก Machine Learning:
  - **Bull Market**: เอนเอียงน้ำหนักเข้าสู่หุ้นเติบโต (Equity Tilt +15%) เพื่อเร่งผลตอบแทน
  - **Bear Market**: โยกย้ายน้ำหนักเข้าสู่สินทรัพย์ปลอดภัย พันธบัตรรัฐบาล และทองคำ (Safe Asset Tilt +80%) เพื่อปกป้องเงินทุน
- ออกคำแนะนำ Rebalancing Suggestions ระบุรายการหุ้นและจำนวนที่ต้อง Buy/Sell อย่างแม่นยำ

---

### 6. 📈 Historical Multi-Strategy Backtesting Desk (`/backtesting`)
- ระบบจำลองผลตอบแทนย้อนหลัง (Vectorized Backtest) เปรียบเทียบ 3 กลยุทธ์พร้อมกัน:
  1. **Buy & Hold**: ซื้อสินทรัพย์ตามสัดส่วนคงที่แล้วถือครองระยะยาว
  2. **MPT Optimized**: ปรับพอร์ตรายเดือนสู่จุด Max Sharpe Ratio
  3. **Regime-Based (Quantix)**: ปรับพอร์ตแบบไดนามิกตามสัญญาณ Machine Learning Market Regime
- แสดงกราฟเปรียบเทียบ Equity Curves พร้อมตัวชี้วัดสถิติ: **CAGR (%)**, **Sharpe Ratio**, **Max Drawdown (%)**, และ **Annual Volatility (%)**

---

## 🗺️ ภาพรวมสถาปัตยกรรมระบบ (System Architecture)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (React 19 + Vite 8)                │
│                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌────────────┐  │
│  │ Day Trading Terminal  │  │ Interactive Chart     │  │ Live Tape  │  │
│  │ (/mt5)                │  │ (TradingView 4.2)     │  │ (25 Assets)│  │
│  └───────────┬───────────┘  └───────────┬───────────┘  └─────┬──────┘  │
│              │                          │                    │         │
│  ┌───────────▼───────────┐  ┌───────────▼───────────┐  ┌─────▼──────┐  │
│  │ My Portfolio Sync     │  │ Backtesting Engine    │  │ Executive  │  │
│  │ (5 Live Synced Cards) │  │ (/backtesting)        │  │ Dashboard  │  │
│  └───────────────────────┴──────────────┬───────────┴───────────────┘  │
└─────────────────────────────────────────┼──────────────────────────────┘
                                          │ REST API / Vite Proxy (:3000 -> :8001)
┌─────────────────────────────────────────▼──────────────────────────────┐
│                       SERVER LAYER (FastAPI Python Core)               │
│                                                                        │
│  ┌───────────────────────────────┐     ┌────────────────────────────┐  │
│  │ mt5_trade.py                  │     │ quant_daytrade.py          │  │
│  │ - Paper Trading Engine ($10K) │◄────┤ - 24/7 Autonomous Bot      │  │
│  │ - 1D/5D/1M/3M/1Y Candles API  │     │ - 25-Asset Scanner (15s)   │  │
│  │ - Order & Position Execution  │     │ - Proportional TP / SL     │  │
│  └───────────────┬───────────────┘     └─────────────┬──────────────┘  │
│                  │                                   │                 │
│  ┌───────────────▼───────────────┐     ┌─────────────▼──────────────┐  │
│  │ rebalancing.py & backtest.py  │     │ live.py & yh.py            │  │
│  │ - Modern Portfolio Theory     │     │ - Yahoo Finance Pipeline   │  │
│  │ - Dynamic Regime Tilting      │     │ - Real-time Tick Cache     │  │
│  └───────────────┬───────────────┘     └─────────────┬──────────────┘  │
└──────────────────┼───────────────────────────────────┼─────────────────┘
                   │                                   │
      ┌────────────▼──────────┐             ┌──────────▼──────────┐
      │ Persistent JSON State │             │ MongoDB 7 Database  │
      │ - demo_trade_state    │             │ - User Portfolios   │
      │ - daytrade_bot_state  │             │ - Authentication    │
      └───────────────────────┘             └─────────────────────┘
```

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```
proyearfour/
├── README.md                      ← คู่มือเอกสารฉบับสมบูรณ์
├── AGENTS.md                      ← บันทึกข้อกำหนดและสถาปัตยกรรมระบบ
├── docker-compose.base44.yml      ← การตั้งค่า Docker Compose (Full Stack)
│
├── backend/                       ← FastAPI REST API & Quantitative Trading Engine
│   ├── server.py                  ← Supervisor entrypoint (ทางเข้ารันหลัก)
│   ├── main.py                    ← Core FastAPI router & pipeline triggers
│   ├── mt5_trade.py               ← Trading Desk, Paper Trading ($10K), Candlestick & Tick API
│   ├── quant_daytrade.py          ← 24/7 ML Autonomous Bot & 25-Asset Scanner
│   ├── rebalancing.py             ← MPT Portfolio Optimizer & Dynamic Regime Tilting
│   ├── backtest.py                ← Vectorized Historical Multi-Strategy Backtesting
│   ├── portfolio_manager.py       ← Multi-Portfolio & Dividend tracking CRUD
│   ├── live.py                    ← Real-time price caching & bootstrap supervisor
│   ├── yh.py                      ← Yahoo Finance 25-asset data ingestion pipeline
│   ├── mpt.py                     ← Mean-Variance Portfolio Optimization (SLSQP)
│   ├── regime.py                  ← Machine Learning Market Regime Classifier (Random Forest)
│   ├── analysis.py                ← Efficient Frontier & Monte Carlo simulation
│   ├── auth.py                    ← Session authentication & Google OAuth
│   ├── mailer.py                  ← Resend Email OTP verification
│   ├── output/                    ← Persistent storage directory
│   │   ├── demo_trade_state.json  ← บันทึกสถานะพอร์ตจำลอง ออเดอร์ เงินสด และประวัติ
│   │   └── daytrade_bot_state.json← บันทึกการตั้งค่าบอทและ Activity logs
│   └── requirements.txt           ← Python dependencies
│
└── frontend/                      ← React 19 + Vite Frontend SPA
    ├── vite.config.js             ← Vite build & proxy configuration
    ├── package.json               ← Frontend dependencies
    └── src/
        ├── App.jsx                ← Client router & Protected routes
        ├── components/
        │   ├── TradingViewChart.jsx ← กราฟแท่งเทียน Lightweight Charts พร้อม EMA 9/21, Volume และ HUD
        │   ├── TickerTape.jsx     ← แถบวิ่งราคาหุ้นสด 25 สินทรัพย์
        │   ├── Layout.jsx         ← Responsive Sidebar & Navigation Shell
        │   └── ProtectedRoute.jsx
        └── pages/
            ├── Mt5Trade.jsx       ← Quant Day Trading Terminal & Bot Controller
            ├── Dashboard.jsx      ← Executive Institutional Dashboard
            ├── MyPortfolio.jsx    ← Synchronized Multi-Portfolio & Dividend Tracker
            ├── Rebalancing.jsx    ← Portfolio Rebalancing & Regime Tilting
            ├── Backtesting.jsx    ← Multi-Strategy Backtesting Desk
            ├── Watchlist.jsx      ← Watchlist & Price Targets
            └── Login.jsx / Register.jsx
```

---

## 💼 สินทรัพย์ Benchmark ที่รองรับ (25 Assets Universe)

ระบบรองรับการวิเคราะห์ ซื้อขาย และจัดพอร์ตครอบคลุม 3 กลุ่มหลักทั้งในและต่างประเทศ:

| หมวดหมู่ | จำนวน | สัญลักษณ์และรายชื่อสินทรัพย์ | สกุลเงิน |
|---|:---:|---|:---:|
| 🇺🇸 **US Tech & Blue Chips** | 10 | `AAPL` (Apple), `MSFT` (Microsoft), `GOOGL` (Alphabet), `AMZN` (Amazon), `NVDA` (Nvidia), `TSLA` (Tesla), `META` (Meta), `JNJ` (Johnson & Johnson), `V` (Visa), `JPM` (JPMorgan Chase) | USD |
| 🇹🇭 **Thai SET Blue Chips** | 10 | `PTT.BK` (ปตท.), `AOT.BK` (ท่าอากาศยานไทย), `CPALL.BK` (ซีพี ออลล์), `BDMS.BK` (กรุงเทพดุสิตเวชการ), `DELTA.BK` (เดลต้า), `GULF.BK` (กัลฟ์), `ADVANC.BK` (แอดวานซ์), `SCB.BK` (เอสซีบี เอกซ์), `KBANK.BK` (กสิกรไทย), `PTTEP.BK` (ปตท.สผ.) | THB |
| 🏦 **Bonds & Safe Havens** | 5 | `GLD` (SPDR Gold Shares), `TLT` (20+ Yr Treasury ETF), `IEF` (7-10 Yr Treasury ETF), `SHY` (1-3 Yr Treasury ETF), `BIL` (1-3 Mo T-Bill ETF) | USD |

---

## 🤖 กลไกการทำงานของ Machine Learning & Quant Engine

1. **Market Regime Detection (Random Forest Classification)**:
   - ใช้โมเดล Ensemble Random Forest Classifier (300 Trees) ในการจำแนกสภาวะตลาดเป็น 3 รูปแบบ: **Bull Market**, **Neutral**, และ **Bear Market**
   - Features ที่ป้อนเข้าโมเดล: Rolling Returns (5d, 21d, 63d), Historical Volatility (21d, 63d), Volatility Ratio, และ Correlation matrix
   - ผลการทดสอบโมเดล: ค่า **Cross-Validation F1-Score สูงถึง 0.94**
2. **Mean-Variance Optimization (Modern Portfolio Theory)**:
   - ใช้ขั้นตอนวิธี `scipy.optimize.minimize` (SLSQP) ในการค้นหาน้ำหนักการลงทุนที่ให้ค่า **Sharpe Ratio สูงสุด (Max Sharpe Portfolio)** ภายใต้เงื่อนไข `Sum(weights) = 1` และ `Weight >= 0` (Long-only)
3. **Autonomous Execution Logic**:
   - ประเมินดัชนีโมเมนตัม `RSI (14)`, ค่าเฉลี่ยเคลื่อนที่แบบเอ็กซ์โพเนนเชียล `EMA 9/21`, และช่วงความผันผวนจริงเฉลี่ย `ATR (14)` เพื่อคำนวณระดับความมั่นใจ (Confidence Score 0-100%)
   - เมื่อระดับความมั่นใจ `>= 70%` บอทจะส่งคำสั่งซื้ออัตโนมัติพร้อมกำหนดเป้าหมายกำไรและจุดหยุดขาดทุน

---

## 🚀 คู่มือการติดตั้ง & รันระบบ (Quickstart Guide)

### วิธีที่ 1: รันด้วย Docker Compose (แนะนำสำหรับการ Deploy)

```bash
# สั่งสร้างคอนเทนเนอร์และรันระบบทั้งหมดในพื้นหลัง
docker compose -f docker-compose.base44.yml up -d --build

# ตรวจสอบสถานะของคอนเทนเนอร์ (Frontend, Backend, MongoDB)
docker compose -f docker-compose.base44.yml ps
```
เปิดใช้งานผ่านเว็บเบราว์เซอร์ที่: **`http://localhost:3000`**

---

### วิธีที่ 2: รันสำหรับ Local Development

#### ข้อกำหนดของระบบ
- **Python 3.12+**
- **Node.js 20+ หรือ 22+**
- **MongoDB 7+** (ทำงานที่พอร์ตเริ่มต้น `27017`)

#### 1. ฝั่ง Backend (FastAPI)
```bash
cd backend

# สร้างและเปิดใช้งาน Virtual Environment
python -m venv .venv
# บน Windows:
.venv\Scripts\activate
# บน macOS/Linux:
source .venv/bin/activate

# ติดตั้ง Dependencies
pip install -r requirements.txt

# สตาร์ตเซิร์ฟเวอร์หลัก (server:app)
python -m uvicorn server:app --port 8001 --reload
```
> เซิร์ฟเวอร์จะเปิดที่ `http://127.0.0.1:8001` และเข้าดู Interactive Swagger Docs ได้ที่ `http://127.0.0.1:8001/docs`

#### 2. ฝั่ง Frontend (React 19 + Vite)
```bash
cd frontend

# ติดตั้ง Dependencies
npm install

# รัน Vite Development Server
npm run dev
```
> ระบบพร้อมใช้งานที่ `http://localhost:3000` (Vite จะ Proxy คำขอ `/api` ไปยัง Backend ที่พอร์ต 8001 โดยอัตโนมัติ)

---

## 📡 รายการ API Endpoints (API Reference)

### 1. Day Trading & Simulation (`backend/mt5_trade.py`)
| Method | Endpoint | รายละเอียด |
|---|---|---|
| `GET` | `/api/mt5/status` | ตรวจสอบสถานะการเชื่อมต่อพอร์ตและโหมด Paper Trading |
| `GET` | `/api/mt5/account` | ดึงข้อมูล Balance, Equity, Profit, Margin, Free Margin (เชื่อมโยงสดกับพอร์ต) |
| `GET` | `/api/mt5/positions` | รายการสถานะออเดอร์ที่เปิดอยู่ทั้งหมด |
| `GET` | `/api/mt5/history` | ประวัติออเดอร์ที่ปิดแล้วทั้งหมด |
| `GET` | `/api/mt5/candles` | ดึงข้อมูลแท่งเทียน OHLC (`symbol`, `period=1d/5d/1mo/3mo/1y`, `interval=5m/15m/1h/1d`) |
| `GET` | `/api/mt5/tick` | ดึงราคา Bid/Ask ล่าสุดแบบ Real-time |
| `POST` | `/api/mt5/order` | ส่งคำสั่งซื้อขาย (`symbol`, `action=BUY/SELL`, `volume`, `sl`, `tp`) |
| `POST` | `/api/mt5/close` | ปิดออเดอร์ตาม Ticket ID |
| `POST` | `/api/mt5/close-all` | ปิดทุกออเดอร์ในพอร์ตทันที (Emergency Panic Exit) |
| `POST` | `/api/mt5/reset-demo` | รีเซ็ตยอดเงินบัญชีจำลองกลับเป็น $10,000.00 |

### 2. Autonomous ML Bot & Radar (`backend/quant_daytrade.py`)
| Method | Endpoint | รายละเอียด |
|---|---|---|
| `GET` | `/api/quant/daytrade/signals` | สแกนสัญญาณเทรด Real-time ทั้ง 25 สินทรัพย์ผ่านโมเดล ML |
| `GET` | `/api/quant/daytrade/bot/status` | ตรวจสอบสถานะของบอทเทรด, Active Positions, และ Activity Logs |
| `POST` | `/api/quant/daytrade/bot/config` | ปรับแต่งค่าพารามิเตอร์ของบอท (เปิด/ปิดบอท, Min Confidence, Max Positions, Lot) |

### 3. Portfolio, Rebalancing & Backtest
| Method | Endpoint | รายละเอียด |
|---|---|---|
| `GET` | `/api/user/portfolios` | ดึงรายการพอร์ตการลงทุนทั้งหมดของผู้ใช้ |
| `GET` | `/api/user/portfolios/{id}/holdings` | ดึงรายการสินทรัพย์ที่ถือครองในพอร์ตที่เลือก |
| `GET` | `/api/user/portfolios/{id}/dividends`| ดึงประวัติเงินปันผลที่ได้รับและคำนวณ Total Dividend Yield |
| `GET` | `/api/rebalancing/regime-tilt` | ดึงสภาวะตลาดปัจจุบันและตัวคูณปรับน้ำหนักพอร์ต (Tilt Factors) |
| `POST` | `/api/rebalancing/suggestions` | คำนวณคำแนะนำการ Rebalance เพื่อปรับพอร์ตเข้าสู่จุด Max Sharpe |
| `GET` | `/api/backtest?period=1y\|3y\|all` | รันการทดสอบย้อนหลังเปรียบเทียบ 3 กลยุทธ์พร้อมสถิติผลตอบแทน |
| `GET` | `/api/prices/live` | ดึงข้อมูลราคาล่าสุดทั้ง 25 สินทรัพย์ พร้อมอัตราแลกเปลี่ยน Live FX Rate |

---

## 📊 สถิติและผลลัพธ์ประสิทธิภาพ (Performance Benchmark)

ผลการทดสอบย้อนหลังของโมเดล Quantix (มกราคม 2020 – ปัจจุบัน ครอบคลุมกว่า 1,700 วันทำการ):

| ตัวชี้วัดประสิทธิภาพ | ค่าที่ได้จริง | คำอธิบายความหมาย |
|---|:---:|---|
| **Sharpe Ratio (Max Sharpe)** | **1.94** | อัตราส่วนผลตอบแทนเทียบกับความเสี่ยงในระดับดีเยี่ยมตามเกณฑ์สถาบัน |
| **Annualized Return** | **31.3%** | ผลตอบแทนเฉลี่ยทบต้นต่อปี |
| **Annualized Volatility** | **15.1%** | ความผันผวนของพอร์ตอยู่ในระดับต่ำจากการกระจายความเสี่ยงข้ามกลุ่มสินทรัพย์ |
| **Random Forest CV F1-Score** | **0.94** | ความแม่นยำในการจำแนกสภาวะตลาด (5-Fold Stratified Cross Validation) |
| **Order Execution Latency** | **< 15ms** | ความเร็วเฉลี่ยในการจับคู่และตอบสนองคำสั่งซื้อขายบน Paper Trading Desk |

---

## 🛠 Tech Stack & Dependencies

- **Quantitative Finance & ML**:
  - `scikit-learn` — Random Forest Regime Classifier
  - `scipy.optimize` — SLSQP Constrained Portfolio Optimization
  - `pandas`, `numpy` — Time series & Matrix Return Analysis
  - `yfinance` — Automated Financial Data Pipeline
- **Backend Architecture**:
  - `FastAPI 0.141` — High Performance Async REST API
  - `Uvicorn` — ASGI Server
  - `Motor` & `PyMongo` — Asynchronous MongoDB Driver
  - `Pydantic v2` — Data Validation & Schema Enforcement
- **Frontend Architecture**:
  - `React 19` & `Vite 8` — Modern Web Application
  - `TradingView Lightweight Charts 4.2` — Financial Candlestick & Technical Indicator Visualizer
  - `Recharts 3` — Performance & Allocation Charts
  - `React Router 7` — Client-side Routing
- **Database & Storage**:
  - `MongoDB 7` — Document Database สำหรับผู้ใช้ พอร์ต และ Watchlist
  - `JSON State Persistence` — บันทึกสถานะบอทและพอร์ตเทรดลงดิสก์อย่างต่อเนื่อง

---

© 2026 Quantix Portfolio & Autonomous Day Trading System · พัฒนาสำหรับโครงงานปริญญานิพนธ์วิศวกรรมคอมพิวเตอร์ / วิทยาการคอมพิวเตอร์ (Senior Project)
