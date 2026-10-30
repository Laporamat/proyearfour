import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  ScatterChart, Scatter, ZAxis, ReferenceLine,
} from 'recharts'
import { api } from '../hooks/useApi'
import s from './NewsEda.module.css'

const SENT = [
  { key: 'positive', label: 'บวก', color: 'var(--green)' },
  { key: 'neutral', label: 'กลาง', color: 'var(--text-muted)' },
  { key: 'negative', label: 'ลบ', color: 'var(--red)' },
]
const SENT_TH = { positive: 'บวก', neutral: 'กลาง', negative: 'ลบ' }
const tip = { contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } }
const axis = { tick: { fontSize: 11, fill: 'var(--text-muted)' }, stroke: 'var(--border)' }

function Kpi({ label, value, sub, testId }) {
  return (
    <div className={s.kpi} data-testid={testId}>
      <span className={s.kpiLabel}>{label}</span>
      <strong className={s.kpiValue}>{value}</strong>
      {sub && <span className={s.kpiSub}>{sub}</span>}
    </div>
  )
}

function SentimentBar({ sum }) {
  const total = sum.positive + sum.neutral + sum.negative || 1
  return (
    <div className={s.sentBar} data-testid="eda-sentiment-bar">
      {SENT.map(x => (
        <span key={x.key} style={{ width: `${(sum[x.key] / total) * 100}%`, background: x.color }} title={`${x.label} ${sum[x.key]}`} />
      ))}
    </div>
  )
}

function Card({ title, sub, children, testId, wide }) {
  return (
    <section className={`${s.card} ${wide ? s.wide : ''}`} data-testid={testId}>
      <header className={s.cardHead}>
        <h3>{title}</h3>
        {sub && <span>{sub}</span>}
      </header>
      {children}
    </section>
  )
}

