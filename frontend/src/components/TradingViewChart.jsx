import { createChart, ColorType, LineStyle } from 'lightweight-charts'
import { useEffect, useRef } from 'react'

export default function TradingViewChart({
  candles = [],
  symbol = 'AAPL',
  livePrice = null,
  positions = [],
  suggestedSl = null,
  suggestedTp = null,
}) {
  const chartContainerRef = useRef(null)
  const chartRef = useRef(null)
  const candleSeriesRef = useRef(null)
  const priceLinesRef = useRef([])

  // ── 1. Initialize Chart ──
  useEffect(() => {
    if (!chartContainerRef.current) return

    const container = chartContainerRef.current
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      crosshair: {
        vertLine: {
          color: 'rgba(139, 92, 246, 0.4)',
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: 'rgba(139, 92, 246, 0.4)',
          width: 1,
          style: LineStyle.Dashed,
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: {
          top: 0.15,
          bottom: 0.15,
        },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      width: container.clientWidth || 600,
      height: 360,
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries

    // Responsive resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length > 0 && chartRef.current) {
        chartRef.current.applyOptions({
          width: entries[0].contentRect.width,
        })
      }
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
    }
  }, [])

  // ── 2. Update Candlestick Data ──
  useEffect(() => {
    if (!candleSeriesRef.current || !candles || candles.length === 0) return

    // Ensure candles are sorted ascending by time and strictly unique
    const sorted = [...candles].sort((a, b) => a.time - b.time)
    const unique = []
    const seen = new Set()
    for (const c of sorted) {
      if (!seen.has(c.time) && c.open > 0 && c.close > 0) {
        seen.add(c.time)
        unique.push(c)
      }
    }

    if (unique.length > 0) {
      candleSeriesRef.current.setData(unique)
      chartRef.current?.timeScale().fitContent()
    }
  }, [candles, symbol])

  // ── 3. Real-Time Tick Update on the active bar ──
  useEffect(() => {
    if (!candleSeriesRef.current || !livePrice || livePrice <= 0 || !candles || candles.length === 0) return

    const last = candles[candles.length - 1]
    if (last) {
      try {
        candleSeriesRef.current.update({
          time: last.time,
          open: last.open,
          high: Math.max(last.high, livePrice),
          low: Math.min(last.low, livePrice),
          close: livePrice,
        })
      } catch {
        // ignore tick updates if sequence mismatch
      }
    }
  }, [livePrice, candles])

  // ── 4. Dynamic Price Lines (Open Orders, SL, TP) ──
  useEffect(() => {
    const series = candleSeriesRef.current
    if (!series) return

    // Clear old lines
    for (const line of priceLinesRef.current) {
      try {
        series.removePriceLine(line)
      } catch {
        // ignore cleanup error
      }
    }
    priceLinesRef.current = []

    // Add lines for open positions for this symbol
    const symClean = symbol.replace('.BK', '').replace('USD', '')
    const activePositions = positions.filter((p) => {
      const pSym = (p.symbol || '').replace('.BK', '').replace('USD', '')
      return pSym === symClean
    })

    for (const pos of activePositions) {
      if (pos.price_open > 0) {
        const line = series.createPriceLine({
          price: pos.price_open,
          color: pos.type === 'BUY' ? '#3b82f6' : '#ec4899',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `${pos.type} #${pos.ticket} (${pos.volume}L)`,
        })
        priceLinesRef.current.push(line)
      }
      if (pos.sl > 0) {
        const slLine = series.createPriceLine({
          price: pos.sl,
          color: '#ef4444',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `SL #${pos.ticket}`,
        })
        priceLinesRef.current.push(slLine)
      }
      if (pos.tp > 0) {
        const tpLine = series.createPriceLine({
          price: pos.tp,
          color: '#10b981',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `TP #${pos.ticket}`,
        })
        priceLinesRef.current.push(tpLine)
      }
    }

    // Suggested ML SL / TP if no open position
    if (activePositions.length === 0) {
      if (suggestedSl > 0) {
        const slLine = series.createPriceLine({
          price: suggestedSl,
          color: 'rgba(239, 68, 68, 0.6)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'ML Stop Loss',
        })
        priceLinesRef.current.push(slLine)
      }
      if (suggestedTp > 0) {
        const tpLine = series.createPriceLine({
          price: suggestedTp,
          color: 'rgba(16, 185, 129, 0.6)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'ML Take Profit',
        })
        priceLinesRef.current.push(tpLine)
      }
    }
  }, [positions, symbol, suggestedSl, suggestedTp])

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
      <div ref={chartContainerRef} style={{ width: '100%', height: '360px' }} />
    </div>
  )
}
