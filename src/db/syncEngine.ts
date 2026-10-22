import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  query,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
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
  /** El correo de la cuenta está verificado (necesario para el panel de administración). */
  emailVerified?: boolean
  /** Las reglas de Firestore permiten a esta cuenta leer la lista de cuentas. */
  isAdmin?: boolean
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

/** Resumen de uso de una cuenta, visible solo para el administrador (colección members/{uid}). */
export interface Member {
  uid: string
  email: string
  createdAt?: string
  lastSeenAt?: number
  profiles: number
  workouts: number
  lastWorkoutAt?: string
  bodyLogs: number
}

const MEMBER_THROTTLE_MS = 2 * 60_000
let lastMemberWrite = 0
let memberTimer: ReturnType<typeof setTimeout> | undefined

/** Actualiza el resumen de uso de la cuenta (como mucho cada 2 minutos). */
function scheduleMemberUpdate(force = false) {
  if (!user) return
  const wait = force ? 0 : Math.max(0, lastMemberWrite + MEMBER_THROTTLE_MS - Date.now())
  if (memberTimer) clearTimeout(memberTimer)
  memberTimer = setTimeout(() => void writeMember(), wait)
}

async function writeMember() {
  if (!user) return
  lastMemberWrite = Date.now()
  const finished = (await db.workouts.toArray()).filter((w) => w.finishedAt)
  const lastWorkoutAt = finished.map((w) => w.finishedAt!).sort().pop() ?? null
  try {
    await setDoc(
      doc(fs, 'members', user.uid),
      {
        email: user.email ?? '',
        createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime).toISOString() : null,
        lastSeenAt: serverTimestamp(),
        profiles: await db.profiles.count(),
        workouts: finished.length,
        lastWorkoutAt,
        bodyLogs: await db.bodyLogs.count(),
      },
      { merge: true },
    )
  } catch (e) {
    // Sin permiso (reglas sin actualizar) o sin conexión: no afecta a la sincronización de datos.
    console.warn('No se pudo actualizar el resumen de la cuenta', e)
  }
}

/**
 * Comprueba si la cuenta es administradora intentando leer la lista de cuentas: solo las reglas de
 * Firestore saben quién lo es, así que el correo del administrador no aparece en el código de la app.
 */
async function checkAdmin() {
  if (!user?.emailVerified) {
    setStatus({ isAdmin: false })
    return
  }
  try {
    await getDocs(query(collection(fs, 'members'), limit(1)))
    setStatus({ isAdmin: true })
  } catch {
    setStatus({ isAdmin: false })
  }
}

/** Lista de cuentas registradas (solo funciona para el administrador, según las reglas). */
export async function listMembers(): Promise<Member[]> {
  try {
    const snap = await getDocs(collection(fs, 'members'))
    return snap.docs.map((d) => {
      const m = d.data()
      return {
        uid: d.id,
        email: String(m.email ?? ''),
        createdAt: m.createdAt ?? undefined,
        lastSeenAt: m.lastSeenAt instanceof Timestamp ? m.lastSeenAt.toMillis() : undefined,
        profiles: Number(m.profiles ?? 0),
        workouts: Number(m.workouts ?? 0),
        lastWorkoutAt: m.lastWorkoutAt ?? undefined,
        bodyLogs: Number(m.bodyLogs ?? 0),
      }
    })
  } catch (e) {
    const code = (e as { code?: string })?.code
    throw new Error(
      code === 'permission-denied'
        ? 'Sin permiso para ver las cuentas: revisa que las reglas de Firestore incluyan el acceso de administrador.'
        : 'No se pudo cargar la lista de cuentas.',
    )
  }
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
    if (items.length) scheduleMemberUpdate()
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
  setStatus({ email: u.email ?? undefined, emailVerified: u.emailVerified, error: undefined })

  let first = true
  unsubSnapshot = onSnapshot(
    records(),
    async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type !== 'removed') await applyRemote(change.doc)
      }
      setStatus({ lastSyncedAt: Date.now(), pending: await countPending(), error: undefined })
      // Tras la primera descarga, los datos locales ya están completos para el resumen de uso.
      if (first) {
        scheduleMemberUpdate(true)
        void checkAdmin()
      }
      first = false
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
  if (memberTimer) clearTimeout(memberTimer)
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
      setStatus({ email: undefined, emailVerified: undefined, isAdmin: false, pending: 0, error: undefined })
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
  'auth/requires-recent-login': 'Por seguridad, cierra sesión, vuelve a entrar y repite la operación.',
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

/** Elimina la cuenta, todos sus datos en la nube y los datos de este dispositivo. */
export async function deleteAccountAndData() {
  const current = auth.currentUser
  if (!current || !user) throw new Error('No hay una sesión iniciada.')
  try {
    const snapshot = await getDocs(records())
    for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(fs)
      for (const d of snapshot.docs.slice(i, i + BATCH_SIZE)) batch.delete(d.ref)
      await batch.commit()
    }
    await deleteDoc(doc(fs, 'members', current.uid)).catch(() => undefined)
    stopSync()
    await deleteUser(current)
  } catch (e) {
    throw friendly(e)
  }
  await clearLocalData()
  try {
    localStorage.removeItem(LINKED_UID_KEY)
  } catch {
    // Sin almacenamiento: no afecta.
  }
}

/** Envía el correo de verificación a la cuenta actual. */
export async function sendVerification() {
  if (!auth.currentUser) throw new Error('No hay una sesión iniciada.')
  try {
    await sendEmailVerification(auth.currentUser)
  } catch (e) {
    throw friendly(e)
  }
}

/** Vuelve a comprobar si el correo ya se verificó (tras pulsar el enlace del correo). */
export async function refreshVerification(): Promise<boolean> {
  const current = auth.currentUser
  if (!current) return false
  await current.reload()
  await current.getIdToken(true)
  setStatus({ emailVerified: current.emailVerified })
  await checkAdmin()
  return current.emailVerified
}

export function syncNow() {
  void push()
}

export const pendingChanges = countPending
