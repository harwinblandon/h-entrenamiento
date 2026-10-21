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
  adductors: 0,
  calves: 0.8,
  abs: 0.5,
}

/** Primero los músculos grandes: su trabajo aporta volumen indirecto a los pequeños. */
const ALLOCATION_ORDER: Muscle[] = [
  'chest', 'back', 'quads', 'hamstrings', 'delts_front', 'delts_side', 'glutes',
  'adductors', 'delts_rear', 'triceps', 'biceps', 'traps', 'calves', 'abs',
]

/** Músculos en los que el primer ejercicio de la sesión debería ser multiarticular. */
const COMPOUND_FIRST: Muscle[] = ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'delts_front']

/** Músculos del tren inferior (para el énfasis y los avisos). */
export const LOWER_BODY: Muscle[] = ['quads', 'hamstrings', 'glutes', 'adductors', 'calves']

/** Músculos que reciben trabajo indirecto suficiente de los compuestos como para prescindir de un aislamiento. */
const INDIRECTLY_COVERED: Muscle[] = ['biceps', 'triceps', 'delts_rear', 'traps', 'glutes', 'abs']

const MAX_SETS_PER_EXERCISE = 4
const MAX_SETS_SINGLE_EXERCISE = 5
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
const UPPER_B: Muscle[] = ['back', 'chest', 'delts_side', 'delts_rear', 'biceps', 'triceps', 'traps', 'delts_front']
const LOWER_QUADS: Muscle[] = ['quads', 'hamstrings', 'glutes', 'adductors', 'calves', 'abs']
const LOWER_HINGE: Muscle[] = ['hamstrings', 'glutes', 'quads', 'adductors', 'calves', 'abs']

export type SplitEmphasis = 'balanced' | 'lower'

/**
 * Divisiones por días disponibles. Cada músculo con objetivo aparece al menos en dos sesiones.
 * El énfasis en tren inferior entrena pierna y glúteo tres veces por semana manteniendo dos
 * estímulos para el tren superior.
 */
