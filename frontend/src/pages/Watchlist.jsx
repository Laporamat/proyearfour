import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../hooks/useApi'
import { TICKER_GROUPS, ALL_PREDEFINED } from '../lib/tickers'
import s from './Watchlist.module.css'

const fmt = (n, d = 2) => n != null ? Number(n).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'

export default function Watchlist() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [livePrices, setLivePrices] = useState({})
  const [liveMeta, setLiveMeta] = useState(null)
  const [form, setForm] = useState({ ticker: '', target: '', note: '' })
  const [error, setError] = useState('')
  const [customTickers, setCustomTickers] = useState([])
  const [alertMsg, setAlertMsg] = useState('')
  const timerRef = useRef(null)

  // ── Load watchlist from backend ──
  const loadWatchlist = useCallback(async () => {
    try {
      const data = await api.getWatchlist()
      setItems(data?.items || [])
    } catch (e) {
      console.warn('failed to load watchlist:', e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Load custom tickers ──
  const loadCustomTickers = useCallback(async () => {
    try {
      const data = await api.getCustomTickers()
      setCustomTickers(data?.tickers || [])
    } catch (e) {
      console.warn('failed to load custom tickers:', e.message)
    }
  }, [])

  useEffect(() => {
    loadWatchlist()
    loadCustomTickers()
  }, [loadWatchlist, loadCustomTickers])

  const loadLive = useCallback(async () => {
    try {
      const live = await api.livePrices()
      if (live?.prices) {
        setLivePrices(live.prices)
        setLiveMeta(live)
      }
    } catch (e) {
      console.warn('live prices fetch failed:', e.message)
    }
  }, [])

  useEffect(() => {
    loadLive()
    timerRef.current = setInterval(loadLive, 60_000)
    return () => clearInterval(timerRef.current)
  }, [loadLive])

  // ── Check price alerts when live prices update ──
  useEffect(() => {
    if (items.length > 0 && Object.keys(livePrices).length > 0) {
      api.checkAlerts().catch(e => console.warn('alert check failed:', e.message))
    }
  }, [livePrices, items.length])

  const handleAdd = async () => {
    setError('')
    const ticker = form.ticker.trim().toUpperCase()
    if (!ticker) { setError('กรุณาเลือกหุ้น'); return }
    if (items.some(i => i.ticker === ticker)) { setError('หุ้นนี้อยู่ใน Watchlist แล้ว'); return }
    const target = form.target ? parseFloat(form.target) : null
    if (form.target && target <= 0) { setError('ราคาเป้าหมายต้องมากกว่า 0'); return }
    try {
      const item = await api.addWatchlistItem({
        ticker,
        target,
        note: form.note.trim(),
      })
      if (item) {
        setItems(prev => [...prev, item])
        // If custom ticker, add to custom list
        if (!ALL_PREDEFINED.includes(ticker)) {
          await api.addCustomTicker(ticker)
          setCustomTickers(prev => prev.includes(ticker) ? prev : [...prev, ticker])
        }
      }
      setForm({ ticker: '', target: '', note: '' })
    } catch (e) {
      setError(e.message || 'เกิดข้อผิดพลาด')
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.deleteWatchlistItem(id)
      setItems(prev => prev.filter(i => i.id !== id))
    } catch (e) {
      console.warn('delete failed:', e.message)
    }
  }

  const handleCheckAlerts = async () => {
    setAlertMsg('')
    try {
      const result = await api.checkAlerts()
      if (result?.alerts_sent > 0) {
        setAlertMsg(`ส่งการแจ้งเตือน ${result.alerts_sent} รายการทางอีเมล ✓`)
      } else {
        setAlertMsg('ยังไม่มีหุ้นที่ถึงราคาเป้าหมาย')
      }
    } catch (e) {
      setAlertMsg('ตรวจสอบไม่สำเร็จ: ' + e.message)
    }
  }

  const rows = items.map(item => {
    const current = livePrices[item.ticker] ?? null
    const diff = current != null && item.target ? current - item.target : null
    const diffPct = current != null && item.target ? (diff / item.target) * 100 : null
    const hit = current != null && item.target && current <= item.target
    return { ...item, current, diff, diffPct, hit }
  })

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1>Watchlist</h1>
          <p className={s.sub}>
            ติดตามหุ้นที่สนใจ — ตั้งราคาเป้าหมาย รอจังหวะเข้าซื้อ
            {liveMeta?.date && <> · <time>{liveMeta.date}</time></>}
            {liveMeta && (
              <span className={s.liveBadge}>
                <span className={`pulse-dot ${liveMeta.status === 'live' ? 'green' : 'red'}`} />
                {liveMeta.status === 'live' ? 'Live' : 'Stale'}
              </span>
            )}
          </p>
        </div>
        {items.length > 0 && (
          <button className="btn btn-ghost" onClick={handleCheckAlerts}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            ตรวจสอบการแจ้งเตือน
          </button>
        )}
      </header>

      {alertMsg && <p className={s.alertMsg}>{alertMsg}</p>}

      {/* Add form */}
      <div className={`card ${s.formCard}`}>
        <h3>เพิ่มหุ้นที่ติดตาม</h3>
        <div className={s.form}>
          <input
            className={`${s.select} ${s.tickerInput}`}
            type="text"
            list="wl-ticker-list"
            placeholder="เลือกหรือพิมพ์ ticker…"
            value={form.ticker}
            onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
          />
          <datalist id="wl-ticker-list">
            {TICKER_GROUPS.flatMap(g => g.items).map(t => <option key={t} value={t} />)}
            {customTickers.map(t => <option key={t} value={t} />)}
          </datalist>
          <input
            className={s.input}
            type="number"
            placeholder="ราคาเป้าหมาย (฿)"
            value={form.target}
            onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
            min="0"
            step="any"
          />
          <input
            className={s.inputWide}
            type="text"
            placeholder="หมายเหตุ (ทางเลือก)"
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
          />
          <button className="btn btn-primary" onClick={handleAdd}>เพิ่ม</button>
        </div>
        {error && <p className={s.error}>{error}</p>}
      </div>

      {/* Table */}
      {loading ? (
        <div className={`card ${s.empty}`}>กำลังโหลด…</div>
      ) : items.length > 0 ? (
        <div className={`card ${s.tableCard}`}>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>หุ้น</th>
                  <th className={s.right}>ราคาปัจจุบัน (฿)</th>
                  <th className={s.right}>ราคาเป้าหมาย (฿)</th>
                  <th className={s.right}>ห่างจากเป้า (%)</th>
                  <th>สถานะ</th>
                  <th>หมายเหตุ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className={s.ticker}>{r.ticker}</td>
                    <td className={s.right}>
                      {r.current != null ? `฿${fmt(r.current)}` : '—'}
                    </td>
                    <td className={s.right}>
                      {r.target != null ? `฿${fmt(r.target)}` : '—'}
                    </td>
                    <td className={`${s.right} ${r.diffPct != null ? (r.diffPct <= 0 ? s.near : s.far) : ''}`}>
                      {r.diffPct != null
                        ? `${r.diffPct >= 0 ? '+' : ''}${fmt(r.diffPct)}%`
                        : '—'}
                    </td>
                    <td>
                      {r.hit
                        ? <span className={`${s.badge} ${s.hitBadge}`}>🎯 ถึงเป้าแล้ว</span>
                        : r.target != null && r.current != null
                          ? <span className={s.badge}>รอซื้อ</span>
                          : <span className={s.badge}>—</span>}
                    </td>
                    <td className={s.noteCell}>{r.note || '—'}</td>
                    <td>
                      <button className={s.delBtn} onClick={() => handleDelete(r.id)} title="ลบ">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={`card ${s.empty}`}>
          ยังไม่มีหุ้นใน Watchlist — เพิ่มหุ้นที่สนใจด้านบนเพื่อติดตามราคาและรอจังหวะเข้าซื้อ
        </div>
      )}
    </div>
  )
}
