import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { db, seedIfFirstRun } from '../db/db'
import type { Profile } from '../domain/types'

const KEY = 'atlas.activeProfile'

interface ActiveProfileCtx {
  profiles: Profile[] | undefined
  active: Profile | undefined
  setActiveId: (id: string | undefined) => void
}

const Ctx = createContext<ActiveProfileCtx>({ profiles: undefined, active: undefined, setActiveId: () => {} })

function readStored(): string | undefined {
  try {
    return localStorage.getItem(KEY) ?? undefined
  } catch {
    return undefined
  }
}

export function ActiveProfileProvider({ children }: { children: ReactNode }) {
  const [activeId, setActive] = useState<string | undefined>(readStored)
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

  useEffect(() => {
    seedIfFirstRun().then((id) => id && setActiveId(id))
  }, [setActiveId])

  const active = profiles?.find((p) => p.id === activeId) ?? profiles?.[0]
  return <Ctx.Provider value={{ profiles, active, setActiveId }}>{children}</Ctx.Provider>
}

export const useActiveProfile = () => useContext(Ctx)
