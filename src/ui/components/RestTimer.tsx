import { useEffect, useRef, useState } from 'react'
import { loadTimerPrefs, playRestEnd, playWarning, saveTimerPrefs } from '../sound'

export interface TimerState {
  endsAt: number
}

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
const WARN_AT = 10

export function RestTimer({ timer, onChange }: { timer: TimerState; onChange: (t: TimerState | null) => void }) {
  const [now, setNow] = useState(() => Date.now())
  const [prefs, setPrefs] = useState(loadTimerPrefs)
  const warned = useRef(false)
  const total = useRef(Math.ceil((timer.endsAt - Date.now()) / 1000))

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  // Al sumar tiempo, el aviso previo vuelve a estar disponible.
  useEffect(() => {
    warned.current = false
  }, [timer.endsAt])

  const remaining = Math.max(0, Math.ceil((timer.endsAt - now) / 1000))
  const done = remaining === 0

  useEffect(() => {
    if (!prefs.sound || !prefs.warn || warned.current || total.current <= WARN_AT * 2) return
    if (remaining > 0 && remaining <= WARN_AT) {
      warned.current = true
      playWarning(prefs.volume)
    }
  }, [remaining, prefs])

  useEffect(() => {
    if (!done) return
    navigator.vibrate?.([200, 100, 200])
    if (prefs.sound) playRestEnd(prefs.volume)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  function toggleSound() {
    const next = { ...prefs, sound: !prefs.sound }
    setPrefs(next)
    saveTimerPrefs(next)
  }

  return (
    <div className={`timer ${done ? 'done' : ''}`} role="timer" aria-live="polite">
      <span style={{ fontSize: '0.8rem' }}>{done ? 'Descanso terminado' : 'Descanso'}</span>
      <span className="time">{fmt(remaining)}</span>
      <button className="btn" onClick={toggleSound} aria-pressed={prefs.sound} title={prefs.sound ? 'Silenciar' : 'Activar sonido'}>
        {prefs.sound ? '🔔' : '🔕'}
      </button>
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
