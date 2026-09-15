import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import s from './Login.module.css'

const API_BASE = import.meta.env.VITE_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL || ''

function fmtError(detail) {
  if (detail == null) return 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง'
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail))
    return detail.map(e => (e && typeof e.msg === 'string' ? e.msg : JSON.stringify(e))).join(' ')
  if (detail && typeof detail.msg === 'string') return detail.msg
  return String(detail)
}

export default function Register() {
  const nav = useNavigate()
  const { refresh } = useAuth()

  const [step, setStep]         = useState('form')   // 'form' | 'otp'
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [password2, setP2]      = useState('')
  const [otp, setOtp]           = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [info, setInfo]         = useState('')

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8)  return setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
    if (password !== password2) return setError('รหัสผ่านทั้ง 2 ช่องต้องตรงกัน')
    setLoading(true)
    try {
      const r = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, name: name.trim() }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(fmtError(data.detail))
      setInfo(data.delivered
        ? `เราส่งรหัส OTP 6 หลักไปที่ ${email} แล้ว (หมดอายุใน ${data.ttl_min} นาที)`
        : `สร้างบัญชีแล้ว รหัส OTP อยู่ที่ backend log (email delivery ยังไม่พร้อม — ดู .env)`)
      setStep('otp')
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  const handleOtp = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const r = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: otp.trim() }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(fmtError(data.detail))
      await refresh()
      nav('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  const handleResend = async () => {
    setError(''); setInfo('')
    try {
      const r = await fetch(`${API_BASE}/api/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(fmtError(data.detail))
      setInfo(`ส่งรหัสใหม่ไปที่ ${email} แล้ว`)
    } catch (err) { setError(err.message) }
  }

  return (
    <div className={s.page}>
      <Link to="/" className={s.back}>← กลับหน้าแรก</Link>

      <div className={s.card}>
        <div className={s.brandMark}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
            <polyline points="3 17 9 11 13 15 21 7" />
            <polyline points="14 7 21 7 21 14" />
          </svg>
        </div>

        {step === 'form' ? (
          <>
            <h1 className={s.title}>สมัครสมาชิก</h1>
            <p className={s.sub}>มีบัญชีแล้ว? <Link to="/login" className={s.link}>เข้าสู่ระบบ</Link></p>
            {error && <div className={s.error} data-testid="register-error">{error}</div>}
            <form onSubmit={handleRegister} className={s.form}>
              <label className={s.field}>
                <span>ชื่อ</span>
                <input data-testid="reg-name" type="text" required value={name}
                       onChange={e=>setName(e.target.value)} placeholder="ชื่อของคุณ" />
              </label>
              <label className={s.field}>
                <span>อีเมล</span>
                <input data-testid="reg-email" type="email" required autoComplete="email"
                       value={email} onChange={e=>setEmail(e.target.value)}
                       placeholder="you@example.com" />
              </label>
              <label className={s.field}>
                <span>รหัสผ่าน</span>
                <input data-testid="reg-password" type="password" required autoComplete="new-password"
                       value={password} onChange={e=>setPassword(e.target.value)}
                       placeholder="อย่างน้อย 8 ตัวอักษร" />
              </label>
              <label className={s.field}>
                <span>ยืนยันรหัสผ่าน</span>
                <input data-testid="reg-password2" type="password" required autoComplete="new-password"
                       value={password2} onChange={e=>setP2(e.target.value)}
                       placeholder="พิมพ์ซ้ำอีกครั้ง" />
              </label>
              <button data-testid="reg-submit" type="submit" className={s.primary} disabled={loading}>
                {loading ? <span className="spinner" /> : 'สมัครสมาชิก'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className={s.title}>ยืนยันอีเมล</h1>
            <p className={s.sub}>{info || `กรอกรหัส OTP 6 หลักที่ส่งไปยัง ${email}`}</p>
            {error && <div className={s.error} data-testid="otp-error">{error}</div>}
            <form onSubmit={handleOtp} className={s.form}>
              <label className={s.field}>
                <span>รหัส OTP</span>
                <input data-testid="otp-code" type="text" inputMode="numeric" maxLength={6}
                       required value={otp}
                       onChange={e=>setOtp(e.target.value.replace(/\D/g,''))}
                       placeholder="000000"
                       style={{fontFamily:'Geist Mono, monospace', fontSize:'1.5rem',
                               textAlign:'center', letterSpacing:'0.4em'}} />
              </label>
              <button data-testid="otp-submit" type="submit" className={s.primary} disabled={loading || otp.length !== 6}>
                {loading ? <span className="spinner" /> : 'ยืนยันและเข้าสู่ระบบ'}
              </button>
            </form>
            <div className={s.formRow} style={{justifyContent:'space-between', marginTop:12}}>
              <button type="button" className={s.link} data-testid="otp-back"
                      onClick={()=>{ setStep('form'); setError(''); setInfo('') }}
                      style={{background:'none',border:'none',cursor:'pointer',padding:0,fontSize:'0.82rem'}}>
                ← เปลี่ยนอีเมล
              </button>
              <button type="button" className={s.link} data-testid="otp-resend"
                      onClick={handleResend}
                      style={{background:'none',border:'none',cursor:'pointer',padding:0,fontSize:'0.82rem'}}>
                ส่งรหัสใหม่
              </button>
            </div>
          </>
        )}
      </div>

      <div className={s.side}>
        <blockquote>
          <p>"บัญชีเดียว เข้าถึงพอร์ตที่ปรับตามภาวะตลาดแบบเรียลไทม์ ทุกที่ ทุกเวลา"</p>
          <cite>— QuantAI</cite>
        </blockquote>
      </div>
    </div>
  )
}
