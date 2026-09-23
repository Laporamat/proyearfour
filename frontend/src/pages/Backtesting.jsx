import { useEffect, useState, useCallback } from 'react'
import { api } from '../hooks/useApi'
import s from './Backtesting.module.css'

const fmt = (n, d = 2) =>
  n != null ? Number(n).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'

const PERIODS = [
  { value: '1y', label: '1 ปี' },
  { value: '3y', label: '3 ปี' },
  { value: 'all', label: 'ทั้งหมด' },
]

// ── Simple SVG line chart for equity curves ──
function EquityChart({ strategies }) {
  if (!strategies?.length) return null

  // Gather all data points
  const allPoints = strategies.flatMap(s => s.equity_curve)
  if (!allPoints.length) return null

  const values = allPoints.map(p => p.value)
  const minV = Math.min(...values, 90)
  const maxV = Math.max(...values, 110)
  const range = maxV - minV || 1

  // Use first strategy's dates as x-axis
  const dates = strategies[0].equity_curve.map(p => p.date)
  const n = dates.length
  if (n < 2) return null

  const W = 600
  const H = 240
  const PAD = { l: 50, r: 16, t: 16, b: 30 }
  const cw = W - PAD.l - PAD.r
  const ch = H - PAD.t - PAD.b

  const x = i => PAD.l + (i / (n - 1)) * cw
  const y = v => PAD.t + ch - ((v - minV) / range) * ch

  // Y-axis ticks
  const yTicks = 4
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => minV + (range * i / yTicks))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.chart} preserveAspectRatio="xMidYMid meet">
      {/* Grid lines + Y labels */}
      {tickVals.map((v, i) => (
        <g key={i}>
          <line
            x1={PAD.l} y1={y(v)} x2={W - PAD.r} y2={y(v)}
            stroke="var(--border)" strokeWidth="1"
          />
          <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" className={s.axisLabel}>
            {fmt(v, 0)}
          </text>
        </g>
      ))}

      {/* X labels (first, middle, last) */}
      {[0, Math.floor(n / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i).map((idx, i) => (
        <text key={i} x={x(idx)} y={H - 8} textAnchor="middle" className={s.axisLabel}>
          {dates[idx]}
        </text>
      ))}

      {/* Strategy lines */}
      {strategies.map(s => {
        if (!s.equity_curve.length) return null
        const path = s.equity_curve.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`).join(' ')
        return (
          <g key={s.name}>
            <path d={path} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
          </g>
        )
      })}
    </svg>
  )
}

export default function Backtesting() {
  const [period, setPeriod] = useState('1y')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.backtest(period)
      setData(result)
    } catch (e) {
      setError(e.message || 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { load() }, [load])

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1>Backtesting</h1>
          <p className={s.sub}>
            ทดสอบกลยุทธ์การลงทุนย้อนหลัง — Buy & Hold vs MPT vs Regime-based
          </p>
        </div>
        <div className={s.periodBtns}>
          {PERIODS.map(p => (
            <button
              key={p.value}
              className={`${s.periodBtn} ${period === p.value ? s.periodActive : ''}`}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className={`card ${s.empty}`}>กำลังรัน backtest…</div>
      ) : error ? (
        <div className={`card ${s.empty}`}>{error}</div>
      ) : data ? (
        <>
          {/* ── Info ── */}
          <div className={s.infoBar}>
            <span>ช่วง: {data.start_date} → {data.end_date}</span>
            <span>จำนวนวัน: {data.n_days}</span>
          </div>

          {/* ── Equity curve chart ── */}
          <div className={`card ${s.chartCard}`}>
            <h3 className={s.cardTitle}>Equity Curves (เริ่มต้น = 100)</h3>
            <EquityChart strategies={data.strategies} />
            <div className={s.legend}>
              {data.strategies.map(s => (
                <span key={s.name}>
                  <i className={s.dot} style={{ background: s.color }} />
                  {s.name}
                </span>
              ))}
            </div>
          </div>

          {/* ── Comparison table ── */}
          <div className={`card ${s.tableCard}`}>
            <h3 className={s.cardTitle}>เปรียบเทียบผลตอบแทน</h3>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>กลยุทธ์</th>
                    <th className={s.right}>Total Return</th>
                    <th className={s.right}>CAGR</th>
                    <th className={s.right}>Sharpe</th>
                    <th className={s.right}>Max Drawdown</th>
                    <th className={s.right}>Volatility</th>
                  </tr>
                </thead>
                <tbody>
                  {data.comparison.map(c => (
                    <tr key={c.strategy}>
                      <td className={s.strategyName}>{c.strategy}</td>
                      <td className={`${s.right} ${c.total_return >= 0 ? s.profit : s.loss}`}>
                        {c.total_return >= 0 ? '+' : ''}{fmt(c.total_return)}%
                      </td>
                      <td className={`${s.right} ${c.cagr >= 0 ? s.profit : s.loss}`}>
                        {c.cagr >= 0 ? '+' : ''}{fmt(c.cagr)}%
                      </td>
                      <td className={s.right}>{fmt(c.sharpe, 4)}</td>
                      <td className={`${s.right} ${s.loss}`}>{fmt(c.max_drawdown)}%</td>
                      <td className={s.right}>{fmt(c.volatility)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Strategy cards ── */}
          <div className={s.strategyCards}>
            {data.strategies.map(s => (
              <div key={s.name} className={`card ${s.strategyCard}`}>
                <div className={s.strategyHead}>
                  <i className={s.strategyDot} style={{ background: s.color }} />
                  <h3>{s.name}</h3>
                </div>
                <p className={s.strategyDesc}>{s.description}</p>
                <div className={s.strategyMetrics}>
                  <div className={s.metric}>
                    <span className={s.metricLabel}>Return</span>
                    <span className={`${s.metricValue} ${s.metrics.total_return >= 0 ? s.profit : s.loss}`}>
                      {s.metrics.total_return >= 0 ? '+' : ''}{fmt(s.metrics.total_return)}%
                    </span>
                  </div>
                  <div className={s.metric}>
                    <span className={s.metricLabel}>Sharpe</span>
                    <span className={s.metricValue}>{fmt(s.metrics.sharpe, 4)}</span>
                  </div>
                  <div className={s.metric}>
                    <span className={s.metricLabel}>Max DD</span>
                    <span className={`${s.metricValue} ${s.loss}`}>{fmt(s.metrics.max_drawdown)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
