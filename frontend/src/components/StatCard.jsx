import s from './StatCard.module.css'

export default function StatCard({ icon, label, value, sub, color = 'accent', loading }) {
  return (
    <div className={`${s.card} ${s[color]}`}>
      <div className={`${s.iconWrap} ${s[`icon_${color}`]}`}>{icon}</div>
      <div className={s.body}>
        <p className={s.label}>{label}</p>
        {loading
          ? <div className={`skeleton ${s.skelVal}`} />
          : <div className={`${s.value} anim-up`}>{value ?? '—'}</div>
        }
        {sub && !loading && <p className={s.sub}>{sub}</p>}
      </div>
    </div>
  )
}
