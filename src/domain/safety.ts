import type { SafetyAnswers } from './types'

type QuestionKey = Exclude<keyof SafetyAnswers, 'medicalClearance'>

export interface SafetyQuestion {
  key: QuestionKey
  text: string
  /** clearance: requiere autorización profesional antes de entrenar. caution: advertencia. */
  severity: 'clearance' | 'caution'
  advice: string
}

export const SAFETY_QUESTIONS: SafetyQuestion[] = [
  { key: 'chestPain', text: '¿Has sentido dolor en el pecho durante el ejercicio o en reposo?', severity: 'clearance', advice: 'Consulta con un médico antes de entrenar.' },
  { key: 'dizziness', text: '¿Has perdido el equilibrio por mareos o perdido el conocimiento en los últimos 12 meses?', severity: 'clearance', advice: 'Consulta con un médico antes de entrenar.' },
  { key: 'cardiovascular', text: '¿Te han diagnosticado alguna enfermedad cardíaca o cardiovascular?', severity: 'clearance', advice: 'Necesitas valoración y autorización médica.' },
  { key: 'uncontrolledHypertension', text: '¿Tienes presión arterial alta no controlada?', severity: 'clearance', advice: 'Necesitas valoración médica antes de entrenar con cargas.' },
  { key: 'recentSurgery', text: '¿Te han operado en los últimos 6 meses?', severity: 'clearance', advice: 'Pide autorización a quien te operó o a un fisioterapeuta.' },
  { key: 'pregnancyPostpartum', text: '¿Estás embarazada o en posparto (últimos 12 meses)?', severity: 'clearance', advice: 'Entrena con autorización y acompañamiento de tu profesional obstétrico.' },
  { key: 'otherCondition', text: '¿Tienes enfermedad renal, diabetes con medicación u otra condición médica crónica relevante?', severity: 'clearance', advice: 'Consulta con tu médico tratante sobre el ejercicio y la alimentación.' },
  { key: 'recentInjury', text: '¿Tienes una lesión reciente (últimos 3 meses) que aún limite tu movimiento?', severity: 'caution', advice: 'Evita los ejercicios que la agraven y considera valoración con un fisioterapeuta.' },
  { key: 'jointPain', text: '¿Tienes dolor articular o muscular persistente que empeore con la actividad?', severity: 'caution', advice: 'Registra el dolor en cada serie; si persiste, consulta con un fisioterapeuta.' },
  { key: 'eatingDisorderHistory', text: '¿Tienes antecedentes de trastornos de la conducta alimentaria?', severity: 'caution', advice: 'El cálculo de calorías se ocultará. Te recomendamos acompañamiento de profesionales en nutrición y salud mental.' },
]

export function emptySafety(): SafetyAnswers {
  return {
    chestPain: false,
    dizziness: false,
    cardiovascular: false,
    uncontrolledHypertension: false,
    recentInjury: false,
    jointPain: false,
    recentSurgery: false,
    pregnancyPostpartum: false,
    otherCondition: false,
    eatingDisorderHistory: false,
    medicalClearance: false,
  }
}

export interface SafetyResult {
  level: 'ok' | 'caution' | 'clearance_required'
  flags: SafetyQuestion[]
  canGenerate: boolean
}

export function evaluateSafety(answers: SafetyAnswers): SafetyResult {
  const flags = SAFETY_QUESTIONS.filter((q) => answers[q.key])
  const needsClearance = flags.some((q) => q.severity === 'clearance')
  return {
    level: needsClearance ? 'clearance_required' : flags.length > 0 ? 'caution' : 'ok',
    flags,
    canGenerate: !needsClearance || answers.medicalClearance,
  }
}
