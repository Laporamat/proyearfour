import { useState, useRef, useEffect, useCallback } from 'react'
import { api }      from '../hooks/useApi'
import { useChart } from '../context/ChartContext'
import s            from './Chat.module.css'

/* ── Suggestions ────────────────────────────── */
const SUGGESTIONS = [
  { icon: '💼', text: 'จัดพอร์ตให้หน่อย Sharpe ดีที่สุด' },
  { icon: '🧭', text: 'ตลาดตอนนี้ Bull หรือ Bear?' },
  { icon: '💰', text: 'ดูราคาหุ้นล่าสุดทุกตัว' },
  { icon: '🔄', text: 'อัพเดทข้อมูลราคาล่าสุด' },
  { icon: '📉', text: 'พอร์ต Volatility ต่ำที่สุดคืออะไร?' },
  { icon: '📋', text: 'สรุปพอร์ตปัจจุบันให้หน่อย' },
]

/* ── Tool labels ────────────────────────────── */
const TOOL_LABELS = {
  optimize_portfolio:     'MPT Optimizer',
  classify_market_regime: 'Market Regime',
  get_portfolio_summary:  'Portfolio Summary',
  get_regime_summary:     'Regime Summary',
  get_latest_prices:      'Latest Prices',
  run_data_pipeline:      'Data Pipeline',
}

/* ── Inline bold renderer ────────────────────── */
function RichText({ text }) {
  if (!text) return null
  return text.split('\n').map((line, i, arr) => {
    const parts = line.split(/\*\*(.*?)\*\*/g)
    return (
      <span key={i}>
        {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
        {i < arr.length - 1 && <br />}
      </span>
    )
  })
}

/* ── Tool result card ────────────────────────── */
function ToolCard({ tool, result }) {
  const [open, setOpen] = useState(false)
  const ok = result?.status !== 'error'
  return (
    <div className={s.toolCard}>
      <button className={s.toolHead} onClick={() => setOpen(o => !o)}>
        <span className={`${s.toolDot} ${ok ? s.toolOk : s.toolErr}`} />
        <span className={s.toolName}>{TOOL_LABELS[tool] ?? tool}</span>
        <span className={s.toolChev}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <pre className={s.toolPre}>{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  )
}

/* ── Message bubble ──────────────────────────── */
function Bubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`${s.bRow} ${isUser ? s.bRowUser : ''}`}>
      <div className={`${s.avatar} ${isUser ? s.avatarUser : s.avatarBot}`}>
        {isUser ? 'U' : 'AI'}
      </div>
      <div className={s.bContent}>
        <div className={s.bMeta}>
          <span className={s.bRole}>{isUser ? 'You' : 'Quant AI'}</span>
          {msg.time && <span className={s.bTime}>{msg.time}</span>}
        </div>
        <div className={`${s.bubble} ${isUser ? s.bUser : s.bBot}`}>
          <RichText text={msg.content} />
        </div>
        {msg.toolResults?.length > 0 && (
          <div className={s.tools}>
            {msg.toolResults.map((tr, i) => (
              <ToolCard key={i} tool={tr.tool} result={tr.result} />
            ))}
          </div>
        )}
        {msg.chartUpdated && (
          <div className={s.chartPing}>
            <span className={s.pingDot} />
            กราฟอัพเดทแล้ว
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Typing dots ─────────────────────────────── */
function Typing() {
  return (
    <div className={s.bRow}>
      <div className={`${s.avatar} ${s.avatarBot}`}>AI</div>
      <div className={s.bContent}>
        <div className={s.bMeta}><span className={s.bRole}>Quant AI</span></div>
        <div className={`${s.bubble} ${s.bBot} ${s.bTyping}`}>
          <span /><span /><span />
        </div>
      </div>
    </div>
  )
}

/* ── Main Chat ───────────────────────────────── */
export default function Chat({ embedded = false }) {
  const { applyToolResults } = useChart()
  const now = () =>
    new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

  const [messages, setMessages] = useState([{
    role: 'bot',
    content: 'สวัสดีครับ! ผมเป็น **Quant AI** 📊\nถามเรื่องพอร์ต, สภาวะตลาด หรือราคาหุ้นได้เลย\nกราฟจะขยับอัตโนมัติตามคำตอบ',
    time: now(),
  }])
  const [input, setInput] = useState('')
  const [busy,  setBusy]  = useState(false)

  const bottomRef   = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 130) + 'px'
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
      const data = await api.chat({ message: msg, history })
      const toolResults = data.tool_results ?? []
      let chartUpdated = false
      if (toolResults.length > 0) {
        applyToolResults(toolResults)
        chartUpdated = true
      }
      setMessages(prev => [...prev, {
        role: 'bot',
        content: data.reply || '(ไม่มีคำตอบ)',
        toolResults, chartUpdated,
        time: now(),
      }])
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'bot',
        content: `❌ ${e.message}`,
        time: now(),
      }])
    }
    setBusy(false)
  }, [busy, messages, applyToolResults])

  const onKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  const showSuggestions = messages.length <= 1 && !busy

  return (
    <div className={`${s.page} ${embedded ? s.embedded : ''}`}>

      {/* header */}
      <div className={s.header}>
        {embedded ? (
          <>
            <div className={s.headerLeft}>
              <span className={s.onlineDot} />
              <span className={s.title}>AI Chat</span>
            </div>
            <span className={s.model}>GPT-4o-mini</span>
          </>
        ) : (
          <div className={s.headerLeft}>
            <h1 className={s.title}>AI Chat</h1>
            <span className={s.sub}>กราฟขยับอัตโนมัติตามคำตอบ</span>
          </div>
        )}
      </div>

      {/* suggestions */}
      {showSuggestions && (
        <div className={s.suggestions}>
          {SUGGESTIONS.map(({ icon, text }) => (
            <button key={text} className={s.chip} onClick={() => send(text)}>
              <span className={s.chipIcon}>{icon}</span>
              <span>{text}</span>
            </button>
          ))}
        </div>
      )}

      {/* messages */}
      <div className={s.messages}>
        {messages.map((m, i) => <Bubble key={i} msg={m} />)}
        {busy && <Typing />}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className={`${s.inputBar} ${busy ? s.inputDisabled : ''}`}>
        <textarea
          ref={textareaRef}
          className={s.input}
          rows={1}
          placeholder="ถามเกี่ยวกับพอร์ต, ตลาด หรือราคาหุ้น…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          disabled={busy}
        />
        <button
          className={s.sendBtn}
          onClick={() => send(input)}
          disabled={busy || !input.trim()}
          aria-label="ส่ง"
        >
          {busy
            ? <span className="spinner" style={{ color: '#fff' }} />
            : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            )
          }
        </button>
      </div>
    </div>
  )
}
