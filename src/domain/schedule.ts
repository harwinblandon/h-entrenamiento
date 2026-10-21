import type { BodyLog, Muscle, Plan, WorkoutLog } from './types'

const DAY = 86_400_000

export interface NextSession {
  week: number
  /** Sesión sugerida (o la que está en curso). */
  sessionIndex: number
  /** Sesión en curso (iniciada y sin terminar), si existe. */
  inProgress?: WorkoutLog
  /** Sesiones de la semana actual ya terminadas y pendientes. */
  done: number[]
  pending: number[]
  /** Por qué se sugiere esta sesión. */
  reason: string
}

/** Músculos objetivo de una sesión del plan. */
function sessionMuscles(plan: Plan, index: number): Set<Muscle> {
  return new Set(plan.sessions[index].exercises.map((e) => e.muscle))
}

/**
 * La semana actual es la primera con sesiones sin terminar; se pueden hacer en cualquier orden.
 * Se sugiere la pendiente que menos músculos repite respecto a la última sesión terminada.
 */
export function nextSession(plan: Plan, logs: WorkoutLog[], now = new Date()): NextSession | null {
  const planLogs = logs.filter((l) => l.planId === plan.id)
  const finished = planLogs.filter((l) => l.finishedAt)
  const inProgress = planLogs.find((l) => !l.finishedAt)

  let week = 0
  let done: number[] = []
  for (let w = 1; w <= plan.weeks; w++) {
    done = [...new Set(finished.filter((l) => l.week === w).map((l) => l.sessionIndex))]
    if (done.length < plan.sessions.length) {
      week = w
      break
    }
  }
  if (week === 0 && !inProgress) return null
  const pending = plan.sessions.map((_, i) => i).filter((i) => !done.includes(i))

  if (inProgress) {
    return { week: inProgress.week, sessionIndex: inProgress.sessionIndex, inProgress, done, pending, reason: 'Sesión en curso.' }
  }

  const last = [...finished].sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))[0]
  if (!last) return { week, sessionIndex: pending[0], done, pending, reason: 'Primera sesión del plan.' }

  const lastMuscles = new Set(last.entries.map((e) => e.muscle))
  const overlap = (i: number) => {
    const m = [...sessionMuscles(plan, i)]
    return m.filter((x) => lastMuscles.has(x)).length / (m.length || 1)
  }
  const suggested = [...pending].sort((a, b) => overlap(a) - overlap(b) || a - b)[0]
  // Días de calendario (no horas): una sesión de ayer por la tarde cuenta como "ayer".
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(new Date(last.finishedAt!))) / DAY)
  const when = days <= 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days} días`
  const lastName = plan.sessions[last.sessionIndex]?.name ?? 'la última sesión'
  const reason =
    overlap(suggested) === 0
      ? `No repite músculos de ${lastName} (${when}).`
      : `Es la que menos músculos repite de ${lastName} (${when}).`
  return { week, sessionIndex: suggested, done, pending, reason }
}

export interface WeightTrend {
  /** Promedio de los últimos 7 días con registro. */
  current?: number
  /** Promedio de los 7 días anteriores. */
  previous?: number
  changePct?: number
  entries: number
}

export function weightTrend(logs: BodyLog[], today = new Date()): WeightTrend {
  const withWeight = logs.filter((l) => l.weightKg !== undefined)
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const age = (l: BodyLog) => (t - Date.parse(l.date)) / DAY
  const avg = (xs: BodyLog[]) => (xs.length ? xs.reduce((s, l) => s + l.weightKg!, 0) / xs.length : undefined)
  const current = avg(withWeight.filter((l) => age(l) >= 0 && age(l) < 7))
  const previous = avg(withWeight.filter((l) => age(l) >= 7 && age(l) < 14))
  return {
    current,
    previous,
    changePct: current !== undefined && previous !== undefined ? ((current - previous) / previous) * 100 : undefined,
    entries: withWeight.length,
  }
}

export interface WeightStatus {
  /** Peso a usar en los cálculos: promedio de 7 días, último registro o el de la ficha. */
  weightKg: number
  source: 'average' | 'latest' | 'profile'
  /** Días desde el último registro, si existe. */
  daysAgo?: number
  /** Registros en los últimos 7 días. */
  recentCount: number
  /** Al menos 3 pesajes en los últimos 7 días. */
  confirmed: boolean
}

export const WEIGHINS_TO_CONFIRM = 3

export function weightStatus(logs: BodyLog[], profileWeight: number, today = new Date()): WeightStatus {
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const withWeight = logs.filter((l) => l.weightKg !== undefined)
  const recentCount = withWeight.filter((l) => {
    const age = (t - Date.parse(l.date)) / DAY
    return age >= 0 && age < 7
  }).length
  const latest = [...withWeight].sort((a, b) => b.date.localeCompare(a.date))[0]
  const daysAgo = latest ? Math.round((t - Date.parse(latest.date)) / DAY) : undefined
  const trend = weightTrend(logs, today)
  const confirmed = recentCount >= WEIGHINS_TO_CONFIRM
  if (confirmed && trend.current !== undefined) {
    return { weightKg: Math.round(trend.current * 10) / 10, source: 'average', daysAgo, recentCount, confirmed }
  }
  if (latest) return { weightKg: latest.weightKg!, source: 'latest', daysAgo, recentCount, confirmed }
  return { weightKg: profileWeight, source: 'profile', recentCount, confirmed }
}

export function latestWeight(logs: BodyLog[]): number | undefined {
  return [...logs].filter((l) => l.weightKg !== undefined).sort((a, b) => b.date.localeCompare(a.date))[0]?.weightKg
}

export function todayISO(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
