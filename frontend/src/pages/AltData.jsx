import { useEffect, useState, useCallback } from 'react'
import { api } from '../hooks/useApi'
import s from './AltData.module.css'

export default function AltData() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [retraining, setRetraining] = useState(false)
  const [retrainMsg, setRetrainMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.altData()
      setData(res)
    } catch (e) { console.warn('alt-data:', e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleRetrain = async () => {
    setRetraining(true)
    setRetrainMsg('')
    try {
      const res = await api.retrainRegime()
      setRetrainMsg(res?.message || 'เสร็จแล้ว')
    } catch (e) {
      setRetrainMsg('Error: ' + e.message)
    } finally { setRetraining(false) }
  }

  const sent = data?.sentiment || {}
  const ind = data?.indicators || {}
  const fgScore = sent.fear_greed_score
  const fgColor = fgScore > 55 ? 'var(--green)' : fgScore < 45 ? 'var(--red)' : 'var(--yellow)'

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1>Alternative Data</h1>
          <p className={s.sub}>VIX · Fear & Greed · Macro Indicators — ข้อมูลเสริมนอกเหนือจากราคาหุ้น</p>
        </div>
        <button className="btn btn-ghost" onClick={load}>รีเฟรช</button>
      </header>

      {loading ? (
        <div className="card">กำลังดึงข้อมูล…</div>
      ) : data ? (
        <>
          {/* Fear & Greed Gauge */}
          <div className={`card ${s.gaugeCard}`}>
            <h3>Fear & Greed Index</h3>
            <div className={s.gauge}>
              <div className={s.gaugeBar} style={{ '--fg': fgColor }}>
                <div className={s.gaugeFill} style={{ width: `${fgScore || 50}%` }} />
              </div>
              <div className={s.gaugeLabels}>
                <span>Extreme Fear</span><span>Neutral</span><span>Extreme Greed</span>
              </div>
            </div>
            <div className={s.gaugeScore} style={{ color: fgColor }}>
              {fgScore?.toFixed(1)} — {sent.fear_greed_label}
            </div>
            {sent.vix_label && (
              <div className={s.vixRow}>
                VIX Sentiment: <strong>{sent.vix_label}</strong>
              </div>
            )}
          </div>

          {/* Macro Indicators */}
          <div className={s.indGrid}>
            {ind.vix != null && (
              <div className={`card ${s.indCard}`}>
                <span className={s.indLabel}>VIX</span>
                <span className={s.indVal}>{ind.vix}</span>
                <span className={s.indSub}>Volatility Index</span>
              </div>
            )}
            {ind.us10y != null && (
              <div className={`card ${s.indCard}`}>
                <span className={s.indLabel}>US 10Y Yield</span>
                <span className={s.indVal}>{ind.us10y}%</span>
                <span className={s.indSub}>Treasury Bond</span>
              </div>
            )}
            {ind.dxy != null && (
              <div className={`card ${s.indCard}`}>
                <span className={s.indLabel}>DXY</span>
                <span className={s.indVal}>{ind.dxy}</span>
                <span className={s.indSub}>Dollar Index</span>
              </div>
            )}
            {ind.gold != null && (
              <div className={`card ${s.indCard}`}>
                <span className={s.indLabel}>Gold</span>
                <span className={s.indVal}>${ind.gold}</span>
                <span className={s.indSub}>Gold Futures</span>
              </div>
            )}
          </div>

          {/* ML Model Retrain */}
          <div className={`card ${s.retrainCard}`}>
            <h3>ML Model Retraining</h3>
            <p className={s.retrainDesc}>ฝึกโมเดล Regime (Random Forest) ใหม่ด้วยข้อมูลล่าสุด — รัน pipeline ใหม่ทั้งหมด</p>
            <button className="btn btn-primary" onClick={handleRetrain} disabled={retraining}>
              {retraining ? <><span className="spinner" /> กำลัง retrain…</> : 'Retrain Model'}
            </button>
            {retrainMsg && <p className={s.retrainMsg}>{retrainMsg}</p>}
          </div>
        </>
      ) : (
        <div className="card">ไม่สามารถดึงข้อมูลได้</div>
      )}
    </div>
  )
}
