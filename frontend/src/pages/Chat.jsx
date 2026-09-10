import { useState, useRef, useEffect, useCallback } from 'react'
import { api }       from '../hooks/useApi'
import { useChart }  from '../context/ChartContext'
import styles        from './Chat.module.css'

/* ── Suggestions ──────────────────────────────── */
const SUGGESTIONS = [
  { icon: '🧭', text: 'ตลาดตอนนี้เป็น Bull หรือ Bear?' },
  { icon: '💼', text: 'จัดพอร์ตให้หน่อย Sharpe ดีที่สุด' },
  { icon: '💰', text: 'ดูราคาหุ้นล่าสุดทุกตัว' },
  { icon: '🔄', text: 'อัพเดทข้อมูลราคาล่าสุดให้หน่อย' },
  { icon: '📉', text: 'พอร์ต Volatility ต่ำที่สุดคืออะไร?' },
  { icon: '📊', text: 'สรุปพอร์ตปัจจุบันให้หน่อย' },
]

/* ── Markdown bold renderer ───────────────────── */
function RichText({ text }) {
  if (!text) return null
  return (
    <>
      {text.split('\n').map((line, i, arr) => {
        const parts = line.split(/\*\*(.*?)\*\*/g)
        return (
          <span key={i}>
            {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
            {i < arr.length - 1 && <br />}
          </span>
        )
      })}
    </>
  )
}

/* ── Tool result card ─────────────────────────── */
const TOOL_LABELS = {
  optimize_portfolio:     '💼 MPT Optimizer',
  classify_market_regime: '🧠 Market Regime',
  get_portfolio_summary:  '📋 Portfolio',
  get_regime_summary:     '🧭 Regime',
  get_latest_prices:      '💰 Prices',
  run_data_pipeline:      '🔄 Pipeline',
}

function ToolCard({ tool, result }) {
  const [open, setOpen] = useState(false)
  const ok = result?.status !== 'error'
  return (
    <div className={styles.toolCard}>
      <button className={styles.toolCardHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.toolLabel}>{TOOL_LABELS[tool] ?? `🔧 ${tool}`}</span>
        <span className={styles.toolStatus}>{ok ? '✅' : '❌'}</span>
        <span className={styles.toolChevron}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <pre className={styles.toolPre}>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  )
}

/* ── Bubble ───────────────────────────────────── */
function Bubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`${styles.bubbleWrap} ${isUser ? styles.userWrap : ''}`}>
      <div className={`${styles.bubble} ${isUser ? styles.user : styles.bot}`}>
        <div className={styles.avatar}>{isUser ? 'U' : 'AI'}</div>
        <div className={styles.content}>
          <div className={styles.roleRow}>
            <span className={styles.role}>{isUser ? 'You' : 'Quant AI'}</span>
            {msg.time && <span className={styles.time}>{msg.time}</span>}
          </div>
          <div className={styles.text}><RichText text={msg.content} /></div>
          {msg.toolResults?.length > 0 && (
            <div className={styles.toolCards}>
              {msg.toolResults.map((tr, i) => <ToolCard key={i} tool={tr.tool} result={tr.result} />)}
            </div>
          )}
          {msg.chartUpdated && (
            <div className={styles.chartPing}>กราฟถูกอัพเดทแล้ว</div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Typing ───────────────────────────────────── */
function Typing() {
  return (
    <div className={styles.bubbleWrap}>
      <div className={`${styles.bubble} ${styles.bot}`}>
        <div className={styles.avatar}>AI</div>
        <div className={styles.content}>
          <div className={styles.roleRow}><span className={styles.role}>Quant AI</span></div>
          <div className={styles.typing}><span /><span /><span /></div>
        </div>
      </div>
    </div>
  )
}

/* ── Main ─────────────────────────────────────── */
export default function Chat({ embedded = false }) {
  const { applyToolResults } = useChart()
  const now = () => new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

  const [messages, setMessages] = useState([{
    role: 'bot',
    content: 'สวัสดีครับ! ผมเป็น Quant AI Assistant 📊\n\nถามเรื่อง **พอร์ตการลงทุน**, **สภาวะตลาด** หรือ **ราคาหุ้น** ได้เลย — กราฟจะขยับอัตโนมัติ',
    time: now(),
  }])
  const [input, setInput] = useState('')
  const [busy,  setBusy]  = useState(false)

  const bottomRef   = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  // auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [input])

  const send = useCallback(async (text) => {
    const msg = text.trim()
    if (!msg || busy) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg, time: now() }])
    setBusy(true)
    try {
      const history = messages.slice(-10).map(m => ({
        role:    m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }))
      // API key อยู่ใน backend .env — ไม่ต้องส่งจาก frontend
      const data = await api.chat({ message: msg, history })
      const toolResults = data.tool_results ?? []
      let chartUpdated = false
      if (toolResults.length > 0) {
        applyToolResults(toolResults)
        chartUpdated = true
      }
      setMessages(prev => [...prev, {
        role: 'bot', content: data.reply || '(ไม่มีคำตอบ)',
        toolResults, chartUpdated, time: now(),
      }])
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'bot',
        content: `❌ เชื่อมต่อ API ไม่ได้: ${e.message}`,
        time: now(),
      }])
    }
    setBusy(false)
  }, [busy, messages, applyToolResults])

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  return (
    <div className={styles.page}>

      {/* header */}
      {embedded ? (
        <div className={styles.embeddedHeader}>
          <span className={styles.embeddedTitle}>
            <span className={styles.embeddedDot} />
            AI Chat
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>GPT-4o-mini</span>
        </div>
      ) : (
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.title}>AI Chat</h1>
            <p className={styles.sub}>กราฟขยับอัตโนมัติตามคำตอบ · powered by GPT-4o-mini</p>
          </div>
        </div>
      )}

      {/* suggestions */}
      {messages.length <= 1 && (
        <div className={styles.suggestions}>
          {SUGGESTIONS.map(({ icon, text }) => (
            <button key={text} className={styles.chip} onClick={() => send(text)}>
              <span className={styles.chipIcon}>{icon}</span>
              <span>{text}</span>
            </button>
          ))}
        </div>
      )}

      {/* messages */}
      <div className={styles.messages}>
        {messages.map((m, i) => <Bubble key={i} msg={m} />)}
        {busy && <Typing />}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className={`${styles.inputBar} ${busy ? styles.disabled : ''}`}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          rows={1}
          placeholder="ถามเกี่ยวกับพอร์ต, ตลาด, หรือราคาหุ้น…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={busy}
        />
        <button
          className={styles.sendBtn}
          onClick={() => send(input)}
          disabled={busy || !input.trim()}
          aria-label="ส่ง"
        >
          {busy ? <span className="spinner" /> : '➤'}
        </button>
      </div>

    </div>
  )
}
