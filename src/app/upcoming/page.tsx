'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo } from 'react'
import { format, parseISO, isPast, isThisMonth, differenceInDays } from 'date-fns'
import { Plus, CalendarClock, Repeat, Pencil, Trash2, CheckCircle2 } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import AddUpcomingModal from '@/components/upcoming/AddUpcomingModal'
import LogPaymentModal from '@/components/upcoming/LogPaymentModal'
import { useAppStore } from '@/store/appStore'
import { deleteUpcoming } from '@/lib/firestore'
import { useRefreshData } from '@/hooks/useData'
import { formatCurrencyFull, CATEGORY_COLORS } from '@/lib/utils'
import type { UpcomingExpense } from '@/types'
import toast from 'react-hot-toast'

export default function UpcomingPage() {
  const { upcomingExpenses, upcomingPayments } = useAppStore()
  const refresh = useRefreshData()
  const [addOpen, setAddOpen]           = useState(false)
  const [editItem, setEditItem]         = useState<UpcomingExpense | null>(null)
  const [payItem, setPayItem]           = useState<UpcomingExpense | null>(null)

  const paidByItem = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of upcomingPayments) {
      map.set(p.upcomingId, (map.get(p.upcomingId) ?? 0) + p.amount)
    }
    return map
  }, [upcomingPayments])

  const grouped = useMemo(() => {
    const sorted = [...upcomingExpenses].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    const map = new Map<string, UpcomingExpense[]>()
    for (const item of sorted) {
      const key = item.dueDate.slice(0, 7)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return map
  }, [upcomingExpenses])

  const totalAll    = upcomingExpenses.reduce((s, i) => s + i.amount, 0)
  const totalPaid   = Array.from(paidByItem.values()).reduce((s, v) => s + v, 0)
  const totalRemain = Math.max(0, totalAll - totalPaid)

  async function handleDelete(item: UpcomingExpense) {
    if (!confirm(`Delete "${item.label}"?`)) return
    try {
      await deleteUpcoming(item.id)
      await refresh()
      toast.success('Removed')
    } catch {
      toast.error('Failed to delete')
    }
  }

  function monthLabel(ym: string) {
    try { return format(parseISO(`${ym}-01`), 'MMMM yyyy') } catch { return ym }
  }

  return (
    <AppShell title="Upcoming">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>

        {/* Header KPIs */}
        {upcomingExpenses.length > 0 && (
          <div className="grid grid-cols-3" style={{ gap: 'var(--row-gap)' }}>
            <div className="card-sm">
              <div className="h-eyebrow" style={{ marginBottom: 8 }}>Total planned</div>
              <div className="display-num" style={{ fontSize: 20, color: 'var(--text)' }}>{formatCurrencyFull(totalAll)}</div>
            </div>
            <div className="card-sm">
              <div className="h-eyebrow" style={{ marginBottom: 8 }}>Paid so far</div>
              <div className="display-num" style={{ fontSize: 20, color: 'var(--good-ink)' }}>{formatCurrencyFull(totalPaid)}</div>
            </div>
            <div className="card-sm">
              <div className="h-eyebrow" style={{ marginBottom: 8 }}>Remaining</div>
              <div className="display-num" style={{ fontSize: 20, color: totalRemain > 0 ? 'var(--bad-ink)' : 'var(--good-ink)' }}>
                {formatCurrencyFull(totalRemain)}
              </div>
            </div>
          </div>
        )}

        {/* Grouped months */}
        {grouped.size === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <CalendarClock size={32} style={{ color: 'var(--text-4)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>No upcoming expenses yet</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Jot down anything you know is coming — bills, EMIs, events.</p>
            <button onClick={() => setAddOpen(true)} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Add first item
            </button>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([ym, items]) => {
            const monthTotal   = items.reduce((s, i) => s + i.amount, 0)
            const monthPaid    = items.reduce((s, i) => s + (paidByItem.get(i.id) ?? 0), 0)
            const monthRemain  = Math.max(0, monthTotal - monthPaid)
            return (
              <div key={ym} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{monthLabel(ym)}</span>
                  <div style={{ textAlign: 'right' }}>
                    <span className="display-num" style={{ fontSize: 13, color: 'var(--text-2)' }}>{formatCurrencyFull(monthTotal)}</span>
                    {monthPaid > 0 && (
                      <span style={{ fontSize: 11.5, color: 'var(--text-3)', marginLeft: 6 }}>
                        · {formatCurrencyFull(monthRemain)} left
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 10 }}>
                  {items.map(item => (
                    <NoteCard
                      key={item.id}
                      item={item}
                      paid={paidByItem.get(item.id) ?? 0}
                      onEdit={() => setEditItem(item)}
                      onDelete={() => handleDelete(item)}
                      onLogPayment={() => setPayItem(item)}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}

      </div>

      {/* FAB */}
      <button
        onClick={() => setAddOpen(true)}
        className="fixed right-4 bottom-24 lg:right-6 lg:bottom-6 z-40 flex items-center justify-center"
        style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--text)', color: 'var(--bg)',
          border: 'none', cursor: 'pointer',
          boxShadow: 'var(--shadow-lg), 0 0 0 6px color-mix(in oklch, var(--text) 8%, transparent)',
          transition: 'transform .12s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <Plus size={24} />
      </button>

      <AddUpcomingModal open={addOpen}    onClose={() => setAddOpen(false)} />
      <AddUpcomingModal open={!!editItem} onClose={() => setEditItem(null)} editItem={editItem} />
      <LogPaymentModal  open={!!payItem}  onClose={() => setPayItem(null)}  item={payItem} alreadyPaid={payItem ? (paidByItem.get(payItem.id) ?? 0) : 0} />
    </AppShell>
  )
}

// ── NoteCard ──────────────────────────────────────────────────────────────────

interface NoteCardProps {
  item: UpcomingExpense
  paid: number
  onEdit: () => void
  onDelete: () => void
  onLogPayment: () => void
}

function NoteCard({ item, paid, onEdit, onDelete, onLogPayment }: NoteCardProps) {
  const color     = CATEGORY_COLORS[item.category ?? ''] ?? '#94a3b8'
  const due       = parseISO(item.dueDate)
  const overdue   = isPast(due) && !isThisMonth(due)
  const daysOut   = differenceInDays(due, new Date())
  const soon      = daysOut >= 0 && daysOut <= 7
  const remaining = Math.max(0, item.amount - paid)
  const pct       = item.amount > 0 ? Math.min(100, (paid / item.amount) * 100) : 0
  const fulfilled = pct >= 100

  const urgencyColor = overdue ? 'var(--bad-ink)' : soon ? 'var(--warn-ink)' : 'var(--text-3)'

  return (
    <div className="card" style={{
      display: 'flex', flexDirection: 'column', gap: 10,
      borderLeft: `3px solid ${fulfilled ? 'var(--good)' : color}`,
      opacity: fulfilled ? 0.75 : 1,
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.label}
            </span>
            {fulfilled && <CheckCircle2 size={13} style={{ color: 'var(--good)', flexShrink: 0 }} />}
          </div>
          {item.category && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{item.category}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          {item.isRecurring && <Repeat size={12} style={{ color: 'var(--brand)', marginTop: 3 }} />}
          <button onClick={onEdit}   style={{ padding: 4, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}   onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}><Pencil size={13} /></button>
          <button onClick={onDelete} style={{ padding: 4, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--bad)')}    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}><Trash2 size={13} /></button>
        </div>
      </div>

      {/* Amount + remaining */}
      <div>
        <div className="display-num" style={{ fontSize: 22, color: 'var(--text)', lineHeight: 1 }}>
          {formatCurrencyFull(item.amount)}
        </div>
        {paid > 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>
            <span style={{ color: 'var(--good-ink)', fontWeight: 500 }}>{formatCurrencyFull(paid)} paid</span>
            {!fulfilled && <span> · {formatCurrencyFull(remaining)} left</span>}
          </div>
        )}
      </div>

      {/* Progress bar — only shown once a payment exists */}
      {paid > 0 && (
        <div style={{ height: 5, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 999,
            width: `${pct}%`,
            background: fulfilled ? 'var(--good)' : 'var(--brand)',
            transition: 'width .3s ease',
          }} />
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 11.5, color: urgencyColor, fontWeight: overdue || soon ? 500 : 400 }}>
          {overdue && !fulfilled ? 'Overdue · ' : ''}{format(due, 'dd MMM yyyy')}
        </span>
        {!fulfilled && (
          <button
            onClick={onLogPayment}
            className="btn btn-sm"
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 8 }}
          >
            + Pay
          </button>
        )}
      </div>
    </div>
  )
}
