import { getExercise } from './exercises'
import { EQUIPMENT_LABELS, EXPERIENCE_LABELS, MUSCLE_LABELS } from './labels'
import { hasPoorRecovery } from './planGenerator'
import type { PlanSnapshot, Profile } from './types'

/** Datos de la ficha que usa el generador. El peso, la cintura o el cardio no cambian el plan. */
export function planSnapshot(p: Profile): PlanSnapshot {
  return {
    daysPerWeek: p.daysPerWeek,
    sessionMinutes: p.sessionMinutes,
    experience: p.experience,
    previousWeeklySets: p.previousWeeklySets,
    poorRecovery: hasPoorRecovery(p),
    priorityMuscles: [...p.priorityMuscles].sort(),
    equipment: [...p.equipment].sort(),
    avoidExerciseIds: [...p.avoidExerciseIds].sort(),
    preferredExerciseIds: [...p.preferredExerciseIds].sort(),
  }
}

function listDiff<T extends string>(before: T[], after: T[], label: (x: T) => string): string | undefined {
  const added = after.filter((x) => !before.includes(x)).map((x) => `+${label(x)}`)
  const removed = before.filter((x) => !after.includes(x)).map((x) => `−${label(x)}`)
  const all = [...added, ...removed]
  return all.length ? all.join(', ') : undefined
}

const exerciseName = (id: string) => {
  try {
    return getExercise(id).name
  } catch {
    return id
  }
}

/** Cambios en la ficha desde que se generó el plan que justificarían regenerarlo. */
export function planChanges(snapshot: PlanSnapshot | undefined, profile: Profile): string[] {
  if (!snapshot) return []
  const now = planSnapshot(profile)
  const out: string[] = []
  if (snapshot.daysPerWeek !== now.daysPerWeek) out.push(`Días por semana: ${snapshot.daysPerWeek} → ${now.daysPerWeek}`)
  if (snapshot.sessionMinutes !== now.sessionMinutes) {
    out.push(`Duración máxima: ${snapshot.sessionMinutes} → ${now.sessionMinutes} min`)
  }
  if (snapshot.experience !== now.experience) {
    out.push(`Experiencia: ${EXPERIENCE_LABELS[snapshot.experience]} → ${EXPERIENCE_LABELS[now.experience]}`)
  }
  if (snapshot.previousWeeklySets !== now.previousWeeklySets) {
    out.push(`Series previas por músculo: ${snapshot.previousWeeklySets ?? '—'} → ${now.previousWeeklySets ?? '—'}`)
  }
  if (snapshot.poorRecovery !== now.poorRecovery) {
    out.push(now.poorRecovery ? 'Recuperación: empeoró (sueño o estrés)' : 'Recuperación: mejoró (sueño o estrés)')
  }
  const lists: [string, string | undefined][] = [
    ['Prioridades', listDiff(snapshot.priorityMuscles, now.priorityMuscles, (m) => MUSCLE_LABELS[m])],
    ['Equipamiento', listDiff(snapshot.equipment, now.equipment, (e) => EQUIPMENT_LABELS[e])],
    ['Ejercicios a evitar', listDiff(snapshot.avoidExerciseIds, now.avoidExerciseIds, exerciseName)],
    ['Ejercicios preferidos', listDiff(snapshot.preferredExerciseIds, now.preferredExerciseIds, exerciseName)],
  ]
  for (const [label, diff] of lists) if (diff) out.push(`${label}: ${diff}`)
  return out
}
