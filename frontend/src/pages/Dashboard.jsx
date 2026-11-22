import { useEffect, useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import StatCard from '../components/StatCard'
import RunButton from '../components/RunButton'
import PortfolioPieChart from '../components/PortfolioPieChart'
import ReturnsLineChart from '../components/ReturnsLineChart'
import PriceTable from '../components/PriceTable'
import NewsFeed from '../components/NewsFeed'
import { useChart } from '../context/ChartContext'
import { api } from '../hooks/useApi'
import s from './Dashboard.module.css'

const fmt = (n, d = 2) => (n != null ? Number(n).toFixed(d) : '—')
const pct = (n) => (n != null ? `${fmt(n)}%` : '—')

export default function Dashboard() {
  const { portfolio, regime, liveMeta, dispatch } = useChart()
  const [mlData, setMlData] = useState(null)
  const [mlLoading, setMlLoading] = useState(false)
  const liveTimerRef = useRef(null)

  /* Live prices — auto-refresh every 60s, no manual pipeline needed */
  const loadLive = useCallback(async () => {
    try {
      const live = await api.livePrices()
      if (live?.prices) dispatch({ type: 'SET_LIVE', payload: live })
    } catch (e) {
      console.warn('live prices fetch failed:', e.message)
    }
  }, [dispatch])

  /* ML Day Trade signals & Real-time Random Forest predictions */
  const loadMlSignals = useCallback(async () => {
    setMlLoading(true)
    try {
      const res = await api.daytradeSignals()
      setMlData(res)
    } catch (e) {
      console.warn('ML signals fetch failed:', e.message)
    } finally {
      setMlLoading(false)
    }
  }, [])

  const loadInitial = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([
        api.portfolioLatest(),
        api.regimeLatest(),
      ])

      if (p && !p.status) {
        const raw = p.top5_weights ?? {}
        dispatch({
          type: 'SET_PORTFOLIO',
          payload: {
            weights: Object.fromEntries(
              Object.entries(p.all_weights ?? raw).map(([k, v]) => [k, Number(v)])
            ),
            sharpe: Number(p.sharpe_ratio),
            ret: Number(p.annualized_return),
            vol: Number(p.annualized_volatility),
          },
        })
      }

      if (r?.regime) {
        dispatch({
          type: 'SET_REGIME',
          payload: {
            date: r.date,
            regime: r.regime,
            prob_bull: Number(r.prob_bull) || 0,
            prob_neutral: Number(r.prob_neutral) || 0,
            prob_bear: Number(r.prob_bear) || 0,
          },
        })
      }
    } catch (e) {
      console.warn('initial dashboard data fetch failed:', e.message)
    }
  }, [dispatch])

  useEffect(() => {
    loadLive()
    loadInitial()
    loadMlSignals()
    liveTimerRef.current = setInterval(() => {
      loadLive()
      loadMlSignals()
    }, 60_000)
    return () => clearInterval(liveTimerRef.current)
  }, [loadLive, loadInitial, loadMlSignals])

  // Active regime from ML
  const activeRegimeState = mlData?.regime?.state || regime?.regime || 'Neutral'
  const activeRegimeConf = mlData?.regime?.confidence || 56.5
  const probBull = (mlData?.regime?.prob_bull ?? regime?.prob_bull ?? 0.33) * 100
  const probNeutral = (mlData?.regime?.prob_neutral ?? regime?.prob_neutral ?? 0.34) * 100
  const probBear = (mlData?.regime?.prob_bear ?? regime?.prob_bear ?? 0.33) * 100

  const loading = !portfolio && !regime

  // Top 4 actionable signals from 25 assets
  const topSignals = mlData?.signals
    ? [...mlData.signals]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 4)
    : []

  // Dynamic tactical tilt recommendation based on ML regime
  const getTacticalAdvice = () => {
    const sLow = activeRegimeState.toLowerCase()
    if (sLow === 'bull') {
      return {
        badge: 'BULL TILT (+15% EQUITY)',
        text: 'สภาวะตลาดขาขึ้น — ปรับเพิ่มสัดส่วนหุ้นเติบโตและ High-Beta Tech (+15%) เพื่อดึง Alpha สูงสุด',
      }
    }
    if (sLow === 'bear') {
      return {
        badge: 'DEFENSIVE TILT (+80% SAFE)',
        text: 'สภาวะตลาดขาลง — ปรับเพิ่มน้ำหนักพันธบัตรและทองคำ (Safe Assets & Bonds +80%) เพื่อป้องกันเงินทุน',
      }
    }
    return {
      badge: 'BALANCED MPT 60/40',
      text: 'สภาวะตลาดทรงตัว — กระจายความเสี่ยงแบบสมดุล 25 สินทรัพย์ตามทฤษฎี Modern Portfolio Theory',
    }
  }

  const tactical = getTacticalAdvice()

  return (
    <div className={s.page}>
      {/* ── Top Bar / Quant & ML Telemetry Header ── */}
      <header className={s.header}>
        <div className={s.titleArea}>
          <div className={s.badgeRow}>
            <span className={s.livePulse} />
            <span className={s.terminalTag}>QUANT INTELLIGENCE HUB</span>
            <span className={s.mlModelTag}>ML: RANDOM FOREST (300 TREES)</span>
            <span
              className={`${s.regimeBadge} ${
                activeRegimeState.toLowerCase() === 'bull'
                  ? s.regimeBull
                  : activeRegimeState.toLowerCase() === 'bear'
                  ? s.regimeBear
                  : s.regimeNeutral
              }`}
            >
              REGIME: {activeRegimeState.toUpperCase()} ({activeRegimeConf}%)
            </span>
            {liveMeta && (
              <span className={s.liveBadge}>
                {liveMeta.status === 'live' ? '● LIVE' : '○ STALE'} · 25 ASSETS
                {liveMeta.fx_thb_per_usd && <> · ฿{liveMeta.fx_thb_per_usd}/USD</>}
              </span>
            )}
          </div>
          <h1>Quantitative Portfolio Intelligence</h1>
          <p className={s.headerSub}>
            ระบบจัดพอร์ตเชิงปริมาณ Modern Portfolio Theory (MPT) ผสาน Machine Learning Market Regime & Live Yahoo Finance
          </p>
        </div>

        <div className={s.headerActions}>
          <Link to="/mt5" className={s.btnTerminalLink}>
            ⚡ Day Trade Terminal
          </Link>
          <RunButton
            onDone={() => {
              loadInitial()
              loadLive()
              loadMlSignals()
            }}
          />
        </div>
      </header>

      {/* ── Quant KPI Metric Strip ── */}
      <div className={s.kpi}>
        <StatCard
          icon="◈"
          label="Optimal Sharpe Ratio"
          color="accent"
          loading={loading}
          value={fmt(portfolio?.sharpe, 4)}
          sub="Max Sharpe Portfolio"
          to="/analysis/sharpe"
        />
        <StatCard
          icon="↑"
          label="Expected Annual Return"
          color="green"
          loading={loading}
          value={pct(portfolio?.ret)}
          sub="ผลตอบแทนคาดหวังต่อปี"
          to="/analysis/return"
        />
        <StatCard
          icon="~"
          label="Annual Volatility"
          color="yellow"
          loading={loading}
          value={pct(portfolio?.vol)}
          sub="ความผันผวนความเสี่ยงต่อปี"
          to="/analysis/volatility"
        />
        <StatCard
          icon="◉"
          label="ML Market Regime"
          color={
            activeRegimeState.toLowerCase() === 'bull'
              ? 'green'
              : activeRegimeState.toLowerCase() === 'bear'
              ? 'red'
              : 'yellow'
          }
          loading={loading}
          value={
            <span
              className={`badge ${
                activeRegimeState.toLowerCase() === 'bull'
                  ? 'bull'
                  : activeRegimeState.toLowerCase() === 'bear'
                  ? 'bear'
                  : 'neutral'
              }`}
            >
              {activeRegimeState}
            </span>
          }
          sub={`🐂 ${probBull.toFixed(1)}% | ⚖️ ${probNeutral.toFixed(1)}% | 🐻 ${probBear.toFixed(1)}%`}
          to="/analysis/regime"
        />
      </div>

      {/* ── Main Body Split ── */}
      <div className={s.body}>
        {/* Left Column: Analytics, ML Intelligence & Asset Table */}
        <div className={s.charts}>
          {/* 1. ML Market Regime & Tactical Tilt Intelligence Card */}
          <div className={s.mlRegimeCard}>
            <div className={s.regimeHead}>
              <div className={s.regimeHeadLeft}>
                <h3>🧠 ML Market Regime Classifier</h3>
                <span className={s.regimeModelPill}>Random Forest (300 Estimators)</span>
              </div>
              <span className={s.regimeDate}>
                {mlData?.timestamp ? mlData.timestamp.split('T')[0] : regime?.date || 'Live Inference'}
              </span>
            </div>

            {/* Probability Progress Dials */}
            <div className={s.regimeBars}>
              <div className={s.regimeRow}>
                <span className={s.regimeLbl}>🐂 Bullish</span>
                <div className={s.regimeBg}>
                  <div
                    className={s.regimeFill}
                    style={{ width: `${probBull.toFixed(1)}%`, background: 'var(--green, #10b981)' }}
                  />
                </div>
                <span className={s.regimePct} style={{ color: 'var(--green, #10b981)' }}>
                  {probBull.toFixed(1)}%
                </span>
              </div>

              <div className={s.regimeRow}>
                <span className={s.regimeLbl}>⚖️ Neutral</span>
                <div className={s.regimeBg}>
                  <div
                    className={s.regimeFill}
                    style={{ width: `${probNeutral.toFixed(1)}%`, background: 'var(--yellow, #f59e0b)' }}
                  />
                </div>
                <span className={s.regimePct} style={{ color: 'var(--yellow, #f59e0b)' }}>
                  {probNeutral.toFixed(1)}%
                </span>
              </div>

              <div className={s.regimeRow}>
                <span className={s.regimeLbl}>🐻 Bearish</span>
                <div className={s.regimeBg}>
                  <div
                    className={s.regimeFill}
                    style={{ width: `${probBear.toFixed(1)}%`, background: 'var(--red, #ef4444)' }}
                  />
                </div>
                <span className={s.regimePct} style={{ color: 'var(--red, #ef4444)' }}>
                  {probBear.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Tactical Strategy Tilt Box */}
            <div className={s.tiltBox}>
              <div className={s.tiltContent}>
                <span className={s.terminalTag}>{tactical.badge}</span>
                <span>{tactical.text}</span>
              </div>
              <Link to="/rebalancing" className={s.tiltLink}>
                ปรับพอร์ตตามสภาวะตลาด →
              </Link>
            </div>
          </div>

          {/* 2. Real-time ML Day Trade Signals Radar (Top 4 Setups) */}
          {topSignals.length > 0 && (
            <div className={s.signalsWidget}>
              <div className={s.signalsWidgetHead}>
                <h3>⚡ Real-time ML Day Trade Radar (Top Setups)</h3>
                <Link to="/mt5" className={s.tiltLink}>
                  ดูสัญญาณทั้ง 25 สินทรัพย์ →
                </Link>
              </div>

              <div className={s.signalsWidgetGrid}>
                {topSignals.map((sig) => {
                  const isBuy = sig.action.includes('BUY')
                  const isSell = sig.action.includes('SELL')
                  return (
                    <div key={sig.symbol} className={s.miniSigCard}>
                      <div className={s.miniSigTop}>
                        <span className={s.miniSigSymbol}>{sig.symbol}</span>
                        <span
                          className={`${s.miniSigBadge} ${
                            isBuy ? s.badgeBuy : isSell ? s.badgeSell : s.badgeNeutral
                          }`}
                        >
                          {sig.action}
                        </span>
                      </div>
                      <div className={s.miniSigPrices}>
                        <span className={s.miniSigPrice}>
                          {sig.currency === 'THB' ? '฿' : '$'}
                          {sig.current_price}
                        </span>
                        <span className={s.miniSigConf}>{sig.confidence}% Conf</span>
                      </div>
                      <Link to="/mt5" className={s.miniSigBtn}>
                        Trade on MT5
                      </Link>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 3. Cumulative Return Historical Area Chart */}
          <div className={`card ${s.chartCard}`}>
            <ReturnsLineChart height={220} />
          </div>

          {/* 4. Portfolio Allocation MPT Weights */}
          <div className={`card ${s.chartCard}`}>
            <PortfolioPieChart />
          </div>

          {/* 5. Real-time 25 Assets Price Table */}
          <div className={`card ${s.chartCard}`}>
            <PriceTable />
          </div>
        </div>

        {/* Right Column: News Feed (ข่าวล่าสุด) */}
        <div className={s.side}>
          <div className={`card ${s.chartCard}`}>
            <NewsFeed />
          </div>
        </div>
      </div>
    </div>
  )
}
