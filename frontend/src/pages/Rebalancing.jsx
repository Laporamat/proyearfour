import { useEffect, useState, useCallback } from 'react'
import { api } from '../hooks/useApi'
import s from './Rebalancing.module.css'

const fmt = (n, d = 2) =>
  n != null ? Number(n).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'

const ACTION_LABEL = { buy: 'ซื้อเพิ่ม', sell: 'ขาย', hold: 'ถือ' }
const ACTION_CLASS = { buy: 'buy', sell: 'sell', hold: 'hold' }

export default function Rebalancing() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // 1. ดึง portfolios
      const portfoliosResp = await api.listPortfolios()
      const portfolios = portfoliosResp?.portfolios || []
      if (!portfolios.length) {
        setError('ไม่มีพอร์ต — กรุณาเพิ่มหุ้นใน My Portfolio ก่อน')
        return
      }
      // 2. ดึง holdings ของพอร์ตแรก
      const holdingsResp = await api.getHoldings(portfolios[0].id)
      const holdings = holdingsResp?.items || []
      if (!holdings.length) {
        setError('ไม่มีหุ้นในพอร์ต — กรุณาเพิ่มหุ้นก่อน')
        return
      }
      // 3. เรียก rebalancing suggestions
      const result = await api.rebalancingSuggestions(holdings)
      setData(result)
    } catch (e) {
      setError(e.message || 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const regime = data?.regime
  const regimeLabel = regime?.regime || '—'
  const regimeCls = regimeLabel.toLowerCase()

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1>Rebalancing Suggestions</h1>
          <p className={s.sub}>
            แนะนำการปรับสัดส่วนพอร์ตตาม MPT + สภาวะตลาดปัจจุบัน
          </p>
        </div>
        <button className="btn btn-ghost" onClick={load} disabled={loading}>
          {loading ? <span className="spinner" /> : '↻ รีเฟรช'}
        </button>
      </header>

      {loading ? (
        <div className={`card ${s.empty}`}>กำลังคำนวณคำแนะนำ…</div>
      ) : error ? (
        <div className={`card ${s.empty}`}>{error}</div>
      ) : data ? (
        <>
          {/* ── Regime info ── */}
          {regime && (
            <div className={`card ${s.regimeCard}`}>
              <div className={s.regimeHead}>
                <h3>สภาวะตลาดปัจจุบัน</h3>
                <span className={`badge ${regimeCls}`}>{regimeLabel}</span>
              </div>
              <div className={s.regimeBars}>
                {[
                  { key: 'prob_bull', label: 'Bull', color: 'var(--green)' },
                  { key: 'prob_neutral', label: 'Neutral', color: 'var(--yellow)' },
                  { key: 'prob_bear', label: 'Bear', color: 'var(--red)' },
                ].map(({ key, label, color }) => {
                  const pct = ((regime[key] ?? 0) * 100)
                  return (
                    <div key={key} className={s.regimeRow}>
                      <span className={s.regimeLbl}>{label}</span>
                      <div className={s.regimeBg}>
                        <div className={s.regimeFill} style={{ width: `${pct.toFixed(1)}%`, background: color }} />
                      </div>
                      <span className={s.regimePct} style={{ color }}>{pct.toFixed(1)}%</span>
                    </div>
                  )
                })}
              </div>
              <p className={s.regimeNote}>
                {regimeLabel === 'Bull' && '🟢 ตลาดขาขึ้น — เพิ่มความเสี่ยง เน้น equity'}
                {regimeLabel === 'Bear' && '🔴 ตลาดขาลง — ลดความเสี่ยง เน้น bonds/safe'}
                {regimeLabel === 'Neutral' && '🟡 ตลาดทรงตัว — ใช้สัดส่วน MPT มาตรฐาน'}
              </p>
            </div>
          )}

          {/* ── Summary ── */}
          <div className={s.summary}>
            <div className={`card ${s.sumCard}`}>
              <span className={s.sumLabel}>มูลค่าพอร์ต</span>
              <span className={s.sumValue}>฿{fmt(data.total_value)}</span>
            </div>
            <div className={`card ${s.sumCard}`}>
              <span className={s.sumLabel}>สัดส่วนปัจจุบัน</span>
              <span className={s.sumValue}>{data.current_allocation.length} ตัว</span>
            </div>
            <div className={`card ${s.sumCard}`}>
              <span className={s.sumLabel}>สัดส่วนเป้าหมาย</span>
              <span className={s.sumValue}>{data.target_allocation.length} ตัว</span>
            </div>
          </div>

          {/* ── Suggestions table ── */}
          <div className={`card ${s.tableCard}`}>
            <h3 className={s.cardTitle}>คำแนะนำการปรับสัดส่วน</h3>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>หุ้น</th>
                    <th className={s.right}>สัดส่วนปัจจุบัน</th>
                    <th className={s.right}>สัดส่วนเป้าหมาย</th>
                    <th className={s.right}>มูลค่าปัจจุบัน</th>
                    <th className={s.right}>มูลค่าเป้าหมาย</th>
                    <th className={s.right}>ปรับ</th>
                    <th>การกระทำ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.suggestions.map(r => (
                    <tr key={r.ticker}>
                      <td className={s.ticker}>{r.ticker}</td>
                      <td className={s.right}>{fmt(r.current_weight)}%</td>
                      <td className={s.right}>{fmt(r.target_weight)}%</td>
                      <td className={s.right}>฿{fmt(r.current_value)}</td>
                      <td className={s.right}>฿{fmt(r.target_value)}</td>
                      <td className={`${s.right} ${r.diff_value >= 0 ? s.profit : s.loss}`}>
                        {r.diff_value >= 0 ? '+' : '-'}฿{fmt(Math.abs(r.diff_value))}
                      </td>
                      <td>
                        <span className={`${s.actionBadge} ${s[ACTION_CLASS[r.action]] || ''}`}>
                          {ACTION_LABEL[r.action]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Allocation comparison ── */}
          <div className={`card ${s.allocCard}`}>
            <h3 className={s.cardTitle}>เปรียบเทียบสัดส่วน: ปัจจุบัน vs เป้าหมาย</h3>
            <div className={s.allocBars}>
              {data.suggestions
                .filter(r => r.current_weight > 0.1 || r.target_weight > 0.1)
                .sort((a, b) => Math.max(b.current_weight, b.target_weight) - Math.max(a.current_weight, a.target_weight))
                .map(r => {
                  const maxW = Math.max(r.current_weight, r.target_weight, 1)
                  return (
                    <div key={r.ticker} className={s.allocRow}>
                      <span className={s.allocTicker}>{r.ticker}</span>
                      <div className={s.allocBarGroup}>
                        <div className={`${s.allocBar} ${s.allocCurrent}`} style={{ width: `${(r.current_weight / maxW) * 100}%` }}>
                          <span className={s.allocBarLabel}>{fmt(r.current_weight)}%</span>
                        </div>
                        <div className={`${s.allocBar} ${s.allocTarget}`} style={{ width: `${(r.target_weight / maxW) * 100}%` }}>
                          <span className={s.allocBarLabel}>{fmt(r.target_weight)}%</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
            <div className={s.legend}>
              <span><i className={`${s.dot} ${s.allocCurrent}`} /> สัดส่วนปัจจุบัน</span>
              <span><i className={`${s.dot} ${s.allocTarget}`} /> สัดส่วนเป้าหมาย (MPT + Regime)</span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
