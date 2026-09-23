// Shared helpers for the iPhone "quick add" shortcut.
//
// The shortcut authenticates with a long-lived personal token (Firebase Auth
// can't run inside an iOS Shortcut). We only ever store the SHA-256 hash of the
// token — as the document id in `iosTokens` — so a leaked Firestore export can't
// be used to post transactions. Lookups are therefore an O(1) doc.get(), no
// index required.

import crypto from 'crypto'
import { adminDb } from './firebaseAdmin'

export const TOKEN_COLLECTION = 'iosTokens'
export const TOKEN_PREFIX = 'gwq_'

export interface IosTokenDoc {
  userId: string
  createdAt: string
  lastUsedAt?: string
  label: string
}

/** Generates a fresh opaque token, e.g. `gwq_<43 base64url chars>`. */
export function generateToken(): string {
  return TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex')
}

/**
 * Resolves a plaintext token to its owner, or null if unknown.
 * Bumps `lastUsedAt` as a fire-and-forget side effect.
 */
export async function resolveToken(
  token: string | null | undefined,
): Promise<{ userId: string; tokenHash: string } | null> {
  if (!token || !token.startsWith(TOKEN_PREFIX)) return null
  const tokenHash = hashToken(token)
  const snap = await adminDb.collection(TOKEN_COLLECTION).doc(tokenHash).get()
  if (!snap.exists) return null
  const data = snap.data() as IosTokenDoc
  return { userId: data.userId, tokenHash }
}

export function touchToken(tokenHash: string): void {
  adminDb
    .collection(TOKEN_COLLECTION)
    .doc(tokenHash)
    .set({ lastUsedAt: new Date().toISOString() }, { merge: true })
    .catch(() => {})
}
