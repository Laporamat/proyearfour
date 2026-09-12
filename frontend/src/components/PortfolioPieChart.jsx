import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useChart } from '../context/ChartContext'
import s from './PortfolioPieChart.module.css'

const COLORS = ['var(--c1)','var(--c2)','var(--c3)','var(--c4)','var(--c5)',
                 'var(--c6)','var(--c7)','var(--c8)','var(--c9)','var(--c10)']

const HEX = ['#5b73f5','#23c97d','#e8a825','#e85c5c','#a78bfa',
             '#38c9e8','#f2844b','#4ade80','#e879f9','#94a3b8']

function Tip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className={s.tip}>
      <span className={s.tipDot} style={{ background: payload[0].payload.fill }} />
      <span className={s.tipName}>{name}</span>
      <span className={s.tipVal}>{value.toFixed(2)}%</span>
    </div>
  )
}

export default function PortfolioPieChart() {
  const { portfolio, lastUpdated } = useChart()

  const data = useMemo(() => {
    if (!portfolio?.weights) return []
    return Object.entries(portfolio.weights)
      .filter(([, v]) => v > 0.5)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value: +value.toFixed(2), fill: HEX[i % HEX.length] }))
  }, [portfolio])

  const hasData = data.length > 0

  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <h3>Portfolio Allocation</h3>
        {portfolio && (
          <div className={s.stats}>
            <span className={s.stat}>
              Sharpe <strong>{portfolio.sharpe?.toFixed(4)}</strong>
            </span>
            <span className={s.stat} style={{ color: 'var(--green)' }}>
              {portfolio.ret?.toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      {hasData ? (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%" cy="50%"
                innerRadius={52} outerRadius={82}
                paddingAngle={3}
                dataKey="value"
                animationBegin={0}
                animationDuration={550}
                isAnimationActive
              >
                {data.map((d, i) => (
                  <Cell key={i} fill={d.fill} stroke="var(--surface)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<Tip />} />
            </PieChart>
          </ResponsiveContainer>

          <ul className={s.legend}>
            {data.map((d, i) => (
              <li key={i} className={s.legendItem}>
                <span className={s.legendDot} style={{ background: d.fill }} />
                <span className={s.legendName}>{d.name}</span>
                <span className={s.legendVal}>{d.value.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className={s.empty}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a10 10 0 0 1 10 10"/>
          </svg>
          <p>พิมพ์ <em>"จัดพอร์ตให้หน่อย"</em> ในช่าท</p>
        </div>
      )}

      {lastUpdated && hasData && (
        <p className={s.ts}>↺ {new Date(lastUpdated).toLocaleTimeString('th-TH')}</p>
      )}
    </div>
  )
}
