import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../hooks/useApi'
import s from './Watchlist.module.css'

const TICKER_GROUPS = [
  { label: '🇺🇸 US Stocks', items: ['AAPL','MSFT','GOOGL','AMZN','NVDA','TSLA','META','JNJ','V','JPM'] },
  { label: '🇹🇭 Thai Stocks', items: ['PTT.BK','AOT.BK','CPALL.BK','BDMS.BK','DELTA.BK','GULF.BK','ADVANC.BK','SCB.BK','KBANK.BK','PTTEP.BK'] },
  { label: '🏦 Bonds & Gold', items: ['TLT','IEF','SHY','GLD','BIL'] },
]

const STORAGE_KEY = 'watchlist-items'
const fmt = (n, d = 2) => n != null ? Number(n).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'

export default function Watchlist() {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [livePrices, setLivePrices] = useState({})
  const [liveMeta, setLiveMeta] = useState(null)
  const [form, setForm] = useState({ ticker: '', target: '', note: '' })
  const [error, setError] = useState('')
  const timerRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

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

  const handleAdd = () => {
    setError('')
    if (!form.ticker) { setError('กรุณาเลือกหุ้น'); return }
    if (items.some(i => i.ticker === form.ticker)) { setError('หุ้นนี้อยู่ใน Watchlist แล้ว'); return }
    const target = form.target ? parseFloat(form.target) : null
    if (form.target && target <= 0) { setError('ราคาเป้าหมายต้องมากกว่า 0'); return }
    setItems(prev => [...prev, {
      id:     Date.now().toString(),
      ticker: form.ticker,
      target,
      note:   form.note.trim(),
    }])
    setForm({ ticker: '', target: '', note: '' })
  }

  const handleDelete = (id) =>
    setItems(prev => prev.filter(i => i.id !== id))

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
      </header>

      {/* Add form */}
      <div className={`card ${s.formCard}`}>
        <h3>เพิ่มหุ้นที่ติดตาม</h3>
        <div className={s.form}>
          <select
            className={s.select}
            value={form.ticker}
            onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}
          >
            <option value="">เลือกหุ้น…</option>
            {TICKER_GROUPS.map(({ label, items: tickers }) => (
              <optgroup key={label} label={label}>
                {tickers.map(t => <option key={t} value={t}>{t}</option>)}
              </optgroup>
            ))}
          </select>
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
      {items.length > 0 ? (
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
