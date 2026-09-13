import { useEffect, useCallback } from 'react'
import StatCard          from '../components/StatCard'
import RunButton         from '../components/RunButton'
import PortfolioPieChart from '../components/PortfolioPieChart'
import ReturnsLineChart  from '../components/ReturnsLineChart'
import Chat              from './Chat'
import { useChart }      from '../context/ChartContext'
import { api }           from '../hooks/useApi'
import s                 from './Dashboard.module.css'

const fmt = (n, d = 2) => n != null ? Number(n).toFixed(d) : '—'
const pct = n => n != null ? `${fmt(n)}%` : '—'

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
            // top5_weights ตอนนี้เป็น float % (21.87) → หาร 100 เป็น fraction
            weights: Object.fromEntries(
              Object.entries(p.all_weights ?? raw).map(([k, v]) => [k, Number(v)])
            ),
            sharpe: Number(p.sharpe_ratio),
            ret:    Number(p.annualized_return),
            vol:    Number(p.annualized_volatility),
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

  const label = regime?.regime ?? ''
  const cls   = label.toLowerCase()
  const loading = !portfolio && !regime

  return (
    <div className={s.page}>

      {/* ── Header ─────────────────────────── */}
      <header className={s.header}>
        <div>
          <h1>Dashboard</h1>
          <p className={s.headerSub}>
            25 สินทรัพย์ · หน่วย THB
            {regime?.date && <> · <time>{regime.date}</time></>}
          </p>
        </div>
        <RunButton onDone={loadInitial} />
      </header>

      {/* ── KPI ────────────────────────────── */}
      <div className={s.kpi}>
        <StatCard
          icon="◈" label="Sharpe Ratio" color="accent" loading={loading}
          value={fmt(portfolio?.sharpe, 4)}
          sub="Max Sharpe Portfolio"
        />
        <StatCard
          icon="↑" label="Annual Return" color="green" loading={loading}
          value={pct(portfolio?.ret)}
          sub="ผลตอบแทนต่อปี"
        />
        <StatCard
          icon="~" label="Volatility" color="yellow" loading={loading}
          value={pct(portfolio?.vol)}
          sub="ความผันผวนต่อปี"
        />
        <StatCard
          icon="◉" label="Market Regime"
          color={cls === 'bull' ? 'green' : cls === 'bear' ? 'red' : 'yellow'}
          loading={loading}
          value={label ? <span className={`badge ${cls}`}>{label}</span> : null}
          sub={regime
            ? `🐂 ${(regime.prob_bull * 100).toFixed(1)}%  🐻 ${(regime.prob_bear * 100).toFixed(1)}%`
            : undefined
          }
        />
      </div>

      {/* ── Body ───────────────────────────── */}
      <div className={s.body}>

        {/* left — charts */}
        <div className={s.charts}>
          <div className={`card ${s.chartCard}`}>
            <ReturnsLineChart height={210} />
          </div>

          <div className={s.chartRow}>
            <div className={`card ${s.chartCard}`}>
              <PortfolioPieChart />
            </div>

            {regime && (
              <div className={`card ${s.regimeCard}`}>
                <div className={s.regimeHead}>
                  <h3>Regime</h3>
                  <span className={s.regimeDate}>{regime.date}</span>
                </div>
                {[
                  { key: 'prob_bull',    label: 'Bull',    color: 'var(--green)'  },
                  { key: 'prob_neutral', label: 'Neutral', color: 'var(--yellow)' },
                  { key: 'prob_bear',    label: 'Bear',    color: 'var(--red)'    },
                ].map(({ key, label, color }) => {
                  const pct = ((regime[key] ?? 0) * 100)
                  return (
                    <div key={key} className={s.regimeRow}>
                      <span className={s.regimeLbl}>{label}</span>
                      <div className={s.regimeBg}>
                        <div
                          className={s.regimeFill}
                          style={{ width: `${pct.toFixed(1)}%`, background: color }}
                        />
                      </div>
                      <span className={s.regimePct} style={{ color }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* right — chat */}
        <div className={s.chatWrap}>
          <Chat embedded />
        </div>

      </div>
    </div>
  )
}
