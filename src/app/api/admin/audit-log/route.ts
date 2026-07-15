import { NextRequest, NextResponse } from 'next/server'
import { adminDb, verifyAdminToken } from '@/lib/firebaseAdmin'
import { rateLimit, getIp } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  const { limited } = rateLimit(`admin:audit:${getIp(req)}`, 20, 60_000)
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  try {
    await verifyAdminToken(req.headers.get('Authorization'))

    const url = new URL(req.url)
    const limitParam = parseInt(url.searchParams.get('limit') ?? '100', 10)
    const limit = Math.min(Math.max(limitParam, 1), 500)

    const snap = await adminDb
      .collection('admin_audit_log')
      .orderBy('performedAt', 'desc')
      .limit(limit)
      .get()

    const entries = snap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => ({ id: d.id, ...d.data() }))
    return NextResponse.json({ entries })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'Unauthorized' || msg === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(req: NextRequest) {
  const { limited } = rateLimit(`admin:audit:post:${getIp(req)}`, 20, 60_000)
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  try {
    await verifyAdminToken(req.headers.get('Authorization'))
    const body = await req.json() as {
      action: string
      targetUid?: string
      details?: string
    }

    const ref = await adminDb.collection('admin_audit_log').add({
      action: body.action,
      targetUid: body.targetUid ?? null,
      details: body.details ?? null,
      performedAt: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true, id: ref.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'Unauthorized' || msg === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