export function splitFor(days: number, emphasis: SplitEmphasis = 'balanced'): Split {
  const d = Math.min(6, Math.max(2, Math.round(days)))
  if (emphasis === 'lower' && d >= 3) return lowerSplit(d)
  switch (d) {
    case 2:
      return {
        name: 'Cuerpo completo ×2',
        description: 'Dos sesiones de cuerpo completo: cada músculo recibe dos estímulos semanales.',
        sessions: [
          { name: 'Cuerpo completo A', focus: 'Todos los grupos, énfasis en empujes y sentadilla', muscles: ['quads', 'chest', 'back', 'hamstrings', 'delts_side', 'triceps', 'biceps', 'calves', 'glutes', 'delts_rear', 'traps', 'abs', 'adductors', 'delts_front'] },
          { name: 'Cuerpo completo B', focus: 'Todos los grupos, énfasis en tracciones y bisagra', muscles: ['hamstrings', 'back', 'chest', 'quads', 'delts_side', 'biceps', 'triceps', 'calves', 'glutes', 'delts_rear', 'traps', 'abs', 'adductors', 'delts_front'] },
        ],
      }
    case 3:
      return {
        name: 'Cuerpo completo ×3',
        description: 'Tres sesiones de cuerpo completo; cada músculo se entrena dos veces por semana para que las sesiones no se alarguen.',
        sessions: [
          { name: 'Cuerpo completo A', focus: 'Sentadilla, empujes y tracción', muscles: ['quads', 'chest', 'back', 'hamstrings', 'delts_side', 'triceps', 'calves', 'abs', 'adductors', 'delts_front'] },
          { name: 'Cuerpo completo B', focus: 'Bisagra de cadera, tracciones y empuje', muscles: ['glutes', 'back', 'chest', 'hamstrings', 'delts_rear', 'biceps', 'traps', 'delts_side', 'delts_front'] },
          { name: 'Cuerpo completo C', focus: 'Pierna, hombro y brazos', muscles: ['quads', 'glutes', 'adductors', 'delts_rear', 'triceps', 'biceps', 'traps', 'calves', 'abs'] },
        ],
      }
    case 4:
      return {
        name: 'Torso / Pierna ×2',
        description: 'Cuatro sesiones alternando torso y pierna: dos estímulos semanales por músculo.',
        sessions: [
          { name: 'Torso A', focus: 'Empuje y tracción horizontales', muscles: UPPER },
          { name: 'Pierna A', focus: 'Énfasis en cuádriceps', muscles: LOWER_QUADS },
          { name: 'Torso B', focus: 'Empuje y tracción verticales', muscles: UPPER_B },
          { name: 'Pierna B', focus: 'Énfasis en isquiotibiales y glúteos', muscles: LOWER_HINGE },
        ],
      }
    case 5:
      return {
        name: 'Torso / Pierna / Empuje / Tracción / Pierna',
        description: 'Cinco sesiones; cada músculo recibe dos estímulos semanales repartidos en días distintos.',
        sessions: [
          { name: 'Torso', focus: 'Tren superior completo', muscles: ['chest', 'back', 'delts_side', 'delts_rear', 'triceps', 'biceps', 'traps'] },
          { name: 'Pierna A', focus: 'Énfasis en cuádriceps', muscles: LOWER_QUADS },
          { name: 'Empuje', focus: 'Pecho, hombro y tríceps', muscles: ['chest', 'delts_front', 'delts_side', 'triceps'] },
          { name: 'Tracción', focus: 'Espalda, deltoides posterior, bíceps y trapecio', muscles: ['back', 'delts_rear', 'biceps', 'traps'] },
          { name: 'Pierna B', focus: 'Énfasis en isquiotibiales y glúteos', muscles: LOWER_HINGE },
        ],
      }
    default:
      return {
        name: 'Empuje / Tracción / Pierna ×2',
        description: 'Seis sesiones; cada músculo recibe dos estímulos semanales.',
        sessions: [
          { name: 'Empuje A', focus: 'Pecho, hombro y tríceps', muscles: ['chest', 'delts_front', 'delts_side', 'triceps'] },
          { name: 'Tracción A', focus: 'Espalda, bíceps y trapecio', muscles: ['back', 'delts_rear', 'biceps', 'traps'] },
          { name: 'Pierna A', focus: 'Énfasis en cuádriceps', muscles: LOWER_QUADS },
          { name: 'Empuje B', focus: 'Hombro y pecho inclinado', muscles: ['delts_side', 'chest', 'delts_front', 'triceps'] },
          { name: 'Tracción B', focus: 'Tracción vertical y brazos', muscles: ['back', 'delts_rear', 'biceps', 'traps'] },
          { name: 'Pierna B', focus: 'Énfasis en isquiotibiales y glúteos', muscles: LOWER_HINGE },
        ],
      }
  }
}

