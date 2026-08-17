import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore'

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL

// Handle both formats that appear on Vercel:
//   - literal \n characters (from .env.local copy-paste)
//   - actual newlines (if Vercel interpreted them)
// Also strip surrounding quotes if pasted incorrectly
const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '')
  .replace(/^["']|["']$/g, '')
  .replace(/\\n/g, '\n')

let _auth: Auth | null = null
let _db: Firestore | null = null
let _initError: string | null = null

function initApp(): App {
  if (getApps().length > 0) return getApps()[0]!

  if (!projectId) throw new Error('FIREBASE_ADMIN_PROJECT_ID not configured')
  if (!clientEmail) throw new Error('FIREBASE_ADMIN_CLIENT_EMAIL not configured')
  if (!privateKey || !privateKey.includes('BEGIN')) throw new Error('FIREBASE_ADMIN_PRIVATE_KEY not configured or malformed')

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  })
}

// Lazy init — errors are caught here so module load never crashes.
// Every API route will get a proper JSON error instead of HTML 500.
try {
  const app = initApp()
  _auth = getAuth(app)
  _db = getFirestore(app)
} catch (e) {
  _initError = e instanceof Error ? e.message : 'Firebase Admin init failed'
  console.error('[firebaseAdmin] Init error:', _initError)
}

function requireAuth(): Auth {
  if (!_auth) throw new Error(`Firebase Admin not ready: ${_initError}`)
  return _auth
}

function requireDb(): Firestore {
  if (!_db) throw new Error(`Firebase Admin not ready: ${_initError}`)
  return _db
}

// Proxy so callers keep the same import syntax (adminAuth.xyz, adminDb.xyz)
// but errors surface as JSON instead of crashing the module.
export const adminAuth = new Proxy({} as Auth, {
  get(_, prop: string) {
    const auth = requireAuth()
    const val = auth[prop as keyof Auth]
    return typeof val === 'function' ? (val as Function).bind(auth) : val
  },
})

export const adminDb = new Proxy({} as Firestore, {
  get(_, prop: string) {
    const db = requireDb()
    const val = db[prop as keyof Firestore]
    return typeof val === 'function' ? (val as Function).bind(db) : val
  },
})

export { FieldValue }

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'saisoorajpnair@gmail.com'

export async function verifyAdminToken(authHeader: string | null): Promise<string> {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized')
  const token = authHeader.slice(7)
  const decoded = await requireAuth().verifyIdToken(token)
  if (decoded.email !== ADMIN_EMAIL) throw new Error('Forbidden')
  return decoded.uid
}

// Same shape as verifyAdminToken but for any signed-in user — used by endpoints
// that serve admin-authored content (e.g. active announcements) to the regular app.
export async function verifyUserToken(authHeader: string | null): Promise<string> {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized')
  const token = authHeader.slice(7)
  const decoded = await requireAuth().verifyIdToken(token)
  return decoded.uid
}
