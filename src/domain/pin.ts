import type { PinLock } from './types'

/** Clave numérica de 4 a 6 dígitos. */
export const PIN_PATTERN = /^\d{4,6}$/

const toHex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function hashPin(pin: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`))
  return toHex(new Uint8Array(digest))
}

export async function createPin(pin: string): Promise<PinLock> {
  if (!PIN_PATTERN.test(pin)) throw new Error('La clave debe tener entre 4 y 6 números.')
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)))
  return { salt, hash: await hashPin(pin, salt) }
}

export async function verifyPin(pin: string, lock: PinLock): Promise<boolean> {
  return (await hashPin(pin, lock.salt)) === lock.hash
}
