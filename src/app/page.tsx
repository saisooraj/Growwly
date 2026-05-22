'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import SummaryCards from '@/components/dashboard/SummaryCards'
import MonthlyBarChart from '@/components/dashboard/MonthlyBarChart'
import CategoryPieChart from '@/components/dashboard/CategoryPieChart'
import SpendingTrendLine from '@/components/dashboard/SpendingTrendLine'
import CashFlowChart from '@/components/dashboard/CashFlowChart'
import WeeklyTracker from '@/components/dashboard/WeeklyTracker'
import AlertsPanel from '@/components/dashboard/AlertsPanel'
import EmergencyFundCard from '@/components/dashboard/EmergencyFundCard'
import TransactionList from '@/components/transactions/TransactionList'
import AddTransactionModal from '@/components/transactions/AddTransactionModal'
import { Plus } from 'lucide-react'
import { useAppStore } from '@/store/appStore'

export default function DashboardPage() {
  const [addOpen, setAddOpen] = useState(false)
  const loading = useAppStore((s) => s.loading)

  return (
    <AppShell title="Dashboard">
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <AlertsPanel />
          <SummaryCards />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <MonthlyBarChart />
            <CategoryPieChart />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SpendingTrendLine />
            <CashFlowChart />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <WeeklyTracker />
            <EmergencyFundCard />
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">Recent Transactions</h3>
              <a href="/transactions" className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                View all →
              </a>
            </div>
            <TransactionList filterMonth limit={8} />
          </div>
        </div>
      )}

      <button
        onClick={() => setAddOpen(true)}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 w-14 h-14 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105"
      >
        <Plus size={24} />
      </button>

      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} />
    </AppShell>
  )
}
