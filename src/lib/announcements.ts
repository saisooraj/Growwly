import { db } from './firebase'
import { collection, addDoc } from 'firebase/firestore'
import {
  LayoutDashboard, ArrowLeftRight, CalendarClock, Target, Sparkles, Megaphone,
  type LucideIcon,
} from 'lucide-react'
import type { Announcement } from '@/types'

export type AnnouncementPlatform = 'mobile' | 'desktop'
export type AnnouncementEventType = 'impression' | 'click' | 'dismiss' | 'complete'

export function getPlatform(): AnnouncementPlatform {
  if (typeof window === 'undefined') return 'desktop'
  return window.matchMedia('(min-width: 1024px)').matches ? 'desktop' : 'mobile'
}

// Non-critical analytics — never blocks or throws into the caller.
export async function trackAnnouncementEvent(params: {
  announcementId: string
  type: AnnouncementEventType
  userId: string
  platform: AnnouncementPlatform
}): Promise<void> {
  if (!db) return
  try {
    await addDoc(collection(db, 'announcement_events'), {
      ...params,
      at: new Date().toISOString(),
    })
  } catch {
    // Non-critical — never block the UI for analytics
  }
}

// Icon keys admins can pick in the announcement editor, resolved to a component here.
export const ANNOUNCEMENT_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  transactions: ArrowLeftRight,
  calendar: CalendarClock,
  target: Target,
  sparkles: Sparkles,
  megaphone: Megaphone,
}

export function resolveIcon(iconKey?: string): LucideIcon {
  return (iconKey && ANNOUNCEMENT_ICONS[iconKey]) || Sparkles
}

// Fetch admin-authored active announcements. Requires a signed-in user's ID token.
export async function fetchActiveAnnouncements(idToken: string): Promise<Announcement[]> {
  const res = await fetch('/api/announcements/active', {
    headers: { Authorization: `Bearer ${idToken}` },
  })
  if (!res.ok) throw new Error(`Failed to fetch announcements (${res.status})`)
  const data = await res.json() as { announcements: Announcement[] }
  return data.announcements
}

// Single source of truth for "is this announcement due for this user right now" —
// used both for the once-per-session app_load queue and for contextual triggers
// (e.g. right after logging a salary transaction) so the two never drift apart.
export function isAnnouncementDue(
  a: Announcement,
  ctx: { platform: AnnouncementPlatform; isNewUser: boolean; seenAnnouncements: string[]; userId: string }
): boolean {
  if (a.targetUserId) {
    if (a.targetUserId !== ctx.userId) return false
  } else if (a.audience === 'new_users' && !ctx.isNewUser) {
    return false
  }
  if (a.platforms.length > 0 && !a.platforms.includes(ctx.platform)) return false
  if (a.startAt && new Date(a.startAt).getTime() > Date.now()) return false
  if (a.endAt && new Date(a.endAt).getTime() < Date.now()) return false
  const seenKey = a.oncePerPlatform ? `${a.id}:${ctx.platform}` : a.id
  return !ctx.seenAnnouncements.includes(seenKey)
}

// Shown when no admin-authored onboarding_tour exists yet (e.g. right after this
// feature ships, before anyone's created one in /admin/announcements) — keeps the
// get-started experience working with zero admin setup required.
export const FALLBACK_TOUR: Announcement = {
  id: 'fallback-get-started-tour',
  type: 'onboarding_tour',
  status: 'active',
  priority: 0,
  platforms: [],
  audience: 'all',
  oncePerPlatform: true,
  steps: [
    {
      iconKey: 'dashboard',
      title: 'Welcome to Growwly',
      body: 'Your Overview dashboard tracks a health score, safe-to-spend balance, and cashflow at a glance — it updates the moment you log something.',
    },
    {
      iconKey: 'transactions',
      title: 'Log income, expenses & transfers',
      body: 'Add transactions from anywhere with the + button. Mark one recurring and it repeats automatically — no need to re-enter it every month.',
    },
    {
      iconKey: 'calendar',
      title: 'Plan around your salary cycle',
      body: 'Set a salary cycle in Settings so your budgets and "days left" math line up with when you actually get paid, not the calendar month.',
    },
    {
      iconKey: 'target',
      title: 'Savings, Net Worth & Projects',
      body: 'Set savings goals, track assets and liabilities in Net Worth, and keep multi-payment Projects and Borrowings organized in their own tabs.',
    },
    {
      iconKey: 'sparkles',
      title: 'Ask the AI Assistant',
      body: 'Stuck on a number or want a quick summary of your spending? The AI Assistant tab can answer questions about your own data.',
    },
  ],
  createdAt: '',
  updatedAt: '',
}

// Shown right after a Salary transaction is logged, if the user has never set a
// salary cycle. Same zero-setup fallback pattern as FALLBACK_TOUR — replace by
// creating a real "feature_spotlight" announcement with this trigger in the admin.
export const FALLBACK_SALARY_CYCLE_TIP: Announcement = {
  id: 'fallback-salary-cycle-tip',
  type: 'feature_spotlight',
  status: 'active',
  priority: 0,
  platforms: [],
  audience: 'all',
  oncePerPlatform: false,
  triggerPoint: 'salary_logged',
  featureKey: 'salary_cycle',
  iconKey: 'calendar',
  title: 'Did you know about salary cycles?',
  body: "You just logged a salary — you can set a salary cycle in Settings so your budgets and \"days left\" math line up with when you actually get paid, instead of the calendar month.",
  ctaLabel: 'Set it up in Settings',
  ctaHref: '/settings',
  createdAt: '',
  updatedAt: '',
}
