'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import HealthCard from '@/components/dashboard/HealthCard'
import SafeToSpendCard from '@/components/dashboard/SafeToSpendCard'
import EmergencyFundCard from '@/components/dashboard/EmergencyFundCard'
import SmartInsights from '@/components/dashboard/SmartInsights'
import PulseCard from '@/components/dashboard/PulseCard'
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
import { Plus, CheckCircle2, RefreshCw } from 'lucide-react'
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
          {[140, 96, 72, 200, 140, 96].map((h, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{ height: h, borderRadius: 24, background: 'var(--surface-2)', opacity: 1 - i * 0.1 }}
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

          {/* Row 2: Monthly Pulse */}
          <PulseCard />

          {/* Row 3: Smart insights */}
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

      {/* Desktop-only FAB — mobile uses MobileNav FAB */}
      <button
        onClick={() => setAddOpen(true)}
        className="hidden lg:flex fixed right-6 bottom-6 z-40 items-center gap-2"
        style={{
          padding: '12px 20px', borderRadius: 16,
          background: 'linear-gradient(150deg, var(--brand-2), var(--brand))',
          color: '#fff', border: 'none', cursor: 'pointer',
          fontSize: 14, fontWeight: 700,
          boxShadow: '0 8px 24px -6px var(--brand)',
          transition: 'transform .12s ease, box-shadow .12s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 12px 30px -6px var(--brand)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 24px -6px var(--brand)' }}
        onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1.03)')}
      >
        <Plus size={18} strokeWidth={2.6} /> Add transaction
      </button>

      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} />
      <MonthlyRecap />
      <RecurringPromptModal />
    </AppShell>
  )
}
