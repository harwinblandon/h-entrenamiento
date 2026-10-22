import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { SyncStatus } from '../db/syncEngine'
import { firebaseConfig } from '../firebaseConfig'

type Engine = typeof import('../db/syncEngine')

interface SyncCtx {
  /** Hay un proyecto de Firebase configurado. */
  enabled: boolean
  status: SyncStatus
  engine?: Engine
}

const initial: SyncStatus = { state: 'signed-out', pending: 0 }
const Ctx = createContext<SyncCtx>({ enabled: false, status: initial })

/** Carga Firebase solo si está configurado (y de forma diferida, para no pesar en el arranque). */
export function SyncProvider({ children }: { children: ReactNode }) {
  const [engine, setEngine] = useState<Engine>()
  const [status, setStatus] = useState<SyncStatus>(initial)

  useEffect(() => {
    if (!firebaseConfig) return
    let unsubscribe: (() => void) | undefined
    let cancelled = false
    void import('../db/syncEngine').then((mod) => {
      if (cancelled) return
      mod.initSync(firebaseConfig!)
      unsubscribe = mod.subscribeStatus(setStatus)
      setEngine(mod)
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  return <Ctx.Provider value={{ enabled: !!firebaseConfig, status, engine }}>{children}</Ctx.Provider>
}

export const useSync = () => useContext(Ctx)

export const SYNC_LABELS: Record<SyncStatus['state'], string> = {
  'signed-out': 'Sin cuenta',
  syncing: 'Sincronizando…',
  synced: 'Sincronizado',
  offline: 'Sin conexión',
  error: 'Error al sincronizar',
}
