import { useEffect, useState } from 'react'

const TOP_TICKERS = [
  { symbol: 'AAPL', name: 'Apple', base: 228.40, category: 'US' },
  { symbol: 'NVDA', name: 'Nvidia', base: 165.40, category: 'US' },
  { symbol: 'TSLA', name: 'Tesla', base: 345.00, category: 'US' },
  { symbol: 'PTT', name: 'PTT PCL', base: 37.40, category: 'TH' },
  { symbol: 'DELTA', name: 'Delta Thai', base: 155.00, category: 'TH' },
  { symbol: 'GLD', name: 'Gold SPDR', base: 248.50, category: 'Bonds' },
  { symbol: 'MSFT', name: 'Microsoft', base: 420.10, category: 'US' },
  { symbol: 'AOT', name: 'Airports TH', base: 60.25, category: 'TH' },
  { symbol: 'META', name: 'Meta', base: 580.20, category: 'US' },
  { symbol: 'TLT', name: 'Treasury 20Y', base: 92.40, category: 'Bonds' },
]

export default function TickerTape({ onSelectSymbol, activeSymbol }) {
  const [ticks, setTicks] = useState(() =>
    TOP_TICKERS.map((t) => ({
      ...t,
      price: t.base,
      chg: (Math.random() * 2 - 0.8).toFixed(2),
      flash: null,
    }))
  )

  useEffect(() => {
    const timer = setInterval(() => {
      setTicks((prev) =>
        prev.map((item) => {
          // 30% chance to update each tick
          if (Math.random() > 0.4) {
            const delta = (Math.random() * 0.4 - 0.19)
            const newPrice = Math.max(1, item.price + delta)
            const flash = delta >= 0 ? 'up' : 'down'
            return {
              ...item,
              price: Number(newPrice.toFixed(2)),
              chg: (Number(item.chg) + (delta / item.base) * 100).toFixed(2),
              flash,
            }
          }
          return { ...item, flash: null }
        })
      )
    }, 2500)
    return () => clearInterval(timer)
  }, [])

  return (
    <div style={styles.tapeContainer}>
      <div style={styles.tapeLabel}>
        <span style={styles.liveDot} />
        LIVE 25-ASSET TAPE
      </div>
      <div style={styles.tapeTrack}>
        {ticks.map((t) => {
          const isUp = Number(t.chg) >= 0
          const isActive = t.symbol === activeSymbol
          return (
            <button
              key={t.symbol}
              onClick={() => onSelectSymbol && onSelectSymbol(t.symbol)}
              style={{
                ...styles.tapeItem,
                ...(isActive ? styles.tapeItemActive : {}),
                backgroundColor:
                  t.flash === 'up'
                    ? 'rgba(16, 185, 129, 0.18)'
                    : t.flash === 'down'
                    ? 'rgba(239, 68, 68, 0.18)'
                    : 'rgba(255, 255, 255, 0.03)',
              }}
              title={`คลิกเพื่อเปิดชาร์ต ${t.name}`}
            >
              <span style={styles.itemSymbol}>{t.symbol}</span>
              <span style={styles.itemPrice}>
                {t.category === 'TH' ? '฿' : '$'}
                {t.price.toFixed(2)}
              </span>
              <span style={isUp ? styles.chgUp : styles.chgDown}>
                {isUp ? '+' : ''}
                {t.chg}%
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const styles = {
  tapeContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(15, 23, 42, 0.75)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '8px 14px',
    marginBottom: '16px',
    overflow: 'hidden',
    backdropFilter: 'blur(12px)',
  },
  tapeLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#38bdf8',
    whiteSpace: 'nowrap',
    paddingRight: '12px',
    borderRight: '1px solid rgba(255, 255, 255, 0.1)',
  },
  liveDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    boxShadow: '0 0 8px #10b981',
  },
  tapeTrack: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    overflowX: 'auto',
    scrollbarWidth: 'none',
    width: '100%',
  },
  tapeItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 10px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
    background: 'none',
  },
  tapeItemActive: {
    borderColor: '#38bdf8',
    boxShadow: '0 0 10px rgba(56, 189, 248, 0.25)',
  },
  itemSymbol: {
    fontWeight: 700,
    fontSize: '12px',
    color: '#f8fafc',
  },
  itemPrice: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#cbd5e1',
  },
  chgUp: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#10b981',
    fontFamily: 'monospace',
  },
  chgDown: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#ef4444',
    fontFamily: 'monospace',
  },
}
