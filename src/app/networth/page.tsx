'use client'
export const dynamic = 'force-dynamic'

import AppShell from '@/components/layout/AppShell'
import NetWorthPage from '@/components/networth/NetWorthPage'

export default function Page() {
  return (
    <AppShell title="Net Worth">
      <NetWorthPage />
    </AppShell>
  )
}
