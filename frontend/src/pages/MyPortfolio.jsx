import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../hooks/useApi'
import s from './MyPortfolio.module.css'

const TICKER_GROUPS = [
  { group: 'US', label: '🇺🇸 US Stocks', items: [
    'AAPL','MSFT','GOOGL','AMZN','NVDA','TSLA','META','JNJ','V','JPM',
  ]},
  { group: 'TH', label: '🇹🇭 Thai Stocks', items: [
    'PTT.BK','AOT.BK','CPALL.BK','BDMS.BK','DELTA.BK',
    'GULF.BK','ADVANC.BK','SCB.BK','KBANK.BK','PTTEP.BK',
  ]},
  { group: 'BD', label: '🏦 Bonds & Gold', items: [
    'TLT','IEF','SHY','GLD','BIL',
  ]},
]

const STORAGE_KEY = 'my-portfolio-holdings'

const fmt = (n, d = 2) =>
  n != null ? Number(n).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'

export default function MyPortfolio() {
  const [holdings, setHoldings] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [livePrices, setLivePrices] = useState({})
  const [liveMeta, setLiveMeta] = useState(null)
  const [form, setForm] = useState({ ticker: '', shares: '', date: '' })
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const timerRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings))
  }, [holdings])

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

  const handleAdd = async () => {
    setError('')
    if (!form.ticker || !form.shares || !form.date) {
      setError('กรุณากรอกข้อมูลให้ครบ')
      return
    }
    if (parseFloat(form.shares) <= 0) {
      setError('จำนวนหุ้นต้องมากกว่า 0')
      return
    }
    setAdding(true)
    try {
      const result = await api.priceAt(form.ticker, form.date)
      if (!result || result.close_thb == null) {
        setError('ไม่สามารถดึงราคาในวันที่เลือกได้')
        return
      }
      setHoldings(prev => [...prev, {
        id:       Date.now().toString(),
        ticker:   form.ticker,
        shares:   parseFloat(form.shares),
        buyDate:  result.date,
        buyPrice: result.close_thb,
      }])
      setForm({ ticker: '', shares: '', date: '' })
    } catch (e) {
      setError(e.message || 'เกิดข้อผิดพลาด')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = (id) =>
    setHoldings(prev => prev.filter(h => h.id !== id))

  const rows = holdings.map(h => {
    const currentPrice = livePrices[h.ticker] ?? null
    const cost   = h.buyPrice * h.shares
    const value  = currentPrice != null ? currentPrice * h.shares : null
    const pl     = value != null ? value - cost : null
    const plPct  = value != null && cost > 0 ? (pl / cost) * 100 : null
    return { ...h, currentPrice, cost, value, pl, plPct }
  })

  const totalCost  = rows.reduce((sum, r) => sum + r.cost, 0)
  const totalValue = rows.reduce((sum, r) => sum + (r.value ?? 0), 0)
  const totalPL    = totalValue - totalCost
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0

  return (
    <div className={s.page}>
      {/* Header */}
      <header className={s.header}>
        <div>
          <h1>My Portfolio</h1>
          <p className={s.sub}>
            ติดตามพอร์ต — เทียบราคาซื้อกับราคาปัจจุบัน
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

      {/* Summary */}
      {holdings.length > 0 && (
        <div className={s.summary}>
          <div className={`card ${s.sumCard}`}>
            <span className={s.sumLabel}>ต้นทุนรวม</span>
            <span className={s.sumValue}>฿{fmt(totalCost)}</span>
          </div>
          <div className={`card ${s.sumCard}`}>
            <span className={s.sumLabel}>มูลค่าปัจจุบัน</span>
            <span className={s.sumValue}>฿{fmt(totalValue)}</span>
          </div>
          <div className={`card ${s.sumCard} ${totalPL >= 0 ? s.profit : s.loss}`}>
            <span className={s.sumLabel}>กำไร/ขาดทุน</span>
            <span className={s.sumValue}>
              {totalPL >= 0 ? '+' : '-'}฿{fmt(Math.abs(totalPL))}
            </span>
          </div>
          <div className={`card ${s.sumCard} ${totalPL >= 0 ? s.profit : s.loss}`}>
            <span className={s.sumLabel}>ผลตอบแทน</span>
            <span className={s.sumValue}>
              {totalPLPct >= 0 ? '+' : ''}{fmt(totalPLPct)}%
            </span>
          </div>
        </div>
      )}

      {/* Add form */}
      <div className={`card ${s.formCard}`}>
        <h3>เพิ่มหุ้นที่ซื้อ</h3>
        <div className={s.form}>
          <select
            className={s.select}
            value={form.ticker}
            onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}
          >
            <option value="">เลือกหุ้น…</option>
            {TICKER_GROUPS.map(({ label, items }) => (
              <optgroup key={label} label={label}>
                {items.map(t => <option key={t} value={t}>{t}</option>)}
              </optgroup>
            ))}
          </select>
          <input
            className={s.input}
            type="number"
            placeholder="จำนวนหุ้น"
            value={form.shares}
            onChange={e => setForm(f => ({ ...f, shares: e.target.value }))}
            min="0"
            step="any"
          />
          <input
            className={s.input}
            type="date"
            value={form.date}
            max={new Date().toISOString().split('T')[0]}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          />
          <button
            className="btn btn-primary"
            onClick={handleAdd}
            disabled={adding}
          >
            {adding ? <span className="spinner" /> : 'เพิ่ม'}
          </button>
        </div>
        {error && <p className={s.error}>{error}</p>}
      </div>

      {/* Holdings table */}
      {holdings.length > 0 ? (
        <div className={`card ${s.tableCard}`}>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>หุ้น</th>
                  <th className={s.right}>จำนวน</th>
                  <th>วันที่ซื้อ</th>
                  <th className={s.right}>ราคาซื้อ (฿)</th>
                  <th className={s.right}>ราคาล่าสุด (฿)</th>
                  <th className={s.right}>มูลค่า (฿)</th>
                  <th className={s.right}>กำไร/ขาดทุน</th>
                  <th className={s.right}>%</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className={s.ticker}>{r.ticker}</td>
                    <td className={s.right}>{fmt(r.shares, 0)}</td>
                    <td className={s.dateCell}>{r.buyDate}</td>
                    <td className={s.right}>฿{fmt(r.buyPrice)}</td>
                    <td className={s.right}>
                      {r.currentPrice != null ? `฿${fmt(r.currentPrice)}` : '—'}
                    </td>
                    <td className={s.right}>
                      {r.value != null ? `฿${fmt(r.value)}` : '—'}
                    </td>
                    <td className={`${s.right} ${r.pl != null ? (r.pl >= 0 ? s.profit : s.loss) : ''}`}>
                      {r.pl != null ? `${r.pl >= 0 ? '+' : '-'}฿${fmt(Math.abs(r.pl))}` : '—'}
                    </td>
                    <td className={`${s.right} ${r.plPct != null ? (r.plPct >= 0 ? s.profit : s.loss) : ''}`}>
                      {r.plPct != null ? `${r.plPct >= 0 ? '+' : ''}${fmt(r.plPct)}%` : '—'}
                    </td>
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
          ยังไม่มีหุ้นในพอร์ต — เพิ่มหุ้นที่ซื้อด้านบนเพื่อเริ่มติดตามกำไร/ขาดทุน
        </div>
      )}
    </div>
  )
}
