'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileNav from './MobileNav'
import FloatingActions from './FloatingActions'
import AuthGuard from '@/components/ui/AuthGuard'
import AddTransactionModal from '@/components/transactions/AddTransactionModal'
import BillScannerModal from '@/components/transactions/BillScannerModal'
import BadgeCelebrationModal from '@/components/ui/BadgeCelebrationModal'
import { useAppStore } from '@/store/appStore'
import { useRefreshData } from '@/hooks/useData'
import { computeLongestMoneyStreak } from '@/lib/utils'
import { BADGES, getBadgeEarnedDate, SEEN_BADGES_KEY, type BadgeDef } from '@/lib/badges'
import { Leaf, AlertTriangle, X } from 'lucide-react'
import { parseISO, differenceInCalendarDays } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { getUnreadAuthAlerts, markAllAlertsRead, type AuthAlertRecord } from '@/lib/authErrorLogger'
import { setUserSettings } from '@/lib/firestore'

interface Props {
  title?: string
  children: React.ReactNode
  fillPage?: boolean
}

// ── Admin auth alert banner ───────────────────────────────────────────────────
// Shown at the top of the app when the admin has unread sign-in failure alerts.
function AdminAuthAlertBanner() {
  const { user } = useAuth()
  const [alerts, setAlerts] = useState<AuthAlertRecord[]>([])
  const [dismissed, setDismissed] = useState(false)

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL

  useEffect(() => {
    if (!adminEmail || user?.email !== adminEmail) return
    getUnreadAuthAlerts().then(setAlerts).catch(() => {})
  }, [user?.email, adminEmail])

  if (!adminEmail || user?.email !== adminEmail || dismissed || alerts.length === 0) return null

  async function handleDismiss() {
    await markAllAlertsRead()
    setDismissed(true)
  }

  return (
    <div style={{
      background: 'rgba(239,68,68,0.07)',
      borderBottom: '1px solid rgba(239,68,68,0.18)',
      padding: '9px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 13,
      flexShrink: 0,
    }}>
      <AlertTriangle size={14} style={{ color: '#f87171', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: '#f87171', fontWeight: 700 }}>{alerts.length}</span>
        <span style={{ color: 'var(--text-2)' }}>
          {' '}sign-in failure{alerts.length === 1 ? '' : 's'} since last check —{' '}
        </span>
        <span style={{ color: 'var(--text-4)', fontSize: 11 }}>
          {alerts.slice(0, 2).map(a => a.flow.split(':')[0]).join(', ')}
          {alerts.length > 2 ? ` +${alerts.length - 2} more` : ''}
        </span>
      </div>
      <a
        href="/admin/auth-alerts"
        style={{
          color: '#f87171', fontWeight: 600, fontSize: 12,
          textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        View in Admin →
      </a>
      <button
        onClick={handleDismiss}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-4)', padding: 4, display: 'flex',
          alignItems: 'center', flexShrink: 0,
        }}
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}

const ACCENT_ATTRS: Record<string, string> = {
  green: 'green', purple: 'purple', orange: 'orange', pink: 'pink', blue: 'blue', black: 'black',
}

// Approximate hex values for each accent (used for favicon SVG + theme-color meta)
const BRAND_HEX: Record<string, { brand: string; deep: string }> = {
  green:  { brand: '#22c55e', deep: '#16a34a' },
  purple: { brand: '#9333ea', deep: '#7c3aed' },
  orange: { brand: '#f97316', deep: '#ea580c' },
  pink:   { brand: '#ec4899', deep: '#db2777' },
  blue:   { brand: '#0073e5', deep: '#005ab8' },
  black:  { brand: '#111111', deep: '#000000' },
}

