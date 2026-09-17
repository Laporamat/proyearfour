import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useChart } from '../context/ChartContext'
import { api } from '../hooks/useApi'
import s from './ReturnsLineChart.module.css'

const TICKERS = ['NVDA', 'AAPL', 'DELTA.BK', 'GLD', 'KBANK.BK']
const HEX     = ['#5b73f5','#23c97d','#e8a825','#e85c5c','#a78bfa']
const PERIODS = [
  { v: '1d', l: '1D' }, { v: '1w', l: '1W' }, { v: '1m', l: '1M' }, { v: '3m', l: '3M' },
  { v: '6m', l: '6M' }, { v: '1y', l: '1Y' }, { v: '3y', l: '3Y' }, { v: 'all', l: 'ALL' },
]

/* sort payload highest → lowest for tooltip */
function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const sorted = [...payload].filter(p => p.value != null).sort((a, b) => b.value - a.value)
  return (
    <div className={s.tip}>
      <p className={s.tipDate}>{label}</p>
      {sorted.map((p, i) => (
        <div key={i} className={s.tipRow}>
          <span className={s.tipDot} style={{ background: p.color }} />
          <span className={s.tipTicker}>{p.name}</span>
          <span className={s.tipVal} style={{ color: p.value >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {p.value >= 0 ? '+' : ''}{p.value.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  )
}

export default function ReturnsLineChart({ height = 210 }) {
  const { lastUpdated, regime } = useChart()
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [period,  setPeriod]  = useState('1y')
  const [active,  setActive]  = useState(new Set(TICKERS))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.returnsHistory(period)
      setData(res?.data ?? [])
    } catch { setData([]) }
    setLoading(false)
  }, [period])

  useEffect(() => { load() }, [load, lastUpdated])

  const toggle = t => setActive(prev => {
    const next = new Set(prev)
    next.has(t) ? next.delete(t) : next.add(t)
    return next
  })

  return (
    <div className={s.wrap}>
      {/* header */}
      <div className={s.header}>
        <h3>Cumulative Return</h3>
        <div className={s.periods}>
          {PERIODS.map(p => (
            <button key={p.v}
              className={`${s.pBtn} ${period === p.v ? s.pActive : ''}`}
              onClick={() => setPeriod(p.v)}>{p.l}
            </button>
          ))}
        </div>
      </div>

      {/* ticker chips */}
      <div className={s.chips}>
        {TICKERS.map((t, i) => (
          <button key={t}
            className={`${s.chip} ${active.has(t) ? s.chipOn : ''}`}
            style={active.has(t) ? { borderColor: HEX[i], color: HEX[i], background: HEX[i] + '22' } : {}}
            onClick={() => toggle(t)}
          >{t}</button>
        ))}
      </div>

      {/* chart */}
      {loading
        ? <div className={`skeleton ${s.chartSkel}`} style={{ height }} />
        : data.length
          ? (
            <ResponsiveContainer width="100%" height={height}>
              <AreaChart data={data} margin={{ top: 6, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  {TICKERS.map((t, i) => (
                    <linearGradient key={t} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={HEX[i]} stopOpacity={0.30} />
                      <stop offset="60%"  stopColor={HEX[i]} stopOpacity={0.08} />
                      <stop offset="100%" stopColor={HEX[i]} stopOpacity={0.00} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" vertical={false} />
                <XAxis dataKey="date"
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  axisLine={false} tickLine={false} interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`}
                />
                <Tooltip content={<Tip />}
                  cursor={{ stroke: 'rgba(15,23,42,0.15)', strokeWidth: 1, strokeDasharray: '4 3' }}
                />
                <ReferenceLine y={0} stroke="rgba(15,23,42,0.12)" strokeDasharray="4 3" />
                {TICKERS.map((t, i) => active.has(t) && (
                  <Area key={t} type="monotone"
                    dataKey={t} name={t}
                    stroke={HEX[i]} strokeWidth={2}
                    fill={`url(#g${i})`}
                    dot={false} activeDot={{ r: 4, fill: HEX[i], strokeWidth: 0 }}
                    animationDuration={500} isAnimationActive
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )
          : (
            <div className={s.empty} style={{ height }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              </svg>
              <p>รัน Pipeline เพื่อโหลดข้อมูล</p>
            </div>
          )
      }

      {/* regime footer */}
      {regime && (
        <div className={s.regimeFoot}>
          <span className={s.regimeLabel}>Regime ล่าสุด:</span>
          <span className={`badge ${regime.regime?.toLowerCase()}`}>{regime.regime}</span>
          <span className={s.regimeProbs}>
            🐂 {(regime.prob_bull * 100).toFixed(1)}%
            &nbsp;⚖️ {(regime.prob_neutral * 100).toFixed(1)}%
            &nbsp;🐻 {(regime.prob_bear * 100).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  )
}