function StackedSentiment({ data, x, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey={x} {...axis} interval={0} angle={data.length > 8 ? -35 : 0} textAnchor={data.length > 8 ? 'end' : 'middle'} height={data.length > 8 ? 50 : 24} />
        <YAxis {...axis} allowDecimals={false} />
        <Tooltip {...tip} cursor={{ fill: 'var(--accent-dim)' }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {SENT.map(k => <Bar key={k.key} dataKey={k.key} name={k.label} stackId="a" fill={k.color} />)}
      </BarChart>
    </ResponsiveContainer>
  )
}

function Publishers({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <XAxis type="number" {...axis} allowDecimals={false} />
        <YAxis type="category" dataKey="publisher" {...axis} width={120} />
        <Tooltip {...tip} cursor={{ fill: 'var(--accent-dim)' }} />
        <Bar dataKey="count" name="จำนวนข่าว" fill="var(--accent)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function SentimentVsPrice({ data }) {
  const pts = data.filter(r => r.count && r.change_1d != null)
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ScatterChart margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" />
        <XAxis type="number" dataKey="avg_sentiment" name="อารมณ์ข่าว" domain={[-1, 1]} {...axis} />
        <YAxis type="number" dataKey="change_1d" name="ราคา 1D %" unit="%" {...axis} />
        <ZAxis type="number" dataKey="count" range={[60, 400]} name="จำนวนข่าว" />
        <ReferenceLine x={0} stroke="var(--border-hi)" />
        <ReferenceLine y={0} stroke="var(--border-hi)" />
        <Tooltip {...tip} formatter={(v, n) => [v, n]} labelFormatter={() => ''}
          content={({ payload }) => payload?.[0] ? (
            <div className={s.tipBox}>
              <b>{payload[0].payload.ticker}</b>
              <span>อารมณ์ข่าว {payload[0].payload.avg_sentiment}</span>
              <span>ราคา 1D {payload[0].payload.change_1d}%</span>
              <span>{payload[0].payload.count} ข่าว</span>
            </div>
          ) : null} />
        <Scatter data={pts} fill="var(--accent)" fillOpacity={0.7} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

function WordCloud({ words }) {
  const max = words[0]?.count || 1
  return (
    <div className={s.words} data-testid="eda-top-words">
      {words.map(w => (
        <span key={w.word} className={s.word} style={{ fontSize: `${0.72 + (w.count / max) * 0.9}rem`, opacity: 0.55 + (w.count / max) * 0.45 }}>
          {w.word}<sup>{w.count}</sup>
        </span>
      ))}
    </div>
  )
}

function ArticleTable({ articles, tickers }) {
  const [tk, setTk] = useState('all')
  const [sent, setSent] = useState('all')
  const rows = articles.filter(a => (tk === 'all' || a.ticker === tk) && (sent === 'all' || a.label === sent))
  return (
    <>
      <div className={s.filters}>
        <select value={tk} onChange={e => setTk(e.target.value)} data-testid="eda-filter-ticker">
          <option value="all">ทุกหุ้น</option>
          {tickers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={sent} onChange={e => setSent(e.target.value)} data-testid="eda-filter-sentiment">
          <option value="all">ทุกอารมณ์</option>
          {SENT.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
        </select>
        <span className={s.count} data-testid="eda-article-count">{rows.length} ข่าว</span>
      </div>
      <div className={s.tableWrap}>
        <table className={s.table} data-testid="eda-articles-table">
          <thead><tr><th>วันที่</th><th>หุ้น</th><th>หัวข้อข่าว</th><th>สำนักข่าว</th><th>อารมณ์</th></tr></thead>
          <tbody>
            {rows.map((a, i) => (
              <tr key={`${a.ticker}-${a.id}`} data-testid={`eda-article-row-${i}`}>
                <td className={s.mono}>{a.published?.slice(0, 10) || '—'}</td>
                <td><span className={s.tk}>{a.ticker}</span></td>
                <td><a href={a.url} target="_blank" rel="noreferrer">{a.title}</a></td>
                <td className={s.muted}>{a.publisher}</td>
                <td><span className={`${s.pill} ${s[a.label]}`}>{SENT_TH[a.label]} {a.sentiment > 0 ? '+' : ''}{a.sentiment}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function NewsEda() {
  const [scope, setScope] = useState('all')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await api.newsEda(scope)) } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [scope])
  useEffect(() => { load() }, [load])

  const withNews = useMemo(() => data?.by_ticker.filter(r => r.count) || [], [data])
  const sum = data?.summary

  return (
    <div className={s.page} data-testid="news-eda-page">
      <div className={s.header}>
        <div>
          <h1>News EDA</h1>
          <p className={s.sub}>วิเคราะห์ข่าวล่าสุดของหุ้นจาก Yahoo Finance · อารมณ์ข่าววัดจากคำบวก/ลบในหัวข้อข่าว</p>
        </div>
        <div className={s.actions}>
          <div className={s.toggle}>
            {[['all', 'หุ้นทั้งหมด'], ['mine', 'หุ้นในพอร์ตของฉัน']].map(([v, l]) => (
              <button key={v} className={scope === v ? s.on : ''} onClick={() => setScope(v)} data-testid={`eda-scope-${v}`}>{l}</button>
            ))}
          </div>
          <button className={s.refresh} onClick={load} disabled={loading} data-testid="eda-refresh-btn">{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</button>
        </div>
      </div>

      {error && <div className={s.state} data-testid="eda-error">โหลดข้อมูลไม่สำเร็จ: {error}</div>}
      {loading && !data && <div className={s.state} data-testid="eda-loading">กำลังดึงและวิเคราะห์ข่าว…</div>}
      {data && sum.tickers_total === 0 && (
        <div className={s.state} data-testid="eda-empty-portfolio">ยังไม่มีหุ้นในพอร์ต — <Link to="/portfolio">เพิ่มหุ้นใน My Portfolio</Link></div>
      )}
      {data && sum.tickers_total > 0 && sum.articles === 0 && <div className={s.state} data-testid="eda-no-news">ไม่พบข่าวล่าสุดของหุ้นเหล่านี้</div>}

      {data && sum.articles > 0 && ( 
        <>
          <div className={s.kpis}>
            <Kpi testId="eda-kpi-articles" label="ข่าวทั้งหมด" value={sum.articles} sub={`${sum.date_from} → ${sum.date_to}`} />
            <Kpi testId="eda-kpi-coverage" label="หุ้นที่มีข่าว" value={`${sum.tickers_with_news}/${sum.tickers_total}`} sub="หุ้นไทย (.BK) มักไม่มีข่าวใน Yahoo" />

            
            <Kpi testId="eda-kpi-publishers" label="สำนักข่าว" value={sum.publishers} sub={data.publishers[0] && `มากสุด: ${data.publishers[0].publisher}`} />
            <div className={s.kpi} data-testid="eda-kpi-sentiment">
              <span className={s.kpiLabel}>อารมณ์ข่าวเฉลี่ย</span>
              <strong className={`${s.kpiValue} ${sum.avg_sentiment > 0 ? s.up : sum.avg_sentiment < 0 ? s.down : ''}`}>{sum.avg_sentiment > 0 ? '+' : ''}{sum.avg_sentiment}</strong>
              <SentimentBar sum={sum} />
              <span className={s.kpiSub}>บวก {sum.positive} · กลาง {sum.neutral} · ลบ {sum.negative}</span>
            </div>
          </div>

          <div className={s.grid}>
            <Card wide testId="eda-chart-by-ticker" title="จำนวนข่าวต่อหุ้น" sub="แยกตามอารมณ์ข่าว"><StackedSentiment data={withNews} x="ticker" /></Card>
            <Card testId="eda-chart-by-day" title="จำนวนข่าวต่อวัน" sub="14 วันล่าสุดที่มีข่าว"><StackedSentiment data={data.by_day} x="date" /></Card>
            <Card testId="eda-chart-publishers" title="สำนักข่าวยอดนิยม" sub="Top 10 · นับข่าวไม่ซ้ำ"><Publishers data={data.publishers} /></Card>
            <Card testId="eda-chart-sentiment-price" title="อารมณ์ข่าว vs ราคา 1 วัน" sub="ขนาดจุด = จำนวนข่าว"><SentimentVsPrice data={data.by_ticker} /></Card>
            <Card testId="eda-card-words" title="คำที่พบบ่อยในหัวข้อข่าว" sub="Top 30"><WordCloud words={data.top_words} /></Card>
            <Card wide testId="eda-card-articles" title="รายการข่าว"><ArticleTable articles={data.articles} tickers={withNews.map(r => r.ticker)} /></Card>
          </div>
        </>
      )}
    </div>
  )
}
