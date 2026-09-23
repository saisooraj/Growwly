import { NextRequest, NextResponse } from 'next/server'
import { adminDb, verifyUserToken } from '@/lib/firebaseAdmin'
import { rateLimit } from '@/lib/rateLimit'
import {
  TOKEN_COLLECTION,
  generateToken,
  hashToken,
} from '@/lib/iosToken'
import type { UserSettings } from '@/types'

export const dynamic = 'force-dynamic'

// ── Create / rotate the iPhone quick-add token ───────────────────────────────
// Auth: Firebase ID token (Bearer). Returns the plaintext token ONCE.
export async function POST(req: NextRequest) {
  let uid: string
  try {
    uid = await verifyUserToken(req.headers.get('authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = rateLimit(`ios-token:${uid}`, 10, 60 * 60 * 1000)
  if (rl.limited) {
    return NextResponse.json({ error: 'Too many attempts, try again later' }, { status: 429 })
  }

  try {
    const settingsRef = adminDb.collection('userSettings').doc(uid)
    const existing = (await settingsRef.get()).data() as UserSettings | undefined
    const prevHash = existing?.iosShortcut?.tokenHash

    const token = generateToken()
    const tokenHash = hashToken(token)
    const createdAt = new Date().toISOString()

    const batch = adminDb.batch()
    if (prevHash && prevHash !== tokenHash) {
      batch.delete(adminDb.collection(TOKEN_COLLECTION).doc(prevHash))
    }
    batch.set(adminDb.collection(TOKEN_COLLECTION).doc(tokenHash), {
      userId: uid,
      createdAt,
      label: 'iOS Shortcut',
    })
    batch.set(
      settingsRef,
      { iosShortcut: { tokenHash, createdAt } },
      { merge: true },
    )
    await batch.commit()

    return NextResponse.json({ token, createdAt })
  } catch (err) {
    console.error('ios-shortcut/token POST error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ── Revoke the token ────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  let uid: string
  try {
    uid = await verifyUserToken(req.headers.get('authorization'))
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const settingsRef = adminDb.collection('userSettings').doc(uid)
    const existing = (await settingsRef.get()).data() as UserSettings | undefined
    const prevHash = existing?.iosShortcut?.tokenHash

    const batch = adminDb.batch()
    if (prevHash) batch.delete(adminDb.collection(TOKEN_COLLECTION).doc(prevHash))
    batch.set(settingsRef, { iosShortcut: null }, { merge: true })
    await batch.commit()

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('ios-shortcut/token DELETE error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
