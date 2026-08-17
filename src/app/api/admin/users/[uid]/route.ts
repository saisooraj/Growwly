import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb, verifyAdminToken } from '@/lib/firebaseAdmin'

export async function GET(
  req: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    await verifyAdminToken(req.headers.get('Authorization'))
    const { uid } = params

    // Counts only — this admin panel is for understanding app load and usage,
    // not a user's actual financial data. Never fetch transaction content
    // (amounts, categories, notes) here.
    const [authUser, profileSnap, txCount, goalCount, borrowingCount, taskCount] =
      await Promise.all([
        adminAuth.getUser(uid),
        adminDb.doc(`userProfiles/${uid}`).get(),
        adminDb.collection('transactions').where('userId', '==', uid).count().get(),
        adminDb.collection('savingsGoals').where('userId', '==', uid).count().get(),
        adminDb.collection('borrowings').where('userId', '==', uid).count().get(),
        adminDb.collection('tasks').where('userId', '==', uid).count().get(),
      ])

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
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'Unauthorized' || msg === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
