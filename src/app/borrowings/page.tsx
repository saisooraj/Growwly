'use client'

export const dynamic = 'force-dynamic'

import AppShell from '@/components/layout/AppShell'
import BorrowingsScreen from '@/components/borrowings/BorrowingsScreen'

export default function BorrowingsPage() {
  return (
    <AppShell title="Borrowings">
      <BorrowingsScreen />
    </AppShell>
  )
}
