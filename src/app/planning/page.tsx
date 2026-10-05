'use client'

export const dynamic = 'force-dynamic'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import BudgetPlanner from '@/components/planning/BudgetPlanner'
import PlanKpiRow from '@/components/planning/PlanKpiRow'
import SpendingRuleCard from '@/components/planning/SpendingRuleCard'
import { useAppStore } from '@/store/appStore'
import { buildBudgetPlan } from '@/lib/budgetPlan'
import { formatCycleRange } from '@/lib/cycle'

export default function PlanningPage() {
  const { transactions, budgets, settings, selectedMonth } = useAppStore()
  const [masked, setMasked] = useState(true)

  const plan = useMemo(
    () => buildBudgetPlan(transactions, budgets, settings, selectedMonth),
    [transactions, budgets, settings, selectedMonth]
  )

  const { cycle } = plan
  const range = formatCycleRange(cycle.start, cycle.end)
  const cycleLabel = cycle.phase === 'live' ? `Day ${cycle.elapsed} of ${cycle.days} · ${range}`
    : cycle.phase === 'past' ? `Cycle ended · ${range}`
    : `Upcoming cycle · ${range}`

  return (
    <AppShell title="Monthly Planning">
      <div className="anim-page" style={{ maxWidth: 1120, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{cycleLabel}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link
              href="/planning/spending"
              style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--brand-ink)', whiteSpace: 'nowrap', textDecoration: 'none' }}
            >
              Spending breakdown →
            </Link>
            <button
              onClick={() => setMasked(v => !v)}
              className="btn-ghost btn-sm"
              style={{ border: '1px solid var(--border)' }}
            >
              {masked ? <Eye size={13} /> : <EyeOff size={13} />}
              {masked ? 'Show amounts' : 'Hide amounts'}
            </button>
          </div>
        </div>

        <PlanKpiRow plan={plan} masked={masked} />
        <SpendingRuleCard plan={plan} masked={masked} />
        <BudgetPlanner plan={plan} masked={masked} />
      </div>
    </AppShell>
  )
}
