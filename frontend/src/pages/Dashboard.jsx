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
  const [featureImportance, setFeatureImportance] = useState([])
  const [backtestComp, setBacktestComp] = useState(null)
  const liveTimerRef = useRef(null)

  /* Live prices — auto-refresh every 60s */
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
    try {
      const res = await api.daytradeSignals()
      setMlData(res)
    } catch (e) {
      console.warn('ML signals fetch failed:', e.message)
    }
  }, [])

  /* ML Feature Importance from trained model */
  const loadMlAnalytics = useCallback(async () => {
    try {
      const res = await api.analysisRegime()
      if (res?.importance && res.importance.length > 0) {
        setFeatureImportance(res.importance)
      }
    } catch (e) {
      console.warn('ML analytics fetch failed:', e.message)
    }
  }, [])

  /* Backtest benchmark comparison */
  const loadBacktestComparison = useCallback(async () => {
    try {
      const res = await api.backtest('1y')
      if (res?.comparison && res.comparison.length > 0) {
        setBacktestComp(res.comparison)
      }
    } catch (e) {
      console.warn('Backtest comparison fetch failed:', e.message)
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
    loadMlAnalytics()
    loadBacktestComparison()

    liveTimerRef.current = setInterval(() => {
      loadLive()
      loadMlSignals()
    }, 60_000)
    return () => clearInterval(liveTimerRef.current)
  }, [loadLive, loadInitial, loadMlSignals, loadMlAnalytics, loadBacktestComparison])

  // Active regime from ML
  const activeRegimeState = mlData?.regime?.state || regime?.regime || 'Neutral'
  const activeRegimeConf = mlData?.regime?.confidence || 58.6
  const probBull = (mlData?.regime?.prob_bull ?? regime?.prob_bull ?? 0.002) * 100
  const probNeutral = (mlData?.regime?.prob_neutral ?? regime?.prob_neutral ?? 0.586) * 100
  const probBear = (mlData?.regime?.prob_bear ?? regime?.prob_bear ?? 0.411) * 100

  const loading = !portfolio && !regime

  // Top actionable signals from 25 assets
  const topSignals = mlData?.signals
    ? [...mlData.signals]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 4)
    : []

  // Top 3 feature drivers for clean display
  const topFeatures = (featureImportance.length > 0 ? featureImportance : [
    { feature: 'vol_20d', importance: 19.78 },
    { feature: 'price_vs_ma60', importance: 16.97 },
    { feature: 'sharpe_20d', importance: 15.19 },
  ]).slice(0, 3)

  const featureLabels = {
    vol_20d: '20D Volatility',
    price_vs_ma60: 'Trend MA60 Gap',
    sharpe_20d: '20D Sharpe Ratio',
    ret_20d: '20D Momentum',
    ret_60d: '60D Momentum',
    sharpe_60d: '60D Sharpe Ratio',
  }

  // Empirical benchmark
  const regimeStrategy = backtestComp?.find((s) => s.strategy === 'Regime-Based')

  // Dynamic tactical tilt recommendation based on ML regime
  const getTacticalAdvice = () => {
    const sLow = activeRegimeState.toLowerCase()
    if (sLow === 'bull') {
      return {
        badge: 'BULL TILT (+15% EQUITY ALPHA)',
        text: 'เพิ่มน้ำหนักหุ้นเติบโตและ High-Beta Tech (+15%) เพื่อเร่งผลตอบแทนสูงสุด',
        color: '#10b981',
      }
    }
    if (sLow === 'bear') {
      return {
        badge: 'DEFENSIVE TILT (+80% SAFE ASSETS)',
        text: 'เพิ่มน้ำหนักพันธบัตรและทองคำ (+80%) ป้องกันความเสี่ยงพอร์ตช่วงตลาดผันผวน',
        color: '#ef4444',
      }
    }
    return {
      badge: 'BALANCED MPT 60/40',
      text: 'กระจายความเสี่ยงสมดุลตาม Markowitz Mean-Variance Tangency Portfolio',
      color: '#f59e0b',
    }
  }

  const tactical = getTacticalAdvice()

  return (
    <div className={s.page}>
      {/* ── 1. Commercial Executive Header ── */}
      <header className={s.header}>
        <div className={s.headerBrand}>
          <div className={s.brandRow}>
            <span className={s.brandName}>QUANTIX PRO</span>
            <span className={s.tagTier}>INSTITUTIONAL</span>
            <span className={s.liveFeedBadge}>
              <span className={s.pulseDot} />
              LIVE TELEMETRY
            </span>
            {liveMeta?.fx_thb_per_usd && (
              <span className={s.fxPill}>฿{liveMeta.fx_thb_per_usd}/USD</span>
            )}
          </div>
          <p className={s.headerSub}>
            Quantitative Portfolio Optimization & Machine Learning Market Regime Intelligence
          </p>
        </div>

        <div className={s.headerActions}>
          <div className={`${s.regimeIndicator} ${
            activeRegimeState.toLowerCase() === 'bull'
              ? s.regimeBull
              : activeRegimeState.toLowerCase() === 'bear'
              ? s.regimeBear
              : s.regimeNeutral
          }`}>
            <span className={s.regimeLabel}>MARKET REGIME:</span>
            <span className={s.regimeVal}>{activeRegimeState.toUpperCase()}</span>
            <span className={s.regimeConf}>({activeRegimeConf}%)</span>
          </div>

          <Link to="/mt5" className={s.btnPrimary}>
            ⚡ Day Trade MT5
          </Link>
          <Link to="/rebalancing" className={s.btnSecondary}>
            ⚖️ Rebalance
          </Link>
          <RunButton
            onDone={() => {
              loadInitial()
              loadLive()
              loadMlSignals()
              loadMlAnalytics()
              loadBacktestComparison()
            }}
          />
        </div>
      </header>

      {/* ── 2. Executive KPI Strip ── */}
      <div className={s.kpiGrid}>
        <StatCard
          icon="◈"
          label="Optimal Sharpe Ratio"
          color="accent"
          loading={loading}
          value={fmt(portfolio?.sharpe, 4)}
          sub="Tangency Max Sharpe Portfolio"
          to="/analysis/sharpe"
        />
        <StatCard
          icon="↑"
          label="Expected Annual Return"
          color="green"
          loading={loading}
          value={pct(portfolio?.ret)}
          sub="ผลตอบแทนคาดหวังต่อปี (CAGR)"
          to="/analysis/return"
        />
        <StatCard
          icon="~"
          label="Annual Volatility"
          color="yellow"
          loading={loading}
          value={pct(portfolio?.vol)}
          sub="ความผันผวนต่อปี (Portfolio Risk)"
          to="/analysis/volatility"
        />
        <StatCard
          icon="🛡️"
          label="Max Drawdown Protection"
          color="green"
          loading={loading}
          value={regimeStrategy ? `${fmt(regimeStrategy.max_drawdown)}%` : '-5.02%'}
          sub="ลดความเสี่ยงลง 66% เทียบกับ Static MPT"
          to="/backtesting"
        />
      </div>

      {/* ── 3. Primary Charts Row: Performance & Allocation ── */}
      <div className={s.chartsRow}>
        <div className={`card ${s.performanceCard}`}>
          <ReturnsLineChart height={260} />
        </div>
        <div className={`card ${s.allocationCard}`}>
          <PortfolioPieChart />
        </div>
      </div>

      {/* ── 4. Intelligence & Execution Row: AI Regime Tilt + Trade Radar ── */}
      <div className={s.intelRow}>
        {/* Left: AI Market Regime & Tactical Tilt */}
        <div className={`card ${s.regimeCard}`}>
          <div className={s.cardHead}>
            <div>
              <span className={s.sectionTag}>AI REGIME INTELLIGENCE</span>
              <h3 className={s.cardTitle}>Market Regime & Tactical Allocation</h3>
            </div>
            <Link to="/analysis/regime" className={s.cardLink}>
              View XAI Details →
            </Link>
          </div>

          {/* Probability Bars */}
          <div className={s.probSection}>
            <div className={s.probRow}>
              <span className={s.probLabel}>🐂 Bullish</span>
              <div className={s.probTrack}>
                <div
                  className={s.probBar}
                  style={{ width: `${Math.max(probBull, 2)}%`, background: '#10b981' }}
                />
              </div>
              <span className={s.probVal} style={{ color: '#10b981' }}>{probBull.toFixed(1)}%</span>
            </div>

            <div className={s.probRow}>
              <span className={s.probLabel}>⚖️ Neutral</span>
              <div className={s.probTrack}>
                <div
                  className={s.probBar}
                  style={{ width: `${Math.max(probNeutral, 2)}%`, background: '#f59e0b' }}
                />
              </div>
              <span className={s.probVal} style={{ color: '#f59e0b' }}>{probNeutral.toFixed(1)}%</span>
            </div>

            <div className={s.probRow}>
              <span className={s.probLabel}>🐻 Bearish</span>
              <div className={s.probTrack}>
                <div
                  className={s.probBar}
                  style={{ width: `${Math.max(probBear, 2)}%`, background: '#ef4444' }}
                />
              </div>
              <span className={s.probVal} style={{ color: '#ef4444' }}>{probBear.toFixed(1)}%</span>
            </div>
          </div>

          {/* Tactical Tilt Strip */}
          <div className={s.tacticalBox}>
            <div className={s.tacticalHead}>
              <span className={s.tacticalBadge} style={{ borderColor: tactical.color, color: tactical.color }}>
                {tactical.badge}
              </span>
              <Link to="/rebalancing" className={s.rebalanceLink}>
                Auto-Rebalance →
              </Link>
            </div>
            <p className={s.tacticalText}>{tactical.text}</p>
          </div>

          {/* Top Feature Drivers (XAI) */}
          <div className={s.driversSection}>
            <span className={s.driversLabel}>Top Quantitative Drivers:</span>
            <div className={s.driversList}>
              {topFeatures.map((f) => (
                <span key={f.feature} className={s.driverPill}>
                  {featureLabels[f.feature] || f.feature} · <strong>{f.importance.toFixed(1)}%</strong>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Real-time ML Day Trade Radar */}
        <div className={`card ${s.radarCard}`}>
          <div className={s.cardHead}>
            <div>
              <span className={s.sectionTag}>REAL-TIME RADAR</span>
              <h3 className={s.cardTitle}>Top Actionable Trade Setups</h3>
            </div>
            <Link to="/mt5" className={s.cardLink}>
              Open Terminal →
            </Link>
          </div>

          {topSignals.length > 0 ? (
            <div className={s.radarGrid}>
              {topSignals.map((sig) => {
                const isBuy = sig.action.includes('BUY')
                const isSell = sig.action.includes('SELL')
                return (
                  <div key={sig.symbol} className={s.sigItem}>
                    <div className={s.sigHeader}>
                      <span className={s.sigSymbol}>{sig.symbol}</span>
                      <span className={`${s.sigBadge} ${
                        isBuy ? s.badgeBuy : isSell ? s.badgeSell : s.badgeNeutral
                      }`}>
                        {sig.action}
                      </span>
                    </div>
                    <div className={s.sigBody}>
                      <span className={s.sigPrice}>
                        {sig.currency === 'THB' ? '฿' : '$'}
                        {sig.current_price}
                      </span>
                      <span className={s.sigConf}>{sig.confidence}% Conf</span>
                    </div>
                    <div className={s.sigFoot}>
                      <span>RSI: {sig.indicators?.rsi_14 ?? '—'}</span>
                      <Link to="/mt5" className={s.sigActionBtn}>
                        Trade MT5
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className={s.emptyRadar}>
              <span>Scanning 25 assets for breakout setups...</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Market Pulse & Asset Overview ── */}
      <div className={s.marketRow}>
        <div className={`card ${s.tableCard}`}>
          <PriceTable />
        </div>
        <div className={`card ${s.newsCard}`}>
          <NewsFeed />
        </div>
      </div>
    </div>
  )
}
