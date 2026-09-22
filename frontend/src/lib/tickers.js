/**
 * Predefined ticker list + custom ticker support.
 * Used by MyPortfolio and Watchlist.
 */
export const TICKER_GROUPS = [
  { group: 'US', label: '🇺🇸 US Stocks', items: [
    'AAPL','MSFT','GOOGL','AMZN','NVDA','TSLA','META','JNJ','V','JPM',
  ]},
  { group: 'TH', label: '🇹🇭 Thai Stocks', items: [
    'PTT.BK','AOT.BK','CPALL.BK','BDMS.BK','DELTA.BK',
    'GULF.BK','ADVANC.BK','SCB.BK','KBANK.BK','PTTEP.BK',
  ]},
  { group: 'BD', label: '🏦 Bonds & Gold', items: [
    'TLT','IEF','SHY','GLD','BIL',
  ]},
]

/** All predefined tickers as a flat array */
export const ALL_PREDEFINED = TICKER_GROUPS.flatMap(g => g.items)

/**
 * Build a <datalist> options array combining predefined + custom tickers.
 */
export function buildTickerOptions(customTickers = []) {
  const seen = new Set()
  const opts = []
  for (const t of [...ALL_PREDEFINED, ...customTickers]) {
    const upper = t.toUpperCase()
    if (!seen.has(upper)) {
      seen.add(upper)
      opts.push(upper)
    }
  }
  return opts
}
