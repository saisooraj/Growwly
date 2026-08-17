import { NextRequest, NextResponse } from 'next/server'
import { adminDb, verifyAdminToken } from '@/lib/firebaseAdmin'
import { rateLimit, getIp } from '@/lib/rateLimit'
import type { Announcement } from '@/types'

export async function GET(req: NextRequest) {
  const { limited } = rateLimit(`admin:announcements:${getIp(req)}`, 30, 60_000)
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  try {
    await verifyAdminToken(req.headers.get('Authorization'))
    const snap = await adminDb.collection('announcements').orderBy('createdAt', 'desc').get()
    const announcements = snap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => ({ id: d.id, ...d.data() }))
    return NextResponse.json({ announcements })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'Unauthorized' || msg === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(req: NextRequest) {
  const { limited } = rateLimit(`admin:announcements:post:${getIp(req)}`, 10, 60_000)
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  try {
    await verifyAdminToken(req.headers.get('Authorization'))
    const body = await req.json() as Partial<Announcement> & { id?: string }

    if (!body.type || !body.status) {
      return NextResponse.json({ error: 'type and status are required' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const data = {
      type: body.type,
      status: body.status,
      priority: body.priority ?? 0,
      platforms: body.platforms ?? [],
      audience: body.audience ?? 'all',
      oncePerPlatform: body.oncePerPlatform ?? false,
      startAt: body.startAt ?? null,
      endAt: body.endAt ?? null,
      triggerPoint: body.triggerPoint ?? 'app_load',
      featureKey: body.featureKey ?? null,
      targetUserId: body.targetUserId ?? null,
      steps: body.steps ?? null,
      title: body.title ?? null,
      body: body.body ?? null,
      iconKey: body.iconKey ?? null,
      ctaLabel: body.ctaLabel ?? null,
      ctaHref: body.ctaHref ?? null,
      updatedAt: now,
    }

    if (body.id) {
      await adminDb.doc(`announcements/${body.id}`).update(data)
      await adminDb.collection('admin_audit_log').add({
        action: 'announcement_updated',
        details: `${body.type}: ${body.title ?? body.steps?.[0]?.title ?? body.id}`,
        performedAt: now,
      })
      return NextResponse.json({ ok: true, id: body.id })
    } else {
      const ref = await adminDb.collection('announcements').add({ ...data, createdAt: now })
      await adminDb.collection('admin_audit_log').add({
        action: 'announcement_created',
        details: `${body.type}: ${body.title ?? body.steps?.[0]?.title ?? ref.id}`,
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
  const { limited } = rateLimit(`admin:announcements:del:${getIp(req)}`, 10, 60_000)
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  try {
    await verifyAdminToken(req.headers.get('Authorization'))
    const { id } = await req.json() as { id: string }
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const snap = await adminDb.doc(`announcements/${id}`).get()
    const label = snap.data()?.title ?? snap.data()?.steps?.[0]?.title ?? id

    await adminDb.doc(`announcements/${id}`).delete()
    await adminDb.collection('admin_audit_log').add({
      action: 'announcement_deleted',
      details: label,
      performedAt: new Date().toISOString(),
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'Unauthorized' || msg === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
