import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, BarChart, Bar, Cell, Legend,
} from 'recharts'
import { api } from '../hooks/useApi'
import s from './MetricAnalysis.module.css'

const META = {
  sharpe: {
    title: 'Sharpe Ratio', kind: 'mpt', color: 'var(--accent)', valueKey: 'sharpe', suffix: '',
    blurb: 'Sharpe Ratio = (ผลตอบแทน − risk-free) ÷ ความผันผวน คำนวณจากผลตอบแทนรายวันจริง 25 สินทรัพย์ ' +
           'จุดสีบนกราฟคือพอร์ตสุ่ม 10,000 ชุด (Monte Carlo) พอร์ตที่เลือกอยู่บนขอบ Efficient Frontier ที่ Sharpe สูงสุด',
  },
  return: {
    title: 'Annual Return', kind: 'mpt', color: 'var(--green)', valueKey: 'ret', suffix: '%',
    blurb: 'ผลตอบแทนต่อปี (annualized) มาจากการทบต้นผลตอบแทนรายวันจริงของพอร์ต Max-Sharpe ' +
           'เส้นด้านล่างเทียบการเติบโตสะสมของพอร์ตกับดัชนีถ่วงน้ำหนักเท่ากัน (equal-weight)',
  },
  volatility: {
    title: 'Volatility', kind: 'mpt', color: 'var(--yellow)', valueKey: 'vol', suffix: '%',
    blurb: 'ความผันผวนต่อปี = ส่วนเบี่ยงเบนมาตรฐานของผลตอบแทนรายวัน × √252 ' +
           'ยิ่งพอร์ตอยู่ซ้าย (vol ต่ำ) และสูง (return สูง) ยิ่งดี พอร์ตที่เลือกอยู่มุมซ้ายบนของกลุ่มจุด',
  },
  regime: {
    title: 'Market Regime', kind: 'regime', color: 'var(--yellow)',
    blurb: 'จำแนกสภาวะตลาด (Bull / Neutral / Bear) ด้วย Random Forest จาก 11 ฟีเจอร์จริง ' +
           '(โมเมนตัม, ความผันผวน, breadth ฯลฯ) กราฟด้านล่างคือความน่าจะเป็นของแต่ละสภาวะตลอดช่วงเวลา',
  },
}

const REGIME_COLORS = { bull: 'var(--green)', neutral: 'var(--yellow)', bear: 'var(--red)' }

function MptTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className={s.tt}>
      <div>Return <strong>{d.ret}%</strong></div>
      <div>Volatility <strong>{d.vol}%</strong></div>
      <div>Sharpe <strong>{d.sharpe}</strong></div>
    </div>
  )
}

function GenericTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className={s.tt}>
      {label != null && <div className={s.ttLabel}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || p.fill }}>
          {p.name} <strong>{p.value}{suffix}</strong>
        </div>
      ))}
    </div>
  )
}

export default function MetricAnalysis() {
  const { metric } = useParams()
  const navigate = useNavigate()
  const meta = META[metric] ?? META.sharpe

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true); setError(false); setData(null)
    const fetcher = meta.kind === 'regime' ? api.analysisRegime : api.analysisMpt
    fetcher()
      .then((res) => { if (alive) setData(res) })
      .catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [metric, meta.kind])

  return (
    <div className={s.page} data-testid="metric-analysis">
      <button className={s.back} onClick={() => navigate('/dashboard')} data-testid="analysis-back-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
        </svg>
        กลับ Dashboard
      </button>

      <header className={s.header}>
        <div>
          <p className={s.eyebrow}>การวิเคราะห์ข้อมูลจริง</p>
          <h1 style={{ color: meta.color }}>{meta.title}</h1>
        </div>
        {!loading && !error && meta.kind === 'mpt' && data?.optimal && (
          <div className={s.bigVal} style={{ color: meta.color }} data-testid="analysis-hero-value">
            {data.optimal[meta.valueKey]}{meta.suffix}
          </div>
        )}
        {!loading && !error && meta.kind === 'regime' && data?.current && (
          <div className={s.bigVal} style={{ color: meta.color }} data-testid="analysis-hero-value">
            {data.current.regime}
          </div>
        )}
      </header>

      <p className={s.blurb}>{meta.blurb}</p>

      {loading ? (
        <div className={s.loading} data-testid="analysis-loading">
          <div className={`skeleton ${s.skelChart}`} />
          <div className={`skeleton ${s.skelChart}`} />
        </div>
      ) : error ? (
        <div className={s.errorBox} data-testid="analysis-error">
          <p>โหลดข้อมูลไม่สำเร็จ — ข้อมูลอาจกำลังประมวลผล ลองรีเฟรชอีกครั้ง</p>
        </div>
      ) : meta.kind === 'mpt' ? (
        <MptView data={data} meta={meta} />
      ) : (
        <RegimeView data={data} />
      )}
    </div>
  )
}

