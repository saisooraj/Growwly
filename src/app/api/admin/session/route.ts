import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb, ADMIN_EMAIL } from '@/lib/firebaseAdmin'
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/adminSession'
import { rateLimit, getIp } from '@/lib/rateLimit'

function cookieHeader(value: string, maxAge: number): string {
  return [
    `${SESSION_COOKIE}=${value}`,
    `Max-Age=${maxAge}`,
    'Path=/admin',
    'HttpOnly',
    'SameSite=Strict',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
  ].filter(Boolean).join('; ')
}

// POST /api/admin/session — verify Firebase token + PIN, issue session cookie
export async function POST(req: NextRequest) {
  // Strict rate limit: 5 attempts per IP per 15 minutes (brute-force PIN protection)
  const { limited } = rateLimit(`admin:session:${getIp(req)}`, 5, 15 * 60_000)
  if (limited) {
    return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 })
  }

  try {
    const { idToken, pin } = await req.json() as { idToken: string; pin: string }

    if (!idToken || !pin) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    }

    // 1. Verify Firebase ID token
    let decoded: { email?: string; uid: string }
    try {
      decoded = await adminAuth.verifyIdToken(idToken)
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // 2. Email must match admin
    if (decoded.email !== ADMIN_EMAIL) {
      // Audit the failed attempt
      await adminDb.collection('admin_audit_log').add({
        action: 'admin_login_rejected',
        details: `Email mismatch: ${decoded.email ?? 'unknown'}`,
        performedAt: new Date().toISOString(),
      }).catch(() => {})
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 3. Verify PIN (constant-time comparison to prevent timing attacks)
    const expectedPin = process.env.ADMIN_PIN ?? ''
    if (pin.length !== expectedPin.length) {
      await logFailedLogin(decoded.email, 'Wrong PIN length')
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 403 })
    }
    let mismatch = 0
    for (let i = 0; i < expectedPin.length; i++) {
      // eslint-disable-next-line no-bitwise
      mismatch |= pin.charCodeAt(i) ^ expectedPin.charCodeAt(i)
    }
    if (mismatch !== 0) {
      await logFailedLogin(decoded.email, 'Wrong PIN')
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 403 })
    }

    // 4. Issue signed session cookie
    const sessionToken = await signSession(decoded.email)

    await adminDb.collection('admin_audit_log').add({
      action: 'admin_login',
      details: 'Successful login',
      performedAt: new Date().toISOString(),
    }).catch(() => {})

    const res = NextResponse.json({ ok: true })
    res.headers.set('Set-Cookie', cookieHeader(sessionToken, SESSION_MAX_AGE))
    return res
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE /api/admin/session — revoke session cookie
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.headers.set('Set-Cookie', cookieHeader('', 0))
  return res
}

async function logFailedLogin(email: string, reason: string) {
  await adminDb.collection('admin_audit_log').add({
    action: 'admin_login_failed',
    details: `${reason} (${email})`,
    performedAt: new Date().toISOString(),
  }).catch(() => {})
}
