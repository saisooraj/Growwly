'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import LandingPage from '@/components/LandingPage'
import LoadingScreen from '@/components/ui/LoadingScreen'
import AppShell from '@/components/layout/AppShell'

// ── New design cards ────────────────────────────────────────────────────────
import SafeToSpendCard   from '@/components/dashboard/SafeToSpendCard'
import ThisMonthCard     from '@/components/dashboard/ThisMonthCard'
import MoneyStreakCard   from '@/components/dashboard/MoneyStreakCard'
import SmartInsights     from '@/components/dashboard/SmartInsights'
import CategoryPieChart  from '@/components/dashboard/CategoryPieChart'
import MonthlyBarChart   from '@/components/dashboard/MonthlyBarChart'
import SavingsTrendChart from '@/components/dashboard/SavingsTrendChart'
import SavingsBreakdown  from '@/components/dashboard/SavingsBreakdown'
import DashboardGoals    from '@/components/dashboard/DashboardGoals'

// ── Existing cards (preserved below the new design section) ─────────────────
import EmergencyFundCard    from '@/components/dashboard/EmergencyFundCard'
import PulseCard            from '@/components/dashboard/PulseCard'
import SummaryCards         from '@/components/dashboard/SummaryCards'
import MonthlyRecap         from '@/components/dashboard/MonthlyRecap'
import UpcomingCard, { hasPendingUpcoming } from '@/components/dashboard/UpcomingCard'
import RecurringPromptModal from '@/components/dashboard/RecurringPromptModal'

import { AlertCircle } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { formatCurrencyFull } from '@/lib/utils'
import CardErrorBoundary from '@/components/ui/CardErrorBoundary'
import { DEFAULT_CARD_ORDER } from '@/lib/dashboardConstants'

function BorrowedStat({ pending }: { pending: number }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className="h-eyebrow">Borrowed by me</span>
        <AlertCircle size={14} style={{ color: 'var(--warn)' }} />
      </div>
      <div className="display-num" style={{ fontSize: 30, lineHeight: 1, color: 'var(--text)' }}>
        {formatCurrencyFull(pending)}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Pending repayment</div>
    </div>
  )
}

// Upcoming and Borrowed side by side; each shows only when it has something
function UpcomingBorrowedRow({ showUpcoming, pendingBorrowed }: { showUpcoming: boolean; pendingBorrowed: number }) {
  return (
    <div className="dash-bottom">
      {showUpcoming && <CardErrorBoundary label="Upcoming"><UpcomingCard /></CardErrorBoundary>}
      {pendingBorrowed > 0 && <CardErrorBoundary label="Borrowed"><BorrowedStat pending={pendingBorrowed} /></CardErrorBoundary>}
    </div>
  )
}


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

function DashboardPage() {
  const loading  = useAppStore((s) => s.loading)
  const settings = useAppStore((s) => s.settings)
  const borrowings       = useAppStore((s) => s.borrowings)
  const upcomingExpenses = useAppStore((s) => s.upcomingExpenses)
  const upcomingPayments = useAppStore((s) => s.upcomingPayments)
  const pendingBorrowed = borrowings
    .filter(b => b.type === 'borrowed' && b.status !== 'repaid')
    .reduce((s, b) => s + Math.max(0, b.amount - b.repaidAmount), 0)
  const showUpcoming = hasPendingUpcoming(upcomingExpenses, upcomingPayments)
  // A saved order predates newer blocks (e.g. 'goals', 'savings') — append any
  // default block missing from it so new dashboard sections aren't silently hidden.
  const savedOrder = settings?.dashboardCardOrder
  const cardOrder = savedOrder
    ? [...savedOrder, ...DEFAULT_CARD_ORDER.filter(id => !savedOrder.includes(id))]
    : DEFAULT_CARD_ORDER

  const BLOCKS: Record<string, React.ReactNode> = {
    hero: (
      <div className="dash-hero">
        <CardErrorBoundary label="Spent"><SafeToSpendCard /></CardErrorBoundary>
        <div className="dash-hero-side">
          <CardErrorBoundary label="This Month"><ThisMonthCard /></CardErrorBoundary>
          <CardErrorBoundary label="Money Streak"><MoneyStreakCard /></CardErrorBoundary>
          <div className="span-all"><CardErrorBoundary label="Emergency Fund"><EmergencyFundCard /></CardErrorBoundary></div>
          <div className="span-all"><CardErrorBoundary label="Summary"><SummaryCards /></CardErrorBoundary></div>
        </div>
      </div>
    ),
    insights: (
      <>
        <div className="lg:hidden"><CardErrorBoundary label="Smart Insights"><SmartInsights /></CardErrorBoundary></div>
        <div className="hidden lg:block" style={{ display: 'none' }} />
      </>
    ),
    charts: (
      <div className="dash-mid">
        <CardErrorBoundary label="Category Chart"><CategoryPieChart /></CardErrorBoundary>
        <CardErrorBoundary label="Monthly Chart"><MonthlyBarChart /></CardErrorBoundary>
        <div className="hidden lg:block"><CardErrorBoundary label="Smart Insights"><SmartInsights /></CardErrorBoundary></div>
      </div>
    ),
    savings: (
      <div className="dash-charts">
        <CardErrorBoundary label="Savings Trend"><SavingsTrendChart /></CardErrorBoundary>
        <CardErrorBoundary label="Savings Breakdown"><SavingsBreakdown /></CardErrorBoundary>
      </div>
    ),
    goals: <CardErrorBoundary label="Goals"><DashboardGoals /></CardErrorBoundary>,
    pulse:   <CardErrorBoundary label="Pulse"><PulseCard /></CardErrorBoundary>,
    // The whole row is left out when neither card has anything to show
    weekly: (showUpcoming || pendingBorrowed > 0)
      ? <UpcomingBorrowedRow showUpcoming={showUpcoming} pendingBorrowed={pendingBorrowed} />
      : null,
  }

  return (
    <AppShell title="Overview">
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>
          {[180, 96, 72, 200, 140, 96].map((h, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{ height: h, borderRadius: 24, background: 'var(--surface-2)', opacity: 1 - i * 0.1 }}
            />
          ))}
        </div>
      ) : (
        <div className="anim-page gw-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>
          {cardOrder.map(id => BLOCKS[id] ? <div key={id}>{BLOCKS[id]}</div> : null)}
        </div>
      )}

      <MonthlyRecap />
      <RecurringPromptModal />
    </AppShell>
  )
}
