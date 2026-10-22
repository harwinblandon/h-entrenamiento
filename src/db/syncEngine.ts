import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { liveQuery, type Subscription } from 'dexie'
import { clearLocalData, db } from './db'
import { decideRemote, markRemoteDelete, REMOTE, stripSyncFields, SYNCED_TABLES, type SyncedTable } from './syncMiddleware'

export type SyncState = 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error'

export interface SyncStatus {
  state: SyncState
  email?: string
  /** Cambios locales pendientes de subir. */
  pending: number
  lastSyncedAt?: number
  error?: string
}

/** Documento en Firestore: users/{uid}/records/{tabla}__{id}. */
interface RemoteRecord {
  table: SyncedTable
  id: string
  /** Registro serializado (JSON) para evitar las limitaciones de Firestore con arrays anidados y `undefined`. */
  json: string
  v: number
  deleted: boolean
}

const LINKED_UID_KEY = 'sync.uid'
const BATCH_SIZE = 400

let app: FirebaseApp
let auth: Auth
let fs: Firestore
let user: User | null = null
let unsubSnapshot: (() => void) | undefined
let dirtyWatch: Subscription | undefined
let pushTimer: ReturnType<typeof setTimeout> | undefined
let pushing = false
let status: SyncStatus = { state: 'signed-out', pending: 0 }
const listeners = new Set<(s: SyncStatus) => void>()

/** El estado se deriva siempre de los datos: sesión, error, conexión y pendientes. */
function setStatus(patch: Partial<Omit<SyncStatus, 'state'>>) {
  status = { ...status, ...patch }
  status.state = !user
    ? 'signed-out'
    : status.error
      ? 'error'
      : !navigator.onLine
        ? 'offline'
        : status.pending > 0 || pushing
          ? 'syncing'
          : 'synced'
  for (const l of listeners) l(status)
}

export function subscribeStatus(listener: (s: SyncStatus) => void): () => void {
  listeners.add(listener)
  listener(status)
  return () => listeners.delete(listener)
}

const records = () => collection(fs, 'users', user!.uid, 'records')
const recordRef = (table: string, id: string) => doc(fs, 'users', user!.uid, 'records', `${table}__${id}`)

async function countPending(): Promise<number> {
  let n = await db.tombstones.count()
  for (const t of SYNCED_TABLES) n += await db.table(t).where('_dirty').equals(1).count()
  return n
}

/** Sube los registros pendientes y las marcas de borrado. */
async function push() {
  if (!user || pushing) return
  pushing = true
  setStatus({})
  try {
    type Item = { ref: ReturnType<typeof recordRef>; data: RemoteRecord; done: () => Promise<void> }
    const items: Item[] = []
    for (const t of SYNCED_TABLES) {
      const dirty = (await db.table(t).where('_dirty').equals(1).toArray()) as Record<string, unknown>[]
      for (const v of dirty) {
        const id = String(v.id)
        const version = Number(v._v ?? 1)
        items.push({
          ref: recordRef(t, id),
          data: { table: t, id, json: JSON.stringify(stripSyncFields(v)), v: version, deleted: false },
          // Marcar como subido solo si nadie lo cambió mientras tanto.
          done: async () => {
            const current = (await db.table(t).get(id)) as Record<string, unknown> | undefined
            if (current && current._v === version) await db.table(t).put({ ...current, _dirty: 0, [REMOTE]: true })
          },
        })
      }
    }
    for (const tomb of await db.tombstones.toArray()) {
      items.push({
        ref: recordRef(tomb.table, tomb.id),
        data: { table: tomb.table, id: tomb.id, json: '', v: tomb._v, deleted: true },
        done: async () => {
          const current = await db.tombstones.get(tomb.key)
          if (current && current._v === tomb._v) await db.tombstones.delete(tomb.key)
        },
      })
    }
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE)
      const batch = writeBatch(fs)
      for (const it of chunk) batch.set(it.ref, { ...it.data, updatedAt: serverTimestamp() })
      await batch.commit()
      for (const it of chunk) await it.done()
    }
    setStatus({ lastSyncedAt: Date.now(), error: undefined })
  } catch (e) {
    setStatus({ error: e instanceof Error ? e.message : String(e) })
  } finally {
    pushing = false
    setStatus({ pending: await countPending() })
  }
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => void push(), 1500)
}