function lowerSplit(d: number): Split {
  const description =
    'Énfasis en tren inferior: pierna y glúteo se entrenan tres veces por semana; el tren superior mantiene dos estímulos.'
  switch (d) {
    case 3:
      return {
        name: 'Cuerpo completo ×3 · énfasis inferior',
        description,
        sessions: [
          { name: 'Cuerpo completo A', focus: 'Cuádriceps, glúteo y empujes', muscles: ['quads', 'glutes', 'chest', 'back', 'delts_side', 'triceps', 'calves', 'adductors'] },
          { name: 'Cuerpo completo B', focus: 'Glúteo, isquios y tracciones', muscles: ['glutes', 'hamstrings', 'back', 'chest', 'delts_rear', 'biceps', 'traps', 'abs'] },
          { name: 'Cuerpo completo C', focus: 'Pierna completa, hombro y brazos', muscles: ['quads', 'hamstrings', 'glutes', 'adductors', 'delts_side', 'delts_rear', 'biceps', 'triceps', 'traps', 'calves', 'abs'] },
        ],
      }
    case 4:
      return {
        name: 'Pierna / Torso / Pierna / Cuerpo completo',
        description,
        sessions: [
          { name: 'Pierna A', focus: 'Cuádriceps y glúteo', muscles: ['quads', 'glutes', 'adductors', 'calves', 'abs'] },
          { name: 'Torso', focus: 'Tren superior completo', muscles: UPPER },
          { name: 'Pierna B', focus: 'Glúteo e isquiotibiales', muscles: ['hamstrings', 'glutes', 'quads', 'calves'] },
          { name: 'Cuerpo completo', focus: 'Glúteo, tracciones, empujes y brazos', muscles: ['glutes', 'back', 'chest', 'hamstrings', 'delts_side', 'delts_rear', 'biceps', 'triceps', 'traps', 'adductors', 'abs'] },
        ],
      }
    case 5:
      return {
        name: 'Pierna / Torso / Glúteo / Torso / Pierna',
        description,
        sessions: [
          { name: 'Pierna A', focus: 'Cuádriceps y glúteo', muscles: ['quads', 'glutes', 'adductors', 'calves', 'abs'] },
          { name: 'Torso A', focus: 'Empuje y tracción horizontales', muscles: UPPER },
          { name: 'Glúteo e isquios', focus: 'Glúteo e isquiotibiales', muscles: ['glutes', 'hamstrings', 'adductors', 'calves'] },
          { name: 'Torso B', focus: 'Empuje y tracción verticales', muscles: [...UPPER_B, 'abs'] },
          { name: 'Pierna B', focus: 'Pierna completa', muscles: ['hamstrings', 'quads', 'glutes', 'calves', 'abs'] },
        ],
      }
    default:
      return {
        name: 'Pierna / Empuje / Tracción / Glúteo / Torso / Pierna',
        description,
        sessions: [
          { name: 'Pierna A', focus: 'Cuádriceps y glúteo', muscles: ['quads', 'glutes', 'adductors', 'calves', 'abs'] },
          { name: 'Empuje', focus: 'Pecho, hombro y tríceps', muscles: ['chest', 'delts_front', 'delts_side', 'triceps'] },
          { name: 'Tracción', focus: 'Espalda, deltoides posterior, bíceps y trapecio', muscles: ['back', 'delts_rear', 'biceps', 'traps'] },
          { name: 'Glúteo e isquios', focus: 'Glúteo e isquiotibiales', muscles: ['glutes', 'hamstrings', 'adductors', 'calves'] },
          { name: 'Torso', focus: 'Tren superior completo', muscles: ['chest', 'back', 'delts_side', 'delts_rear', 'triceps', 'biceps', 'traps', 'abs'] },
          { name: 'Pierna B', focus: 'Pierna completa', muscles: ['hamstrings', 'quads', 'glutes', 'calves', 'abs'] },
        ],
      }
  }
}

/** Embarazo o posparto (dato de la ficha o respuesta de seguridad). */
export function isPregnancyOrPostpartum(p: Pick<Profile, 'lifeStage' | 'safety'>): boolean {
  return p.lifeStage === 'pregnancy' || p.lifeStage === 'postpartum' || p.safety.pregnancyPostpartum
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
  // En embarazo y posparto se parte del mínimo del rango.
  if (isPregnancyOrPostpartum(profile)) base = range.min
  const bonus = poorRecovery ? 2 : 3

  const lowerEmphasis = profile.splitEmphasis === 'lower'
  const targets = {} as Record<Muscle, number>
  for (const m of MUSCLES) {
    const priority = profile.priorityMuscles.includes(m)
    // Con énfasis en tren inferior, el tren superior no prioritario parte del mínimo del rango.
    const muscleBase = lowerEmphasis && !priority && !LOWER_BODY.includes(m) && m !== 'abs' ? range.min : base
    targets[m] = Math.round(muscleBase * muscleFactor(m, priority)) + (priority ? bonus : 0)
    if (muscleFactor(m, priority) === 0) targets[m] = 0
  }
  // En embarazo y posparto el trabajo directo de abdomen lo define el profesional (suelo pélvico, diástasis).
  if (isPregnancyOrPostpartum(profile)) targets.abs = 0
  return targets
}

/** Con prioridad, el glúteo se trata como músculo grande y los grupos sin objetivo propio reciben uno. */
function muscleFactor(m: Muscle, priority: boolean): number {
  if (!priority) return MUSCLE_FACTOR[m]
  if (m === 'glutes') return 1
  if (m === 'delts_front') return 0.6
  if (m === 'adductors') return 0.5
  return MUSCLE_FACTOR[m]
}

const CATEGORY_RANK: Record<ExerciseCategory, number> = { compound: 0, machine: 10, isolation: 20 }

interface SessionState {
  template: SessionTemplate
  exercises: PlannedExercise[]
}

interface Context {
  profile: Profile
  usedForMuscle: Map<Muscle, Set<string>>
  /** Ejercicios a conservar del mesociclo anterior (más peso que la variedad, menos que una preferencia). */
  keep: string[]
}

