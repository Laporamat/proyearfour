import { Outlet, NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import s from './Layout.module.css'

const NAV = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    to: '/chat',
    label: 'AI Chat',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    to: '/portfolio',
    label: 'My Portfolio',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 7h-3V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
        <path d="M9 7V5h6v2"/>
      </svg>
    ),
  },
]

export default function Layout() {
  const [online, setOnline] = useState(null)
  const { user, logout } = useAuth()

  useEffect(() => {
    const check = () =>
      api.health().then(() => setOnline(true)).catch(() => setOnline(false))
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className={s.shell}>
      <aside className={s.sidebar}>
        {/* ── Logo ── */}
        <div className={s.logo}>
          <div className={s.logoMark}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
              <polyline points="16 7 22 7 22 13"/>
            </svg>
          </div>
          <div>
            <div className={s.logoName}>QuantAI</div>
            <div className={s.logoSub}>Portfolio System</div>
          </div>
        </div>

        {/* ── Nav ── */}
        <nav className={s.nav}>
          <span className={s.navSection}>Menu</span>
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `${s.navItem} ${isActive ? s.active : ''}`}
            >
              <span className={s.navIcon}>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* ── Footer ── */}
        <div className={s.footer}>
          {user && (
            <div className={s.userChip} data-testid="sidebar-user">
              {user.picture
                ? <img src={user.picture} alt="" className={s.avatar} />
                : <div className={`${s.avatar} ${s.avatarInit}`}>{(user.name || user.email)[0]?.toUpperCase()}</div>
              }
              <div className={s.userText}>
                <div className={s.userName}>{user.name}</div>
                <div className={s.userMail}>{user.email}</div>
              </div>
              <button data-testid="logout-btn" className={s.logoutBtn} title="ออกจากระบบ" onClick={logout}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          )}
          <div className={s.statusRow}>
            <span className={`pulse-dot ${online ? 'green' : 'red'}`} />
            <span className={s.statusText}>
              {online === null ? 'Connecting…' : online ? 'API Online' : 'API Offline'}
            </span>
          </div>
          <div className={s.meta}>25 Assets · THB · v1.0</div>
        </div>
      </aside>

      <main className={s.main}>
        <Outlet />
      </main>
    </div>
  )
}
