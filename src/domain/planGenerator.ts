import { EXERCISES, getExercise, isAvailable, repRangeFor, restFor } from './exercises'
import { MUSCLE_LABELS } from './labels'
import type {
  Exercise,
  ExerciseCategory,
  Experience,
  Explanation,
  Muscle,
  MuscleVolume,
  Plan,
  PlannedExercise,
  PlannedSession,
  Profile,
} from './types'
import { MUSCLES } from './types'

/** Rangos iniciales de series efectivas semanales por músculo y punto de partida. */
export const BASE_SETS: Record<Experience, { min: number; max: number; start: number }> = {
  beginner: { min: 6, max: 10, start: 8 },
  intermediate: { min: 8, max: 14, start: 10 },
  advanced: { min: 10, max: 16, start: 12 },
}

/**
 * Proporción del volumen base que recibe cada músculo. Deltoides anterior es 0 porque
 * suele recibir suficiente trabajo indirecto de los presses.
 */
const MUSCLE_FACTOR: Record<Muscle, number> = {
  chest: 1,
  back: 1,
  traps: 0.6,
  delts_front: 0,
  delts_side: 1,
  delts_rear: 0.7,
  biceps: 0.8,
  triceps: 0.8,
  quads: 1,
  hamstrings: 0.8,
  glutes: 0.6,
  calves: 0.8,
  abs: 0.5,
}

/** Primero los músculos grandes: su trabajo aporta volumen indirecto a los pequeños. */
const ALLOCATION_ORDER: Muscle[] = [
  'chest', 'back', 'quads', 'hamstrings', 'delts_front', 'delts_side', 'glutes',
  'delts_rear', 'triceps', 'biceps', 'traps', 'calves', 'abs',
]

/** Músculos en los que el primer ejercicio de la sesión debería ser multiarticular. */
const COMPOUND_FIRST: Muscle[] = ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'delts_front']

/** Músculos que reciben trabajo indirecto suficiente de los compuestos como para prescindir de un aislamiento. */
const INDIRECTLY_COVERED: Muscle[] = ['biceps', 'triceps', 'delts_rear', 'traps', 'glutes', 'abs']

const MAX_SETS_PER_EXERCISE = 4
const INDIRECT_FACTOR = 0.5

interface SessionTemplate {
  name: string
  focus: string
  muscles: Muscle[]
}

interface Split {
  name: string
  description: string
  sessions: SessionTemplate[]
}

const UPPER: Muscle[] = ['chest', 'back', 'delts_side', 'delts_rear', 'triceps', 'biceps', 'traps', 'delts_front']
const LOWER: Muscle[] = ['quads', 'hamstrings', 'glutes', 'calves', 'abs']

