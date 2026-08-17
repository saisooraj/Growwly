import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb, verifyUserToken } from '@/lib/firebaseAdmin'
import { rateLimit, getIp } from '@/lib/rateLimit'
import type { FeedbackType } from '@/types'

const VALID_TYPES: FeedbackType[] = ['bug', 'feature_request', 'other']

export async function POST(req: NextRequest) {
  const { limited } = rateLimit(`feedback:post:${getIp(req)}`, 10, 60_000)
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  try {
    const uid = await verifyUserToken(req.headers.get('Authorization'))
    const body = await req.json() as { type?: FeedbackType; message?: string; context?: string }

    const type = VALID_TYPES.includes(body.type as FeedbackType) ? body.type! : 'other'
    const message = (body.message ?? '').trim()
    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    if (message.length > 4000) return NextResponse.json({ error: 'Message is too long' }, { status: 400 })

    const authUser = await adminAuth.getUser(uid)
    const now = new Date().toISOString()

    const ref = await adminDb.collection('feedback').add({
      userId: uid,
      userEmail: authUser.email ?? null,
      userName: authUser.displayName ?? null,
      type,
      message,
      context: body.context ?? null,
      status: 'new',
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({ ok: true, id: ref.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
