# QuantAI Portfolio Dashboard — PRD

## Problem Statement (latest)
1. "แก้หน้า frontend เอาแบบคลีนๆ" → light minimal redesign
2. "สร้างให้ดึงข้อมูลให้เป็นปัจจุบันไม่ต้องโหลด โดยดึงข้อมูลจากตลาดให้มันเป็นปัจจุบัน"
   → Auto-fetch live market data on mount + periodic refresh, no manual button click.

## Stack
- Frontend: Vite + React 19 + React Router + Recharts (supervisor `frontend`, port 3000)
- Backend: FastAPI on `server:app` (via `/app/backend/server.py` → imports `main.py`), port 8001
- Data: Yahoo Finance via `yfinance` (25 tickers + THB=X FX)

## What's Implemented
- **Clean light theme** — Geist font, off-white surfaces, single blue accent, no glows
- **Live prices endpoint** `GET /api/prices/live` — fetches latest 7-day window from Yahoo, converts USD→THB using live FX, computes 1D % change, in-memory cache 60 s
- **Auto-bootstrap** — on server startup a background task runs full data pipeline + MPT + Regime once, so pie chart / regime / returns chart populate without user action
- **Frontend polling** — Dashboard fetches `/api/prices/live` on mount and every 60 s; price table now shows a live "1D %" column
- **Live status badge** in the header (green pulse "Live · FX ฿xx.xx")
- Fixed pre-existing bugs:
  - MPT portfolio CSV had `np.float64(...)` wrappers → new regex parser in `get_portfolio_summary`
  - Pie chart weight filter was checking `>0.5` (50%) against fractions → now normalizes to %
- Environment/plumbing fixes:
  - Created `/app/backend/server.py` so the read-only supervisor config finds the app
  - Installed missing deps (`react-is`, `pytz`, `curl_cffi`, `beautifulsoup4`, `multitasking`, `peewee`, `lxml`)
  - `vite.config.js` opens `allowedHosts: true` and binds `0.0.0.0:3000`; added `yarn start` script

## Backlog
- P1: Dark-mode toggle
- P1: Densify + sortable price table with sticky header
- P2: Auto-rerun the MPT + Regime pipeline on a schedule (e.g. every 24 h) so weights stay fresh
- P2: WebSocket push for prices instead of 60 s polling
- P2: ⌘K command palette
