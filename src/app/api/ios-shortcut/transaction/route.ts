import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { rateLimit } from '@/lib/rateLimit'
import { resolveToken, touchToken } from '@/lib/iosToken'

export const dynamic = 'force-dynamic'

const MAX_AMOUNT = 10_000_000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Today's date in IST as YYYY-MM-DD (matches how the app buckets months). */
function istToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const token =
    req.headers.get('x-growwly-token') ||
    (typeof body.token === 'string' ? body.token : null)

  const resolved = await resolveToken(token)
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid or revoked token' }, { status: 401 })
  }

  const rl = rateLimit(`ios-tx:${resolved.tokenHash}`, 60, 60 * 1000)
  if (rl.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  const amount = Math.round(Number(body.amount) * 100) / 100
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }

  const description = String(body.description ?? '').trim().slice(0, 200) || 'Quick add'
  const category = String(body.category ?? '').trim().slice(0, 60) || 'Other'
  const type = body.type === 'income' ? 'income' : 'expense'
  const date =
    typeof body.date === 'string' && DATE_RE.test(body.date) ? body.date : istToday()

  try {
    const ref = await adminDb.collection('transactions').add({
      userId: resolved.userId,
      type,
      amount,
      category,
      date,
      notes: description,
      createdAt: new Date().toISOString(),
      source: 'ios-shortcut',
    })
    touchToken(resolved.tokenHash)

    return NextResponse.json({
      ok: true,
      id: ref.id,
      type,
      amount,
      category,
      date,
      description,
    })
  } catch (err) {
    console.error('ios-shortcut/transaction error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
