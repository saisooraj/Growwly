import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb, verifyAdminToken } from '@/lib/firebaseAdmin'
import { rateLimit, getIp } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  const { limited } = rateLimit(`admin:users:${getIp(req)}`, 30, 60_000)
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  try {
    await verifyAdminToken(req.headers.get('Authorization'))

    const listResult = await adminAuth.listUsers(1000)
    const profileSnaps = await adminDb.collection('userProfiles').get()
    const profiles = Object.fromEntries(
      profileSnaps.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => [d.id, d.data()])
    )

    const users = listResult.users.map((u: import('firebase-admin/auth').UserRecord) => ({
      uid: u.uid,
      email: u.email ?? null,
      displayName: u.displayName ?? null,
      photoURL: u.photoURL ?? null,
      disabled: u.disabled,
      createdAt: u.metadata.creationTime ?? null,
      lastSignIn: u.metadata.lastSignInTime ?? null,
      providers: u.providerData.map((p: import('firebase-admin/auth').UserInfo) => p.providerId),
      profile: profiles[u.uid] ?? null,
    }))

    return NextResponse.json({ users })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'Unauthorized' || msg === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(req: NextRequest) {
  const { limited } = rateLimit(`admin:users:post:${getIp(req)}`, 10, 60_000)
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  try {
    await verifyAdminToken(req.headers.get('Authorization'))
    const { uid, action } = await req.json() as { uid: string; action: 'disable' | 'enable' }

    if (!uid || !['disable', 'enable'].includes(action)) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    await adminAuth.updateUser(uid, { disabled: action === 'disable' })

    // Audit log
    await adminDb.collection('admin_audit_log').add({
      action: `user_${action}d`,
      targetUid: uid,
      performedAt: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'Unauthorized' || msg === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
