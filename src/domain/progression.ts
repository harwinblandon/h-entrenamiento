import { getExercise, isLoadless } from './exercises'
import type { Exercise, LoggedExercise, LoggedSet, Muscle, WorkoutLog } from './types'

/** Umbral de dolor (0–10) a partir del cual se detiene el ejercicio. */
export const PAIN_STOP = 4

/**
 * 1RM estimado ajustado por RIR (Epley sobre repeticiones hasta el fallo).
 * Permite comparar 80 kg × 8 @RIR2 con 85 kg × 6 @RIR1.
 */
export function estimate1RM(weight: number, reps: number, rir: number): number {
  if (weight <= 0 || reps <= 0) return 0
  const toFailure = reps + Math.max(0, rir)
  return weight * (1 + toFailure / 30)
}

export function bestE1RM(sets: LoggedSet[]): number {
  return sets.reduce((best, s) => Math.max(best, estimate1RM(s.weight, s.reps, s.rir)), 0)
}

export function roundToIncrement(load: number, increment: number): number {
  if (increment <= 0) return Math.round(load * 2) / 2
  return Math.round(load / increment) * increment
}

const fmt = (n: number) => Number(n.toFixed(2)).toString()

/** RIR objetivo [mín, máx] según la semana del mesociclo. */
export function rirTarget(week: number, weeks: number, ex: Exercise): [number, number] {
  if (week <= 1) return [3, 3]
  if (week === 2) return [2, 3]
  if (week >= weeks && ex.failureSafe && ex.category === 'isolation') return [0, 1]
  return [1, 2]
}

export type SetAction = 'stop' | 'reduce' | 'keep' | 'increase' | 'adjust_reps'

export interface SetSuggestion {
  action: SetAction
  weight: number
  repsTarget: [number, number]
  message: string
}

/** Sugerencia para la siguiente serie a partir de la que se acaba de registrar. */
export function suggestNextSet(
  set: LoggedSet,
  repRange: [number, number],
  rir: [number, number],
  ex: Exercise,
): SetSuggestion {
  const [lo, hi] = repRange
  const loadless = isLoadless(ex)
  const step = Math.max(ex.increment, roundToIncrement(set.weight * 0.025, ex.increment))
  const down = (pct: number) => Math.max(0, roundToIncrement(set.weight * (1 - pct), ex.increment))

  if (set.pain >= PAIN_STOP) {
    return {
      action: 'stop',
      weight: set.weight,
      repsTarget: repRange,
      message: `Dolor ${set.pain}/10: detén este ejercicio. Prueba una sustitución sin dolor o consulta a un profesional si persiste.`,
    }
  }
  if (set.technique === 'deteriorated' || set.reps < lo) {
    const w = down(0.075)
    return {
      action: 'reduce',
      weight: w,
      repsTarget: repRange,
      message: loadless
        ? `${set.technique === 'deteriorated' ? 'La técnica se deterioró' : `Quedaste por debajo de ${lo} repeticiones`}: reduce la dificultad (menos inclinación o una variante más fácil).`
        : set.technique === 'deteriorated'
          ? `La técnica se deterioró: baja a ${fmt(w)} kg y prioriza el control.`
          : `Quedaste por debajo de ${lo} repeticiones: baja a ${fmt(w)} kg para volver al rango.`,
    }
  }
  if (set.rir < rir[0] - 1 || (set.rir < rir[0] && set.pain > 0)) {
    const w = down(0.05)
    return {
      action: 'reduce',
      weight: w,
      repsTarget: repRange,
      message: loadless
        ? `Estuviste más cerca del fallo de lo previsto (RIR ${set.rir}): reduce un poco la dificultad.`
        : `Estuviste más cerca del fallo de lo previsto (RIR ${set.rir}): baja a ${fmt(w)} kg.`,
    }
  }
  if (set.rir > rir[1] + 1 && set.reps >= hi) {
    return {
      action: 'increase',
      weight: loadless ? set.weight : set.weight + step,
      repsTarget: repRange,
      message: loadless
        ? `Te sobraron repeticiones (RIR ${set.rir}) en el tope del rango: aumenta la dificultad (más inclinación, una pierna o pausas).`
        : `Te sobraron repeticiones (RIR ${set.rir}) en el tope del rango: sube a ${fmt(set.weight + step)} kg.`,
    }
  }
  if (set.rir > rir[1]) {
    return {
      action: 'adjust_reps',
      weight: set.weight,
      repsTarget: [Math.min(set.reps + 1, hi + 2), hi + 2],
      message: `RIR ${set.rir} por encima del objetivo (${rir[0]}–${rir[1]}): mantén ${fmt(set.weight)} kg y haz más repeticiones.`,
    }
  }
  if (set.pain > 0) {
    return {
      action: 'keep',
      weight: set.weight,
      repsTarget: repRange,
      message: `Molestia ${set.pain}/10: mantén la carga y vigílala. Si sube a ${PAIN_STOP} o más, detente.`,
    }
  }
  return {
    action: 'keep',
    weight: set.weight,
    repsTarget: [Math.max(lo, set.reps - 1), hi],
    message: `Serie dentro de lo previsto: mantén ${fmt(set.weight)} kg.`,
  }
}

