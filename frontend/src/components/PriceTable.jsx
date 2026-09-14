import { useEffect, useState, useCallback } from 'react'
import { useChart } from '../context/ChartContext'
import { api } from '../hooks/useApi'
import s from './PriceTable.module.css'

const GROUP = {
  'AAPL':'US','MSFT':'US','GOOGL':'US','AMZN':'US','NVDA':'US',
  'TSLA':'US','META':'US','JNJ':'US','V':'US','JPM':'US',
  'PTT.BK':'TH','AOT.BK':'TH','CPALL.BK':'TH','BDMS.BK':'TH','DELTA.BK':'TH',
  'GULF.BK':'TH','ADVANC.BK':'TH','SCB.BK':'TH','KBANK.BK':'TH','PTTEP.BK':'TH',
  'TLT':'BD','IEF':'BD','SHY':'BD','GLD':'BD','BIL':'BD',
}
const GROUP_LABEL = { US:'🇺🇸 US', TH:'🇹🇭 Thai', BD:'🏦 Bond' }
const GROUP_ORDER = ['US','TH','BD']

function fmt(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function PriceTable() {
  const { prices, changes = {}, lastUpdated } = useChart()
  const [prevPrices, setPrevPrices] = useState({})
  const [filter, setFilter]         = useState('ALL')
  const [search, setSearch]         = useState('')

  /* เก็บ prev เพื่อแสดง flash สี */
  useEffect(() => {
    if (Object.keys(prices).length) {
      setPrevPrices(p => ({ ...p, ...prices }))
    }
  }, [lastUpdated])

  const rows = Object.entries(prices)
    .map(([ticker, price]) => {
      const g    = GROUP[ticker] ?? 'US'
      const prev = prevPrices[ticker]
      const diff = prev && prev !== price ? price - prev : 0
      const chg  = changes[ticker]
      return { ticker, price, group: g, diff, chg }
    })
    .filter(r => {
      if (filter !== 'ALL' && r.group !== filter) return false
      if (search && !r.ticker.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      const go = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)
      return go !== 0 ? go : a.ticker.localeCompare(b.ticker)
    })

  const dateStr = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString('th-TH', { day:'2-digit', month:'short', year:'2-digit' })
    : '—'

  return (
    <div className={s.wrap}>
      {/* header */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <h3>ราคาล่าสุด</h3>
          <span className={s.date}>{dateStr} · THB</span>
        </div>
        <div className={s.controls}>
          <input
            className={s.search}
            placeholder="ค้นหา…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className={s.filters}>
            {['ALL','US','TH','BD'].map(f => (
              <button key={f}
                className={`${s.fBtn} ${filter === f ? s.fActive : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'ALL' ? 'All' : GROUP_LABEL[f]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* table */}
      {rows.length > 0 ? (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>กลุ่ม</th>
                <th className={s.right}>ราคา (THB)</th>
                <th className={s.right}>1D</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ ticker, price, group, diff, chg }) => (
                <tr key={ticker}
                  className={`${s.row} ${diff > 0 ? s.up : diff < 0 ? s.down : ''}`}
                >
                  <td className={s.ticker}>{ticker}</td>
                  <td><span className={`${s.badge} ${s[`g${group}`]}`}>{GROUP_LABEL[group]}</span></td>
                  <td className={`${s.right} ${s.price}`}>
                    ฿{fmt(price)}
                    {diff !== 0 && (
                      <span className={`${s.arrow} ${diff > 0 ? s.arrowUp : s.arrowDown}`}>
                        {diff > 0 ? '▲' : '▼'}
                      </span>
                    )}
                  </td>
                  <td className={`${s.right} ${chg == null ? '' : chg >= 0 ? s.chgUp : s.chgDown}`}>
                    {chg == null ? '—' : `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={s.empty}>
          {Object.keys(prices).length === 0
            ? 'กด "Pipeline" เพื่อดึงข้อมูลราคา'
            : 'ไม่พบ ticker ที่ค้นหา'
          }
        </div>
      )}
    </div>
  )
}
