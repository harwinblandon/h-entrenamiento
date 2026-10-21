import { describe, expect, it } from 'vitest'
import { demoProfile } from './demo'
import { getExercise } from './exercises'
import { MUSCLE_LABELS } from './labels'
import { computeNutrition } from './nutrition'
import { distribute, generatePlan, weeklyTargets } from './planGenerator'
import { estimate1RM, recommendLoad, suggestNextSet } from './progression'
import { createPin, verifyPin } from './pin'
import { planChanges, planSnapshot } from './planChanges'
import { emptySafety, evaluateSafety } from './safety'
import { adherence, exerciseHistory, personalRecords, weeklyMuscleSets, weightSeries } from './progress'
import { nextSession, weightStatus } from './schedule'
import type { LoggedExercise, LoggedSet, Profile, WorkoutLog } from './types'
import { MUSCLES } from './types'

const profile = (over: Partial<Profile> = {}): Profile => ({ ...demoProfile(new Date('2026-01-01')), ...over })
const set = (weight: number, reps: number, rir = 2, extra: Partial<LoggedSet> = {}): LoggedSet => ({
  weight, reps, rir, pain: 0, technique: 'stable', ...extra,
})
const entry = (exerciseId: string, sets: LoggedSet[], repRange: [number, number] = [6, 8]): LoggedExercise => ({
  exerciseId, muscle: 'chest', plannedSets: sets.length, repRange, rirTarget: [2, 2], restSec: 150, sets,
})

describe('estimate1RM', () => {
  it('ajusta por RIR', () => {
    expect(estimate1RM(100, 5, 0)).toBeCloseTo(116.67, 1)
    expect(estimate1RM(100, 3, 2)).toBeCloseTo(estimate1RM(100, 5, 0))
  })
})

describe('doble progresión', () => {
  const bench = getExercise('bench_press')

  it('sube carga al alcanzar el tope del rango en todas las series', () => {
    const rec = recommendLoad(entry('bench_press', [set(80, 8), set(80, 8), set(80, 8)]), [6, 8], [2, 2], bench)
    expect(rec.weight).toBe(82.5)
    expect(rec.repsTarget[0]).toBe(6)
  })

  it('mantiene carga mientras no se alcance el tope', () => {
    const rec = recommendLoad(entry('bench_press', [set(80, 8), set(80, 7), set(80, 6)]), [6, 8], [2, 2], bench)
    expect(rec.weight).toBe(80)
    expect(rec.repsTarget).toEqual([7, 8])
  })

  it('no progresa si la técnica se deterioró', () => {
    const rec = recommendLoad(
      entry('bench_press', [set(80, 8), set(80, 8, 2, { technique: 'deteriorated' })]),
      [6, 8], [2, 2], bench,
    )
    expect(rec.weight).toBeLessThan(80)
  })

  it('exige repeticiones extra cuando el salto mínimo supera el 5 %', () => {
    const lateral = getExercise('db_lateral_raise') // incremento 1 kg
    const atTop = entry('db_lateral_raise', [set(8, 20), set(8, 20)], [12, 20])
    expect(recommendLoad(atTop, [12, 20], [2, 2], lateral).weight).toBe(8)
    const beyond = entry('db_lateral_raise', [set(8, 22), set(8, 22)], [12, 20])
    expect(recommendLoad(beyond, [12, 20], [2, 2], lateral).weight).toBe(9)
  })

  it('sin historial pide calibración', () => {
    expect(recommendLoad(undefined, [6, 8], [3, 3], bench).weight).toBeNull()
  })
})

describe('sugerencia de la siguiente serie', () => {
  const bench = getExercise('bench_press')
  it('detiene el ejercicio con dolor relevante', () => {
    expect(suggestNextSet(set(80, 8, 2, { pain: 5 }), [6, 8], [2, 2], bench).action).toBe('stop')
  })
  it('reduce si la técnica se deterioró', () => {
    expect(suggestNextSet(set(80, 8, 2, { technique: 'deteriorated' }), [6, 8], [2, 2], bench).action).toBe('reduce')
  })
  it('sube si sobran repeticiones en el tope', () => {
    expect(suggestNextSet(set(80, 8, 5), [6, 8], [2, 2], bench).action).toBe('increase')
  })
  it('reduce si llegó mucho más cerca del fallo', () => {
    expect(suggestNextSet(set(80, 7, 0), [6, 8], [2, 2], bench).action).toBe('reduce')
  })
  it('mantiene si la serie salió como se planeó', () => {
    expect(suggestNextSet(set(80, 7, 2), [6, 8], [2, 2], bench).action).toBe('keep')
  })
})

