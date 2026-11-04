'use client'
export const dynamic = 'force-dynamic'

import AppShell from '@/components/layout/AppShell'
import FirePlanner from '@/components/fire/FirePlanner'

export default function Page() {
  return (
    <AppShell title="FIRE Planner">
      <FirePlanner />
    </AppShell>
  )
}
