'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo } from 'react'
import { format, parseISO, isPast, isThisMonth, differenceInDays } from 'date-fns'
import { Plus, CalendarClock, Repeat, Pencil, Trash2 } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import AddUpcomingModal from '@/components/upcoming/AddUpcomingModal'
import { useAppStore } from '@/store/appStore'
import { deleteUpcoming } from '@/lib/firestore'
import { useRefreshData } from '@/hooks/useData'
import { formatCurrencyFull, CATEGORY_COLORS } from '@/lib/utils'
import type { UpcomingExpense } from '@/types'
import toast from 'react-hot-toast'

export default function UpcomingPage() {
  const { upcomingExpenses } = useAppStore()
  const refresh = useRefreshData()
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState<UpcomingExpense | null>(null)

  // Group by month
  const grouped = useMemo(() => {
    const sorted = [...upcomingExpenses].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    const map = new Map<string, UpcomingExpense[]>()
    for (const item of sorted) {
      const key = item.dueDate.slice(0, 7) // YYYY-MM
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return map
  }, [upcomingExpenses])

  const totalAll = upcomingExpenses.reduce((s, i) => s + i.amount, 0)

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

        {/* Header KPI */}
        {upcomingExpenses.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3" style={{ gap: 'var(--row-gap)' }}>
            <div className="card-sm">
              <div className="h-eyebrow" style={{ marginBottom: 8 }}>Total planned</div>
              <div className="display-num" style={{ fontSize: 22, color: 'var(--text)' }}>{formatCurrencyFull(totalAll)}</div>
            </div>
            <div className="card-sm">
              <div className="h-eyebrow" style={{ marginBottom: 8 }}>Items</div>
              <div className="display-num" style={{ fontSize: 22, color: 'var(--text)' }}>{upcomingExpenses.length}</div>
            </div>
            <div className="card-sm hidden sm:block">
              <div className="h-eyebrow" style={{ marginBottom: 8 }}>Recurring</div>
              <div className="display-num" style={{ fontSize: 22, color: 'var(--text)' }}>
                {upcomingExpenses.filter(i => i.isRecurring).length}
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
            const monthTotal = items.reduce((s, i) => s + i.amount, 0)
            return (
              <div key={ym} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Month header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{monthLabel(ym)}</span>
                  <span className="display-num" style={{ fontSize: 13, color: 'var(--text-2)' }}>{formatCurrencyFull(monthTotal)}</span>
                </div>

                {/* Sticky-note cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 10 }}>
                  {items.map(item => <NoteCard key={item.id} item={item} onEdit={() => setEditItem(item)} onDelete={() => handleDelete(item)} />)}
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

      <AddUpcomingModal open={addOpen} onClose={() => setAddOpen(false)} />
      <AddUpcomingModal open={!!editItem} onClose={() => setEditItem(null)} editItem={editItem} />
    </AppShell>
  )
}

function NoteCard({ item, onEdit, onDelete }: { item: UpcomingExpense; onEdit: () => void; onDelete: () => void }) {
  const color   = CATEGORY_COLORS[item.category ?? ''] ?? '#94a3b8'
  const due     = parseISO(item.dueDate)
  const overdue = isPast(due) && !isThisMonth(due)
  const daysOut = differenceInDays(due, new Date())
  const soon    = daysOut >= 0 && daysOut <= 7

  const urgencyColor = overdue ? 'var(--bad-ink)' : soon ? 'var(--warn-ink)' : 'var(--text-3)'

  return (
    <div
      className="card"
      style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        borderLeft: `3px solid ${color}`,
        position: 'relative',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.label}
          </div>
          {item.category && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{item.category}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {item.isRecurring && (
            <span title="Repeats monthly">
              <Repeat size={12} style={{ color: 'var(--brand)', marginTop: 2 }} />
            </span>
          )}
          <button
            onClick={onEdit}
            style={{ padding: 4, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={onDelete}
            style={{ padding: 4, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--bad)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Amount */}
      <div className="display-num" style={{ fontSize: 22, color: 'var(--text)', lineHeight: 1 }}>
        {formatCurrencyFull(item.amount)}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 11.5, color: urgencyColor, fontWeight: overdue || soon ? 500 : 400 }}>
          {overdue ? 'Overdue · ' : ''}{format(due, 'dd MMM yyyy')}
        </span>
        {item.notes && (
          <span style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50%' }}>
            {item.notes}
          </span>
        )}
      </div>
    </div>
  )
}
