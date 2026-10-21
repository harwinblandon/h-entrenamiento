import { describe, expect, it } from 'vitest'
import { demoProfile } from './demo'
import { getExercise } from './exercises'
import { MUSCLE_LABELS } from './labels'
import { computeNutrition } from './nutrition'
import { distribute, generatePlan, weeklyTargets } from './planGenerator'
import { estimate1RM, recommendLoad, suggestNextSet } from './progression'
import { emptySafety, evaluateSafety } from './safety'
import type { LoggedExercise, LoggedSet, Profile } from './types'
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

  it('reparte series sin dejar sesiones con menos de 2', () => {
    expect(distribute(10, [1, 1])).toEqual([5, 5])
    expect(distribute(3, [1, 1])).toEqual([3, 0])
    const weighted = distribute(10, [0.38, 0.58])
    expect(weighted[0] + weighted[1]).toBe(10)
    expect(weighted[1]).toBeGreaterThan(weighted[0])
  })

  it('no usa ejercicios evitados ni equipamiento no disponible', () => {
    const plan = generatePlan(profile({ equipment: 'home', avoidExerciseIds: ['goblet_squat'] }))
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

describe('seguridad', () => {
  it('bloquea la generación sin autorización cuando hay señales de riesgo', () => {
    const r = evaluateSafety({ ...emptySafety(), chestPain: true })
    expect(r.level).toBe('clearance_required')
    expect(r.canGenerate).toBe(false)
    expect(evaluateSafety({ ...emptySafety(), chestPain: true, medicalClearance: true }).canGenerate).toBe(true)
  })
})