/** Aplica un registro que llega de la nube si es más reciente que el local. */
async function applyRemote(snap: QueryDocumentSnapshot) {
  const r = snap.data() as RemoteRecord
  if (!(SYNCED_TABLES as readonly string[]).includes(r.table)) return
  const table = db.table(r.table)
  const local = (await table.get(r.id)) as Record<string, unknown> | undefined
  const decision = decideRemote(local && { v: Number(local._v ?? 0), dirty: Number(local._dirty ?? 0) }, r)
  if (decision === 'apply') {
    await table.put({ ...JSON.parse(r.json), _v: r.v, _dirty: 0, [REMOTE]: true })
  } else if (decision === 'delete') {
    markRemoteDelete(r.table, r.id)
    await table.delete(r.id)
  } else if (decision === 'mark-clean' && local) {
    await table.put({ ...local, _dirty: 0, [REMOTE]: true })
  }
}

function startSync(u: User) {
  stopSync()
  user = u
  try {
    localStorage.setItem(LINKED_UID_KEY, u.uid)
  } catch {
    // Sin almacenamiento: no afecta a la sincronización.
  }
  setStatus({ email: u.email ?? undefined, error: undefined })

  unsubSnapshot = onSnapshot(
    records(),
    async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type !== 'removed') await applyRemote(change.doc)
      }
      setStatus({ lastSyncedAt: Date.now(), pending: await countPending(), error: undefined })
    },
    (e) => setStatus({ error: e.message }),
  )

  // Cada cambio local (registros pendientes o borrados) programa una subida.
  dirtyWatch = liveQuery(countPending).subscribe({
    next: (pending) => {
      setStatus({ pending })
      if (pending > 0) schedulePush()
    },
  })
}

function stopSync() {
  unsubSnapshot?.()
  unsubSnapshot = undefined
  dirtyWatch?.unsubscribe()
  dirtyWatch = undefined
  if (pushTimer) clearTimeout(pushTimer)
  user = null
}

/** Inicia Firebase y retoma la sesión guardada en este dispositivo, si la hay. */
export function initSync(config: FirebaseOptions) {
  if (app) return
  app = initializeApp(config)
  auth = getAuth(app)
  fs = getFirestore(app)
  window.addEventListener('online', () => {
    setStatus({})
    schedulePush()
  })
  window.addEventListener('offline', () => setStatus({}))
  onAuthStateChanged(auth, async (u) => {
    if (u) {
      // Datos de otra cuenta en este dispositivo: no mezclarlos.
      let linked: string | null = null
      try {
        linked = localStorage.getItem(LINKED_UID_KEY)
      } catch {
        linked = null
      }
      if (linked && linked !== u.uid) await clearLocalData()
      else if (!linked && (await onlyUntouchedDemo())) await clearLocalData()
      startSync(u)
    } else {
      stopSync()
      setStatus({ email: undefined, pending: 0, error: undefined })
    }
  })
}

/** El dispositivo solo tiene el perfil de ejemplo sin modificar: no debe subirse a la cuenta. */
async function onlyUntouchedDemo(): Promise<boolean> {
  const profiles = await db.profiles.toArray()
  if (profiles.length !== 1 || profiles[0].createdAt !== profiles[0].updatedAt) return false
  return (await db.plans.count()) + (await db.workouts.count()) + (await db.bodyLogs.count()) === 0
}

const AUTH_ERRORS: Record<string, string> = {
  'auth/invalid-email': 'El correo no es válido.',
  'auth/missing-password': 'Escribe la contraseña.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Usa «Entrar».',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'No existe una cuenta con ese correo.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
  'auth/network-request-failed': 'Sin conexión. Inténtalo con internet.',
}

function friendly(e: unknown): Error {
  const code = (e as { code?: string })?.code ?? ''
  return new Error(AUTH_ERRORS[code] ?? 'No se pudo completar la operación. Inténtalo de nuevo.')
}

export async function signIn(email: string, password: string) {
  try {
    await signInWithEmailAndPassword(auth, email.trim(), password)
  } catch (e) {
    throw friendly(e)
  }
}

export async function signUp(email: string, password: string) {
  try {
    await createUserWithEmailAndPassword(auth, email.trim(), password)
  } catch (e) {
    throw friendly(e)
  }
}

export async function resetPassword(email: string) {
  try {
    await sendPasswordResetEmail(auth, email.trim())
  } catch (e) {
    throw friendly(e)
  }
}

/** Cierra sesión y borra los datos de este dispositivo (siguen en la nube). */
export async function signOutAndClear() {
  stopSync()
  await signOut(auth)
  await clearLocalData()
  try {
    localStorage.removeItem(LINKED_UID_KEY)
  } catch {
    // Sin almacenamiento: no afecta.
  }
}

export function syncNow() {
  void push()
}

export const pendingChanges = countPending
