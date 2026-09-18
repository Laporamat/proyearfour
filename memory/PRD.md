# QuantAI Portfolio Dashboard — PRD

## Problem Statement (cumulative)
1. Clean minimal frontend redesign
2. Auto-fetch live market data (no manual pipeline click)
3. Fix +0.00% bug on Thai (.BK) tickers
4. **Landing + Login/Register with real Google OAuth** ← current

## Stack
- Frontend: Vite + React 19 + React Router 7 + Recharts
- Backend:  FastAPI on `server:app` (imports main.py + live.py + auth.py), port 8001
- Auth:     Emergent-managed Google OAuth (auth.emergentagent.com)
- DB:       MongoDB (`quantai` DB, collections `users` + `user_sessions`)
- Data:     Yahoo Finance via `yfinance`, cached 60 s

## Public Routes
| Path            | Component      | Access        |
|-----------------|----------------|---------------|
| `/`             | Landing        | Public        |
| `/login`        | Login          | Public        |
| `/#session_id=` | AuthCallback   | OAuth return  |
| `/dashboard`    | Dashboard      | 🔒 Protected  |
| `/chat`         | Chat           | 🔒 Protected  |

## What's Implemented (cumulative)
- **Auth (new)**
  - Emergent Google OAuth flow, redirect derived dynamically from `window.location.origin`
  - Backend endpoints: `POST /api/auth/session`, `GET /api/auth/me`, `POST /api/auth/logout`
  - Session cookie (httpOnly, Secure, SameSite=None) + Bearer fallback
  - `ProtectedRoute` + `AuthProvider` with race-condition-safe callback handling
  - User chip + logout button in the sidebar footer
  - Landing page (hero, features grid, 3-step how-it-works, stack tags, final CTA, footer)
  - Login page with split layout (Google button + testimonial column)
- **Live prices** — `/api/prices/live` 60 s cache; per-ticker independent last-2 calc so .BK % change is real
- **Auto-bootstrap** — pipeline + MPT + Regime run once in the background on server startup
- **Clean light theme** — Geist font, single blue accent, no glows
- **Bug fixes** — MPT weights np.float64 parser, pie chart weight scale

## Backlog
- P1: Password/email fallback auth
- P1: Scheduled pipeline refresh every 24 h
- P2: Dark mode toggle
- P2: WebSocket price push instead of 60 s polling
- P2: Sortable price table with sticky header + sparkline

## Update — 2026-09-17
- **CRITICAL FIX**: yfinance was broken (missing pytz, bs4, multitasking, peewee, lxml, html5lib) → no real data generated at all. Reinstalled deps + froze requirements.txt.
- **Restored backend/.env** (MONGO_URL, DB_NAME) — was empty, causing crash-loop.
- **Cumulative Return bug fixed** (`/api/returns-history`): removed erroneous `/100` double-scaling; now computes REAL cumulative return via compounding `(1+r).cumprod()`, rebased to 0% at window start.
- **Added periods**: 1d, 1w, 1m, 3m, 6m, 1y, 3y, all (daily granularity for short windows, weekly for 1y, monthly for 3y/all) — all real data.
- **Portfolio Allocation redesigned**: donut + center Sharpe + ranked weight-bar list (sorted high→low) + Return/Volatility pills. Much more readable.

## Update — 2026-09-18
- **NEW: Portfolio News** — `backend/news.py` (`GET /api/news`) aggregates Yahoo Finance news across all 25 tickers (concurrent fetch, dedupe by id, sort newest-first, 10-min TTL cache, startup warm). Frontend `NewsFeed.jsx` card added to Dashboard under the price table (thumbnails, ticker badge fallback, publisher, Thai relative time, external links). Registered in server.py.

## Update — 2026-09-18 (layout)
- Portfolio Allocation changed from donut → vertical bar chart (recharts BarChart), now full-width and height-matched (210px chart) to Cumulative Return. Kept Sharpe/Return/Volatility pills + tooltip.
- News moved from left column to right sidebar under the AI Chat (new `.side` wrapper in Dashboard.module.css; chat height fixed at 560px).

## Update — 2026-09-18 (KPI detail pages + Regime fix)
- **BUG FIX (verified by testing agent)**: Market Regime KPI was empty because run_regime crashed on missing deps (cloudpickle → narwhals/threadpoolctl for scikit-learn 1.9.1). Installed + froze requirements.txt; output/regime_predictions.csv now generated; /api/regime/latest returns real data (Neutral 93.6%).
- **NEW: Clickable KPI cards → detail analysis pages** proving real data:
  - StatCard now accepts `to` prop (clickable, testid statcard-<metric>); route /analysis/:metric (MetricAnalysis.jsx).
  - Backend analysis.py: GET /api/analysis/mpt (Efficient Frontier upper-envelope + 2.5k Monte Carlo cloud + optimal point + monthly portfolio-vs-benchmark growth + weights) and GET /api/analysis/regime (current probs + weekly probability timeline + regime day-distribution + RandomForest feature importance from the saved .pkl).
  - sharpe/return/volatility → MPT charts; regime → regime charts. Back button returns to dashboard.
- Testing: iteration_2.json — backend 100%, frontend 100%, retest_needed=false.

## Update — 2026-09-18 (Cumulative Return: all tickers selectable)
- /api/returns-history now returns ALL 25 tickers (removed FEATURED 5 filter) + "tickers" list; per-column rebase from first valid value (supports later-listed assets).
- ReturnsLineChart: dynamic chips for all tickers with select-all (ทั้งหมด) / clear (ล้าง) + counter; 25-color palette; testids ticker-chip-<T>, tickers-select-all, tickers-clear, period-<p>. Verified via screenshots (default 5, all 25, custom TSLA+META).
