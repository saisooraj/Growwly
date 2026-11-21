'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import LandingPage from '@/components/LandingPage'
import LoadingScreen from '@/components/ui/LoadingScreen'
import AppShell from '@/components/layout/AppShell'
import CardErrorBoundary from '@/components/ui/CardErrorBoundary'
import { useAppStore } from '@/store/appStore'
import { usePrivacy } from '@/store/privacyStore'
import { usePulse } from '@/hooks/usePulse'
import { resolveCardOrder } from '@/lib/dashboardConstants'

import MonthCard from '@/components/overview/MonthCard'
import AttentionCard from '@/components/overview/AttentionCard'
import TodayCard from '@/components/overview/TodayCard'
import WeekCard from '@/components/overview/WeekCard'
import StreakCard, { RESTORE_EVENT } from '@/components/overview/StreakCard'
import UpcomingCard, { relevantUpcoming } from '@/components/overview/UpcomingCard'
import EmergencyCard, { type EmergencyHandle } from '@/components/overview/EmergencyCard'
import SavingsCard, { useSavingsHistory } from '@/components/overview/SavingsCard'
import LoansCard, { useLoans } from '@/components/overview/LoansCard'
import GoalsCard from '@/components/overview/GoalsCard'
import TrendsCard from '@/components/overview/TrendsCard'
import { OverviewSkeleton, PrivacyBar, SetupTray, type TrayChip } from '@/components/overview/Extras'
import { OverviewCtx, scrollToBlock, useMediaQuery, type OverviewActions } from '@/components/overview/ui'

import EfPaybackBanner from '@/components/emergency/EfPayback'
import PulseSheet from '@/components/pulse/PulseSheet'
import MonthlyRecap from '@/components/dashboard/MonthlyRecap'
import RecurringPromptModal from '@/components/dashboard/RecurringPromptModal'
import LogPaymentModal from '@/components/upcoming/LogPaymentModal'
import AddTransactionModal from '@/components/transactions/AddTransactionModal'

export default function RootPage() {
  const { user, loading: authLoading } = useAuth()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // Guard: server and client must render the same thing during hydration.
  // Firebase can resolve auth from IndexedDB as a microtask before React
  // finishes hydrating, causing a server/client mismatch if we switch to
  // DashboardPage mid-hydration. The mounted flag defers the switch until
  // after hydration is complete.
  // Show a loader (not LandingPage) while waiting — this prevents a flash of
  // the landing page for users who are already logged in.
  if (!mounted || authLoading) return <LoadingScreen />
  if (user) return <DashboardPage />
  return <LandingPage />
}

// Starting desktop (≥1280) and tablet (≥768) spans on the 12-column grid; packRows widens them to fill each row
const NAME: Record<string, string> = {
  month: 'Month', attention: 'Needs attention', spend: 'Today', week: 'This week', streak: 'Streak',
  upcoming: 'Upcoming', emergency: 'Emergency fund', savings: 'Savings', loans: 'Loans', goals: 'Goals', trends: 'Trends',
}
const SPAN: Record<string, [number, number]> = {
  month: [8, 12], attention: [4, 6], spend: [4, 6], week: [5, 8], streak: [3, 4],
  upcoming: [4, 6], emergency: [4, 6], savings: [7, 12], loans: [4, 12], goals: [12, 12], trends: [5, 12],
}

// Lays blocks out row by row on the 12-column grid. When the next block doesn't fit, a later one
// that does is pulled up (as dense packing would); whatever is still left is shared across the
// row's blocks in proportion to their width, so any order or set of hidden blocks ends flush.
function packRows(items: { id: string; span: number }[]): { id: string; span: number }[] {
  const queue = [...items]
  const out: { id: string; span: number }[] = []
  while (queue.length) {
    const row = [queue.shift()!]
    let used = row[0].span
    for (let k = 0; k < queue.length && used < 12;) {
      if (used + queue[k].span <= 12) { used += queue[k].span; row.push(...queue.splice(k, 1)) }
      else k++
    }
    const left = 12 - used
    let given = 0
    row.forEach((b, k) => {
      const add = k === row.length - 1 ? left - given : Math.min(left - given, Math.round((left * b.span) / used))
      out.push({ id: b.id, span: b.span + add })
      given += add
    })
  }
  return out
}

