import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')

function initApp(): App {
  if (getApps().length > 0) return getApps()[0]!

  if (!projectId) throw new Error('Missing FIREBASE_ADMIN_PROJECT_ID')

  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    })
  }

  return initializeApp({ projectId })
}

const app = initApp()

export const adminAuth = getAuth(app)
export const adminDb = getFirestore(app)
export { FieldValue }

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'saisoorajpnair@gmail.com'

export async function verifyAdminToken(authHeader: string | null): Promise<string> {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized')
  const token = authHeader.slice(7)
  const decoded = await adminAuth.verifyIdToken(token)
  if (decoded.email !== ADMIN_EMAIL) throw new Error('Forbidden')
  return decoded.uid
}
