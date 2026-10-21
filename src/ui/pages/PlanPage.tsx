import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { activePlan, db, savePlan } from '../../db/db'
import { getExercise, repRangeFor, restFor, substitutesFor } from '../../domain/exercises'
import { MUSCLE_LABELS } from '../../domain/labels'
import { computeVolume, generatePlan, weeklyTargets } from '../../domain/planGenerator'
import { evaluateSafety } from '../../domain/safety'
import type { Plan, Profile } from '../../domain/types'
import { MUSCLES } from '../../domain/types'
import { useActiveProfile } from '../activeProfile'
import { Explanations } from '../components/Explanations'

const fmtRest = (s: number) => (s >= 120 ? `${s / 60} min` : `${s} s`)

function rirSchedule(weeks: number): string[] {
  return [
    'Semana 1: RIR 3 (calibración / adaptación)',
    'Semana 2: RIR 2–3',
    `Semanas 3–${weeks}: RIR 1–2`,
    `Semana ${weeks}: aislamientos seguros pueden llegar a RIR 0–1`,
  ]
}

function VolumeTable({ plan }: { plan: Plan }) {
  const max = Math.max(...MUSCLES.map((m) => Math.max(plan.weeklyVolume[m].effective, plan.weeklyVolume[m].target)), 1)
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Músculo</th>
            <th className="r">Objetivo</th>
            <th className="r">Directas</th>
            <th className="r">Indirectas</th>
            <th className="r">Efectivas</th>
            <th style={{ width: '30%' }}></th>
          </tr>
        </thead>
        <tbody>
          {MUSCLES.map((m) => {
            const v = plan.weeklyVolume[m]
            if (v.effective === 0 && v.target === 0) return null
            return (
              <tr key={m}>
                <td>
                  {MUSCLE_LABELS[m]} {v.priority && <span className="badge accent">Prioridad</span>}
                </td>
                <td className="r">{v.target || '—'}</td>
                <td className="r">{v.direct}</td>
                <td className="r">{v.indirect}</td>
                <td className="r">
                  <strong>{v.effective}</strong>
                </td>
                <td>
                  <div className="bar" title={`${v.effective} de ${v.target}`}>
                    <span style={{ width: `${(v.effective / max) * 100}%` }} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
        Series efectivas = directas + 0.5 × indirectas. Los calentamientos no cuentan.
      </p>
    </div>
  )
}

function PlanView({ plan, profile }: { plan: Plan; profile: Profile }) {
  async function swap(sessionIdx: number, exIdx: number, newId: string) {
    const ex = getExercise(newId)
    const sessions = plan.sessions.map((s, i) =>
      i !== sessionIdx
        ? s
        : {
            ...s,
            exercises: s.exercises.map((pe, j) =>
              j !== exIdx ? pe : { ...pe, exerciseId: newId, repRange: repRangeFor(ex), restSec: restFor(ex) },
            ),
          },
    )
    const weeklyVolume = computeVolume(sessions, weeklyTargets(profile), profile.priorityMuscles)
    await db.plans.update(plan.id, { sessions, weeklyVolume })
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="grid-tight">
          <div className="stat">
            <span className="label">División</span>
            <span style={{ fontWeight: 600 }}>{plan.split}</span>
          </div>
          <div className="stat">
            <span className="label">Mesociclo</span>
            <span className="value">{plan.weeks} sem</span>
          </div>
          <div className="stat">
            <span className="label">Sesiones / semana</span>
            <span className="value">{plan.sessions.length}</span>
          </div>
          <div className="stat">
            <span className="label">Creado</span>
            <span style={{ fontWeight: 600 }}>{new Date(plan.createdAt).toLocaleDateString('es')}</span>
          </div>
        </div>
      </div>

      {plan.warnings.length > 0 && (
        <div className="alert warn">
          <strong>Avisos del plan</strong>
          <ul>
            {plan.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card stack-sm">
        <h2>Proximidad al fallo por semana</h2>
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {rirSchedule(plan.weeks).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      <div className="grid">
        {plan.sessions.map((s, si) => (
          <div className="card stack-sm" key={s.name}>
            <div className="spread">
              <h2 style={{ margin: 0 }}>
                Día {si + 1} · {s.name}
              </h2>
              <span className="badge">~{s.estimatedMinutes} min</span>
            </div>
            <small>{s.focus}</small>
            <div className="table-wrap">
              <table>
                <tbody>
                  {s.exercises.map((pe, ei) => {
                    const ex = getExercise(pe.exerciseId)
                    const subs = substitutesFor(pe.exerciseId, profile.equipment, profile.avoidExerciseIds)
                    return (
                      <tr key={`${pe.exerciseId}-${ei}`}>
                        <td>
                          <select
                            aria-label="Cambiar ejercicio"
                            value={pe.exerciseId}
                            onChange={(e) => swap(si, ei, e.target.value)}
                            style={{ minHeight: 34, padding: '0.25rem 0.4rem', fontSize: '0.88rem' }}
                          >
                            <option value={ex.id}>{ex.name}</option>
                            {subs.map((x) => (
                              <option key={x.id} value={x.id}>
                                ↳ {x.name}
                              </option>
                            ))}
                          </select>
                          <small>
                            {MUSCLE_LABELS[pe.muscle]}
                            {profile.priorityMuscles.includes(pe.muscle) && ' · prioridad'}
                          </small>
                        </td>
                        <td className="r" style={{ whiteSpace: 'nowrap' }}>
                          {pe.sets} × {pe.repRange[0]}–{pe.repRange[1]}
                          <br />
                          <small>{fmtRest(pe.restSec)}</small>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="card stack-sm">
        <h2>Volumen semanal por músculo</h2>
        <VolumeTable plan={plan} />
      </div>

      <div className="card stack-sm">
        <h2>¿Por qué este plan?</h2>
        <Explanations items={plan.explanations} />
      </div>
    </div>
  )
}

export function PlanPage() {
  const { active } = useActiveProfile()
  const plan = useLiveQuery(() => (active ? activePlan(active.id) : undefined), [active?.id])
  const logCount = useLiveQuery(() => (plan ? db.workouts.where('planId').equals(plan.id).count() : 0), [plan?.id])
  const [weeks, setWeeks] = useState(6)

  if (!active) {
    return (
      <div className="card empty">
        <p>Primero crea una persona.</p>
        <Link className="btn primary" to="/personas/nueva">
          Nueva persona
        </Link>
      </div>
    )
  }

  const safety = evaluateSafety(active.safety)

  async function generate() {
    if (!active) return
    if (plan && (logCount ?? 0) > 0 && !confirm('Se creará un mesociclo nuevo. El historial de entrenamientos se conserva. ¿Continuar?')) return
    await savePlan(generatePlan(active, { weeks }))
  }

  return (
    <div className="stack">
      <div className="spread">
        <h1>Plan de {active.name}</h1>
        <div className="row">
          <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} style={{ width: 'auto' }} aria-label="Semanas">
            {[6, 7, 8].map((w) => (
              <option key={w} value={w}>
                {w} semanas
              </option>
            ))}
          </select>
          <button className="btn primary" onClick={generate} disabled={!safety.canGenerate}>
            {plan ? 'Regenerar mesociclo' : 'Generar mesociclo'}
          </button>
        </div>
      </div>

      {!safety.canGenerate && (
        <div className="alert danger">
          <strong>Se requiere valoración profesional antes de generar el plan.</strong>
          <ul>
            {safety.flags.map((f) => (
              <li key={f.key}>{f.advice}</li>
            ))}
          </ul>
          <p style={{ marginTop: '0.5rem' }}>
            Cuando tengas la autorización, confírmala en la <Link to={`/personas/${active.id}`}>ficha</Link>.
          </p>
        </div>
      )}
      {safety.level === 'caution' && (
        <div className="alert warn">
          <ul>
            {safety.flags.map((f) => (
              <li key={f.key}>{f.advice}</li>
            ))}
          </ul>
        </div>
      )}

      {plan ? (
        <PlanView plan={plan} profile={active} />
      ) : (
        safety.canGenerate && (
          <div className="card empty">
            Aún no hay un mesociclo. Se generará a partir de la ficha: días, experiencia, equipamiento, prioridades,
            recuperación y tiempo disponible.
          </div>
        )
      )}
    </div>
  )
}
