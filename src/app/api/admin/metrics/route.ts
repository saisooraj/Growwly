import { NextRequest, NextResponse } from 'next/server'
import { adminDb, verifyAdminToken } from '@/lib/firebaseAdmin'
import { rateLimit, getIp } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  const { limited } = rateLimit(`admin:metrics:${getIp(req)}`, 20, 60_000)
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  try {
    await verifyAdminToken(req.headers.get('Authorization'))

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [
      txCount, goalCount, borrowingCount, profileCount,
      pushSubCount, taskCount, projectCount, chatStats,
      newUsersWeek, newUsersMonth, activeUsersWeek,
    ] = await Promise.all([
      adminDb.collection('transactions').count().get(),
      adminDb.collection('savingsGoals').count().get(),
      adminDb.collection('borrowings').count().get(),
      adminDb.collection('userProfiles').count().get(),
      adminDb.collection('pushSubscriptions').count().get(),
      adminDb.collection('tasks').count().get(),
      adminDb.collection('projects').count().get(),
      adminDb.doc('admin_system/stats').get(),
      adminDb.collection('userProfiles').where('createdAt', '>=', sevenDaysAgo).count().get(),
      adminDb.collection('userProfiles').where('createdAt', '>=', thirtyDaysAgo).count().get(),
      adminDb.collection('userProfiles').where('lastActiveAt', '>=', sevenDaysAgo).count().get(),
    ])

    // New users by day (last 30 days) for chart
    const profilesSnap = await adminDb
      .collection('userProfiles')
      .where('createdAt', '>=', thirtyDaysAgo)
      .get()

    const dayMap: Record<string, number> = {}
    for (const d of profilesSnap.docs) {
      const day = (d.data().createdAt as string)?.slice(0, 10)
      if (day) dayMap[day] = (dayMap[day] ?? 0) + 1
    }

    // Fill all 30 days
    const newUsersByDay: { date: string; count: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10)
      newUsersByDay.push({ date: key, count: dayMap[key] ?? 0 })
    }

    const chatData = chatStats.exists ? chatStats.data() : {}

    return NextResponse.json({
      totals: {
        users: profileCount.data().count,
        transactions: txCount.data().count,
        goals: goalCount.data().count,
        borrowings: borrowingCount.data().count,
        tasks: taskCount.data().count,
        projects: projectCount.data().count,
        pushSubscriptions: pushSubCount.data().count,
        chatRequests: chatData?.totalChatRequests ?? 0,
      },
      activity: {
        newUsersThisWeek: newUsersWeek.data().count,
        newUsersThisMonth: newUsersMonth.data().count,
        activeUsersThisWeek: activeUsersWeek.data().count,
      },
      newUsersByDay,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'Unauthorized' || msg === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
