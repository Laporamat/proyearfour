import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import s from './CandleChart.module.css'

const UP = '#26a69a'
const DOWN = '#ef5350'
const GRID = 'rgba(255,255,255,0.045)'
const AXIS_TXT = '#7d879c'

const PAD_TOP = 14
const PAD_RIGHT = 64
const PAD_LEFT = 10
const AXIS_H = 24
const VOL_H = 62
const GAP = 10
const HEIGHT = 468

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const INTRADAY = new Set(['1m', '5m', '15m', '1h'])

function fmtTime(ms, tf) {
  const d = new Date(ms)
  if (INTRADAY.has(tf)) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  if (tf === '1mo') return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

function fmtDateFull(ms, tf) {
  const d = new Date(ms)
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
  if (INTRADAY.has(tf)) {
    return `${base}  ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return base
}

const fmtNum = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtVol = (v) => (v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : String(Math.round(v)))

function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

export default function CandleChart({ candles, tf, loading }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)

  const geom = useMemo(() => {
    if (!width || !candles?.length) return null
    const n = candles.length
    const chartW = width - PAD_LEFT - PAD_RIGHT
    const priceTop = PAD_TOP
    const priceH = HEIGHT - PAD_TOP - AXIS_H - VOL_H - GAP
    const volTop = priceTop + priceH + GAP
    const volBottom = volTop + VOL_H

    let lo = Infinity, hi = -Infinity, vMax = 0
    let hiIdx = 0, loIdx = 0
    for (let i = 0; i < n; i++) {
      const c = candles[i]
      if (c.l < lo) { lo = c.l; loIdx = i }
      if (c.h > hi) { hi = c.h; hiIdx = i }
      if (c.v > vMax) vMax = c.v
    }
    const padP = (hi - lo) * 0.06 || hi * 0.01 || 1
    const pMin = lo - padP
    const pMax = hi + padP
    const slot = chartW / n
    const bodyW = Math.max(1, Math.min(slot * 0.7, 14))

    const x = (i) => PAD_LEFT + slot * (i + 0.5)
    const yP = (p) => priceTop + ((pMax - p) / (pMax - pMin)) * priceH
    const yV = (v) => volBottom - (vMax ? (v / vMax) * VOL_H : 0)

    const priceTicks = Array.from({ length: 5 }, (_, i) => {
      const p = pMax - ((pMax - pMin) / 4) * i
      return { p, y: yP(p) }
    })
    const step = Math.max(1, Math.floor(n / 6))
    const timeTicks = []
    for (let i = n - 1; i >= 0; i -= step) timeTicks.push({ i, x: x(i), t: candles[i].t })

    return { n, chartW, priceTop, priceH, volTop, volBottom, pMin, pMax, slot, bodyW, x, yP, yV, priceTicks, timeTicks, hiIdx, loIdx, vMax }
  }, [width, candles])

  if (loading) return <div ref={ref} className={s.wrap}><div className={s.loading}>กำลังโหลดกราฟ…</div></div>
  if (!candles?.length) return <div ref={ref} className={s.wrap}><div className={s.loading}>ไม่มีข้อมูล</div></div>
  if (!geom) return <div ref={ref} className={s.wrap} />

  const last = candles[candles.length - 1]
  const active = (hover != null && candles[hover]) ? candles[hover] : last
  const up = active.c >= active.o
  const lastUp = last.c >= last.o

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * width
    let i = Math.round((mx - PAD_LEFT) / geom.slot - 0.5)
    i = Math.max(0, Math.min(geom.n - 1, i))
    setHover(i)
  }

  const hx = hover != null ? geom.x(hover) : null
  const hy = hover != null ? geom.yP(active.c) : null

  return (
    <div ref={ref} className={s.wrap} data-testid="candle-chart">
      {/* OHLC legend overlay */}
      <div className={s.legend}>
        <span className={s.legO}>O <b style={{ color: up ? UP : DOWN }}>{fmtNum(active.o)}</b></span>
        <span className={s.legO}>H <b style={{ color: up ? UP : DOWN }}>{fmtNum(active.h)}</b></span>
        <span className={s.legO}>L <b style={{ color: up ? UP : DOWN }}>{fmtNum(active.l)}</b></span>
        <span className={s.legO}>C <b style={{ color: up ? UP : DOWN }}>{fmtNum(active.c)}</b></span>
        <span className={s.legVol}>Vol {fmtVol(active.v)}</span>
        <span className={s.legDate}>{fmtDateFull(active.t, tf)}</span>
      </div>

      <svg
        className={s.svg}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="candlestick chart"
      >
        {/* horizontal grid + price axis */}
        {geom.priceTicks.map((tk, i) => (
          <g key={`p${i}`}>
            <line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={tk.y} y2={tk.y} stroke={GRID} />
            <text x={width - PAD_RIGHT + 6} y={tk.y + 3} fill={AXIS_TXT} className={s.axisTxt}>{fmtNum(tk.p)}</text>
          </g>
        ))}

        {/* time axis */}
        {geom.timeTicks.map((tk, i) => (
          <text key={`t${i}`} x={tk.x} y={HEIGHT - 8} fill={AXIS_TXT} className={s.axisTxtMid}>{fmtTime(tk.t, tf)}</text>
        ))}

        {/* volume bars */}
        {candles.map((c, i) => (
          <rect
            key={`v${i}`}
            x={geom.x(i) - geom.bodyW / 2}
            y={geom.yV(c.v)}
            width={geom.bodyW}
            height={Math.max(0, geom.volBottom - geom.yV(c.v))}
            fill={c.c >= c.o ? UP : DOWN}
            opacity={0.28}
          />
        ))}

        {/* candles */}
        {candles.map((c, i) => {
          const cx = geom.x(i)
          const col = c.c >= c.o ? UP : DOWN
          const yHigh = geom.yP(c.h)
          const yLow = geom.yP(c.l)
          const yOpen = geom.yP(c.o)
          const yClose = geom.yP(c.c)
          const top = Math.min(yOpen, yClose)
          const bh = Math.max(1, Math.abs(yClose - yOpen))
          return (
            <g key={`c${i}`}>
              <line x1={cx} x2={cx} y1={yHigh} y2={yLow} stroke={col} strokeWidth={1} />
              <rect x={cx - geom.bodyW / 2} y={top} width={geom.bodyW} height={bh} fill={col} />
            </g>
          )
        })}

        {/* last price line + tag */}
        <line
          x1={PAD_LEFT} x2={width - PAD_RIGHT}
          y1={geom.yP(last.c)} y2={geom.yP(last.c)}
          stroke={lastUp ? UP : DOWN} strokeWidth={1} strokeDasharray="4 3" opacity={0.7}
        />
        <g>
          <rect x={width - PAD_RIGHT} y={geom.yP(last.c) - 9} width={PAD_RIGHT} height={18} fill={lastUp ? UP : DOWN} rx={2} />
          <text x={width - PAD_RIGHT + 6} y={geom.yP(last.c) + 4} fill="#fff" className={s.tagTxt}>{fmtNum(last.c)}</text>
        </g>

        {/* high / low markers */}
        <text x={geom.x(geom.hiIdx)} y={geom.yP(candles[geom.hiIdx].h) - 6} fill={AXIS_TXT} className={s.hlTxt}>{fmtNum(candles[geom.hiIdx].h)}</text>
        <text x={geom.x(geom.loIdx)} y={geom.yP(candles[geom.loIdx].l) + 14} fill={AXIS_TXT} className={s.hlTxt}>{fmtNum(candles[geom.loIdx].l)}</text>

        {/* crosshair */}
        {hover != null && (
          <g>
            <line x1={hx} x2={hx} y1={PAD_TOP} y2={HEIGHT - AXIS_H} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
            <line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={hy} y2={hy} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
            <rect x={width - PAD_RIGHT} y={hy - 9} width={PAD_RIGHT} height={18} fill="#2a2f3e" rx={2} />
            <text x={width - PAD_RIGHT + 6} y={hy + 4} fill="#e8ecf4" className={s.tagTxt}>{fmtNum(active.c)}</text>
          </g>
        )}
      </svg>
    </div>
  )
}
