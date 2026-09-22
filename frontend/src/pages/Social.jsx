import { useEffect, useState, useCallback } from 'react'
import { api } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import s from './Social.module.css'

export default function Social() {
  const [shared, setShared] = useState([])
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [shareForm, setShareForm] = useState({ title: '', description: '' })
  const [myHoldings, setMyHoldings] = useState([])
  const [livePrices, setLivePrices] = useState({})
  const [viewing, setViewing] = useState(null)
  const { user } = useAuth()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sharedRes, pf, live] = await Promise.all([
        api.listShared(),
        api.getPortfolio(),
        api.livePrices(),
      ])
      setShared(sharedRes?.portfolios || [])
      setMyHoldings(pf?.items || [])
      setLivePrices(live?.prices || {})
    } catch (e) { console.warn('social:', e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleShare = async () => {
    if (!shareForm.title.trim()) return
    setSharing(true)
    try {
      const holdingsData = myHoldings.map(h => ({
        ticker: h.ticker,
        shares: h.shares,
        buyPrice: h.buyPrice,
        currentPrice: livePrices[h.ticker] || 0,
      }))
      await api.sharePortfolio({
        title: shareForm.title,
        description: shareForm.description,
        holdings: holdingsData,
      })
      setShareForm({ title: '', description: '' })
      await load()
    } catch (e) { console.warn('share:', e.message) }
    finally { setSharing(false) }
  }

  const handleView = async (shareId) => {
    try {
      const res = await api.getShared(shareId)
      setViewing(res)
    } catch (e) { console.warn('view:', e.message) }
  }

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1>Social</h1>
          <p className={s.sub}>แชร์พอร์ตการลงทุนของคุณ — ดูพอร์ตคนอื่น และหาแรงบันดาลใจ</p>
        </div>
      </header>

      {/* Share form */}
      {myHoldings.length > 0 && (
        <div className={`card ${s.shareCard}`}>
          <h3>แชร์พอร์ตของฉัน ({myHoldings.length} หุ้น)</h3>
          <div className={s.shareForm}>
            <input
              className={s.input}
              placeholder="ชื่อพอร์ต เช่น พอร์ตเกษียณ 2026"
              value={shareForm.title}
              onChange={e => setShareForm(f => ({ ...f, title: e.target.value }))}
            />
            <input
              className={s.input}
              placeholder="คำอธิบาย (ไม่จำเป็น)"
              value={shareForm.description}
              onChange={e => setShareForm(f => ({ ...f, description: e.target.value }))}
            />
            <button className="btn btn-primary" onClick={handleShare} disabled={sharing || !shareForm.title.trim()}>
              {sharing ? <span className="spinner" /> : 'แชร์'}
            </button>
          </div>
        </div>
      )}

      {/* View shared portfolio modal */}
      {viewing && (
        <div className={s.modal} onClick={() => setViewing(null)}>
          <div className={`card ${s.modalCard}`} onClick={e => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h3>{viewing.title}</h3>
              <button className={s.closeBtn} onClick={() => setViewing(null)}>✕</button>
            </div>
            {viewing.description && <p className={s.modalDesc}>{viewing.description}</p>}
            <div className={s.authorRow}>
              {viewing.author_avatar && <img src={viewing.author_avatar} alt="" className={s.authorAvatar} />}
              <span>{viewing.author_name}</span>
              <span className={s.date}>{viewing.created_at?.split('T')[0]}</span>
            </div>
            <table className={s.table}>
              <thead>
                <tr><th>Ticker</th><th className={s.right}>Shares</th><th className={s.right}>Buy Price</th></tr>
              </thead>
              <tbody>
                {viewing.holdings?.map((h, i) => (
                  <tr key={i}>
                    <td className={s.ticker}>{h.ticker}</td>
                    <td className={s.right}>{h.shares}</td>
                    <td className={s.right}>฿{h.buyPrice?.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shared portfolios list */}
      {loading ? (
        <div className="card">กำลังโหลด…</div>
      ) : shared.length > 0 ? (
        <div className={s.grid}>
          {shared.map(p => (
            <div key={p.share_id} className={`card ${s.card}`} onClick={() => handleView(p.share_id)}>
              <h3 className={s.cardTitle}>{p.title}</h3>
              {p.description && <p className={s.cardDesc}>{p.description}</p>}
              <div className={s.cardMeta}>
                {p.author_avatar && <img src={p.author_avatar} alt="" className={s.authorAvatar} />}
                <span>{p.author_name}</span>
                <span className={s.date}>{p.created_at?.split('T')[0]}</span>
              </div>
              <span className={s.holdingCount}>{p.holdings?.length || 0} หุ้น</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">ยังไม่มีพอร์ตที่แชร์ — เป็นคนแรกที่แชร์พอร์ตของคุณ!</div>
      )}
    </div>
  )
}
