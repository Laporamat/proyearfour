import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import s from './AuthCallback.module.css'

const API_BASE = import.meta.env.VITE_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL || ''

export default function AuthCallback() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { setUser } = useAuth()
  const hasProcessed = useRef(false)

  useEffect(() => {
    if (hasProcessed.current) return
    hasProcessed.current = true

    const hash = location.hash || ''
    const m = hash.match(/session_id=([^&]+)/)
    if (!m) { navigate('/login', { replace: true }); return }

    const sessionId = decodeURIComponent(m[1])
    fetch(`${API_BASE}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then(async r => {
        if (r.ok) return r.json()
        const data = await r.json().catch(() => ({}))
        const msg = typeof data.detail === 'string' ? data.detail : `HTTP ${r.status}`
        throw new Error(msg)
      })
      .then(u => {
        setUser(u)
        window.history.replaceState(null, '', '/dashboard')
        navigate('/dashboard', { replace: true, state: { user: u } })
      })
      .catch(err => {
        const q = new URLSearchParams({ error: '1', reason: err.message || 'oauth' }).toString()
        navigate(`/login?${q}`, { replace: true })
      })
  }, [location.hash, navigate, setUser])

  return (
    <div className={s.wrap}>
      <div className={s.spinner} />
      <p className={s.text}>กำลังเข้าสู่ระบบ…</p>
    </div>
  )
}
