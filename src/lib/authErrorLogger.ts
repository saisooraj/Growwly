import { db } from './firebase'
import { collection, addDoc, query, orderBy, limit, getDocs, writeBatch, updateDoc, doc } from 'firebase/firestore'

export interface AuthAlertRecord {
  id: string
  type: 'auth_error'
  code: string
  message: string
  flow: string
  userAgent: string
  timestamp: string
  read: boolean
}

export async function logAuthError(params: {
  code: string
  message: string
  flow: string
}): Promise<void> {
  if (!db) return
  try {
    await addDoc(collection(db, 'adminAlerts'), {
      type: 'auth_error',
      code: params.code,
      message: params.message,
      flow: params.flow,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      timestamp: new Date().toISOString(),
      read: false,
    })
  } catch {
    // Non-critical — never block the auth flow
  }
}

// All alerts (read + unread) for the admin alerts page
export async function getAllAuthAlerts(limitCount = 200): Promise<AuthAlertRecord[]> {
  if (!db) return []
  try {
    const q = query(
      collection(db, 'adminAlerts'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    )
    const snap = await getDocs(q)
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as AuthAlertRecord))
      .filter(a => a.type === 'auth_error')
  } catch {
    return []
  }
}

// Unread only — used by the AppShell banner
export async function getUnreadAuthAlerts(): Promise<AuthAlertRecord[]> {
  const all = await getAllAuthAlerts(50)
  return all.filter(a => !a.read)
}

export async function markAlertRead(id: string): Promise<void> {
  if (!db) return
  try {
    await updateDoc(doc(db, 'adminAlerts', id), { read: true })
  } catch { /* non-critical */ }
}

export async function markAllAlertsRead(): Promise<void> {
  if (!db) return
  try {
    const alerts = await getUnreadAuthAlerts()
    if (alerts.length === 0) return
    const batch = writeBatch(db)
    alerts.forEach(a => batch.update(doc(db!, 'adminAlerts', a.id), { read: true }))
    await batch.commit()
  } catch { /* non-critical */ }
}
