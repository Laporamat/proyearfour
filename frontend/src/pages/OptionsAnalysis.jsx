import { useEffect, useState, useCallback } from 'react'
import { api } from '../hooks/useApi'
import { TICKER_GROUPS } from '../lib/tickers'
import s from './OptionsAnalysis.module.css'

const ALL_TICKERS = TICKER_GROUPS.flatMap(g => g.items).filter(t => !t.endsWith('.BK'))

export default function OptionsAnalysis() {
  const [ticker, setTicker] = useState('AAPL')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expiry, setExpiry] = useState('')

  const load = useCallback(async () => {
    if (!ticker) return
    setLoading(true)
    try {
      const res = await api.options(ticker, expiry)
      setData(res)
    } catch (e) { console.warn('options:', e.message) }
    finally { setLoading(false) }
  }, [ticker, expiry])

  useEffect(() => { load() }, [load])

  const renderTable = (rows, type) => {
    if (!rows?.length) return null
    const top = rows.slice(0, 15)
    return (
      <div className={`card ${s.chainCard}`}>
        <h3>{type === 'call' ? 'Calls' : 'Puts'} <span className={s.count}>{rows.length}</span></h3>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.right}>Strike</th>
                <th className={s.right}>Last</th>
                <th className={s.right}>Bid</th>
                <th className={s.right}>Ask</th>
                <th className={s.right}>Vol</th>
                <th className={s.right}>OI</th>
                <th className={s.right}>IV</th>
                <th>ITM</th>
              </tr>
            </thead>
            <tbody>
              {top.map((r, i) => (
                <tr key={i} className={r.inTheMoney ? s.itm : ''}>
                  <td className={s.right}>{r.strike}</td>
                  <td className={s.right}>{r.lastPrice}</td>
                  <td className={s.right}>{r.bid}</td>
                  <td className={s.right}>{r.ask}</td>
                  <td className={s.right}>{r.volume?.toLocaleString() || '—'}</td>
                  <td className={s.right}>{r.openInterest?.toLocaleString() || '—'}</td>
                  <td className={s.right}>{(r.impliedVolatility * 100).toFixed(1)}%</td>
                  <td>{r.inTheMoney ? '✓' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1>Options Analysis</h1>
          <p className={s.sub}>Options chain — Calls, Puts, Implied Volatility (จาก Yahoo Finance)</p>
        </div>
      </header>

      <div className={`card ${s.controlCard}`}>
        <div className={s.controls}>
          <input
            className={s.input}
            type="text"
            list="opt-tickers"
            placeholder="Ticker…"
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
          />
          <datalist id="opt-tickers">
            {ALL_TICKERS.map(t => <option key={t} value={t} />)}
          </datalist>
          {data?.expirations?.length > 0 && (
            <select className={s.select} value={expiry} onChange={e => setExpiry(e.target.value)}>
              {data.expirations.map(exp => <option key={exp} value={exp}>{exp}</option>)}
            </select>
          )}
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            {loading ? <span className="spinner" /> : 'ดึง Options'}
          </button>
        </div>
        {data?.spot && (
          <div className={s.spotInfo}>
            Spot: <strong>${data.spot}</strong> · Expiry: <strong>{data.expiry}</strong>
          </div>
        )}
      </div>

      {data?.error ? (
        <div className="card">{data.error}</div>
      ) : data?.calls ? (
        <div className={s.chains}>
          {renderTable(data.calls, 'call')}
          {renderTable(data.puts, 'put')}
        </div>
      ) : loading ? (
        <div className="card">กำลังดึง options chain…</div>
      ) : null}
    </div>
  )
}
