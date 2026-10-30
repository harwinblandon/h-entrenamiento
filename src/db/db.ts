import Dexie, { type EntityTable } from 'dexie'
import type { BodyLog, CustomFood, Equipment, FoodLog, Plan, Profile, SharedFood, WorkoutLog } from '../domain/types'
import { DIRTY, REMOTE, setDeleteTracking, setTombstoneHandler, SYNCED_TABLES, syncMiddleware, VERSION, type SyncedTable } from './syncMiddleware'

/** Marca de borrado local pendiente de subir a la nube. */
export interface Tombstone {
  key: string
  table: SyncedTable
  id: string
  _v: number
}

export const db = new Dexie('atlas') as Dexie & {
  profiles: EntityTable<Profile, 'id'>
  plans: EntityTable<Plan, 'id'>
  workouts: EntityTable<WorkoutLog, 'id'>
  bodyLogs: EntityTable<BodyLog, 'id'>
  foodLogs: EntityTable<FoodLog, 'id'>
  customFoods: EntityTable<CustomFood, 'id'>
  /** Copia local de la lista común de productos (la fuente es Firestore; no se sincroniza como registro). */
  sharedFoods: EntityTable<SharedFood, 'id'>
  tombstones: EntityTable<Tombstone, 'key'>
}

// Sella versión y «pendiente de subir» en cada escritura de las tablas sincronizadas.
db.use(syncMiddleware)
setTombstoneHandler((table, ids) => {
  const now = Date.now()
  void Dexie.ignoreTransaction(() =>
    db.tombstones.bulkPut(ids.map((id) => ({ key: `${table}/${id}`, table, id, _v: now }))),
  )
})

db.version(1).stores({
  profiles: 'id, name',
  plans: 'id, profileId, active',
  workouts: 'id, profileId, planId, startedAt',
  bodyLogs: 'id, profileId, date',
})

const LEGACY_EQUIPMENT: Record<string, Equipment[]> = {
  full_gym: ['barbell', 'dumbbell', 'machine', 'cable', 'smith', 'pullup_bar', 'dip_station', 'bodyweight'],
  basic_gym: ['barbell', 'dumbbell', 'cable', 'pullup_bar', 'dip_station', 'bodyweight'],
  home: ['dumbbell', 'bodyweight'],
}

const GYM_EQUIPMENT: Equipment[] = ['barbell', 'machine', 'cable', 'smith']

