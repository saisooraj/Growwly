import { NextRequest, NextResponse } from 'next/server'
import { adminDb, verifyAdminToken } from '@/lib/firebaseAdmin'
import { rateLimit, getIp } from '@/lib/rateLimit'

interface Counts { impression: number; click: number; complete: number; dismiss: number }

// Aggregate impression/click/dismiss/complete counts per announcement, from the
// announcement_events log. Counts only — no per-user identity is returned here.
export async function GET(req: NextRequest) {
  const { limited } = rateLimit(`admin:announcements:analytics:${getIp(req)}`, 30, 60_000)
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  try {
    await verifyAdminToken(req.headers.get('Authorization'))

    const snap = await adminDb
      .collection('announcement_events')
      .orderBy('at', 'desc')
      .limit(5000)
      .get()

    const byAnnouncement: Record<string, Counts> = {}
    for (const doc of snap.docs) {
      const { announcementId, type } = doc.data() as { announcementId: string; type: keyof Counts }
      if (!announcementId || !type) continue
      const counts = byAnnouncement[announcementId] ??= { impression: 0, click: 0, complete: 0, dismiss: 0 }
      if (type in counts) counts[type]++
    }

    return NextResponse.json({ analytics: byAnnouncement })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'Unauthorized' || msg === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
