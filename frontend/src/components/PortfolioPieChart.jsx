/**
 * PortfolioPieChart
 * — Pie chart สัดส่วนพอร์ต reactive กับ ChartContext
 * — animate ทุกครั้งที่ data เปลี่ยน (chat bot อัพเดท)
 */
import { useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { useChart } from '../context/ChartContext'
import styles from './PortfolioPieChart.module.css'

const PALETTE = [
  '#6478f9','#2dd4a0','#f5b942','#f26c6c','#a78bfa',
  '#38bdf8','#fb923c','#4ade80','#e879f9','#64748b',
]

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className={styles.tip}>
      <span className={styles.tipName}>{name}</span>
      <span className={styles.tipVal}>{value.toFixed(2)}%</span>
    </div>
  )
}

function CustomLegend({ payload }) {
  return (
    <ul className={styles.legend}>
      {payload.map((entry, i) => (
        <li key={i} className={styles.legendItem}>
          <span className={styles.dot} style={{ background: entry.color }} />
          <span className={styles.legendName}>{entry.value}</span>
          <span className={styles.legendVal}>{entry.payload.value.toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  )
}

export default function PortfolioPieChart() {
  const { portfolio, lastUpdated } = useChart()

  const data = useMemo(() => {
    if (!portfolio?.weights) return []
    return Object.entries(portfolio.weights)
      .filter(([, v]) => v > 0.5)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value: +value.toFixed(2) }))
  }, [portfolio])

  const hasData = data.length > 0

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h3>🥧 Portfolio Allocation</h3>
        {portfolio && (
          <div className={styles.badges}>
            <span className={styles.badge}>
              Sharpe&nbsp;<strong>{portfolio.sharpe?.toFixed(4)}</strong>
            </span>
            <span className={styles.badge} style={{ color: 'var(--green)' }}>
              Ret&nbsp;<strong>{portfolio.ret?.toFixed(2)}%</strong>
            </span>
            <span className={styles.badge} style={{ color: 'var(--yellow)' }}>
              Vol&nbsp;<strong>{portfolio.vol?.toFixed(2)}%</strong>
            </span>
          </div>
        )}
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius={60}
              outerRadius={95}
              paddingAngle={3}
              dataKey="value"
              animationBegin={0}
              animationDuration={600}
              isAnimationActive
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="var(--surface)" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className={styles.empty}>
          <span>💬</span>
          <p>ถาม AI ว่า <em>"จัดพอร์ตให้หน่อย"</em><br />กราฟจะขยับอัตโนมัติ</p>
        </div>
      )}

      {lastUpdated && hasData && (
        <p className={styles.updated}>
          อัพเดทล่าสุด {new Date(lastUpdated).toLocaleTimeString('th-TH')}
        </p>
      )}
    </div>
  )
}