export function splitFor(days: number): Split {
  const d = Math.min(6, Math.max(2, Math.round(days)))
  switch (d) {
    case 2:
      return {
        name: 'Cuerpo completo ×2',
        description: 'Dos sesiones de cuerpo completo: cada músculo recibe dos estímulos semanales.',
        sessions: [
          { name: 'Cuerpo completo A', focus: 'Todos los grupos, énfasis en empujes y sentadilla', muscles: ['quads', 'chest', 'back', 'hamstrings', 'delts_side', 'triceps', 'biceps', 'calves', 'glutes', 'delts_rear', 'traps', 'abs', 'delts_front'] },
          { name: 'Cuerpo completo B', focus: 'Todos los grupos, énfasis en tracciones y bisagra', muscles: ['hamstrings', 'back', 'chest', 'quads', 'delts_side', 'biceps', 'triceps', 'calves', 'glutes', 'delts_rear', 'traps', 'abs', 'delts_front'] },
        ],
      }
    case 3:
      return {
        name: 'Cuerpo completo ×3',
        description: 'Tres sesiones de cuerpo completo; los músculos pequeños se reparten para limitar la duración.',
        sessions: [
          { name: 'Cuerpo completo A', focus: 'Sentadilla, empuje horizontal y tracción', muscles: ['quads', 'chest', 'back', 'hamstrings', 'delts_side', 'triceps', 'calves', 'delts_front'] },
          { name: 'Cuerpo completo B', focus: 'Bisagra de cadera, tracción y hombro', muscles: ['hamstrings', 'back', 'chest', 'glutes', 'delts_rear', 'biceps', 'traps', 'abs'] },
          { name: 'Cuerpo completo C', focus: 'Pierna, empuje y brazos', muscles: ['quads', 'chest', 'back', 'glutes', 'delts_side', 'triceps', 'biceps', 'calves', 'delts_rear', 'traps', 'abs'] },
        ],
      }
    case 4:
      return {
        name: 'Torso / Pierna ×2',
        description: 'Cuatro sesiones alternando torso y pierna: dos estímulos semanales por músculo.',
        sessions: [
          { name: 'Torso A', focus: 'Empuje y tracción horizontales', muscles: UPPER },
          { name: 'Pierna A', focus: 'Énfasis en cuádriceps', muscles: LOWER },
          { name: 'Torso B', focus: 'Empuje y tracción verticales', muscles: ['back', 'chest', 'delts_side', 'delts_rear', 'biceps', 'triceps', 'traps', 'delts_front'] },
          { name: 'Pierna B', focus: 'Énfasis en isquiotibiales y glúteos', muscles: ['hamstrings', 'glutes', 'quads', 'calves', 'abs'] },
        ],
      }
    case 5:
      return {
        name: 'Torso / Pierna / Empuje / Tracción / Pierna',
        description: 'Cinco sesiones; cada músculo recibe dos estímulos semanales repartidos en días distintos.',
        sessions: [
          { name: 'Torso', focus: 'Tren superior completo', muscles: ['chest', 'back', 'delts_side', 'delts_rear', 'triceps', 'biceps', 'traps'] },
          { name: 'Pierna A', focus: 'Énfasis en cuádriceps', muscles: LOWER },
          { name: 'Empuje', focus: 'Pecho, hombro y tríceps', muscles: ['chest', 'delts_front', 'delts_side', 'triceps'] },
          { name: 'Tracción', focus: 'Espalda, deltoides posterior, bíceps y trapecio', muscles: ['back', 'delts_rear', 'biceps', 'traps'] },
          { name: 'Pierna B', focus: 'Énfasis en isquiotibiales y glúteos', muscles: ['hamstrings', 'glutes', 'quads', 'calves', 'abs'] },
        ],
      }
    default:
      return {
        name: 'Empuje / Tracción / Pierna ×2',
        description: 'Seis sesiones; cada músculo recibe dos estímulos semanales.',
        sessions: [
          { name: 'Empuje A', focus: 'Pecho, hombro y tríceps', muscles: ['chest', 'delts_front', 'delts_side', 'triceps'] },
          { name: 'Tracción A', focus: 'Espalda, bíceps y trapecio', muscles: ['back', 'delts_rear', 'biceps', 'traps'] },
          { name: 'Pierna A', focus: 'Énfasis en cuádriceps', muscles: LOWER },
          { name: 'Empuje B', focus: 'Hombro y pecho inclinado', muscles: ['delts_side', 'chest', 'delts_front', 'triceps'] },
          { name: 'Tracción B', focus: 'Tracción vertical y brazos', muscles: ['back', 'delts_rear', 'biceps', 'traps'] },
          { name: 'Pierna B', focus: 'Énfasis en isquiotibiales y glúteos', muscles: ['hamstrings', 'glutes', 'quads', 'calves', 'abs'] },
        ],
      }
  }
}

export function hasPoorRecovery(p: Pick<Profile, 'sleepHours' | 'sleepQuality' | 'stress'>): boolean {
  return p.sleepHours < 6 || p.sleepQuality <= 2 || p.stress >= 4
}

