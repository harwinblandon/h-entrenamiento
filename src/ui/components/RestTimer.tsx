import { useEffect, useState } from 'react'

export interface TimerState {
  endsAt: number
}

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

export function RestTimer({ timer, onChange }: { timer: TimerState; onChange: (t: TimerState | null) => void }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const remaining = Math.max(0, Math.ceil((timer.endsAt - now) / 1000))
  const done = remaining === 0

  useEffect(() => {
    if (done) navigator.vibrate?.([200, 100, 200])
  }, [done])

  return (
    <div className={`timer ${done ? 'done' : ''}`} role="timer" aria-live="polite">
      <span style={{ fontSize: '0.8rem' }}>{done ? 'Descanso terminado' : 'Descanso'}</span>
      <span className="time">{fmt(remaining)}</span>
      {!done && (
        <button className="btn" onClick={() => onChange({ endsAt: timer.endsAt + 30_000 })}>
          +30 s
        </button>
      )}
      <button className="btn" onClick={() => onChange(null)}>
        {done ? 'Cerrar' : 'Omitir'}
      </button>
    </div>
  )
}