export interface LoadRecommendation {
  weight: number | null
  repsTarget: [number, number]
  reason: string
}

/**
 * Doble progresión: con la misma carga se suben repeticiones hasta el tope del rango en todas
 * las series; entonces se sube la carga 2.5–5 % y se vuelve a la parte baja del rango.
 * Si el salto mínimo de carga supera el 5 %, se exigen 2 repeticiones extra antes de subir.
 */
export function recommendLoad(
  last: LoggedExercise | undefined,
  repRange: [number, number],
  rir: [number, number],
  ex: Exercise,
): LoadRecommendation {
  const [lo, hi] = repRange
  const sets = last?.sets ?? []
  if (sets.length === 0) {
    return {
      weight: null,
      repsTarget: repRange,
      reason: isLoadless(ex)
        ? `Sin registros previos: elige una inclinación o variante con la que hagas ${hi} repeticiones dejando ~3 en reserva.`
        : `Sin registros previos: elige una carga con la que hagas ${hi} repeticiones dejando ~3 en reserva.`,
    }
  }
  // La carga de referencia es la más usada en la última sesión.
  const counts = new Map<number, number>()
  for (const s of sets) counts.set(s.weight, (counts.get(s.weight) ?? 0) + 1)
  const load = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]
  const atLoad = sets.filter((s) => s.weight === load)

  if (sets.some((s) => s.pain >= PAIN_STOP)) {
    return { weight: load, repsTarget: repRange, reason: 'Hubo dolor relevante la última vez: valora una sustitución antes de progresar.' }
  }
  if (atLoad.some((s) => s.technique === 'deteriorated') || atLoad.some((s) => s.reps < lo)) {
    const w = roundToIncrement(load * 0.95, ex.increment)
    const fix = isLoadless(ex) ? 'usa una variante o inclinación más fácil' : `baja a ${fmt(w)} kg`
    return { weight: w, repsTarget: repRange, reason: `La última vez la técnica falló o quedaste bajo ${lo} repeticiones: ${fix} y consolida.` }
  }

  const jumpPct = load > 0 ? ex.increment / load : 0
  const top = jumpPct > 0.05 ? hi + 2 : hi
  const reachedTop = atLoad.length >= Math.min(last!.plannedSets, sets.length) && atLoad.every((s) => s.reps >= top && s.rir >= rir[0])

  if (reachedTop && isLoadless(ex)) {
    return {
      weight: load,
      repsTarget: [lo, Math.min(hi, lo + 2)],
      reason: `Alcanzaste ${top} repeticiones en todas las series: aumenta la dificultad (más inclinación, una pierna o pausas) y vuelve a ${lo}–${Math.min(hi, lo + 2)}.`,
    }
  }
  if (reachedTop) {
    const pctStep = roundToIncrement(load * 0.025, ex.increment)
    const w = load + Math.max(ex.increment, pctStep)
    const note = jumpPct > 0.05 ? ` El salto mínimo (${fmt(ex.increment)} kg) es de ${Math.round(jumpPct * 100)} %, por eso se pidieron ${top} repeticiones antes de subir.` : ''
    return {
      weight: w,
      repsTarget: [lo, Math.min(hi, lo + 2)],
      reason: `Alcanzaste ${top} repeticiones en todas las series con buena técnica: sube a ${fmt(w)} kg y vuelve a ${lo}–${Math.min(hi, lo + 2)}.${note}`,
    }
  }
  const minReps = Math.min(...atLoad.map((s) => s.reps))
  return {
    weight: load,
    repsTarget: [Math.min(minReps + 1, top), top],
    reason: `Mantén ${fmt(load)} kg y busca sumar repeticiones hasta ${top} en todas las series.`,
  }
}

