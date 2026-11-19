'use client'

export const dynamic = 'force-dynamic'

import AppShell from '@/components/layout/AppShell'
import GoalsPage from '@/components/goals/GoalsPage'

export default function Goals() {
  return (
    <AppShell title="Goals">
      <GoalsPage />
    </AppShell>
  )
}
