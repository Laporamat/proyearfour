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
