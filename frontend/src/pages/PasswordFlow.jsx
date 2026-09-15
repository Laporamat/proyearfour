import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import s from './Login.module.css'

const API_BASE = import.meta.env.VITE_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL || ''

function fmtError(detail) {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map(e => e?.msg || JSON.stringify(e)).join(' ')
  return 'เกิดข้อผิดพลาด'
}

export function ForgotPassword() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const r = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(fmtError(data.detail))
      setSent(true)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className={s.page}>
      <Link to="/login" className={s.back}>← กลับหน้า Login</Link>
      <div className={s.card}>
        <div className={s.brandMark}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        {!sent ? (
          <>
            <h1 className={s.title}>ลืมรหัสผ่าน?</h1>
            <p className={s.sub}>กรอกอีเมล เราจะส่งลิงก์รีเซ็ตให้</p>
            {error && <div className={s.error}>{error}</div>}
            <form onSubmit={submit} className={s.form}>
              <label className={s.field}>
                <span>อีเมล</span>
                <input data-testid="forgot-email" type="email" required
                       value={email} onChange={e=>setEmail(e.target.value)}
                       placeholder="you@example.com" />
              </label>
              <button data-testid="forgot-submit" type="submit" className={s.primary} disabled={loading}>
                {loading ? <span className="spinner" /> : 'ส่งลิงก์รีเซ็ต'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className={s.title}>ตรวจสอบอีเมลของคุณ</h1>
            <p className={s.sub} data-testid="forgot-sent">
              เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปที่ <b>{email}</b> แล้ว
              (ถ้าอีเมลนี้อยู่ในระบบจริง) โปรดตรวจสอบกล่องข้อความในอีก 1-2 นาที
              ลิงก์จะหมดอายุใน 1 ชั่วโมง
            </p>
            <Link to="/login" className={s.primary} style={{textAlign:'center',textDecoration:'none'}}>
              กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </>
        )}
      </div>
      <div className={s.side}>
        <blockquote><p>"ลืมรหัสผ่าน? ไม่ต้องกังวล — รีเซ็ตได้ในไม่กี่นาที"</p></blockquote>
      </div>
    </div>
  )
}

export function ResetPassword() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const token = sp.get('token') || ''

  const [password, setP]      = useState('')
  const [password2, setP2]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8)    return setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
    if (password !== password2) return setError('รหัสผ่านทั้ง 2 ช่องต้องตรงกัน')
    setLoading(true)
    try {
      const r = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(fmtError(data.detail))
      setDone(true)
      setTimeout(() => nav('/login', { replace: true }), 1800)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className={s.page}>
      <Link to="/login" className={s.back}>← กลับหน้า Login</Link>
      <div className={s.card}>
        <div className={s.brandMark}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h1 className={s.title}>ตั้งรหัสผ่านใหม่</h1>
        <p className={s.sub}>เลือกรหัสผ่านที่ปลอดภัย อย่างน้อย 8 ตัวอักษร</p>

        {!token && <div className={s.error}>ลิงก์ไม่ถูกต้อง — ไม่พบ token</div>}
        {error && <div className={s.error} data-testid="reset-error">{error}</div>}
        {done && <div className={s.success} data-testid="reset-success">รีเซ็ตสำเร็จ! กำลังเปลี่ยนหน้า…</div>}

        {!done && token && (
          <form onSubmit={submit} className={s.form}>
            <label className={s.field}>
              <span>รหัสผ่านใหม่</span>
              <input data-testid="reset-password" type="password" required autoComplete="new-password"
                     value={password} onChange={e=>setP(e.target.value)} placeholder="อย่างน้อย 8 ตัวอักษร" />
            </label>
            <label className={s.field}>
              <span>ยืนยันรหัสผ่านใหม่</span>
              <input data-testid="reset-password2" type="password" required autoComplete="new-password"
                     value={password2} onChange={e=>setP2(e.target.value)} placeholder="พิมพ์ซ้ำอีกครั้ง" />
            </label>
            <button data-testid="reset-submit" type="submit" className={s.primary} disabled={loading}>
              {loading ? <span className="spinner" /> : 'ตั้งรหัสผ่านใหม่'}
            </button>
          </form>
        )}
      </div>
      <div className={s.side}>
        <blockquote><p>"ตั้งรหัสผ่านใหม่ที่ปลอดภัย เพื่อป้องกันบัญชีของคุณ"</p></blockquote>
      </div>
    </div>
  )
}
