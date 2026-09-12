import { useState } from 'react'
import { api } from '../hooks/useApi'
import s from './RunButton.module.css'

const TASKS = [
  { key: 'pipeline', label: 'Pipeline', icon: '↺', fn: () => api.runPipeline() },
  { key: 'mpt',      label: 'MPT',      icon: '◈', fn: () => api.runMpt({ objective: 'max_sharpe' }) },
  { key: 'regime',   label: 'Regime',   icon: '⬡', fn: () => api.runRegime() },
]

// 'idle' | 'loading' | 'ok' | 'err'

export default function RunButton({ onDone }) {
  const [states,  setStates]  = useState({})
  const [errMsgs, setErrMsgs] = useState({})

  const run = async task => {
    setStates(p  => ({ ...p, [task.key]: 'loading' }))
    setErrMsgs(p => ({ ...p, [task.key]: null }))
    try {
      await task.fn()
      setStates(p => ({ ...p, [task.key]: 'ok' }))
      onDone?.()
      // reset to idle after 3s
      setTimeout(() => setStates(p => ({ ...p, [task.key]: 'idle' })), 3000)
    } catch (e) {
      const msg = e?.message ?? 'error'
      setStates(p  => ({ ...p, [task.key]: 'err' }))
      setErrMsgs(p => ({ ...p, [task.key]: msg }))
    }
  }

  return (
    <div className={s.wrap}>
      {TASKS.map(task => {
        const st  = states[task.key]  || 'idle'
        const err = errMsgs[task.key] || null

        return (
          <div key={task.key} className={s.item}>
            <button
              className={`${s.btn} ${s[st]}`}
              disabled={st === 'loading'}
              onClick={() => st === 'err' ? run(task) : run(task)}
              title={st === 'err' && err ? `Error: ${err} — คลิกเพื่อลองใหม่` : task.label}
            >
              {st === 'loading' ? (
                <span className="spinner" />
              ) : (
                <span className={s.btnIcon}>{task.icon}</span>
              )}
              <span>{task.label}</span>
              {st === 'ok'  && <span className={s.check}>✓</span>}
              {st === 'err' && <span className={s.errIcon}>↺</span>}
            </button>

            {st === 'err' && err && (
              <div className={s.errMsg} title={err}>
                {err.length > 40 ? err.slice(0, 40) + '…' : err}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
