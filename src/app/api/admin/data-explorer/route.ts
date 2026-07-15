import { NextRequest, NextResponse } from 'next/server'
import { adminDb, verifyAdminToken } from '@/lib/firebaseAdmin'
import { rateLimit, getIp } from '@/lib/rateLimit'

// Allowlist of collections the data explorer is permitted to read.
// Prevents querying arbitrary collection names via URL injection.
const ALLOWED_COLLECTIONS = new Set([
  'transactions', 'budgets', 'projects', 'borrowings', 'contacts',
  'savingsGoals', 'upcoming', 'upcomingPayments', 'tasks',
  'assets', 'liabilities', 'healthRoutines',
])

export async function GET(req: NextRequest) {
  const { limited } = rateLimit(`admin:explorer:${getIp(req)}`, 30, 60_000)
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  try {
    await verifyAdminToken(req.headers.get('Authorization'))

    const url = new URL(req.url)
    const uid = url.searchParams.get('uid')
    const collection = url.searchParams.get('collection')

    if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 })

    if (collection) {
      // Block any collection name not on the allowlist
      if (!ALLOWED_COLLECTIONS.has(collection)) {
        return NextResponse.json({ error: 'Collection not permitted' }, { status: 403 })
      }

      const snap = await adminDb
        .collection(collection)
        .where('userId', '==', uid)
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get()
      const docs = snap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => ({ id: d.id, ...d.data() }))

      // Audit every collection access
      adminDb.collection('admin_audit_log').add({
        action: 'data_explorer_access',
        targetUid: uid,
        details: `Viewed ${collection} (${docs.length} docs)`,
        performedAt: new Date().toISOString(),
      }).catch(() => {})

      return NextResponse.json({ docs })
    }

    // Summary view — also audit
    const SUMMARY_COLLECTIONS = Array.from(ALLOWED_COLLECTIONS)
    const counts = await Promise.all(
      SUMMARY_COLLECTIONS.map(async name => {
        try {
          const snap = await adminDb
            .collection(name)
            .where('userId', '==', uid)
            .count()
            .get()
          return { name, count: snap.data().count }
        } catch {
          return { name, count: 0 }
        }
      })
    )

    const [efSnap, settingsSnap, profileSnap] = await Promise.all([
      adminDb.doc(`emergencyFunds/${uid}`).get(),
      adminDb.doc(`userSettings/${uid}`).get(),
      adminDb.doc(`userProfiles/${uid}`).get(),
    ])

    adminDb.collection('admin_audit_log').add({
      action: 'data_explorer_summary',
      targetUid: uid,
      details: 'Viewed user data summary',
      performedAt: new Date().toISOString(),
    }).catch(() => {})

    return NextResponse.json({
      uid,
      profile: profileSnap.exists ? profileSnap.data() : null,
      collections: counts,
      emergencyFund: efSnap.exists ? efSnap.data() : null,
      settings: settingsSnap.exists ? settingsSnap.data() : null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'Unauthorized' || msg === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
