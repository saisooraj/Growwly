'use client'

export const dynamic = 'force-dynamic'

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

export default function DashboardPage() {
  const loading = useAppStore((s) => s.loading)

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

          {/* ══ ROW 1: Hero trio ══ */}
          <div className="dash-hero">
            <SafeToSpendCard />
            <ThisMonthCard />
            <MoneyStreakCard />
          </div>

          {/* ══ ROW 2: Smart insight — mobile only (shows before charts) ══ */}
          <div className="lg:hidden">
            <SmartInsights />
          </div>

          {/* ══ ROW 3: Charts + Smart insight (desktop: 3-col; mobile: stacked) ══ */}
          <div className="dash-mid">
            <CategoryPieChart />
            <MonthlyBarChart />
            {/* 3rd column: insight card, visible only on desktop */}
            <div className="hidden lg:block">
              <SmartInsights />
            </div>
          </div>

          {/* ══ ROW 4: Goals ══ */}
          <DashboardGoals />

          {/* ══ ROW 5: Recent transactions ══ */}
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

          {/* ══ EXISTING CARDS (preserved below new design) ══ */}

          {/* Monthly pulse */}
          <PulseCard />

          {/* 4 KPI stat cards */}
          <SummaryCards />

          {/* Health + emergency side by side */}
          <div className="dash-pair">
            <HealthCard />
            <EmergencyFundCard />
          </div>

          {/* Weekly tracker + quick actions + borrowed */}
          <div className="dash-bottom">
            <WeeklyTracker />
            <QuickActions />
            <BorrowedStat />
          </div>

          {/* Upcoming expenses */}
          <UpcomingCard />

        </div>
      )}

      <MonthlyRecap />
      <RecurringPromptModal />
    </AppShell>
  )
}