function makeFaviconSvg(brand: string, deep: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${brand}"/>
        <stop offset="100%" stop-color="${deep}"/>
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="7" fill="url(#g)"/>
    <g transform="translate(6 6) scale(0.833)" fill="none" stroke="white" stroke-opacity="0.95" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
    </g>
  </svg>`
}

const PULL_THRESHOLD = 58
const PULL_MAX = 96

// ── Pull-to-refresh indicator (matches g-app.jsx Loader) ─────────────────────
function PullIndicator({ pull, busy }: { pull: number; busy: boolean }) {
  const p = Math.min(1, pull / PULL_THRESHOLD)
  const y = Math.max(8, pull - 26)
  if (pull === 0 && !busy) return null
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 0,
      display: 'flex', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 6,
    }}>
      <div style={{
        transform: `translateY(${y}px) scale(${0.6 + p * 0.4})`,
        opacity: p,
        width: 38, height: 38, borderRadius: '50%',
        background: 'var(--surface)', boxShadow: 'var(--elev)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {busy ? (
          // Spinner ring
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            border: '2.5px solid var(--brand)',
            borderTopColor: 'transparent',
            animation: 'gw-spin .7s linear infinite',
          }} />
        ) : (
          // Leaf that rotates with pull distance (from design)
          <Leaf
            size={18}
            style={{
              color: 'var(--brand)',
              transform: `rotate(${pull * 4}deg)`,
            }}
          />
        )}
      </div>
    </div>
  )
}

export default function AppShell({ title, children, fillPage }: Props) {
  const settings     = useAppStore(s => s.settings)
  const initialized  = useAppStore(s => s.initialized)
  const transactions = useAppStore(s => s.transactions)
  const upcomingExpenses  = useAppStore(s => s.upcomingExpenses)
  const upcomingPayments  = useAppStore(s => s.upcomingPayments)
  const refresh = useRefreshData()

  // ── Badge celebration queue ─────────────────────────────────────────────────
  const [badgeQueue, setBadgeQueue] = useState<BadgeDef[]>([])
  const badgesChecked = useRef(false)
  const { user } = useAuth()
  const setSettings = useAppStore(s => s.setSettings)

  useEffect(() => {
    if (!initialized || badgesChecked.current || !settings) return
    badgesChecked.current = true

    const streak = computeLongestMoneyStreak(transactions, settings.noSpendDays ?? [])

    // Firestore is the source of truth; fall back to localStorage for migration
    let seenThresholds: number[] = settings.seenBadges ?? []
    if (seenThresholds.length === 0) {
      const local = localStorage.getItem(SEEN_BADGES_KEY)
      if (local) {
        try { seenThresholds = JSON.parse(local) } catch { /* ignore */ }
      }
    }

    const seen = new Set<number>(seenThresholds)
    const newBadges = BADGES
      .filter(b => streak >= b.threshold && !seen.has(b.threshold))
      .sort((a, b) => b.threshold - a.threshold)
    if (newBadges.length > 0) setBadgeQueue(newBadges)
  }, [initialized, settings]) // eslint-disable-line react-hooks/exhaustive-deps

  function dismissBadge() {
    const current = badgeQueue[0]
    if (!current || !user || !settings) return

    const seen = new Set<number>(settings.seenBadges ?? [])
    seen.add(current.threshold)
    const seenBadges = Array.from(seen)

    // Optimistically update the store so re-renders don't re-show the badge
    setSettings({ ...settings, seenBadges })

    // Persist to Firestore so all devices see the updated seen list
    setUserSettings(user.uid, { seenBadges }).catch(() => {
      // Revert store on failure so the badge can be retried
      setSettings(settings)
    })

    // Clear the legacy localStorage entry after first successful Firestore write
    localStorage.removeItem(SEEN_BADGES_KEY)

    setBadgeQueue(prev => prev.slice(1))
  }

  const activeBadge = badgeQueue[0] ?? null
  const txDates = transactions.map(t => t.date)
  const noSpendDays = settings?.noSpendDays ?? []
  const activeBadgeEarnedDate = activeBadge
    ? getBadgeEarnedDate(txDates, noSpendDays, activeBadge.threshold)
    : null

  // ── Bill reminder (runs once per day after data loads) ──────────────────────
  useEffect(() => {
    if (!initialized) return
    const today = new Date().toISOString().slice(0, 10)
    const lastShown = localStorage.getItem('gw-bill-reminder-date')
    if (lastShown === today) return

    const paidMap = new Map<string, number>()
    for (const p of upcomingPayments) {
      paidMap.set(p.upcomingId, (paidMap.get(p.upcomingId) ?? 0) + p.amount)
    }

    const due = upcomingExpenses.filter(u => {
      if ((u.flowType ?? 'expense') !== 'expense') return false
      const remaining = u.amount - (paidMap.get(u.id) ?? 0)
      if (remaining <= 0) return false
      const days = differenceInCalendarDays(parseISO(u.dueDate), new Date())
      return days >= 0 && days <= 3
    })

    if (due.length === 0) return
    localStorage.setItem('gw-bill-reminder-date', today)

    const names = due.slice(0, 2).map(u => u.label).join(', ')
    const extra = due.length > 2 ? ` +${due.length - 2} more` : ''
    toast(`📅 ${due.length} bill${due.length > 1 ? 's' : ''} due soon: ${names}${extra}`, {
      duration: 6000,
      icon: undefined,
    })
  }, [initialized]) // eslint-disable-line react-hooks/exhaustive-deps

  const mainRef = useRef<HTMLElement>(null)
  const [scrollY, setScrollY] = useState(0)
  const [pull, setPull] = useState(0)
  const [busy, setBusy] = useState(false)
  const drag = useRef({ active: false, y0: 0 })
  const [addOpen, setAddOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)

  // ── Accent color + dynamic favicon + theme-color ────────────────────────────
  useEffect(() => {
    const accent = settings?.accentColor ?? 'green'
    const attr   = ACCENT_ATTRS[accent] ?? 'green'

    // 1. CSS design token
    if (attr === 'green') document.documentElement.removeAttribute('data-accent')
    else document.documentElement.setAttribute('data-accent', attr)

    // 2. Favicon — swap to an SVG data URL matching the brand gradient
    const { brand, deep } = BRAND_HEX[accent] ?? BRAND_HEX.green
    const svgUrl = `data:image/svg+xml,${encodeURIComponent(makeFaviconSvg(brand, deep))}`
    let iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!iconLink) {
      iconLink = document.createElement('link')
      iconLink.rel = 'icon'
      document.head.appendChild(iconLink)
    }
    iconLink.type = 'image/svg+xml'
    iconLink.href = svgUrl

    // 3. theme-color meta — controls browser chrome / PWA title bar colour
    let themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!themeMeta) {
      themeMeta = document.createElement('meta')
      themeMeta.name = 'theme-color'
      document.head.appendChild(themeMeta)
    }
    themeMeta.content = brand
  }, [settings?.accentColor])

  // ── Scroll tracking ─────────────────────────────────────────────────────────
  const onScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollY((e.currentTarget).scrollTop)
  }, [])

  // ── Pull-to-refresh ─────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const el = mainRef.current
    if (el && el.scrollTop <= 0 && !busy) {
      drag.current = { active: true, y0: e.clientY }
    }
  }, [busy])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!drag.current.active) return
    const dy = e.clientY - drag.current.y0
    if (dy > 0) setPull(Math.min(PULL_MAX, dy * 0.55))
    else setPull(0)
  }, [])

  const onPointerEnd = useCallback(() => {
    if (!drag.current.active) return
    drag.current.active = false
    if (pull > PULL_THRESHOLD) {
      setBusy(true)
      setPull(PULL_THRESHOLD)
      refresh().finally(() => {
        setBusy(false)
        setPull(0)
      })
    } else {
      setPull(0)
    }
  }, [pull, refresh])

  const scrolled = scrollY > 55

  return (
    <AuthGuard>
      <div className="app">
        <Sidebar />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: '100vh' }}>
          <Header title={title} scrolled={scrolled} onAdd={() => setAddOpen(true)} onScan={() => setScanOpen(true)} />
          <AdminAuthAlertBanner />
          <main
            ref={mainRef}
            className="main-content"
            style={{
              flex: 1,
              background: 'var(--bg)',
              overflowY: fillPage ? 'hidden' : 'auto',
              overflowX: 'hidden',
              position: 'relative',
              WebkitOverflowScrolling: 'touch' as never,
              ...(fillPage ? { padding: 0, display: 'flex', flexDirection: 'column' } : {}),
            }}
            onScroll={onScroll}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerLeave={onPointerEnd}
            onPointerCancel={onPointerEnd}
          >
            {/* Content shifts down with pull, springs back when released.
                Only apply transform when actually pulling — translateY(0px) creates a
                stacking context that breaks position:fixed children even at rest. */}
            <div style={{
              transform: pull > 0 ? `translateY(${pull}px)` : undefined,
              transition: pull > 0 ? 'none' : 'transform .32s cubic-bezier(.22,1,.36,1)',
              minHeight: '100%',
              ...(fillPage ? { flex: 1, display: 'flex', flexDirection: 'column' } : {}),
            }}>
              {children}
            </div>

            {/* Pull indicator lives outside the shifting div so it stays fixed */}
            <PullIndicator pull={pull} busy={busy} />
          </main>
        </div>
        <MobileNav />
        <FloatingActions />

      {/* Global add-transaction modal — lives outside the scroll/transform tree */}
      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} />
      <BillScannerModal open={scanOpen} onClose={() => setScanOpen(false)} />

      {/* Badge celebration — shown once per newly earned badge */}
      <BadgeCelebrationModal
        badge={activeBadge}
        earnedDate={activeBadgeEarnedDate}
        queueLength={badgeQueue.length}
        onClose={dismissBadge}
      />
      </div>
    </AuthGuard>
  )
}
