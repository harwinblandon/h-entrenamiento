import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { activePlan, db } from '../../db/db'
import { getExercise, isLoadless, repRangeFor, restFor, substitutesFor } from '../../domain/exercises'
import { MUSCLE_LABELS } from '../../domain/labels'
import {
  lastEntryFor,
  PAIN_STOP,
  recommendLoad,
  rirTarget,
  suggestNextSet,
  summarizeSession,
  warmupSets,
  type SetSuggestion,
} from '../../domain/progression'
import { nextSession, type NextSession } from '../../domain/schedule'
import type { LoggedExercise, LoggedSet, Plan, Profile, Technique, WorkoutLog } from '../../domain/types'
import { useActiveProfile } from '../activeProfile'
import { RestTimer, type TimerState } from '../components/RestTimer'

const fmtKg = (n: number) => `${Number(n.toFixed(2))} kg`
const fmtRir = ([a, b]: [number, number]) => (a === b ? `RIR ${a}` : `RIR ${a}–${b}`)

function SetInput({
  entry,
  defaultWeight,
  defaultReps,
  onSubmit,
}: {
  entry: LoggedExercise
  defaultWeight: number | null
  defaultReps: number
  onSubmit: (s: LoggedSet) => void
}) {
  const loadless = isLoadless(getExercise(entry.exerciseId))
  const [weight, setWeight] = useState(defaultWeight !== null ? String(defaultWeight) : '')
  const [reps, setReps] = useState(String(defaultReps))
  const [rir, setRir] = useState(String(entry.rirTarget[1]))
  const [pain, setPain] = useState('0')
  const [technique, setTechnique] = useState<Technique>('stable')
  const valid = weight !== '' && Number(reps) > 0

  return (
    <div className="stack-sm">
      <div className="set-row">
        <span className="idx">{entry.sets.length + 1}</span>
        <label className="field">
          {loadless ? 'Lastre (kg)' : 'Peso (kg)'}
          <input type="number" inputMode="decimal" step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label className="field">
          Reps
          <input type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
        </label>
        <label className="field">
          RIR
          <select value={rir} onChange={(e) => setRir(e.target.value)}>
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n === 5 ? '5+' : n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="set-row">
        <span />
        <label className="field">
          Dolor (0–10)
          <select value={pain} onChange={(e) => setPain(e.target.value)}>
            {Array.from({ length: 11 }, (_, n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ gridColumn: 'span 2' }}>
          Técnica
          <div className="chips">
            <button type="button" className={`chip ${technique === 'stable' ? 'on' : ''}`} onClick={() => setTechnique('stable')}>
              Estable
            </button>
            <button type="button" className={`chip ${technique === 'deteriorated' ? 'on' : ''}`} onClick={() => setTechnique('deteriorated')}>
              Deteriorada
            </button>
          </div>
        </label>
      </div>
      <button
        className="btn primary block"
        disabled={!valid}
        onClick={() => onSubmit({ weight: Number(weight), reps: Number(reps), rir: Number(rir), pain: Number(pain), technique })}
      >
        Registrar serie
      </button>
    </div>
  )
}

function ExerciseCard({
  log,
  index,
  history,
  profile,
  isCurrent,
  onUpdate,
  onRest,
}: {
  log: WorkoutLog
  index: number
  history: WorkoutLog[]
  profile: Profile
  isCurrent: boolean
  onUpdate: (entry: LoggedExercise) => void
  onRest: (sec: number) => void
}) {
  const entry = log.entries[index]
  const ex = getExercise(entry.exerciseId)
  const rec = recommendLoad(lastEntryFor(entry.exerciseId, history, log.id), entry.repRange, entry.rirTarget, ex)
  const firstForMuscle = !log.entries.slice(0, index).some((e) => getExercise(e.exerciseId).primary.some((m) => ex.primary.includes(m)))
  const warmups = warmupSets(rec.weight, ex, firstForMuscle)
  const lastSet = entry.sets[entry.sets.length - 1]
  const suggestion: SetSuggestion | undefined = lastSet ? suggestNextSet(lastSet, entry.repRange, entry.rirTarget, ex) : undefined
  const done = entry.stopped || entry.sets.length >= entry.plannedSets
  const subs = substitutesFor(entry.exerciseId, profile.equipment, profile.avoidExerciseIds)

  function logSet(s: LoggedSet) {
    const next = { ...entry, sets: [...entry.sets, s] }
    onUpdate(next)
    const sug = suggestNextSet(s, entry.repRange, entry.rirTarget, ex)
    if (sug.action !== 'stop' && next.sets.length < entry.plannedSets) onRest(entry.restSec)
  }

  function substitute(id: string) {
    const nx = getExercise(id)
    onUpdate({ ...entry, exerciseId: id, substitutedFrom: entry.substitutedFrom ?? entry.exerciseId, repRange: repRangeFor(nx), restSec: restFor(nx) })
  }

  return (
    <details className="exercise" open={isCurrent}>
      <summary>
        <div>
          <div style={{ fontWeight: 600 }}>
            {index + 1}. {ex.name}
          </div>
          <small>
            {MUSCLE_LABELS[entry.muscle]} · {entry.plannedSets} × {entry.repRange[0]}–{entry.repRange[1]} · {fmtRir(entry.rirTarget)}
          </small>
        </div>
        <span className={`badge ${entry.stopped ? 'danger' : done ? 'accent' : ''}`}>
          {entry.stopped ? 'Detenido' : `${entry.sets.length}/${entry.plannedSets}`}
        </span>
      </summary>
      <div className="exercise-body">
        <div className="grid-tight">
          <div className="stat">
            <span className="label">Carga recomendada</span>
            <span className="value">{isLoadless(ex) ? 'Sin carga' : rec.weight !== null ? fmtKg(rec.weight) : 'Calibrar'}</span>
            {ex.loadNote && <span className="sub">{ex.loadNote}</span>}
          </div>
          <div className="stat">
            <span className="label">Objetivo</span>
            <span className="value">
              {rec.repsTarget[0]}–{rec.repsTarget[1]} reps
            </span>
            <span className="sub">{fmtRir(entry.rirTarget)}</span>
          </div>
          <div className="stat">
            <span className="label">Descanso</span>
            <span className="value">{entry.restSec >= 120 ? `${entry.restSec / 60} min` : `${entry.restSec} s`}</span>
          </div>
        </div>
        <small>{rec.reason}</small>

        {warmups.length > 0 && entry.sets.length === 0 && (
          <div>
            <strong style={{ fontSize: '0.88rem' }}>Calentamiento (no cuenta como serie efectiva)</strong>
            <div className="muted" style={{ fontSize: '0.88rem' }}>
              {warmups.map((w, i) => (
                <span key={i}>
                  {i > 0 && ' → '}
                  {w.weight !== null ? fmtKg(w.weight) : `${Math.round(w.pct * 100)} %`} × {w.reps}
                </span>
              ))}
            </div>
          </div>
        )}

        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.88rem' }} className="muted">
          {ex.cues.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>

        {entry.substitutedFrom && <small>Sustituye a: {getExercise(entry.substitutedFrom).name}</small>}
        {entry.sets.length === 0 && subs.length > 0 && (
          <label className="field">
            Sustituir por
            <select value="" onChange={(e) => e.target.value && substitute(e.target.value)}>
              <option value="">— Mantener {ex.name} —</option>
              {subs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {entry.sets.length > 0 && (
          <div>
            {entry.sets.map((s, i) => (
              <div className="set-done num" key={i}>
                <span className="idx muted">{i + 1}</span>
                <span>
                  {fmtKg(s.weight)} × {s.reps} · RIR {s.rir}
                  {s.pain > 0 && <span className={`badge ${s.pain >= PAIN_STOP ? 'danger' : 'warn'}`} style={{ marginLeft: 6 }}>Dolor {s.pain}</span>}
                  {s.technique === 'deteriorated' && <span className="badge warn" style={{ marginLeft: 6 }}>Técnica</span>}
                </span>
                {i === entry.sets.length - 1 && (
                  <button className="btn small" onClick={() => onUpdate({ ...entry, sets: entry.sets.slice(0, -1), stopped: false })}>
                    Deshacer
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {suggestion && !entry.stopped && <div className={`suggestion ${suggestion.action}`}>{suggestion.message}</div>}

        {!done && (
          <SetInput
            key={`${entry.exerciseId}-${entry.sets.length}`}
            entry={entry}
            defaultWeight={suggestion?.weight ?? rec.weight ?? (isLoadless(ex) ? 0 : null)}
            defaultReps={suggestion?.repsTarget[0] ?? rec.repsTarget[0]}
            onSubmit={logSet}
          />
        )}
        {!entry.stopped && !done && (
          <button className="btn small danger" style={{ alignSelf: 'flex-start' }} onClick={() => onUpdate({ ...entry, stopped: true })}>
            Detener ejercicio
          </button>
        )}
        {done && !entry.stopped && entry.sets.length >= entry.plannedSets && (
          <button className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => onUpdate({ ...entry, plannedSets: entry.plannedSets + 1 })}>
            + Añadir serie
          </button>
        )}
      </div>
    </details>
  )
}

function Summary({ log, history, onClose }: { log: WorkoutLog; history: WorkoutLog[]; onClose: () => void }) {
  const s = summarizeSession(log, history)
  return (
    <div className="stack narrow">
      <h1>Resumen de la sesión</h1>
      <div className="card grid-tight">
        <div className="stat">
          <span className="label">Cumplimiento</span>
          <span className="value">{s.compliancePct} %</span>
          <span className="sub">
            {s.setsDone} de {s.setsPlanned} series
          </span>
        </div>
        <div className="stat">
          <span className="label">Repeticiones</span>
          <span className="value">{s.totalReps}</span>
        </div>
        <div className="stat">
          <span className="label">Carga total</span>
          <span className="value">{Math.round(s.tonnage).toLocaleString('es')} kg</span>
        </div>
        <div className="stat">
          <span className="label">Fatiga percibida</span>
          <span className="value">{log.fatigue ?? '—'}/5</span>
        </div>
      </div>
      <div className="alert info">
        <strong>Próxima sesión:</strong> {s.recommendation}
      </div>
      <div className="grid">
        <div className="card stack-sm">
          <h2>Series por músculo</h2>
          <table>
            <tbody>
              {Object.entries(s.volumeByMuscle).map(([m, v]) => (
                <tr key={m}>
                  <td>{MUSCLE_LABELS[m as keyof typeof MUSCLE_LABELS]}</td>
                  <td className="r">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card stack-sm">
          <h2>Rendimiento frente a la vez anterior</h2>
          {s.progressed.length === 0 && s.regressed.length === 0 && (
            <p className="muted">Sin comparación todavía: se necesitan al menos dos exposiciones a cada ejercicio.</p>
          )}
          {s.progressed.length > 0 && (
            <p>
              <span className="badge accent">Progreso</span> {s.progressed.join(', ')}
            </p>
          )}
          {s.regressed.length > 0 && (
            <p>
              <span className="badge warn">Por debajo</span> {s.regressed.join(', ')}
            </p>
          )}
          <small>Comparación por 1RM estimado ajustado por RIR; solo cuentan series con técnica estable.</small>
        </div>
      </div>
      <button className="btn primary" onClick={onClose}>
        Listo
      </button>
    </div>
  )
}

function GuidedSession({
  log,
  plan,
  profile,
  history,
  onFinished,
}: {
  log: WorkoutLog
  plan: Plan
  profile: Profile
  history: WorkoutLog[]
  onFinished: (logId: string) => void
}) {
  const [timer, setTimer] = useState<TimerState | null>(null)
  const [fatigue, setFatigue] = useState(3)
  const [notes, setNotes] = useState('')
  const session = plan.sessions[log.sessionIndex]
  const done = log.entries.reduce((n, e) => n + e.sets.length, 0)
  const planned = log.entries.reduce((n, e) => n + e.plannedSets, 0)
  const currentIdx = log.entries.findIndex((e) => !e.stopped && e.sets.length < e.plannedSets)

  async function updateEntry(i: number, entry: LoggedExercise) {
    const entries = log.entries.map((e, j) => (j === i ? entry : e))
    await db.workouts.update(log.id, { entries })
  }

  async function finish() {
    await db.workouts.update(log.id, { finishedAt: new Date().toISOString(), fatigue, notes: notes.trim() || undefined })
    // La calibración termina cuando se completan todas las sesiones de la semana 1, en cualquier orden.
    const week1Done = new Set(
      history.filter((l) => l.planId === plan.id && l.week === 1 && l.finishedAt).map((l) => l.sessionIndex),
    ).add(log.sessionIndex)
    if (profile.status === 'calibration' && log.week === 1 && week1Done.size >= plan.sessions.length) {
      await db.profiles.update(profile.id, { status: 'active' })
    }
    setTimer(null)
    onFinished(log.id)
  }

  async function cancel() {
    if (confirm('¿Descartar esta sesión? Se borrarán las series registradas.')) await db.workouts.delete(log.id)
  }

  return (
    <div className="stack narrow">
      <div className="spread">
        <div>
          <h1>{session.name}</h1>
          <small>
            Semana {log.week} de {plan.weeks} · {session.focus}
          </small>
        </div>
        <span className="badge accent num">
          {done}/{planned} series
        </span>
      </div>
      <div className="alert info" style={{ fontSize: '0.88rem' }}>
        <strong>Objetivo de hoy:</strong>{' '}
        {log.week === 1
          ? 'encontrar cargas con ~3 repeticiones en reserva y técnica impecable.'
          : `acumular series de calidad en ${log.entries[0] ? fmtRir(log.entries[0].rirTarget) : 'el RIR indicado'} y superar la sesión anterior en repeticiones o carga.`}{' '}
        Registra cada serie para recibir la sugerencia de la siguiente.
      </div>

      {log.entries.map((_, i) => (
        <ExerciseCard
          key={`${i}-${log.entries[i].exerciseId}`}
          log={log}
          index={i}
          history={history}
          profile={profile}
          isCurrent={i === currentIdx}
          onUpdate={(e) => updateEntry(i, e)}
          onRest={(sec) => setTimer({ endsAt: Date.now() + sec * 1000 })}
        />
      ))}

      <div className="card stack-sm">
        <h2>Terminar sesión</h2>
        <label className="field">
          Fatiga percibida (1 = muy baja, 5 = muy alta)
          <div className="chips">
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} className={`chip ${fatigue === n ? 'on' : ''}`} onClick={() => setFatigue(n)}>
                {n}
              </button>
            ))}
          </div>
        </label>
        <label className="field">
          Notas
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sueño, energía, molestias…" />
        </label>
        <div className="row">
          <button className="btn primary" onClick={finish}>
            Terminar y ver resumen
          </button>
          <button className="btn danger" onClick={cancel}>
            Descartar sesión
          </button>
        </div>
      </div>

      {timer && <RestTimer timer={timer} onChange={setTimer} />}
    </div>
  )
}

export function WorkoutPage() {
  const { active } = useActiveProfile()
  const plan = useLiveQuery(async () => (active ? ((await activePlan(active.id)) ?? null) : null), [active?.id])
  const history = useLiveQuery(() => (active ? db.workouts.where('profileId').equals(active.id).toArray() : []), [active?.id])
  const [summaryId, setSummaryId] = useState<string>()

  if (!active) return <div className="card empty">Primero crea o selecciona una persona.</div>
  if (plan === undefined || history === undefined) return <div className="empty">Cargando…</div>
  if (plan === null) {
    return (
      <div className="card empty">
        <p>No hay un mesociclo activo.</p>
        <Link className="btn primary" to="/plan">
          Ir al plan
        </Link>
      </div>
    )
  }

  const summaryLog = summaryId ? history.find((l) => l.id === summaryId) : undefined
  if (summaryLog?.finishedAt) return <Summary log={summaryLog} history={history} onClose={() => setSummaryId(undefined)} />

  const next = nextSession(plan, history)
  if (!next) {
    return (
      <div className="card empty">
        <p>Completaste el mesociclo de {plan.weeks} semanas.</p>
        <Link className="btn primary" to="/plan">
          Generar el siguiente
        </Link>
      </div>
    )
  }

  if (next.inProgress) {
    return <GuidedSession log={next.inProgress} plan={plan} profile={active} history={history} onFinished={setSummaryId} />
  }

  return <SessionPicker plan={plan} next={next} profileId={active.id} />
}

/** Sesiones de la semana: se puede elegir cualquiera pendiente; la sugerida viene marcada. */
function SessionPicker({ plan, next, profileId }: { plan: Plan; next: NextSession; profileId: string }) {
  const [selected, setSelected] = useState(next.sessionIndex)
  const session = plan.sessions[selected]

  async function start() {
    const log: WorkoutLog = {
      id: crypto.randomUUID(),
      profileId,
      planId: plan.id,
      week: next.week,
      sessionIndex: selected,
      startedAt: new Date().toISOString(),
      entries: session.exercises.map((pe) => ({
        exerciseId: pe.exerciseId,
        muscle: pe.muscle,
        plannedSets: pe.sets,
        repRange: pe.repRange,
        rirTarget: rirTarget(next.week, plan.weeks, getExercise(pe.exerciseId)),
        restSec: pe.restSec,
        sets: [],
      })),
    }
    await db.workouts.add(log)
  }

  return (
    <div className="stack narrow">
      <div>
        <h1>Entrenamiento de hoy</h1>
        <small>
          Semana {next.week} de {plan.weeks} · {next.done.length} de {plan.sessions.length} sesiones hechas esta semana
        </small>
      </div>

      <div className="stack-sm">
        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Elige la sesión de hoy</span>
        <div className="session-options">
          {plan.sessions.map((s, i) => {
            const isDone = next.done.includes(i)
            return (
              <button
                key={s.name}
                type="button"
                className={`session-option ${selected === i ? 'on' : ''}`}
                disabled={isDone}
                aria-pressed={selected === i}
                onClick={() => setSelected(i)}
              >
                <span className="spread" style={{ width: '100%' }}>
                  <strong>{s.name}</strong>
                  {isDone ? (
                    <span className="badge">✓ Hecha</span>
                  ) : i === next.sessionIndex ? (
                    <span className="badge accent">Sugerida</span>
                  ) : null}
                </span>
                <small>{s.focus}</small>
              </button>
            )
          })}
        </div>
        {selected === next.sessionIndex && <small>Sugerida: {next.reason}</small>}
        <small>
          Si entrenaste algo fuera de la app, elige la sesión que deje descansar esos músculos.
        </small>
      </div>

      <div className="card stack-sm">
        <div className="spread">
          <h2 style={{ margin: 0 }}>{session.name}</h2>
          <span className="badge">~{session.estimatedMinutes} min</span>
        </div>
        <small>{session.focus}</small>
        <ol style={{ margin: '0.4rem 0', paddingLeft: '1.2rem' }}>
          {session.exercises.map((pe, i) => (
            <li key={i}>
              {getExercise(pe.exerciseId).name}{' '}
              <span className="muted">
                {pe.sets} × {pe.repRange[0]}–{pe.repRange[1]}
              </span>
            </li>
          ))}
        </ol>
        <button className="btn primary" onClick={start}>
          Empezar {session.name}
        </button>
      </div>
    </div>
  )
}
