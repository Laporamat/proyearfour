import { useEffect, useState, useCallback } from 'react'
import { api } from '../hooks/useApi'
import s from './TaxReport.module.css'

export default function TaxReport() {
  const [taxInfo, setTaxInfo] = useState(null)
  const [holdings, setHoldings] = useState([])
  const [livePrices, setLivePrices] = useState({})
  const [calc, setCalc] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [info, pf, live] = await Promise.all([
        api.taxReport(),
        api.getPortfolio(),
        api.livePrices(),
      ])
      setTaxInfo(info)
      setHoldings(pf?.items || [])
      setLivePrices(live?.prices || {})
    } catch (e) { console.warn('tax:', e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCalculate = async () => {
    const holdingsData = holdings.map(h => ({
      ticker: h.ticker,
      shares: h.shares,
      buyPrice: h.buyPrice,
      currentPrice: livePrices[h.ticker] || 0,
    }))
    try {
      const res = await api.taxCalc({ holdings: holdingsData, dividends: [] })
      setCalc(res)
    } catch (e) { console.warn('tax calc:', e.message) }
  }

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1>Tax Report</h1>
          <p className={s.sub}>คำนวณภาษีจากการลงทุน — กำไร/ขาดทุน + ภาษีปันผล (ประเทศไทย)</p>
        </div>
        {holdings.length > 0 && (
          <button className="btn btn-primary" onClick={handleCalculate}>คำนวณภาษี</button>
        )}
      </header>

      {loading ? (
        <div className="card">กำลังโหลด…</div>
      ) : (
        <>
          {/* Tax Info */}
          <div className={s.infoGrid}>
            <div className={`card ${s.infoCard}`}>
              <h3>Capital Gains</h3>
              <span className={`${s.badge} ${taxInfo?.capital_gains?.taxable ? s.badgeRed : s.badgeGreen}`}>
                {taxInfo?.capital_gains?.taxable ? 'ต้องเสียภาษี' : 'ไม่ต้องเสียภาษี'}
              </span>
              <p className={s.infoNote}>{taxInfo?.capital_gains?.note}</p>
            </div>
            <div className={`card ${s.infoCard}`}>
              <h3>Dividend Tax</h3>
              <span className={`${s.badge} ${s.badgeYellow}`}>{taxInfo?.dividend_tax?.rate}</span>
              <p className={s.infoNote}>{taxInfo?.dividend_tax?.note}</p>
            </div>
            <div className={`card ${s.infoCard}`}>
              <h3>แบบฟอร์ม</h3>
              <span className={s.formName}>{taxInfo?.form}</span>
              <p className={s.infoNote}>สำหรับบุคคลธรรมดาที่มีเงินได้จากทุน</p>
            </div>
          </div>

          {/* Calculation Results */}
          {calc && (
            <div className={`card ${s.calcCard}`}>
              <h3>ผลการคำนวณ — ปี {calc.tax_year}</h3>
              <div className={s.calcGrid}>
                <div className={s.calcItem}>
                  <span className={s.calcLabel}>จำนวนหุ้น</span>
                  <span className={s.calcVal}>{calc.holdings_count} ตัว</span>
                </div>
                <div className={s.calcItem}>
                  <span className={s.calcLabel}>ต้นทุนรวม</span>
                  <span className={s.calcVal}>฿{calc.total_cost.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className={s.calcItem}>
                  <span className={s.calcLabel}>มูลค่าปัจจุบัน</span>
                  <span className={s.calcVal}>฿{calc.total_value.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className={s.calcItem}>
                  <span className={s.calcLabel}>กำไร/ขาดทุน</span>
                  <span className={s.calcVal} style={{ color: calc.unrealized_pl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {calc.unrealized_pl >= 0 ? '+' : ''}฿{Math.abs(calc.unrealized_pl).toLocaleString('th-TH', { maximumFractionDigits: 2 })} ({calc.unrealized_pl_pct}%)
                  </span>
                </div>
                <div className={s.calcItem}>
                  <span className={s.calcLabel}>ภาษีกำไร</span>
                  <span className={s.calcVal}>฿0 (ไม่ต้องเสีย)</span>
                </div>
                <div className={s.calcItem}>
                  <span className={s.calcLabel}>ภาษีปันผล (10%)</span>
                  <span className={s.calcVal} style={{ color: 'var(--red)' }}>฿{calc.dividend_tax.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className={`${s.calcItem} ${s.calcTotal}`}>
                  <span className={s.calcLabel}>ภาษีประเมินรวม</span>
                  <span className={s.calcVal}>฿{calc.total_estimated_tax.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              <p className={s.disclaimer}>* การคำนวณนี้เป็นเบื้องต้นเท่านั้น กรุณาปรึกษาผู้เชี่ยวชาญด้านภาษี</p>
            </div>
          )}

          {holdings.length === 0 && !calc && (
            <div className="card">เพิ่มหุ้นใน My Portfolio ก่อน แล้วกด "คำนวณภาษี" เพื่อดูผล</div>
          )}
        </>
      )}
    </div>
  )
}
