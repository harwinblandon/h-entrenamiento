import type { FirebaseOptions } from 'firebase/app'

/**
 * Configuración pública del proyecto de Firebase (Configuración del proyecto → Tus apps → Web).
 * No es secreta: la seguridad la dan las reglas de Firestore (cada cuenta solo accede a lo suyo).
 * Mientras sea `null`, la app funciona solo en local y no muestra la sincronización.
 */
export const firebaseConfig: FirebaseOptions | null = null
