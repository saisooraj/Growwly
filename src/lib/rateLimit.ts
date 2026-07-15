// In-memory rate limiter for Node.js API routes.
// Sufficient for single-instance or low-traffic deployments.
// For Vercel multi-instance, replace with Vercel KV.

interface Entry { count: number; resetAt: number }

const store = new Map<string, Entry>()

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  store.forEach((entry, key) => {
    if (entry.resetAt < now) store.delete(key)
  })
}, 5 * 60 * 1000)

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { limited: boolean; remaining: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { limited: false, remaining: limit - 1 }
  }

  entry.count++
  const remaining = Math.max(0, limit - entry.count)
  return { limited: entry.count > limit, remaining }
}

export function getIp(req: Request): string {
  const forwarded = (req.headers as Headers).get('x-forwarded-for')
  return forwarded?.split(',')[0].trim() ?? 'unknown'
}
