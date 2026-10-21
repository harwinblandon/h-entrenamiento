import type { Experience, Explanation, Goal, JobActivity, Profile } from './types'

export interface NutritionResult {
  hidden: boolean
  bmr: number
  bmrMethod: 'Mifflin-St Jeor' | 'Katch-McArdle'
  activityFactor: number
  tdee: number
  tdeeRange: [number, number]
  targetKcal: number
  adjustmentPct: number
  /** Ritmo objetivo de cambio de peso, % del peso corporal por semana. */
  weeklyRatePct: [number, number]
  /** Cambio esperado según el ajuste calórico, kg por semana. */
  expectedWeeklyKg: number
  proteinG: number
  proteinPerKg: number
  proteinRangePerKg: [number, number]
  fatG: number
  fatPerKg: number
  carbsG: number
  mealsNote: string
  explanations: Explanation[]
  warnings: string[]
}

const JOB_FACTOR: Record<JobActivity, number> = { sedentary: 1.25, moderate: 1.4, active: 1.6 }

function stepsFactor(steps: number): number {
  if (steps < 5000) return 1.25
  if (steps < 7500) return 1.35
  if (steps < 10000) return 1.45
  return 1.55
}

/** Factor de actividad: el mayor entre trabajo y pasos, más ~0.03 por día de entrenamiento. */
export function activityFactor(p: Pick<Profile, 'job' | 'dailySteps' | 'daysPerWeek'>): number {
  const base = Math.max(JOB_FACTOR[p.job], p.dailySteps ? stepsFactor(p.dailySteps) : 0)
  return Math.round((base + p.daysPerWeek * 0.03) * 100) / 100
}

export function bmrMifflin(sex: Profile['sex'], weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161)
}

export function bmrKatch(weightKg: number, bodyFatPct: number): number {
  return 370 + 21.6 * weightKg * (1 - bodyFatPct / 100)
}

const SURPLUS: Record<Experience, number> = { beginner: 0.1, intermediate: 0.075, advanced: 0.05 }
const GAIN_RATE: Record<Experience, [number, number]> = {
  beginner: [0.25, 0.5],
  intermediate: [0.15, 0.35],
  advanced: [0.1, 0.25],
}

const KCAL_PER_KG = 7700
const round10 = (n: number) => Math.round(n / 10) * 10

