import { createChart, ColorType, LineStyle } from 'lightweight-charts'
import { useEffect, useRef, useState, useMemo } from 'react'

function computeEMA(candles, period) {
  if (!candles || candles.length < period) return []
  const k = 2 / (period + 1)
  let emaData = []
  let sum = 0
  for (let i = 0; i < period; i++) {
    sum += candles[i].close
  }
  let prevEma = sum / period
  emaData.push({ time: candles[period - 1].time, value: Number(prevEma.toFixed(2)) })

  for (let i = period; i < candles.length; i++) {
    prevEma = candles[i].close * k + prevEma * (1 - k)
    emaData.push({ time: candles[i].time, value: Number(prevEma.toFixed(2)) })
  }
  return emaData
}

export default function TradingViewChart({
  candles = [],
  symbol = 'AAPL',
  livePrice = null,
  positions = [],
  suggestedSl = null,
  suggestedTp = null,
  intervalLabel = '15m',
}) {
  const chartContainerRef = useRef(null)
  const chartRef = useRef(null)
  const candleSeriesRef = useRef(null)
  const volumeSeriesRef = useRef(null)
  const ema9SeriesRef = useRef(null)
  const ema21SeriesRef = useRef(null)
  const priceLinesRef = useRef([])

  // Day trading indicator toggles
  const [showVolume, setShowVolume] = useState(true)
  const [showEma9, setShowEma9] = useState(true)
  const [showEma21, setShowEma21] = useState(true)

  // Real-time Crosshair HUD info
  const [hoverData, setHoverData] = useState(null)

  // ── 1. Initialize Lightweight Chart with Day-Trading Configuration ──
  useEffect(() => {
    if (!chartContainerRef.current) return

    const container = chartContainerRef.current
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: "'Geist Mono', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      crosshair: {
        vertLine: {
          color: 'rgba(59, 130, 246, 0.5)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#2563eb',
        },
        horzLine: {
          color: 'rgba(59, 130, 246, 0.5)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#2563eb',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.22, // Leaves room for volume histogram
        },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
      width: container.clientWidth || 600,
      height: 380,
    })

    // Candlesticks (Institutional green/red)
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    })

    // Volume Histogram (Sub-pane overlay at bottom 20% height)
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '', // Overlay scale
      scaleMargins: {
        top: 0.78,
        bottom: 0,
      },
    })

    // EMA 9 (Fast - Cyan)
    const ema9Series = chart.addLineSeries({
      color: '#38bdf8',
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'EMA 9',
    })

    // EMA 21 (Trend - Orange)
    const ema21Series = chart.addLineSeries({
      color: '#fb923c',
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'EMA 21',
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries
    ema9SeriesRef.current = ema9Series
    ema21SeriesRef.current = ema21Series

    // Crosshair hover listener for HUD
    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.seriesData) {
        setHoverData(null)
        return
      }
      const cData = param.seriesData.get(candleSeries)
      const vData = param.seriesData.get(volumeSeries)
      const e9Data = param.seriesData.get(ema9Series)
      const e21Data = param.seriesData.get(ema21Series)

      if (cData) {
        const timeStr = typeof param.time === 'number'
          ? new Date(param.time * 1000).toLocaleString('th-TH', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })
          : param.time
        setHoverData({
          time: timeStr,
          open: cData.open,
          high: cData.high,
          low: cData.low,
          close: cData.close,
          change: cData.open > 0 ? ((cData.close - cData.open) / cData.open) * 100 : 0,
          volume: vData?.value || 0,
          ema9: e9Data?.value || null,
          ema21: e21Data?.value || null,
        })
      }
    })

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
      volumeSeriesRef.current = null
      ema9SeriesRef.current = null
      ema21SeriesRef.current = null
    }
  }, [])

  // ── 2. Update Candlestick, Volume & EMA Indicator Data ──
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

      // Set Volume Histogram with matching colors
      if (volumeSeriesRef.current) {
        const volData = unique.map((c) => ({
          time: c.time,
          value: c.volume || 1000,
          color: c.close >= c.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
        }))
        volumeSeriesRef.current.setData(showVolume ? volData : [])
      }

      // Compute and set EMAs
      if (ema9SeriesRef.current) {
        const ema9 = computeEMA(unique, 9)
        ema9SeriesRef.current.setData(showEma9 ? ema9 : [])
      }
      if (ema21SeriesRef.current) {
        const ema21 = computeEMA(unique, 21)
        ema21SeriesRef.current.setData(showEma21 ? ema21 : [])
      }

      chartRef.current?.timeScale().fitContent()
    }
  }, [candles, symbol, showVolume, showEma9, showEma21])

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
          title: `${pos.type} #${pos.ticket} (${pos.volume}L @ $${pos.price_open})`,
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
          title: `SL #${pos.ticket} ($${pos.sl})`,
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
          title: `TP #${pos.ticket} ($${pos.tp})`,
        })
        priceLinesRef.current.push(tpLine)
      }
    }

    // Suggested ML SL / TP if no open position
    if (activePositions.length === 0) {
      if (suggestedSl > 0) {
        const slLine = series.createPriceLine({
          price: suggestedSl,
          color: 'rgba(239, 68, 68, 0.7)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `ML Stop Loss ($${suggestedSl})`,
        })
        priceLinesRef.current.push(slLine)
      }
      if (suggestedTp > 0) {
        const tpLine = series.createPriceLine({
          price: suggestedTp,
          color: 'rgba(16, 185, 129, 0.7)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `ML Take Profit ($${suggestedTp})`,
        })
        priceLinesRef.current.push(tpLine)
      }
    }
  }, [positions, symbol, suggestedSl, suggestedTp])

  // Latest candle for fallback HUD display
  const latestCandle = candles[candles.length - 1]

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
      {/* ── Day Trading Indicator Toggle Controls & OHLCV Crosshair HUD ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '8px 14px',
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        fontSize: '0.74rem',
        fontFamily: "'Geist Mono', monospace",
      }}>
        {/* Left: Active OHLCV Data */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ color: '#38bdf8', fontWeight: 800 }}>{symbol} ({intervalLabel})</span>
          <span>
            <strong style={{ color: '#64748b' }}>O: </strong>
            ${(hoverData?.open ?? latestCandle?.open ?? 0).toFixed(2)}
          </span>
          <span>
            <strong style={{ color: '#64748b' }}>H: </strong>
            ${(hoverData?.high ?? latestCandle?.high ?? 0).toFixed(2)}
          </span>
          <span>
            <strong style={{ color: '#64748b' }}>L: </strong>
            ${(hoverData?.low ?? latestCandle?.low ?? 0).toFixed(2)}
          </span>
          <span>
            <strong style={{ color: '#64748b' }}>C: </strong>
            <span style={{
              fontWeight: 700,
              color: (hoverData?.close ?? latestCandle?.close ?? 0) >= (hoverData?.open ?? latestCandle?.open ?? 0) ? '#10b981' : '#f43f5e',
            }}>
              ${(hoverData?.close ?? latestCandle?.close ?? 0).toFixed(2)}
            </span>
          </span>
          {(hoverData || latestCandle) && (
            <span style={{
              fontWeight: 700,
              color: (hoverData?.change ?? 0) >= 0 ? '#10b981' : '#f43f5e',
            }}>
              {(hoverData?.change ?? 0) >= 0 ? '+' : ''}{(hoverData?.change ?? 0).toFixed(2)}%
            </span>
          )}
          {showVolume && (
            <span>
              <strong style={{ color: '#64748b' }}>Vol: </strong>
              {(hoverData?.volume ?? latestCandle?.volume ?? 0).toLocaleString()}
            </span>
          )}
          {hoverData?.time && (
            <span style={{ color: '#94a3b8', fontSize: '0.68rem' }}>[{hoverData.time}]</span>
          )}
        </div>

        {/* Right: Indicator Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setShowEma9(!showEma9)}
            style={{
              background: showEma9 ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              color: showEma9 ? '#38bdf8' : '#64748b',
              border: `1px solid ${showEma9 ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`,
              padding: '2px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.68rem',
              fontWeight: 700,
            }}
          >
            EMA 9 {hoverData?.ema9 ? `($${hoverData.ema9})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setShowEma21(!showEma21)}
            style={{
              background: showEma21 ? 'rgba(251, 146, 60, 0.15)' : 'transparent',
              color: showEma21 ? '#fb923c' : '#64748b',
              border: `1px solid ${showEma21 ? '#fb923c' : 'rgba(255,255,255,0.1)'}`,
              padding: '2px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.68rem',
              fontWeight: 700,
            }}
          >
            EMA 21 {hoverData?.ema21 ? `($${hoverData.ema21})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setShowVolume(!showVolume)}
            style={{
              background: showVolume ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: showVolume ? '#60a5fa' : '#64748b',
              border: `1px solid ${showVolume ? '#60a5fa' : 'rgba(255,255,255,0.1)'}`,
              padding: '2px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.68rem',
              fontWeight: 700,
            }}
          >
            VOL
          </button>
        </div>
      </div>

      <div ref={chartContainerRef} style={{ width: '100%', height: '380px' }} />
    </div>
  )
}
