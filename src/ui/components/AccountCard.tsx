import { useState, type FormEvent } from 'react'
import { SYNC_LABELS, useSync } from '../sync'

const BADGE: Record<string, string> = { synced: 'accent', syncing: '', offline: 'warn', error: 'danger', 'signed-out': '' }

export function AccountCard() {
  const { enabled, status, engine } = useSync()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'info' | 'danger'; text: string }>()

  if (!enabled) return null

  async function run(action: () => Promise<void>, success?: string) {
    setBusy(true)
    setMessage(undefined)
    try {
      await action()
      if (success) setMessage({ kind: 'info', text: success })
    } catch (e) {
      setMessage({ kind: 'danger', text: e instanceof Error ? e.message : 'Algo salió mal.' })
    } finally {
      setBusy(false)
    }
  }

  if (status.state === 'signed-out') {
    const submit = (e: FormEvent) => {
      e.preventDefault()
      void run(() => engine!.signIn(email, password))
    }
    return (
      <form className="card stack-sm" id="cuenta" onSubmit={submit}>
        <h2>Cuenta en la nube</h2>
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          Entra con tu correo para guardar tus datos en la nube y verlos en cualquier celular o computador. La primera vez,
          lo que ya tienes en este dispositivo se sube a tu cuenta. Sin cuenta, la app sigue funcionando solo en este
          dispositivo.
        </p>
        <div className="grid-tight">
          <label className="field">
            Correo
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            Contraseña
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </label>
        </div>
        <div className="row">
          <button className="btn primary" type="submit" disabled={busy || !engine}>
            Entrar
          </button>
          <button
            className="btn"
            type="button"
            disabled={busy || !engine}
            onClick={() => void run(() => engine!.signUp(email, password))}
          >
            Crear cuenta
          </button>
          <button
            className="link-btn"
            type="button"
            disabled={busy || !engine}
            onClick={() =>
              email
                ? void run(() => engine!.resetPassword(email), 'Te enviamos un correo para restablecer la contraseña.')
                : setMessage({ kind: 'danger', text: 'Escribe tu correo para recuperar la contraseña.' })
            }
          >
            Olvidé mi contraseña
          </button>
        </div>
        {message && <div className={`alert ${message.kind}`}>{message.text}</div>}
      </form>
    )
  }

  async function signOut() {
    const warn =
      status.pending > 0
        ? `Hay ${status.pending} cambio(s) sin subir y se perderán. `
        : ''
    if (!confirm(`${warn}Al cerrar sesión se borran los datos de este dispositivo (siguen en tu cuenta). ¿Continuar?`)) return
    await run(() => engine!.signOutAndClear())
  }

  return (
    <div className="card stack-sm" id="cuenta">
      <div className="spread">
        <h2 style={{ margin: 0 }}>Cuenta en la nube</h2>
        <span className={`badge ${BADGE[status.state]}`}>{SYNC_LABELS[status.state]}</span>
      </div>
      <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.9rem' }}>
        <li>
          Sesión iniciada como <strong>{status.email}</strong>
        </li>
        <li>
          Cambios pendientes de subir: <strong>{status.pending}</strong>
        </li>
        <li>
          Última sincronización:{' '}
          <strong>{status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString('es') : '—'}</strong>
        </li>
      </ul>
      {status.state === 'offline' && (
        <div className="alert warn">Sin conexión: los cambios se guardan aquí y se subirán al volver internet.</div>
      )}
      {status.error && <div className="alert danger">No se pudo sincronizar: {status.error}</div>}
      <div className="row">
        <button className="btn" onClick={() => engine!.syncNow()} disabled={busy}>
          Sincronizar ahora
        </button>
        <button className="btn danger" onClick={() => void signOut()} disabled={busy}>
          Cerrar sesión
        </button>
      </div>
      <details>
        <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--muted)' }}>Eliminar cuenta</summary>
        <div className="stack-sm" style={{ marginTop: '0.5rem' }}>
          <small>
            Borra tu cuenta y todos tus datos de la nube y de este dispositivo. No se puede deshacer: descarga antes un
            respaldo si quieres conservarlos.
          </small>
          <button
            className="btn small danger"
            style={{ alignSelf: 'flex-start' }}
            disabled={busy}
            onClick={() => {
              if (confirm('¿Eliminar tu cuenta y todos tus datos? Esta acción no se puede deshacer.')) {
                void run(() => engine!.deleteAccountAndData())
              }
            }}
          >
            Eliminar mi cuenta y mis datos
          </button>
        </div>
      </details>
      {message && <div className={`alert ${message.kind}`}>{message.text}</div>}
    </div>
  )
}