export function computeNutrition(profile: Profile, currentWeightKg = profile.weightKg, goal: Goal = profile.goal): NutritionResult {
  const w = currentWeightKg
  const useKatch = profile.bodyFatPct !== undefined && profile.bodyFatPct > 3 && profile.bodyFatPct < 60
  const bmr = useKatch ? bmrKatch(w, profile.bodyFatPct!) : bmrMifflin(profile.sex, w, profile.heightCm, profile.age)
  const factor = activityFactor(profile)
  const tdee = bmr * factor

  const warnings: string[] = []
  const special = profile.lifeStage === 'pregnancy' || profile.lifeStage === 'postpartum' || profile.safety.pregnancyPostpartum
  let effectiveGoal = goal
  if (special && goal !== 'maintain') {
    effectiveGoal = 'maintain'
    warnings.push('En embarazo o posparto no se proponen déficits ni superávits: las necesidades energéticas deben definirse con un profesional de la salud.')
  }

  let adjustmentPct: number
  let weeklyRatePct: [number, number]
  if (effectiveGoal === 'gain') {
    adjustmentPct = SURPLUS[profile.experience]
    weeklyRatePct = GAIN_RATE[profile.experience]
  } else if (effectiveGoal === 'cut') {
    adjustmentPct = profile.experience === 'advanced' ? -0.15 : -0.2
    weeklyRatePct = profile.experience === 'advanced' ? [-0.7, -0.4] : [-1.0, -0.5]
  } else {
    adjustmentPct = 0
    weeklyRatePct = [-0.1, 0.1]
  }
  const targetKcal = round10(tdee * (1 + adjustmentPct))

  const proteinRangePerKg: [number, number] = effectiveGoal === 'cut' ? [2.0, 2.4] : [1.6, 2.2]
  const proteinPerKg = effectiveGoal === 'cut' ? 2.2 : 1.8
  const proteinG = Math.round(w * proteinPerKg)

  let fatPerKg = effectiveGoal === 'cut' ? 0.7 : 0.8
  let fatG = Math.round(w * fatPerKg)
  const minFat = Math.round((targetKcal * 0.2) / 9)
  if (fatG < minFat) {
    fatG = minFat
    fatPerKg = Math.round((fatG / w) * 100) / 100
  }
  const carbsG = Math.max(0, Math.round((targetKcal - proteinG * 4 - fatG * 9) / 4))
  if (carbsG < 2 * w) {
    warnings.push('Los carbohidratos quedan bajos para sostener el entrenamiento; vigila el rendimiento y la energía.')
  }

  const meals = proteinG > 160 ? 5 : proteinG > 120 ? 4 : 3
  const expectedWeeklyKg = Math.round(((targetKcal - tdee) * 7 / KCAL_PER_KG) * 100) / 100

  const explanations: Explanation[] = [
    {
      title: 'Gasto energético estimado',
      text:
        `Metabolismo basal con ${useKatch ? 'Katch-McArdle (usa tu % de grasa)' : 'Mifflin-St Jeor'}: ${Math.round(bmr)} kcal. ` +
        `Factor de actividad ${factor} (trabajo, pasos y ${profile.daysPerWeek} días de entrenamiento). ` +
        'Es una aproximación con un error individual de ±10 % o más: la evolución real del peso dirá cuál es tu gasto.',
      confidence: 'moderada',
      sourceIds: ['mifflin1990'],
    },
    {
      title: 'Calorías objetivo',
      text:
        effectiveGoal === 'gain'
          ? `Superávit del ${Math.round(adjustmentPct * 100)} % para tu nivel. Ritmo buscado: ${weeklyRatePct[0]}–${weeklyRatePct[1]} % del peso por semana. Un superávit moderado limita la ganancia de grasa.`
          : effectiveGoal === 'cut'
            ? `Déficit del ${Math.round(-adjustmentPct * 100)} %. Ritmo buscado: ${-weeklyRatePct[1]}–${-weeklyRatePct[0]} % del peso por semana, para conservar masa muscular.`
            : 'Calorías de mantenimiento. Útil para recomposición o para consolidar antes de otra fase.',
      confidence: 'moderada',
      sourceIds: effectiveGoal === 'cut' ? ['helms2014contestprep'] : ['iraki2019offseason'],
    },
    {
      title: 'Proteína',
      text:
        `${proteinPerKg} g/kg (rango ${proteinRangePerKg[0]}–${proteinRangePerKg[1]}). ` +
        `Repártela en ${meals} comidas de ~${Math.round(proteinG / meals)} g.`,
      confidence: effectiveGoal === 'cut' ? 'moderada' : 'alta',
      sourceIds: effectiveGoal === 'cut' ? ['helms2014contestprep', 'morton2018protein'] : ['morton2018protein'],
    },
    {
      title: 'Grasas y carbohidratos',
      text:
        `Grasas ${fatPerKg} g/kg (mínimo ~20 % de las calorías). Los carbohidratos completan el resto; ` +
        'conviene concentrarlos alrededor del entrenamiento cuando sea práctico.',
      confidence: 'baja',
      sourceIds: ['iraki2019offseason'],
    },
  ]

  return {
    hidden: profile.safety.eatingDisorderHistory,
    bmr: Math.round(bmr),
    bmrMethod: useKatch ? 'Katch-McArdle' : 'Mifflin-St Jeor',
    activityFactor: factor,
    tdee: round10(tdee),
    tdeeRange: [round10(tdee * 0.9), round10(tdee * 1.1)],
    targetKcal,
    adjustmentPct,
    weeklyRatePct,
    expectedWeeklyKg,
    proteinG,
    proteinPerKg,
    proteinRangePerKg,
    fatG,
    fatPerKg,
    carbsG,
    mealsNote: `${meals} comidas con ~${Math.round(proteinG / meals)} g de proteína cada una`,
    explanations,
    warnings,
  }
}
