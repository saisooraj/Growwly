'use client'

export const dynamic = 'force-dynamic'

import { useAuth } from '@/context/AuthContext'
import LandingPage from '@/components/LandingPage'
import AppShell from '@/components/layout/AppShell'

// ── New design cards ────────────────────────────────────────────────────────
import SafeToSpendCard   from '@/components/dashboard/SafeToSpendCard'
import ThisMonthCard     from '@/components/dashboard/ThisMonthCard'
import MoneyStreakCard   from '@/components/dashboard/MoneyStreakCard'
import SmartInsights     from '@/components/dashboard/SmartInsights'
import CategoryPieChart  from '@/components/dashboard/CategoryPieChart'
import MonthlyBarChart   from '@/components/dashboard/MonthlyBarChart'
import DashboardGoals    from '@/components/dashboard/DashboardGoals'

// ── Existing cards (preserved below the new design section) ─────────────────
import HealthCard           from '@/components/dashboard/HealthCard'
import EmergencyFundCard    from '@/components/dashboard/EmergencyFundCard'
import PulseCard            from '@/components/dashboard/PulseCard'
import SummaryCards         from '@/components/dashboard/SummaryCards'
import WeeklyTracker        from '@/components/dashboard/WeeklyTracker'
import QuickActions         from '@/components/dashboard/QuickActions'
import MonthlyRecap         from '@/components/dashboard/MonthlyRecap'
import UpcomingCard         from '@/components/dashboard/UpcomingCard'
import RecurringPromptModal from '@/components/dashboard/RecurringPromptModal'
import TransactionList      from '@/components/transactions/TransactionList'

import { CheckCircle2 } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { formatCurrencyFull } from '@/lib/utils'
import CardErrorBoundary from '@/components/ui/CardErrorBoundary'
import { DEFAULT_CARD_ORDER } from '@/lib/dashboardConstants'

function BorrowedStat() {
  const { borrowings } = useAppStore()
  const pending = borrowings
    .filter(b => b.type === 'borrowed' && b.status !== 'repaid')
    .reduce((s, b) => s + (b.amount - b.repaidAmount), 0)

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className="h-eyebrow">Borrowed by me</span>
        <CheckCircle2 size={14} style={{ color: pending > 0 ? 'var(--warn)' : 'var(--good)' }} />
      </div>
      <div className="display-num" style={{ fontSize: 30, lineHeight: 1, color: 'var(--text)' }}>
        {formatCurrencyFull(pending)}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
        {pending > 0 ? 'Pending repayment' : 'All clear'}
      </div>
    </div>
  )
}


export default function RootPage() {
  const { user, loading: authLoading } = useAuth()

  // Show dashboard only once we're sure the user is logged in.
  // During auth loading and when unauthenticated, show the landing page —
  // this avoids a jarring dark → light flash and the Strict Mode double-mount flicker.
  if (!authLoading && user) return <DashboardPage />
  return <LandingPage />
}

function DashboardPage() {
  const loading  = useAppStore((s) => s.loading)
  const settings = useAppStore((s) => s.settings)
  const cardOrder = settings?.dashboardCardOrder ?? DEFAULT_CARD_ORDER

  const BLOCKS: Record<string, React.ReactNode> = {
    hero: (
      <div className="dash-hero">
        <CardErrorBoundary label="Safe to Spend"><SafeToSpendCard /></CardErrorBoundary>
        <CardErrorBoundary label="This Month"><ThisMonthCard /></CardErrorBoundary>
        <CardErrorBoundary label="Money Streak"><MoneyStreakCard /></CardErrorBoundary>
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
    goals: <CardErrorBoundary label="Goals"><DashboardGoals /></CardErrorBoundary>,
    transactions: (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="h-eyebrow">Recent activity</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2, color: 'var(--text)', letterSpacing: '-0.02em' }}>Transactions</div>
          </div>
          <a href="/transactions" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>See all →</a>
        </div>
        <TransactionList filterMonth limit={6} />
      </div>
    ),
    pulse:   <CardErrorBoundary label="Pulse"><PulseCard /></CardErrorBoundary>,
    summary: <CardErrorBoundary label="Summary"><SummaryCards /></CardErrorBoundary>,
    'health-ef': (
      <div className="dash-pair">
        <CardErrorBoundary label="Health"><HealthCard /></CardErrorBoundary>
        <CardErrorBoundary label="Emergency Fund"><EmergencyFundCard /></CardErrorBoundary>
      </div>
    ),
    weekly: (
      <div className="dash-bottom">
        <CardErrorBoundary label="Weekly Tracker"><WeeklyTracker /></CardErrorBoundary>
        <CardErrorBoundary label="Quick Actions"><QuickActions /></CardErrorBoundary>
        <CardErrorBoundary label="Borrowed"><BorrowedStat /></CardErrorBoundary>
      </div>
    ),
    upcoming: <CardErrorBoundary label="Upcoming"><UpcomingCard /></CardErrorBoundary>,
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
