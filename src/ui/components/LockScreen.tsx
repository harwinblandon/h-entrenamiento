import { useState, type FormEvent } from 'react'
import { LOGO_URL } from '../../brand'
import type { Profile } from '../../domain/types'
import { useActiveProfile } from '../activeProfile'

export function LockScreen({ profile }: { profile: Profile }) {
  const { unlock } = useActiveProfile()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const ok = await unlock(profile, pin)
    setError(!ok)
    if (!ok) setPin('')
  }

  return (
    <form className="card lock-screen stack-sm" onSubmit={submit}>
      <img src={LOGO_URL} alt="" className="lock-logo" />
      <h1 style={{ margin: 0 }}>{profile.name}</h1>
      <p className="muted" style={{ margin: 0 }}>
        Introduce tu clave para continuar.
      </p>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        maxLength={6}
        aria-label="Clave"
        className="pin-input"
        value={pin}
        onChange={(e) => {
          setPin(e.target.value.replace(/\D/g, ''))
          setError(false)
        }}
      />
      {error && <div className="alert danger">Clave incorrecta.</div>}
      <button className="btn primary block" type="submit" disabled={pin.length < 4}>
        Entrar
      </button>
    </form>
  )
}
