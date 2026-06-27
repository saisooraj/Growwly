'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import BorrowingsList from '@/components/borrowings/BorrowingsList'
import AddBorrowingModal from '@/components/borrowings/AddBorrowingModal'
import { Plus } from 'lucide-react'
import type { Borrowing } from '@/types'

export default function BorrowingsPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [editBorrowing, setEditBorrowing] = useState<Borrowing | null>(null)

  return (
    <AppShell title="Borrowings">
      <div className="anim-page space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Track borrowed and lent amounts.</p>
          <button onClick={() => setAddOpen(true)} className="btn-primary">
            <Plus size={15} /> Add Record
          </button>
        </div>
        <BorrowingsList onEdit={(b) => setEditBorrowing(b)} />
      </div>

      <AddBorrowingModal
        open={addOpen || !!editBorrowing}
        onClose={() => { setAddOpen(false); setEditBorrowing(null) }}
        editBorrowing={editBorrowing}
      />
    </AppShell>
  )
}
