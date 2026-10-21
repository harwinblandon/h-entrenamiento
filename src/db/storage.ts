import { todayISO } from '../domain/schedule'
import { exportData } from './db'

const LAST_BACKUP_KEY = 'app.lastBackup'

/**
 * Pide al navegador que no borre los datos de la app por su cuenta (p. ej. por falta de espacio
 * o de uso). Los navegadores lo conceden con más facilidad a las apps instaladas en la pantalla de inicio.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function isStoragePersistent(): Promise<boolean | undefined> {
  try {
    return navigator.storage?.persisted ? await navigator.storage.persisted() : undefined
  } catch {
    return undefined
  }
}

/** Fecha (ISO) del último respaldo exportado en este dispositivo. */
export function lastBackupDate(): string | undefined {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY) ?? undefined
  } catch {
    return undefined
  }
}

/** Descarga un respaldo completo en JSON y recuerda la fecha. */
export async function downloadBackup() {
  const data = await exportData()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `respaldo-entrenamiento-${todayISO()}.json`
  a.click()
  URL.revokeObjectURL(url)
  try {
    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString())
  } catch {
    // Sin almacenamiento: el recordatorio volverá a aparecer.
  }
}

/** La app se abrió instalada (pantalla de inicio) y no en una pestaña del navegador. */
export function isInstalled(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
