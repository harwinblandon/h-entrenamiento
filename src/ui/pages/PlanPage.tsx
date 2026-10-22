import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { activePlan, db, savePlan } from '../../db/db'
import { getSource } from '../../domain/evidence'
import { EXERCISES, getExercise, isAvailable, repRangeFor, restFor, substitutesFor } from '../../domain/exercises'
import { MUSCLE_LABELS } from '../../domain/labels'
import { planSnapshot } from '../../domain/planChanges'
import { computeVolume, estimateMinutes, weeklyTargets } from '../../domain/planGenerator'
import { reviewPlan, type Finding } from '../../domain/planReview'
import { evaluateSafety } from '../../domain/safety'
import type { MuscleVolume, Plan, PlannedExercise, PlannedSession, Profile } from '../../domain/types'
import { MUSCLES } from '../../domain/types'
import { useActiveProfile } from '../activeProfile'
import { ExerciseIllustration } from '../components/ExerciseIllustration'
import { ConfidenceBadge, Explanations } from '../components/Explanations'
import { PlanChangesAlert, regeneratePlan } from '../components/PlanChangesAlert'

const fmtRest = (s: number) => (s >= 120 ? `${s / 60} min` : `${s} s`)
const REST_OPTIONS = [60, 75, 90, 120, 150, 180, 240]

function rirSchedule(weeks: number): string[] {
  return [
    'Semana 1: RIR 3 (calibración / adaptación)',
    'Semana 2: RIR 2–3',
    `Semanas 3–${weeks}: RIR 1–2`,
    `Semana ${weeks}: aislamientos seguros pueden llegar a RIR 0–1`,
  ]
}

/** Estado de cada músculo frente a su propio objetivo (±1 serie de tolerancia; +3 o más es "por encima"). */
function volumeStatus(v: MuscleVolume): { label: string; badge: string; fill: number } {
  if (v.target === 0) return { label: v.effective > 0 ? 'Indirecto' : 'Sin trabajo', badge: '', fill: 0 }
  const fill = Math.min(v.effective / v.target, 1) * 100
  if (v.effective < v.target - 1) return { label: 'Por debajo', badge: 'warn', fill }
  if (v.effective >= v.target + 3) return { label: 'Por encima', badge: '', fill }
  return { label: 'En objetivo', badge: 'accent', fill }
}

