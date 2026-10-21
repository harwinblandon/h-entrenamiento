import type { BodyLog, Plan, WorkoutLog } from './types'

export interface NextSession {
  week: number
  sessionIndex: number
  /** Sesión en curso (iniciada y sin terminar), si existe. */
  inProgress?: WorkoutLog
}

/** La siguiente sesión es la primera del plan que aún no se ha terminado, en orden. */
export function nextSession(plan: Plan, logs: WorkoutLog[]): NextSession | null {
  const planLogs = logs.filter((l) => l.planId === plan.id)
  const inProgress = planLogs.find((l) => !l.finishedAt)
  if (inProgress) return { week: inProgress.week, sessionIndex: inProgress.sessionIndex, inProgress }
  const done = planLogs.filter((l) => l.finishedAt).length
  const week = Math.floor(done / plan.sessions.length) + 1
  if (week > plan.weeks) return null
  return { week, sessionIndex: done % plan.sessions.length }
}

export interface WeightTrend {
  /** Promedio de los últimos 7 días con registro. */
  current?: number
  /** Promedio de los 7 días anteriores. */
  previous?: number
  changePct?: number
  entries: number
}

const DAY = 86_400_000

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
