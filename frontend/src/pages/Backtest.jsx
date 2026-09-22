import { useEffect, useState, useCallback } from 'react'
import { api } from '../hooks/useApi'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import s from './Backtest.module.css'

const PERIODS = ['1m', '3m', '6m', '1y', '3y', 'all']
const COLORS = { buy_hold: 'var(--c1)', mpt: 'var(--c2)', regime: 'var(--c5)' }

export default function Backtest() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('1y')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.backtest('all', period)
      setData(res)
    } catch (e) { console.warn('backtest:', e.message) }
    finally { setLoading(false) }
  }, [period])

  useEffect(() => { load() }, [load])

  // Merge all strategy data for chart
  const chartData = []
  if (data?.strategies) {
    const keys = Object.keys(data.strategies)
    const maxLen = Math.max(...keys.map(k => data.strategies[k].data?.length || 0))
    for (let i = 0; i < maxLen; i++) {
      const row = {}
      for (const k of keys) {
        const d = data.strategies[k].data
        if (d && d[i]) { row.date = d[i].date; row[k] = d[i].value }
      }
      chartData.push(row)
    }
  }

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1>Backtesting</h1>
          <p className={s.sub}>ทดสอบกลยุทธ์การลงทุนย้อนหลัง — Buy & Hold vs MPT vs Regime-Based</p>
        </div>
        <div className={s.periods}>
          {PERIODS.map(p => (
            <button key={p} className={`${s.periodBtn} ${p === period ? s.active : ''}`} onClick={() => setPeriod(p)}>
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="card">กำลังคำนวณ backtest…</div>
      ) : data?.strategies ? (
        <>
          <div className={s.statsGrid}>
            {Object.entries(data.strategies).map(([key, st]) => (
              <div key={key} className={`card ${s.statCard}`}>
                <span className={s.statLabel}>{st.label}</span>
                <div className={s.statRow}>
                  <span className={s.statKey}>Return</span>
                  <span className={s.statVal} style={{ color: st.cumulative_return >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {st.cumulative_return >= 0 ? '+' : ''}{st.cumulative_return}%
                  </span>
                </div>
                <div className={s.statRow}>
                  <span className={s.statKey}>Sharpe</span>
                  <span className={s.statVal}>{st.sharpe}</span>
                </div>
                <div className={s.statRow}>
                  <span className={s.statKey}>Max DD</span>
                  <span className={s.statVal} style={{ color: 'var(--red)' }}>{st.max_drawdown}%</span>
                </div>
              </div>
            ))}
          </div>

          <div className={`card ${s.chartCard}`}>
            <h3>Cumulative Return (%)</h3>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {Object.keys(data.strategies).map(key => (
                  <Line key={key} type="monotone" dataKey={key} stroke={COLORS[key] || 'var(--c1)'} strokeWidth={2} dot={false} name={data.strategies[key].label} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="card">ไม่สามารถโหลดข้อมูล backtest ได้ — กรุณารัน pipeline ก่อน</div>
      )}
    </div>
  )
}
