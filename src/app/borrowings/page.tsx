'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import BorrowingsList from '@/components/borrowings/BorrowingsList'
import AddBorrowingModal from '@/components/borrowings/AddBorrowingModal'
import ContactsModal from '@/components/borrowings/ContactsModal'
import { Plus, Users } from 'lucide-react'
import type { Borrowing } from '@/types'

export default function BorrowingsPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [editBorrowing, setEditBorrowing] = useState<Borrowing | null>(null)
  const [contactsOpen, setContactsOpen] = useState(false)

  return (
    <AppShell title="Borrowings">
      <div className="anim-page" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
            Who owes whom — settled cleanly.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setContactsOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 11,
                background: 'var(--surface-2)', color: 'var(--text-2)',
                border: '1px solid var(--border)',
                cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              }}
            >
              <Users size={14} strokeWidth={2} /> People
            </button>
            <button
              onClick={() => setAddOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 11,
                background: 'var(--brand-soft)', color: 'var(--brand-ink)',
                border: '1px solid color-mix(in oklch, var(--brand) 25%, transparent)',
                cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              }}
            >
              <Plus size={14} strokeWidth={2.5} /> Add Record
            </button>
          </div>
        </div>

        <BorrowingsList onEdit={(b) => setEditBorrowing(b)} />
      </div>

      <AddBorrowingModal
        open={addOpen || !!editBorrowing}
        onClose={() => { setAddOpen(false); setEditBorrowing(null) }}
        editBorrowing={editBorrowing}
      />
      <ContactsModal open={contactsOpen} onClose={() => setContactsOpen(false)} />
    </AppShell>
  )
}
