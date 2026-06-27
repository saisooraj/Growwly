'use client'

export const dynamic = 'force-dynamic'

import AppShell from '@/components/layout/AppShell'
import SavingsGoals from '@/components/goals/SavingsGoals'

export default function GoalsPage() {
  return (
    <AppShell title="Savings Goals">
      <div className="anim-page max-w-2xl">
        <SavingsGoals />
      </div>
    </AppShell>
  )
}
