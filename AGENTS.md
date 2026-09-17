# QuantAI Portfolio System — Base44 Dev Environment

## Architecture
- **Frontend**: React 19 + Vite 8, dev server on port 3000. Proxies `/api` and `/health` to the backend via Vite's `server.proxy` (single-origin). `VITE_PROXY_TARGET` env var sets the backend URL (defaults to `http://127.0.0.1:8001` for local; set to `http://backend:8001` in Docker).
- **Backend**: FastAPI on port 8001, entrypoint is `server:app` (NOT `main:app` — `server.py` registers `live` and `auth` modules). Run with `uvicorn server:app --reload`.
- **Database**: MongoDB 7 for auth sessions, users, OTP, and password-reset tokens.

## Required env vars (set in docker-compose.base44.yml)
- `MONGO_URL` — MongoDB connection string (local infra, set in compose `environment:`)
- `DB_NAME` — MongoDB database name (local infra, set in compose `environment:`)

## Optional external credentials (via /run/base44/app.env)
- `OPENAI_API_KEY` — enables AI Chat with Function Calling. Without it, chat falls back to rule-based keyword matching.
- `RESEND_API_KEY` — enables email delivery (OTP, password reset). Without it, emails are skipped (OTP is logged to backend stdout).

## Auth
- Google OAuth via Emergent (`auth.emergentagent.com`) — no app-managed OAuth client.
- Email + password registration with OTP verification (requires RESEND_API_KEY for email delivery).
- Session cookie: `session_token`, httpOnly, Secure, SameSite=None, 7-day TTL.
- A demo user is seeded by the `seed` compose service: `demo@quantai.local` / `session_token=demo_session_persistent`. Set this cookie manually in the browser to test the dashboard without Google OAuth.

## Backend bootstrap
On startup, `live.py` runs a background pipeline: fetches 25 assets from Yahoo Finance → converts to THB → runs MPT optimizer → runs Regime classifier. This takes ~30s on first boot. CSV artifacts are written to `backend/output/`.

## Verify
- `curl http://localhost:3000/` → landing page
- `curl http://localhost:3000/health` (proxied) → backend health JSON
- `curl http://localhost:3000/api/prices/live` → live prices (may take ~30s after first boot)
