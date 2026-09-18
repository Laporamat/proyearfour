import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useChart } from '../context/ChartContext'
import { api } from '../hooks/useApi'
import s from './ReturnsLineChart.module.css'

const DEFAULT_TICKERS = ['NVDA', 'AAPL', 'DELTA.BK', 'GLD', 'KBANK.BK']
const HEX = [
  '#5b73f5','#23c97d','#e8a825','#e85c5c','#a78bfa',
  '#0891b2','#ea580c','#16a34a','#db2777','#64748b',
  '#2563eb','#059669','#c2410c','#9333ea','#0e7490',
  '#d946ef','#f59e0b','#10b981','#ef4444','#6366f1',
  '#14b8a6','#f97316','#8b5cf6','#e11d48','#0ea5e9',
]
const PERIODS = ['1d','1w','1m','3m','6m','1y','3y','all']

/* stable color per ticker (by index in the full ticker list) */
const colorOf = (tickers, t) => HEX[tickers.indexOf(t) % HEX.length]

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
  const [tickers, setTickers] = useState(DEFAULT_TICKERS)
  const [loading, setLoading] = useState(true)
  const [period,  setPeriod]  = useState('1y')
  const [active,  setActive]  = useState(new Set(DEFAULT_TICKERS))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.returnsHistory(period)
      setData(res?.data ?? [])
      if (res?.tickers?.length) {
        setTickers(res.tickers)
        // seed active selection once with defaults that actually exist
        setActive(prev => {
          if (prev.size) return prev
          return new Set(DEFAULT_TICKERS.filter(t => res.tickers.includes(t)))
        })
      }
    } catch { setData([]) }
    setLoading(false)
  }, [period])

  useEffect(() => { load() }, [load, lastUpdated])

  const toggle = t => setActive(prev => {
    const next = new Set(prev)
    next.has(t) ? next.delete(t) : next.add(t)
    return next
  })
  const selectAll = () => setActive(new Set(tickers))
  const clearAll  = () => setActive(new Set())

  return (
    <div className={s.wrap}>
      {/* header */}
      <div className={s.header}>
        <h3>Cumulative Return</h3>
        <div className={s.periods}>
          {PERIODS.map(p => (
            <button key={p}
              className={`${s.pBtn} ${period === p ? s.pActive : ''}`}
              onClick={() => setPeriod(p)} data-testid={`period-${p}`}>{p}
            </button>
          ))}
        </div>
      </div>

      {/* ticker chips — เลือกได้ทุกตัว */}
      <div className={s.chipBar}>
        <div className={s.chipActions}>
          <button className={s.chipAction} onClick={selectAll} data-testid="tickers-select-all">ทั้งหมด</button>
          <button className={s.chipAction} onClick={clearAll} data-testid="tickers-clear">ล้าง</button>
          <span className={s.chipCount}>{active.size}/{tickers.length}</span>
        </div>
        <div className={s.chips} data-testid="ticker-chips">
          {tickers.map((t) => {
            const c = colorOf(tickers, t)
            const on = active.has(t)
            return (
              <button key={t}
                className={`${s.chip} ${on ? s.chipOn : ''}`}
                style={on ? { borderColor: c, color: c, background: c + '22' } : {}}
                onClick={() => toggle(t)}
                data-testid={`ticker-chip-${t}`}
              >{t}</button>
            )
          })}
        </div>
      </div>

      {/* chart */}
      {loading
        ? <div className={`skeleton ${s.chartSkel}`} style={{ height }} />
        : data.length
          ? (
            <ResponsiveContainer width="100%" height={height}>
              <AreaChart data={data} margin={{ top: 6, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  {tickers.map((t) => {
                    const c = colorOf(tickers, t)
                    return (
                      <linearGradient key={t} id={`grad-${t}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={c} stopOpacity={0.30} />
                        <stop offset="60%"  stopColor={c} stopOpacity={0.08} />
                        <stop offset="100%" stopColor={c} stopOpacity={0.00} />
                      </linearGradient>
                    )
                  })}
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
                {tickers.map((t) => active.has(t) && (
                  <Area key={t} type="monotone"
                    dataKey={t} name={t}
                    stroke={colorOf(tickers, t)} strokeWidth={2}
                    fill={`url(#grad-${t})`}
                    dot={false} activeDot={{ r: 4, fill: colorOf(tickers, t), strokeWidth: 0 }}
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
