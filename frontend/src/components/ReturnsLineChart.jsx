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
const PERIODS = ['6m','1y','3y','all']

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className={s.tip}>
      <p className={s.tipDate}>{label}</p>
      {payload.filter(p => p.value != null).map((p, i) => (
        <p key={i} style={{ color: p.color }} className={s.tipRow}>
          {p.name} <strong>{p.value.toFixed(2)}%</strong>
        </p>
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

  const toggle = t =>
    setActive(prev => {
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
            <button
              key={p}
              className={`${s.pBtn} ${period === p ? s.pActive : ''}`}
              onClick={() => setPeriod(p)}
            >{p}</button>
          ))}
        </div>
      </div>

      {/* ticker toggles */}
      <div className={s.chips}>
        {TICKERS.map((t, i) => (
          <button
            key={t}
            className={`${s.chip} ${active.has(t) ? s.chipOn : ''}`}
            style={active.has(t) ? { borderColor: HEX[i], color: HEX[i] } : {}}
            onClick={() => toggle(t)}
          >{t}</button>
        ))}
      </div>

      {/* chart */}
      {loading ? (
        <div className={`skeleton ${s.chartSkel}`} style={{ height }} />
      ) : data.length ? (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 4, right: 2, left: -18, bottom: 0 }}>
            <defs>
              {TICKERS.map((t, i) => (
                <linearGradient key={t} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={HEX[i]} stopOpacity={0.20} />
                  <stop offset="100%" stopColor={HEX[i]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false} tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false} tickLine={false}
              tickFormatter={v => `${v}%`}
            />
            <Tooltip content={<Tip />} />
            <ReferenceLine y={0} stroke="var(--border-hi)" strokeDasharray="4 3" />
            {TICKERS.map((t, i) =>
              active.has(t) ? (
                <Area
                  key={t} type="monotone"
                  dataKey={t} name={t}
                  stroke={HEX[i]} strokeWidth={1.8}
                  fill={`url(#g${i})`}
                  dot={false} activeDot={{ r: 3, strokeWidth: 0 }}
                  animationDuration={450} isAnimationActive
                />
              ) : null
            )}
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className={s.empty} style={{ height }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          </svg>
          <p>รัน Pipeline เพื่อโหลดข้อมูล</p>
        </div>
      )}

      {/* regime footer */}
      {regime && (
        <div className={s.regimeFoot}>
          <span className={s.regimeLabel}>Regime:</span>
          <span className={`badge ${regime.regime?.toLowerCase()}`}>
            {regime.regime}
          </span>
          <span className={s.regimeProbs}>
            🐂{(regime.prob_bull * 100).toFixed(1)}%
            &nbsp;⚖️{(regime.prob_neutral * 100).toFixed(1)}%
            &nbsp;🐻{(regime.prob_bear * 100).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  )
}