describe('generación del plan', () => {
  it('respeta el rango de volumen por experiencia', () => {
    const t = weeklyTargets(profile({ priorityMuscles: [] }))
    expect(t.chest).toBe(12)
    expect(t.delts_front).toBe(0)
  })

  it('suma series a los prioritarios y las reduce con mala recuperación', () => {
    expect(weeklyTargets(profile({ priorityMuscles: ['calves'] })).calves).toBe(Math.round(12 * 0.8) + 3)
    expect(weeklyTargets(profile({ priorityMuscles: [], sleepHours: 5 })).chest).toBe(10)
  })

  it('genera un plan que cubre todos los músculos con objetivo', () => {
    for (const days of [2, 3, 4, 5, 6]) {
      const p = profile({ daysPerWeek: days, priorityMuscles: ['calves', 'triceps'] })
      const plan = generatePlan(p)
      expect(plan.sessions).toHaveLength(days)
      for (const m of MUSCLES) {
        const v = plan.weeklyVolume[m]
        // Si un músculo queda sin volumen (p. ej. por falta de tiempo), debe avisarse.
        if (v.target > 0 && v.effective === 0) {
          expect(plan.warnings.some((w) => w.startsWith(MUSCLE_LABELS[m]))).toBe(true)
        }
      }
      const overWarned = plan.warnings.some((w) => w.includes('aun recortando'))
      for (const s of plan.sessions) {
        if (!overWarned) expect(s.estimatedMinutes).toBeLessThanOrEqual(p.sessionMinutes)
      }
    }
  })

  it('no parte un músculo en ejercicios de pocas series dentro de una sesión', () => {
    for (const days of [3, 4, 5, 6]) {
      // Sin límite de tiempo ajustado, para ver el reparto sin recortes.
      const plan = generatePlan(profile({ daysPerWeek: days, sessionMinutes: 180 }))
      for (const s of plan.sessions) {
        for (const m of MUSCLES) {
          const exs = s.exercises.filter((e) => e.muscle === m)
          if (exs.length > 1) for (const e of exs) expect(e.sets).toBeGreaterThanOrEqual(3)
        }
      }
    }
  })

  it('reparte series sin dejar sesiones con menos de 2', () => {
    expect(distribute(10, [1, 1])).toEqual([5, 5])
    expect(distribute(3, [1, 1])).toEqual([3, 0])
    const weighted = distribute(10, [0.38, 0.58])
    expect(weighted[0] + weighted[1]).toBe(10)
    expect(weighted[1]).toBeGreaterThan(weighted[0])
  })

  it('no usa ejercicios evitados ni equipamiento no disponible', () => {
    const plan = generatePlan(profile({ equipment: ['dumbbell', 'bodyweight'], avoidExerciseIds: ['goblet_squat'] }))
    for (const s of plan.sessions) {
      for (const pe of s.exercises) {
        expect(pe.exerciseId).not.toBe('goblet_squat')
        expect(['dumbbell', 'bodyweight']).toContain(getExercise(pe.exerciseId).equipment)
      }
    }
  })

  it('avisa si hay más de 3 prioridades', () => {
    expect(generatePlan(profile()).warnings.some((w) => w.includes('prioritarios'))).toBe(true)
  })
})

describe('nutrición', () => {
  it('calcula Mifflin y macros para aumento', () => {
    const n = computeNutrition(profile())
    expect(n.bmr).toBe(1658)
    expect(n.targetKcal).toBeGreaterThan(n.tdee)
    expect(n.proteinG).toBe(Math.round(75.5 * 1.8))
    expect(n.carbsG * 4 + n.proteinG * 4 + n.fatG * 9).toBeCloseTo(n.targetKcal, -1)
  })

  it('propone déficit en definición', () => {
    const n = computeNutrition(profile({ goal: 'cut' }))
    expect(n.targetKcal).toBeLessThan(n.tdee)
    expect(n.proteinPerKg).toBe(2.2)
  })

  it('no propone déficit en embarazo y oculta calorías con antecedentes de TCA', () => {
    expect(computeNutrition(profile({ goal: 'cut', lifeStage: 'pregnancy' })).adjustmentPct).toBe(0)
    expect(computeNutrition(profile({ safety: { ...emptySafety(), eatingDisorderHistory: true } })).hidden).toBe(true)
  })
})