/* ── MPT (sharpe / return / volatility) ─────────────────── */
function MptView({ data, meta }) {
  const optimal = data?.optimal
  const optimalPoint = optimal ? [{ vol: optimal.vol, ret: optimal.ret, sharpe: optimal.sharpe }] : []
  return (
    <div className={s.grid}>
      <section className={`card ${s.chartCard} ${s.wide}`} data-testid="mpt-frontier-chart">
        <div className={s.cardHead}>
          <h3>Efficient Frontier + Monte Carlo (10,000 พอร์ตสุ่มจริง)</h3>
          <span className={s.legendDots}>
            <span><i style={{ background: 'var(--text-muted)' }} />พอร์ตสุ่ม</span>
            <span><i style={{ background: 'var(--accent)' }} />Efficient Frontier</span>
            <span><i style={{ background: meta.color }} />พอร์ตที่เลือก ★</span>
          </span>
        </div>
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ top: 12, right: 18, bottom: 40, left: 6 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" dataKey="vol" name="Volatility" unit="%"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false} domain={['dataMin - 1', 'dataMax + 1']}
              label={{ value: 'Volatility (%)', position: 'insideBottom', offset: -18, fontSize: 12, fill: 'var(--text-muted)' }} />
            <YAxis type="number" dataKey="ret" name="Return" unit="%"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false} domain={['auto', 'auto']}
              label={{ value: 'Return (%)', angle: -90, position: 'insideLeft', fontSize: 12, fill: 'var(--text-muted)' }} />
            <ZAxis range={[24, 24]} />
            <Tooltip content={<MptTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name="Monte Carlo" data={data.monte_carlo} fill="var(--text-muted)"
              fillOpacity={0.28} isAnimationActive={false} />
            <Scatter name="Frontier" data={data.frontier} fill="var(--accent)"
              line={{ stroke: 'var(--accent)', strokeWidth: 2 }} lineJointType="monotoneX"
              shape="circle" legendType="none" isAnimationActive={false} />
            <Scatter name="Optimal" data={optimalPoint} fill={meta.color}
              shape="star" isAnimationActive>
              {optimalPoint.map((_, i) => <Cell key={i} fill={meta.color} />)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </section>

      {data.performance?.length > 0 && (
        <section className={`card ${s.chartCard} ${s.wide}`} data-testid="mpt-performance-chart">
          <div className={s.cardHead}>
            <h3>การเติบโตสะสมของพอร์ต (ข้อมูลจริงรายเดือน)</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.performance} margin={{ top: 10, right: 16, bottom: 4, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickLine={false} interval="preserveStartEnd" minTickGap={40} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v) => `${v}%`}
                tickLine={false} axisLine={false} width={48} />
              <Tooltip content={<GenericTooltip suffix="%" />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="portfolio" name="Max-Sharpe Portfolio"
                stroke={meta.color} strokeWidth={2.4} dot={false} />
              <Line type="monotone" dataKey="benchmark" name="Equal-Weight Benchmark"
                stroke="var(--text-muted)" strokeWidth={1.6} strokeDasharray="5 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {data.weights?.length > 0 && (
        <section className={`card ${s.chartCard} ${s.wide}`} data-testid="mpt-weights-chart">
          <div className={s.cardHead}><h3>น้ำหนักสินทรัพย์ในพอร์ต (%)</h3></div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.weights} margin={{ top: 8, right: 12, bottom: 40, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'Geist Mono, monospace' }}
                interval={0} angle={-40} textAnchor="end" height={56} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v) => `${v}%`}
                tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<GenericTooltip suffix="%" />} cursor={{ fill: 'var(--surface2)' }} />
              <Bar dataKey="weight" name="น้ำหนัก" fill={meta.color} radius={[5, 5, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}
    </div>
  )
}

