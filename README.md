# Quantix Portfolio & Quant Day Trading System 🚀💎

ระบบวิเคราะห์และจัดพอร์ตการลงทุนอัจฉริยะระดับสถาบันการเงิน — **MPT Optimization + Market Regime Machine Learning + 24/7 Autonomous Day Trading Desk + Interactive TradingView Charts + Dynamic Rebalancing + Multi-Portfolio + Backtesting**

![Python](https://img.shields.io/badge/Python-3.12-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.141-green) ![React](https://img.shields.io/badge/React-19-61dafb) ![Vite](https://img.shields.io/badge/Vite-8-purple) ![TradingView](https://img.shields.io/badge/TradingView-Lightweight_Charts_4.2-blueviolet) ![MongoDB](https://img.shields.io/badge/MongoDB-7-47a248) ![License](https://img.shields.io/badge/License-MIT-orange)

---

## 📑 สารบัญ

- [✨ ฟีเจอร์หลักของระบบ](#-ฟีเจอร์หลักของระบบ)
- [🗺️ ภาพรวมสถาปัตยกรรม (System Architecture)](#️-ภาพรวมสถาปัตยกรรม-system-architecture)
- [📁 โครงสร้างโปรเจกต์ (Project Structure)](#-โครงสร้างโปรเจกต์-project-structure)
- [💼 รายชื่อสินทรัพย์ Benchmark (25 Assets)](#-รายชื่อสินทรัพย์-benchmark-25-assets)
- [⚡ Quant Day Trading Desk & Paper Trading Engine](#-quant-day-trading-desk--paper-trading-engine)
- [🤖 24/7 Autonomous ML Trading Bot](#-247-autonomous-ml-trading-bot)
- [⚖️ Dynamic Rebalancing & Regime Tilting](#️-dynamic-rebalancing--regime-tilting)
- [📈 Historical Backtesting Engine](#-historical-backtesting-engine)
- [💼 Multi-Portfolio & Dividend Tracking](#-multi-portfolio--dividend-tracking)
- [🚀 คู่มือการติดตั้ง & รันระบบ](#-คู่มือการติดตั้ง--รันระบบ)
- [📡 API Endpoints Reference](#-api-endpoints-reference)
- [📊 สถิติและผลลัพธ์การทดสอบจริง](#-สถิติและผลลัพธ์การทดสอบจริง)
- [🛠 Tech Stack](#-tech-stack)

---

## ✨ ฟีเจอร์หลักของระบบ

### 1. ⚡ Quant Day Trading Desk (`/mt5`)
- **Interactive TradingView Candlestick Chart**: กราฟแท่งเทียนระดับมืออาชีพ พัฒนาด้วย `Lightweight Charts 4.2` แสดงผล OHLC แบบเรียลไทม์ พร้อมเส้นแนวนอนบอกระดับ **Open Entry**, **Stop Loss (เส้นประสีแดง)**, และ **Take Profit (เส้นประสีเขียว)**
- **Live 25-Asset Streaming Ticker Tape**: แถบราคาหุ้นวิ่งสดตลอดเวลาที่ส่วนหัวของเทอร์มินัล พร้อมไฟกระพริบสีเขียว/แดง และคำนวณ % การเปลี่ยนแปลงแบบ Real-time
- **Quantix Demo Trading Desk ($10,000)**: ระบบบัญชีจำลองภายในแอปพลิเคชัน ไม่จำเป็นต้องเปิดโปรแกรม MetaTrader 5 หรือล็อกอินค้างไว้บนเครื่อง คำนวณตามราคาตลาดจริงจาก Yahoo Finance
- **Institutional Performance Blotter**: รายงานตัวชี้วัดประสิทธิภาพของพอร์ต:
  - **Closed Win Rate (%)**: อัตราการชนะของออเดอร์ที่ปิดแล้ว
  - **Profit Factor**: อัตราส่วนกำไรต่อผลขาดทุนสุทธิ
  - **Realized Net P/L ($)**: กำไร/ขาดทุนสะสมที่บันทึกเข้าเงินสดจริง
  - **Total Executions**: จำนวนครั้งที่ปิดออเดอร์
  - **📥 Export CSV**: ดาวน์โหลดประวัติการซื้อขายทั้งหมดเป็นไฟล์ `.csv` ได้ในคลิกเดียว
- **Institutional Order Pad**:
  - สวิตช์ **Auto ML Risk (1:2 R:R)** คำนวณระยะ SL/TP อัตโนมัติจากโมเดล
  - ปุ่ม **Risk Presets (1%, 2%, 5%)**: คำนวณ Lot Size ที่ปลอดภัยตามขนาดเงินทุน
  - ปุ่มสไนเปอร์ออเดอร์ทันที: `⚡ Scalp BUY 0.02` และ `⚡ Scalp SELL 0.02`
  - ปุ่มรีเซ็ตเงินพอร์ตกลับเป็น $10,000.00 (`🔄 รีเซ็ตเงิน $10K`)

### 2. 🤖 24/7 Autonomous Background ML Bot
- ทำงานเป็น **Background Service** บน FastAPI Server ทำการวิเคราะห์ตลาดทุก ๆ 15 วินาที
- **ทำงานอัตโนมัติต่อเนื่องแม้ผู้ใช้จะ Logout หรือปิดหน้าเว็บ**
- **Active Risk & Position Management**: บอทคอยตรวจจับเป้าหมาย Take Profit (`+$5.00`), Cut Loss (`-$4.50`) และ Signal Inversion เพื่อปิดออเดอร์ทำกำไรและหมุนเวียนเงินทุนตลอดเวลา
- **Disk State Persistence**: บันทึกสถานะการทำงาน ออเดอร์ และยอดเงินลงไฟล์ `output/demo_trade_state.json` และ `output/daytrade_bot_state.json` แบบถาวร

### 3. ⚖️ Dynamic Rebalancing & Regime Tilting (`/rebalancing`)
- เปรียบเทียบสัดส่วนสินทรัพย์ปัจจุบันของผู้ใช้เทียบกับ **สัดส่วนที่เหมาะสมที่สุดตามทฤษฎี MPT (Max Sharpe Portfolio)**
- ปรับสัดส่วนตามสภาวะตลาด (Regime Tilting):
  - **Bull Market**: เร่งการเติบโต เพิ่มน้ำหนักหุ้น (Equity Tilt +15%)
  - **Bear Market**: เน้นปกป้องเงินต้น โยกเงินเข้าพันธบัตรและทองคำ (Safe Asset Tilt +80%)

### 4. 📈 Historical Backtesting Engine (`/backtesting`)
- รันการทดสอบย้อนหลัง (Vectorized Backtest) เปรียบเทียบ 3 กลยุทธ์พร้อมกัน:
  1. **Buy & Hold**: ซื้อสินทรัพย์ตามสัดส่วนคงที่แล้วถือยาว
  2. **MPT Optimized**: ปรับพอร์ตรายเดือนตาม Sharpe Ratio สูงสุด
  3. **Regime-Based (Quantix)**: กลยุทธ์ที่ปรับสัดส่วนตามโมเดล Machine Learning
- รายงานตัวชี้วัดครบถ้วน: **CAGR (%)**, **Sharpe Ratio**, **Max Drawdown (%)**, และ **Volatility (%)**

### 5. 💼 Multi-Portfolio & Dividend Tracking (`/portfolio`)
- สร้างและบริหารจัดการได้หลายพอร์ตพร้อมกัน (เช่น พอร์ตเกษียณ, พอร์ตเก็งกำไร, พอร์ตออมหุ้น)
- **Dividend Tracking**: คำนวณประวัติเงินปันผลที่ได้รับจริงผ่านข้อมูล Yahoo Finance
- **Multi-Currency Toggle**: สลับดูมูลค่าพอร์ตได้ทั้งสกุลเงินบาท (THB) และดอลลาร์สหรัฐ (USD)

### 6. 📊 Executive Dashboard (`/dashboard`)
- 4 KPI Cards: Sharpe Ratio, Annual Return, Volatility, Market Regime
- กราฟผลตอบแทนสะสม Cumulative Return (เลือกช่วงเวลา 1d ถึง All-time)
- ตารางราคาสด 25 สินทรัพย์ พร้อมข่าวสารรวมจาก Yahoo Finance

---

## 🗺️ ภาพรวมสถาปัตยกรรม (System Architecture)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (React 19 + Vite)                  │
│                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌────────────┐  │
│  │ Day Trading Terminal  │  │ Interactive Chart     │  │ Live Tape  │  │
│  │ (/mt5)                │  │ (TradingView 4.2)     │  │ (Top 10)   │  │
│  └───────────┬───────────┘  └───────────┬───────────┘  └─────┬──────┘  │
│              │                          │                    │         │
│  ┌───────────▼───────────┐  ┌───────────▼───────────┐  ┌─────▼──────┐  │
│  │ Portfolio & Rebalance │  │ Backtesting Engine    │  │ Dashboard  │  │
│  │ (/portfolio, /rebal)  │  │ (/backtesting)        │  │ (/dash)    │  │
│  └───────────────────────┴──────────────┬───────────┴───────────────┘  │
└─────────────────────────────────────────┼──────────────────────────────┘
                                          │ REST API / Vite Proxy (:3000 -> :8001)
┌─────────────────────────────────────────▼──────────────────────────────┐
│                       SERVER LAYER (FastAPI Backend)                   │
│                                                                        │
│  ┌───────────────────────────────┐     ┌────────────────────────────┐  │
│  │ mt5_trade.py                  │     │ quant_daytrade.py          │  │
│  │ - Paper Trading Engine ($10K) │◄────┤ - Background Bot Worker    │  │
│  │ - Live Micro-Tick Generator   │     │ - Random Forest Regime     │  │
│  │ - Order & Position Manager    │     │ - ATR / RSI / EMA Scanner  │  │
│  └───────────────┬───────────────┘     └─────────────┬──────────────┘  │
│                  │                                   │                 │
│  ┌───────────────▼───────────────┐     ┌─────────────▼──────────────┐  │
│  │ rebalancing.py & backtest.py  │     │ live.py & yh.py            │  │
│  │ - MPT Max Sharpe Optimizer    │     │ - Yahoo Finance Pipeline   │  │
│  │ - Dynamic Regime Tilting      │     │ - 25 Asset Ingestion       │  │
│  └───────────────┬───────────────┘     └─────────────┬──────────────┘  │
└──────────────────┼───────────────────────────────────┼─────────────────┘
                   │                                   │
      ┌────────────▼──────────┐             ┌──────────▼──────────┐
      │ Persistent JSON State │             │ MongoDB 7 Database  │
      │ - demo_trade_state    │             │ - User Accounts     │
      │ - daytrade_bot_state  │             │ - Sessions & Auth   │
      └───────────────────────┘             └─────────────────────┘
```

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```
proyearfour/
├── README.md                      ← คู่มือและภาพรวมระบบฉบับสมบูรณ์
├── AGENTS.md                      ← บันทึกการพัฒนาและคู่มือสถาปัตยกรรม
├── docker-compose.base44.yml      ← Docker Compose configuration
│
├── backend/                       ← FastAPI REST API & Quantitative Core
│   ├── server.py                  ← Supervisor entrypoint (จุดรันเซิร์ฟเวอร์หลัก)
│   ├── main.py                    ← Core FastAPI router & pipeline triggers
│   ├── mt5_trade.py               ← Trading Desk, Paper Trading ($10K) & Candlestick API
│   ├── quant_daytrade.py          ← ML Auto-Trade Bot worker & Signal Radar
│   ├── rebalancing.py             ← MPT Portfolio Optimizer & Dynamic Regime Tilting
│   ├── backtest.py                ← Vectorized Historical Backtesting Engine
│   ├── portfolio_manager.py       ← Multi-Portfolio & Dividend tracking CRUD
│   ├── live.py                    ← Real-time price caching & bootstrap supervisor
│   ├── yh.py                      ← Yahoo Finance 25-asset data pipeline
│   ├── mpt.py                     ← Mean-Variance Portfolio Optimizer
│   ├── regime.py                  ← Machine Learning Regime Classifier (Random Forest)
│   ├── analysis.py                ← Efficient Frontier & Monte Carlo simulation API
│   ├── auth.py                    ← Session authentication & Google OAuth
│   ├── mailer.py                  ← Resend Email OTP verification
│   ├── output/                    ← Persistent storage (JSON state & CSV models)
│   │   ├── demo_trade_state.json  ← บันทึกสถานะพอร์ตจำลอง ออเดอร์ และเงินสด
│   │   └── daytrade_bot_state.json← บันทึกสถานะบอทและ Activity logs
│   └── requirements.txt
│
└── frontend/                      ← React 19 + Vite Frontend SPA
    ├── vite.config.js             ← Vite dev server & backend proxy configuration
    ├── package.json               ← Dependencies (lightweight-charts, recharts, react 19)
    └── src/
        ├── App.jsx                ← Main application router & routes
        ├── hooks/
        │   └── useApi.js          ← รวมศูนย์การเรียก API สู่ Backend
        ├── components/
        │   ├── TradingViewChart.jsx ← ชาร์ตกราฟแท่งเทียน Interactive Candlestick
        │   ├── TickerTape.jsx     ← แถบราคาหุ้นวิ่งสด 25 สินทรัพย์ (Live Ticker Tape)
        │   ├── Layout.jsx         ← Shell โครงสร้างนำทางและ Sidebar
        │   └── ProtectedRoute.jsx
        └── pages/
            ├── Mt5Trade.jsx       ← Quant Day Trading Terminal & Bot Controller
            ├── Dashboard.jsx      ← Executive Overview & Live Telemetry
            ├── Rebalancing.jsx    ← Portfolio Rebalancing & Regime Tilting
            ├── Backtesting.jsx    ← Multi-Strategy Backtesting Desk
            ├── MyPortfolio.jsx    ← Multi-Portfolio & Dividend Tracker
            ├── Watchlist.jsx      ← Watchlist & Price Targets
            └── Login.jsx / Register.jsx
```

---

## 💼 รายชื่อสินทรัพย์ Benchmark (25 Assets)

ระบบรองรับการวิเคราะห์และซื้อขายสินทรัพย์ครอบคลุม 3 กลุ่มหลัก ทั้งในและต่างประเทศ:

| หมวดหมู่ | จำนวน | สัญลักษณ์และรายชื่อสินทรัพย์ | สกุลเงิน |
|---|:---:|---|:---:|
| 🇺🇸 **US Tech & Blue Chips** | 10 | `AAPL` (Apple), `MSFT` (Microsoft), `GOOGL` (Alphabet), `AMZN` (Amazon), `NVDA` (Nvidia), `TSLA` (Tesla), `META` (Meta), `JNJ` (Johnson & Johnson), `V` (Visa), `JPM` (JPMorgan Chase) | USD |
| 🇹🇭 **Thai SET Blue Chips** | 10 | `PTT.BK` (ปตท.), `AOT.BK` (ท่าอากาศยานไทย), `CPALL.BK` (ซีพี ออลล์), `BDMS.BK` (กรุงเทพดุสิตเวชการ), `DELTA.BK` (เดลต้า), `GULF.BK` (กัลฟ์), `ADVANC.BK` (แอดวานซ์), `SCB.BK` (เอสซีบี เอกซ์), `KBANK.BK` (กสิกรไทย), `PTTEP.BK` (ปตท.สผ.) | THB |
| 🏦 **Bonds & Safe Havens** | 5 | `GLD` (SPDR Gold Shares), `TLT` (20+ Yr Treasury ETF), `IEF` (7-10 Yr Treasury ETF), `SHY` (1-3 Yr Treasury ETF), `BIL` (1-3 Mo T-Bill ETF) | USD |

---

## ⚡ Quant Day Trading Desk & Paper Trading Engine

- **เริ่มต้นด้วยเงินจำลอง $10,000.00**: รองรับการส่งคำสั่งทั้งแบบ Market BUY และ Market SELL
- **ระบบคำนวณกำไร/ขาดทุนสมจริง**:
  - **Equity**: คำนวณตามราคาตลาดล่าสุด `Equity = Balance + Floating P/L`
  - **Margin Calculation**: คำนวณ Margin ตามอัตราทด Leverage 1:100
  - **Commission Deduction**: มีการหักค่าธรรมเนียมธุรกรรม ($1.00 - $2.00) จาก Balance ทันทีที่เปิดออเดอร์
  - **Realized P/L**: เมื่อปิดออเดอร์ (ไม่ว่าจะปิดด้วยมือหรือชนเส้น Stop Loss / Take Profit) ยอดกำไร/ขาดทุนจะถูกบันทึกเข้าสู่ Balance โดยตรง
- **Interactive TradingView Chart**: เรนเดอร์เส้นระดับราคา Open Price, SL, และ TP บนตัวกราฟแบบไดนามิก

---

## 🤖 24/7 Autonomous ML Trading Bot

- **อัลกอริทึมที่ใช้**: `Random Forest Classifier` (300 Trees) ผนวกกับ `RSI 14`, `EMA 9/21`, และ `ATR 14`
- **การทำงานในพื้นหลัง (Background Worker)**:
  - สแกนหาสัญญาณทุก ๆ 15 วินาที
  - หากพบสินทรัพย์ที่มีระดับความมั่นใจ `Confidence >= 75%` บอทจะเปิดคำสั่งซื้อขายให้อัตโนมัติ
  - ตรวจสอบออเดอร์ที่เปิดอยู่ หากมีกำไรถึงเกณฑ์ `Take Profit (+$5.00)` หรือขาดทุนถึงเกณฑ์ `Stop Loss (-$4.50)` บอทจะทำการปิดออเดอร์เพื่อเก็บกำไรและหมุนเวียนเงินทุนทันที
- **บันทึกสถานะลงดิสก์**: รันต่อเนื่องได้แม้ปิดหน้าเว็บหรือผู้ใช้ทำการ Logout

---

## 🚀 คู่มือการติดตั้ง & รันระบบ

### 1. รันด้วย Docker Compose (แนะนำ)

```bash
# บิลด์และสั่งรันระบบทั้งหมดในพื้นหลัง
docker compose -f docker-compose.base44.yml up -d --build

# ตรวจสอบสถานะการทำงานของคอนเทนเนอร์
docker compose -f docker-compose.base44.yml ps
```

เปิดเว็บเบราว์เซอร์ที่: `http://localhost:3000`

---

### 2. รันแบบ Manual (Local Development)

#### ข้อกำหนดเบื้องต้น
- Python 3.12+
- Node.js 20+ หรือ 22+
- MongoDB 7+ (เปิดทำงานที่พอร์ต 27017)

#### ฝั่ง Backend
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

# สตาร์ตเซิร์ฟเวอร์ FastAPI (ใช้ server:app)
python -m uvicorn server:app --port 8001 --reload
```
> เซิร์ฟเวอร์จะเปิดทำงานที่ `http://127.0.0.1:8001` และเข้าดู Swagger API Docs ได้ที่ `http://127.0.0.1:8001/docs`

#### ฝั่ง Frontend
```bash
cd frontend

# ติดตั้ง Dependencies
npm install

# สตาร์ตเซิร์ฟเวอร์พัฒนา Vite
npm run dev
```
> หน้าเว็บพร้อมใช้งานที่ `http://localhost:3000` (ระบบตั้งค่า Reverse Proxy ไปยังพอร์ต 8001 อัตโนมัติ)

---

## 📡 API Endpoints Reference

### Day Trading Desk & Simulation (`mt5_trade.py`)
| Method | Endpoint | รายละเอียด |
|---|---|---|
| `GET` | `/api/mt5/status` | ตรวจสอบสถานะการเชื่อมต่อพอร์ตและโหมดการทำงาน |
| `GET` | `/api/mt5/account` | ดึงข้อมูล Balance, Equity, Profit, Margin, Free Margin |
| `GET` | `/api/mt5/positions` | ดึงรายการออเดอร์ที่เปิดอยู่ทั้งหมด |
| `GET` | `/api/mt5/history` | ดึงประวัติออเดอร์ที่ปิดแล้วทั้งหมด |
| `GET` | `/api/mt5/candles` | ดึงข้อมูลแท่งเทียน OHLC ย้อนหลังสำหรับ TradingView Chart |
| `GET` | `/api/mt5/tick` | ดึงราคา Bid/Ask ล่าสุดของสินทรัพย์ |
| `POST` | `/api/mt5/order` | ส่งคำสั่งซื้อขาย (BUY / SELL) |
| `POST` | `/api/mt5/close` | ปิดออเดอร์ตามหมายเลข Ticket |
| `POST` | `/api/mt5/close-all` | ปิดออเดอร์ทั้งหมดในพอร์ตทันที (Panic Exit) |
| `POST` | `/api/mt5/reset-demo` | รีเซ็ตยอดเงินบัญชีจำลองกลับเป็น $10,000.00 |

### ML Quant Bot & Signals (`quant_daytrade.py`)
| Method | Endpoint | รายละเอียด |
|---|---|---|
| `GET` | `/api/quant/daytrade/signals` | สแกนสัญญาณเทรด Real-time ทั้ง 25 สินทรัพย์ผ่านโมเดล ML |
| `GET` | `/api/quant/daytrade/bot/status` | ตรวจสอบสถานะของบอทเทรดอัตโนมัติและ Activity Logs |
| `POST` | `/api/quant/daytrade/bot/config` | ปรับแต่งค่าพารามิเตอร์ของบอท (Lot Size, Min Confidence, เปิด/ปิดบอท) |

### Rebalancing & Backtest (`rebalancing.py`, `backtest.py`)
| Method | Endpoint | รายละเอียด |
|---|---|---|
| `GET` | `/api/rebalancing/regime-tilt` | ดูสภาวะตลาดปัจจุบันและตัวคูณปรับน้ำหนักพอร์ต (Tilt Factors) |
| `POST` | `/api/rebalancing/suggestions` | คำนวณคำแนะนำการซื้อ/ขายเพื่อปรับพอร์ตสู่จุดที่เหมาะสมที่สุด |
| `GET` | `/api/backtest?period=1y\|3y\|all` | รันการทดสอบย้อนหลังเปรียบเทียบ 3 กลยุทธ์พร้อมสถิติผลตอบแทน |

---

## 📊 สถิติและผลลัพธ์การทดสอบจริง

ข้อมูลการทดสอบย้อนหลัง (มกราคม 2020 – ปัจจุบัน ครอบคลุมกว่า 1,700 วันทำการ):

| ตัวชี้วัดประสิทธิภาพ | ค่าที่ได้ | คำอธิบาย |
|---|:---:|---|
| **Sharpe Ratio (Max Sharpe)** | **1.94** | อัตราส่วนผลตอบแทนต่อความเสี่ยงในระดับสูงมาก |
| **Annualized Return** | **31.3%** | ผลตอบแทนเฉลี่ยทบต้นต่อปี |
| **Annualized Volatility** | **15.1%** | ความผันผวนของพอร์ตอยู่ในระดับต่ำจากการกระจายสินทรัพย์ |
| **Random Forest CV F1-Score** | **0.94** | ความแม่นยำในการจำแนกสภาวะตลาด (5-Fold Cross Validation) |
| **Execution Latency** | **< 15ms** | ความเร็วในการตอบสนองคำสั่งซื้อขายบน Paper Trading Desk |

---

## 🛠 Tech Stack

- **Machine Learning & Quant**: `scikit-learn` (Random Forest), `scipy.optimize` (SLSQP), `pandas`, `numpy`, `yfinance`
- **Backend Framework**: `FastAPI`, `Uvicorn`, `Pydantic v2`, `Motor` (Async MongoDB Driver)
- **Frontend Framework**: `React 19`, `Vite 8`, `TradingView Lightweight Charts 4.2`, `Recharts 3`, `React Router 7`
- **Database & Storage**: `MongoDB 7`, Local JSON State Persistence
- **UI & Styling**: CSS Modules, Dark Theme Support, Glassmorphism, Responsive Drawer

---

© 2026 Quantix Portfolio & Trading System · พัฒนาสำหรับโครงงานปริญญานิพนธ์วิศวกรรมคอมพิวเตอร์ / วิทยาการคอมพิวเตอร์ (Senior Project)
