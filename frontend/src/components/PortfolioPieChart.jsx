import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useChart } from '../context/ChartContext'
import s from './PortfolioPieChart.module.css'

const HEX = ['#5b73f5','#23c97d','#e8a825','#e85c5c','#a78bfa',
             '#38c9e8','#f2844b','#4ade80','#e879f9','#94a3b8']

function Tip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className={s.tip}>
      <span className={s.tipDot} style={{ background: d.payload.fill }} />
      <span className={s.tipName}>{d.name}</span>
      <span className={s.tipVal}>{d.value.toFixed(2)}%</span>
    </div>
  )
}

/* ── Custom label rendered inside the donut hole ── */
function CenterLabel({ viewBox, sharpe, ret }) {
  if (!viewBox) return null
  const { cx, cy } = viewBox
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" dominantBaseline="middle"
        fill="var(--text-head)" fontSize={22} fontWeight={800} fontFamily="Inter,sans-serif">
        {sharpe != null ? sharpe.toFixed(2) : '—'}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle"
        fill="var(--text-muted)" fontSize={10} fontFamily="Inter,sans-serif">
        Sharpe
      </text>
      {ret != null && (
        <text x={cx} y={cy + 26} textAnchor="middle" dominantBaseline="middle"
          fill="var(--green)" fontSize={10} fontWeight={600} fontFamily="Inter,sans-serif">
          {ret > 0 ? '+' : ''}{ret.toFixed(1)}% p.a.
        </text>
      )}
    </g>
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
    <div className={s.wrap}>
      <div className={s.header}>
        <h3>Portfolio Allocation</h3>
        {portfolio && (
          <div className={s.stats}>
            <span className={s.stat}>
              Vol <strong style={{ color: 'var(--yellow)' }}>
                {portfolio.vol != null ? portfolio.vol.toFixed(1) + '%' : '—'}
              </strong>
            </span>
            <span className={s.stat}>
              Ret <strong style={{ color: 'var(--green)' }}>
                {portfolio.ret != null ? portfolio.ret.toFixed(1) + '%' : '—'}
              </strong>
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
                innerRadius={54} outerRadius={84}
                paddingAngle={2}
                dataKey="value"
                animationBegin={0}
                animationDuration={600}
                isAnimationActive
              >
                {data.map((d, i) => (
                  <Cell key={i} fill={d.fill} stroke="var(--surface)" strokeWidth={2} />
                ))}
                <CenterLabel
                  sharpe={portfolio?.sharpe}
                  ret={portfolio?.ret}
                />
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
            <circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/>
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
