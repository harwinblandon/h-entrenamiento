/**
 * Sonidos del cronómetro de descanso, generados con Web Audio (sin archivos, funcionan sin conexión).
 * Los navegadores solo permiten sonar después de una interacción: `unlockAudio` se llama al pulsar
 * «Registrar serie», que es justo lo que inicia el descanso.
 */

export interface TimerPrefs {
  sound: boolean
  /** 0 a 1. */
  volume: number
  /** Aviso discreto 10 s antes de terminar. */
  warn: boolean
  /** Mantener la pantalla encendida durante la sesión. */
  keepAwake: boolean
}

const KEY = 'app.timerPrefs'
const DEFAULTS: TimerPrefs = { sound: true, volume: 0.6, warn: true, keepAwake: true }

export function loadTimerPrefs(): TimerPrefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

export function saveTimerPrefs(prefs: TimerPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // Sin almacenamiento: las preferencias duran esta sesión.
  }
}

let ctx: AudioContext | undefined

function audio(): AudioContext | undefined {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return undefined
    // En Safari (iOS 16.4+), reproducir como audio de «reproducción» para no depender del interruptor de silencio.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
    if (session) session.type = 'playback'
    ctx = new Ctor()
  }
  return ctx
}

/** Habilita el audio; debe llamarse dentro de un gesto del usuario (un toque o clic). */
export function unlockAudio() {
  const c = audio()
  if (c && c.state === 'suspended') void c.resume()
}

/** Una nota con ataque corto y caída suave, como una campanilla. */
function bell(c: AudioContext, freq: number, at: number, volume: number, length = 1.1) {
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), at + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  gain.connect(c.destination)
  for (const [mult, level] of [
    [1, 1],
    [2.01, 0.25],
  ] as const) {
    const osc = c.createOscillator()
    const partial = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq * mult
    partial.gain.value = level
    osc.connect(partial).connect(gain)
    osc.start(at)
    osc.stop(at + length + 0.05)
  }
}

/** Fin del descanso: dos campanillas ascendentes, repetidas una vez. */
export function playRestEnd(volume: number) {
  const c = audio()
  if (!c || volume <= 0) return
  if (c.state === 'suspended') void c.resume()
  const t = c.currentTime + 0.03
  const v = 0.35 * volume
  for (const offset of [0, 0.9]) {
    bell(c, 659.25, t + offset, v) // Mi
    bell(c, 880, t + offset + 0.18, v) // La
  }
}

/** Aviso previo: un toque breve y bajo. */
export function playWarning(volume: number) {
  const c = audio()
  if (!c || volume <= 0) return
  if (c.state === 'suspended') void c.resume()
  bell(c, 523.25, c.currentTime + 0.02, 0.18 * volume, 0.35)
}
