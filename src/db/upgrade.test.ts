import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'

describe('migración a la versión con sincronización', () => {
  it('marca los datos existentes como pendientes con versión mínima y sigue registrando cambios', async () => {
    // Base de datos tal como la tiene hoy la app instalada (versión 2).
    const old = new Dexie('atlas')
    old.version(1).stores({ profiles: 'id, name', plans: 'id, profileId, active', workouts: 'id, profileId, planId, startedAt', bodyLogs: 'id, profileId, date' })
    old.version(2).stores({})
    await old.open()
    await old.table('profiles').put({ id: 'p1', name: 'H', equipment: ['barbell'] })
    await old.table('bodyLogs').put({ id: 'b1', profileId: 'p1', date: '2026-10-20', weightKg: 76 })
    old.close()

    const { db } = await import('./db')
    const p = (await db.profiles.get('p1')) as unknown as Record<string, unknown>
    expect(p._v).toBe(1)
    expect(p._dirty).toBe(1)
    expect(p.__remote).toBeUndefined()
    expect(await db.profiles.where('_dirty').equals(1).count()).toBe(1)

    await db.profiles.update('p1', { name: 'H2' })
    const after = (await db.profiles.get('p1')) as unknown as Record<string, number>
    expect(after._v).toBeGreaterThan(1)
  })
})
