import type { FirebaseOptions } from 'firebase/app'

/**
 * Configuración pública del proyecto de Firebase (Configuración del proyecto → Tus apps → Web).
 * No es secreta: la seguridad la dan las reglas de Firestore (cada cuenta solo accede a lo suyo).
 * Con `null`, la app funciona solo en local y no muestra la sincronización.
 */
export const firebaseConfig: FirebaseOptions | null = {
  apiKey: 'AIzaSyCwkps6oUg0lBnbFRwFs7QnXbA3sRnSlpU',
  authDomain: 'h-entrenamiento.firebaseapp.com',
  projectId: 'h-entrenamiento',
  storageBucket: 'h-entrenamiento.firebasestorage.app',
  messagingSenderId: '787019900643',
  appId: '1:787019900643:web:6a4f62f83bfc69343507d6',
}
