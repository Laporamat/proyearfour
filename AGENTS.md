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
- `ProtectedRoute` wraps `/dashboard`, `/chat`, `/analysis/:metric`.

## Verification
- Health check: `curl http://localhost:8001/health` → `{"status": "ok", ...}`
- Frontend: `curl http://localhost:3000/` → landing page HTML.
- Live prices: `curl http://localhost:8001/api/prices/live` (may take ~30s on first boot while pipeline runs).
