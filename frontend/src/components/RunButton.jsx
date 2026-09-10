import { useState } from 'react'
import { api } from '../hooks/useApi'
import styles from './RunButton.module.css'

const TASKS = [
  { key: 'pipeline', label: 'รัน Pipeline',   icon: '🔄', fn: () => api.runPipeline() },
  { key: 'mpt',      label: 'รัน MPT',        icon: '💼', fn: () => api.runMpt({ objective: 'max_sharpe' }) },
  { key: 'regime',   label: 'รัน Regime',     icon: '🧠', fn: () => api.runRegime() },
]

export default function RunButton({ onDone }) {
  const [states, setStates] = useState({})   // { key: 'idle'|'loading'|'ok'|'err' }

  const run = async (task) => {
    setStates(s => ({ ...s, [task.key]: 'loading' }))
    try {
      await task.fn()
      setStates(s => ({ ...s, [task.key]: 'ok' }))
      onDone?.()
    } catch {
      setStates(s => ({ ...s, [task.key]: 'err' }))
    }
  }

  return (
    <div className={styles.row}>
      {TASKS.map(task => {
        const st = states[task.key] || 'idle'
        return (
          <button
            key={task.key}
            className={`btn btn-ghost ${styles.btn} ${styles[st]}`}
            disabled={st === 'loading'}
            onClick={() => run(task)}
          >
            {st === 'loading'
              ? <span className="spinner" />
              : <span>{task.icon}</span>
            }
            {task.label}
            {st === 'ok'  && <span className={styles.check}>✓</span>}
            {st === 'err' && <span className={styles.x}>✗</span>}
          </button>
        )
      })}
    </div>
  )
}
