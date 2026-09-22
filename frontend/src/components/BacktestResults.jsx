import { useState } from 'react'
import { api } from '../hooks/useApi'
import s from './BacktestResults.module.css'

const fmt = (n, d = 2) =>
  n != null ? Number(n).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'

function StrategyCard({ name, label, data, color }) {
  const stats = data?.stats
  const curve = data?.curve || []
  if (!stats) return null

  const minVal = Math.min(...curve.map(c => c.value), 0)
  const maxVal = Math.max(...curve.map(c => c.value), 1)
  const range = maxVal - minVal || 1

  return (
    <div className={`card ${s.strategyCard}`}>
      <div className={s.strategyHead}>
        <span className={s.strategyDot} style={{ background: color }} />
        <h4>{label}</h4>
        {stats.totalReturn >= 0 ? (
          <span className={s.strategyReturn} style={{ color: 'var(--green)' }}>+{fmt(stats.totalReturn)}%</span>
        ) : (
          <span className={s.strategyReturn} style={{ color: 'var(--red)' }}>{fmt(stats.totalReturn)}%</span>
        )}
      </div>
      <div className={s.stats}>
        <div className={s.statItem}>
          <span className={s.statLabel}>Volatility</span>
          <span className={s.statValue}>{fmt(stats.annualizedVol)}%</span>
        </div>
        <div className={s.statItem}>
          <span className={s.statLabel}>Sharpe</span>
          <span className={s.statValue}>{fmt(stats.sharpe, 3)}</span>
        </div>
        <div className={s.statItem}>
          <span className={s.statLabel}>Max DD</span>
          <span className={s.statValue} style={{ color: 'var(--red)' }}>{fmt(stats.maxDrawdown)}%</span>
        </div>
      </div>
      {/* Simple sparkline */}
      <div className={s.sparkline}>
        <svg viewBox="0 0 100 30" preserveAspectRatio="none" width="100%" height="30">
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            points={curve.map((c, i) => {
              const x = (i / Math.max(curve.length - 1, 1)) * 100
              const y = 30 - ((c.value - minVal) / range) * 28 - 1
              return `${x},${y}`
            }).join(' ')}
          />
        </svg>
      </div>
    </div>
  )
}

export default function BacktestResults({ holdings }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleBacktest = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.backtest()
      setResult(data)
    } catch (e) {
      setError(e.message || 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  const hasError = result?.error

  return (
    <div className={`card ${s.wrap}`}>
      <div className={s.head}>
        <div>
          <h3>Backtesting — ทดสอบกลยุทธ์ย้อนหลัง</h3>
          <p className={s.sub}>เปรียบเทียบ Buy & Hold vs MPT vs Regime-based (2 ปี)</p>
        </div>
        <button className="btn btn-primary" onClick={handleBacktest} disabled={loading || holdings.length === 0}>
          {loading ? <span className="spinner" /> : 'รัน Backtest'}
        </button>
      </div>

      {error && <p className={s.error}>{error}</p>}
      {hasError && <p className={s.error}>{result.error}</p>}

      {result && !hasError && !error && (
        <>
          <div className={s.period}>
            ช่วงทดสอบ: {result.period?.start} → {result.period?.end}
          </div>
          <div className={s.cards}>
            <StrategyCard name="buyHold" label="Buy & Hold" data={result.buyHold} color="#4f8cff" />
            <StrategyCard name="mpt" label="MPT Optimal" data={result.mpt} color="#2ecc71" />
            <StrategyCard name="regime" label="Regime-based" data={result.regime} color="#f39c12" />
          </div>
        </>
      )}
    </div>
  )
}
