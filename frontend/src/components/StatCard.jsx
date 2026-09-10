import styles from './StatCard.module.css'

export default function StatCard({ icon, label, value, sub, color = 'accent', loading }) {
  return (
    <div className={`${styles.card} ${styles[color]}`}>
      <div className={`${styles.icon} ${styles[color]}`}>{icon}</div>
      <div className={styles.body}>
        <p className={styles.label}>{label}</p>
        {loading
          ? <div className={`skeleton ${styles.skeletonLine}`} />
          : <p className={`${styles.value} anim-up`}>{value ?? '—'}</p>
        }
        {sub && !loading && <p className={styles.sub}>{sub}</p>}
      </div>
    </div>
  )
}
