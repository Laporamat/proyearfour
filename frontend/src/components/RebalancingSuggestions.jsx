import { useState } from 'react'
import { api } from '../hooks/useApi'
import s from './RebalancingSuggestions.module.css'

const fmt = (n, d = 2) =>
  n != null ? Number(n).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'

export default function RebalancingSuggestions({ holdings, livePrices }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRebalance = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.rebalance(holdings)
      setResult(data)
    } catch (e) {
      setError(e.message || 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  const regime = result?.regime
  const suggestions = result?.suggestions || []

  return (
    <div className={`card ${s.wrap}`}>
      <div className={s.head}>
        <h3>แนะนำการปรับสัดส่วนพอร์ต (Rebalancing)</h3>
        <button className="btn btn-primary" onClick={handleRebalance} disabled={loading || holdings.length === 0}>
          {loading ? <span className="spinner" /> : 'วิเคราะห์'}
        </button>
      </div>

      {error && <p className={s.error}>{error}</p>}

      {regime && (
        <div className={s.regimeBadge} data-regime={regime.regime?.toLowerCase()}>
          <span className={s.regimeLabel}>สภาวะตลาดปัจจุบัน:</span>
          <strong>{regime.regime}</strong>
          <span className={s.regimeProbs}>
            Bull {regime.bull}% · Neutral {regime.neutral}% · Bear {regime.bear}%
          </span>
        </div>
      )}

      {result && suggestions.length === 0 && !error && (
        <p className={s.empty}>พอร์ตของคุณสัดส่วนใกล้เคียงเป้าหมายแล้ว — ไม่ต้องปรับ</p>
      )}

      {suggestions.length > 0 && (
        <>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>หุ้น</th>
                  <th className={s.right}>สัดส่วนปัจจุบัน</th>
                  <th className={s.right}>สัดส่วนเป้าหมาย</th>
                  <th className={s.right}>ส่วนต่าง</th>
                  <th>การกระทำ</th>
                  <th className={s.right}>มูลค่าที่ต้องซื้อ/ขาย</th>
                  <th className={s.right}>จำนวนหุ้น</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map(sug => (
                  <tr key={sug.ticker}>
                    <td className={s.ticker}>{sug.ticker}</td>
                    <td className={s.right}>{fmt(sug.currentWeight)}%</td>
                    <td className={s.right}>{fmt(sug.targetWeight)}%</td>
                    <td className={`${s.right} ${sug.drift >= 5 ? s.highDrift : ''}`}>
                      {fmt(sug.drift)}%
                    </td>
                    <td>
                      <span className={`${s.action} ${sug.action === 'BUY' ? s.buy : s.sell}`}>
                        {sug.action}
                      </span>
                    </td>
                    <td className={s.right}>฿{fmt(sug.tradeValue)}</td>
                    <td className={s.right}>{sug.sharesNeeded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={s.note}>
            *เป้าหมายคำนวณจาก MPT ปรับตามสภาวะตลาด (Regime) — ใน Bear market จะลดสัดส่วนหุ้นและเพิ่มสินทรัพย์ปลอดภัย
          </p>
        </>
      )}
    </div>
  )
}
