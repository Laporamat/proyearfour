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
      } catch { /* ignore parse error */ }
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
}
