/**
 * ChartContext
 * ─────────────────────────────────────────────────────────────
 * Global state ที่ทุก component ใช้ร่วมกัน
 * Chat bot dispatch ข้อมูลเข้ามา → charts re-render อัตโนมัติ
 *
 * shape:
 *  portfolio : { weights: {AAPL:0.2,…}, sharpe, ret, vol }
 *  regime    : { date, regime, prob_bull, prob_neutral, prob_bear }
 *  returns   : [ { date:'2024-01', …tickers }, … ]  ← line chart
 *  prices    : { AAPL: 10500, … }
 *  lastUpdated: ISO string
 */
import { createContext, useContext, useReducer, useCallback } from 'react'

/* ── initial state ─────────────────────────────── */
const INIT = {
  portfolio:   null,
  regime:      null,
  returns:     [],
  prices:      {},
  changes:     {},
  liveMeta:    null,   // { date, fx_thb_per_usd, fetched_at, status }
  lastUpdated: null,
}

/* ── reducer ───────────────────────────────────── */
function reducer(state, action) {
  const ts = new Date().toISOString()
  switch (action.type) {
    case 'SET_PORTFOLIO':
      return { ...state, portfolio: action.payload, lastUpdated: ts }
    case 'SET_REGIME':
      return { ...state, regime: action.payload, lastUpdated: ts }
    case 'SET_RETURNS':
      return { ...state, returns: action.payload, lastUpdated: ts }
    case 'SET_PRICES':
      return { ...state, prices: action.payload, lastUpdated: ts }
    case 'SET_LIVE':
      return {
        ...state,
        prices:      action.payload.prices  ?? state.prices,
        changes:     action.payload.changes ?? state.changes,
        liveMeta:    {
          date:            action.payload.date,
          fx_thb_per_usd:  action.payload.fx_thb_per_usd,
          fetched_at:      action.payload.fetched_at,
          status:          action.payload.status,
        },
        lastUpdated: ts,
      }
    case 'RESET':
      return { ...INIT }
    default:
      return state
  }
}

/* ── context ───────────────────────────────────── */
const ChartContext = createContext(null)

export function ChartProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INIT)

  /** parse tool_results จาก chat แล้ว dispatch ที่เหมาะสม */
  const applyToolResults = useCallback((toolResults = []) => {
    for (const { tool, result } of toolResults) {
      if (!result || result.status === 'error') continue

      switch (tool) {
        case 'optimize_portfolio': {
          const raw = result.top5_weights ?? {}
          const weights = Object.fromEntries(
            Object.entries(result.all_weights ?? raw).map(([k, v]) => [k, Number(v)])
          )
          dispatch({
            type: 'SET_PORTFOLIO',
            payload: {
              weights,
              sharpe: Number(result.sharpe_ratio),
              ret:    Number(result.annualized_return),
              vol:    Number(result.annualized_volatility),
              objective: result.objective,
            },
          })
          break
        }
        case 'classify_market_regime': {
          dispatch({
            type: 'SET_REGIME',
            payload: {
              date:         result.date,
              regime:       result.regime,
              prob_bull:    Number(result.prob_bull)    || 0,
              prob_neutral: Number(result.prob_neutral) || 0,
              prob_bear:    Number(result.prob_bear)    || 0,
            },
          })
          break
        }
        case 'get_portfolio_summary': {
          const weights = Object.fromEntries(
            Object.entries(result.all_weights ?? result.top5_weights ?? {}).map(([k, v]) => [k, Number(v)])
          )
          dispatch({
            type: 'SET_PORTFOLIO',
            payload: {
              weights,
              sharpe: Number(result.sharpe_ratio),
              ret:    Number(result.annualized_return),
              vol:    Number(result.annualized_volatility),
            },
          })
          break
        }
        case 'get_regime_summary': {
          dispatch({
            type: 'SET_REGIME',
            payload: {
              date:         result.date,
              regime:       result.regime,
              prob_bull:    Number(result.prob_bull)    || 0,
              prob_neutral: Number(result.prob_neutral) || 0,
              prob_bear:    Number(result.prob_bear)    || 0,
            },
          })
          break
        }
        case 'get_latest_prices': {
          dispatch({ type: 'SET_PRICES', payload: result.prices ?? {} })
          break
        }
        case 'run_data_pipeline': {
          // pipeline เสร็จ → refetch prices
          fetch('/api/prices?n=1')
            .then(r => r.json())
            .then(d => dispatch({ type: 'SET_PRICES', payload: d.prices ?? {} }))
            .catch(() => {})
          break
        }
        default:
          break
      }
    }
  }, [])

  return (
    <ChartContext.Provider value={{ ...state, dispatch, applyToolResults }}>
      {children}
    </ChartContext.Provider>
  )
}

export const useChart = () => {
  const ctx = useContext(ChartContext)
  if (!ctx) throw new Error('useChart must be used inside <ChartProvider>')
  return ctx
}
