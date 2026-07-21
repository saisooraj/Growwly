'use client'

import { useState, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Trash2, Edit2, CheckCircle, MessageCircle,
  ChevronDown, ChevronRight,
} from 'lucide-react'
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

// ── Types ────────────────────────────────────────────────────────────────────

interface PersonGroup {
  person: string
  records: Borrowing[]
  activeLent: number
  activeBorrowed: number
  net: number
  hasActive: boolean
}

type FilterKind = 'all' | 'lent' | 'borrowed'

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildWhatsAppLink(b: Borrowing, phone?: string): string {
  const outstanding = b.amount - b.repaidAmount
  const msg = b.type === 'lent'
    ? `Hi ${b.person}, just a reminder that you owe me ₹${outstanding.toLocaleString('en-IN')}${b.description ? ` for ${b.description}` : ''}. Please let me know when you can repay. Thanks!`
    : `Hi ${b.person}, I still owe you ₹${outstanding.toLocaleString('en-IN')}${b.description ? ` for ${b.description}` : ''}. I'll arrange to repay soon.`
  const number = phone ? phone.replace(/\D/g, '') : ''
  return `https://wa.me/${number}?text=${encodeURIComponent(msg)}`
}

// Deterministic avatar color from name
const AVATAR_PALETTES = [
  { bg: 'oklch(0.82 0.12 158)', text: 'oklch(0.28 0.09 152)' },
  { bg: 'oklch(0.82 0.13 245)', text: 'oklch(0.3  0.1  245)' },
  { bg: 'oklch(0.85 0.14 75)',  text: 'oklch(0.35 0.1  60)'  },
  { bg: 'oklch(0.82 0.16 286)', text: 'oklch(0.32 0.12 286)' },
  { bg: 'oklch(0.82 0.18 358)', text: 'oklch(0.34 0.12 358)' },
  { bg: 'oklch(0.82 0.14 200)', text: 'oklch(0.3  0.1  200)' },
]
function avatarPalette(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length]
}

// ── Individual record row ────────────────────────────────────────────────────