describe('TRX y ejercicios sin carga', () => {
  it('genera un plan solo con TRX y peso corporal', () => {
    const plan = generatePlan(profile({ equipment: ['suspension', 'bodyweight'], daysPerWeek: 3, priorityMuscles: [] }))
    const used = plan.sessions.flatMap((s) => s.exercises.map((e) => getExercise(e.exerciseId).equipment))
    expect(used.length).toBeGreaterThan(0)
    expect(used.every((e) => e === 'suspension' || e === 'bodyweight')).toBe(true)
    expect(used).toContain('suspension')
  })

  it('en gimnasio completo con TRX prefiere ejercicios con carga', () => {
    const plan = generatePlan(profile({ equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'smith', 'bodyweight', 'suspension'] }))
    const trx = plan.sessions.flatMap((s) => s.exercises).filter((e) => getExercise(e.exerciseId).equipment === 'suspension')
    expect(trx).toHaveLength(0)
  })

  it('al llegar al tope pide más dificultad, no más kilos', () => {
    const row = getExercise('trx_row')
    const rec = recommendLoad(entry('trx_row', [set(0, 15), set(0, 15)], [8, 15]), [8, 15], [2, 2], row)
    expect(rec.weight).toBe(0)
    expect(rec.reason).toContain('dificultad')
    expect(suggestNextSet(set(0, 15, 5), [8, 15], [2, 2], row).message).toContain('dificultad')
  })
})

describe('cardio', () => {
  it('suma el gasto del cardio al total', () => {
    const sin = computeNutrition(profile())
    const con = computeNutrition(profile({ cardio: { modalities: ['walk', 'jump_rope'], daysPerWeek: 3, minutes: 30 } }))
    // MET medio 6.75 → (6.75 − 1) × 75.5 kg × 0.5 h ≈ 217 kcal/sesión × 3 / 7 ≈ 93 kcal/día
    expect(con.cardioKcalPerDay).toBe(93)
    expect(con.tdee - sin.tdee).toBeGreaterThanOrEqual(90)
  })
})

describe('elección de la sesión del día', () => {
  const plan = generatePlan(profile(), { id: 'plan', weeks: 6 }) // Torso, Pierna A, Empuje, Tracción, Pierna B
  const done = (sessionIndex: number, week: number, finishedAt: string): WorkoutLog => ({
    id: `${week}-${sessionIndex}`,
    profileId: 'p',
    planId: 'plan',
    week,
    sessionIndex,
    startedAt: finishedAt,
    finishedAt,
    entries: plan.sessions[sessionIndex].exercises.map((pe) => ({
      exerciseId: pe.exerciseId, muscle: pe.muscle, plannedSets: pe.sets, repRange: pe.repRange,
      rirTarget: [3, 3] as [number, number], restSec: pe.restSec, sets: [],
    })),
  })
  const now = new Date('2026-10-22T12:00:00Z')

  it('sin historial sugiere el día 1', () => {
    expect(nextSession(plan, [], now)).toMatchObject({ week: 1, sessionIndex: 0, pending: [0, 1, 2, 3, 4] })
  })

  it('después de Torso sugiere una sesión que no repita músculos', () => {
    const next = nextSession(plan, [done(0, 1, '2026-10-21T18:00:00Z')], now)!
    expect(next.sessionIndex).toBe(1) // Pierna A
    expect(next.reason).toContain('ayer')
  })

  it('permite hacer las sesiones en otro orden y avanza de semana al completarlas todas', () => {
    const logs = [done(1, 1, '2026-10-19T18:00:00Z'), done(4, 1, '2026-10-20T18:00:00Z')]
    expect(nextSession(plan, logs, now)!.pending).toEqual([0, 2, 3])
    const fullWeek = [0, 1, 2, 3, 4].map((i) => done(i, 1, `2026-10-1${i}T18:00:00Z`))
    expect(nextSession(plan, fullWeek, now)!.week).toBe(2)
  })
})

