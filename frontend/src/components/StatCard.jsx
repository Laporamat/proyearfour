import { useNavigate } from 'react-router-dom'
import s from './StatCard.module.css'

export default function StatCard({ icon, label, value, sub, color = 'accent', loading, to }) {
  const navigate = useNavigate()
  const clickable = Boolean(to)

  const handleClick = () => { if (clickable) navigate(to) }
  const handleKey = (e) => {
    if (clickable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); navigate(to) }
  }

  return (
    <div
      className={`${s.card} ${s[color]} ${clickable ? s.clickable : ''}`}
      onClick={handleClick}
      onKeyDown={handleKey}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      data-testid={clickable ? `statcard-${to.split('/').pop()}` : undefined}
    >
      <div className={`${s.iconWrap} ${s[`icon_${color}`]}`}>{icon}</div>
      <div className={s.body}>
        <p className={s.label}>{label}</p>
        {loading
          ? <div className={`skeleton ${s.skelVal}`} />
          : <div className={`${s.value} anim-up`}>{value ?? '—'}</div>
        }
        {sub && !loading && <p className={s.sub}>{sub}</p>}
      </div>
      {clickable && (
        <span className={s.viewHint} aria-hidden="true">
          ดูข้อมูลจริง
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
          </svg>
        </span>
      )}
    </div>
  )
}
