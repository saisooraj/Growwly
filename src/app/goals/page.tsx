'use client'

export const dynamic = 'force-dynamic'

import AppShell from '@/components/layout/AppShell'
import SavingsGoals from '@/components/goals/SavingsGoals'
import ProjectsSection from '@/components/projects/ProjectsSection'

export default function GoalsPage() {
  return (
    <AppShell title="Goals">
      <div className="anim-page" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        <SavingsGoals />
        <ProjectsSection />
      </div>
    </AppShell>
  )
}
