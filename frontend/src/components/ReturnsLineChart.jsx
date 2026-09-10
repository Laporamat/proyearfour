/**
 * ReturnsLineChart
 * — Cumulative return line chart
 * — โหลดจาก /api/returns-history
 * — ไฮไลต์ช่วง Bear/Bull ด้วย ReferenceArea
 * — reactive: refetch ทุกครั้งที่ ChartContext เปลี่ยน
 */
import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
  ReferenceLine,
} from 'recharts'
import { useChart } from '../context/ChartContext'
import styles from './ReturnsLineChart.module.css'

const TOP_TICKERS = ['NVDA', 'AAPL', 'DELTA.BK', 'GLD', 'KBANK.BK']
const COLORS      = ['#6478f9','#2dd4a0','#f5b942','#f26c6c','#a78bfa']

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tip}>
      <p className={styles.tipDate}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className={styles.tipRow}>
          {p.name}: <strong>{p.value?.toFixed(2)}%</strong>
        </p>
      ))}
    </div>
  )
}

export default function ReturnsLineChart({ height = 260 }) {
  const { lastUpdated } = useChart()
  const [data,       setData]       = useState([])
  const [loading,    setLoading]    = useState(true)
  const [activeTickers, setActive] = useState(new Set(TOP_TICKERS))
  const [period,     setPeriod]     = useState('1y')   // '6m' | '1y' | '3y' | 'all'

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/returns-history?period=${period}`)
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json()
      setData(json.data ?? [])
    } catch {
      setData([])
    }
    setLoading(false)
  }, [period])

  // refetch เมื่อ period เปลี่ยน หรือ context อัพเดท (pipeline รัน)
  useEffect(() => { fetchData() }, [fetchData, lastUpdated])

  const toggleTicker = (t) =>
    setActive(prev => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })

  const visibleTickers = TOP_TICKERS.filter(t => activeTickers.has(t))

  const regime = useChart().regime
  const regimeColor =
    regime?.regime === 'Bull'    ? 'rgba(52,211,153,0.07)'  :
    regime?.regime === 'Bear'    ? 'rgba(248,113,113,0.07)' :
    'rgba(251,191,36,0.07)'

  return (
    <div className={styles.wrap}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <h3>📈 Cumulative Return (%)</h3>
        <div className={styles.controls}>
          {['6m','1y','3y','all'].map(p => (
            <button
              key={p}
              className={`${styles.periodBtn} ${period === p ? styles.active : ''}`}
              onClick={() => setPeriod(p)}
            >{p}</button>
          ))}
        </div>
      </div>

      {/* ── Ticker toggles ── */}
      <div className={styles.tickers}>
        {TOP_TICKERS.map((t, i) => (
          <button
            key={t}
            className={`${styles.tickerChip} ${activeTickers.has(t) ? styles.on : ''}`}
            style={activeTickers.has(t) ? { borderColor: COLORS[i], color: COLORS[i] } : {}}
            onClick={() => toggleTicker(t)}
          >{t}</button>
        ))}
      </div>

      {/* ── Chart ── */}
      {loading ? (
        <div className={styles.skeleton} style={{ height }} />
      ) : data.length ? (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <defs>
              {TOP_TICKERS.map((t, i) => (
                <linearGradient key={t} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={COLORS[i]} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={COLORS[i]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {/* Regime background tint */}
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
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="4 4" />
            {TOP_TICKERS.map((t, i) =>
              activeTickers.has(t) ? (
                <Area
                  key={t}
                  type="monotone"
                  dataKey={t}
                  name={t}
                  stroke={COLORS[i]}
                  strokeWidth={2}
                  fill={`url(#grad-${i})`}
                  dot={false}
                  activeDot={{ r: 4 }}
                  animationDuration={500}
                  isAnimationActive
                />
              ) : null
            )}
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className={styles.empty} style={{ height }}>
          <span>💬</span>
          <p>ถาม AI ว่า <em>"รันพอร์ตให้หน่อย"</em><br />หรือรัน Pipeline เพื่อโหลดข้อมูล</p>
        </div>
      )}

      {/* Regime badge */}
      {regime && (
        <div className={styles.regimeBadge}>
          <span>Regime ล่าสุด:</span>
          <span
            className={`badge ${regime.regime?.toLowerCase()}`}
            style={{ fontSize: '0.72rem' }}
          >
            {regime.regime}
          </span>
          <span className={styles.regimeSub}>
            🐂 {(regime.prob_bull * 100).toFixed(1)}%
            &nbsp;⚖️ {(regime.prob_neutral * 100).toFixed(1)}%
            &nbsp;🐻 {(regime.prob_bear * 100).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  )
}