/** Convierte perfiles de versiones anteriores (también de respaldos importados) al formato actual. */
export function migrateProfile(p: Record<string, unknown>) {
  if (typeof p.equipment === 'string') p.equipment = LEGACY_EQUIPMENT[p.equipment] ?? LEGACY_EQUIPMENT.full_gym
  // Antes «peso corporal» incluía barra de dominadas y paralelas; en un gimnasio se conservan.
  const eq = p.equipment as Equipment[]
  if (eq.includes('bodyweight') && eq.some((e) => GYM_EQUIPMENT.includes(e)) && !eq.includes('pullup_bar')) {
    p.equipment = [...eq, 'pullup_bar', 'dip_station']
  }
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

// v3: sincronización en la nube. Los registros existentes quedan pendientes de subir con versión
// mínima, para que, si la nube ya tuviera ese registro, gane la versión de la nube.
db.version(3)
  .stores({
    profiles: 'id, name, _dirty',
    plans: 'id, profileId, active, _dirty',
    workouts: 'id, profileId, planId, startedAt, _dirty',
    bodyLogs: 'id, profileId, date, _dirty',
    tombstones: 'key',
  })
  .upgrade(async (tx) => {
    // Solo las tablas que existían en la v3 (las posteriores nacen ya con sus campos de sincronización).
    for (const t of ['profiles', 'plans', 'workouts', 'bodyLogs']) {
      await tx
        .table(t)
        .toCollection()
        .modify((v: Record<string, unknown>) => {
          v[VERSION] = 1
          v[DIRTY] = 1
          v[REMOTE] = true
        })
    }
  })

// v4: barra de dominadas y paralelas separadas del peso corporal.
db.version(4)
  .stores({})
  .upgrade((tx) =>
    tx
      .table('profiles')
      .toCollection()
      .modify((p: Record<string, unknown>) => {
        const before = JSON.stringify(p.equipment)
        migrateProfile(p)
        // Solo los perfiles que cambian quedan pendientes de subir; el resto se escribe tal cual.
        if (JSON.stringify(p.equipment) === before) p[REMOTE] = true
      }),
  )

// v5: registro de comidas y productos propios.
db.version(5).stores({
  foodLogs: 'id, profileId, [profileId+date], _dirty',
  customFoods: 'id, profileId, _dirty',
})

// v6: copia local de la lista común de productos y códigos de barras.
db.version(6).stores({
  customFoods: 'id, profileId, barcode, _dirty',
  sharedFoods: 'id, barcode',
})

/** Borra todos los datos locales (al cerrar sesión: siguen en la nube). */
export async function clearLocalData() {
  setDeleteTracking(false)
  try {
    await db.transaction('rw', [db.profiles, db.plans, db.workouts, db.bodyLogs, db.foodLogs, db.customFoods, db.sharedFoods, db.tombstones], async () => {
      for (const t of SYNCED_TABLES) await db.table(t).clear()
      await db.tombstones.clear()
      await db.sharedFoods.clear()
    })
  } finally {
    setDeleteTracking(true)
  }
}

export async function deleteProfile(id: string) {
  await db.transaction('rw', [db.profiles, db.plans, db.workouts, db.bodyLogs, db.foodLogs, db.customFoods], async () => {
    await db.plans.where('profileId').equals(id).delete()
    await db.foodLogs.where('profileId').equals(id).delete()
    await db.customFoods.where('profileId').equals(id).delete()
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

/** Guarda el cierre de un mesociclo: descarga activa con el siguiente en cola, o el siguiente directamente. */
export async function saveNextCycle(next: Plan, deload?: Plan) {
  await db.transaction('rw', db.plans, async () => {
    const plans = await db.plans.where('profileId').equals(next.profileId).toArray()
    for (const p of plans) if (p.queued) await db.plans.delete(p.id)
  })
  if (deload) {
    await savePlan(deload)
    await db.plans.put({ ...next, active: false, queued: true })
  } else {
    await savePlan(next)
  }
}

/** Al terminar la descarga, activa el mesociclo que quedó preparado. */
export async function activateQueuedPlan(profileId: string): Promise<boolean> {
  const queued = (await db.plans.where('profileId').equals(profileId).toArray()).find((p) => p.queued)
  if (!queued) return false
  await savePlan({ ...queued, queued: false, active: true, createdAt: new Date().toISOString() })
  return true
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
  foodLogs?: FoodLog[]
  customFoods?: CustomFood[]
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
    foodLogs: await db.foodLogs.toArray(),
    customFoods: await db.customFoods.toArray(),
  }
}

/** Importa un respaldo. Los registros con el mismo id se reemplazan; el resto se conserva. */
export async function importData(data: unknown): Promise<number> {
  const b = data as Partial<Backup>
  if (b?.app !== 'atlas' || !Array.isArray(b.profiles)) throw new Error('El archivo no es un respaldo válido de esta app.')
  await db.transaction('rw', [db.profiles, db.plans, db.workouts, db.bodyLogs, db.foodLogs, db.customFoods], async () => {
    for (const p of b.profiles!) migrateProfile(p as unknown as Record<string, unknown>)
    await db.profiles.bulkPut(b.profiles!)
    await db.plans.bulkPut(b.plans ?? [])
    await db.workouts.bulkPut(b.workouts ?? [])
    await db.bodyLogs.bulkPut(b.bodyLogs ?? [])
    await db.foodLogs.bulkPut(b.foodLogs ?? [])
    await db.customFoods.bulkPut(b.customFoods ?? [])
  })
  return b.profiles.length
}
