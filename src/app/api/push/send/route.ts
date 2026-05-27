import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { db } from '@/lib/firebase'
import { collection, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

// Called by Vercel Cron every hour — Vercel sends Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const currentHour = new Date().getUTCHours()

  const subSnaps = await getDocs(collection(db, 'pushSubscriptions'))
  const results = { sent: 0, skipped: 0, errors: 0 }

  await Promise.all(
    subSnaps.docs.map(async (subDoc) => {
      const { userId, subscription } = subDoc.data()

      const settingsSnap = await getDoc(doc(db, 'userSettings', userId))
      if (!settingsSnap.exists()) { results.skipped++; return }
      const settings = settingsSnap.data()
      if (!settings.pushReminderEnabled) { results.skipped++; return }

      const targetHour = settings.pushReminderHour ?? 14 // default 2 PM UTC ≈ 7:30 PM IST
      if (targetHour !== currentHour) { results.skipped++; return }

      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: 'Growwly 🌱',
            body: "Don't forget to log today's transactions!",
            icon: '/icon.svg',
            url: '/transactions',
          })
        )
        results.sent++
      } catch (err: unknown) {
        if ((err as { statusCode?: number }).statusCode === 410) {
          await deleteDoc(subDoc.ref)
        }
        results.errors++
      }
    })
  )

  return NextResponse.json(results)
}
