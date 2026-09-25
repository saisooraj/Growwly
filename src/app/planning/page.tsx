'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import BudgetPlanner from '@/components/planning/BudgetPlanner'
import CategoryInsights from '@/components/planning/CategoryInsights'
import SpendingRuleCard from '@/components/planning/SpendingRuleCard'

export default function PlanningPage() {
  return (
    <AppShell title="Monthly Planning">
      <div className="anim-page max-w-2xl space-y-6">
        <SpendingRuleCard />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
              Set planned budgets per category. Click the edit icon to set or update amounts.
            </p>
            <Link
              href="/planning/spending"
              style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--brand-ink)', whiteSpace: 'nowrap', flexShrink: 0, textDecoration: 'none' }}
            >
              View full breakdown →
            </Link>
          </div>
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
