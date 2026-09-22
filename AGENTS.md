# Quantix Portfolio System — Base44 Dev Environment

## Architecture
- **Frontend**: React 19 + Vite 8 on port 3000 (single-origin). Vite proxies `/api` and `/health` to the backend.
- **Backend**: FastAPI on port 8001 (`server:app` is the entrypoint — imports main, live, auth, news, analysis modules).
- **Database**: MongoDB 7 (local compose service, auth enabled).
- **Wiring**: Single-origin — frontend dev server proxies API calls. `BACKEND_URL` env var (defaults to `http://127.0.0.1:8001` for local dev, set to `http://backend:8001` in compose).

## Required env vars (local infra, set in compose)
- `MONGO_URL` — MongoDB connection string (hard-required, `os.environ["MONGO_URL"]`)
- `DB_NAME` — MongoDB database name (hard-required, `os.environ["DB_NAME"]`)

## Optional external credentials (app boots without them)
- `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` — AI Chat feature (falls back gracefully if absent)
- `RESEND_API_KEY` / `SENDER_EMAIL` / `SENDER_NAME` — email OTP & password reset (falls back gracefully)

## Startup behavior
- Backend auto-bootstraps on startup: runs data pipeline (Yahoo Finance, 25 assets → THB), MPT optimizer, and regime classifier in the background. Dashboard populates itself once done.
- Live prices auto-fetch every 60s from Yahoo Finance.
- Backend pip install is heavy (~200+ packages including scipy, scikit-learn, pandas). First boot takes several minutes.

## How to verify
- `curl http://localhost:3000/` — should serve the landing page (HTML)
- `curl http://localhost:3000/health` — should return backend health JSON (proxied)
- `curl http://localhost:3000/api/prices/live` — live prices endpoint

## Notes
- `backend/.env` is loaded by main.py via manual parsing (not python-dotenv) but is empty; real config comes from compose environment.
- Vite config uses `allowedHosts: true` — accepts all preview hosts.
- The litellm dependency is a custom wheel from `customer-assets.emergentagent.com`.
