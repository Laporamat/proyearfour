/**
 * useApi — fetch wrapper สำหรับ FastAPI backend
 * Vite proxy: /api/* และ /health → http://127.0.0.1:8001
 */
import { useState, useCallback } from 'react'

/* ── safe JSON parser ─────────────────────────────
 * ป้องกัน "Unexpected end of JSON input"
 * เมื่อ backend offline / proxy ไม่มี server ฟัง
 * ─────────────────────────────────────────────── */
async function safeJson(res) {
  const text = await res.text()
  if (!text || !text.trim()) {
    throw new Error(`Server returned empty response (HTTP ${res.status})`)
  }
  try {
    return JSON.parse(text)
  } catch {
    // ตัดข้อความยาวให้สั้นลงก่อน throw
    const preview = text.slice(0, 120).replace(/\n/g, ' ')
    throw new Error(`Invalid JSON from server: "${preview}"`)
  }
}

/* ── core fetch ───────────────────────────────── */
async function apiFetch(path, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)   // 15s timeout

  try {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      signal: controller.signal,
      ...options,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      // พยายาม parse error message จาก body
      let detail = `HTTP ${res.status}`
      try {
        const err = await safeJson(res)
        detail = err.detail ?? err.message ?? detail
      } catch (e) {
        console.debug('could not parse error response body:', e.message)
      }
      throw new Error(detail)
    }

    return await safeJson(res)
  } catch (e) {
    clearTimeout(timeout)
    if (e.name === 'AbortError') throw new Error('Request timeout — backend ไม่ตอบสนอง')
    throw e
  }
}

/* ── React hook ───────────────────────────────── */
export function useApi() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const call = useCallback(async (path, options = {}) => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch(path, options)
      return data
    } catch (e) {
      setError(e.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { call, loading, error }
}

/* ── Standalone API helpers ───────────────────── */
export const api = {
  health: () =>
    apiFetch('/health'),

  portfolioLatest: () =>
    apiFetch('/api/portfolio/latest'),

  regimeLatest: () =>
    apiFetch('/api/regime/latest'),

  prices: (n = 10) =>
    apiFetch(`/api/prices?n=${n}`),

  livePrices: () =>
    apiFetch('/api/prices/live'),

  runPipeline: (body = {}) =>
    apiFetch('/api/pipeline', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  runMpt: (body = {}) =>
    apiFetch('/api/mpt', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  runRegime: (body = {}) =>
    apiFetch('/api/regime', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  chat: (body) =>
    apiFetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  returnsHistory: (period = '1y') =>
    apiFetch(`/api/returns-history?period=${period}`),

  news: (limit = 30) =>
    apiFetch(`/api/news?limit=${limit}`),

  analysisMpt: () =>
    apiFetch('/api/analysis/mpt'),

  analysisRegime: () =>
    apiFetch('/api/analysis/regime'),

  priceAt: (ticker, date) =>
    apiFetch(`/api/price/at?ticker=${encodeURIComponent(ticker)}&date=${encodeURIComponent(date)}`),

  // ── User data (portfolio, watchlist, tickers) ──
  getPortfolio: () =>
    apiFetch('/api/user/portfolio'),

  addHolding: (body) =>
    apiFetch('/api/user/portfolio', { method: 'POST', body: JSON.stringify(body) }),

  deleteHolding: (id) =>
    apiFetch(`/api/user/portfolio/${id}`, { method: 'DELETE' }),

  getWatchlist: () =>
    apiFetch('/api/user/watchlist'),

  addWatchlistItem: (body) =>
    apiFetch('/api/user/watchlist', { method: 'POST', body: JSON.stringify(body) }),

  deleteWatchlistItem: (id) =>
    apiFetch(`/api/user/watchlist/${id}`, { method: 'DELETE' }),

  checkAlerts: () =>
    apiFetch('/api/user/watchlist/check-alerts', { method: 'POST' }),

  getCustomTickers: () =>
    apiFetch('/api/user/tickers'),

  addCustomTicker: (ticker) =>
    apiFetch('/api/user/tickers', { method: 'POST', body: JSON.stringify({ ticker }) }),

  deleteCustomTicker: (ticker) =>
    apiFetch(`/api/user/tickers/${encodeURIComponent(ticker)}`, { method: 'DELETE' }),

  // ── Advanced analytics ──
  rebalancing: () =>
    apiFetch('/api/rebalancing'),

  backtest: (strategy = 'all', period = '1y') =>
    apiFetch(`/api/backtest?strategy=${strategy}&period=${period}`),

  dividends: (tickers = '') =>
    apiFetch(`/api/dividends${tickers ? `?tickers=${tickers}` : ''}`),

  retrainRegime: () =>
    apiFetch('/api/regime/retrain', { method: 'POST' }),

  altData: () =>
    apiFetch('/api/alt-data'),

  taxReport: () =>
    apiFetch('/api/tax-report'),

  taxCalc: (body) =>
    apiFetch('/api/tax-report/calculate', { method: 'POST', body: JSON.stringify(body) }),

  options: (ticker, expiry = '') =>
    apiFetch(`/api/options/${encodeURIComponent(ticker)}${expiry ? `?expiry=${expiry}` : ''}`),

  livePricesMulti: (currency = 'THB') =>
    apiFetch(`/api/prices/live?currency=${currency}`),

  // ── Custom portfolios ──
  listPortfolios: () =>
    apiFetch('/api/user/portfolios'),

  createPortfolio: (body) =>
    apiFetch('/api/user/portfolios', { method: 'POST', body: JSON.stringify(body) }),

  deletePortfolio: (key) =>
    apiFetch(`/api/user/portfolios/${key}`, { method: 'DELETE' }),

  getMultiPortfolio: (key) =>
    apiFetch(`/api/user/portfolio-multi/${key}`),

  addMultiHolding: (key, body) =>
    apiFetch(`/api/user/portfolio-multi/${key}`, { method: 'POST', body: JSON.stringify(body) }),

  deleteMultiHolding: (key, id) =>
    apiFetch(`/api/user/portfolio-multi/${key}/${id}`, { method: 'DELETE' }),

  // ── Social ──
  listShared: () =>
    apiFetch('/api/social/shared'),

  sharePortfolio: (body) =>
    apiFetch('/api/social/share', { method: 'POST', body: JSON.stringify(body) }),

  getShared: (shareId) =>
    apiFetch(`/api/social/${shareId}`),
}