function chooseExercise(m: Muscle, slot: number, session: SessionState, ctx: Context): Exercise | undefined {
  const { profile } = ctx
  const usedInSession = new Set(session.exercises.map((e) => e.exerciseId))
  const usedThisWeek = ctx.usedForMuscle.get(m) ?? new Set<string>()
  const heavyInSession = session.exercises.some((e) => getExercise(e.exerciseId).fatigue === 3)
  const compoundFirst = COMPOUND_FIRST.includes(m)
  // Con barras, mancuernas, máquinas o poleas, los ejercicios sin carga medible quedan como alternativa.
  const hasLoaded = profile.equipment.some((e) => e === 'barbell' || e === 'dumbbell' || e === 'machine' || e === 'cable')
  const pregnancy = isPregnancyOrPostpartum(profile)

  let best: Exercise | undefined
  let bestScore = -Infinity
  EXERCISES.forEach((e, index) => {
    if (!e.primary.includes(m)) return
    if (!isAvailable(e, profile.equipment)) return
    if (profile.avoidExerciseIds.includes(e.id) || usedInSession.has(e.id)) return
    if (pregnancy && e.trunkFlexion) return

    let score = 0
    if (profile.preferredExerciseIds.includes(e.id)) score += 100
    if (ctx.keep.includes(e.id) && !usedThisWeek.has(e.id)) score += 30
    if (!usedThisWeek.has(e.id)) score += 20
    if (compoundFirst && slot === 0) score += { compound: 10, machine: 6, isolation: 0 }[e.category]
    else if (compoundFirst) score += { compound: 2, machine: 8, isolation: 6 }[e.category]
    else score += { compound: 0, machine: 5, isolation: 10 }[e.category]
    if (heavyInSession && e.fatigue === 3) score -= 15
    if (profile.experience === 'beginner' && e.category === 'machine') score += 3
    if (hasLoaded && e.increment === 0) score -= 25
    // Preferir ejercicios que trabajan el músculo estirado y los específicos de ese músculo.
    if (e.lengthened) score += 4
    if (e.primary.length === 1) score += 3
    // Quien empieza suele necesitar asistencia en las dominadas.
    if (profile.experience === 'beginner' && e.id === 'pull_up') score -= 8
    if (pregnancy && e.fatigue === 3) score -= 20
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
export function distribute(total: number, weights: number[], loads: number[] = []): number[] {
  const n = weights.length
  const used = Math.max(1, Math.min(n, Math.floor(total / 2)))
  // Si no caben en todas las sesiones, van a las menos cargadas hasta ahora (y luego a las de más peso).
  const chosen = weights
    .map((w, i) => ({ w, i, load: loads[i] ?? 0 }))
    .sort((a, b) => (used < n ? a.load - b.load : 0) || b.w - a.w || a.i - b.i)
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

/**
 * Divide las series de un músculo en una sesión entre ejercicios: hasta 5 series van en un solo
 * ejercicio; desde 6 se reparten con al menos 3 series por ejercicio (dividir en bloques de 2 añade
 * calentamientos y preparación sin aportar estímulo).
 */
function chunk(sets: number): number[] {
  const n = sets <= MAX_SETS_SINGLE_EXERCISE ? 1 : Math.ceil(sets / MAX_SETS_PER_EXERCISE)
  return Array.from({ length: n }, (_, i) => Math.floor(sets / n) + (i < sets % n ? 1 : 0))
}

export function estimateMinutes(exercises: PlannedExercise[]): number {
  let sec = 5 * 60 // calentamiento general
  const warmed = new Set<Muscle>()
  let firstCompound = true
  for (const pe of exercises) {
    const ex = getExercise(pe.exerciseId)
    sec += 60 // preparación del ejercicio
    // Aproximaciones: el primer compuesto de la sesión necesita más; luego basta con 1–2 series.
    if (!warmed.has(pe.muscle) && ex.category !== 'isolation') {
      sec += ex.category === 'compound' && firstCompound ? 240 : 120
      if (ex.category === 'compound') firstCompound = false
    }
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
 * empezando por el músculo que más sobra frente a su objetivo semanal; luego quita aislamientos de
 * músculos no prioritarios.
 */
function fitToTime(s: SessionState, maxMinutes: number, priorities: Muscle[], coverage: (m: Muscle) => number): FitResult {
  let result: FitResult = 'fits'
  while (estimateMinutes(s.exercises) > maxMinutes) {
    const candidates = s.exercises.filter((e) => e.sets > 2)
    const pool = candidates.filter((e) => !priorities.includes(e.muscle))
    const from = pool.length > 0 ? pool : candidates
    if (from.length === 0) break
    const score = (e: PlannedExercise) => coverage(e.muscle) * 10 + e.sets
    from.reduce((a, b) => (score(b) > score(a) ? b : a)).sets -= 1
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
  /** Ajuste de series semanales por músculo (desde el cierre del mesociclo anterior). */
  volumeDelta?: Partial<Record<Muscle, number>>
  /** Ejercicios que progresaron y conviene conservar. */
  keepExercises?: string[]
  /** Sustitutos elegidos (se prefieren) y ejercicios sustituidos (se evitan) en este mesociclo. */
  preferExercises?: string[]
  avoidExercises?: string[]
}

export function generatePlan(baseProfile: Profile, opts: GenerateOptions = {}): Plan {
  const profile: Profile = {
    ...baseProfile,
    preferredExerciseIds: [...baseProfile.preferredExerciseIds, ...(opts.preferExercises ?? [])],
    avoidExerciseIds: [...baseProfile.avoidExerciseIds, ...(opts.avoidExercises ?? [])],
  }
  const split = splitFor(profile.daysPerWeek, profile.splitEmphasis)
  const targets = weeklyTargets(profile)
  for (const [m, d] of Object.entries(opts.volumeDelta ?? {}) as [Muscle, number][]) {
    if (d) targets[m] = Math.max(0, targets[m] + d)
  }
  const priorities = profile.priorityMuscles
  const sessions: SessionState[] = split.sessions.map((t) => ({ template: t, exercises: [] }))
  const ctx: Context = { profile, usedForMuscle: new Map(), keep: opts.keepExercises ?? [] }
  const indirect = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>
  const warnings: string[] = []
  const limitedByEquipment = new Set<Muscle>()
  // Peso de cada sesión: cuantos más músculos trabaja, menos series recibe cada uno, para equilibrar la duración.
  const sessionWeight = sessions.map((s) => 1 / (s.template.muscles.filter((m) => targets[m] > 0).length || 1))

  for (const m of ALLOCATION_ORDER) {
    const target = targets[m]
    if (target === 0) continue
    const idxs = sessions.map((s, i) => (s.template.muscles.includes(m) ? i : -1)).filter((i) => i >= 0)
    if (idxs.length === 0) continue

    // Prioritarios: al menos la mitad del objetivo en trabajo directo, para que el indirecto no lo sustituya.
    const minDirect = priorities.includes(m) ? Math.max(4, Math.ceil(target * 0.5)) : 2
    const direct = Math.max(minDirect, Math.round(target - indirect[m]))
    const loads = idxs.map((i) => sessions[i].exercises.reduce((n, e) => n + e.sets, 0))
    const perSession = distribute(direct, idxs.map((i) => sessionWeight[i]), loads)

    idxs.forEach((sIdx, k) => {
      const session = sessions[sIdx]
      chunk(perSession[k]).forEach((sets, slot) => {
        if (sets === 0) return
        const ex = chooseExercise(m, slot, session, ctx)
        if (!ex) {
          // Sin otra variante disponible: las series se suman al ejercicio que ya trabaja ese músculo.
          // Tope de MAX_SETS_SINGLE_EXERCISE: el resto se pierde por falta de variantes.
          const existing = session.exercises.find((e) => e.muscle === m)
          const added = existing ? Math.min(sets, MAX_SETS_SINGLE_EXERCISE - existing.sets) : 0
          if (existing && added > 0) {
            existing.sets += added
            for (const sm of getExercise(existing.exerciseId).secondary) indirect[sm] += added * INDIRECT_FACTOR
          }
          if (added < sets) limitedByEquipment.add(m)
          return
        }
        session.exercises.push({ exerciseId: ex.id, muscle: m, sets, repRange: repRangeFor(ex), restSec: restFor(ex, profile.experience) })
        if (!ctx.usedForMuscle.has(m)) ctx.usedForMuscle.set(m, new Set())
        ctx.usedForMuscle.get(m)!.add(ex.id)
        for (const sm of ex.secondary) indirect[sm] += sets * INDIRECT_FACTOR
      })
    })
  }

  const fit: Record<Exclude<FitResult, 'fits'>, string[]> = { trimmed: [], removed: [], over: [] }
  // Cobertura semanal de cada músculo (efectivas / objetivo), recalculada a medida que se recorta.
  const coverage = (m: Muscle) => {
    const v = computeVolume(
      sessions.map((x) => ({ name: '', focus: '', exercises: x.exercises, estimatedMinutes: 0 })),
      targets,
      priorities,
    )[m]
    return v.target > 0 ? v.effective / v.target : 2
  }
  for (const s of sessions) {
    sortSession(s, priorities)
    const r = fitToTime(s, profile.sessionMinutes, priorities, coverage)
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
  const lowerPriorities = priorities.filter((m) => LOWER_BODY.includes(m))
  if ((profile.splitEmphasis ?? 'balanced') === 'balanced' && lowerPriorities.length >= 2 && profile.daysPerWeek >= 3) {
    warnings.push(
      `Tienes ${lowerPriorities.length} prioridades de tren inferior. Puedes activar el «énfasis en tren inferior» en la ficha para entrenar pierna tres veces por semana.`,
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
      warnings.push(
        `${MUSCLE_LABELS[m]} queda en ${v.effective} series efectivas frente a ${v.target} objetivo` +
          (limitedByEquipment.has(m) ? ' por pocas variantes con el equipamiento elegido.' : '.'),
      )
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
    warnings: [...new Set(warnings)],
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
  out.push({
    title: 'Selección de ejercicios',
    text:
      'Primero multiarticulares y luego aislamientos. Se prefieren ejercicios que cargan el músculo estirado ' +
      '(curl femoral sentado, extensión de tríceps sobre la cabeza, peso muerto rumano, sentadilla búlgara) y se ' +
      'evita repetir el mismo ejercicio para un músculo dentro de la semana.',
    confidence: 'moderada',
    sourceIds: ['maeo2021hamstrings', 'maeo2023triceps'],
  })
  out.push({
    title: 'Hombres y mujeres',
    text:
      'El plan no cambia por sexo: se ajusta por objetivo, prioridades, experiencia, recuperación y disponibilidad. ' +
      'Si buscas más desarrollo de pierna y glúteo, marca esos músculos como prioritarios y activa el énfasis en tren inferior.',
    confidence: 'moderada',
    sourceIds: ['plotkin2023glutes'],
  })
  if ((profile.splitEmphasis ?? 'balanced') === 'lower') {
    out.push({
      title: 'Énfasis en tren inferior',
      text:
        'Pierna y glúteo se entrenan tres veces por semana; el tren superior mantiene dos estímulos con volumen en la ' +
        'parte baja del rango, suficiente para seguir progresando. El glúteo recibe ' +
        'trabajo directo (hip thrust, hiperextensiones, patadas, abducción) además del indirecto de sentadillas y zancadas.',
      confidence: 'moderada',
      sourceIds: ['schoenfeld2016frequency', 'plotkin2023glutes'],
    })
  }
  if (isPregnancyOrPostpartum(profile)) {
    out.push({
      title: 'Embarazo o posparto',
      text:
        'Sin crunch ni trabajo directo de abdomen y con menos ejercicios de alta fatiga sistémica. Mantén RIR 3 o más, ' +
        'evita aguantar la respiración con cargas altas y sigue siempre las indicaciones de tu profesional.',
      confidence: 'moderada',
      sourceIds: ['acog2020pregnancy'],
    })
  }
  if (profile.lifeStage === 'menopause') {
    out.push({
      title: 'Perimenopausia y menopausia',
      text:
        'El entrenamiento de fuerza progresivo ayuda a conservar masa muscular y densidad ósea. Con buena técnica y ' +
        'supervisión, las cargas altas en ejercicios multiarticulares son seguras y útiles en esta etapa.',
      confidence: 'moderada',
      sourceIds: ['watson2018liftmor'],
    })
  }
  if (profile.priorityMuscles.length > 0) {
    out.push({
      title: 'Músculos prioritarios',
      text:
        `${profile.priorityMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')} reciben +${poor ? 2 : 3} series semanales ` +
        'y se ubican antes en la sesión, cuando hay menos fatiga. Al menos la mitad de su objetivo es trabajo directo.',
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