function DashboardPage() {
  const loading = useAppStore(s => s.loading)
  const settings = useAppStore(s => s.settings)
  const transactions = useAppStore(s => s.transactions)
  const upcoming = useAppStore(s => s.upcomingExpenses)
  const payments = useAppStore(s => s.upcomingPayments)
  const goals = useAppStore(s => s.savingsGoals)
  const masked = usePrivacy(s => s.masked)
  const hydratePrivacy = usePrivacy(s => s.hydrate)
  const pulse = usePulse()
  const wide = useMediaQuery('(min-width: 1280px)')
  const mid = useMediaQuery('(min-width: 768px)')
  const savingsHist = useSavingsHistory()
  const loans = useLoans()
  useEffect(() => { hydratePrivacy() }, [hydratePrivacy])

  const [details, setDetails] = useState<{ open: boolean; focus?: 'cash' }>({ open: false })
  const [recapOpen, setRecapOpen] = useState(false)
  const [recurringOpen, setRecurringOpen] = useState(false)
  const [payId, setPayId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [tick, setTick] = useState(0)
  const emergency = useRef<EmergencyHandle>(null)
  const bump = useCallback(() => setTick(t => t + 1), [])

  const actions: OverviewActions = useMemo(() => ({
    openAdd: () => setAddOpen(true),
    openDetails: focus => setDetails({ open: true, focus }),
    openRecap: () => setRecapOpen(true),
    openRecurring: () => setRecurringOpen(true),
    openPay: id => setPayId(id),
    restoreStreak: () => { scrollToBlock('streak'); window.dispatchEvent(new Event(RESTORE_EVENT)) },
    setupEmergency: () => { scrollToBlock('emergency'); emergency.current?.setup() },
    tick,
  }), [tick])

  const isNew = transactions.length === 0
  const order = resolveCardOrder(settings?.dashboardCardOrder)
  const hidden = new Set(settings?.dashboardHiddenCards ?? [])

  // Blocks with nothing to show hide on their own (and offer a chip in the setup tray)
  const has: Record<string, boolean> = {
    month: true, spend: true, week: true, streak: true, emergency: true,
    attention: !isNew,
    upcoming: relevantUpcoming(upcoming).length > 0,
    savings: savingsHist.some(h => h.contributed > 0 || h.withdrawn > 0),
    loans: loans.owed > 0 || loans.owe > 0,
    goals: goals.length > 0,
    trends: transactions.filter(t => t.type === 'expense').length >= 3,
  }
  const chips: TrayChip[] = []
  if (!has.upcoming) chips.push({ label: 'Upcoming bill', href: '/upcoming' })
  if (!has.goals || !has.savings) chips.push({ label: 'Savings goal', href: '/goals' })
  if (!has.loans) chips.push({ label: 'Money lent or borrowed', href: '/borrowings' })
  if (!transactions.some(t => t.isRecurring)) chips.push({ label: 'Recurring payment', onClick: () => setAddOpen(true) })

  const BLOCKS: Record<string, React.ReactNode> = {
    month: <MonthCard isNew={isNew} />,
    attention: <AttentionCard />,
    spend: <TodayCard />,
    week: <WeekCard isNew={isNew} />,
    streak: <StreakCard isNew={isNew} />,
    upcoming: <UpcomingCard />,
    emergency: <EmergencyCard ref={emergency} />,
    savings: <SavingsCard />,
    loans: <LoansCard />,
    goals: <GoalsCard />,
    trends: <TrendsCard />,
  }
  const visible = order.filter(id => BLOCKS[id] && has[id] && !hidden.has(id))
  // Phones stack every block full width in the saved order
  const layout = mid ? packRows(visible.map(id => ({ id, span: SPAN[id][wide ? 0 : 1] }))) : visible.map(id => ({ id, span: 12 }))
  const payItem = payId ? upcoming.find(u => u.id === payId) ?? null : null
  const paidSoFar = payId ? payments.filter(p => p.upcomingId === payId).reduce((s, p) => s + p.amount, 0) : 0

  return (
    <AppShell title="Overview">
      <OverviewCtx.Provider value={actions}>
        <div className="ov">
          {loading ? <OverviewSkeleton /> : (
            <div className="ov-grid">
              {masked && <div className="ov-in"><PrivacyBar /></div>}
              <div className="ov-in"><CardErrorBoundary label="Emergency fund payback"><EfPaybackBanner /></CardErrorBoundary></div>
              {layout.map(({ id, span }, i) => (
                <div
                  key={id} id={`ov-${id}`}
                  className="ov-in" style={{ gridColumn: `span ${span}`, animationDelay: `${(i + 1) * 40}ms`, scrollMarginTop: 96 }}
                >
                  <CardErrorBoundary label={NAME[id]}>{BLOCKS[id]}</CardErrorBoundary>
                </div>
              ))}
              {chips.length > 0 && !hidden.has('tray') && (
                <div className="ov-in" style={{ animationDelay: `${(visible.length + 1) * 40}ms` }}><SetupTray chips={chips} /></div>
              )}
            </div>
          )}
        </div>

        <PulseSheet open={details.open} focus={details.focus} onClose={() => setDetails({ open: false })} pulse={pulse} />
        <MonthlyRecap open={recapOpen} onClose={() => { setRecapOpen(false); bump() }} />
        <RecurringPromptModal open={recurringOpen} onClose={() => { setRecurringOpen(false); bump() }} />
        <LogPaymentModal open={!!payItem} onClose={() => setPayId(null)} item={payItem} alreadyPaid={paidSoFar} />
        <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} />
      </OverviewCtx.Provider>
    </AppShell>
  )
}