function VolumeTable({ plan }: { plan: Plan }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Músculo</th>
            <th className="r">Objetivo</th>
            <th className="r hide-sm">Directas</th>
            <th className="r hide-sm">Indirectas</th>
            <th className="r">Efectivas</th>
            <th style={{ width: '28%' }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {MUSCLES.map((m) => {
            const v = plan.weeklyVolume[m]
            if (!v || (v.effective === 0 && v.target === 0)) return null
            const status = volumeStatus(v)
            return (
              <tr key={m}>
                <td>
                  {MUSCLE_LABELS[m]} {v.priority && <span className="badge accent">Prioridad</span>}
                </td>
                <td className="r">{v.target || '—'}</td>
                <td className="r hide-sm">{v.direct}</td>
                <td className="r hide-sm">{v.indirect}</td>
                <td className="r">
                  <strong>{v.effective}</strong>
                </td>
                <td>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    {v.target > 0 && (
                      <div className={`bar hide-sm ${status.badge === 'warn' ? 'warn' : ''}`} style={{ flex: 1 }} title={`${v.effective} de ${v.target}`}>
                        <span style={{ width: `${status.fill}%` }} />
                      </div>
                    )}
                    <span className={`badge ${status.badge}`}>{status.label}</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
        Series efectivas = directas + 0.5 × indirectas. Los calentamientos no cuentan. Cada barra se mide contra el
        objetivo de ese músculo: llena significa objetivo cumplido. Es lo que el plan prescribe, no lo que has entrenado.
      </p>
    </div>
  )
}

const LEVEL: Record<Finding['level'], { badge: string; label: string }> = {
  warn: { badge: 'warn', label: 'Revisar' },
  info: { badge: '', label: 'Nota' },
  ok: { badge: 'accent', label: 'Bien' },
}

/** Recomendaciones según la evidencia: informan, la persona decide. */
function PlanReviewPanel({ findings }: { findings: Finding[] }) {
  return (
    <div className="card stack-sm">
      <div className="spread">
        <h2 style={{ margin: 0 }}>Revisión basada en evidencia</h2>
        <small>Recomendaciones, no reglas: tú decides.</small>
      </div>
      <ul className="findings">
        {findings.map((f) => (
          <li key={f.id}>
            <span className={`badge ${LEVEL[f.level].badge}`}>{LEVEL[f.level].label}</span>
            <div>
              <div className="row" style={{ gap: '0.4rem' }}>
                <strong>{f.title}</strong>
                <ConfidenceBadge level={f.confidence} />
              </div>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.9rem' }}>{f.text}</p>
              {f.sourceIds.length > 0 && (
                <small>
                  Fuente:{' '}
                  {f.sourceIds.map((id, i) => (
                    <span key={id}>
                      {i > 0 && '; '}
                      <Link to={`/evidencia#${id}`}>{getSource(id)?.citation.split('.')[0] ?? id}</Link>
                    </span>
                  ))}
                </small>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AddExercise({ profile, onAdd }: { profile: Profile; onAdd: (exerciseId: string) => void }) {
  const available = EXERCISES.filter((e) => isAvailable(e, profile.equipment))
  return (
    <select
      aria-label="Agregar ejercicio"
      value=""
      onChange={(e) => e.target.value && onAdd(e.target.value)}
      style={{ minHeight: 36, fontSize: '0.88rem' }}
    >
      <option value="">+ Agregar ejercicio…</option>
      {MUSCLES.map((m) => {
        const list = available.filter((e) => e.primary[0] === m)
        if (!list.length) return null
        return (
          <optgroup key={m} label={MUSCLE_LABELS[m]}>
            {list.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
                {profile.avoidExerciseIds.includes(e.id) ? ' (en tu lista a evitar)' : ''}
              </option>
            ))}
          </optgroup>
        )
      })}
    </select>
  )
}

function ExerciseEditRow({
  pe,
  first,
  last,
  profile,
  onChange,
  onMove,
  onRemove,
}: {
  pe: PlannedExercise
  first: boolean
  last: boolean
  profile: Profile
  onChange: (pe: PlannedExercise) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const ex = getExercise(pe.exerciseId)
  const subs = substitutesFor(pe.exerciseId, profile.equipment)
  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || min)))
  return (
    <div className="edit-row">
      <div className="spread" style={{ flexWrap: 'nowrap', gap: '0.4rem' }}>
        <select
          aria-label="Cambiar ejercicio"
          value={pe.exerciseId}
          onChange={(e) => {
            const nx = getExercise(e.target.value)
            onChange({ ...pe, exerciseId: nx.id, muscle: nx.primary[0], repRange: repRangeFor(nx, profile.repPreference), restSec: restFor(nx, profile.experience) })
          }}
          style={{ minHeight: 34, padding: '0.25rem 0.4rem', fontSize: '0.88rem' }}
        >
          <option value={ex.id}>{ex.name}</option>
          {subs.map((x) => (
            <option key={x.id} value={x.id}>
              ↳ {x.name}
            </option>
          ))}
        </select>
        <div className="row" style={{ flexWrap: 'nowrap', gap: '0.25rem' }}>
          <button type="button" className="btn small icon-btn" aria-label="Subir" disabled={first} onClick={() => onMove(-1)}>
            ↑
          </button>
          <button type="button" className="btn small icon-btn" aria-label="Bajar" disabled={last} onClick={() => onMove(1)}>
            ↓
          </button>
          <button type="button" className="btn small icon-btn danger" aria-label="Quitar ejercicio" onClick={onRemove}>
            ✕
          </button>
        </div>
      </div>
      <div className="edit-fields">
        <label>
          Series
          <input type="number" inputMode="numeric" min={1} max={10} value={pe.sets} onChange={(e) => onChange({ ...pe, sets: num(e.target.value, 1, 10) })} />
        </label>
        <label>
          Reps mín.
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            value={pe.repRange[0]}
            onChange={(e) => {
              const lo = num(e.target.value, 1, 50)
              onChange({ ...pe, repRange: [lo, Math.max(lo, pe.repRange[1])] })
            }}
          />
        </label>
        <label>
          Reps máx.
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            value={pe.repRange[1]}
            onChange={(e) => {
              const hi = num(e.target.value, 1, 60)
              onChange({ ...pe, repRange: [Math.min(pe.repRange[0], hi), hi] })
            }}
          />
        </label>
        <label>
          Descanso
          <select value={pe.restSec} onChange={(e) => onChange({ ...pe, restSec: Number(e.target.value) })}>
            {[...new Set([...REST_OPTIONS, pe.restSec])].sort((a, b) => a - b).map((r) => (
              <option key={r} value={r}>
                {fmtRest(r)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}

function PlanView({ plan, profile, editing }: { plan: Plan; profile: Profile; editing: boolean }) {
  const banner =
    plan.kind === 'deload' ? (
      <div className="alert info">
        <strong>Semana de descarga.</strong> Mismos ejercicios con ~40 % menos series, ~90 % de la carga y RIR 3–5. Al
        terminarla empieza el siguiente mesociclo, ya preparado.
      </div>
    ) : plan.adjustments?.length ? (
      <div className="alert info">
        <strong>Ajustes desde el mesociclo anterior</strong>
        <ul>
          {plan.adjustments.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>
    ) : null

  /** Guarda las sesiones recalculando duración y volumen; el plan queda como personalizado. */
  async function saveSessions(next: PlannedSession[], custom = true) {
    const withTime = next.map((s) => ({ ...s, estimatedMinutes: estimateMinutes(s.exercises) }))
    const weeklyVolume = computeVolume(withTime, weeklyTargets(profile), profile.priorityMuscles)
    await db.plans.update(plan.id, { sessions: withTime, weeklyVolume, ...(custom ? { custom: true } : {}) })
  }

  // Al editar se trabaja sobre un borrador en memoria: la pantalla responde al instante y los cambios
  // se guardan agrupados poco después (y al pulsar «Listo»), sin que una escritura pise a otra.
  const [draft, setDraft] = useState<PlannedSession[] | null>(null)
  const dirty = useRef(false)
  const saveRef = useRef(saveSessions)
  saveRef.current = saveSessions
  const latestDraft = useRef(draft)
  latestDraft.current = draft

  useEffect(() => {
    if (editing && !draft) setDraft(plan.sessions)
    if (!editing && draft) {
      if (dirty.current) void saveRef.current(draft)
      dirty.current = false
      setDraft(null)
    }
  }, [editing, draft, plan.sessions])

  useEffect(() => {
    if (!draft || !dirty.current) return
    const t = setTimeout(() => {
      dirty.current = false
      void saveRef.current(draft)
    }, 400)
    return () => clearTimeout(t)
  }, [draft])

  // Guardar lo pendiente si se sale de la página a mitad de una edición.
  useEffect(
    () => () => {
      if (dirty.current && latestDraft.current) void saveRef.current(latestDraft.current)
    },
    [],
  )

  const sessions = editing && draft ? draft : plan.sessions

  const updateSession = (si: number, fn: (s: PlannedSession) => PlannedSession) => {
    dirty.current = true
    setDraft((prev) =>
      (prev ?? plan.sessions).map((s, i) => {
        if (i !== si) return s
        const next = fn(s)
        return { ...next, estimatedMinutes: estimateMinutes(next.exercises) }
      }),
    )
  }

  const updateExercise = (si: number, ei: number, pe: PlannedExercise) =>
    updateSession(si, (s) => ({ ...s, exercises: s.exercises.map((x, j) => (j === ei ? pe : x)) }))

  function move(si: number, ei: number, dir: -1 | 1) {
    updateSession(si, (s) => {
      const exercises = [...s.exercises]
      ;[exercises[ei], exercises[ei + dir]] = [exercises[ei + dir], exercises[ei]]
      return { ...s, exercises }
    })
  }

  function addExercise(si: number, exerciseId: string) {
    const ex = getExercise(exerciseId)
    const pe: PlannedExercise = {
      exerciseId,
      muscle: ex.primary[0],
      sets: 3,
      repRange: repRangeFor(ex, profile.repPreference),
      restSec: restFor(ex, profile.experience),
    }
    updateSession(si, (s) => ({ ...s, exercises: [...s.exercises, pe] }))
  }

  function addDay() {
    dirty.current = true
    setDraft((prev) => {
      const base = prev ?? plan.sessions
      return [...base, { name: `Día ${base.length + 1}`, focus: 'Personalizado', exercises: [], estimatedMinutes: 0 }]
    })
  }

  function removeDay(si: number) {
    if (sessions.length <= 1) return
    if (!confirm(`¿Quitar «${sessions[si].name}» del plan? El historial de entrenamientos se conserva.`)) return
    dirty.current = true
    setDraft((prev) => (prev ?? plan.sessions).filter((_, i) => i !== si))
  }

  /** En modo vista, cambiar por un equivalente se guarda al momento y no marca el plan como personalizado. */
  function swapInView(si: number, ei: number, newId: string) {
    const nx = getExercise(newId)
    void saveSessions(
      plan.sessions.map((x, i) =>
        i !== si
          ? x
          : {
              ...x,
              exercises: x.exercises.map((y, j) =>
                j === ei ? { ...y, exerciseId: nx.id, repRange: repRangeFor(nx, profile.repPreference), restSec: restFor(nx, profile.experience) } : y,
              ),
            },
      ),
      false,
    )
  }

  const findings = reviewPlan(sessions, profile)

  return (
    <div className="stack">
      {banner}
      <div className="card">
        <div className="grid-tight">
          <div className="stat">
            <span className="label">División</span>
            <span style={{ fontWeight: 600 }}>
              {plan.split} {plan.custom && <span className="badge accent">Personalizado</span>}
            </span>
          </div>
          <div className="stat">
            <span className="label">Mesociclo</span>
            <span className="value">{plan.weeks} sem</span>
          </div>
          <div className="stat">
            <span className="label">Sesiones / semana</span>
            <span className="value">{sessions.length}</span>
          </div>
          <div className="stat">
            <span className="label">Creado</span>
            <span style={{ fontWeight: 600 }}>{new Date(plan.createdAt).toLocaleDateString('es')}</span>
          </div>
        </div>
      </div>

      {!plan.custom && !editing && plan.warnings.length > 0 && (
        <div className="alert warn">
          <strong>Avisos del plan</strong>
          <ul>
            {plan.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <PlanReviewPanel findings={findings} />

      {!editing && (
        <div className="card stack-sm">
          <h2>Proximidad al fallo por semana</h2>
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {rirSchedule(plan.weeks).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid">
        {sessions.map((s, si) => (
          <div className="card stack-sm" key={si}>
            {editing ? (
              <div className="spread" style={{ flexWrap: 'nowrap' }}>
                <input
                  aria-label="Nombre del día"
                  value={s.name}
                  onChange={(e) => updateSession(si, (x) => ({ ...x, name: e.target.value }))}
                  style={{ fontWeight: 600 }}
                />
                <span className="badge" style={{ flexShrink: 0 }}>
                  ~{s.estimatedMinutes} min
                </span>
                <button type="button" className="btn small danger" disabled={sessions.length <= 1} onClick={() => removeDay(si)}>
                  Quitar día
                </button>
              </div>
            ) : (
              <>
                <div className="spread">
                  <h2 style={{ margin: 0 }}>
                    Día {si + 1} · {s.name}
                  </h2>
                  <span className="badge">~{s.estimatedMinutes} min</span>
                </div>
                <small>{s.focus}</small>
              </>
            )}

            {editing ? (
              <div className="stack-sm">
                {s.exercises.map((pe, ei) => (
                  <ExerciseEditRow
                    key={`${ei}-${pe.exerciseId}`}
                    pe={pe}
                    first={ei === 0}
                    last={ei === s.exercises.length - 1}
                    profile={profile}
                    onChange={(next) => updateExercise(si, ei, next)}
                    onMove={(dir) => move(si, ei, dir)}
                    onRemove={() => updateSession(si, (x) => ({ ...x, exercises: x.exercises.filter((_, j) => j !== ei) }))}
                  />
                ))}
                {s.exercises.length === 0 && <p className="muted" style={{ margin: 0 }}>Sin ejercicios todavía.</p>}
                <AddExercise profile={profile} onAdd={(id) => addExercise(si, id)} />
              </div>
            ) : (
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
                              onChange={(e) => swapInView(si, ei, e.target.value)}
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
                            <ExerciseIllustration key={ex.id} exerciseId={ex.id} exerciseName={ex.name} compact />
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
                {s.exercises.length === 0 && <p className="muted">Sin ejercicios: pulsa «Editar plan» para agregarlos.</p>}
              </div>
            )}
          </div>
        ))}
        {editing && (
          <button type="button" className="card add-day" onClick={addDay}>
            + Agregar día
          </button>
        )}
      </div>

      <div className="cols-2">
        <div className="card stack-sm">
          <h2>Volumen semanal por músculo</h2>
          <VolumeTable plan={plan} />
        </div>

        {plan.explanations.length > 0 && (
          <div className="card stack-sm">
            <h2>¿Por qué este plan?</h2>
            <Explanations items={plan.explanations} />
          </div>
        )}
      </div>
    </div>
  )
}

/** Plan vacío con los días de la ficha, para armarlo desde cero. */
function blankPlan(profile: Profile, weeks: number): Plan {
  const sessions: PlannedSession[] = Array.from({ length: profile.daysPerWeek }, (_, i) => ({
    name: `Día ${i + 1}`,
    focus: 'Personalizado',
    exercises: [],
    estimatedMinutes: 0,
  }))
  return {
    id: crypto.randomUUID(),
    profileId: profile.id,
    createdAt: new Date().toISOString(),
    weeks,
    split: 'Personalizado',
    sessions,
    weeklyVolume: computeVolume(sessions, weeklyTargets(profile), profile.priorityMuscles),
    explanations: [],
    warnings: [],
    active: true,
    kind: 'mesocycle',
    custom: true,
    profileSnapshot: planSnapshot(profile),
  }
}

export function PlanPage() {
  const { active } = useActiveProfile()
  const plan = useLiveQuery(() => (active ? activePlan(active.id) : undefined), [active?.id])
  const logCount = useLiveQuery(() => (plan ? db.workouts.where('planId').equals(plan.id).count() : 0), [plan?.id])
  const [weeks, setWeeks] = useState(6)
  const [editing, setEditing] = useState(false)

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
    if (plan?.custom && !confirm('Tu plan tiene cambios hechos a mano. Generar uno nuevo los reemplaza. ¿Continuar?')) return
    if (plan && !plan.custom && (logCount ?? 0) > 0 && !confirm('Se creará un mesociclo nuevo. El historial de entrenamientos se conserva. ¿Continuar?')) return
    await regeneratePlan(active, weeks)
    setEditing(false)
  }

  async function fromScratch() {
    if (!active) return
    if (plan && !confirm('Se creará un plan vacío para armarlo a tu gusto; el actual se reemplaza. El historial se conserva. ¿Continuar?')) return
    await savePlan(blankPlan(active, weeks))
    setEditing(true)
  }

  return (
    <div className="stack">
      <div className="spread">
        <h1>Plan de {active.name}</h1>
        <div className="row">
          {plan && plan.kind !== 'deload' && (
            <button className={`btn ${editing ? 'primary' : ''}`} onClick={() => setEditing(!editing)}>
              {editing ? 'Listo' : 'Editar plan'}
            </button>
          )}
          {!editing && (
            <>
              <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} style={{ width: 'auto' }} aria-label="Semanas">
                {[4, 5, 6, 7, 8].map((w) => (
                  <option key={w} value={w}>
                    {w} semanas
                  </option>
                ))}
              </select>
              {plan && plan.kind !== 'deload' && (logCount ?? 0) > 0 && (
                <Link className="btn" to="/plan/cierre">
                  Cerrar mesociclo
                </Link>
              )}
              <button className="btn" onClick={fromScratch} disabled={!safety.canGenerate}>
                Crear desde cero
              </button>
              <button className="btn primary" onClick={generate} disabled={!safety.canGenerate}>
                {plan ? 'Regenerar mesociclo' : 'Generar mesociclo'}
              </button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="alert info">
          Estás editando el plan. Los cambios se guardan al instante y la revisión de abajo se actualiza mientras editas.
        </div>
      )}

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

      {plan && !editing && <PlanChangesAlert plan={plan} profile={active} />}

      {plan ? (
        // Un plan nuevo reinicia el editor: el borrador nunca se mezcla con otro plan.
        <PlanView key={plan.id} plan={plan} profile={active} editing={editing} />
      ) : (
        safety.canGenerate && (
          <div className="card empty">
            Aún no hay un mesociclo. Genera uno a partir de tu ficha (días, experiencia, equipamiento, prioridades,
            recuperación y tiempo) o créalo desde cero a tu gusto.
          </div>
        )
      )}
    </div>
  )
}
