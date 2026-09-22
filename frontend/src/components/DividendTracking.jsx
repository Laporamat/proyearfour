import { useState } from 'react'
import { api } from '../hooks/useApi'
import s from './DividendTracking.module.css'

const fmt = (n, d = 2) =>
  n != null ? Number(n).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'

export default function DividendTracking({ holdings }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleFetch = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.dividends()
      setResult(data)
    } catch (e) {
      setError(e.message || 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  const dividends = result?.dividends || {}
  const tickers = Object.keys(dividends).sort()
  const totalAnnual = result?.totalAnnual || 0

  // Calculate total dividend received based on user's shares
  const userShares = {}
  for (const h of holdings) {
    userShares[h.ticker] = (userShares[h.ticker] || 0) + h.shares
  }

  const totalExpected = tickers.reduce((sum, t) => {
    const d = dividends[t]
    const shares = userShares[t] || 0
    return sum + (d.annualDividend * shares)
  }, 0)

  return (
    <div className={`card ${s.wrap}`}>
      <div className={s.head}>
        <div>
          <h3>ติดตามเงินปันผล (Dividend Tracking)</h3>
          <p className={s.sub}>ปันผลรายปี + ผลตอบแทนรวม (Total Return)</p>
        </div>
        <button className="btn btn-primary" onClick={handleFetch} disabled={loading || holdings.length === 0}>
          {loading ? <span className="spinner" /> : 'ดูปันผล'}
        </button>
      </div>

      {error && <p className={s.error}>{error}</p>}

      {result && !error && (
        <>
          <div className={s.summary}>
            <div className={s.sumItem}>
              <span className={s.sumLabel}>ปันผลรายปีรวม (ทุกหุ้น)</span>
              <span className={s.sumValue}>฿{fmt(totalAnnual)}</span>
            </div>
            <div className={s.sumItem}>
              <span className={s.sumLabel}>ปันผลที่คาดว่าจะได้ (ตามสัดส่วนถือ)</span>
              <span className={s.sumValue}>฿{fmt(totalExpected)}</span>
            </div>
          </div>

          {tickers.length > 0 ? (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>หุ้น</th>
                    <th className={s.right}>ปันผล/ปี (฿)</th>
                    <th className={s.right}>Yield</th>
                    <th className={s.right}>จำนวนหุ้นถือ</th>
                    <th className={s.right}>ปันผลที่ได้ (฿)</th>
                    <th>ประวัติล่าสุด</th>
                  </tr>
                </thead>
                <tbody>
                  {tickers.map(t => {
                    const d = dividends[t]
                    const shares = userShares[t] || 0
                    const expected = d.annualDividend * shares
                    const lastPay = d.history?.[d.history.length - 1]
                    return (
                      <tr key={t}>
                        <td className={s.ticker}>{t}</td>
                        <td className={s.right}>{d.annualDividend > 0 ? `฿${fmt(d.annualDividend)}` : '—'}</td>
                        <td className={s.right}>{d.yield > 0 ? `${fmt(d.yield)}%` : '—'}</td>
                        <td className={s.right}>{fmt(shares, 0)}</td>
                        <td className={s.right}>{expected > 0 ? `฿${fmt(expected)}` : '—'}</td>
                        <td className={s.dateCell}>{lastPay ? lastPay.date : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={s.empty}>ไม่มีข้อมูลปันผล</p>
          )}
        </>
      )}
    </div>
  )
}
