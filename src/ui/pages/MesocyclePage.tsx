import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { activePlan, db, saveNextCycle } from '../../db/db'
import { MUSCLE_LABELS } from '../../domain/labels'
import {
  createDeloadPlan,
  createNextPlan,
  reviewMesocycle,
  type ExerciseTrend,
  type MesocycleReview,
  type MuscleReview,
} from '../../domain/mesocycle'
import { evaluateSafety } from '../../domain/safety'
import type { Muscle, Plan, Profile } from '../../domain/types'
import { useActiveProfile } from '../activeProfile'

const TREND: Record<ExerciseTrend, { label: string; badge: string }> = {
  progressed: { label: 'Progresó', badge: 'accent' },
  stalled: { label: 'Estancado', badge: 'warn' },
  regressed: { label: 'A la baja', badge: 'danger' },
  insufficient: { label: 'Pocos datos', badge: '' },
}

const MUSCLE_TREND: Record<MuscleReview['trend'], string> = {
  progressing: 'Progresa',
  stalled: 'Estancado',
  regressed: 'A la baja',
  no_data: 'Sin datos',
}

function Review({ plan, profile, review }: { plan: Plan; profile: Profile; review: MesocycleReview }) {
  const navigate = useNavigate()
  const [deload, setDeload] = useState(review.deloadRecommended)
  const [weeks, setWeeks] = useState(plan.weeks)
  const [delta, setDelta] = useState<Partial<Record<Muscle, number>>>(
    Object.fromEntries(review.muscles.map((m) => [m.muscle, m.proposedDelta])),
  )
  const [swaps, setSwaps] = useState<Record<string, string>>(
    Object.fromEntries(review.swaps.filter((s) => s.recommended && s.alternatives.length).map((s) => [s.exerciseId, s.alternatives[0].id])),
  )
  const [showAllSwaps, setShowAllSwaps] = useState(false)
  const recommendedSwaps = review.swaps.filter((s) => s.recommended)
  const visibleSwaps = showAllSwaps ? review.swaps : recommendedSwaps
  const canGenerate = evaluateSafety(profile.safety).canGenerate
  const active = review.signals.filter((s) => s.active).length

  async function create() {
    const chosenSwaps = Object.fromEntries(Object.entries(swaps).filter(([, to]) => to !== 'keep'))
    const next = createNextPlan(profile, review, { weeks, volumeDelta: delta, swaps: chosenSwaps })
    await saveNextCycle(next, deload ? createDeloadPlan(plan) : undefined)
    navigate('/plan')
  }

  return (
    <div className="stack">
      <div>
        <h1>Cierre del mesociclo</h1>
        <small>
          {plan.split} · {plan.weeks} semanas
        </small>
      </div>

      <div className="card grid-tight">
        <div className="stat">
          <span className="label">Sesiones</span>
          <span className="value">
            {review.sessionsDone} / {review.sessionsTotal}
          </span>
        </div>
        <div className="stat">
          <span className="label">Series completadas</span>
          <span className="value">{review.compliancePct !== undefined ? `${review.compliancePct} %` : '—'}</span>
        </div>
        <div className="stat">
          <span className="label">Fatiga media</span>
          <span className="value">{review.avgFatigue !== undefined ? `${review.avgFatigue} / 5` : '—'}</span>
          <span className="sub">Última semana: {review.lastWeekFatigue ?? '—'}</span>
        </div>
        <div className="stat">
          <span className="label">Recuperación</span>
          <span className="value">{review.recoveryOk ? 'Buena' : 'Comprometida'}</span>
          <span className="sub">{review.reducedDays} días con menos energía</span>
        </div>
      </div>

      <div className="cols-2">
        <div className="card stack-sm">
          <h2>Rendimiento por ejercicio</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ejercicio</th>
                  <th className="r hide-sm">Sesiones</th>
                  <th className="r">Cambio</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {review.exercises
                  .filter((e) => e.exposures > 0)
                  .map((e) => (
                    <tr key={e.exerciseId}>
                      <td>
                        {e.name}
                        <br />
                        <small>{MUSCLE_LABELS[e.muscle]}</small>
                      </td>
                      <td className="r hide-sm">{e.exposures}</td>
                      <td className="r">{e.changePct !== undefined ? `${e.changePct > 0 ? '+' : ''}${e.changePct} %` : '—'}</td>
                      <td>
                        <span className={`badge ${TREND[e.trend].badge}`}>{TREND[e.trend].label}</span>
                        {e.painSessions > 0 && <span className="badge danger" style={{ marginLeft: 4 }}>Dolor</span>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <small>
            Cambio del 1RM estimado (o de repeticiones si no hay carga) entre la primera y la última sesión. «Estancado»: tres o
            más sesiones recientes sin superar lo conseguido antes.
          </small>
        </div>

        <div className="card stack-sm">
          <h2>Señales de fatiga</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="stack-sm">
            {review.signals.map((s) => (
              <li key={s.id} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <span className={`badge ${s.active ? 'warn' : ''}`} style={{ minWidth: 28, textAlign: 'center' }}>
                  {s.active ? '!' : '✓'}
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>{s.label}</div>
                  <small>{s.detail}</small>
                </div>
              </li>
            ))}
          </ul>
          <div className={`alert ${review.deloadRecommended ? 'warn' : 'info'}`}>
            {review.deloadRecommended
              ? `${active} señales activas: se recomienda una semana de descarga antes del siguiente mesociclo.`
              : `${active} señal(es) activa(s): la descarga es opcional. Puedes empezar el siguiente mesociclo directamente.`}
          </div>
        </div>
      </div>

      <h2 style={{ marginTop: '0.5rem' }}>Propuesta para el siguiente mesociclo</h2>

      <div className="cols-2">
        <div className="card stack-sm">
          <h2>Volumen por músculo</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Músculo</th>
                  <th className="r">Actual</th>
                  <th>Cambio</th>
                </tr>
              </thead>
              <tbody>
                {review.muscles.map((m) => (
                  <tr key={m.muscle}>
                    <td>
                      {MUSCLE_LABELS[m.muscle]} <span className="badge">{MUSCLE_TREND[m.trend]}</span>
                      <br />
                      <small>{m.reason}</small>
                    </td>
                    <td className="r">{m.target}</td>
                    <td>
                      <select
                        aria-label={`Cambio de series para ${MUSCLE_LABELS[m.muscle]}`}
                        value={delta[m.muscle] ?? 0}
                        onChange={(e) => setDelta({ ...delta, [m.muscle]: Number(e.target.value) })}
                        style={{ width: 'auto', minHeight: 34, padding: '0.2rem 0.4rem' }}
                      >
                        {[-2, 0, 2].map((d) => (
                          <option key={d} value={d}>
                            {d > 0 ? `+${d}` : d === 0 ? 'Igual' : d}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="stack">
          <div className="card stack-sm">
            <h2>Ejercicios</h2>
            {review.swaps.length === 0 && (
              <p className="muted">Ningún ejercicio estancado ni con dolor: se mantienen los que progresaron.</p>
            )}
            {review.swaps.length > 0 && recommendedSwaps.length === 0 && !showAllSwaps && (
              <p className="muted" style={{ margin: 0 }}>
                {review.swaps.length} ejercicios sin progreso, pero con la fatiga actual lo más probable es que se deba a ella:
                se mantienen. Si aun así quieres cambiar alguno, despliega la lista.
              </p>
            )}
            {visibleSwaps.map((s) => (
                <label className="field" key={s.exerciseId}>
                  {s.name}
                  <span className="hint">{s.reason}</span>
                  <select value={swaps[s.exerciseId] ?? 'keep'} onChange={(e) => setSwaps({ ...swaps, [s.exerciseId]: e.target.value })}>
                    <option value="keep">Mantener {s.name}</option>
                    {s.alternatives.map((a) => (
                      <option key={a.id} value={a.id}>
                        Cambiar por {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            {review.swaps.length > recommendedSwaps.length && (
              <button type="button" className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => setShowAllSwaps(!showAllSwaps)}>
                {showAllSwaps ? 'Ver solo los recomendados' : `Ver los ${review.swaps.length - recommendedSwaps.length} que se mantienen`}
              </button>
            )}
            <small>Los ejercicios que progresaron se conservan para no romper la comparación de cargas.</small>
          </div>

          <div className="card stack-sm">
            <h2>Prioridades</h2>
            <p style={{ margin: 0, fontSize: '0.92rem' }}>
              Actuales: {profile.priorityMuscles.length ? profile.priorityMuscles.map((m) => MUSCLE_LABELS[m]).join(', ') : 'ninguna'}.
              {profile.priorityMuscles.length > 3 && ' Son más de 3: considera rotar alguna a este nuevo mesociclo.'}
            </p>
            <small>
              Si quieres rotarlas, cámbialas en la <Link to={`/personas/${profile.id}`}>ficha</Link> antes de crear el mesociclo.
            </small>
          </div>

          <div className="card stack-sm">
            <h2>Cómo continuar</h2>
            <label className="check">
              <input type="checkbox" checked={deload} onChange={(e) => setDeload(e.target.checked)} />
              <span>
                Hacer primero una <strong>semana de descarga</strong> (~40 % menos series, ~90 % de la carga, RIR 3–5)
                {review.deloadRecommended ? ' — recomendada' : ' — opcional'}
              </span>
            </label>
            <label className="field">
              Duración del siguiente mesociclo
              <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
                {[4, 5, 6, 7, 8].map((w) => (
                  <option key={w} value={w}>
                    {w} semanas
                  </option>
                ))}
              </select>
            </label>
            <button className="btn primary" onClick={create} disabled={!canGenerate}>
              {deload ? 'Empezar la descarga y preparar el mesociclo' : 'Crear el siguiente mesociclo'}
            </button>
            {!canGenerate && <small>Se requiere autorización profesional en la ficha antes de generar un plan nuevo.</small>}
          </div>
        </div>
      </div>
    </div>
  )
}

export function MesocyclePage() {
  const { active } = useActiveProfile()
  const plan = useLiveQuery(async () => (active ? ((await activePlan(active.id)) ?? null) : null), [active?.id])
  const logs = useLiveQuery(() => (active ? db.workouts.where('profileId').equals(active.id).toArray() : []), [active?.id])

  if (!active) return <div className="card empty">Primero crea o selecciona una persona.</div>
  if (plan === undefined || !logs) return <div className="empty">Cargando…</div>
  if (!plan || plan.kind === 'deload') {
    return (
      <div className="card empty">
        <p>{plan ? 'Estás en una semana de descarga: el cierre se hace al terminar un mesociclo.' : 'No hay un mesociclo activo.'}</p>
        <Link className="btn primary" to="/plan">
          Ir al plan
        </Link>
      </div>
    )
  }
  return <Review plan={plan} profile={active} review={reviewMesocycle(plan, logs, active)} />
}
