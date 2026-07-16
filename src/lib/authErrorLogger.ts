import { db } from './firebase'
import { collection, addDoc, query, orderBy, limit, getDocs, writeBatch, doc } from 'firebase/firestore'

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

// Fetch the 50 most recent alerts and filter unread client-side
// (avoids needing a composite Firestore index)
export async function getUnreadAuthAlerts(): Promise<AuthAlertRecord[]> {
  if (!db) return []
  try {
    const q = query(
      collection(db, 'adminAlerts'),
      orderBy('timestamp', 'desc'),
      limit(50)
    )
    const snap = await getDocs(q)
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as AuthAlertRecord))
      .filter(a => !a.read && a.type === 'auth_error')
  } catch {
    return []
  }
}

export async function markAllAlertsRead(): Promise<void> {
  if (!db) return
  try {
    const alerts = await getUnreadAuthAlerts()
    if (alerts.length === 0) return
    const batch = writeBatch(db)
    alerts.forEach(a => batch.update(doc(db!, 'adminAlerts', a.id), { read: true }))
    await batch.commit()
  } catch {
    // Non-critical
  }
}
