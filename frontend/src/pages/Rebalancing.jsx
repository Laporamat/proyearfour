import { useEffect, useState, useCallback } from 'react'
import { api } from '../hooks/useApi'
import s from './Rebalancing.module.css'

export default function Rebalancing() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await api.rebalancing()
      setData(res)
    } catch (e) { console.warn('rebalancing:', e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1>Rebalancing Suggestions</h1>
          <p className={s.sub}>แนะนำการปรับสัดส่วนพอร์ตตาม MPT + สภาวะตลาดปัจจุบัน</p>
        </div>
      </header>

      {loading ? (
        <div className="card">กำลังคำนวณ…</div>
      ) : data ? (
        <>
          <div className={s.regimeBar}>
            <span className={`badge ${data.regime.toLowerCase()}`}>{data.regime}</span>
            <span className={s.regimeText}>
              Bull {Math.round(data.regime_probs.bull * 100)}% ·
              Neutral {Math.round(data.regime_probs.neutral * 100)}% ·
              Bear {Math.round(data.regime_probs.bear * 100)}%
            </span>
            <span className={s.note}>{data.note}</span>
          </div>

          <div className={`card ${s.tableCard}`}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>กลุ่ม</th>
                  <th className={s.right}>น้ำหนักแนะนำ</th>
                  <th>การกระทำ</th>
                </tr>
              </thead>
              <tbody>
                {data.weights.map(w => (
                  <tr key={w.ticker}>
                    <td className={s.ticker}>{w.ticker}</td>
                    <td><span className={s.group}>{w.group}</span></td>
                    <td className={s.right}>{w.weight}%</td>
                    <td>
                      <span className={`${s.action} ${s['action' + w.action]}`}>{w.action}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="card">ไม่สามารถโหลดข้อมูลได้ — กรุณารัน pipeline ก่อน</div>
      )}
    </div>
  )
}