/* ── Regime ─────────────────────────────────────────────── */
function RegimeView({ data }) {
  const c = data?.current
  return (
    <div className={s.grid}>
      {c && (
        <section className={`card ${s.chartCard}`} data-testid="regime-current">
          <div className={s.cardHead}><h3>สภาวะตลาดล่าสุด · {c.date}</h3></div>
          <div className={s.regimeProbs}>
            {[
              { k: 'bull', label: 'Bull 🐂', v: c.bull },
              { k: 'neutral', label: 'Neutral ⟷', v: c.neutral },
              { k: 'bear', label: 'Bear 🐻', v: c.bear },
            ].map(({ k, label, v }) => (
              <div key={k} className={s.probRow}>
                <span className={s.probLbl}>{label}</span>
                <div className={s.probTrack}>
                  <div className={s.probFill} style={{ width: `${v}%`, background: REGIME_COLORS[k] }} />
                </div>
                <span className={s.probVal} style={{ color: REGIME_COLORS[k] }}>{v}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.distribution?.length > 0 && (
        <section className={`card ${s.chartCard}`} data-testid="regime-distribution">
          <div className={s.cardHead}><h3>จำนวนวันในแต่ละสภาวะ (รวม {data.total_days} วัน)</h3></div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.distribution} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} width={40} />
              <Tooltip content={<GenericTooltip suffix=" วัน" />} cursor={{ fill: 'var(--surface2)' }} />
              <Bar dataKey="days" name="จำนวนวัน" radius={[5, 5, 0, 0]} maxBarSize={70}>
                {data.distribution.map((d) => (
                  <Cell key={d.name} fill={REGIME_COLORS[d.name.toLowerCase()]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {data.timeline?.length > 0 && (
        <section className={`card ${s.chartCard} ${s.wide}`} data-testid="regime-timeline">
          <div className={s.cardHead}><h3>ความน่าจะเป็นสภาวะตลาดตามเวลา (%)</h3></div>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={data.timeline} margin={{ top: 10, right: 16, bottom: 4, left: -8 }} stackOffset="expand">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickLine={false} interval="preserveStartEnd" minTickGap={40} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v) => `${Math.round(v * 100)}%`}
                tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<GenericTooltip suffix="%" />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="bull" name="Bull" stackId="1"
                stroke="var(--green)" fill="var(--green)" fillOpacity={0.75} />
              <Area type="monotone" dataKey="neutral" name="Neutral" stackId="1"
                stroke="var(--yellow)" fill="var(--yellow)" fillOpacity={0.7} />
              <Area type="monotone" dataKey="bear" name="Bear" stackId="1"
                stroke="var(--red)" fill="var(--red)" fillOpacity={0.7} />
            </AreaChart>
          </ResponsiveContainer>
        </section>
      )}

      {data.importance?.length > 0 && (
        <section className={`card ${s.chartCard} ${s.wide}`} data-testid="regime-importance">
          <div className={s.cardHead}><h3>Feature Importance — Random Forest (ปัจจัยที่โมเดลใช้จริง)</h3></div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.importance} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="feature" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'Geist Mono, monospace' }}
                tickLine={false} axisLine={false} width={92} />
              <Tooltip content={<GenericTooltip suffix="%" />} cursor={{ fill: 'var(--surface2)' }} />
              <Bar dataKey="importance" name="ความสำคัญ" fill="var(--accent)" radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}
    </div>
  )
}
