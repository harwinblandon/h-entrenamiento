export type Sex = 'male' | 'female'
export type Experience = 'beginner' | 'intermediate' | 'advanced'
export type Goal = 'gain' | 'maintain' | 'cut'
export type JobActivity = 'sedentary' | 'moderate' | 'active'
export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'smith',
  'pullup_bar',
  'dip_station',
  'suspension',
  'household',
  'bodyweight',
] as const
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
  /** Registro de comidas: con pesos exactos o con porciones de la mano y medidas caseras. */
  foodMode?: 'precise' | 'hands'
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
  /** Dificultad técnica o de fuerza mínima: 1 apta para empezar, 2 intermedia (por defecto), 3 exigente. */
  difficulty?: 1 | 2 | 3
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
  /** Minutos de caminata o cardio moderado del día. */
  activityMinutes?: number
  /** Pasos del día (del reloj o del celular). */
  steps?: number
}

/** Valores nutricionales: kcal, proteína, grasa, carbohidratos y fibra (g). */
export interface Macros {
  kcal: number
  p: number
  f: number
  c: number
  fib: number
}

export type MealSlot = 'breakfast' | 'midmorning' | 'lunch' | 'afternoon' | 'dinner'
export type FoodState = 'raw' | 'cooked'

/** Grasa usada al cocinar, ya dividida entre las porciones que se prepararon. */
export interface AddedFat {
  foodKey: string
  name: string
  /** Gramos que le corresponden a esta porción. */
  grams: number
  per100: Macros
  /** Cómo se midió, p. ej. «1 cucharada para 5 porciones». */
  note: string
  input?: { measure: 'tsp' | 'tbsp' | 'g'; amount: number; portions: number }
}

export interface FoodLog {
  id: string
  profileId: string
  date: string
  meal: MealSlot
  /** Alimento de la base, receta, «usda:<id>» o «custom:<id>». */
  foodKey: string
  name: string
  state: FoodState
  grams: number
  /** Medida usada si no fue en gramos (medida casera o porción de mano). */
  measure?: { label: string; count: number }
  /** Valores por 100 g en el momento del registro (no cambian si se actualiza la base). */
  per100: Macros
  addedFat?: AddedFat
  createdAt: string
}

/** Datos de un producto empacado tomados de su tabla nutricional. */
export interface FoodLabel {
  name: string
  brand?: string
  barcode?: string
  per100: Macros
  /** Porción del empaque, si se registró. */
  portion?: { label: string; grams: number }
}

/** Producto propio guardado solo en esta cuenta o dispositivo (cuando no hay sesión en la nube). */
export interface CustomFood extends FoodLabel {
  id: string
  profileId: string
  fatPrompt?: boolean
  createdAt: string
}

export interface SharedFoodVersion extends FoodLabel {
  byName: string
  at: number
}

/** Producto de la lista común del grupo (Firestore sharedFoods/{id}); solo el administrador lo corrige. */
export interface SharedFood extends FoodLabel {
  id: string
  /** De dónde salieron los datos: etiqueta copiada a mano u Open Food Facts. */
  source: 'label' | 'off'
  createdBy: string
  createdByName: string
  createdAt: number
  updatedBy: string
  updatedByName: string
  updatedAt: number
  /** Versiones anteriores, de la más reciente a la más antigua (máximo 10). */
  versions: SharedFoodVersion[]
}

/** Error reportado en un producto de la lista común, para que el administrador lo revise. */
export interface FoodReport {
  id: string
  foodId: string
  foodName: string
  message: string
  by: string
  byName: string
  at: number
}
