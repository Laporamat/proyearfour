import { useEffect, useCallback } from 'react'
import StatCard           from '../components/StatCard'
import RunButton          from '../components/RunButton'
import PortfolioPieChart  from '../components/PortfolioPieChart'
import ReturnsLineChart   from '../components/ReturnsLineChart'
import Chat               from './Chat'
import { useChart }       from '../context/ChartContext'
import { api }            from '../hooks/useApi'
import styles             from './Dashboard.module.css'

const fmt = (n, d = 2) => (n != null ? Number(n).toFixed(d) : '—')
const pct = n           => (n != null ? `${fmt(n)}%` : '—')

export default function Dashboard() {
  const { portfolio, regime, dispatch } = useChart()

  const loadInitial = useCallback(async () => {
    try {
      const [p, r, px] = await Promise.all([
        api.portfolioLatest(),
        api.regimeLatest(),
        api.prices(1),
      ])
      if (p && !p.status) {
        const raw = p.top5_weights ?? {}
        dispatch({
          type: 'SET_PORTFOLIO',
          payload: {
            weights: Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, parseFloat(v)])),
            sharpe:  p.sharpe_ratio,
            ret:     parseFloat(p.annualized_return),
            vol:     parseFloat(p.annualized_volatility),
          },
        })
      }
      if (r?.regime) {
        dispatch({
          type: 'SET_REGIME',
          payload: {
            date:         r.date,
            regime:       r.regime,
            prob_bull:    Number(r.prob_bull)    || 0,
            prob_neutral: Number(r.prob_neutral) || 0,
            prob_bear:    Number(r.prob_bear)    || 0,
          },
        })
      }
      if (px?.prices) dispatch({ type: 'SET_PRICES', payload: px.prices })
    } catch { /* API offline */ }
  }, [dispatch])

  useEffect(() => { loadInitial() }, [loadInitial])

  const regimeLabel = regime?.regime ?? ''
  const regimeClass = regimeLabel.toLowerCase()
  const loading     = !portfolio && !regime

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.topBar}>
        <div className={styles.heading}>
          <h1>Dashboard</h1>
          <p className={styles.sub}>
            25 Assets
            <span className={styles.dot} />
            หน่วย THB
            {regime?.date && <><span className={styles.dot} />{regime.date}</>}
          </p>
        </div>
        <RunButton onDone={loadInitial} />
      </div>

      {/* ── KPI ── */}
      <div className={styles.kpiGrid}>
        <StatCard icon="◈" label="Sharpe Ratio"   color="accent" loading={loading}
          value={fmt(portfolio?.sharpe, 4)} sub="Max Sharpe Portfolio" />
        <StatCard icon="↑" label="Annual Return"  color="green"  loading={loading}
          value={pct(portfolio?.ret)} sub="ผลตอบแทนต่อปี" />
        <StatCard icon="~" label="Volatility"     color="yellow" loading={loading}
          value={pct(portfolio?.vol)} sub="ความผันผวนต่อปี" />
        <StatCard icon="◉" label="Market Regime"
          color={regimeClass === 'bull' ? 'green' : regimeClass === 'bear' ? 'red' : 'yellow'}
          loading={loading}
          value={regimeLabel ? <span className={`badge ${regimeClass}`}>{regimeLabel}</span> : null}
          sub={regime ? `🐂 ${(regime.prob_bull * 100).toFixed(1)}%  🐻 ${(regime.prob_bear * 100).toFixed(1)}%` : undefined}
        />
      </div>

      {/* ── Split: Charts + Chat ── */}
      <div className={styles.split}>

        {/* ── Charts column ── */}
        <div className={styles.chartsCol}>

          <div className={`card ${styles.chartCard}`}>
            <ReturnsLineChart height={220} />
          </div>

          <div className={`card ${styles.chartCard}`}>
            <PortfolioPieChart />
          </div>

          {regime && (
            <div className={`card ${styles.regimeCard}`}>
              <div className={styles.regimeHead}>
                <h3 className={styles.regimeTitle}>Regime Probability</h3>
                <span className={styles.regimeDate}>{regime.date}</span>
              </div>
              {[
                { key: 'prob_bull',    label: 'Bull 🐂',    color: '#2dd4a0' },
                { key: 'prob_neutral', label: 'Neutral',    color: '#f5b942' },
                { key: 'prob_bear',    label: 'Bear 🐻',    color: '#f26c6c' },
              ].map(({ key, label, color }) => {
                const val = ((regime[key] ?? 0) * 100)
                return (
                  <div key={key} className={styles.bar}>
                    <span className={styles.barLabel}>{label}</span>
                    <div className={styles.barBg}>
                      <div className={styles.barFill} style={{ width: `${val.toFixed(1)}%`, background: color }} />
                    </div>
                    <span className={styles.barPct} style={{ color }}>{val.toFixed(1)}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Chat panel ── */}
        <div className={styles.chatCol}>
          <Chat embedded />
        </div>

      </div>
    </div>
  )
}
