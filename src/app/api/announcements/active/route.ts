import { NextRequest, NextResponse } from 'next/server'
import { adminDb, verifyUserToken } from '@/lib/firebaseAdmin'
import { rateLimit, getIp } from '@/lib/rateLimit'

// Any signed-in user can read active announcements — content is admin-authored
// marketing/education copy, not sensitive. Broad targeting (platform/audience/seen)
// is evaluated client-side against the user's own settings, but per-user targeted
// announcements (feedback replies) are filtered out here — never sent to anyone
// but the intended recipient.
export async function GET(req: NextRequest) {
  const { limited } = rateLimit(`announcements:active:${getIp(req)}`, 30, 60_000)
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  try {
    const uid = await verifyUserToken(req.headers.get('Authorization'))
    const snap = await adminDb.collection('announcements').where('status', '==', 'active').get()
    const announcements = (snap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => ({ id: d.id, ...d.data() })) as Array<{ id: string; targetUserId?: string }>)
      .filter(a => !a.targetUserId || a.targetUserId === uid)
    return NextResponse.json({ announcements })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
