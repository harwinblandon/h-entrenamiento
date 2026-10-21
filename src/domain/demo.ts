import { emptySafety } from './safety'
import type { Profile } from './types'

/** Perfil de demostración. Solo son datos iniciales: puede editarse o eliminarse. */
export function demoProfile(now = new Date()): Profile {
  const ts = now.toISOString()
  return {
    id: crypto.randomUUID(),
    name: 'H',
    sex: 'male',
    age: 33,
    heightCm: 170,
    weightKg: 75.5,
    waistCm: 84.5,
    experience: 'advanced',
    daysPerWeek: 5,
    sessionMinutes: 90,
    equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'smith', 'bodyweight'],
    job: 'sedentary',
    sleepHours: 7,
    sleepQuality: 3,
    stress: 3,
    injuries: '',
    avoidExerciseIds: [],
    preferredExerciseIds: [],
    goal: 'gain',
    priorityMuscles: ['quads', 'hamstrings', 'calves', 'triceps', 'traps'],
    supplements: [],
    supplementsNotes: '',
    cardio: { modalities: [], daysPerWeek: 0, minutes: 0 },
    lifeStage: 'none',
    lifeStageNotes: '',
    safety: emptySafety(),
    status: 'calibration',
    createdAt: ts,
    updatedAt: ts,
  }
}
