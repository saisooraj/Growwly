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
import MonthlyRecap         from '@/components/dashboard/MonthlyRecap'
import UpcomingCard, { hasPendingUpcoming } from '@/components/dashboard/UpcomingCard'
import RecurringPromptModal from '@/components/dashboard/RecurringPromptModal'

import Link from 'next/link'
import { AlertCircle, ArrowRight, Eye, EyeOff, Handshake } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { formatCurrencyFull } from '@/lib/utils'
import CardErrorBoundary from '@/components/ui/CardErrorBoundary'
import { DEFAULT_CARD_ORDER } from '@/lib/dashboardConstants'

// What you owe and what's owed to you, side by side; each half shows only when non-zero
function LoansCard({ owe, owed, owedCount }: { owe: number; owed: number; owedCount: number }) {
  const [masked, setMasked] = useState(true)
  const amount = (v: number) => masked ? '₹ ••••' : formatCurrencyFull(v)
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="h-eyebrow" style={{ flex: 1 }}>Loans</span>
        <button
          onClick={() => setMasked(v => !v)}
          aria-label={masked ? 'Show amounts' : 'Hide amounts'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', display: 'flex', padding: 2 }}
        >
          {masked ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <Link href="/borrowings" aria-label="Open borrowings" style={{ color: 'var(--brand)', display: 'flex', padding: 2 }}>
          <ArrowRight size={15} />
        </Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: owe > 0 && owed > 0 ? '1fr 1fr' : '1fr', gap: 16 }}>
        {owed > 0 && (
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>
              <Handshake size={13} style={{ color: 'var(--warn)' }} /> Owed to you
            </div>
            <div className="display-num" style={{ fontSize: 24, lineHeight: 1, color: 'var(--warn-ink)' }}>{amount(owed)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
              {owedCount} record{owedCount !== 1 ? 's' : ''} pending
            </div>
          </div>
        )}
        {owe > 0 && (
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>
              <AlertCircle size={13} style={{ color: 'var(--warn)' }} /> Borrowed by me
            </div>
            <div className="display-num" style={{ fontSize: 24, lineHeight: 1, color: 'var(--text)' }}>{amount(owe)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>Pending repayment</div>
          </div>
        )}
      </div>
    </div>
  )
}

// Upcoming and Loans side by side; each shows only when it has something
function UpcomingLoansRow({ showUpcoming, pendingBorrowed, pendingLent, pendingLentCount }: {
  showUpcoming: boolean; pendingBorrowed: number; pendingLent: number; pendingLentCount: number
}) {
  return (
    <div className="dash-bottom">
      {showUpcoming && <CardErrorBoundary label="Upcoming"><UpcomingCard /></CardErrorBoundary>}
      {(pendingBorrowed > 0 || pendingLent > 0) && (
        <CardErrorBoundary label="Loans">
          <LoansCard owe={pendingBorrowed} owed={pendingLent} owedCount={pendingLentCount} />
        </CardErrorBoundary>
      )}
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
  const pendingLentRecords = borrowings.filter(b => b.type === 'lent' && b.status !== 'repaid')
  const pendingLent = pendingLentRecords.reduce((s, b) => s + Math.max(0, b.amount - b.repaidAmount), 0)
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
        </div>
      </div>
    ),
    // On desktop Smart Insights lives in the charts row, so this block is hidden there (see BLOCK_CLASS)
    insights: <CardErrorBoundary label="Smart Insights"><SmartInsights /></CardErrorBoundary>,
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
    weekly: (showUpcoming || pendingBorrowed > 0 || pendingLent > 0)
      ? <UpcomingLoansRow showUpcoming={showUpcoming} pendingBorrowed={pendingBorrowed} pendingLent={pendingLent} pendingLentCount={pendingLentRecords.length} />
      : null,
  }

  // Classes on a block's wrapper itself, so a block hidden at this width doesn't leave an empty slot (and a double gap)
  const BLOCK_CLASS: Record<string, string> = { insights: 'lg:hidden' }

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
          {cardOrder.map(id => BLOCKS[id] ? <div key={id} className={`dash-block ${BLOCK_CLASS[id] ?? ''}`}>{BLOCKS[id]}</div> : null)}
        </div>
      )}

      <MonthlyRecap />
      <RecurringPromptModal />
    </AppShell>
  )
}