/** Series efectivas semanales objetivo por músculo. */
export function weeklyTargets(profile: Profile): Record<Muscle, number> {
  const range = BASE_SETS[profile.experience]
  let base = range.start
  if (profile.previousWeeklySets !== undefined && profile.previousWeeklySets > 0) {
    // Partir de lo que ya venía haciendo, dentro del rango de su nivel.
    base = Math.min(range.max, Math.max(range.min, profile.previousWeeklySets))
  }
  const poorRecovery = hasPoorRecovery(profile)
  if (poorRecovery) base = Math.max(range.min, base - 2)
  const bonus = poorRecovery ? 2 : 3

  const targets = {} as Record<Muscle, number>
  for (const m of MUSCLES) {
    const priority = profile.priorityMuscles.includes(m)
    const factor = m === 'delts_front' && priority ? 0.6 : MUSCLE_FACTOR[m]
    targets[m] = factor === 0 ? 0 : Math.round(base * factor) + (priority ? bonus : 0)
  }
  return targets
}

const CATEGORY_RANK: Record<ExerciseCategory, number> = { compound: 0, machine: 10, isolation: 20 }

interface SessionState {
  template: SessionTemplate
  exercises: PlannedExercise[]
}

interface Context {
  profile: Profile
  usedForMuscle: Map<Muscle, Set<string>>
}

function chooseExercise(m: Muscle, slot: number, session: SessionState, ctx: Context): Exercise | undefined {
  const { profile } = ctx
  const usedInSession = new Set(session.exercises.map((e) => e.exerciseId))
  const usedThisWeek = ctx.usedForMuscle.get(m) ?? new Set<string>()
  const heavyInSession = session.exercises.some((e) => getExercise(e.exerciseId).fatigue === 3)
  const compoundFirst = COMPOUND_FIRST.includes(m)

  let best: Exercise | undefined
  let bestScore = -Infinity
  EXERCISES.forEach((e, index) => {
    if (!e.primary.includes(m)) return
    if (!isAvailable(e, profile.equipment)) return
    if (profile.avoidExerciseIds.includes(e.id) || usedInSession.has(e.id)) return

    let score = 0
    if (profile.preferredExerciseIds.includes(e.id)) score += 100
    if (!usedThisWeek.has(e.id)) score += 20
    if (compoundFirst && slot === 0) score += { compound: 10, machine: 6, isolation: 0 }[e.category]
    else if (compoundFirst) score += { compound: 2, machine: 8, isolation: 6 }[e.category]
    else score += { compound: 0, machine: 5, isolation: 10 }[e.category]
    if (heavyInSession && e.fatigue === 3) score -= 15
    if (profile.experience === 'beginner' && e.category === 'machine') score += 3
    score -= index * 0.01 // desempate estable según el orden de la biblioteca

    if (score > bestScore) {
      bestScore = score
      best = e
    }
  })
  return best
}

/**
 * Reparte series entre sesiones proporcionalmente a su peso (las sesiones con menos músculos
 * reciben más), sin dejar sesiones con menos de 2 series.
 */
export function distribute(total: number, weights: number[]): number[] {
  const n = weights.length
  const used = Math.max(1, Math.min(n, Math.floor(total / 2)))
  const chosen = weights
    .map((w, i) => ({ w, i }))
    .sort((a, b) => b.w - a.w || a.i - b.i)
    .slice(0, used)
    .map((c) => c.i)
  const sumW = chosen.reduce((s, i) => s + weights[i], 0)
  const raw = new Map(chosen.map((i) => [i, (total * weights[i]) / sumW]))
  const out = Array<number>(n).fill(0)
  for (const i of chosen) out[i] = Math.max(2, Math.floor(raw.get(i)!))
  let diff = total - out.reduce((a, b) => a + b, 0)
  while (diff < 0) {
    const j = chosen.filter((i) => out[i] > 2).sort((a, b) => out[b] - out[a])[0]
    out[j]--
    diff++
  }
  const byFraction = [...chosen].sort((a, b) => (raw.get(b)! % 1) - (raw.get(a)! % 1))
  for (let k = 0; diff > 0; k++, diff--) out[byFraction[k % byFraction.length]]++
  return out
}

