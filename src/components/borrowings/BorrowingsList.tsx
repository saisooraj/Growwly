'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Trash2, Edit2, CheckCircle, MessageCircle, ChevronDown } from 'lucide-react'
import { deleteBorrowing, updateBorrowing, addTransaction } from '@/lib/firestore'
import { useRefreshData } from '@/hooks/useData'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { formatCurrencyFull } from '@/lib/utils'
import type { Borrowing } from '@/types'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'

interface Props {
  onEdit: (b: Borrowing) => void
}

function buildWhatsAppLink(b: Borrowing): string {
  const outstanding = b.amount - b.repaidAmount
  const msg = b.type === 'lent'
    ? `Hi ${b.person}, just a reminder that you owe me ₹${outstanding.toLocaleString('en-IN')}${b.description ? ` for ${b.description}` : ''}. Please let me know when you can repay. Thanks!`
    : `Hi ${b.person}, I still owe you ₹${outstanding.toLocaleString('en-IN')}${b.description ? ` for ${b.description}` : ''}. I'll arrange to repay soon.`
  return `https://wa.me/?text=${encodeURIComponent(msg)}`
}

function BorrowingCard({ b, onEdit, onDelete, onMarkRepaid, muted = false }: {
  b: Borrowing
  onEdit: (b: Borrowing) => void
  onDelete: (id: string) => void
  onMarkRepaid: (b: Borrowing) => void
  muted?: boolean
}) {
  const isBorrowed = b.type === 'borrowed'
  const progress = b.amount > 0 ? Math.min((b.repaidAmount / b.amount) * 100, 100) : 0

  return (
    <div className={`relative bg-[var(--surface)] rounded-[var(--radius-md)] border border-[var(--border)] overflow-hidden transition-opacity ${muted ? 'opacity-50' : ''}`}
      style={{ boxShadow: 'var(--shadow-sm)' }}>
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${isBorrowed ? 'bg-[var(--bad)]' : 'bg-[var(--good)]'}`} />

      <div className="pl-4 pr-3 py-3">
        {/* Top row: person + amount */}
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <div className="min-w-0">
            <p className="font-semibold text-[var(--text)] truncate">{b.person}</p>
            {b.description && (
              <p className="text-xs text-[var(--text-3)] truncate mt-0.5">{b.description}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className={`font-bold ${isBorrowed ? 'text-[var(--bad-ink)]' : 'text-[var(--good-ink)]'}`}>
              {formatCurrencyFull(b.amount)}
            </p>
            {b.repaidAmount > 0 && b.repaidAmount < b.amount && (
              <p className="text-xs text-[var(--text-3)] mt-0.5">
                {formatCurrencyFull(b.repaidAmount)} repaid
              </p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {b.amount > 0 && b.repaidAmount > 0 && (
          <div className="w-full bg-[var(--surface-2)] rounded-full h-1 mb-2">
            <div
              className="h-1 rounded-full bg-[var(--good)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Bottom row: meta + actions */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
              isBorrowed ? 'bg-[var(--bad-soft)] text-[var(--bad-ink)]' : 'bg-[var(--good-soft)] text-[var(--good-ink)]'
            }`}>
              {isBorrowed ? 'You owe' : 'Owed to you'}
            </span>
            {b.status === 'partial' && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--info-soft)] text-[var(--info-ink)]">
                Partial
              </span>
            )}
            <span className="text-[10px] text-[var(--text-4)]">
              {format(parseISO(b.date), 'dd MMM yyyy')}
              {b.dueDate && ` · due ${format(parseISO(b.dueDate), 'dd MMM')}`}
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            {b.status !== 'repaid' && (
              <>
                <button
                  onClick={() => onMarkRepaid(b)}
                  className="p-1.5 rounded-lg hover:bg-[var(--good-soft)] text-[var(--text-4)] hover:text-[var(--good-ink)] transition-colors"
                  title="Mark repaid"
                >
                  <CheckCircle size={14} />
                </button>
                <a
                  href={buildWhatsAppLink(b)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-[var(--good-soft)] text-[var(--text-4)] hover:text-[var(--good-ink)] transition-colors"
                  title="WhatsApp reminder"
                >
                  <MessageCircle size={14} />
                </a>
              </>
            )}
            <button
              onClick={() => onEdit(b)}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-4)] hover:text-[var(--text-2)] transition-colors"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={() => onDelete(b.id)}
              className="p-1.5 rounded-lg hover:bg-[var(--bad-soft)] text-[var(--text-4)] hover:text-[var(--bad-ink)] transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BorrowingsList({ onEdit }: Props) {
  const { user } = useAuth()
  const { borrowings } = useAppStore()
  const refresh = useRefreshData()
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [showRepaid, setShowRepaid] = useState(false)

  const totalBorrowed = borrowings
    .filter((b) => b.type === 'borrowed' && b.status !== 'repaid')
    .reduce((s, b) => s + (b.amount - b.repaidAmount), 0)

  const totalLent = borrowings
    .filter((b) => b.type === 'lent' && b.status !== 'repaid')
    .reduce((s, b) => s + (b.amount - b.repaidAmount), 0)

  const active = borrowings.filter((b) => b.status !== 'repaid')
  const repaid = borrowings.filter((b) => b.status === 'repaid')

  function handleDelete(id: string) {
    setConfirm({
      message: 'Delete this borrowing record?',
      onConfirm: async () => {
        try {
          await deleteBorrowing(id)
          await refresh()
          toast.success('Deleted')
        } catch { toast.error('Failed') }
      },
    })
  }

  async function markRepaid(b: Borrowing) {
    if (!user) return
    try {
      const outstanding = b.amount - b.repaidAmount
      const today = format(new Date(), 'yyyy-MM-dd')

      if (outstanding > 0) {
        await addTransaction(user.uid, {
          type: 'transfer',
          transferKind: b.type === 'lent' ? 'loan_repayment_received' : 'loan_repayment_paid',
          amount: outstanding,
          category: 'Other',
          date: today,
          notes: b.type === 'lent'
            ? `Repayment from ${b.person}${b.description ? ' · ' + b.description : ''}`
            : `Repaid to ${b.person}${b.description ? ' · ' + b.description : ''}`,
          isRecurring: false,
          borrowingId: b.id,
        } as Parameters<typeof addTransaction>[1])
      }

      await updateBorrowing(b.id, { repaidAmount: b.amount, status: 'repaid' })
      await refresh()
      toast.success('Marked as repaid — transaction logged')
    } catch {
      toast.error('Failed')
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[var(--radius-md)] border border-[var(--bad-soft)] bg-[var(--bad-soft)] px-4 py-3">
          <p className="text-xs font-medium text-[var(--bad-ink)] mb-1">You Owe</p>
          <p className="text-xl font-bold text-[var(--bad-ink)]">{formatCurrencyFull(totalBorrowed)}</p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--good-soft)] bg-[var(--good-soft)] px-4 py-3">
          <p className="text-xs font-medium text-[var(--good-ink)] mb-1">Owed to You</p>
          <p className="text-xl font-bold text-[var(--good-ink)]">{formatCurrencyFull(totalLent)}</p>
        </div>
      </div>

      {/* Active list */}
      {borrowings.length === 0 ? (
        <p className="text-center text-[var(--text-4)] text-sm py-8">No borrowing records yet.</p>
      ) : active.length === 0 ? (
        <p className="text-center text-[var(--text-4)] text-sm py-6">All settled up!</p>
      ) : (
        <div className="space-y-2">
          {active.map((b) => (
            <BorrowingCard
              key={b.id}
              b={b}
              onEdit={onEdit}
              onDelete={handleDelete}
              onMarkRepaid={markRepaid}
            />
          ))}
        </div>
      )}

      {/* Repaid section */}
      {repaid.length > 0 && (
        <div>
          <button
            onClick={() => setShowRepaid((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors mb-2"
          >
            <ChevronDown size={13} className={`transition-transform ${showRepaid ? 'rotate-180' : ''}`} />
            {showRepaid ? 'Hide' : 'Show'} repaid ({repaid.length})
          </button>

          {showRepaid && (
            <div className="space-y-2">
              {repaid.map((b) => (
                <BorrowingCard
                  key={b.id}
                  b={b}
                  onEdit={onEdit}
                  onDelete={handleDelete}
                  onMarkRepaid={markRepaid}
                  muted
                />
              ))}
            </div>
          )}
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          open={true}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