export interface WarmupSet {
  weight: number | null
  pct: number
  reps: number
}

/** Series de aproximación sugeridas; no cuentan como series efectivas. */
export function warmupSets(workingWeight: number | null, ex: Exercise, firstForMuscle: boolean): WarmupSet[] {
  let scheme: { pct: number; reps: number }[]
  if (ex.category === 'compound' && firstForMuscle) scheme = [{ pct: 0.5, reps: 8 }, { pct: 0.7, reps: 4 }, { pct: 0.85, reps: 2 }]
  else if (firstForMuscle) scheme = [{ pct: 0.6, reps: 6 }]
  else if (ex.category === 'compound') scheme = [{ pct: 0.7, reps: 4 }]
  else scheme = []
  return scheme.map((s) => ({
    pct: s.pct,
    reps: s.reps,
    weight: workingWeight ? roundToIncrement(workingWeight * s.pct, ex.increment) : null,
  }))
}

export function lastEntryFor(exerciseId: string, logs: WorkoutLog[], excludeLogId?: string): LoggedExercise | undefined {
  const sorted = logs
    .filter((l) => l.finishedAt && l.id !== excludeLogId)
    .sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))
  for (const l of sorted) {
    const e = l.entries.find((x) => x.exerciseId === exerciseId && x.sets.length > 0)
    if (e) return e
  }
  return undefined
}

export interface SessionSummary {
  setsDone: number
  setsPlanned: number
  compliancePct: number
  totalReps: number
  tonnage: number
  volumeByMuscle: Partial<Record<Muscle, number>>
  progressed: string[]
  regressed: string[]
  painFlags: string[]
  recommendation: string
}

export function summarizeSession(log: WorkoutLog, history: WorkoutLog[]): SessionSummary {
  let setsDone = 0
  let setsPlanned = 0
  let totalReps = 0
  let tonnage = 0
  const volumeByMuscle: Partial<Record<Muscle, number>> = {}
  const progressed: string[] = []
  const regressed: string[] = []
  const painFlags: string[] = []

  for (const entry of log.entries) {
    const ex = getExercise(entry.exerciseId)
    setsPlanned += entry.plannedSets
    setsDone += entry.sets.length
    for (const s of entry.sets) {
      totalReps += s.reps
      tonnage += s.weight * s.reps
    }
    for (const m of ex.primary) volumeByMuscle[m] = (volumeByMuscle[m] ?? 0) + entry.sets.length
    for (const m of ex.secondary) volumeByMuscle[m] = (volumeByMuscle[m] ?? 0) + entry.sets.length * 0.5
    if (entry.sets.some((s) => s.pain >= PAIN_STOP)) painFlags.push(ex.name)

    const prev = lastEntryFor(entry.exerciseId, history, log.id)
    if (prev && entry.sets.length > 0) {
      const now = bestE1RM(entry.sets.filter((s) => s.technique === 'stable'))
      const before = bestE1RM(prev.sets)
      if (now > before * 1.005) progressed.push(ex.name)
      else if (now < before * 0.97) regressed.push(ex.name)
    }
  }

  const compliancePct = setsPlanned > 0 ? Math.round((setsDone / setsPlanned) * 100) : 0
  let recommendation: string
  if (painFlags.length > 0) {
    recommendation = `Hubo dolor relevante en ${painFlags.join(', ')}. La próxima vez usa una sustitución y, si persiste, consulta a un profesional.`
  } else if ((log.fatigue ?? 0) >= 4 && regressed.length > 0) {
    recommendation = 'Fatiga alta y rendimiento por debajo de la sesión anterior. Prioriza sueño y recuperación; si se repite, valora reducir volumen.'
  } else if (compliancePct < 80) {
    recommendation = 'Completaste menos del 80 % de las series. Si el tiempo fue el límite, ajusta la duración de la sesión en tu perfil.'
  } else if (progressed.length > 0) {
    recommendation = 'Buen progreso. Mantén el plan: sigue sumando repeticiones y sube carga al llegar al tope del rango.'
  } else {
    recommendation = 'Sesión completada. Busca superar repeticiones o carga en la próxima exposición sin perder técnica.'
  }

  return { setsDone, setsPlanned, compliancePct, totalReps, tonnage, volumeByMuscle, progressed, regressed, painFlags, recommendation }
}
