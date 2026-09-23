import { Outlet, NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
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
    to: '/portfolio',
    label: 'My Portfolio',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 7h-3V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
        <path d="M9 7V5h6v2"/>
      </svg>
    ),
  },
  {
    to: '/rebalancing',
    label: 'Rebalancing',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
        <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
      </svg>
    ),
  },
  {
    to: '/backtesting',
    label: 'Backtesting',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18"/><path d="M7 12l4-4 4 4 5-5"/>
      </svg>
    ),
  },
  {
    to: '/watchlist',
    label: 'Watchlist',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
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
    to: '/settings',
    label: 'Settings',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
]

export default function Layout() {
  const [online, setOnline] = useState(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()

  useEffect(() => {
    const check = () =>
      api.health().then(() => setOnline(true)).catch(() => setOnline(false))
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [])

  // Close mobile nav on route change
  const handleNavClick = () => setMobileNavOpen(false)

  return (
    <div className={s.shell}>
      {/* ── Mobile top bar ── */}
      <header className={s.mobileTopBar}>
        <button className={s.hamburger} onClick={() => setMobileNavOpen(v => !v)} aria-label="Menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {mobileNavOpen
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
            }
          </svg>
        </button>
        <div className={s.mobileLogo}>
          <div className={s.logoMark}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
              <polyline points="16 7 22 7 22 13"/>
            </svg>
          </div>
          <span className={s.mobileLogoText}>QuantAI</span>
        </div>
        <button className={s.themeBtn} onClick={toggle} title={theme === 'light' ? 'โหมดกลางคืน' : 'โหมดกลางวัน'}>
          {theme === 'light' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          )}
        </button>
      </header>

      {/* ── Mobile nav overlay ── */}
      {mobileNavOpen && <div className={s.overlay} onClick={() => setMobileNavOpen(false)} />}

      {/* ── Sidebar ── */}
      <aside className={`${s.sidebar} ${mobileNavOpen ? s.sidebarOpen : ''}`}>
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
              onClick={handleNavClick}
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
            <button className={s.themeBtn} onClick={toggle} title={theme === 'light' ? 'โหมดกลางคืน' : 'โหมดกลางวัน'}>
              {theme === 'light' ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              )}
            </button>
          </div>
          <div className={s.meta}>25 Assets · THB · v2.0</div>
        </div>
      </aside>

      <main className={s.main}>
        <Outlet />
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className={s.bottomNav}>
        {NAV.slice(0, 5).map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `${s.bottomNavItem} ${isActive ? s.bottomNavActive : ''}`}
          >
            <span className={s.bottomNavIcon}>{icon}</span>
            <span className={s.bottomNavLabel}>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
