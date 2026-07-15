import { NextRequest, NextResponse } from 'next/server'
import { adminDb, verifyAdminToken } from '@/lib/firebaseAdmin'
import { rateLimit, getIp } from '@/lib/rateLimit'

const COLLECTIONS = [
  'transactions', 'budgets', 'projects', 'borrowings', 'contacts',
  'emergencyFunds', 'userSettings', 'savingsGoals', 'upcoming',
  'upcomingPayments', 'tasks', 'assets', 'liabilities',
  'healthRoutines', 'healthLogs', 'pushSubscriptions', 'userProfiles',
  'admin_feature_flags', 'admin_audit_log',
]

export async function GET(req: NextRequest) {
  const { limited } = rateLimit(`admin:system:${getIp(req)}`, 20, 60_000)
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  try {
    await verifyAdminToken(req.headers.get('Authorization'))

    const counts = await Promise.all(
      COLLECTIONS.map(async name => {
        try {
          const snap = await adminDb.collection(name).count().get()
          return { name, count: snap.data().count }
        } catch {
          return { name, count: 0 }
        }
      })
    )

    const [chatStats, lastAudit, flagCount] = await Promise.all([
      adminDb.doc('admin_system/stats').get(),
      adminDb.collection('admin_audit_log').orderBy('performedAt', 'desc').limit(1).get(),
      adminDb.collection('admin_feature_flags').where('enabled', '==', true).count().get(),
    ])

    const chatData = chatStats.exists ? chatStats.data() : {}

    return NextResponse.json({
      collections: counts,
      ai: {
        totalChatRequests: chatData?.totalChatRequests ?? 0,
        lastChatAt: chatData?.lastChatAt ?? null,
      },
      admin: {
        activeFlagCount: flagCount.data().count,
        lastAuditAt: lastAudit.empty ? null : lastAudit.docs[0].data().performedAt,
      },
      pushSubscriptions: counts.find(c => c.name === 'pushSubscriptions')?.count ?? 0,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'Unauthorized' || msg === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
