import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { db, seedIfFirstRun } from '../db/db'
import { verifyPin } from '../domain/pin'
import type { Profile } from '../domain/types'

const KEY = 'atlas.activeProfile'
/** Personas desbloqueadas: duran hasta cerrar el navegador (sessionStorage). */
const UNLOCKED_KEY = 'app.unlocked'

interface ActiveProfileCtx {
  profiles: Profile[] | undefined
  active: Profile | undefined
  setActiveId: (id: string | undefined) => void
  isLocked: (p: Profile | undefined) => boolean
  unlock: (p: Profile, pin: string) => Promise<boolean>
  /** Marca como desbloqueada sin pedir clave (p. ej. justo después de crearla). */
  markUnlocked: (id: string) => void
  lock: (id: string) => void
}

const Ctx = createContext<ActiveProfileCtx>({
  profiles: undefined,
  active: undefined,
  setActiveId: () => {},
  isLocked: () => false,
  unlock: async () => false,
  markUnlocked: () => {},
  lock: () => {},
})

function readStored(): string | undefined {
  try {
    return localStorage.getItem(KEY) ?? undefined
  } catch {
    return undefined
  }
}

function readUnlocked(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(UNLOCKED_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function ActiveProfileProvider({ children }: { children: ReactNode }) {
  const [activeId, setActive] = useState<string | undefined>(readStored)
  const [unlocked, setUnlocked] = useState<string[]>(readUnlocked)
  const profiles = useLiveQuery(() => db.profiles.orderBy('name').toArray(), [])

  const setActiveId = useCallback((id: string | undefined) => {
    setActive(id)
    try {
      if (id) localStorage.setItem(KEY, id)
      else localStorage.removeItem(KEY)
    } catch {
      // Sin almacenamiento disponible: la selección dura solo esta sesión.
    }
  }, [])

  const saveUnlocked = useCallback((next: string[]) => {
    setUnlocked(next)
    try {
      sessionStorage.setItem(UNLOCKED_KEY, JSON.stringify(next))
    } catch {
      // Sin almacenamiento: el desbloqueo dura hasta recargar la página.
    }
  }, [])

  const markUnlocked = useCallback((id: string) => saveUnlocked([...new Set([...readUnlocked(), id])]), [saveUnlocked])

  const unlock = useCallback(
    async (p: Profile, pin: string) => {
      if (!p.pin || !(await verifyPin(pin, p.pin))) return false
      markUnlocked(p.id)
      return true
    },
    [markUnlocked],
  )

  const lock = useCallback((id: string) => saveUnlocked(readUnlocked().filter((x) => x !== id)), [saveUnlocked])

  const isLocked = useCallback((p: Profile | undefined) => !!p?.pin && !unlocked.includes(p.id), [unlocked])

  useEffect(() => {
    seedIfFirstRun().then((id) => id && setActiveId(id))
  }, [setActiveId])

  const active = profiles?.find((p) => p.id === activeId) ?? profiles?.[0]
  return (
    <Ctx.Provider value={{ profiles, active, setActiveId, isLocked, unlock, markUnlocked, lock }}>{children}</Ctx.Provider>
  )
}

export const useActiveProfile = () => useContext(Ctx)
