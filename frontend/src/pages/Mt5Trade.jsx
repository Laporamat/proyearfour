import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../hooks/useApi'
import s from './Mt5Trade.module.css'

// ── The 25 Quantix Project Assets ─────────────────────────────────────────────
const QUANTIX_25_ASSETS = [
  // 🇺🇸 US Stocks (10)
  { symbol: 'AAPL',  name: 'Apple Inc.',                category: 'US Stocks',   currency: 'USD', base_price: 228.40 },
  { symbol: 'MSFT',  name: 'Microsoft Corp.',           category: 'US Stocks',   currency: 'USD', base_price: 420.10 },
  { symbol: 'GOOGL', name: 'Alphabet Inc. (Google)',    category: 'US Stocks',   currency: 'USD', base_price: 178.50 },
  { symbol: 'AMZN',  name: 'Amazon.com Inc.',           category: 'US Stocks',   currency: 'USD', base_price: 204.30 },
  { symbol: 'NVDA',  name: 'NVIDIA Corp.',              category: 'US Stocks',   currency: 'USD', base_price: 142.50 },
  { symbol: 'TSLA',  name: 'Tesla Inc.',                category: 'US Stocks',   currency: 'USD', base_price: 345.00 },
  { symbol: 'META',  name: 'Meta Platforms (Facebook)', category: 'US Stocks',   currency: 'USD', base_price: 580.20 },
  { symbol: 'JNJ',   name: 'Johnson & Johnson',         category: 'US Stocks',   currency: 'USD', base_price: 156.80 },
  { symbol: 'V',     name: 'Visa Inc.',                 category: 'US Stocks',   currency: 'USD', base_price: 295.40 },
  { symbol: 'JPM',   name: 'JPMorgan Chase & Co.',      category: 'US Stocks',   currency: 'USD', base_price: 245.60 },

  // 🇹🇭 Thai Stocks (10)
  { symbol: 'PTT',   name: 'PTT PCL',                   category: 'Thai Stocks', currency: 'THB', base_price: 31.50 },
  { symbol: 'AOT',   name: 'Airports of Thailand',      category: 'Thai Stocks', currency: 'THB', base_price: 60.25 },
  { symbol: 'CPALL', name: 'CP ALL PCL',                category: 'Thai Stocks', currency: 'THB', base_price: 64.50 },
  { symbol: 'BDMS',  name: 'Bangkok Dusit Med',         category: 'Thai Stocks', currency: 'THB', base_price: 28.00 },
  { symbol: 'DELTA', name: 'Delta Electronics (Thai)',  category: 'Thai Stocks', currency: 'THB', base_price: 155.00 },
  { symbol: 'GULF',  name: 'Gulf Energy Development',   category: 'Thai Stocks', currency: 'THB', base_price: 63.25 },
  { symbol: 'ADVANC',name: 'Advanced Info Service',     category: 'Thai Stocks', currency: 'THB', base_price: 285.00 },
  { symbol: 'SCB',   name: 'SCB X PCL',                 category: 'Thai Stocks', currency: 'THB', base_price: 112.50 },
  { symbol: 'KBANK', name: 'Kasikornbank PCL',          category: 'Thai Stocks', currency: 'THB', base_price: 152.00 },
  { symbol: 'PTTEP', name: 'PTT Exploration & Prod',    category: 'Thai Stocks', currency: 'THB', base_price: 132.50 },

  // 🛡️ Safe Assets & Bonds (5)
  { symbol: 'GLD',   name: 'SPDR Gold Shares / Gold',   category: 'Bonds & Gold', currency: 'USD', base_price: 248.50 },
  { symbol: 'TLT',   name: '20+ Year Treasury Bond ETF',category: 'Bonds & Gold', currency: 'USD', base_price: 92.40 },
  { symbol: 'IEF',   name: '7-10 Year Treasury Bond ETF',category: 'Bonds & Gold', currency: 'USD', base_price: 94.80 },
  { symbol: 'SHY',   name: '1-3 Year Treasury Bond ETF',category: 'Bonds & Gold', currency: 'USD', base_price: 81.70 },
  { symbol: 'BIL',   name: 'SPDR 1-3 Month T-Bill ETF', category: 'Bonds & Gold', currency: 'USD', base_price: 91.80 },
]

