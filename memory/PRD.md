# QuantAI Portfolio Dashboard — PRD

## Problem Statement
User request: "แก้หน้า frontend เอาแบบคลีนๆ" (Make the frontend cleaner / minimal).

## Stack
- Frontend: Vite + React 19 + React Router + Recharts
- Backend: FastAPI (Python) — not in scope for this task
- Serving: supervisor `frontend` on port 3000 (`yarn start` → `vite --host 0.0.0.0 --port 3000`)

## What's Implemented (2026-01)
- Full visual overhaul from heavy dark neon dashboard → clean minimal **light** theme
- New design tokens in `src/index.css`:
  - Off-white bg (#fafaf9), pure white cards, subtle slate borders
  - Single restrained blue accent (#2f5bd6), no glows, no color-tinted hover shadows
  - Softer status colors (green/red/amber) with 10% alpha wash
  - Font swapped from Inter → **Geist** (distinctive, less generic)
- Removed dark-mode residue in `StatCard.module.css` (glow orbs, colored hover halos)
- Simplified `Layout.module.css` (no logo glow, no accent-glow on active nav bar)
- Simplified `Chat.module.css` (flat send button, solid-accent user bubbles for contrast, flat suggestion chips)
- Patched hardcoded `rgba(255,255,255,…)` values in `ReturnsLineChart.jsx` to slate rgba so grid/cursor/reference lines render on light bg
- Added missing peer dep `react-is` (needed by Recharts on React 19)
- Fixed dev-server host binding + `allowedHosts: true` in `vite.config.js` and added `yarn start` script so supervisor can boot Vite

## Backlog / Ideas
- P1: Dark-mode toggle (keep the new light theme, add a compact toggle in the sidebar footer)
- P1: Densify the price table into a proper sortable, sticky-header table with tabular numerals
- P2: Add a subtle top-of-card KPI trend sparkline (7-day) instead of just an icon
- P2: Add a keyboard shortcut palette (⌘K) for jumping to actions like Pipeline/MPT/Regime
