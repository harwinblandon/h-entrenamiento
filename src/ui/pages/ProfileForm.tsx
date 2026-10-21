import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../../db/db'
import { EXERCISES } from '../../domain/exercises'
import {
  EQUIPMENT_LABELS,
  EXPERIENCE_LABELS,
  GOAL_LABELS,
  JOB_LABELS,
  LIFE_STAGE_LABELS,
  MUSCLE_LABELS,
} from '../../domain/labels'
import { emptySafety, evaluateSafety, SAFETY_QUESTIONS } from '../../domain/safety'
import { todayISO } from '../../domain/schedule'
import type { Profile } from '../../domain/types'
import { MUSCLES } from '../../domain/types'
import { useActiveProfile } from '../activeProfile'

function newProfile(): Profile {
  const ts = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: '',
    sex: 'female',
    age: 30,
    heightCm: 165,
    weightKg: 65,
    experience: 'beginner',
    daysPerWeek: 3,
    sessionMinutes: 75,
    equipment: 'full_gym',
    job: 'sedentary',
    sleepHours: 7,
    sleepQuality: 3,
    stress: 3,
    injuries: '',
    avoidExerciseIds: [],
    preferredExerciseIds: [],
    goal: 'gain',
    priorityMuscles: [],
    supplements: '',
    cardioAvailability: '',
    lifeStage: 'none',
    lifeStageNotes: '',
    safety: emptySafety(),
    status: 'calibration',
    createdAt: ts,
    updatedAt: ts,
  }
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      {label}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  )
}

function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  step?: number
  min?: number
  max?: number
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      max={max}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    />
  )
}

function ExercisePicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  return (
    <div className="stack-sm">
      {MUSCLES.map((m) => {
        const list = EXERCISES.filter((e) => e.primary[0] === m)
        if (list.length === 0) return null
        return (
          <div key={m}>
            <small>{MUSCLE_LABELS[m]}</small>
            <div className="chips" style={{ marginTop: 4 }}>
              {list.map((e) => (
                <button type="button" key={e.id} className={`chip ${selected.includes(e.id) ? 'on' : ''}`} onClick={() => toggle(e.id)}>
                  {e.name}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ProfileForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { setActiveId } = useActiveProfile()
  const existing = useLiveQuery(() => (id ? db.profiles.get(id) : undefined), [id])
  const [p, setP] = useState<Profile>(newProfile)
  const [loaded, setLoaded] = useState(!id)

  useEffect(() => {
    if (existing && !loaded) {
      setP(existing)
      setLoaded(true)
    }
  }, [existing, loaded])

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setP((prev) => ({ ...prev, [key]: value }))
  const safety = evaluateSafety(p.safety)

  async function save(e: FormEvent) {
    e.preventDefault()
    const now = new Date().toISOString()
    const saved = { ...p, name: p.name.trim(), updatedAt: now }
    await db.profiles.put(saved)
    if (!id) {
      await db.bodyLogs.add({ id: crypto.randomUUID(), profileId: saved.id, date: todayISO(), weightKg: saved.weightKg, waistCm: saved.waistCm })
    }
    setActiveId(saved.id)
    navigate('/plan')
  }

  if (id && !loaded) return <div className="empty">Cargando…</div>

  return (
    <form className="stack" onSubmit={save}>
      <div className="spread">
        <h1>{id ? `Ficha de ${p.name}` : 'Nueva persona'}</h1>
      </div>

      <fieldset className="card stack">
        <legend>Datos básicos</legend>
        <div className="grid-tight">
          <Field label="Nombre">
            <input required value={p.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Sexo biológico" hint="Solo para la estimación energética">
            <select value={p.sex} onChange={(e) => set('sex', e.target.value as Profile['sex'])}>
              <option value="female">Femenino</option>
              <option value="male">Masculino</option>
            </select>
          </Field>
          <Field label="Edad">
            <NumberInput value={p.age} min={14} max={99} onChange={(v) => set('age', v ?? 0)} />
          </Field>
          <Field label="Estatura (cm)">
            <NumberInput value={p.heightCm} onChange={(v) => set('heightCm', v ?? 0)} />
          </Field>
          <Field label="Peso (kg)">
            <NumberInput value={p.weightKg} step={0.1} onChange={(v) => set('weightKg', v ?? 0)} />
          </Field>
          <Field label="Cintura (cm)" hint="A la altura del ombligo, tras exhalar">
            <NumberInput value={p.waistCm} step={0.1} onChange={(v) => set('waistCm', v)} />
          </Field>
          <Field label="% de grasa" hint="Opcional, si lo conoces">
            <NumberInput value={p.bodyFatPct} step={0.1} onChange={(v) => set('bodyFatPct', v)} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="card stack">
        <legend>Entrenamiento</legend>
        <div className="grid-tight">
          <Field label="Experiencia">
            <select value={p.experience} onChange={(e) => set('experience', e.target.value as Profile['experience'])}>
              {Object.entries(EXPERIENCE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Días por semana">
            <select value={p.daysPerWeek} onChange={(e) => set('daysPerWeek', Number(e.target.value))}>
              {[2, 3, 4, 5, 6].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="Duración máxima (min)">
            <NumberInput value={p.sessionMinutes} step={5} onChange={(v) => set('sessionMinutes', v ?? 60)} />
          </Field>
          <Field label="Equipamiento">
            <select value={p.equipment} onChange={(e) => set('equipment', e.target.value as Profile['equipment'])}>
              {Object.entries(EQUIPMENT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Series semanales previas por músculo" hint="Aprox. lo que venías haciendo; opcional">
            <NumberInput value={p.previousWeeklySets} onChange={(v) => set('previousWeeklySets', v)} />
          </Field>
          <Field label="Estado">
            <select value={p.status} onChange={(e) => set('status', e.target.value as Profile['status'])}>
              <option value="calibration">Calibración (primera semana para encontrar cargas)</option>
              <option value="active">Activo (ya conoce sus cargas)</option>
            </select>
          </Field>
        </div>
        <Field label="Objetivo">
          <select value={p.goal} onChange={(e) => set('goal', e.target.value as Profile['goal'])}>
            {Object.entries(GOAL_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <div className="stack-sm">
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Músculos prioritarios</span>
          <div className="chips">
            {MUSCLES.map((m) => {
              const on = p.priorityMuscles.includes(m)
              return (
                <button
                  type="button"
                  key={m}
                  className={`chip ${on ? 'on' : ''}`}
                  onClick={() => set('priorityMuscles', on ? p.priorityMuscles.filter((x) => x !== m) : [...p.priorityMuscles, m])}
                >
                  {MUSCLE_LABELS[m]}
                </button>
              )
            })}
          </div>
          {p.priorityMuscles.length > 3 && (
            <div className="alert warn">Más de 3 prioridades a la vez suele elevar la fatiga. Considera rotarlas entre mesociclos.</div>
          )}
        </div>
      </fieldset>

      <fieldset className="card stack">
        <legend>Recuperación y estilo de vida</legend>
        <div className="grid-tight">
          <Field label="Trabajo">
            <select value={p.job} onChange={(e) => set('job', e.target.value as Profile['job'])}>
              {Object.entries(JOB_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Pasos diarios (promedio)" hint="Opcional">
            <NumberInput value={p.dailySteps} step={500} onChange={(v) => set('dailySteps', v)} />
          </Field>
          <Field label="Horas de sueño">
            <NumberInput value={p.sleepHours} step={0.5} onChange={(v) => set('sleepHours', v ?? 7)} />
          </Field>
          <Field label="Calidad del sueño (1–5)">
            <NumberInput value={p.sleepQuality} min={1} max={5} onChange={(v) => set('sleepQuality', v ?? 3)} />
          </Field>
          <Field label="Nivel de estrés (1–5)">
            <NumberInput value={p.stress} min={1} max={5} onChange={(v) => set('stress', v ?? 3)} />
          </Field>
        </div>
        <div className="grid">
          <Field label="Suplementos utilizados">
            <input value={p.supplements} onChange={(e) => set('supplements', e.target.value)} placeholder="p. ej. creatina 5 g/día" />
          </Field>
          <Field label="Disponibilidad para cardio">
            <input value={p.cardioAvailability} onChange={(e) => set('cardioAvailability', e.target.value)} placeholder="p. ej. 2 caminatas de 30 min" />
          </Field>
        </div>
      </fieldset>

      <fieldset className="card stack">
        <legend>Lesiones y preferencias</legend>
        <Field label="Lesiones, dolores o limitaciones">
          <textarea value={p.injuries} onChange={(e) => set('injuries', e.target.value)} />
        </Field>
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 500 }}>
            Ejercicios a evitar ({p.avoidExerciseIds.length})
          </summary>
          <div style={{ marginTop: '0.6rem' }}>
            <ExercisePicker selected={p.avoidExerciseIds} onChange={(ids) => set('avoidExerciseIds', ids)} />
          </div>
        </details>
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 500 }}>
            Ejercicios preferidos ({p.preferredExerciseIds.length})
          </summary>
          <div style={{ marginTop: '0.6rem' }}>
            <ExercisePicker selected={p.preferredExerciseIds} onChange={(ids) => set('preferredExerciseIds', ids)} />
          </div>
        </details>
      </fieldset>

      {p.sex === 'female' && (
        <fieldset className="card stack">
          <legend>Etapa vital (opcional)</legend>
          <p className="muted" style={{ fontSize: '0.88rem' }}>
            El entrenamiento no se modifica automáticamente por la fase del ciclo: se ajusta según tus síntomas, rendimiento
            y recuperación.
          </p>
          <div className="grid">
            <Field label="Situación">
              <select value={p.lifeStage} onChange={(e) => set('lifeStage', e.target.value as Profile['lifeStage'])}>
                {Object.entries(LIFE_STAGE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Notas (anticoncepción, síntomas…)">
              <input value={p.lifeStageNotes} onChange={(e) => set('lifeStageNotes', e.target.value)} />
            </Field>
          </div>
          {(p.lifeStage === 'pregnancy' || p.lifeStage === 'postpartum') && (
            <div className="alert warn">
              En embarazo y posparto el entrenamiento requiere autorización y acompañamiento de tu profesional de salud.
            </div>
          )}
        </fieldset>
      )}

      <fieldset className="card stack">
        <legend>Evaluación de seguridad</legend>
        <p className="muted" style={{ fontSize: '0.88rem' }}>
          Preguntas basadas en el cuestionario PAR-Q+. Atlas no diagnostica: si alguna respuesta es afirmativa, te
          recomendará la valoración profesional correspondiente.
        </p>
        <div className="stack-sm">
          {SAFETY_QUESTIONS.map((q) => (
            <label className="check" key={q.key}>
              <input
                type="checkbox"
                checked={p.safety[q.key]}
                onChange={(e) => set('safety', { ...p.safety, [q.key]: e.target.checked })}
              />
              {q.text}
            </label>
          ))}
        </div>
        {safety.flags.length > 0 && (
          <div className={`alert ${safety.level === 'clearance_required' ? 'danger' : 'warn'}`}>
            <strong>{safety.level === 'clearance_required' ? 'Se requiere valoración profesional' : 'Precauciones'}</strong>
            <ul>
              {safety.flags.map((f) => (
                <li key={f.key}>{f.advice}</li>
              ))}
            </ul>
          </div>
        )}
        {safety.level === 'clearance_required' && (
          <label className="check">
            <input
              type="checkbox"
              checked={p.safety.medicalClearance}
              onChange={(e) => set('safety', { ...p.safety, medicalClearance: e.target.checked })}
            />
            Confirmo que cuento con autorización de un profesional de la salud para entrenar con cargas.
          </label>
        )}
      </fieldset>

      <div className="row">
        <button className="btn primary" type="submit">
          Guardar ficha
        </button>
        <button className="btn" type="button" onClick={() => navigate(-1)}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
