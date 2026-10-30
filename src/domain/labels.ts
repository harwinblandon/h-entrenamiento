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
  adductors: 'Aductores',
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
  pullup_bar: 'Barra de dominadas',
  dip_station: 'Paralelas para fondos',
  suspension: 'TRX / suspensión',
  household: 'Objetos de casa (silla firme, mochila con libros, garrafas, toalla)',
  bodyweight: 'Peso corporal (suelo, pared, escalón)',
}

export const EQUIPMENT_PRESETS: { label: string; items: Equipment[] }[] = [
  { label: 'Gimnasio completo', items: ['barbell', 'dumbbell', 'machine', 'cable', 'smith', 'pullup_bar', 'dip_station', 'bodyweight'] },
  { label: 'Gimnasio básico', items: ['barbell', 'dumbbell', 'cable', 'pullup_bar', 'dip_station', 'bodyweight'] },
  { label: 'Casa sin implementos', items: ['bodyweight', 'household'] },
  { label: 'Casa con mancuernas', items: ['dumbbell', 'bodyweight', 'household'] },
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
