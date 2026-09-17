import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useChart } from '../context/ChartContext'
import s from './PortfolioPieChart.module.css'

const HEX = ['#2f5bd6','#0f9d58','#b45309','#d64545','#7c3aed',
             '#0891b2','#ea580c','#16a34a','#db2777','#64748b']

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
  const maxWeight = hasData ? data[0].value : 100

  return (
    <div className={s.wrap} data-testid="portfolio-allocation">
      <div className={s.header}>
        <h3>Portfolio Allocation</h3>
        {portfolio && (
          <div className={s.stats}>
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
        <div className={s.body}>
          {/* donut */}
          <div className={s.donutBox}>
            <ResponsiveContainer width="100%" height={168}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%" cy="50%"
                  innerRadius={56} outerRadius={80}
                  paddingAngle={data.length > 1 ? 2 : 0}
                  dataKey="value"
                  startAngle={90} endAngle={-270}
                  animationBegin={0}
                  animationDuration={650}
                  isAnimationActive
                  stroke="none"
                >
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className={s.center} data-testid="portfolio-sharpe">
              <span className={s.centerVal}>
                {portfolio?.sharpe != null ? portfolio.sharpe.toFixed(2) : '—'}
              </span>
              <span className={s.centerLbl}>SHARPE</span>
            </div>
          </div>

          {/* ranked list with weight bars */}
          <ul className={s.ranks} data-testid="portfolio-ranks">
            {data.map((d, i) => (
              <li key={i} className={s.rankRow} data-testid={`portfolio-rank-${d.name}`}>
                <span className={s.rankName}>
                  <span className={s.rankDot} style={{ background: d.fill }} />
                  {d.name}
                </span>
                <span className={s.rankTrack}>
                  <span
                    className={s.rankFill}
                    style={{
                      width: `${(d.value / maxWeight) * 100}%`,
                      background: d.fill,
                      animationDelay: `${i * 60}ms`,
                    }}
                  />
                </span>
                <span className={s.rankVal}>{d.value.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className={s.empty}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/>
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
