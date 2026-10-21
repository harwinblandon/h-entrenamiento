import type { EquipmentProfile, Experience, Goal, JobActivity, LifeStage, Muscle } from './types'

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Pecho',
  back: 'Espalda',
  traps: 'Trapecio',
  delts_front: 'Deltoides anterior',
  delts_side: 'Deltoides lateral',
  delts_rear: 'Deltoides posterior',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  quads: 'Cuádriceps',
  hamstrings: 'Isquiotibiales',
  glutes: 'Glúteos',
  calves: 'Pantorrillas',
  abs: 'Abdomen',
}

export const EXPERIENCE_LABELS: Record<Experience, string> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
}

export const GOAL_LABELS: Record<Goal, string> = {
  gain: 'Aumento (ganancia muscular)',
  maintain: 'Mantenimiento / recomposición',
  cut: 'Definición (pérdida de grasa)',
}

export const JOB_LABELS: Record<JobActivity, string> = {
  sedentary: 'Sedentario',
  moderate: 'Moderado',
  active: 'Físicamente activo',
}

export const EQUIPMENT_LABELS: Record<EquipmentProfile, string> = {
  full_gym: 'Gimnasio completo',
  basic_gym: 'Gimnasio básico (barras, mancuernas, poleas)',
  home: 'Casa (mancuernas y peso corporal)',
}

export const LIFE_STAGE_LABELS: Record<LifeStage, string> = {
  none: 'No aplica / prefiero no indicar',
  menstrual_tracking: 'Ciclo menstrual (registrar síntomas)',
  menopause: 'Perimenopausia / menopausia',
  pregnancy: 'Embarazo',
  postpartum: 'Posparto',
}
