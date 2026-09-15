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
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(u => {
        setUser(u)
        window.history.replaceState(null, '', '/dashboard')
        navigate('/dashboard', { replace: true, state: { user: u } })
      })
      .catch(() => navigate('/login?error=1', { replace: true }))
  }, [location.hash, navigate, setUser])

  return (
    <div className={s.wrap}>
      <div className={s.spinner} />
      <p className={s.text}>กำลังเข้าสู่ระบบ…</p>
    </div>
  )
}
