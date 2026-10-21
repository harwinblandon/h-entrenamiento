import { getExercise, isLoadless, substitutesFor } from './exercises'
import { MUSCLE_LABELS } from './labels'
import { computeVolume, generatePlan } from './planGenerator'
import { planSnapshot } from './planChanges'
import { PAIN_STOP } from './progression'
import { exerciseHistory } from './progress'
import type { Muscle, Plan, Profile, WorkoutLog } from './types'
import { MUSCLES } from './types'

export type ExerciseTrend = 'progressed' | 'stalled' | 'regressed' | 'insufficient'

export interface ExerciseReview {
  exerciseId: string
  name: string
  muscle: Muscle
  exposures: number
  /** 1RM estimado (o repeticiones si no hay carga) en la primera y la última exposición. */
  first?: number
  last?: number
  changePct?: number
  trend: ExerciseTrend
  /** Sesiones con dolor relevante (≥ 4/10). */
  painSessions: number
  loadless: boolean
}

export interface MuscleReview {
  muscle: Muscle
  trend: 'progressing' | 'stalled' | 'regressed' | 'no_data'
  target: number
  proposedDelta: number
  reason: string
}

export interface DeloadSignal {
  id: 'fatigue' | 'performance' | 'pain' | 'readiness' | 'adherence'
  label: string
  active: boolean
  detail: string
}

export interface SwapProposal {
  exerciseId: string
  name: string
  reason: string
  /**
   * Si se propone cambiarlo por defecto: con dolor siempre; si está estancado, solo con buena recuperación
   * (con fatiga, el estancamiento se atribuye primero a la fatiga y se mantiene el ejercicio).
   */
  recommended: boolean
  alternatives: { id: string; name: string }[]
}

export interface MesocycleReview {
  sessionsDone: number
  sessionsTotal: number
  compliancePct?: number
  avgFatigue?: number
  lastWeekFatigue?: number
  reducedDays: number
  recoveryOk: boolean
  exercises: ExerciseReview[]
  muscles: MuscleReview[]
  signals: DeloadSignal[]
  deloadRecommended: boolean
  swaps: SwapProposal[]
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined)
const round1 = (n: number) => Math.round(n * 10) / 10

function trendOf(metrics: number[]): { trend: ExerciseTrend; changePct?: number } {
  const n = metrics.length
  if (n < 2 || metrics[0] <= 0) return { trend: 'insufficient' }
  const changePct = ((metrics[n - 1] - metrics[0]) / metrics[0]) * 100
  // Estancamiento: tres o más exposiciones recientes sin superar lo conseguido antes.
  if (n >= 3) {
    const recentBest = Math.max(...metrics.slice(-3))
    const before = n > 3 ? Math.max(...metrics.slice(0, -3)) : metrics[0]
    if (recentBest <= before * 1.005) return { trend: changePct <= -3 ? 'regressed' : 'stalled', changePct }
  }
  if (changePct >= 1) return { trend: 'progressed', changePct }
  if (changePct <= -3) return { trend: 'regressed', changePct }
  return { trend: n >= 3 ? 'stalled' : 'insufficient', changePct }
}

