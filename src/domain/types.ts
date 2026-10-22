export type Sex = 'male' | 'female'
export type Experience = 'beginner' | 'intermediate' | 'advanced'
export type Goal = 'gain' | 'maintain' | 'cut'
export type JobActivity = 'sedentary' | 'moderate' | 'active'
export const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'smith', 'suspension', 'bodyweight'] as const
export type Equipment = (typeof EQUIPMENT)[number]
export type LifeStage = 'none' | 'menstrual_tracking' | 'menopause' | 'pregnancy' | 'postpartum'
export type ExerciseCategory = 'compound' | 'machine' | 'isolation'
export type Confidence = 'alta' | 'moderada' | 'baja'

export const MUSCLES = [
  'chest',
  'back',
  'traps',
  'delts_front',
  'delts_side',
  'delts_rear',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'calves',
  'abs',
] as const
export type Muscle = (typeof MUSCLES)[number]

export interface SafetyAnswers {
  chestPain: boolean
  dizziness: boolean
  cardiovascular: boolean
  uncontrolledHypertension: boolean
  recentInjury: boolean
  jointPain: boolean
  recentSurgery: boolean
  pregnancyPostpartum: boolean
  otherCondition: boolean
  eatingDisorderHistory: boolean
  /** La persona confirma autorización de un profesional de la salud para entrenar. */
  medicalClearance: boolean
}

export interface PinLock {
  hash: string
  salt: string
}

export type MuscleEmphasis = 'less' | 'none'
export type RepPreference = 'low' | 'mixed' | 'high'

export interface CardioPrefs {
  modalities: string[]
  daysPerWeek: number
  /** Minutos típicos por sesión de cardio. */
  minutes: number
}

export interface Profile {
  id: string
  name: string
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  /** Fecha (YYYY-MM-DD) en que se midió el peso de la ficha, si se conoce. */
  weightDate?: string
  waistCm?: number
  bodyFatPct?: number
  experience: Experience
  daysPerWeek: number
  sessionMinutes: number
  /** Equipamiento disponible. */
  equipment: Equipment[]
  job: JobActivity
  dailySteps?: number
  sleepHours: number
  /** 1 = muy mala, 5 = excelente */
  sleepQuality: number
  /** 1 = muy bajo, 5 = muy alto */
  stress: number
  injuries: string
  avoidExerciseIds: string[]
  preferredExerciseIds: string[]
  goal: Goal
  priorityMuscles: Muscle[]
  /** Énfasis de la división: equilibrada o con más frecuencia de tren inferior. */
  splitEmphasis?: 'balanced' | 'lower'
  /** Ajuste por músculo elegido por la persona (además de los prioritarios, que equivalen a «más»). */
  muscleEmphasis?: Partial<Record<Muscle, MuscleEmphasis>>
  /** Preferencia de repeticiones: bajas, mixtas (por defecto) o altas. */
  repPreference?: RepPreference
  /** Series semanales por músculo que la persona venía haciendo (aprox.). */
  previousWeeklySets?: number
  supplements: string[]
  supplementsNotes: string
  cardio: CardioPrefs
  lifeStage: LifeStage
  lifeStageNotes: string
  safety: SafetyAnswers
  status: 'calibration' | 'active'
  /** Clave de acceso opcional (solo el hash, nunca el número). */
  pin?: PinLock
  createdAt: string
  updatedAt: string
}

export interface Exercise {
  id: string
  name: string
  primary: Muscle[]
  secondary: Muscle[]
  category: ExerciseCategory
  pattern: string
  equipment: Equipment
  /** Incremento mínimo de carga disponible, en kg. */
  increment: number
  /** Si es razonablemente seguro llevarlo al fallo. */
  failureSafe: boolean
  /** Costo de fatiga sistémica: 1 bajo, 3 alto. */
  fatigue: 1 | 2 | 3
  repRange?: [number, number]
  loadNote?: string
  /** Carga el músculo en posición estirada; la evidencia reciente sugiere más hipertrofia. */
  lengthened?: boolean
  /** Flexión de tronco (crunch, elevaciones de piernas): se evita en embarazo y posparto. */
  trunkFlexion?: boolean
  /** Con mancuernas la carga se queda corta para quien ya es fuerte (se evita en intermedios y avanzados con barra). */
  loadLimited?: boolean
  /** Máquina asistida: más kilos = más fácil; progresa reduciendo la asistencia. */
  assisted?: boolean
  /** Cómo progresar cuando no hay carga medible. */
  progressionHint?: string
  cues: string[]
}

export interface Explanation {
  title: string
  text: string
  confidence: Confidence
  sourceIds: string[]
}

export interface PlannedExercise {
  exerciseId: string
  muscle: Muscle
  sets: number
  repRange: [number, number]
  restSec: number
}

export interface PlannedSession {
  name: string
  focus: string
  exercises: PlannedExercise[]
  estimatedMinutes: number
}

export interface MuscleVolume {
  target: number
  direct: number
  indirect: number
  effective: number
  priority: boolean
}

export interface Plan {
  id: string
  profileId: string
  createdAt: string
  weeks: number
  split: string
  sessions: PlannedSession[]
  weeklyVolume: Record<Muscle, MuscleVolume>
  explanations: Explanation[]
  warnings: string[]
  active: boolean
  /** Datos de la ficha que influyen en el plan, tal como estaban al generarlo. */
  profileSnapshot?: PlanSnapshot
  /** «deload»: semana de descarga entre mesociclos. */
  kind?: 'mesocycle' | 'deload'
  /** Mesociclo ya preparado que empieza al terminar la descarga. */
  queued?: boolean
  /** Ajustes aplicados desde el cierre del mesociclo anterior, en texto. */
  adjustments?: string[]
  /** La persona editó el plan a mano (regenerarlo descarta esos cambios). */
  custom?: boolean
}

export interface PlanSnapshot {
  daysPerWeek: number
  splitEmphasis?: 'balanced' | 'lower'
  muscleEmphasis?: Partial<Record<Muscle, MuscleEmphasis>>
  repPreference?: RepPreference
  sessionMinutes: number
  experience: Experience
  previousWeeklySets?: number
  poorRecovery: boolean
  priorityMuscles: Muscle[]
  equipment: Equipment[]
  avoidExerciseIds: string[]
  preferredExerciseIds: string[]
}

export type Technique = 'stable' | 'deteriorated'

export interface LoggedSet {
  weight: number
  reps: number
  rir: number
  /** 0 = sin dolor, 10 = máximo */
  pain: number
  technique: Technique
}

export interface LoggedExercise {
  exerciseId: string
  /** Ejercicio original del plan si se sustituyó. */
  substitutedFrom?: string
  muscle: Muscle
  plannedSets: number
  repRange: [number, number]
  rirTarget: [number, number]
  restSec: number
  sets: LoggedSet[]
  stopped?: boolean
}

export interface WorkoutLog {
  id: string
  profileId: string
  planId: string
  week: number
  sessionIndex: number
  startedAt: string
  finishedAt?: string
  entries: LoggedExercise[]
  /** Fatiga percibida al terminar, 1–5. */
  fatigue?: number
  /** Cómo llegó a la sesión: «reduced» si se ajustó por cansancio, sueño, estrés o síntomas. */
  readiness?: 'normal' | 'reduced'
  /** Sesión de una semana de descarga. */
  deload?: boolean
  notes?: string
}

export interface BodyLog {
  id: string
  profileId: string
  date: string
  weightKg?: number
  waistCm?: number
}
