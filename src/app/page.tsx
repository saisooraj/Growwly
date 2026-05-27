'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import HealthCard from '@/components/dashboard/HealthCard'
import SafeToSpendCard from '@/components/dashboard/SafeToSpendCard'
import EmergencyFundCard from '@/components/dashboard/EmergencyFundCard'
import SmartInsights from '@/components/dashboard/SmartInsights'
import SummaryCards from '@/components/dashboard/SummaryCards'
import MonthlyBarChart from '@/components/dashboard/MonthlyBarChart'
import CategoryPieChart from '@/components/dashboard/CategoryPieChart'
import WeeklyTracker from '@/components/dashboard/WeeklyTracker'
import QuickActions from '@/components/dashboard/QuickActions'
import MonthlyRecap from '@/components/dashboard/MonthlyRecap'
import UpcomingCard from '@/components/dashboard/UpcomingCard'
import RecurringPromptModal from '@/components/dashboard/RecurringPromptModal'
import TransactionList from '@/components/transactions/TransactionList'
import AddTransactionModal from '@/components/transactions/AddTransactionModal'
import { Plus, CheckCircle2 } from 'lucide-react'
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
  const [addOpen, setAddOpen] = useState(false)
  const loading = useAppStore((s) => s.loading)

  return (
    <AppShell title="Overview">
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{ height: 96, borderRadius: 16, background: 'var(--surface-2)' }}
            />
          ))}
        </div>
      ) : (
        <div className="anim-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>

          {/* Row 1: Health hero + Safe-to-spend + Emergency */}
          <div className="dash-hero">
            <HealthCard />
            <SafeToSpendCard />
            <EmergencyFundCard />
          </div>

          {/* Row 2: Smart insights */}
          <SmartInsights />

          {/* Row 3: 4 KPIs */}
          <SummaryCards />

          {/* Row 4: Charts */}
          <div className="dash-charts">
            <MonthlyBarChart />
            <CategoryPieChart />
          </div>

          {/* Row 5: Weekly + Quick actions + Borrowed */}
          <div className="dash-bottom">
            <WeeklyTracker />
            <QuickActions />
            <BorrowedStat />
          </div>

          {/* Row 6: Upcoming expenses */}
          <UpcomingCard />

          {/* Row 6: Recent transactions */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="h-eyebrow">Recent activity</div>
                <div style={{ fontSize: 18, fontWeight: 500, marginTop: 2, color: 'var(--text)' }}>Transactions</div>
              </div>
              <a href="/transactions" className="btn btn-ghost btn-sm">View all →</a>
            </div>
            <TransactionList filterMonth limit={6} />
          </div>

        </div>
      )}

      {/* FAB — bottom-24 on mobile (above nav), bottom-6 on desktop */}
      <button
        onClick={() => setAddOpen(true)}
        className="fixed right-4 bottom-24 lg:right-6 lg:bottom-6 z-40 flex items-center justify-center"
        style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--text)', color: 'var(--bg)',
          border: 'none', cursor: 'pointer',
          boxShadow: 'var(--shadow-lg), 0 0 0 6px color-mix(in oklch, var(--text) 8%, transparent)',
          transition: 'transform .12s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1.05)')}
      >
        <Plus size={24} />
      </button>

      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} />
      <MonthlyRecap />
      <RecurringPromptModal />
    </AppShell>
  )
}