export function reviewMesocycle(plan: Plan, allLogs: WorkoutLog[], profile: Profile): MesocycleReview {
  const logs = allLogs.filter((l) => l.planId === plan.id && l.finishedAt && !l.deload)

  // Ejercicios del plan (y sustituciones hechas durante las sesiones).
  const muscleOf = new Map<string, Muscle>()
  for (const s of plan.sessions) for (const e of s.exercises) muscleOf.set(e.exerciseId, e.muscle)
  for (const l of logs) for (const e of l.entries) if (!muscleOf.has(e.exerciseId)) muscleOf.set(e.exerciseId, e.muscle)

  const exercises: ExerciseReview[] = [...muscleOf.entries()].map(([id, muscle]) => {
    const ex = getExercise(id)
    const loadless = isLoadless(ex)
    const hist = exerciseHistory(logs, id)
    const metrics = hist.map((h) => (loadless ? h.best.reps : h.e1rm))
    const { trend, changePct } = trendOf(metrics)
    const painSessions = hist.filter((h) => h.sets.some((s) => s.pain >= PAIN_STOP)).length
    return {
      exerciseId: id,
      name: ex.name,
      muscle,
      exposures: hist.length,
      first: metrics[0],
      last: metrics[metrics.length - 1],
      changePct: changePct === undefined ? undefined : round1(changePct),
      trend,
      painSessions,
      loadless,
    }
  })

  const ratios = logs.map((l) => {
    const planned = l.entries.reduce((n, e) => n + e.plannedSets, 0)
    const done = l.entries.reduce((n, e) => n + e.sets.length, 0)
    return planned ? Math.min(done / planned, 1) : 1
  })
  const compliance = mean(ratios)
  const fatigues = logs.map((l) => l.fatigue).filter((f): f is number => f !== undefined)
  const lastWeek = Math.max(0, ...logs.map((l) => l.week))
  const lastWeekFatigue = mean(logs.filter((l) => l.week === lastWeek).map((l) => l.fatigue).filter((f): f is number => f !== undefined))
  const avgFatigue = mean(fatigues)
  const reducedDays = logs.filter((l) => l.readiness === 'reduced').length
  const compliancePct = compliance === undefined ? undefined : Math.round(compliance * 100)
  const recoveryOk = (avgFatigue ?? 0) < 3.5 && (compliancePct ?? 100) >= 85 && reducedDays <= 2

  const withData = exercises.filter((e) => e.trend !== 'insufficient')
  const flat = withData.filter((e) => e.trend === 'stalled' || e.trend === 'regressed')
  const painful = exercises.filter((e) => e.painSessions >= 2 || (e.painSessions >= 1 && e.exposures <= 2))
  const signals: DeloadSignal[] = [
    {
      id: 'fatigue',
      label: 'Fatiga percibida alta',
      active: (lastWeekFatigue ?? 0) >= 3.5 || (avgFatigue ?? 0) >= 3.5,
      detail: `Media ${avgFatigue !== undefined ? round1(avgFatigue) : '—'}/5; última semana ${lastWeekFatigue !== undefined ? round1(lastWeekFatigue) : '—'}/5.`,
    },
    {
      id: 'performance',
      label: 'Rendimiento estancado o a la baja',
      active: withData.length >= 3 && flat.length / withData.length >= 0.3,
      detail: `${flat.length} de ${withData.length} ejercicios con datos suficientes.`,
    },
    {
      id: 'pain',
      label: 'Molestias repetidas',
      active: painful.length > 0,
      detail: painful.length ? painful.map((e) => e.name).join(', ') : 'Sin dolor relevante registrado.',
    },
    {
      id: 'readiness',
      label: 'Días con menos energía',
      active: reducedDays >= 2,
      detail: `${reducedDays} sesiones ajustadas por cansancio, sueño, estrés o síntomas.`,
    },
    {
      id: 'adherence',
      label: 'Series sin completar',
      active: compliancePct !== undefined && compliancePct < 80,
      detail: `Cumplimiento medio de series: ${compliancePct ?? '—'} %.`,
    },
  ]
  const deloadRecommended = signals.filter((s) => s.active).length >= 2

  const muscles: MuscleReview[] = MUSCLES.filter((m) => (plan.weeklyVolume[m]?.target ?? 0) > 0).map((m) => {
    const exs = withData.filter((e) => e.muscle === m)
    const target = plan.weeklyVolume[m].target
    const p = exs.filter((e) => e.trend === 'progressed').length
    const r = exs.filter((e) => e.trend === 'regressed').length
    const s = exs.filter((e) => e.trend === 'stalled').length
    if (exs.length === 0) return { muscle: m, trend: 'no_data', target, proposedDelta: 0, reason: 'Sin datos suficientes: mantener.' }
    if (r > 0 && r >= p) {
      return recoveryOk
        ? { muscle: m, trend: 'regressed', target, proposedDelta: 0, reason: 'Rendimiento a la baja: revisar técnica y ejercicio antes de cambiar el volumen.' }
        : { muscle: m, trend: 'regressed', target, proposedDelta: -2, reason: 'Rendimiento a la baja con fatiga: −2 series para recuperar.' }
    }
    if (p > 0 && p >= s) return { muscle: m, trend: 'progressing', target, proposedDelta: 0, reason: 'Progresa: mantener el volumen.' }
    return recoveryOk
      ? { muscle: m, trend: 'stalled', target, proposedDelta: 2, reason: 'Sin progreso con buena recuperación y adherencia: +2 series semanales.' }
      : { muscle: m, trend: 'stalled', target, proposedDelta: 0, reason: 'Sin progreso, pero con fatiga o baja adherencia: mejorar recuperación antes de sumar volumen.' }
  })

  const swaps: SwapProposal[] = exercises
    .filter((e) => e.trend === 'stalled' || e.painSessions > 0)
    .map((e) => ({
      exerciseId: e.exerciseId,
      name: e.name,
      recommended: e.painSessions > 0 || recoveryOk,
      reason:
        e.painSessions > 0
          ? `Dolor relevante en ${e.painSessions} sesión(es): conviene cambiarlo.`
          : recoveryOk
            ? 'Sin progreso con buena recuperación: un ejercicio nuevo puede reactivar el progreso.'
            : 'Sin progreso, probablemente por la fatiga acumulada: mantenerlo y revisar después de recuperar.',
      alternatives: substitutesFor(e.exerciseId, profile.equipment, profile.avoidExerciseIds)
        .filter((x) => !muscleOf.has(x.id))
        .slice(0, 3)
        .map((x) => ({ id: x.id, name: x.name })),
    }))
    .sort((a, b) => Number(b.recommended) - Number(a.recommended))

  return {
    sessionsDone: logs.length,
    sessionsTotal: plan.weeks * plan.sessions.length,
    compliancePct,
    avgFatigue: avgFatigue === undefined ? undefined : round1(avgFatigue),
    lastWeekFatigue: lastWeekFatigue === undefined ? undefined : round1(lastWeekFatigue),
    reducedDays,
    recoveryOk,
    exercises,
    muscles,
    signals,
    deloadRecommended,
    swaps,
  }
}

