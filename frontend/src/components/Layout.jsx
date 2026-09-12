import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../hooks/useApi'
import s from './Layout.module.css'

const NAV = [
  {
    to: '/',
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
]

export default function Layout() {
  const [online, setOnline] = useState(null)

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
              end={to === '/'}
              className={({ isActive }) => `${s.navItem} ${isActive ? s.active : ''}`}
            >
              <span className={s.navIcon}>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* ── Footer ── */}
        <div className={s.footer}>
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
