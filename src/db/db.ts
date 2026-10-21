import Dexie, { type EntityTable } from 'dexie'
import { demoProfile } from '../domain/demo'
import type { BodyLog, Equipment, Plan, Profile, WorkoutLog } from '../domain/types'

export const db = new Dexie('atlas') as Dexie & {
  profiles: EntityTable<Profile, 'id'>
  plans: EntityTable<Plan, 'id'>
  workouts: EntityTable<WorkoutLog, 'id'>
  bodyLogs: EntityTable<BodyLog, 'id'>
}

db.version(1).stores({
  profiles: 'id, name',
  plans: 'id, profileId, active',
  workouts: 'id, profileId, planId, startedAt',
  bodyLogs: 'id, profileId, date',
})

const LEGACY_EQUIPMENT: Record<string, Equipment[]> = {
  full_gym: ['barbell', 'dumbbell', 'machine', 'cable', 'smith', 'bodyweight'],
  basic_gym: ['barbell', 'dumbbell', 'cable', 'bodyweight'],
  home: ['dumbbell', 'bodyweight'],
}

/** Convierte perfiles de versiones anteriores (también de respaldos importados) al formato actual. */
function migrateProfile(p: Record<string, unknown>) {
  if (typeof p.equipment === 'string') p.equipment = LEGACY_EQUIPMENT[p.equipment] ?? LEGACY_EQUIPMENT.full_gym
  if (typeof p.supplements === 'string') {
    p.supplementsNotes = p.supplements
    p.supplements = []
  }
  if (!p.cardio) {
    p.cardio = { modalities: [], daysPerWeek: 0, minutes: 0 }
    delete p.cardioAvailability
  }
}

// v2: equipamiento como lista, suplementos y cardio como opciones elegibles.
db.version(2)
  .stores({})
  .upgrade((tx) => tx.table('profiles').toCollection().modify(migrateProfile))

const SEEDED_KEY = 'atlas.seeded'

/** Crea el perfil de demostración solo la primera vez que se abre la app. */
export async function seedIfFirstRun(): Promise<string | undefined> {
  try {
    if (localStorage.getItem(SEEDED_KEY)) return undefined
    localStorage.setItem(SEEDED_KEY, '1')
  } catch {
    return undefined
  }
  if ((await db.profiles.count()) > 0) return undefined
  // Sin registro de peso: el de la ficha queda como referencia sin confirmar.
  const p = demoProfile()
  await db.profiles.add(p)
  return p.id
}

export async function deleteProfile(id: string) {
  await db.transaction('rw', [db.profiles, db.plans, db.workouts, db.bodyLogs], async () => {
    await db.plans.where('profileId').equals(id).delete()
    await db.workouts.where('profileId').equals(id).delete()
    await db.bodyLogs.where('profileId').equals(id).delete()
    await db.profiles.delete(id)
  })
}

export async function savePlan(plan: Plan) {
  await db.transaction('rw', db.plans, async () => {
    const current = await db.plans.where('profileId').equals(plan.profileId).toArray()
    for (const p of current) if (p.active) await db.plans.update(p.id, { active: false })
    await db.plans.put(plan)
  })
}

export async function activePlan(profileId: string): Promise<Plan | undefined> {
  const plans = await db.plans.where('profileId').equals(profileId).toArray()
  return plans.find((p) => p.active)
}

interface Backup {
  app: 'atlas'
  version: 1
  exportedAt: string
  profiles: Profile[]
  plans: Plan[]
  workouts: WorkoutLog[]
  bodyLogs: BodyLog[]
}

export async function exportData(): Promise<Backup> {
  return {
    app: 'atlas',
    version: 1,
    exportedAt: new Date().toISOString(),
    profiles: await db.profiles.toArray(),
    plans: await db.plans.toArray(),
    workouts: await db.workouts.toArray(),
    bodyLogs: await db.bodyLogs.toArray(),
  }
}

/** Importa un respaldo. Los registros con el mismo id se reemplazan; el resto se conserva. */
export async function importData(data: unknown): Promise<number> {
  const b = data as Partial<Backup>
  if (b?.app !== 'atlas' || !Array.isArray(b.profiles)) throw new Error('El archivo no es un respaldo válido de esta app.')
  await db.transaction('rw', [db.profiles, db.plans, db.workouts, db.bodyLogs], async () => {
    for (const p of b.profiles!) migrateProfile(p as unknown as Record<string, unknown>)
    await db.profiles.bulkPut(b.profiles!)
    await db.plans.bulkPut(b.plans ?? [])
    await db.workouts.bulkPut(b.workouts ?? [])
    await db.bodyLogs.bulkPut(b.bodyLogs ?? [])
  })
  return b.profiles.length
}
