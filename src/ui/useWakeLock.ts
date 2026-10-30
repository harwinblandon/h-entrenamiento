import { useEffect } from 'react'

type WakeLockSentinel = { release: () => Promise<void> }
type WakeLockApi = { request: (type: 'screen') => Promise<WakeLockSentinel> }

/**
 * Mantiene la pantalla encendida mientras `enabled` sea verdadero (p. ej. durante la sesión), para que
 * el cronómetro siga corriendo y pueda sonar. El navegador lo suelta al cambiar de app; se vuelve a
 * pedir al regresar.
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock
    if (!enabled || !api) return
    let sentinel: WakeLockSentinel | undefined
    let cancelled = false

    const acquire = async () => {
      try {
        const s = await api.request('screen')
        if (cancelled) void s.release()
        else sentinel = s
      } catch {
        // Sin permiso o batería baja: el cronómetro sigue funcionando con la pantalla encendida a mano.
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release()
    }
  }, [enabled])
}
