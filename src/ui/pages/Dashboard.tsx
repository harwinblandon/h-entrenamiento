import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { activePlan, db } from '../../db/db'
import { EXPERIENCE_LABELS, GOAL_LABELS } from '../../domain/labels'
import { computeNutrition } from '../../domain/nutrition'
import { evaluateSafety } from '../../domain/safety'
import { latestWeight, nextSession, todayISO, weightTrend } from '../../domain/schedule'
import type { BodyLog, Profile } from '../../domain/types'
import { useActiveProfile } from '../activeProfile'

function BodyLogCard({ profile, logs }: { profile: Profile; logs: BodyLog[] }) {
  const today = todayISO()
  const todays = logs.find((l) => l.date === today)
  const [weight, setWeight] = useState(todays?.weightKg?.toString() ?? '')
  const [waist, setWaist] = useState(todays?.waistCm?.toString() ?? '')
  const trend = weightTrend(logs)
  const recent = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)

  async function save() {
    const entry: BodyLog = {
      id: todays?.id ?? crypto.randomUUID(),
      profileId: profile.id,
      date: today,
      weightKg: weight === '' ? undefined : Number(weight),
      waistCm: waist === '' ? undefined : Number(waist),
    }
    await db.bodyLogs.put(entry)
  }

  return (
    <div className="card stack-sm">
      <h2>Peso y cintura</h2>
      <div className="grid-tight">
        <div className="stat">
          <span className="label">Promedio 7 días</span>
          <span className="value">{trend.current !== undefined ? `${trend.current.toFixed(1)} kg` : '—'}</span>
          <span className="sub">
            {trend.changePct !== undefined
              ? `${trend.changePct >= 0 ? '+' : ''}${trend.changePct.toFixed(2)} % vs semana anterior`
              : 'Necesita 2 semanas de registros'}
          </span>
        </div>
      </div>
      <div className="grid-tight">
        <label className="field">
          Peso hoy (kg, en ayunas)
          <input type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label className="field">
          Cintura (cm, opcional)
          <input type="number" inputMode="decimal" step="0.1" value={waist} onChange={(e) => setWaist(e.target.value)} />
        </label>
      </div>
      <button className="btn" onClick={save} disabled={weight === '' && waist === ''}>
        {todays ? 'Actualizar registro de hoy' : 'Guardar registro de hoy'}
      </button>
      {recent.length > 0 && (
        <table>
          <tbody>
            {recent.map((l) => (
              <tr key={l.id}>
                <td>{new Date(`${l.date}T12:00:00`).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                <td className="r">{l.weightKg !== undefined ? `${l.weightKg} kg` : '—'}</td>
                <td className="r">{l.waistCm !== undefined ? `${l.waistCm} cm` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function Dashboard() {
  const { profiles, active } = useActiveProfile()
  const plan = useLiveQuery(async () => (active ? ((await activePlan(active.id)) ?? null) : null), [active?.id])
  const workouts = useLiveQuery(() => (active ? db.workouts.where('profileId').equals(active.id).toArray() : []), [active?.id])
  const bodyLogs = useLiveQuery(() => (active ? db.bodyLogs.where('profileId').equals(active.id).toArray() : []), [active?.id])

  if (profiles && profiles.length === 0) {
    return (
      <div className="card empty stack-sm" style={{ alignItems: 'center' }}>
        <h1>Bienvenido a Atlas</h1>
        <p>Crea la ficha de la primera persona para generar su plan de hipertrofia.</p>
        <Link className="btn primary" to="/personas/nueva">
          Nueva persona
        </Link>
      </div>
    )
  }
  if (!active || plan === undefined || !workouts || !bodyLogs) return <div className="empty">Cargando…</div>

  const safety = evaluateSafety(active.safety)
  const next = plan ? nextSession(plan, workouts) : null
  const finished = plan ? workouts.filter((w) => w.planId === plan.id && w.finishedAt).length : 0
  const nutrition = computeNutrition(active, latestWeight(bodyLogs) ?? active.weightKg)

  return (
    <div className="stack">
      <div>
        <h1>Hola, {active.name}</h1>
        <div className="row">
          <span className="badge">{EXPERIENCE_LABELS[active.experience]}</span>
          <span className="badge">{GOAL_LABELS[active.goal]}</span>
          {active.status === 'calibration' && <span className="badge accent">Fase de calibración</span>}
        </div>
      </div>

      {safety.level !== 'ok' && (
        <div className={`alert ${safety.level === 'clearance_required' ? 'danger' : 'warn'}`}>
          <ul>
            {safety.flags.map((f) => (
              <li key={f.key}>{f.advice}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid">
        <div className="card stack-sm">
          <h2>Entrenamiento de hoy</h2>
          {!plan && (
            <>
              <p className="muted">Aún no hay un mesociclo.</p>
              <Link className="btn primary" to="/plan">
                Generar plan
              </Link>
            </>
          )}
          {plan && !next && (
            <>
              <p>Mesociclo completado.</p>
              <Link className="btn primary" to="/plan">
                Generar el siguiente
              </Link>
            </>
          )}
          {plan && next && (
            <>
              <div className="stat">
                <span className="value">{plan.sessions[next.sessionIndex].name}</span>
                <span className="sub">
                  Semana {next.week} de {plan.weeks} · {plan.sessions[next.sessionIndex].exercises.length} ejercicios · ~
                  {plan.sessions[next.sessionIndex].estimatedMinutes} min
                </span>
              </div>
              <div className="bar" title="Progreso del mesociclo">
                <span style={{ width: `${(finished / (plan.weeks * plan.sessions.length)) * 100}%` }} />
              </div>
              <small>
                {finished} de {plan.weeks * plan.sessions.length} sesiones del mesociclo
              </small>
              <Link className="btn primary" to="/entrenar">
                {next.inProgress ? 'Continuar sesión' : 'Empezar'}
              </Link>
            </>
          )}
        </div>

        <BodyLogCard key={active.id} profile={active} logs={bodyLogs} />

        {!nutrition.hidden && (
          <div className="card stack-sm">
            <h2>Nutrición diaria sugerida</h2>
            <div className="stat">
              <span className="value">{nutrition.targetKcal.toLocaleString('es')} kcal</span>
              <span className="sub">Estimación inicial · {GOAL_LABELS[active.goal]}</span>
            </div>
            <table>
              <tbody>
                <tr>
                  <td>Proteína</td>
                  <td className="r">{nutrition.proteinG} g</td>
                </tr>
                <tr>
                  <td>Grasas</td>
                  <td className="r">{nutrition.fatG} g</td>
                </tr>
                <tr>
                  <td>Carbohidratos</td>
                  <td className="r">{nutrition.carbsG} g</td>
                </tr>
              </tbody>
            </table>
            <Link to="/nutricion">Ver detalle y explicación</Link>
          </div>
        )}
      </div>
    </div>
  )
}