function chunk(sets: number): number[] {
  const n = Math.ceil(sets / MAX_SETS_PER_EXERCISE)
  return Array.from({ length: n }, (_, i) => Math.floor(sets / n) + (i < sets % n ? 1 : 0))
}

export function estimateMinutes(exercises: PlannedExercise[]): number {
  let sec = 5 * 60 // calentamiento general
  const warmed = new Set<Muscle>()
  for (const pe of exercises) {
    const ex = getExercise(pe.exerciseId)
    sec += 60 // preparación del ejercicio
    if (!warmed.has(pe.muscle) && ex.category !== 'isolation') sec += ex.category === 'compound' ? 240 : 120
    sec += pe.sets * (45 + pe.restSec)
    warmed.add(pe.muscle)
  }
  return Math.round(sec / 60)
}

function emptyVolume(): Record<Muscle, MuscleVolume> {
  const v = {} as Record<Muscle, MuscleVolume>
  for (const m of MUSCLES) v[m] = { target: 0, direct: 0, indirect: 0, effective: 0, priority: false }
  return v
}

export function computeVolume(sessions: PlannedSession[], targets: Record<Muscle, number>, priorities: Muscle[]): Record<Muscle, MuscleVolume> {
  const v = emptyVolume()
  for (const m of MUSCLES) {
    v[m].target = targets[m]
    v[m].priority = priorities.includes(m)
  }
  for (const s of sessions) {
    for (const pe of s.exercises) {
      const ex = getExercise(pe.exerciseId)
      for (const m of ex.primary) v[m].direct += pe.sets
      for (const m of ex.secondary) v[m].indirect += pe.sets * INDIRECT_FACTOR
    }
  }
  for (const m of MUSCLES) v[m].effective = v[m].direct + v[m].indirect
  return v
}

function sortSession(s: SessionState, priorities: Muscle[]) {
  const order = (pe: PlannedExercise) =>
    CATEGORY_RANK[getExercise(pe.exerciseId).category] -
    (priorities.includes(pe.muscle) ? 3 : 0) +
    s.template.muscles.indexOf(pe.muscle) * 0.1
  s.exercises.sort((a, b) => order(a) - order(b))
}

type FitResult = 'fits' | 'trimmed' | 'removed' | 'over'

/**
 * Ajusta la sesión al tiempo disponible: primero recorta series (no prioritarios primero, mínimo 2),
 * luego quita aislamientos de músculos no prioritarios.
 */
function fitToTime(s: SessionState, maxMinutes: number, priorities: Muscle[]): FitResult {
  let result: FitResult = 'fits'
  while (estimateMinutes(s.exercises) > maxMinutes) {
    const candidates = s.exercises.filter((e) => e.sets > 2)
    const pool = candidates.filter((e) => !priorities.includes(e.muscle))
    const from = pool.length > 0 ? pool : candidates
    if (from.length === 0) break
    from.reduce((a, b) => (b.sets > a.sets ? b : a)).sets -= 1
    result = 'trimmed'
  }
  while (estimateMinutes(s.exercises) > maxMinutes) {
    const removable = s.exercises.filter(
      (e) =>
        !priorities.includes(e.muscle) &&
        getExercise(e.exerciseId).category === 'isolation' &&
        (INDIRECTLY_COVERED.includes(e.muscle) || s.exercises.filter((x) => x.muscle === e.muscle).length > 1),
    )
    if (removable.length === 0) return 'over'
    s.exercises.splice(s.exercises.lastIndexOf(removable[removable.length - 1]), 1)
    result = 'removed'
  }
  return result
}

