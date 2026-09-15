import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
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

export default function Login() {
  const nav        = useNavigate()
  const location   = useLocation()
  const { refresh } = useAuth()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(() => {
    const sp = new URLSearchParams(location.search)
    if (sp.get('error') !== '1') return ''
    const reason = sp.get('reason')
    return reason
      ? `เข้าสู่ระบบผ่าน Google ไม่สำเร็จ: ${reason} — ลองใช้อีเมล/รหัสผ่านด้านล่างแทน`
      : 'เข้าสู่ระบบผ่าน Google ไม่สำเร็จ ลองอีกครั้งหรือใช้อีเมล/รหัสผ่านด้านล่าง'
  })

  const handleGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard'
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const r = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(fmtError(data.detail))
      await refresh()
      nav('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'เข้าสู่ระบบไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
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

        <h1 className={s.title}>เข้าสู่ระบบ</h1>
        <p className={s.sub}>ยังไม่มีบัญชี? <Link to="/register" className={s.link} data-testid="link-register">สมัครสมาชิก</Link></p>

        {error && <div className={s.error} data-testid="login-error">{error}</div>}

        <form onSubmit={handleSubmit} className={s.form}>
          <label className={s.field}>
            <span>อีเมล</span>
            <input
              data-testid="login-email"
              type="email"
              required autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className={s.field}>
            <span>รหัสผ่าน</span>
            <input
              data-testid="login-password"
              type="password"
              required autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="อย่างน้อย 8 ตัวอักษร"
            />
          </label>
          <div className={s.formRow}>
            <Link to="/forgot-password" className={s.link} data-testid="link-forgot">ลืมรหัสผ่าน?</Link>
          </div>
          <button data-testid="login-submit" type="submit" className={s.primary} disabled={loading}>
            {loading ? <span className="spinner" /> : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <div className={s.divider}><span>หรือ</span></div>

        <button
          data-testid="google-signin-btn"
          className={s.googleBtn}
          onClick={handleGoogle}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
          </svg>
          <span>Continue with Google</span>
        </button>

        <p className={s.legal}>
          การเข้าสู่ระบบถือว่ายอมรับ <a href="#">ข้อกำหนดการใช้งาน</a> และ <a href="#">นโยบายความเป็นส่วนตัว</a>
        </p>
      </div>

      <div className={s.side}>
        <blockquote>
          <p>"จากคลิก Pipeline ทีละอันจนต้องรอเป็นนาที — เดี๋ยวนี้แค่ล็อกอินก็เห็นพอร์ตที่แนะนำเลย"</p>
          <cite>— นักลงทุนสาย Quant</cite>
        </blockquote>
      </div>
    </div>
  )
}
