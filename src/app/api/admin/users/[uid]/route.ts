import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb, verifyAdminToken } from '@/lib/firebaseAdmin'

export async function GET(
  req: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    await verifyAdminToken(req.headers.get('Authorization'))
    const { uid } = params

    const [authUser, profileSnap, txCount, goalCount, borrowingCount, taskCount] =
      await Promise.all([
        adminAuth.getUser(uid),
        adminDb.doc(`userProfiles/${uid}`).get(),
        adminDb.collection('transactions').where('userId', '==', uid).count().get(),
        adminDb.collection('savingsGoals').where('userId', '==', uid).count().get(),
        adminDb.collection('borrowings').where('userId', '==', uid).count().get(),
        adminDb.collection('tasks').where('userId', '==', uid).count().get(),
      ])

    // Recent transactions (last 5)
    const recentSnap = await adminDb
      .collection('transactions')
      .where('userId', '==', uid)
      .orderBy('date', 'desc')
      .limit(5)
      .get()

    const recentTransactions = recentSnap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => ({ id: d.id, ...d.data() }))

    // Income/expense totals from current month
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const monthStr = monthStart.toISOString().slice(0, 10)

    const monthTxSnap = await adminDb
      .collection('transactions')
      .where('userId', '==', uid)
      .where('date', '>=', monthStr)
      .get()

    let monthIncome = 0, monthExpenses = 0
    for (const d of monthTxSnap.docs) {
      const t = d.data()
      if (t.type === 'income') monthIncome += t.amount
      else if (t.type === 'expense') monthExpenses += t.amount
    }

    return NextResponse.json({
      user: {
        uid: authUser.uid,
        email: authUser.email ?? null,
        displayName: authUser.displayName ?? null,
        photoURL: authUser.photoURL ?? null,
        disabled: authUser.disabled,
        createdAt: authUser.metadata.creationTime ?? null,
        lastSignIn: authUser.metadata.lastSignInTime ?? null,
        providers: authUser.providerData.map((p: import('firebase-admin/auth').UserInfo) => p.providerId),
      },
      profile: profileSnap.exists ? profileSnap.data() : null,
      stats: {
        transactions: txCount.data().count,
        goals: goalCount.data().count,
        borrowings: borrowingCount.data().count,
        tasks: taskCount.data().count,
        monthIncome,
        monthExpenses,
      },
      recentTransactions,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'Unauthorized' || msg === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
