import type { Equipment, Experience, Goal, JobActivity, LifeStage, Muscle } from './types'

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

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barra y discos',
  dumbbell: 'Mancuernas',
  machine: 'Máquinas',
  cable: 'Poleas',
  smith: 'Máquina Smith',
  suspension: 'TRX / suspensión',
  bodyweight: 'Peso corporal (barra de dominadas, paralelas)',
}

export const EQUIPMENT_PRESETS: { label: string; items: Equipment[] }[] = [
  { label: 'Gimnasio completo', items: ['barbell', 'dumbbell', 'machine', 'cable', 'smith', 'bodyweight'] },
  { label: 'Gimnasio básico', items: ['barbell', 'dumbbell', 'cable', 'bodyweight'] },
  { label: 'Casa con mancuernas', items: ['dumbbell', 'bodyweight'] },
  { label: 'Solo TRX', items: ['suspension', 'bodyweight'] },
]

export const SUPPLEMENTS = [
  'Creatina monohidratada',
  'Proteína en polvo',
  'Cafeína',
  'Vitamina D',
  'Omega-3',
  'Magnesio',
  'Multivitamínico',
  'Electrolitos',
  'Beta-alanina',
  'Citrulina',
  'Colágeno',
]

export const LIFE_STAGE_LABELS: Record<LifeStage, string> = {
  none: 'No aplica / prefiero no indicar',
  menstrual_tracking: 'Ciclo menstrual (registrar síntomas)',
  menopause: 'Perimenopausia / menopausia',
  pregnancy: 'Embarazo',
  postpartum: 'Posparto',
}