function RecordRow({ b, onEdit, onDelete, onMarkRepaid }: {
  b: Borrowing
  onEdit: (b: Borrowing) => void
  onDelete: (id: string) => void
  onMarkRepaid: (b: Borrowing) => void
}) {
  const isBorrowed  = b.type === 'borrowed'
  const isRepaid    = b.status === 'repaid'
  const outstanding = b.amount - b.repaidAmount
  const progress    = b.amount > 0 ? Math.min((b.repaidAmount / b.amount) * 100, 100) : 0

  const { transactions, contacts } = useAppStore()
  const contactPhone = useMemo(() =>
    contacts.find(c => c.name.toLowerCase() === b.person.toLowerCase())?.phone,
    [contacts, b.person]
  )
  const linkedTxs = useMemo(() =>
    transactions.filter(t =>
      (t.borrowingId === b.id && t.transferKind !== 'loan_given') ||
      t.settledBorrowingId === b.id
    ),
    [transactions, b.id]
  )

  const accentColor = isBorrowed ? 'var(--bad)'      : 'var(--good)'
  const accentSoft  = isBorrowed ? 'var(--bad-soft)'  : 'var(--good-soft)'
  const accentInk   = isBorrowed ? 'var(--bad-ink)'   : 'var(--good-ink)'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '12px 14px', borderRadius: 12,
      background: isRepaid ? 'var(--surface-2)' : 'var(--surface)',
      border: `1px solid ${isRepaid ? 'transparent' : 'var(--border)'}`,
      opacity: isRepaid ? 0.6 : 1,
      transition: 'opacity .2s',
      position: 'relative',
    }}>
      {/* Left accent strip */}
      {!isRepaid && (
        <div style={{
          position: 'absolute', left: 0, top: 8, bottom: 8, width: 3,
          borderRadius: 999, background: accentColor,
        }} />
      )}

      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingLeft: isRepaid ? 0 : 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Description */}
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
            {b.description || (isBorrowed ? 'Borrowed' : 'Lent')}
          </div>
          {/* Meta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
              background: isRepaid ? 'var(--surface-3)' : accentSoft,
              color: isRepaid ? 'var(--text-4)' : accentInk,
            }}>
              {isRepaid ? 'Settled' : isBorrowed ? 'You owe' : 'Owed to you'}
            </span>
            {b.status === 'partial' && (
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--info-soft)', color: 'var(--info-ink)' }}>
                Partial
              </span>
            )}
            <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
              {format(parseISO(b.date), 'dd MMM yyyy')}
              {b.dueDate && ` · due ${format(parseISO(b.dueDate), 'dd MMM')}`}
            </span>
          </div>
        </div>

        {/* Amount + actions */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: isRepaid ? 'var(--text-3)' : accentInk, letterSpacing: '-0.02em' }}>
              {formatCurrencyFull(b.amount)}
            </div>
            {b.repaidAmount > 0 && b.repaidAmount < b.amount && (
              <div style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 1 }}>
                {formatCurrencyFull(outstanding)} left
              </div>
            )}
          </div>

          {/* Action buttons */}
          {!isRepaid && (
            <div style={{ display: 'flex', gap: 2 }}>
              <button
                onClick={() => onMarkRepaid(b)}
                title="Mark repaid"
                style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--good-soft)'; e.currentTarget.style.color = 'var(--good-ink)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-4)' }}
              >
                <CheckCircle size={13} />
              </button>
              <a
                href={buildWhatsAppLink(b, contactPhone)}
                target="_blank" rel="noopener noreferrer"
                title="WhatsApp reminder"
                style={{ width: 26, height: 26, borderRadius: 7, background: 'transparent', color: 'var(--text-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--good-soft)'; (e.currentTarget as HTMLElement).style.color = 'var(--good-ink)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-4)' }}
              >
                <MessageCircle size={13} />
              </a>
              <button
                onClick={() => onEdit(b)}
                style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Edit2 size={13} />
              </button>
              <button
                onClick={() => onDelete(b.id)}
                style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bad-soft)'; e.currentTarget.style.color = 'var(--bad-ink)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-4)' }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
          {isRepaid && (
            <button
              onClick={() => onDelete(b.id)}
              style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bad-soft)'; e.currentTarget.style.color = 'var(--bad-ink)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-4)' }}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Partial repayment bar */}
      {b.amount > 0 && b.repaidAmount > 0 && b.repaidAmount < b.amount && (
        <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden', marginLeft: isRepaid ? 0 : 8 }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--good)', borderRadius: 999, transition: 'width .4s ease' }} />
        </div>
      )}

      {/* Linked settlement transactions */}
      {linkedTxs.length > 0 && (
        <div style={{
          borderTop: '1px solid var(--border)',
          marginTop: 4, paddingTop: 8,
          marginLeft: isRepaid ? 0 : 8,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', letterSpacing: '0.06em', marginBottom: 2 }}>
            SETTLEMENTS
          </div>
          {linkedTxs.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}>
                {t.settledBorrowingId && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'var(--warn-soft)', color: 'var(--warn-ink)', flexShrink: 0 }}>
                    expense
                  </span>
                )}
                <span style={{ fontSize: 11.5, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.settledBorrowingId
                    ? (t.category ? `${t.category}${t.notes ? ` · ${t.notes}` : ''}` : t.notes || 'Expense')
                    : (t.notes || (b.type === 'lent' ? 'Repayment received' : 'Repayment made'))
                  }
                </span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--good-ink)', flexShrink: 0 }}>
                {formatCurrencyFull(t.amount)} · {format(parseISO(t.date), 'dd MMM')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Person group row ─────────────────────────────────────────────────────────

function PersonGroupRow({ group, onEdit, onDelete, onMarkRepaid, defaultOpen = false }: {
  group: PersonGroup
  onEdit: (b: Borrowing) => void
  onDelete: (id: string) => void
  onMarkRepaid: (b: Borrowing) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const pal = avatarPalette(group.person)

  // Per-person net balance
  const netPositive = group.net > 0   // they owe you
  const netNegative = group.net < 0   // you owe them
  const netAbs = Math.abs(group.net)

  const netColor = netPositive ? 'var(--good-ink)' : netNegative ? 'var(--bad-ink)' : 'var(--text-3)'
  const netBg    = netPositive ? 'var(--good-soft)' : netNegative ? 'var(--bad-soft)' : 'var(--surface-2)'

  // Split active vs repaid
  const activeRecords = group.records.filter(r => r.status !== 'repaid')
  const repaidRecords = group.records.filter(r => r.status === 'repaid')
  const [showRepaid, setShowRepaid] = useState(false)

  return (
    <div style={{
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      boxShadow: 'var(--elev)',
      overflow: 'hidden',
    }}>
      {/* ── Person header row (always visible) ── */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
          transition: 'background .12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        {/* Avatar */}
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: pal.bg, color: pal.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em',
        }}>
          {group.person[0]?.toUpperCase()}
        </div>

        {/* Name + breakdown */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
            {group.person}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {group.activeLent > 0 && (
              <span style={{ color: 'var(--good-ink)' }}>
                Lent {formatCurrencyFull(group.activeLent)}
              </span>
            )}
            {group.activeBorrowed > 0 && (
              <span style={{ color: 'var(--bad-ink)' }}>
                Owe {formatCurrencyFull(group.activeBorrowed)}
              </span>
            )}
            {group.records.length > 0 && (
              <span>
                {group.records.length} record{group.records.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Net balance pill */}
        {group.hasActive && (
          <div style={{
            padding: '4px 12px', borderRadius: 999, flexShrink: 0,
            background: netBg, color: netColor, fontSize: 13, fontWeight: 800,
            letterSpacing: '-0.02em',
          }}>
            {netPositive ? '+' : netNegative ? '−' : ''}{formatCurrencyFull(netAbs)}
          </div>
        )}
        {!group.hasActive && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
            background: 'var(--surface-2)', color: 'var(--text-3)',
          }}>
            Settled
          </span>
        )}

        {/* Chevron */}
        <ChevronDown
          size={16}
          style={{
            color: 'var(--text-3)', flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform .22s cubic-bezier(.22,1,.36,1)',
          }}
        />
      </button>

      {/* ── Expanded records ── */}
      {open && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '12px 14px',
          display: 'flex', flexDirection: 'column', gap: 8,
          background: 'var(--bg)',
        }}>
          {activeRecords.length === 0 && repaidRecords.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-4)', textAlign: 'center', padding: '8px 0' }}>No records</p>
          )}

          {/* Active records */}
          {activeRecords.map(b => (
            <RecordRow key={b.id} b={b} onEdit={onEdit} onDelete={onDelete} onMarkRepaid={onMarkRepaid} />
          ))}

          {/* Settled records toggle */}
          {repaidRecords.length > 0 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); setShowRepaid(v => !v) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 12, fontWeight: 600, color: 'var(--text-4)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px',
                  fontFamily: 'inherit', alignSelf: 'flex-start',
                }}
              >
                <ChevronRight
                  size={12}
                  style={{ transform: showRepaid ? 'rotate(90deg)' : 'none', transition: 'transform .18s' }}
                />
                {showRepaid ? 'Hide' : 'Show'} {repaidRecords.length} settled
              </button>
              {showRepaid && repaidRecords.map(b => (
                <RecordRow key={b.id} b={b} onEdit={onEdit} onDelete={onDelete} onMarkRepaid={onMarkRepaid} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BorrowingsList({ onEdit }: Props) {
  const { user } = useAuth()
  const { borrowings } = useAppStore()
  const refresh = useRefreshData()
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [filter, setFilter] = useState<FilterKind>('all')

  // ── Aggregate totals ─────────────────────────────────────────────────────────

  const totalBorrowed = borrowings
    .filter(b => b.type === 'borrowed' && b.status !== 'repaid')
    .reduce((s, b) => s + (b.amount - b.repaidAmount), 0)

  const totalLent = borrowings
    .filter(b => b.type === 'lent' && b.status !== 'repaid')
    .reduce((s, b) => s + (b.amount - b.repaidAmount), 0)

  // ── Group by person ──────────────────────────────────────────────────────────

  const personGroups: PersonGroup[] = useMemo(() => {
    const map = new Map<string, PersonGroup>()
    for (const b of borrowings) {
      const key = b.person.trim().toLowerCase()
      if (!map.has(key)) {
        map.set(key, {
          person: b.person.trim(),
          records: [],
          activeLent: 0,
          activeBorrowed: 0,
          net: 0,
          hasActive: false,
        })
      }
      const g = map.get(key)!
      g.records.push(b)
      if (b.status !== 'repaid') {
        const outstanding = b.amount - b.repaidAmount
        if (b.type === 'lent')     g.activeLent     += outstanding
        if (b.type === 'borrowed') g.activeBorrowed += outstanding
        g.hasActive = true
      }
      g.net = g.activeLent - g.activeBorrowed
    }

    return Array.from(map.values()).sort((a, b) => {
      // Active first, then by net descending (highest outstanding first)
      if (a.hasActive !== b.hasActive) return a.hasActive ? -1 : 1
      return Math.abs(b.net) - Math.abs(a.net)
    })
  }, [borrowings])

  // ── Filter ──────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (filter === 'all') return personGroups
    if (filter === 'lent')     return personGroups.filter(g => g.activeLent > 0)
    if (filter === 'borrowed') return personGroups.filter(g => g.activeBorrowed > 0)
    return personGroups
  }, [personGroups, filter])

  // ── Actions ──────────────────────────────────────────────────────────────────

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
          loanPerson: b.person,
          borrowingId: b.id,
        } as Parameters<typeof addTransaction>[1])
      }
      await updateBorrowing(b.id, { repaidAmount: b.amount, status: 'repaid' })
      await refresh()
      toast.success('Marked as repaid — transaction logged')
    } catch { toast.error('Failed') }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>

      {/* ── Summary cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{
          padding: '16px 18px', borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(150deg, var(--brand-deep) 0%, var(--brand) 55%, var(--brand-2) 100%)',
          boxShadow: '0 4px 20px -6px color-mix(in oklch, var(--brand) 45%, transparent)',
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>
            Owed to you
          </div>
          <div style={{ fontSize: 'clamp(20px,5vw,28px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {formatCurrencyFull(totalLent)}
          </div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', marginTop: 5 }}>
            {personGroups.filter(g => g.activeLent > 0).length} {personGroups.filter(g => g.activeLent > 0).length === 1 ? 'person owes' : 'people owe'} you
          </div>
        </div>
        <div style={{
          padding: '16px 18px', borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(150deg, var(--brand-2) 0%, var(--brand) 55%, var(--brand-deep) 100%)',
          boxShadow: '0 4px 20px -6px color-mix(in oklch, var(--brand) 45%, transparent)',
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>
            You owe
          </div>
          <div style={{ fontSize: 'clamp(20px,5vw,28px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {formatCurrencyFull(totalBorrowed)}
          </div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', marginTop: 5 }}>
            {personGroups.filter(g => g.activeBorrowed > 0).length} pending settlement{personGroups.filter(g => g.activeBorrowed > 0).length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* ── Filter tabs ── */}
      {borrowings.length > 0 && (
        <div style={{
          display: 'flex', gap: 4, padding: 4,
          background: 'var(--surface-2)', borderRadius: 12,
        }}>
          {([
            { id: 'all'      as FilterKind, label: 'All' },
            { id: 'lent'     as FilterKind, label: 'Lent' },
            { id: 'borrowed' as FilterKind, label: 'Borrowed' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 9, border: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: filter === tab.id ? 700 : 500,
                background: filter === tab.id ? 'var(--surface)' : 'transparent',
                color: filter === tab.id ? 'var(--text)' : 'var(--text-3)',
                boxShadow: filter === tab.id ? 'var(--elev)' : 'none',
                transition: 'all .15s',
                fontFamily: 'inherit',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Person groups ── */}
      {borrowings.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: 13, padding: '40px 0' }}>
          No borrowing records yet.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: 13, padding: '32px 0' }}>
          No {filter} records found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(group => (
            <PersonGroupRow
              key={group.person.toLowerCase()}
              group={group}
              onEdit={onEdit}
              onDelete={handleDelete}
              onMarkRepaid={markRepaid}
              defaultOpen={personGroups.length === 1}
            />
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmDialog open message={confirm.message} onConfirm={confirm.onConfirm} onClose={() => setConfirm(null)} />
      )}
    </div>
  )
}
