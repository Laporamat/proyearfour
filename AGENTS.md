# Quantix Portfolio System — Base44 Dev Notes

## Architecture
- **Frontend**: React 19 + Vite 8 on port 3000 (`frontend/`). Vite proxies `/api` and `/health` to the backend.
- **Backend**: FastAPI on port 8001 (`backend/`). Entry point is `server:app` (not `main:app`) — `server.py` imports `main.app` then registers `live`, `auth`, `news`, `analysis` modules.
- **Database**: MongoDB 7 (compose service `mongo`). Required env vars `MONGO_URL` and `DB_NAME` are set via compose `environment:`.
- **Data**: Yahoo Finance via `yfinance` (no API key needed). On startup, `live.py` bootstraps the full pipeline (data → MPT → regime) in the background, writing CSVs to `backend/output/`.

## Setup
- `docker compose -f docker-compose.base44.yml up -d --build` starts everything.
- Backend deps are baked into `backend.Dockerfile` (filters out `litellm` — private wheel, not used in code).
- Frontend deps install at container startup (`npm install` then `npm run dev`).
- `vite.config.js` reads `VITE_PROXY_TARGET` env var for the proxy target (defaults to `127.0.0.1:8001` for local dev; set to `http://backend:8001` in compose).

## Optional External Credentials
- `OPENAI_API_KEY` — enables real LLM chat with function calling. Without it, the chat endpoint falls back to rule-based keyword matching.
- `RESEND_API_KEY` — enables email OTP/password reset. Without it, email sending is skipped gracefully.
- Both are optional; the app boots and serves the dashboard without them.

## Auth
- Google OAuth via Emergent (`/api/auth/session` with `X-Session-ID`).
- Email/password registration with OTP verification (`/api/auth/register` → `/api/auth/verify-otp`).
- Session cookie: `session_token`, httpOnly, Secure, SameSite=None.
- `ProtectedRoute` wraps `/dashboard`, `/chat`, `/analysis/:metric`, `/portfolio`, `/watchlist`.

## My Portfolio & Watchlist
- My Portfolio (`/portfolio`): track stock holdings with buy date → backend fetches historical price via `/api/price/at` (yfinance, converts USD→THB). P/L shown against live prices. Data persisted in MongoDB via `/api/user/portfolio` CRUD endpoints.
- Watchlist (`/watchlist`): track stocks with price targets, shows live price vs target. Data persisted in MongoDB via `/api/user/watchlist` CRUD endpoints.
- Portfolio Comparison: component in My Portfolio that compares user's actual allocation vs MPT optimal weights.
- CSV Export: My Portfolio has an "Export CSV" button to download the holdings table.
- Price Alerts: Watchlist checks alerts via `/api/user/watchlist/check-alerts` — sends email when a ticker hits its target price. Requires `RESEND_API_KEY`.
- Custom Tickers: users can type any ticker (not limited to the 25 predefined). Custom tickers are stored in MongoDB via `/api/user/tickers`.

## Settings & Theme
- Settings page (`/settings`): profile editing, change password, delete account. Protected route.
- Dark mode: `ThemeContext` toggles `data-theme` on `<html>`. Toggle button in sidebar footer. Persisted in localStorage.
- Auth endpoints: `/api/auth/change-password`, `/api/auth/profile` (PATCH), `/api/auth/account` (DELETE).

## Verification
- Health check: `curl http://localhost:8001/health` → `{"status": "ok", ...}`
- Frontend: `curl http://localhost:3000/` → landing page HTML.
- Live prices: `curl http://localhost:8001/api/prices/live` (may take ~30s on first boot while pipeline runs).
