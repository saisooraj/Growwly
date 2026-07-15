// Works in both Node.js (API routes) and Edge Runtime (middleware).
// Uses Web Crypto API — no external dependencies.

export const SESSION_COOKIE = '__admin_sess'
export const SESSION_MAX_AGE = 8 * 60 * 60 // 8 hours in seconds

const enc = new TextEncoder()

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

function toBase64url(buf: ArrayBuffer): string {
  const bytes = Array.from(new Uint8Array(buf))
  return btoa(bytes.map(b => String.fromCharCode(b)).join(''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function fromBase64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

interface SessionPayload {
  email: string
  iat: number
  exp: number
}

export async function signSession(email: string): Promise<string> {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) throw new Error('ADMIN_SESSION_SECRET not set')

  const now = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = { email, iat: now, exp: now + SESSION_MAX_AGE }
  const payloadB64 = toBase64url(enc.encode(JSON.stringify(payload)).buffer as ArrayBuffer)

  const key = await getKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64))
  return `${payloadB64}.${toBase64url(sig)}`
}

export async function verifySession(cookie: string): Promise<SessionPayload | null> {
  try {
    const secret = process.env.ADMIN_SESSION_SECRET
    if (!secret) return null

    const dot = cookie.lastIndexOf('.')
    if (dot === -1) return null

    const payloadB64 = cookie.slice(0, dot)
    const sigB64 = cookie.slice(dot + 1)

    const key = await getKey(secret)
    const sigBytes = fromBase64url(sigB64)
    const valid = await crypto.subtle.verify(
      'HMAC', key,
      sigBytes.buffer as ArrayBuffer,
      enc.encode(payloadB64)
    )
    if (!valid) return null

    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64url(payloadB64))
    ) as SessionPayload

    if (payload.exp < Math.floor(Date.now() / 1000)) return null

    return payload
  } catch {
    return null
  }
}

export function sessionCookieOptions(maxAge: number = SESSION_MAX_AGE) {
  return [
    `${SESSION_COOKIE}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
  ].filter(Boolean).join('; ')
}
