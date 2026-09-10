import { Outlet, NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../hooks/useApi'
import styles from './Layout.module.css'

const NAV = [
  { to: '/',     icon: '▦',  label: 'Dashboard' },
  { to: '/chat', icon: '✦',  label: 'AI Chat' },
]

export default function Layout() {
  const [online, setOnline] = useState(null)

  useEffect(() => {
    api.health()
      .then(() => setOnline(true))
      .catch(() => setOnline(false))
    const id = setInterval(() => {
      api.health().then(() => setOnline(true)).catch(() => setOnline(false))
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>

        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoMark}>📈</div>
          <div className={styles.logoWords}>
            <span className={styles.logoName}>QuantAI</span>
            <span className={styles.logoSub}>Portfolio System</span>
          </div>
        </div>

        {/* Nav */}
        <nav className={styles.nav}>
          <span className={styles.navSection}>Navigation</span>
          {NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
            >
              <span className={styles.navIcon}>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className={styles.sidebarFooter}>
          <div className={styles.statusRow}>
            <span className={`pulse-dot ${online ? 'green' : 'red'}`} />
            <span className={styles.statusText}>
              {online === null ? 'Connecting…' : online ? 'API Online' : 'API Offline'}
            </span>
          </div>
          <span className={styles.versionTag}>v1.0 · 25 Assets · THB</span>
        </div>

      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