export default function Mt5Trade() {
  // Navigation Tabs: 'terminal' | 'signals' | 'bot' | 'api_keys'
  const [activeTab, setActiveTab] = useState('terminal')
  const [selectedCategory, setSelectedCategory] = useState('ALL')

  // MT5 State
  const [status, setStatus] = useState({ available: false, connected: false, mode: 'disconnected' })
  const [account, setAccount] = useState(null)
  const [positions, setPositions] = useState([])
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Connection form state
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [loginInput, setLoginInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [serverInput, setServerInput] = useState('MetaQuotes-Demo')

  // Order pad state (default symbol: AAPL from the 25 assets)
  const [symbol, setSymbol] = useState('AAPL')
  const [volume, setVolume] = useState('0.02')
  const [sl, setSl] = useState('')
  const [tp, setTp] = useState('')
  const [autoSlTp, setAutoSlTp] = useState(true)
  const [tick, setTick] = useState({ bid: 228.40, ask: 228.50, spread: 0.10 })

  // ML Day Trade Signals
  const [mlData, setMlData] = useState(null)
  const [signalsLoading, setSignalsLoading] = useState(false)

  // Auto-Trade Bot State
  const [botState, setBotState] = useState(null)
  const [botLoading, setBotLoading] = useState(false)

  // API Keys State
  const [apiKeys, setApiKeys] = useState([])
  const [newKeyName, setNewKeyName] = useState('Quantix 25-Assets Bot')
  const [createdKey, setCreatedKey] = useState(null)
  const [codeSnippets, setCodeSnippets] = useState(null)
  const [snippetLang, setSnippetLang] = useState('python')
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  const pollTimer = useRef(null)
  const tickTimer = useRef(null)

  // Find active asset info
  const activeAsset = QUANTIX_25_ASSETS.find(a => a.symbol === symbol) || QUANTIX_25_ASSETS[0]
  const curSymbol = activeAsset.currency === 'THB' ? '฿' : '$'

  // ── 1. Fetch MT5 Status & Account ──
  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.mt5Status()
      setStatus(res)
      if (res.account && Object.keys(res.account).length > 0) {
        setAccount(res.account)
      } else {
        setAccount(null)
      }
    } catch (e) {
      console.warn('MT5 status fetch failed:', e.message)
    }
  }, [])

  // ── 2. Fetch Open Positions ──
  const fetchPositions = useCallback(async () => {
    if (!status.connected) return
    try {
      const res = await api.mt5Positions()
      setPositions(res.positions || [])
    } catch (e) {
      console.warn('MT5 positions fetch error:', e.message)
    }
  }, [status.connected])

  // ── 3. Fetch Tick Price ──
  const fetchTick = useCallback(async () => {
    if (!status.connected || !symbol) return
    try {
      const t = await api.mt5Tick(symbol)
      if (t && t.bid) setTick(t)
    } catch {
      // ignore tick jitter errors
    }
  }, [status.connected, symbol])

  // ── 4. Fetch ML Day Trade Signals ──
  const fetchSignals = useCallback(async () => {
    setSignalsLoading(true)
    try {
      const res = await api.daytradeSignals()
      setMlData(res)
    } catch (e) {
      console.warn('ML Signals fetch error:', e.message)
    } finally {
      setSignalsLoading(false)
    }
  }, [])

  // ── 5. Fetch Bot Status ──
  const fetchBot = useCallback(async () => {
    try {
      const res = await api.getBotStatus()
      if (res && res.bot) setBotState(res.bot)
    } catch (e) {
      console.warn('Bot status fetch error:', e.message)
    }
  }, [])

  // ── 6. Fetch API Keys ──
  const fetchApiKeys = useCallback(async () => {
    try {
      const res = await api.listApiKeys()
      setApiKeys(res.api_keys || [])
    } catch (e) {
      console.warn('API keys fetch error:', e.message)
    }
  }, [])

  // ── 7. Fetch Code Snippets ──
  const fetchSnippets = useCallback(async (activeKey = '') => {
    try {
      const res = await api.getCodeSnippets(activeKey || 'YOUR_QUANTIX_API_KEY')
      setCodeSnippets(res)
    } catch (e) {
      console.warn('Code snippets fetch error:', e.message)
    }
  }, [])

  // Initial Load
  useEffect(() => {
    fetchStatus()
    fetchSignals()
    fetchBot()
    fetchApiKeys()
    fetchSnippets()
  }, [fetchStatus, fetchSignals, fetchBot, fetchApiKeys, fetchSnippets])

  // Real-time Polling Loop
  useEffect(() => {
    if (status.connected) {
      fetchPositions()
      fetchTick()
      pollTimer.current = setInterval(() => {
        fetchPositions()
        fetchStatus()
        fetchBot()
      }, 3000)
      tickTimer.current = setInterval(fetchTick, 2000)
    }
    return () => {
      clearInterval(pollTimer.current)
      clearInterval(tickTimer.current)
    }
  }, [status.connected, fetchPositions, fetchStatus, fetchTick, fetchBot])

  // Auto-fill SL/TP based on active symbol ML setup if enabled
  const activeSignal = mlData?.signals?.find(s => s.symbol === symbol)
  useEffect(() => {
    if (autoSlTp && activeSignal) {
      if (activeSignal.suggested_sl) setSl(String(activeSignal.suggested_sl))
      if (activeSignal.suggested_tp) setTp(String(activeSignal.suggested_tp))
    }
  }, [symbol, autoSlTp, activeSignal])

  // ── Connect MT5 (Native or Paper Trading) ──
  const handleConnect = async (e, forceSimulation = false) => {
    e?.preventDefault()
    setActionLoading(true)
    setError('')
    setMessage('')
    try {
      const body = {
        server: serverInput || 'MetaQuotes-Demo',
        force_simulation: forceSimulation,
      }
      if (loginInput) body.login = parseInt(loginInput, 10)
      if (passwordInput) body.password = passwordInput

      const res = await api.mt5Connect(body)
      setShowConnectModal(false)
      if (res.mode === 'simulation') {
        setMessage('เชื่อมต่อโหมดจำลองพอร์ต Paper Trading ($10,000) สำเร็จ!')
      } else {
        setMessage(`เชื่อมต่อบัญชี MT5 #${res.account?.login || ''} สำเร็จ!`)
      }
      await fetchStatus()
    } catch (err) {
      setError(err.message || 'เชื่อมต่อ MT5 ไม่สำเร็จ กรุณาตรวจสอบโปรแกรม MetaTrader 5')
    } finally {
      setActionLoading(false)
    }
  }

  // ── Disconnect MT5 ──
  const handleDisconnect = async () => {
    setActionLoading(true)
    try {
      await api.mt5Disconnect()
      setStatus({ available: true, connected: false, mode: 'disconnected' })
      setAccount(null)
      setPositions([])
      setMessage('ตัดการเชื่อมต่อ MT5 เรียบร้อยแล้ว')
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // ── Send Day Trade Order (Buy / Sell) ──
  const handleOrder = async (action) => {
    setActionLoading(true)
    setError('')
    setMessage('')
    try {
      const vol = parseFloat(volume)
      if (isNaN(vol) || vol <= 0) throw new Error('กรุณาระบุจำนวน Lot ให้ถูกต้อง')

      const body = {
        symbol: symbol.trim().toUpperCase(),
        action,
        volume: vol,
        sl: sl ? parseFloat(sl) : 0,
        tp: tp ? parseFloat(tp) : 0,
        comment: `Quantix DayTrade (${actionSignalText(activeSignal)})`,
      }

      const res = await api.mt5Order(body)
      setMessage(`ส่งคำสั่ง ${action} ${symbol} สำเร็จ! Ticket #${res.order || res.deal} @ ${curSymbol}${res.price}`)
      fetchPositions()
      fetchStatus()
    } catch (err) {
      setError(err.message || 'ส่งคำสั่งไม่สำเร็จ')
    } finally {
      setActionLoading(false)
    }
  }

  // ── Close Single Position ──
  const handleClose = async (ticket) => {
    setActionLoading(true)
    try {
      await api.mt5Close(ticket)
      setMessage(`ปิดออเดอร์ Ticket #${ticket} สำเร็จ`)
      fetchPositions()
      fetchStatus()
    } catch (err) {
      setError(err.message || 'ปิดออเดอร์ไม่สำเร็จ')
    } finally {
      setActionLoading(false)
    }
  }

  // ── Emergency Close All Positions ──
  const handleCloseAll = async () => {
    if (!window.confirm('⚠️ ยืนยันการปิดทุกออเดอร์ที่เปิดอยู่ทั้งหมดทันที (Panic Close)?')) return
    setActionLoading(true)
    try {
      const res = await api.mt5CloseAll()
      setMessage(`ปิดออเดอร์ทั้งหมดสำเร็จ (${res.total_closed} รายการ)`)
      fetchPositions()
      fetchStatus()
    } catch (err) {
      setError(err.message || 'ปิดออเดอร์ทั้งหมดไม่สำเร็จ')
    } finally {
      setActionLoading(false)
    }
  }

  // ── Toggle Auto-Trade Bot ──
  const handleToggleBot = async () => {
    if (!botState) return
    setBotLoading(true)
    try {
      const res = await api.updateBotConfig({
        enabled: !botState.enabled,
        min_confidence: botState.min_confidence,
        default_lot: botState.default_lot,
        max_positions: botState.max_positions,
        symbols: botState.symbols,
        auto_sl_tp: botState.auto_sl_tp,
      })
      setBotState(res.bot)
      setMessage(res.bot.enabled ? 'บอท Quantix ML เริ่มทำงานอัตโนมัติบน MT5' : 'หยุดการทำงานบอทเรียบร้อยแล้ว')
    } catch (err) {
      setError(err.message)
    } finally {
      setBotLoading(false)
    }
  }

  // ── Update Bot Parameters ──
  const handleUpdateBotParam = async (key, val) => {
    if (!botState) return
    const updated = { ...botState, [key]: val }
    setBotState(updated)
    try {
      await api.updateBotConfig(updated)
    } catch (err) {
      console.warn('Bot config update failed:', err)
    }
  }

  // ── Generate New API Key ──
  const handleCreateApiKey = async (e) => {
    e.preventDefault()
    if (!newKeyName.trim()) return
    setActionLoading(true)
    try {
      const res = await api.createApiKey({ name: newKeyName.trim(), permissions: ['signals:read', 'trades:write'] })
      setCreatedKey(res)
      setNewKeyName('')
      fetchApiKeys()
      fetchSnippets(res.api_key)
      setMessage('สร้าง API Key สำเร็จ! โปรดคัดลอกคีย์เพื่อนำไปใส่ในบอท MT5')
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // ── Revoke API Key ──
  const handleRevokeApiKey = async (keyId) => {
    if (!window.confirm('คุณต้องการเพิกถอน (Revoke) API Key นี้ใช่หรือไม่? บอทที่ใช้คีย์นี้จะหยุดทำงานทันที')) return
    try {
      await api.revokeApiKey(keyId)
      fetchApiKeys()
      setMessage('เพิกถอน API Key เรียบร้อยแล้ว')
    } catch (err) {
      setError(err.message)
    }
  }

  // Copy helper
  const handleCopyText = (txt, isKey = true) => {
    navigator.clipboard.writeText(txt)
    if (isKey) {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    } else {
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  // Helper text for signals
  const actionSignalText = (sig) => sig ? `${sig.action} (${sig.confidence}%)` : 'ML Scanning...'

  // Filtered 25 assets
  const filteredAssets = selectedCategory === 'ALL'
    ? QUANTIX_25_ASSETS
    : QUANTIX_25_ASSETS.filter(a => a.category === selectedCategory)

  return (
    <div className={s.page}>
      {/* ── Top Bar / Quant Telemetry Header ── */}
      <div className={s.header}>
        <div className={s.titleArea}>
          <div className={s.badgeRow}>
            <span className={s.livePulse} />
            <span className={s.terminalTag}>QUANT TERMINAL</span>
            <span className={s.regimeBadge}>
              REGIME: {mlData?.regime?.state?.toUpperCase() || 'BULL'} {mlData?.regime?.confidence ? `(${mlData.regime.confidence}%)` : ''}
            </span>
            {botState?.enabled && (
              <span className={s.botActivePill}>
                BOT ACTIVE ({botState.min_confidence}%+)
              </span>
            )}
          </div>
          <h1>⚡ Quant Day Trade</h1>
          <p className={s.subtitle}>
            Day Trading & Algorithmic Execution Desk สำหรับ 25 สินทรัพย์พอร์ต Quantix พร้อมสัญญาณ Real-time ML
          </p>
        </div>

        <div className={s.headerActions}>
          {status.connected ? (
            <div className={s.connectedGroup}>
              <div className={`${s.statusChip} ${s.connected}`}>
                <span className={s.dot}></span>
                <span>
                  {status.mode === 'simulation' ? 'Paper Trading ($10K)' : `MT5 #${account?.login || 'Active'}`}
                </span>
              </div>
              <button className={s.btnDisconnect} onClick={handleDisconnect} disabled={actionLoading}>
                ตัดการเชื่อมต่อ
              </button>
            </div>
          ) : (
            <div className={s.connectButtonGroup}>
              <button className={s.btnPaperTrade} onClick={(e) => handleConnect(e, true)} disabled={actionLoading}>
                ⚡ ทดลอง Paper Trading ($10,000)
              </button>
              <button className={s.btnConnectPrimary} onClick={() => setShowConnectModal(true)}>
                เชื่อมต่อ MT5 จริง
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div className={s.alertSuccess}>
          <span>✓ {message}</span>
          <button onClick={() => setMessage('')}>✕</button>
        </div>
      )}
      {error && (
        <div className={s.alertError}>
          <span>✕ {error}</span>
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* ── Quant Telemetry Metric Strip ── */}
      <div className={s.kpiGrid}>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Balance / Equity</div>
          <div className={s.kpiValue}>
            ${account?.equity != null ? Number(account.equity).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '10,000.00'}
          </div>
          <div className={s.kpiSub}>
            Balance: ${account?.balance != null ? Number(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '10,000.00'}
          </div>
        </div>

        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Today's Floating P/L</div>
          <div className={`${s.kpiValue} ${(account?.profit || 0) >= 0 ? s.profitPos : s.profitNeg}`}>
            {(account?.profit || 0) >= 0 ? '+' : ''}${Number(account?.profit || 0).toFixed(2)}
          </div>
          <div className={s.kpiSub}>
            ฿{Number((account?.profit || 0) * 35).toLocaleString('th-TH', { maximumFractionDigits: 0 })} THB
          </div>
        </div>

        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Open Order Tickets</div>
          <div className={s.kpiValue}>{positions.length} Active</div>
          <div className={s.kpiSub}>
            Free Margin: ${Number(account?.margin_free || account?.equity || 10000).toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>ML 25-Asset Scanner</div>
          <div className={s.kpiValue}>
            {botState?.orders_executed || 0} Bot Deals
          </div>
          <div className={s.kpiSub}>
            Scanned: {mlData?.total || 25} Assets
          </div>
        </div>

        {positions.length > 0 && (
          <div className={`${s.kpiCard} ${s.kpiPanic}`}>
            <div className={s.kpiLabel}>Risk Control</div>
            <button className={s.btnPanic} onClick={handleCloseAll} disabled={actionLoading}>
              🚨 CLOSE ALL POSITIONS
            </button>
          </div>
        )}
      </div>

      {/* ── Mode Navigation Tabs ── */}
      <div className={s.tabBar}>
        <button
          className={`${s.tabItem} ${activeTab === 'terminal' ? s.tabActive : ''}`}
          onClick={() => setActiveTab('terminal')}
        >
          ⚡ 25-Asset Day Trade Terminal
        </button>
        <button
          className={`${s.tabItem} ${activeTab === 'signals' ? s.tabActive : ''}`}
          onClick={() => { setActiveTab('signals'); fetchSignals(); }}
        >
          🧠 ML Signals Radar (25 Assets)
          {mlData?.signals && <span className={s.tabBadge}>{mlData.signals.length}</span>}
        </button>
        <button
          className={`${s.tabItem} ${activeTab === 'bot' ? s.tabActive : ''}`}
          onClick={() => { setActiveTab('bot'); fetchBot(); }}
        >
          🤖 Auto-Trade Bot
          {botState?.enabled && <span className={s.tabBadgeGreen}>RUNNING</span>}
        </button>
        <button
          className={`${s.tabItem} ${activeTab === 'api_keys' ? s.tabActive : ''}`}
          onClick={() => { setActiveTab('api_keys'); fetchApiKeys(); }}
        >
          🔑 Bot API Keys & MT5 EA
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1: QUANT DAY TRADE TERMINAL (25 ASSETS)
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'terminal' && (
        <div className={s.terminalGrid}>
          {/* Left Column: 25 Asset Selector, ML Signal Card & Open Positions */}
          <div className={s.leftCol}>
            {/* 25 Asset Category Filters & Chips */}
            <div className={s.assetSelectorCard}>
              <div className={s.sectionTitle}>
                <span>Select from 25 Quantix Assets</span>
                <span className={s.marketStatePill}>PROJECT BENCHMARK ASSETS</span>
              </div>

              {/* Category Filter Pills */}
              <div className={s.categoryPills}>
                <button
                  className={`${s.catPill} ${selectedCategory === 'ALL' ? s.catPillActive : ''}`}
                  onClick={() => setSelectedCategory('ALL')}
                >
                  🌟 All 25 Assets
                </button>
                <button
                  className={`${s.catPill} ${selectedCategory === 'US Stocks' ? s.catPillActive : ''}`}
                  onClick={() => setSelectedCategory('US Stocks')}
                >
                  🇺🇸 US Stocks (10)
                </button>
                <button
                  className={`${s.catPill} ${selectedCategory === 'Thai Stocks' ? s.catPillActive : ''}`}
                  onClick={() => setSelectedCategory('Thai Stocks')}
                >
                  🇹🇭 Thai Stocks (10)
                </button>
                <button
                  className={`${s.catPill} ${selectedCategory === 'Bonds & Gold' ? s.catPillActive : ''}`}
                  onClick={() => setSelectedCategory('Bonds & Gold')}
                >
                  🏦 Bonds & Gold (5)
                </button>
              </div>

              {/* Asset Chips Row */}
              <div className={s.assetChipsRow}>
                {filteredAssets.map((item) => (
                  <button
                    key={item.symbol}
                    className={`${s.assetChip} ${symbol === item.symbol ? s.assetChipActive : ''}`}
                    onClick={() => setSymbol(item.symbol)}
                  >
                    <div className={s.chipTop}>
                      <span className={s.chipSymbol}>{item.symbol}</span>
                      <span className={s.chipCurrency}>{item.currency}</span>
                    </div>
                    <span className={s.chipCat}>{item.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Real-time ML Signal Banner for Selected 25 Asset */}
            {activeSignal && (
              <div className={`${s.mlSignalBanner} ${activeSignal.action.includes('BUY') ? s.sigBuy : activeSignal.action.includes('SELL') ? s.sigSell : s.sigNeutral}`}>
                <div className={s.sigBannerHeader}>
                  <div className={s.sigBannerTitle}>
                    <span className={s.sigIndicatorDot} />
                    <strong>{activeSignal.symbol} ML SIGNAL: {activeSignal.action}</strong>
                    <span className={s.sigConfBadge}>{activeSignal.confidence}% Confidence</span>
                  </div>
                  <span className={s.sigQualityTag}>{activeSignal.category}</span>
                </div>

                <div className={s.sigDetailsGrid}>
                  <div>
                    <span className={s.sigLabel}>Suggested Entry</span>
                    <span className={s.sigVal}>{curSymbol}{activeSignal.suggested_entry}</span>
                  </div>
                  <div>
                    <span className={s.sigLabel}>Stop Loss (SL)</span>
                    <span className={`${s.sigVal} ${s.textRed}`}>{activeSignal.suggested_sl ? `${curSymbol}${activeSignal.suggested_sl}` : '—'}</span>
                  </div>
                  <div>
                    <span className={s.sigLabel}>Take Profit (TP)</span>
                    <span className={`${s.sigVal} ${s.textGreen}`}>{activeSignal.suggested_tp ? `${curSymbol}${activeSignal.suggested_tp}` : '—'}</span>
                  </div>
                  <div>
                    <span className={s.sigLabel}>Risk : Reward</span>
                    <span className={s.sigVal}>{activeSignal.rr_ratio}</span>
                  </div>
                </div>

                <div className={s.sigRationaleRow}>
                  <span>💡 <strong>AI Analysis:</strong> {activeSignal.rationale}</span>
                  <button
                    className={s.btnApplySetup}
                    onClick={() => {
                      if (activeSignal.suggested_sl) setSl(String(activeSignal.suggested_sl))
                      if (activeSignal.suggested_tp) setTp(String(activeSignal.suggested_tp))
                      setMessage(`คัดลอกค่า Entry, SL, TP ของ ${symbol} ลงใน Order Pad เรียบร้อยแล้ว`)
                    }}
                  >
                    Apply Setup to Order Pad
                  </button>
                </div>
              </div>
            )}

            {/* Open Positions Table */}
            <div className={s.positionsCard}>
              <div className={s.sectionTitle}>
                <span>Active Order Tickets & Positions ({positions.length})</span>
                {positions.length > 0 && (
                  <button className={s.btnSmallCloseAll} onClick={handleCloseAll}>
                    Close All
                  </button>
                )}
              </div>

              {positions.length === 0 ? (
                <div className={s.emptyState}>
                  ยังไม่มี Position ที่เปิดอยู่ — เลือกสินทรัพย์จาก 25 ตัวด้านบนแล้วกด Buy / Sell ใน Order Pad
                </div>
              ) : (
                <div className={s.tableWrap}>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>Ticket</th>
                        <th>Symbol</th>
                        <th>Type</th>
                        <th>Lots</th>
                        <th>Entry Price</th>
                        <th>Current Price</th>
                        <th>SL / TP</th>
                        <th>Profit ($)</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((p) => (
                        <tr key={p.ticket}>
                          <td className={s.mono}>#{p.ticket}</td>
                          <td><strong>{p.symbol}</strong></td>
                          <td>
                            <span className={p.type === 'BUY' ? s.badgeBuy : s.badgeSell}>
                              {p.type}
                            </span>
                          </td>
                          <td className={s.mono}>{p.volume}</td>
                          <td className={s.mono}>{p.price_open}</td>
                          <td className={s.mono}>{p.price_current}</td>
                          <td className={s.mono}>
                            {p.sl || '—'} / {p.tp || '—'}
                          </td>
                          <td className={`${s.mono} ${p.profit >= 0 ? s.profitPos : s.profitNeg}`}>
                            {p.profit >= 0 ? '+' : ''}${p.profit.toFixed(2)}
                          </td>
                          <td>
                            <button
                              className={s.btnCloseSmall}
                              onClick={() => handleClose(p.ticket)}
                              disabled={actionLoading}
                            >
                              ✕ Close
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Order Pad & Day Trade Execution */}
          <div className={s.rightCol}>
            <div className={s.orderPadCard}>
              <div className={s.padHeader}>
                <h3>Day Trade Order Pad</h3>
                <span className={s.padSymbolBadge}>{symbol} ({activeAsset.currency})</span>
              </div>

              {/* Direct Symbol Dropdown from 25 Assets */}
              <div className={s.fieldGroup}>
                <label>Choose Asset (25 Quantix Assets)</label>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className={s.input}
                >
                  <optgroup label="🇺🇸 US Stocks (10)">
                    {QUANTIX_25_ASSETS.filter(a => a.category === 'US Stocks').map(a => (
                      <option key={a.symbol} value={a.symbol}>{a.symbol} — {a.name} (USD)</option>
                    ))}
                  </optgroup>
                  <optgroup label="🇹🇭 Thai Stocks (10)">
                    {QUANTIX_25_ASSETS.filter(a => a.category === 'Thai Stocks').map(a => (
                      <option key={a.symbol} value={a.symbol}>{a.symbol} — {a.name} (THB)</option>
                    ))}
                  </optgroup>
                  <optgroup label="🏦 Bonds & Gold (5)">
                    {QUANTIX_25_ASSETS.filter(a => a.category === 'Bonds & Gold').map(a => (
                      <option key={a.symbol} value={a.symbol}>{a.symbol} — {a.name} (USD)</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Live Bid / Ask Price Ticker */}
              <div className={s.tickBox}>
                <div className={s.tickItem}>
                  <span className={s.tickLabel}>SELL (BID)</span>
                  <span className={`${s.tickPrice} ${s.bidPrice}`}>{curSymbol}{tick.bid}</span>
                </div>
                <div className={s.spreadItem}>
                  <span className={s.spreadLabel}>SPREAD</span>
                  <span className={s.spreadValue}>{tick.spread || 0.10}</span>
                </div>
                <div className={s.tickItem}>
                  <span className={s.tickLabel}>BUY (ASK)</span>
                  <span className={`${s.tickPrice} ${s.askPrice}`}>{curSymbol}{tick.ask}</span>
                </div>
              </div>

              {/* Volume / Lot Sizing Chips */}
              <div className={s.fieldGroup}>
                <label>Volume (Lots)</label>
                <div className={s.lotChips}>
                  {['0.01', '0.02', '0.05', '0.10', '0.50', '1.00'].map((lot) => (
                    <button
                      key={lot}
                      type="button"
                      className={`${s.lotChip} ${volume === lot ? s.lotChipActive : ''}`}
                      onClick={() => setVolume(lot)}
                    >
                      {lot}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
                  className={s.input}
                  placeholder="Lot Size"
                />
              </div>

              {/* SL / TP Inputs with Auto Calculation Toggle */}
              <div className={s.fieldGroup}>
                <div className={s.labelWithAction}>
                  <label>Stop Loss / Take Profit ({curSymbol})</label>
                  <label className={s.checkLabel}>
                    <input
                      type="checkbox"
                      checked={autoSlTp}
                      onChange={(e) => setAutoSlTp(e.target.checked)}
                    />
                    <span>Auto ML Risk (1:2 R:R)</span>
                  </label>
                </div>
                <div className={s.twoInputs}>
                  <input
                    type="number"
                    step="any"
                    value={sl}
                    onChange={(e) => setSl(e.target.value)}
                    placeholder={`SL (${curSymbol})`}
                    className={s.input}
                  />
                  <input
                    type="number"
                    step="any"
                    value={tp}
                    onChange={(e) => setTp(e.target.value)}
                    placeholder={`TP (${curSymbol})`}
                    className={s.input}
                  />
                </div>
              </div>

              {/* Buy / Sell Quick Execution Buttons */}
              <div className={s.orderButtons}>
                <button
                  className={s.btnSellOrder}
                  onClick={() => handleOrder('SELL')}
                  disabled={actionLoading}
                >
                  <span className={s.btnActionTitle}>SELL {symbol}</span>
                  <span className={s.btnActionPrice}>@{curSymbol}{tick.bid}</span>
                </button>
                <button
                  className={s.btnBuyOrder}
                  onClick={() => handleOrder('BUY')}
                  disabled={actionLoading}
                >
                  <span className={s.btnActionTitle}>BUY {symbol}</span>
                  <span className={s.btnActionPrice}>@{curSymbol}{tick.ask}</span>
                </button>
              </div>

              {/* Risk Sizing Note */}
              <div className={s.riskNote}>
                <span>🛡️ Asset: <strong>{activeAsset.name}</strong> ({activeAsset.category})</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2: ML SIGNALS RADAR (ALL 25 QUANTIX ASSETS)
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'signals' && (
        <div className={s.signalsSection}>
          <div className={s.signalsSectionHeader}>
            <div>
              <h2>ML Day Trade Signals — 25 Project Benchmark Assets</h2>
              <p>คำนวณสัญญาณแบบ Real-time จาก Random Forest Regime Classifier + RSI + EMA Trend สำหรับสินทรัพย์ 25 ตัว</p>
            </div>
            <button className={s.btnRefreshSignals} onClick={fetchSignals} disabled={signalsLoading}>
              {signalsLoading ? 'กำลังสแกน 25 ตัว...' : '↻ รีเฟรชสัญญาณ 25 สินทรัพย์'}
            </button>
          </div>

          <div className={s.signalsGrid}>
            {mlData?.signals?.map((sig) => {
              const sigCur = sig.currency === 'THB' ? '฿' : '$'
              return (
                <div key={sig.symbol} className={s.signalCard}>
                  <div className={s.sigCardTop}>
                    <div>
                      <span className={s.sigSymbol}>{sig.symbol}</span>
                      <span className={s.sigCategory}>{sig.name} · {sig.category}</span>
                    </div>
                    <span className={`${s.sigActionBadge} ${sig.action.includes('BUY') ? s.badgeBuy : sig.action.includes('SELL') ? s.badgeSell : s.badgeNeutral}`}>
                      {sig.action}
                    </span>
                  </div>

                  <div className={s.confidenceMeter}>
                    <div className={s.meterHeader}>
                      <span>ML Confidence Score</span>
                      <strong>{sig.confidence}%</strong>
                    </div>
                    <div className={s.meterTrack}>
                      <div
                        className={s.meterFill}
                        style={{
                          width: `${sig.confidence}%`,
                          background: sig.action.includes('BUY') ? '#10b981' : sig.action.includes('SELL') ? '#ef4444' : '#f59e0b',
                        }}
                      />
                    </div>
                  </div>

                  <div className={s.sigMetricsTable}>
                    <div>
                      <span>Current Price</span>
                      <strong>{sigCur}{sig.current_price}</strong>
                    </div>
                    <div>
                      <span>RSI-14</span>
                      <strong>{sig.indicators.rsi_14}</strong>
                    </div>
                    <div>
                      <span>Stop Loss</span>
                      <strong className={s.textRed}>{sig.suggested_sl ? `${sigCur}${sig.suggested_sl}` : '—'}</strong>
                    </div>
                    <div>
                      <span>Take Profit</span>
                      <strong className={s.textGreen}>{sig.suggested_tp ? `${sigCur}${sig.suggested_tp}` : '—'}</strong>
                    </div>
                  </div>

                  <p className={s.sigCardRationale}>{sig.rationale}</p>

                  <button
                    className={s.btnTradeThisSignal}
                    onClick={() => {
                      setSymbol(sig.symbol)
                      if (sig.suggested_sl) setSl(String(sig.suggested_sl))
                      if (sig.suggested_tp) setTp(String(sig.suggested_tp))
                      setActiveTab('terminal')
                    }}
                  >
                    ⚡ Trade {sig.symbol} on Terminal
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 3: AUTOMATED ML DAY TRADE BOT
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'bot' && (
        <div className={s.botSection}>
          <div className={s.botHeroCard}>
            <div className={s.botHeroLeft}>
              <div className={s.botIconArea}>🤖</div>
              <div>
                <h2>Automated Quantix ML Bot for 25 Project Assets</h2>
                <p>
                  บอทจะสแกนสัญญาณเทรดสำหรับสินทรัพย์ 25 ตัวตลอดเวลา และส่งคำสั่งเทรดบน MetaTrader 5 อัตโนมัติเมื่อมั่นใจเกินเกณฑ์
                </p>
              </div>
            </div>
            <div className={s.botToggleArea}>
              <button
                className={`${s.btnBotMaster} ${botState?.enabled ? s.btnBotRunning : s.btnBotStopped}`}
                onClick={handleToggleBot}
                disabled={botLoading}
              >
                {botState?.enabled ? '⏸ PAUSE AUTO-BOT' : '▶ START AUTO-BOT'}
              </button>
            </div>
          </div>

          <div className={s.botConfigGrid}>
            <div className={s.botSettingsCard}>
              <h3>Bot Risk & 25-Asset Execution Parameters</h3>

              <div className={s.configRow}>
                <label>
                  <span>Min ML Confidence Threshold</span>
                  <strong>{botState?.min_confidence || 75}%</strong>
                </label>
                <input
                  type="range"
                  min="65"
                  max="95"
                  step="1"
                  value={botState?.min_confidence || 75}
                  onChange={(e) => handleUpdateBotParam('min_confidence', parseFloat(e.target.value))}
                  className={s.slider}
                />
              </div>

              <div className={s.configRow}>
                <label>
                  <span>Order Lot Size per Deal</span>
                  <strong>{botState?.default_lot || 0.02} Lots</strong>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="1.0"
                  value={botState?.default_lot || 0.02}
                  onChange={(e) => handleUpdateBotParam('default_lot', parseFloat(e.target.value))}
                  className={s.input}
                />
              </div>

              <div className={s.configRow}>
                <label>
                  <span>Max Open Positions Simultaneously</span>
                  <strong>{botState?.max_positions || 3} Deals</strong>
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={botState?.max_positions || 3}
                  onChange={(e) => handleUpdateBotParam('max_positions', parseInt(e.target.value, 10))}
                  className={s.input}
                />
              </div>

              <div className={s.configRow}>
                <label className={s.checkLabel}>
                  <input
                    type="checkbox"
                    checked={botState?.auto_sl_tp !== false}
                    onChange={(e) => handleUpdateBotParam('auto_sl_tp', e.target.checked)}
                  />
                  <span>บังคับตั้ง Stop Loss & Take Profit ทุกออเดอร์ (1:2 Risk/Reward)</span>
                </label>
              </div>
            </div>

            {/* Live Bot Execution Log */}
            <div className={s.botLogCard}>
              <h3>Real-Time Bot Decision & Execution Log</h3>
              <div className={s.logList}>
                {botState?.activity_log?.length === 0 ? (
                  <div className={s.emptyState}>บอทยังไม่มีประวัติการส่งคำสั่ง — เปิดใช้งานบอทเพื่อเริ่มสแกนสินทรัพย์ 25 ตัว</div>
                ) : (
                  botState?.activity_log?.map((item, idx) => (
                    <div key={idx} className={s.logItem}>
                      <span className={s.logTime}>{item.timestamp}</span>
                      <span className={item.action === 'BUY' ? s.badgeBuy : item.action === 'SELL' ? s.badgeSell : s.badgeNeutral}>
                        {item.symbol} {item.action}
                      </span>
                      <span className={s.logMessage}>{item.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 4: BOT API KEYS & MT5 EA INTEGRATION
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'api_keys' && (
        <div className={s.apiKeysSection}>
          <div className={s.apiHeaderCard}>
            <div>
              <h2>Quantix ML API Key & Bot Integration (25 Assets)</h2>
              <p>
                สร้าง API Key สำหรับบอท MT5 Expert Advisor (MQL5) หรือสคริปต์ Python เพื่อดึงสัญญาณ ML ของสินทรัพย์ 25 ตัวและส่งคำสั่งเทรด 24/7
              </p>
            </div>
            <form onSubmit={handleCreateApiKey} className={s.createKeyForm}>
              <input
                type="text"
                placeholder="ชื่อบอท (เช่น My 25-Asset MT5 Bot)"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className={s.input}
                required
              />
              <button type="submit" className={s.btnCreateKey} disabled={actionLoading}>
                + Generate API Key
              </button>
            </form>
          </div>

          {/* Newly Created Key Alert Box */}
          {createdKey && (
            <div className={s.newKeyAlert}>
              <div className={s.newKeyHeader}>
                <strong>🔑 สร้าง API Key สำเร็จ! โปรดคัดลอกทันที:</strong>
                <span>{createdKey.name}</span>
              </div>
              <div className={s.rawKeyBox}>
                <code>{createdKey.api_key}</code>
                <button onClick={() => handleCopyText(createdKey.api_key, true)}>
                  {copiedKey ? '✓ คัดลอกแล้ว!' : 'Copy Key'}
                </button>
              </div>
              <p className={s.newKeyNote}>
                * เพื่อความปลอดภัย ระบบจะแสดงคีย์เต็มเฉพาะตอนนี้เท่านั้น โปรดเก็บรักษาเป็นความลับ
              </p>
            </div>
          )}

          {/* Active API Keys Table */}
          <div className={s.keysTableCard}>
            <div className={s.sectionTitle}>
              <span>Your Active API Keys ({apiKeys.length})</span>
            </div>

            {apiKeys.length === 0 ? (
              <div className={s.emptyState}>ยังไม่มี API Key — กดปุ่ม "+ Generate API Key" ด้านบนเพื่อเริ่มใช้งาน</div>
            ) : (
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Key Name</th>
                      <th>Key Prefix</th>
                      <th>Target Assets</th>
                      <th>Created</th>
                      <th>Last Used</th>
                      <th>Requests</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiKeys.map((k) => (
                      <tr key={k.key_id}>
                        <td><strong>{k.name}</strong></td>
                        <td className={s.mono}>{k.prefix}</td>
                        <td>
                          <span className={s.permBadge}>25 Assets</span>
                          <span className={s.permBadge}>Live Deals</span>
                        </td>
                        <td className={s.mono}>{k.created_at?.split('T')[0]}</td>
                        <td className={s.mono}>{k.last_used_at ? k.last_used_at.split('T')[1].slice(0, 8) : 'Never'}</td>
                        <td className={s.mono}>{k.request_count || 0}</td>
                        <td>
                          <button
                            className={s.btnRevoke}
                            onClick={() => handleRevokeApiKey(k.key_id)}
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Ready-to-use Code Snippets */}
          <div className={s.snippetsCard}>
            <div className={s.snippetsHeader}>
              <div className={s.snippetTabs}>
                <button
                  className={`${s.snipTab} ${snippetLang === 'python' ? s.snipActive : ''}`}
                  onClick={() => setSnippetLang('python')}
                >
                  🐍 Python (MetaTrader 5)
                </button>
                <button
                  className={`${s.snipTab} ${snippetLang === 'mql5' ? s.snipActive : ''}`}
                  onClick={() => setSnippetLang('mql5')}
                >
                  ⚡ MQL5 Expert Advisor
                </button>
                <button
                  className={`${s.snipTab} ${snippetLang === 'curl' ? s.snipActive : ''}`}
                  onClick={() => setSnippetLang('curl')}
                >
                  🌐 cURL / REST API
                </button>
              </div>
              <button
                className={s.btnCopyCode}
                onClick={() => handleCopyText(
                  snippetLang === 'python'
                    ? codeSnippets?.python_snippet
                    : snippetLang === 'mql5'
                    ? codeSnippets?.mql5_snippet
                    : codeSnippets?.curl_example,
                  false
                )}
              >
                {copiedCode ? '✓ Copied Code!' : 'Copy Code'}
              </button>
            </div>

            <pre className={s.codeBlock}>
              <code>
                {snippetLang === 'python' && (codeSnippets?.python_snippet || 'Loading Python template...')}
                {snippetLang === 'mql5' && (codeSnippets?.mql5_snippet || 'Loading MQL5 EA template...')}
                {snippetLang === 'curl' && (codeSnippets?.curl_example || 'curl -X GET "http://127.0.0.1:8001/api/v1/quant/signals" -H "X-Quantix-Key: YOUR_KEY"')}
              </code>
            </pre>
          </div>
        </div>
      )}

      {/* ── MT5 Connection Modal ── */}
      {showConnectModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalCard}>
            <div className={s.modalHeader}>
              <h3>เชื่อมต่อ MetaTrader 5 บนเครื่อง</h3>
              <button className={s.btnModalClose} onClick={() => setShowConnectModal(false)}>✕</button>
            </div>
            <form onSubmit={(e) => handleConnect(e, false)}>
              <div className={s.modalField}>
                <label>MT5 Account Login (เลขบัญชี)</label>
                <input
                  type="number"
                  placeholder="เช่น 10023456 (เว้นว่างได้ถ้าเปิด MT5 อยู่แล้ว)"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  className={s.input}
                />
              </div>
              <div className={s.modalField}>
                <label>Password (รหัสผ่าน)</label>
                <input
                  type="password"
                  placeholder="รหัสผ่านบัญชี MT5"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className={s.input}
                />
              </div>
              <div className={s.modalField}>
                <label>Broker Server Name</label>
                <input
                  type="text"
                  placeholder="เช่น MetaQuotes-Demo, ICMarkets-Live"
                  value={serverInput}
                  onChange={(e) => setServerInput(e.target.value)}
                  className={s.input}
                />
              </div>
              <div className={s.modalActions}>
                <button type="button" className={s.btnModalCancel} onClick={() => setShowConnectModal(false)}>
                  ยกเลิก
                </button>
                <button type="submit" className={s.btnModalSubmit} disabled={actionLoading}>
                  {actionLoading ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อ MT5 จริง'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
