import { NextRequest, NextResponse } from 'next/server'
import { adminDb, verifyAdminToken, FieldValue } from '@/lib/firebaseAdmin'
import { rateLimit, getIp } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  const { limited } = rateLimit(`admin:flags:${getIp(req)}`, 30, 60_000)
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  try {
    await verifyAdminToken(req.headers.get('Authorization'))
    const snap = await adminDb.collection('admin_feature_flags').orderBy('createdAt', 'desc').get()
    const flags = snap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => ({ id: d.id, ...d.data() }))
    return NextResponse.json({ flags })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'Unauthorized' || msg === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(req: NextRequest) {
  const { limited } = rateLimit(`admin:flags:post:${getIp(req)}`, 10, 60_000)
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  try {
    await verifyAdminToken(req.headers.get('Authorization'))
    const body = await req.json() as {
      id?: string
      key: string
      name: string
      description?: string
      enabled: boolean
    }

    const now = new Date().toISOString()

    if (body.id) {
      // Update existing
      await adminDb.doc(`admin_feature_flags/${body.id}`).update({
        key: body.key,
        name: body.name,
        description: body.description ?? '',
        enabled: body.enabled,
        updatedAt: now,
      })
      // Audit
      await adminDb.collection('admin_audit_log').add({
        action: 'feature_flag_updated',
        details: `${body.key} → ${body.enabled ? 'enabled' : 'disabled'}`,
        performedAt: now,
      })
      return NextResponse.json({ ok: true, id: body.id })
    } else {
      // Create new
      const ref = await adminDb.collection('admin_feature_flags').add({
        key: body.key,
        name: body.name,
        description: body.description ?? '',
        enabled: body.enabled,
        createdAt: now,
        updatedAt: now,
      })
      await adminDb.collection('admin_audit_log').add({
        action: 'feature_flag_created',
        details: body.key,
        performedAt: now,
      })
      return NextResponse.json({ ok: true, id: ref.id })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'Unauthorized' || msg === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(req: NextRequest) {
  const { limited } = rateLimit(`admin:flags:del:${getIp(req)}`, 10, 60_000)
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  try {
    await verifyAdminToken(req.headers.get('Authorization'))
    const { id } = await req.json() as { id: string }
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const snap = await adminDb.doc(`admin_feature_flags/${id}`).get()
    const key = snap.data()?.key ?? id

    await adminDb.doc(`admin_feature_flags/${id}`).delete()
    await adminDb.collection('admin_audit_log').add({
      action: 'feature_flag_deleted',
      details: key,
      performedAt: new Date().toISOString(),
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'Unauthorized' || msg === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
