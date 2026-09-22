import { useEffect, useState, useCallback } from 'react'
import { api } from '../hooks/useApi'
import s from './Dividends.module.css'

export default function Dividends() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await api.dividends()
      setData(res)
    } catch (e) { console.warn('dividends:', e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1>Dividend Tracking</h1>
          <p className={s.sub}>ประวัติเงินปันผลของหุ้นทั้งหมด — หน่วย THB (แปลงจาก USD อัตโนมัติ)</p>
        </div>
      </header>

      {loading ? (
        <div className="card">กำลังดึงข้อมูลเงินปันผล…</div>
      ) : data?.summary?.length ? (
        <>
          <div className={s.summaryGrid}>
            {data.summary.map(sm => (
              <div key={sm.ticker} className={`card ${s.sumCard}`}>
                <span className={s.sumTicker}>{sm.ticker}</span>
                <span className={s.sumTotal}>฿{sm.total.toFixed(2)}</span>
                <span className={s.sumMeta}>{sm.count} ครั้ง · ล่าสุด {sm.last_date}</span>
              </div>
            ))}
          </div>

          <div className={`card ${s.tableCard}`}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>วันที่จ่าย</th>
                  <th className={s.right}>จำนวน (฿)</th>
                </tr>
              </thead>
              <tbody>
                {data.dividends.map((d, i) => (
                  <tr key={i}>
                    <td className={s.ticker}>{d.ticker}</td>
                    <td>{d.date}</td>
                    <td className={s.right}>{d.amount.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="card">ไม่พบข้อมูลเงินปันผล หรือกำลังดึงจาก Yahoo Finance…</div>
      )}
    </div>
  )
}
