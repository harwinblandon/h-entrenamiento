import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { demoProfile } from '../domain/demo'
import { clearLocalData, db } from './db'
import { decideRemote, REMOTE } from './syncMiddleware'

const flush = () => new Promise((r) => setTimeout(r, 20))

describe('sincronización: registro local de cambios', () => {
  beforeEach(async () => {
    await clearLocalData()
  })

  it('sella versión y marca como pendiente cada escritura local', async () => {
    const p = demoProfile()
    await db.profiles.add(p)
    const saved = (await db.profiles.get(p.id)) as unknown as Record<string, number>
    expect(saved._dirty).toBe(1)
    expect(saved._v).toBeGreaterThan(0)

    const before = saved._v
    await flush()
    await db.profiles.update(p.id, { name: 'Otro' })
    const updated = (await db.profiles.get(p.id)) as unknown as Record<string, number>
    expect(updated._v).toBeGreaterThan(before)
  })

  it('los datos que llegan de la nube se escriben sin marcarse como pendientes', async () => {
    const p = demoProfile()
    await db.profiles.put({ ...p, _v: 123, _dirty: 0, [REMOTE]: true } as never)
    const saved = (await db.profiles.get(p.id)) as unknown as Record<string, unknown>
    expect(saved._v).toBe(123)
    expect(saved._dirty).toBe(0)
    expect(saved[REMOTE]).toBeUndefined()
  })

  it('los borrados locales dejan una marca para subirla, también en borrados por rango', async () => {
    const p = demoProfile()
    await db.profiles.add(p)
    await db.bodyLogs.bulkAdd([
      { id: 'b1', profileId: p.id, date: '2026-10-01', weightKg: 75 },
      { id: 'b2', profileId: p.id, date: '2026-10-02', weightKg: 75.2 },
    ])
    await db.profiles.delete(p.id)
    await db.bodyLogs.where('profileId').equals(p.id).delete()
    await flush()
    const keys = (await db.tombstones.toArray()).map((t) => t.key).sort()
    expect(keys).toEqual(['bodyLogs/b1', 'bodyLogs/b2', `profiles/${p.id}`])
  })

  it('vaciar los datos locales no genera marcas de borrado', async () => {
    await db.profiles.add(demoProfile())
    await clearLocalData()
    await flush()
    expect(await db.tombstones.count()).toBe(0)
    expect(await db.profiles.count()).toBe(0)
  })
})

describe('sincronización: resolución de conflictos', () => {
  it('gana la versión más reciente', () => {
    expect(decideRemote(undefined, { v: 5, deleted: false })).toBe('apply')
    expect(decideRemote(undefined, { v: 5, deleted: true })).toBe('ignore')
    expect(decideRemote({ v: 3, dirty: 0 }, { v: 5, deleted: false })).toBe('apply')
    expect(decideRemote({ v: 3, dirty: 1 }, { v: 5, deleted: true })).toBe('delete')
    expect(decideRemote({ v: 9, dirty: 1 }, { v: 5, deleted: false })).toBe('keep-local')
    expect(decideRemote({ v: 5, dirty: 1 }, { v: 5, deleted: false })).toBe('mark-clean')
    expect(decideRemote({ v: 5, dirty: 0 }, { v: 5, deleted: false })).toBe('ignore')
  })
})
