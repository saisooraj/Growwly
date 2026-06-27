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

  const accentColor = isBorrowed ? 'var(--bad)' : 'var(--good)'
  const accentSoft  = isBorrowed ? 'var(--bad-soft)' : 'var(--good-soft)'
  const accentInk   = isBorrowed ? 'var(--bad-ink)'  : 'var(--good-ink)'

  return (
    <div style={{
      position: 'relative',
      background: 'var(--surface)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
      boxShadow: 'var(--elev)',
      opacity: muted ? 0.52 : 1,
      transition: 'opacity .2s',
    }}>
      {/* Left accent bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accentColor }} />

      <div style={{ paddingLeft: 16, paddingRight: 12, paddingTop: 12, paddingBottom: 12 }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.person}</p>
            {b.description && (
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.description}</p>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontWeight: 700, color: accentInk, margin: 0, fontSize: 14 }}>{formatCurrencyFull(b.amount)}</p>
            {b.repaidAmount > 0 && b.repaidAmount < b.amount && (
              <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 0' }}>{formatCurrencyFull(b.repaidAmount)} repaid</p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {b.amount > 0 && b.repaidAmount > 0 && (
          <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--good)', borderRadius: 999, transition: 'width .4s ease' }} />
          </div>
        )}

        {/* Bottom row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: accentSoft, color: accentInk }}>
              {isBorrowed ? 'You owe' : 'Owed to you'}
            </span>
            {b.status === 'partial' && (
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--info-soft)', color: 'var(--info-ink)' }}>
                Partial
              </span>
            )}
            <span style={{ fontSize: 10.5, color: 'var(--text-4)' }}>
              {format(parseISO(b.date), 'dd MMM yyyy')}
              {b.dueDate && ` · due ${format(parseISO(b.dueDate), 'dd MMM')}`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            {b.status !== 'repaid' && (
              <>
                <button
                  onClick={() => onMarkRepaid(b)}
                  title="Mark repaid"
                  style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--good-soft)'; e.currentTarget.style.color = 'var(--good-ink)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-4)' }}
                >
                  <CheckCircle size={14} />
                </button>
                <a
                  href={buildWhatsAppLink(b)}
                  target="_blank" rel="noopener noreferrer"
                  title="WhatsApp reminder"
                  style={{ width: 28, height: 28, borderRadius: 8, background: 'transparent', color: 'var(--text-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--good-soft)'; (e.currentTarget as HTMLElement).style.color = 'var(--good-ink)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-4)' }}
                >
                  <MessageCircle size={14} />
                </a>
              </>
            )}
            <button
              onClick={() => onEdit(b)}
              style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={() => onDelete(b.id)}
              style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bad-soft)'; e.currentTarget.style.color = 'var(--bad-ink)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-4)' }}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-lg)', background: 'var(--bad-soft)' }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--bad-ink)', margin: '0 0 6px' }}>You Owe</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--bad-ink)', margin: 0, letterSpacing: '-0.02em' }}>{formatCurrencyFull(totalBorrowed)}</p>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-lg)', background: 'var(--good-soft)' }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--good-ink)', margin: '0 0 6px' }}>Owed to You</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--good-ink)', margin: 0, letterSpacing: '-0.02em' }}>{formatCurrencyFull(totalLent)}</p>
        </div>
      </div>

      {/* Active list */}
      {borrowings.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: 13, padding: '32px 0' }}>No borrowing records yet.</p>
      ) : active.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: 13, padding: '24px 0' }}>All settled up!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {active.map((b) => (
            <BorrowingCard key={b.id} b={b} onEdit={onEdit} onDelete={handleDelete} onMarkRepaid={markRepaid} />
          ))}
        </div>
      )}

      {/* Repaid section */}
      {repaid.length > 0 && (
        <div>
          <button
            onClick={() => setShowRepaid((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: 8, fontFamily: 'inherit' }}
          >
            <ChevronDown size={13} style={{ transform: showRepaid ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            {showRepaid ? 'Hide' : 'Show'} repaid ({repaid.length})
          </button>

          {showRepaid && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {repaid.map((b) => (
                <BorrowingCard key={b.id} b={b} onEdit={onEdit} onDelete={handleDelete} onMarkRepaid={markRepaid} muted />
              ))}
            </div>
          )}
        </div>
      )}

      {confirm && (
        <ConfirmDialog open message={confirm.message} onConfirm={confirm.onConfirm} onClose={() => setConfirm(null)} />
      )}
    </div>
  )
}
