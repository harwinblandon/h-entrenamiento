import { getExercise } from './exercises'
import { MUSCLE_LABELS } from './labels'
import { BASE_SETS, computeVolume, estimateMinutes, isPregnancyOrPostpartum, weeklyTargets } from './planGenerator'
import type { Confidence, Muscle, PlannedSession, Profile } from './types'
import { MUSCLES } from './types'

export type FindingLevel = 'warn' | 'info' | 'ok'

/** Observación sobre un plan: informa y recomienda, nunca bloquea. */
export interface Finding {
  id: string
  level: FindingLevel
  title: string
  text: string
  confidence: Confidence
  sourceIds: string[]
}

/** Grupos que conviene entrenar directamente; el resto suele recibir suficiente trabajo indirecto. */
const MAJOR: Muscle[] = ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'delts_side']
/** Series directas de un músculo en una sesión a partir de las cuales el rendimiento cae mucho. */
const SESSION_SET_LIMIT = 10
const PUSH = ['horizontal_press', 'incline_press', 'vertical_press', 'dip']
const PULL = ['horizontal_pull', 'vertical_pull']

export function reviewPlan(sessions: PlannedSession[], profile: Profile): Finding[] {
  const out: Finding[] = []
  const range = BASE_SETS[profile.experience]
  const volume = computeVolume(sessions, weeklyTargets(profile), profile.priorityMuscles)
  const excluded = (m: Muscle) => profile.muscleEmphasis?.[m] === 'none'
  const label = (m: Muscle) => MUSCLE_LABELS[m]

  // Volumen semanal por músculo frente a los rangos de la evidencia.
  const untouched = MUSCLES.filter((m) => MAJOR.includes(m) && volume[m].effective === 0 && !excluded(m))
  if (untouched.length) {
    out.push({
      id: 'untouched',
      level: 'warn',
      title: 'Grupos sin trabajo',
      text: `${untouched.map(label).join(', ')} no reciben ninguna serie. Si es intencional, márcalos como «No entrenar» en la ficha; si no, agrega al menos un ejercicio.`,
      confidence: 'alta',
      sourceIds: ['schoenfeld2017volume'],
    })
  }
  const chosenOut = MUSCLES.filter((m) => excluded(m))
  if (chosenOut.length) {
    out.push({
      id: 'excluded',
      level: 'info',
      title: 'Grupos que decidiste no entrenar',
      text: `${chosenOut.map(label).join(', ')}: sin trabajo directo por tu elección. Pueden mantenerse algo por el trabajo indirecto, pero no progresarán como el resto.`,
      confidence: 'moderada',
      sourceIds: [],
    })
  }
  const low = MUSCLES.filter((m) => MAJOR.includes(m) && !excluded(m) && volume[m].effective > 0 && volume[m].effective < Math.min(range.min, 6))
  if (low.length) {
    out.push({
      id: 'low-volume',
      level: 'info',
      title: 'Volumen bajo',
      text:
        `${low.map((m) => `${label(m)} (${volume[m].effective})`).join(', ')}: menos de ${Math.min(range.min, 6)} series efectivas por semana. ` +
        'Suele bastar para mantener, pero no para el máximo crecimiento.',
      confidence: 'moderada',
      sourceIds: ['schoenfeld2017volume'],
    })
  }
  const highLimit = range.max + 8
  const high = MUSCLES.filter((m) => volume[m].effective > highLimit)
  if (high.length) {
    out.push({
      id: 'high-volume',
      level: 'warn',
      title: 'Volumen muy alto',
      text:
        `${high.map((m) => `${label(m)} (${volume[m].effective})`).join(', ')}: más de ${highLimit} series efectivas por semana. ` +
        'Los beneficios se aplanan y la fatiga sigue subiendo; súbelo solo si progresas y te recuperas bien.',
      confidence: 'moderada',
      sourceIds: ['schoenfeld2017volume'],
    })
  }

  // Series por músculo en una misma sesión y frecuencia semanal.
  const crowded: string[] = []
  const directBySession = sessions.map((s) => {
    const d: Partial<Record<Muscle, number>> = {}
    for (const pe of s.exercises) for (const m of getExercise(pe.exerciseId).primary) d[m] = (d[m] ?? 0) + pe.sets
    return d
  })
  directBySession.forEach((d, i) => {
    for (const [m, n] of Object.entries(d) as [Muscle, number][]) {
      if (n > SESSION_SET_LIMIT) crowded.push(`${label(m)} en ${sessions[i].name} (${n})`)
    }
  })
  if (crowded.length) {
    out.push({
      id: 'session-sets',
      level: 'warn',
      title: 'Demasiadas series en una sesión',
      text:
        `${crowded.join(', ')}. Más de ${SESSION_SET_LIMIT} series directas de un músculo en un día rinden cada vez menos; ` +
        'repartirlas en otro día suele dar más resultado con la misma fatiga.',
      confidence: 'baja',
      sourceIds: ['schoenfeld2017volume'],
    })
  }
  const onceOnly = MUSCLES.filter(
    (m) => volume[m].direct >= 8 && directBySession.filter((d) => (d[m] ?? 0) > 0).length === 1 && sessions.length > 1,
  )
  if (onceOnly.length) {
    out.push({
      id: 'frequency',
      level: 'info',
      title: 'Un solo estímulo semanal',
      text: `${onceOnly.map(label).join(', ')} se entrenan un solo día con bastante volumen. Repartirlo en dos días suele favorecer la hipertrofia.`,
      confidence: 'moderada',
      sourceIds: ['schoenfeld2016frequency'],
    })
  }

  // Rangos de repeticiones.
  const veryLow: string[] = []
  const veryHigh: string[] = []
  for (const s of sessions) {
    for (const pe of s.exercises) {
      const name = getExercise(pe.exerciseId).name
      if (pe.repRange[1] < 5) veryLow.push(name)
      if (pe.repRange[0] > 20) veryHigh.push(name)
    }
  }
  if (veryLow.length) {
    out.push({
      id: 'reps-low',
      level: 'info',
      title: 'Repeticiones muy bajas',
      text:
        `${[...new Set(veryLow)].join(', ')}: menos de 5 repeticiones. También generan hipertrofia si el volumen es suficiente, ` +
        'pero cargan más las articulaciones y requieren más series para el mismo estímulo.',
      confidence: 'moderada',
      sourceIds: ['schoenfeld2021loading'],
    })
  }
  if (veryHigh.length) {
    out.push({
      id: 'reps-high',
      level: 'info',
      title: 'Repeticiones muy altas',
      text:
        `${[...new Set(veryHigh)].join(', ')}: más de 20 repeticiones. Funcionan si llegas cerca del fallo, pero el esfuerzo ` +
        'es más incómodo y es fácil quedarse lejos de él.',
      confidence: 'moderada',
      sourceIds: ['schoenfeld2021loading'],
    })
  }

  // Duración, fatiga y orden.
  const long = sessions.filter((s) => estimateMinutes(s.exercises) > profile.sessionMinutes + 10)
  if (long.length) {
    out.push({
      id: 'duration',
      level: 'warn',
      title: 'Sesiones más largas que tu tiempo',
      text: `${long.map((s) => `${s.name} (~${estimateMinutes(s.exercises)} min)`).join(', ')} superan los ${profile.sessionMinutes} min de tu ficha.`,
      confidence: 'moderada',
      sourceIds: [],
    })
  }
  const heavy = sessions.filter((s) => s.exercises.filter((pe) => getExercise(pe.exerciseId).fatigue === 3).length >= 3)
  if (heavy.length) {
    out.push({
      id: 'fatigue',
      level: 'warn',
      title: 'Muchos ejercicios de alta fatiga juntos',
      text: `${heavy.map((s) => s.name).join(', ')} tienen 3 o más ejercicios muy exigentes (sentadilla, peso muerto, remo con barra…). El rendimiento de los últimos suele caer.`,
      confidence: 'baja',
      sourceIds: [],
    })
  }
  const misordered: string[] = []
  for (const s of sessions) {
    s.exercises.forEach((pe, i) => {
      const ex = getExercise(pe.exerciseId)
      if (ex.category !== 'isolation') return
      const laterCompound = s.exercises.slice(i + 1).some((x) => {
        const other = getExercise(x.exerciseId)
        return other.category === 'compound' && other.primary.some((m) => ex.primary.includes(m))
      })
      if (laterCompound) misordered.push(`${ex.name} (${s.name})`)
    })
  }
  if (misordered.length) {
    out.push({
      id: 'order',
      level: 'info',
      title: 'Aislamiento antes que el compuesto',
      text: `${misordered.join(', ')} va antes de un multiarticular del mismo músculo. Es válido como preagotamiento, pero reduce la carga del compuesto.`,
      confidence: 'baja',
      sourceIds: [],
    })
  }

  // Equilibrio entre grupos opuestos.
  const setsByPattern = (patterns: string[]) =>
    sessions.flatMap((s) => s.exercises).filter((pe) => patterns.includes(getExercise(pe.exerciseId).pattern)).reduce((n, pe) => n + pe.sets, 0)
  const push = setsByPattern(PUSH)
  const pull = setsByPattern(PULL)
  if (push >= 8 && push > pull * 1.5) {
    out.push({
      id: 'push-pull',
      level: 'info',
      title: 'Más empujes que tracciones',
      text: `${push} series de empuje frente a ${pull} de tracción. Equilibrarlas protege la salud del hombro y la postura.`,
      confidence: 'baja',
      sourceIds: [],
    })
  }
  if (volume.quads.effective >= 8 && volume.hamstrings.effective < volume.quads.effective / 2 && !excluded('hamstrings')) {
    out.push({
      id: 'quads-hams',
      level: 'info',
      title: 'Cuádriceps mucho más trabajado que isquiotibiales',
      text: `${volume.quads.effective} frente a ${volume.hamstrings.effective} series. Un curl femoral o un peso muerto rumano equilibran la pierna.`,
      confidence: 'baja',
      sourceIds: [],
    })
  }

  // Seguridad y preferencias de la ficha.
  const avoided = [...new Set(sessions.flatMap((s) => s.exercises).filter((pe) => profile.avoidExerciseIds.includes(pe.exerciseId)).map((pe) => getExercise(pe.exerciseId).name))]
  if (avoided.length) {
    out.push({
      id: 'avoided',
      level: 'warn',
      title: 'Ejercicios que marcaste para evitar',
      text: `${avoided.join(', ')} está en tu lista de ejercicios a evitar.`,
      confidence: 'alta',
      sourceIds: [],
    })
  }
  if (isPregnancyOrPostpartum(profile) && sessions.some((s) => s.exercises.some((pe) => getExercise(pe.exerciseId).trunkFlexion))) {
    out.push({
      id: 'pregnancy',
      level: 'warn',
      title: 'Flexión de tronco en embarazo o posparto',
      text: 'El plan incluye crunch o elevaciones de piernas. Consulta con tu profesional antes de hacer trabajo directo de abdomen.',
      confidence: 'moderada',
      sourceIds: ['acog2020pregnancy'],
    })
  }

  if (!out.some((f) => f.level === 'warn')) {
    out.unshift({
      id: 'ok',
      level: 'ok',
      title: 'Plan coherente con la evidencia',
      text: 'Volumen, frecuencia, repeticiones y duración dentro de rangos razonables. Las notas informativas son matices, no errores.',
      confidence: 'moderada',
      sourceIds: ['schoenfeld2017volume'],
    })
  }
  return out
}
