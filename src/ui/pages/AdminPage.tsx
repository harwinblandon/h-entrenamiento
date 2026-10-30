import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../../db/db'
import type { Member } from '../../db/syncEngine'
import type { FoodReport } from '../../domain/types'
import { useActiveProfile } from '../activeProfile'
import { useSync } from '../sync'
import { ProductForm } from './FoodDiary'

const DAY = 86_400_000

function relative(ms?: number): string {
  if (!ms) return '—'
  const days = Math.floor((Date.now() - ms) / DAY)
  if (days <= 0) {
    const hours = Math.floor((Date.now() - ms) / 3_600_000)
    return hours <= 0 ? 'hace un momento' : `hace ${hours} h`
  }
  return days === 1 ? 'ayer' : `hace ${days} días`
}

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export function AdminPage() {
  const { status, engine } = useSync()
  const [members, setMembers] = useState<Member[]>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const admin = !!status.isAdmin

  async function load() {
    if (!engine) return
    setLoading(true)
    setError(undefined)
    try {
      setMembers((await engine.listMembers()).sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la lista.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (admin && engine) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, engine])

  if (!admin) {
    return (
      <div className="card empty">
        Esta sección es solo para el administrador. Entra con la cuenta de administrador y verifica el correo en
        Personas → Cuenta en la nube.
      </div>
    )
  }

  const active7 = members?.filter((m) => m.lastSeenAt && Date.now() - m.lastSeenAt < 7 * DAY).length ?? 0
  const totalWorkouts = members?.reduce((n, m) => n + m.workouts, 0) ?? 0

  return (
    <div className="stack">
      <div className="spread">
        <div>
          <h1>Administración</h1>
          <small>Cuentas que usan la app con sincronización en la nube.</small>
        </div>
        <button className="btn small" onClick={() => void load()} disabled={loading}>
          {loading ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>

      {error && <div className="alert danger">{error}</div>}

      <div className="card grid-tight">
        <div className="stat">
          <span className="label">Cuentas registradas</span>
          <span className="value">{members?.length ?? '—'}</span>
        </div>
        <div className="stat">
          <span className="label">Activas en 7 días</span>
          <span className="value">{members ? active7 : '—'}</span>
        </div>
        <div className="stat">
          <span className="label">Sesiones registradas</span>
          <span className="value">{members ? totalWorkouts : '—'}</span>
          <span className="sub">Entre todas las cuentas</span>
        </div>
      </div>

      <FoodReports />

      <div className="card stack-sm">
        <h2>Cuentas</h2>
        {members && members.length === 0 && <p className="muted">Todavía no hay cuentas registradas.</p>}
        {members && members.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Correo</th>
                  <th className="hide-sm">Creada</th>
                  <th>Última conexión</th>
                  <th className="r">Sesiones</th>
                  <th className="r hide-sm">Personas</th>
                  <th className="r hide-sm">Comidas</th>
                  <th className="hide-sm">Último entrenamiento</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.uid}>
                    <td style={{ wordBreak: 'break-all' }}>
                      {m.email}
                      {m.email === status.email && <span className="badge accent" style={{ marginLeft: 6 }}>Tú</span>}
                    </td>
                    <td className="hide-sm">{fmtDate(m.createdAt)}</td>
                    <td>{relative(m.lastSeenAt)}</td>
                    <td className="r">{m.workouts}</td>
                    <td className="r hide-sm">{m.profiles}</td>
                    <td className="r hide-sm">{m.foodLogs}</td>
                    <td className="hide-sm">{fmtDate(m.lastWorkoutAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <small>
          Cada cuenta actualiza su resumen al abrir la app y al sincronizar. Las cuentas creadas antes de esta versión
          aparecen cuando vuelven a abrir la app. Aquí no se muestran sus entrenamientos, solo el resumen de uso.
        </small>
        <small>
          Para deshabilitar o eliminar una cuenta, usa la consola de Firebase:{' '}
          <a href="https://console.firebase.google.com/project/h-entrenamiento/authentication/users" target="_blank" rel="noreferrer">
            Authentication → Usuarios
          </a>
          .
        </small>
      </div>
    </div>
  )
}

/** Errores reportados en la lista común de productos: el administrador corrige y marca como resuelto. */
function FoodReports() {
  const { engine } = useSync()
  const { active } = useActiveProfile()
  const [reports, setReports] = useState<FoodReport[]>()
  const [error, setError] = useState<string>()
  const [editing, setEditing] = useState<string>()
  const shared = useLiveQuery(() => db.sharedFoods.toArray(), [])

  async function load() {
    if (!engine) return
    try {
      setReports(await engine.listFoodReports())
      setError(undefined)
    } catch {
      setError('No se pudieron cargar los reportes: revisa que las reglas de Firestore incluyan foodReports.')
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine])

  async function resolve(id: string) {
    await engine?.resolveFoodReport(id)
    setEditing(undefined)
    await load()
  }

  const fmt = (ms: number) => new Date(ms).toLocaleDateString('es', { day: 'numeric', month: 'short' })

  return (
    <div className="card stack-sm">
      <div className="spread">
        <h2>Reportes de productos</h2>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          {shared?.length ?? 0} productos en la lista común
        </span>
      </div>
      {error && <div className="alert warn">{error}</div>}
      {reports && reports.length === 0 && <p className="muted">No hay errores reportados.</p>}
      {reports?.map((r) => {
        const item = shared?.find((x) => x.id === r.foodId)
        return (
          <div key={r.id} className="stack-sm fat-box">
            <div className="spread">
              <strong>{r.foodName}</strong>
              <span className="muted" style={{ fontSize: '0.8rem' }}>
                {r.byName} · {fmt(r.at)}
              </span>
            </div>
            <span>«{r.message}»</span>
            {item ? (
              <span className="muted" style={{ fontSize: '0.8rem' }}>
                Ahora: {Math.round(item.per100.kcal)} kcal, P {item.per100.p} · G {item.per100.f} · C {item.per100.c} por 100 g
                {item.portion && ` · porción ${item.portion.label} (${item.portion.grams} g)`}
              </span>
            ) : (
              <span className="muted">El producto ya no está en la lista.</span>
            )}
            {editing === r.id && item && active ? (
              <ProductForm
                profile={active}
                editing={{ kind: 'shared', item }}
                onSaved={() => void resolve(r.id)}
                onCancel={() => setEditing(undefined)}
              />
            ) : (
              <div className="row">
                {item && (
                  <button type="button" className="btn small primary" onClick={() => setEditing(r.id)}>
                    Corregir
                  </button>
                )}
                <button type="button" className="btn small" onClick={() => void resolve(r.id)}>
                  Marcar como resuelto
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
