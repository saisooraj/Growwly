import { NextRequest, NextResponse } from 'next/server'
import { adminDb, verifyAdminToken } from '@/lib/firebaseAdmin'
import { rateLimit, getIp } from '@/lib/rateLimit'
import type { FeedbackStatus } from '@/types'

export async function GET(req: NextRequest) {
  const { limited } = rateLimit(`admin:feedback:${getIp(req)}`, 30, 60_000)
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  try {
    await verifyAdminToken(req.headers.get('Authorization'))
    const snap = await adminDb.collection('feedback').orderBy('createdAt', 'desc').get()
    const feedback = snap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => ({ id: d.id, ...d.data() }))
    return NextResponse.json({ feedback })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'Unauthorized' || msg === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

// Update status and/or admin note on an existing feedback item.
export async function POST(req: NextRequest) {
  const { limited } = rateLimit(`admin:feedback:post:${getIp(req)}`, 20, 60_000)
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  try {
    await verifyAdminToken(req.headers.get('Authorization'))
    const body = await req.json() as { id: string; status?: FeedbackStatus; adminNote?: string }
    if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const now = new Date().toISOString()
    const update: Record<string, unknown> = { updatedAt: now }
    if (body.status) update.status = body.status
    if (body.adminNote !== undefined) update.adminNote = body.adminNote

    await adminDb.doc(`feedback/${body.id}`).update(update)

    if (body.status) {
      await adminDb.collection('admin_audit_log').add({
        action: 'feedback_status_updated',
        details: `${body.id} → ${body.status}`,
        performedAt: now,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'Unauthorized' || msg === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
