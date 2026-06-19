'use client'

export const dynamic = 'force-dynamic'

import AppShell from '@/components/layout/AppShell'
import BudgetPlanner from '@/components/planning/BudgetPlanner'
import CategoryInsights from '@/components/planning/CategoryInsights'
import SpendingRuleCard from '@/components/planning/SpendingRuleCard'

export default function PlanningPage() {
  return (
    <AppShell title="Monthly Planning">
      <div className="max-w-2xl space-y-6">
        <SpendingRuleCard />
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>
            Set planned budgets per category. Click the edit icon to set or update amounts.
          </p>
          <BudgetPlanner />
        </div>
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>Spending compared to last month.</p>
          <CategoryInsights />
        </div>
      </div>
    </AppShell>
  )
}
