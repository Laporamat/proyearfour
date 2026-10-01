import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../hooks/useApi'
import CandleChart from '../components/CandleChart'
import s from './Terminal.module.css'

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '1d', '1wk', '1mo']

const fmtPrice = (n) => n != null ? Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
const fmtDollar = (v) => {
  if (v == null) return '—'
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${Math.round(v)}`
}
const fmtPct = (n) => n == null ? '—' : `${n >= 0 ? '+' : ''}${Number(n).toFixed(2)}%`

export default function Terminal() {
  const [symbol, setSymbol] = useState('NVDA')
  const [tf, setTf] = useState('1h')
  const [candles, setCandles] = useState([])
  const [candleStatus, setCandleStatus] = useState('live')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [quotes, setQuotes] = useState([])
  const [quotesError, setQuotesError] = useState(false)
  const [search, setSearch] = useState('')
  const quoteTimer = useRef(null)
  const candleTimer = useRef(null)
  const reqRef = useRef(0)

  const loadCandles = useCallback(async (sym, timeframe) => {
    const id = ++reqRef.current
    setLoading(true)
    setError('')
    try {
      const data = await api.terminalCandles(sym, timeframe)
      if (id !== reqRef.current) return   // ignore out-of-order response
      setCandles(data?.candles || [])
      setCandleStatus(data?.status || 'live')
    } catch (e) {
      if (id !== reqRef.current) return
      setError(e.message || 'โหลดกราฟไม่สำเร็จ')
      setCandles([])
    } finally {
      if (id === reqRef.current) setLoading(false)
    }
  }, [])

  const loadQuotes = useCallback(async () => {
    try {
      const data = await api.terminalQuotes()
      if (data?.quotes) {
        setQuotes(data.quotes)
        setQuotesError(false)
      }
    } catch (e) {
      console.warn('terminal quotes failed:', e.message)
      setQuotesError(true)
    }
  }, [])

  // candles: refetch on symbol/tf change + every 60s
  useEffect(() => {
    loadCandles(symbol, tf)
    candleTimer.current = setInterval(() => loadCandles(symbol, tf), 60_000)
    return () => clearInterval(candleTimer.current)
  }, [symbol, tf, loadCandles])

  // quotes: poll every 30s
  useEffect(() => {
    loadQuotes()
    quoteTimer.current = setInterval(loadQuotes, 30_000)
    return () => clearInterval(quoteTimer.current)
  }, [loadQuotes])

  const quoteMap = useMemo(() => Object.fromEntries(quotes.map(q => [q.symbol, q])), [quotes])

  const header = useMemo(() => {
    const q = quoteMap[symbol]
    if (q) return { price: q.price, pct: q.change_pct }
    if (candles.length >= 2) {
      // fallback: change over the loaded window (consistent with the chart shown)
      const last = candles[candles.length - 1]
      const first = candles[0]
      return { price: last.c, pct: first.c ? ((last.c - first.c) / first.c) * 100 : 0 }
    }
    if (candles.length === 1) return { price: candles[0].c, pct: 0 }
    return { price: null, pct: null }
  }, [quoteMap, symbol, candles])

  const filtered = quotes.filter(q => q.symbol.toLowerCase().includes(search.toLowerCase()))
  const pct = header.pct
  const up = pct != null && pct >= 0

  return (
    <div className={s.page} data-testid="terminal-page">
      <div className={s.main}>
        {/* ── Toolbar ── */}
        <div className={s.toolbar}>
          <div className={s.symBadge} data-testid="terminal-symbol">
            <span className={s.symSource}>YAHOO</span>
            <span className={s.symName}>{symbol}</span>
          </div>

          <div className={s.tfGroup}>
            {TIMEFRAMES.map(t => (
              <button
                key={t}
                data-testid={`tf-btn-${t}`}
                className={`${s.tfBtn} ${tf === t ? s.tfActive : ''}`}
                onClick={() => setTf(t)}
              >{t}</button>
            ))}
          </div>

          <div className={s.price}>
            <span className={s.priceVal} data-testid="terminal-price">{fmtPrice(header.price)}</span>
            <span className={`${s.pricePct} ${pct == null ? s.muted : up ? s.pos : s.neg}`}>{fmtPct(pct)}</span>
          </div>

          <div className={s.status}>
            <span className={`pulse-dot ${candleStatus === 'live' ? 'green' : 'red'}`} />
            {candleStatus === 'live' ? 'Live' : 'Stale'}
          </div>
        </div>

        {/* ── Instrument header ── */}
        <div className={s.instrument}>
          <strong>{symbol}</strong>
          <span className={s.instrSub}>· USD · Yahoo Finance · {tf}</span>
        </div>

        {/* ── Chart ── */}
        <div className={s.chartArea}>
          {error
            ? <div className={s.error} data-testid="terminal-error">{error}</div>
            : <CandleChart candles={candles} tf={tf} loading={loading} />}
        </div>
      </div>

      {/* ── Watchlist ── */}
      <aside className={s.watchlist} data-testid="terminal-watchlist">
        <div className={s.wlHead}>
          <h2 className={s.wlTitle}>Watchlist</h2>
          <span className={s.wlCount}>{quotes.length} symbols</span>
        </div>

        <div className={s.wlSearch}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            data-testid="watchlist-search"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className={s.wlCols}>
          <span>SYMBOL</span>
          <span className={s.right}>PRICE</span>
          <span className={s.right}>24H VOL</span>
          <span className={s.right}>24H%</span>
        </div>

        <div className={s.wlRows}>
          {quotes.length === 0 && (
            <div className={s.wlEmpty} data-testid="watchlist-status">
              {quotesError ? 'โหลดราคาไม่สำเร็จ — ลองใหม่อีกครั้ง' : 'กำลังโหลดราคา…'}
            </div>
          )}
          {filtered.map(q => {
            const pos = q.change_pct >= 0
            return (
              <button
                key={q.symbol}
                data-testid={`watchlist-row-${q.symbol}`}
                className={`${s.wlRow} ${q.symbol === symbol ? s.wlRowActive : ''}`}
                onClick={() => setSymbol(q.symbol)}
              >
                <span className={s.wlSym}>
                  <span className={s.wlDot} style={{ background: pos ? '#26a69a' : '#ef5350' }} />
                  {q.symbol}
                </span>
                <span className={s.right}>{fmtPrice(q.price)}</span>
                <span className={`${s.right} ${s.muted}`}>{fmtDollar(q.dollar_vol)}</span>
                <span className={`${s.right} ${pos ? s.pos : s.neg}`}>{fmtPct(q.change_pct)}</span>
              </button>
            )
          })}
        </div>
      </aside>
    </div>
  )
}
