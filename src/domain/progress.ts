import { getExercise } from './exercises'
import { estimate1RM } from './progression'
import type { BodyLog, LoggedSet, Muscle, Plan, WorkoutLog } from './types'
import { MUSCLES } from './types'

const DAY = 86_400_000
const dayTime = (iso: string) => Date.parse(iso.slice(0, 10))

export interface WeightPoint {
  date: string
  weight: number
  /** Promedio de los registros de los 7 días que terminan en esta fecha. */
  avg: number
}

export function weightSeries(logs: BodyLog[]): WeightPoint[] {
  const pts = logs
    .filter((l) => l.weightKg !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))
  return pts.map((l) => {
    const t = dayTime(l.date)
    const window = pts.filter((x) => {
      const d = t - dayTime(x.date)
      return d >= 0 && d < 7 * DAY
    })
    const avg = window.reduce((s, x) => s + x.weightKg!, 0) / window.length
    return { date: l.date, weight: l.weightKg!, avg: Math.round(avg * 100) / 100 }
  })
}

export function waistSeries(logs: BodyLog[]): { date: string; waist: number }[] {
  return logs
    .filter((l) => l.waistCm !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => ({ date: l.date, waist: l.waistCm! }))
}

const finishedLogs = (logs: WorkoutLog[]) =>
  logs.filter((l) => l.finishedAt).sort((a, b) => a.finishedAt!.localeCompare(b.finishedAt!))

const e1rm = (s: LoggedSet) => estimate1RM(s.weight, s.reps, s.rir)

/** Mejor serie para comparar rendimiento: técnica estable y mayor 1RM estimado (o más repeticiones sin carga). */
function bestSet(sets: LoggedSet[]): LoggedSet | undefined {
  const stable = sets.filter((s) => s.technique === 'stable')
  const pool = stable.length ? stable : sets
  return pool.reduce<LoggedSet | undefined>((best, s) => {
    if (!best) return s
    const a = e1rm(s) || s.reps
    const b = e1rm(best) || best.reps
    return a > b ? s : best
  }, undefined)
}

export interface ExerciseSession {
  date: string
  best: LoggedSet
  /** 1RM estimado de la mejor serie; 0 en ejercicios sin carga. */
  e1rm: number
  sets: LoggedSet[]
}

/** Exposiciones a un ejercicio, de la más antigua a la más reciente. */
export function exerciseHistory(logs: WorkoutLog[], exerciseId: string): ExerciseSession[] {
  const out: ExerciseSession[] = []
  for (const l of finishedLogs(logs)) {
    const sets = l.entries.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets)
    const best = bestSet(sets)
    if (best) out.push({ date: l.finishedAt!.slice(0, 10), best, e1rm: Math.round(e1rm(best) * 10) / 10, sets })
  }
  return out
}

/** Ejercicios con al menos una serie registrada, ordenados por frecuencia. */
export function loggedExercises(logs: WorkoutLog[]): { id: string; name: string; sessions: number }[] {
  const count = new Map<string, number>()
  for (const l of finishedLogs(logs)) {
    for (const id of new Set(l.entries.filter((e) => e.sets.length > 0).map((e) => e.exerciseId))) {
      count.set(id, (count.get(id) ?? 0) + 1)
    }
  }
  return [...count.entries()]
    .map(([id, sessions]) => ({ id, name: getExercise(id).name, sessions }))
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name))
}

export interface PersonalRecord {
  exerciseId: string
  name: string
  /** Mejor 1RM estimado (técnica estable). */
  bestE1RM?: { value: number; set: LoggedSet; date: string }
  /** Carga más alta levantada con técnica estable. */
  heaviest?: { set: LoggedSet; date: string }
  /** Más repeticiones en una serie (útil en ejercicios sin carga). */
  mostReps: { set: LoggedSet; date: string }
}

export function personalRecords(logs: WorkoutLog[]): PersonalRecord[] {
  const map = new Map<string, PersonalRecord>()
  for (const l of finishedLogs(logs)) {
    const date = l.finishedAt!.slice(0, 10)
    for (const entry of l.entries) {
      for (const s of entry.sets) {
        const rec = map.get(entry.exerciseId) ?? {
          exerciseId: entry.exerciseId,
          name: getExercise(entry.exerciseId).name,
          mostReps: { set: s, date },
        }
        if (s.reps > rec.mostReps.set.reps) rec.mostReps = { set: s, date }
        if (s.technique === 'stable' && s.weight > 0) {
          const v = e1rm(s)
          if (!rec.bestE1RM || v > rec.bestE1RM.value) rec.bestE1RM = { value: Math.round(v * 10) / 10, set: s, date }
          if (!rec.heaviest || s.weight > rec.heaviest.set.weight) rec.heaviest = { set: s, date }
        }
        map.set(entry.exerciseId, rec)
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Series efectivas realizadas por músculo en una semana del plan (directa = 1, indirecta = 0.5). */
export function weeklyMuscleSets(plan: Plan, logs: WorkoutLog[], week: number): Record<Muscle, { done: number; target: number }> {
  const out = Object.fromEntries(MUSCLES.map((m) => [m, { done: 0, target: plan.weeklyVolume[m]?.target ?? 0 }])) as Record<
    Muscle,
    { done: number; target: number }
  >
  for (const l of logs) {
    if (l.planId !== plan.id || l.week !== week || !l.finishedAt) continue
    for (const e of l.entries) {
      const ex = getExercise(e.exerciseId)
      for (const m of ex.primary) out[m].done += e.sets.length
      for (const m of ex.secondary) out[m].done += e.sets.length * 0.5
    }
  }
  return out
}

export interface Adherence {
  sessionsDone: number
  sessionsTotal: number
  /** Promedio de series hechas / planificadas por sesión terminada. */
  setCompliancePct?: number
  avgFatigue?: number
}

export function adherence(plan: Plan, logs: WorkoutLog[]): Adherence {
  const done = logs.filter((l) => l.planId === plan.id && l.finishedAt)
  const ratios = done
    .map((l) => {
      const planned = l.entries.reduce((n, e) => n + e.plannedSets, 0)
      const did = l.entries.reduce((n, e) => n + e.sets.length, 0)
      return planned > 0 ? Math.min(did / planned, 1) : undefined
    })
    .filter((x): x is number => x !== undefined)
  const fatigues = done.map((l) => l.fatigue).filter((x): x is number => x !== undefined)
  return {
    sessionsDone: done.length,
    sessionsTotal: plan.weeks * plan.sessions.length,
    setCompliancePct: ratios.length ? Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100) : undefined,
    avgFatigue: fatigues.length ? Math.round((fatigues.reduce((a, b) => a + b, 0) / fatigues.length) * 10) / 10 : undefined,
  }
}
