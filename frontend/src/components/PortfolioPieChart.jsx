import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Cell, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import { useChart } from '../context/ChartContext'
import s from './PortfolioPieChart.module.css'

const HEX = ['#2f5bd6','#0f9d58','#b45309','#d64545','#7c3aed',
             '#0891b2','#ea580c','#16a34a','#db2777','#64748b',
             '#2563eb','#059669','#c2410c','#9333ea','#0e7490']

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className={s.tt}>
      <span className={s.ttName}>
        <span className={s.ttDot} style={{ background: d.fill }} />
        {d.name}
      </span>
      <strong>{d.value.toFixed(2)}%</strong>
    </div>
  )
}

export default function PortfolioPieChart() {
  const { portfolio, lastUpdated } = useChart()

  const data = useMemo(() => {
    if (!portfolio?.weights) return []
    return Object.entries(portfolio.weights)
      .map(([k, v]) => [k, Number(v) <= 1 ? Number(v) * 100 : Number(v)])
      .filter(([, v]) => v > 0.5)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value: +value.toFixed(2), fill: HEX[i % HEX.length] }))
  }, [portfolio])

  const hasData = data.length > 0

  return (
    <div className={s.wrap} data-testid="portfolio-allocation">
      <div className={s.header}>
        <h3>Portfolio Allocation</h3>
        {portfolio && (
          <div className={s.stats}>
            <span className={s.stat} data-testid="portfolio-stat-sharpe">
              <span className={s.statLabel}>Sharpe</span>
              <strong style={{ color: 'var(--accent)' }}>
                {portfolio.sharpe != null ? portfolio.sharpe.toFixed(2) : '—'}
              </strong>
            </span>
            <span className={s.stat} data-testid="portfolio-stat-ret">
              <span className={s.statLabel}>Return</span>
              <strong style={{ color: 'var(--green)' }}>
                {portfolio.ret != null ? '+' + portfolio.ret.toFixed(1) + '%' : '—'}
              </strong>
            </span>
            <span className={s.stat} data-testid="portfolio-stat-vol">
              <span className={s.statLabel}>Volatility</span>
              <strong style={{ color: 'var(--yellow)' }}>
                {portfolio.vol != null ? portfolio.vol.toFixed(1) + '%' : '—'}
              </strong>
            </span>
          </div>
        )}
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={data} margin={{ top: 12, right: 6, left: -12, bottom: 2 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'Geist Mono, monospace' }}
              interval={0}
              angle={-38}
              textAnchor="end"
              height={56}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
              width={42}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface2)' }} />
            <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={48}
              animationDuration={650} animationBegin={0}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className={s.empty}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3v18h18" /><rect x="7" y="10" width="3" height="7" /><rect x="12" y="6" width="3" height="11" /><rect x="17" y="13" width="3" height="4" />
          </svg>
          <p>พิมพ์ <em>"จัดพอร์ตให้หน่อย"</em> ในแชท</p>
        </div>
      )}

      {lastUpdated && hasData && (
        <p className={s.ts}>↺ {new Date(lastUpdated).toLocaleTimeString('th-TH')}</p>
      )}
    </div>
  )
}
