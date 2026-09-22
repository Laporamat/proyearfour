import { useEffect, useState } from 'react'
import { api } from '../hooks/useApi'
import s from './PortfolioComparison.module.css'

const fmt = (n, d = 2) =>
  n != null ? Number(n).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'

/**
 * Compares the user's actual portfolio allocation (from My Portfolio holdings)
 * against the MPT optimal portfolio weights.
 *
 * @param {Array} holdings — [{ ticker, shares, buyPrice, ... }] from MyPortfolio
 * @param {Object} livePrices — { AAPL: 11344, ... } from live endpoint
 */
export default function PortfolioComparison({ holdings, livePrices }) {
  const [optimal, setOptimal] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    api.portfolioLatest()
      .then(data => {
        if (!alive) return
        if (data && !data.status) {
          const weights = Object.fromEntries(
            Object.entries(data.all_weights ?? data.top5_weights ?? {}).map(([k, v]) => [k, Number(v)])
          )
          setOptimal({ weights, sharpe: data.sharpe_ratio, ret: data.annualized_return, vol: data.annualized_volatility })
        }
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) {
    return (
      <div className={`card ${s.wrap}`}>
        <h3>เทียบพอร์ตฉัน vs พอร์ต MPT ที่เหมาะสมที่สุด</h3>
        <div className="skeleton" style={{ height: 120, borderRadius: 8 }} />
      </div>
    )
  }

  if (!optimal || holdings.length === 0) return null

  // Calculate user's actual allocation (by current value)
  const userValues = {}
  let totalValue = 0
  for (const h of holdings) {
    const price = livePrices[h.ticker] ?? h.buyPrice
    const val = price * h.shares
    userValues[h.ticker] = (userValues[h.ticker] ?? 0) + val
    totalValue += val
  }
  const userWeights = {}
  for (const [ticker, val] of Object.entries(userValues)) {
    userWeights[ticker] = totalValue > 0 ? val / totalValue : 0
  }

  // Merge tickers from both portfolios
  const allTickers = [...new Set([
    ...Object.keys(userWeights),
    ...Object.keys(optimal.weights),
  ])].sort((a, b) => (userWeights[b] ?? 0) - (userWeights[a] ?? 0))

  const rows = allTickers.map(ticker => {
    const uw = (userWeights[ticker] ?? 0) * 100
    const ow = (optimal.weights[ticker] ?? 0) * 100
    const diff = uw - ow
    return { ticker, uw, ow, diff }
  }).filter(r => r.uw > 0.01 || r.ow > 0.01)

  return (
    <div className={`card ${s.wrap}`}>
      <div className={s.head}>
        <h3>เทียบพอร์ตฉัน vs พอร์ต MPT ที่เหมาะสมที่สุด</h3>
        <div className={s.optInfo}>
          <span>Optimal Sharpe: <strong>{fmt(optimal.sharpe, 4)}</strong></span>
          <span>Return: <strong>{fmt(optimal.ret)}%</strong></span>
          <span>Vol: <strong>{fmt(optimal.vol)}%</strong></span>
        </div>
      </div>

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>หุ้น</th>
              <th className={s.right}>สัดส่วนฉัน</th>
              <th className={s.right}>สัดส่วน MPT</th>
              <th className={s.right}>ต่าง</th>
              <th>แผนภูมิ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const maxW = Math.max(r.uw, r.ow, 1)
              return (
                <tr key={r.ticker}>
                  <td className={s.ticker}>{r.ticker}</td>
                  <td className={s.right}>{fmt(r.uw)}%</td>
                  <td className={s.right}>{fmt(r.ow)}%</td>
                  <td className={`${s.right} ${r.diff > 0.1 ? s.over : r.diff < -0.1 ? s.under : ''}`}>
                    {r.diff >= 0 ? '+' : ''}{fmt(r.diff)}%
                  </td>
                  <td className={s.barCell}>
                    <div className={s.barGroup}>
                      <div className={`${s.bar} ${s.barUser}`} style={{ width: `${(r.uw / maxW) * 100}%` }} />
                      <div className={`${s.bar} ${s.barOpt}`} style={{ width: `${(r.ow / maxW) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className={s.legend}>
        <span><i className={`${s.dot} ${s.barUser}`} /> พอร์ตฉัน</span>
        <span><i className={`${s.dot} ${s.barOpt}`} /> พอร์ต MPT ที่เหมาะสมที่สุด</span>
      </div>
    </div>
  )
}