export interface GenerateOptions {
  weeks?: number
  now?: Date
  id?: string
}

export function generatePlan(profile: Profile, opts: GenerateOptions = {}): Plan {
  const split = splitFor(profile.daysPerWeek)
  const targets = weeklyTargets(profile)
  const priorities = profile.priorityMuscles
  const sessions: SessionState[] = split.sessions.map((t) => ({ template: t, exercises: [] }))
  const ctx: Context = { profile, usedForMuscle: new Map() }
  const indirect = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>
  const warnings: string[] = []
  // Peso de cada sesión: cuantos más músculos trabaja, menos series recibe cada uno.
  const sessionWeight = sessions.map((s) => 1 / Math.sqrt(s.template.muscles.filter((m) => targets[m] > 0).length || 1))

  for (const m of ALLOCATION_ORDER) {
    const target = targets[m]
    if (target === 0) continue
    const idxs = sessions.map((s, i) => (s.template.muscles.includes(m) ? i : -1)).filter((i) => i >= 0)
    if (idxs.length === 0) continue

    const minDirect = priorities.includes(m) ? 4 : 2
    const direct = Math.max(minDirect, Math.round(target - indirect[m]))
    const perSession = distribute(direct, idxs.map((i) => sessionWeight[i]))

    idxs.forEach((sIdx, k) => {
      const session = sessions[sIdx]
      chunk(perSession[k]).forEach((sets, slot) => {
        if (sets === 0) return
        const ex = chooseExercise(m, slot, session, ctx)
        if (!ex) {
          warnings.push(`No hay ejercicios disponibles para ${MUSCLE_LABELS[m]} con el equipamiento y preferencias actuales.`)
          return
        }
        session.exercises.push({ exerciseId: ex.id, muscle: m, sets, repRange: repRangeFor(ex), restSec: restFor(ex) })
        if (!ctx.usedForMuscle.has(m)) ctx.usedForMuscle.set(m, new Set())
        ctx.usedForMuscle.get(m)!.add(ex.id)
        for (const sm of ex.secondary) indirect[sm] += sets * INDIRECT_FACTOR
      })
    })
  }

  const fit: Record<Exclude<FitResult, 'fits'>, string[]> = { trimmed: [], removed: [], over: [] }
  for (const s of sessions) {
    sortSession(s, priorities)
    const r = fitToTime(s, profile.sessionMinutes, priorities)
    if (r !== 'fits') fit[r].push(s.template.name)
  }
  if (fit.trimmed.length > 0) {
    warnings.push(`Se recortaron series en ${fit.trimmed.join(', ')} para ajustarse a ${profile.sessionMinutes} min por sesión.`)
  }
  if (fit.removed.length > 0) {
    warnings.push(`Se quitaron aislamientos no prioritarios en ${fit.removed.join(', ')} por falta de tiempo.`)
  }
  if (fit.over.length > 0) {
    warnings.push(
      `${fit.over.join(', ')} supera los ${profile.sessionMinutes} min aun recortando. ` +
        'Considera más días de entrenamiento, más tiempo por sesión o menos músculos prioritarios.',
    )
  }
  if (priorities.length > 3) {
    warnings.push(
      `Hay ${priorities.length} músculos prioritarios. Más de 3 a la vez suele elevar la fatiga; considera rotarlos entre mesociclos.`,
    )
  }

  const planned: PlannedSession[] = sessions.map((s) => ({
    name: s.template.name,
    focus: s.template.focus,
    exercises: s.exercises,
    estimatedMinutes: estimateMinutes(s.exercises),
  }))

  const weeklyVolume = computeVolume(planned, targets, priorities)
  for (const m of MUSCLES) {
    const v = weeklyVolume[m]
    if (v.target > 0 && v.effective < v.target - 2) {
      warnings.push(`${MUSCLE_LABELS[m]} queda en ${v.effective} series efectivas frente a ${v.target} objetivo.`)
    }
  }

  return {
    id: opts.id ?? crypto.randomUUID(),
    profileId: profile.id,
    createdAt: (opts.now ?? new Date()).toISOString(),
    weeks: opts.weeks ?? 6,
    split: split.name,
    sessions: planned,
    weeklyVolume,
    explanations: explainPlan(profile, split),
    warnings,
    active: true,
  }
}