/** Semana de descarga: mismos ejercicios, ~40 % menos series; RIR 3–5 y ~90 % de la carga en la sesión. */
export function createDeloadPlan(prev: Plan, now = new Date()): Plan {
  const sessions = prev.sessions.map((s) => {
    const exercises = s.exercises.map((e) => ({ ...e, sets: Math.max(1, Math.round(e.sets * 0.6)) }))
    return { ...s, name: s.name, exercises, estimatedMinutes: Math.round(s.estimatedMinutes * 0.6) }
  })
  const targets = Object.fromEntries(MUSCLES.map((m) => [m, Math.round((prev.weeklyVolume[m]?.target ?? 0) * 0.6)])) as Record<Muscle, number>
  const priorities = MUSCLES.filter((m) => prev.weeklyVolume[m]?.priority)
  return {
    id: crypto.randomUUID(),
    profileId: prev.profileId,
    createdAt: now.toISOString(),
    weeks: 1,
    split: `${prev.split} · descarga`,
    sessions,
    weeklyVolume: computeVolume(sessions, targets, priorities),
    explanations: [
      {
        title: 'Semana de descarga',
        text:
          'Se reducen las series ~40 %, se mantiene o reduce moderadamente la carga (~90 %) y se trabaja a 3–5 repeticiones ' +
          'del fallo. Sirve para disipar fatiga acumulada y llegar con mejor rendimiento al siguiente mesociclo.',
        confidence: 'baja',
        sourceIds: ['coleman2024deload'],
      },
    ],
    warnings: [],
    active: true,
    kind: 'deload',
    profileSnapshot: prev.profileSnapshot,
  }
}

export interface NextMesocycleChoices {
  weeks: number
  /** Cambio de series semanales por músculo. */
  volumeDelta: Partial<Record<Muscle, number>>
  /** Ejercicio a sustituir → sustituto elegido. */
  swaps: Record<string, string>
}

/** Genera el siguiente mesociclo conservando lo que progresa y aplicando los ajustes aprobados. */
export function createNextPlan(profile: Profile, review: MesocycleReview, choices: NextMesocycleChoices, now = new Date()): Plan {
  const keep = review.exercises.filter((e) => e.trend === 'progressed' && !choices.swaps[e.exerciseId]).map((e) => e.exerciseId)
  const avoid = Object.keys(choices.swaps)
  const prefer = Object.values(choices.swaps)
  const adjustments: string[] = []
  for (const [m, d] of Object.entries(choices.volumeDelta)) {
    if (d) adjustments.push(`${MUSCLE_LABELS[m as Muscle]}: ${d > 0 ? '+' : ''}${d} series semanales`)
  }
  for (const [from, to] of Object.entries(choices.swaps)) {
    adjustments.push(`${getExercise(from).name} → ${getExercise(to).name}`)
  }
  if (keep.length) adjustments.push(`Se conservan ${keep.length} ejercicios que progresaron.`)

  const plan = generatePlan(profile, {
    weeks: choices.weeks,
    now,
    volumeDelta: choices.volumeDelta,
    keepExercises: keep,
    preferExercises: prefer,
    avoidExercises: avoid,
  })
  return { ...plan, profileSnapshot: planSnapshot(profile), adjustments, kind: 'mesocycle' }
}