describe('progreso', () => {
  const plan = generatePlan(profile(), { id: 'plan', weeks: 6 })
  const log = (id: string, finishedAt: string, sets: LoggedSet[], exerciseId = 'bench_press', week = 1): WorkoutLog => ({
    id, profileId: 'p', planId: 'plan', week, sessionIndex: 0, startedAt: finishedAt, finishedAt,
    entries: [{ exerciseId, muscle: 'chest', plannedSets: 3, repRange: [6, 10], rirTarget: [2, 2], restSec: 150, sets }],
  })
  const logs = [
    log('a', '2026-10-01T18:00:00Z', [set(80, 8), set(80, 7)]),
    log('b', '2026-10-08T18:00:00Z', [set(82.5, 8), set(90, 3, 2, { technique: 'deteriorated' })]),
  ]

  it('media móvil de 7 días del peso', () => {
    const s = weightSeries([
      { id: '1', profileId: 'p', date: '2026-10-01', weightKg: 75 },
      { id: '2', profileId: 'p', date: '2026-10-03', weightKg: 76 },
      { id: '3', profileId: 'p', date: '2026-10-09', weightKg: 77 },
    ])
    expect(s.map((p) => p.avg)).toEqual([75, 75.5, 76.5]) // el 9 incluye el pesaje del 3 (6 días antes)
  })

  it('historial por ejercicio usa la mejor serie con técnica estable', () => {
    const h = exerciseHistory(logs, 'bench_press')
    expect(h).toHaveLength(2)
    expect(h[1].best.weight).toBe(82.5)
    expect(h[1].e1rm).toBeGreaterThan(h[0].e1rm)
  })

  it('los récords ignoran series con técnica deteriorada', () => {
    const pr = personalRecords(logs).find((r) => r.exerciseId === 'bench_press')!
    expect(pr.heaviest!.set.weight).toBe(82.5)
  })

  it('series por músculo de la semana cuentan directas e indirectas', () => {
    const w = weeklyMuscleSets(plan, logs, 1)
    expect(w.chest.done).toBe(4)
    expect(w.triceps.done).toBe(2)
  })

  it('adherencia por sesiones y series', () => {
    const a = adherence(plan, logs)
    expect(a.sessionsDone).toBe(2)
    expect(a.setCompliancePct).toBe(67)
  })
})

describe('estado del peso', () => {
  const today = new Date(2026, 9, 21)
  const log = (date: string, weightKg: number) => ({ id: date, profileId: 'p', date, weightKg })

  it('usa el peso de la ficha sin registros y no lo da por confirmado', () => {
    const s = weightStatus([], 75.5, today)
    expect(s).toMatchObject({ weightKg: 75.5, source: 'profile', confirmed: false })
  })

  it('un registro antiguo no confirma el peso', () => {
    const s = weightStatus([log('2026-08-20', 75.5)], 75.5, today)
    expect(s.source).toBe('latest')
    expect(s.daysAgo).toBe(62)
    expect(s.confirmed).toBe(false)
  })

  it('con 3 pesajes en 7 días usa el promedio', () => {
    const s = weightStatus([log('2026-10-19', 76), log('2026-10-20', 76.4), log('2026-10-21', 76.2)], 75.5, today)
    expect(s).toMatchObject({ weightKg: 76.2, source: 'average', confirmed: true })
  })
})

describe('cambios en la ficha que afectan al plan', () => {
  it('no avisa si solo cambian datos que no influyen en el plan', () => {
    const p = profile()
    const snap = planSnapshot(p)
    expect(planChanges(snap, { ...p, weightKg: 80, waistCm: 90, supplements: ['Cafeína'] })).toEqual([])
    expect(planChanges(snap, { ...p, sleepHours: 7.5 })).toEqual([])
  })

  it('describe los cambios relevantes', () => {
    const p = profile({ priorityMuscles: ['calves', 'traps'] })
    const snap = planSnapshot(p)
    const changes = planChanges(snap, { ...p, daysPerWeek: 4, priorityMuscles: ['calves', 'glutes'], sleepHours: 5 })
    expect(changes).toContain('Días por semana: 5 → 4')
    expect(changes).toContain('Prioridades: +Glúteos, −Trapecio')
    expect(changes).toContain('Recuperación: empeoró (sueño o estrés)')
  })

  it('sin instantánea (planes antiguos) no avisa', () => {
    expect(planChanges(undefined, profile())).toEqual([])
  })
})

describe('clave de acceso', () => {
  it('verifica la clave correcta y rechaza otra', async () => {
    const lock = await createPin('2468')
    expect(lock.hash).not.toContain('2468')
    expect(await verifyPin('2468', lock)).toBe(true)
    expect(await verifyPin('1357', lock)).toBe(false)
  })

  it('exige entre 4 y 6 números', async () => {
    await expect(createPin('12')).rejects.toThrow()
    await expect(createPin('12a4')).rejects.toThrow()
  })
})

describe('seguridad', () => {
  it('bloquea la generación sin autorización cuando hay señales de riesgo', () => {
    const r = evaluateSafety({ ...emptySafety(), chestPain: true })
    expect(r.level).toBe('clearance_required')
    expect(r.canGenerate).toBe(false)
    expect(evaluateSafety({ ...emptySafety(), chestPain: true, medicalClearance: true }).canGenerate).toBe(true)
  })
})