function explainPlan(profile: Profile, split: Split): Explanation[] {
  const range = BASE_SETS[profile.experience]
  const poor = hasPoorRecovery(profile)
  const out: Explanation[] = [
    {
      title: `División: ${split.name}`,
      text: `${split.description} Se eligió según los ${profile.daysPerWeek} días disponibles.`,
      confidence: 'moderada',
      sourceIds: ['schoenfeld2016frequency'],
    },
    {
      title: 'Volumen inicial',
      text:
        `Para tu nivel el rango de partida es ${range.min}–${range.max} series efectivas por músculo y semana. ` +
        (profile.previousWeeklySets
          ? `Se parte de lo que ya venías haciendo (~${profile.previousWeeklySets} series), dentro de ese rango. `
          : `Se empieza en la zona baja-media (~${range.start}). `) +
        'El volumen solo aumentará si hay adherencia, buena recuperación y falta de progreso.',
      confidence: 'moderada',
      sourceIds: ['schoenfeld2017volume'],
    },
    {
      title: 'Cómo se cuentan las series',
      text: 'Una serie directa cuenta 1; una indirecta relevante (p. ej. tríceps en un press) cuenta 0.5. Los calentamientos no cuentan.',
      confidence: 'baja',
      sourceIds: ['schoenfeld2017volume'],
    },
    {
      title: 'Rangos de repeticiones',
      text: 'Compuestos 6–10, máquinas 8–12, aislamientos 10–15 y deltoides o pantorrillas hasta 20. La hipertrofia es similar en un amplio rango si las series se acercan al fallo.',
      confidence: 'moderada',
      sourceIds: ['schoenfeld2021loading'],
    },
    {
      title: 'Proximidad al fallo (RIR)',
      text: 'Semana 1 a RIR 3, semana 2 a RIR 2–3 y luego RIR 1–2. El fallo solo se permite en la última semana y en aislamientos seguros.',
      confidence: 'moderada',
      sourceIds: ['refalo2023failure', 'zourdos2016rir'],
    },
    {
      title: 'Descansos',
      text: '2–3 min en compuestos, ~2 min en máquinas y 60–120 s en aislamientos. Descansa más si lo necesitas para mantener el rendimiento.',
      confidence: 'baja',
      sourceIds: ['schoenfeld2016rest'],
    },
  ]
  if (profile.priorityMuscles.length > 0) {
    out.push({
      title: 'Músculos prioritarios',
      text:
        `${profile.priorityMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')} reciben +${poor ? 2 : 3} series semanales ` +
        'y se ubican antes en la sesión, cuando hay menos fatiga.',
      confidence: 'baja',
      sourceIds: ['schoenfeld2017volume'],
    })
  }
  if (poor) {
    out.push({
      title: 'Ajuste por recuperación',
      text: 'Por sueño, calidad de sueño o estrés reportados, el volumen inicial se redujo 2 series y el extra para prioridades se limitó a 2.',
      confidence: 'baja',
      sourceIds: [],
    })
  }
  if (profile.status === 'calibration') {
    out.push({
      title: 'Semana de calibración',
      text:
        'La primera semana sirve para encontrar cargas: elige pesos que te dejen ~3 repeticiones en reserva. ' +
        'Con esos registros la app estimará tu rendimiento y recomendará cargas.',
      confidence: 'moderada',
      sourceIds: ['halperin2022rir'],
    })
  }
  return out
}
