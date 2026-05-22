'use client'

export const dynamic = 'force-dynamic'

import AppShell from '@/components/layout/AppShell'
import BudgetPlanner from '@/components/planning/BudgetPlanner'

export default function PlanningPage() {
  return (
    <AppShell title="Monthly Planning">
      <div className="max-w-2xl">
        <p className="text-sm text-slate-500 mb-5">
          Set planned budgets per category. Click the edit icon to set or update amounts.
        </p>
        <BudgetPlanner />
      </div>
    </AppShell>
  )
}
