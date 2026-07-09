'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo, useCallback } from 'react'
import { format, parseISO, isPast, isThisMonth, differenceInDays } from 'date-fns'
import { Plus, CalendarClock, Repeat, Pencil, Trash2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import AddUpcomingModal from '@/components/upcoming/AddUpcomingModal'
import LogPaymentModal from '@/components/upcoming/LogPaymentModal'
import { useAppStore } from '@/store/appStore'
import { deleteUpcoming, deleteUpcomingPayment } from '@/lib/firestore'
import { useRefreshData } from '@/hooks/useData'
import { formatCurrencyFull, CATEGORY_COLORS } from '@/lib/utils'
import type { UpcomingExpense, UpcomingPayment } from '@/types'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'

export default function UpcomingPage() {
  const { upcomingExpenses, upcomingPayments } = useAppStore()
  const refresh = useRefreshData()
  const [addOpen, setAddOpen]           = useState(false)
  const [editItem, setEditItem]         = useState<UpcomingExpense | null>(null)
  const [payItem, setPayItem]           = useState<UpcomingExpense | null>(null)
  const [confirm, setConfirm]           = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [spentOpen, setSpentOpen]       = useState(false)


  const paidByItem = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of upcomingPayments) {
      map.set(p.upcomingId, (map.get(p.upcomingId) ?? 0) + p.amount)
    }
    return map
  }, [upcomingPayments])

  const { pending, fulfilled } = useMemo(() => {
    const pending: UpcomingExpense[] = []
    const fulfilled: UpcomingExpense[] = []
    for (const item of upcomingExpenses) {
      const paid = paidByItem.get(item.id) ?? 0
      if (paid >= item.amount && item.amount > 0) fulfilled.push(item)
      else pending.push(item)
    }
    return { pending, fulfilled }
  }, [upcomingExpenses, paidByItem])

  const grouped = useMemo(() => {
    const sorted = [...pending].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    const map = new Map<string, UpcomingExpense[]>()
    for (const item of sorted) {
      const key = item.dueDate.slice(0, 7)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return map
  }, [pending])

  const expenses        = upcomingExpenses.filter(i => (i.flowType ?? 'expense') === 'expense')
  const incomes         = upcomingExpenses.filter(i => i.flowType === 'income')
  const totalOut        = expenses.reduce((s, i) => s + i.amount, 0)
  const totalIn         = incomes.reduce((s, i) => s + i.amount, 0)
  const expenseSettled  = expenses.reduce((s, i) => s + Math.min(i.amount, paidByItem.get(i.id) ?? 0), 0)
  const incomePending   = incomes.reduce((s, i) => s + Math.max(0, i.amount - (paidByItem.get(i.id) ?? 0)), 0)
  const incomeReceived  = totalIn - incomePending
  const allExpensesSettled = totalOut > 0 && expenseSettled >= totalOut
  const netPosition     = totalIn - totalOut

  // Expenses that are OVERDUE or due within the next 7 days (unpaid)
  const { next7Total, overdueCount, next7Items } = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() + 7)
    const items = pending.filter(i => {
      if ((i.flowType ?? 'expense') !== 'expense') return false
      const d = parseISO(i.dueDate)
      return d <= cutoff   // includes overdue (d < now) AND upcoming ≤ 7 days
    })
    const total    = items.reduce((s, i) => s + i.amount - (paidByItem.get(i.id) ?? 0), 0)
    const overdue  = items.filter(i => parseISO(i.dueDate) < now).length
    return { next7Total: total, overdueCount: overdue, next7Items: items }
  }, [pending, paidByItem])

  function handleDelete(item: UpcomingExpense) {
    setConfirm({
      message: `Delete "${item.label}"?`,
      onConfirm: async () => {
        try {
          await deleteUpcoming(item.id)
          await refresh()
          toast.success('Removed')
        } catch { toast.error('Failed to delete') }
      },
    })
  }

  function monthLabel(ym: string) {
    try { return format(parseISO(`${ym}-01`), 'MMMM yyyy') } catch { return ym }
  }

  return (
    <AppShell title="Upcoming">
      <div className="anim-page" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>

        {/* ── Hero summary card ── */}
        {upcomingExpenses.length > 0 && (
          <div style={{
            background: 'linear-gradient(150deg, var(--brand-deep) 0%, var(--brand) 55%, var(--brand-2) 100%)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--pad)',
            boxShadow: '0 8px 32px -8px var(--brand)',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Glow overlay */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(ellipse 70% 60% at 100% 0%, rgba(255,255,255,0.14) 0%, transparent 60%)',
            }} />

            <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, flexWrap: 'wrap' }}>

              {/* Left — Expense status */}
              <div style={{ flex: 1, minWidth: 130, paddingRight: totalIn > 0 ? 20 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)' }}>
                    {next7Total > 0 ? 'Due in next 7 days' : 'Expenses'}
                  </span>
                  {overdueCount > 0 && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                      background: 'rgba(255,255,255,0.22)', color: '#fff',
                      border: '1px solid rgba(255,255,255,0.35)',
                    }}>
                      {overdueCount} overdue
                    </span>
                  )}
                </div>

                {next7Total > 0 ? (
                  <div style={{ fontSize: 'clamp(28px, 5.5vw, 44px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>
                    {formatCurrencyFull(next7Total)}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                      background: 'rgba(255,255,255,0.18)', border: '1.5px solid rgba(255,255,255,0.38)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CheckCircle2 size={17} color="#fff" strokeWidth={2.2} />
                    </div>
                    <div style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                      {allExpensesSettled ? 'All settled' : 'Nothing due'}
                    </div>
                  </div>
                )}

                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>
                  {totalOut > 0
                    ? `${formatCurrencyFull(expenseSettled)} of ${formatCurrencyFull(totalOut)} logged`
                    : 'No expenses scheduled'}
                </div>
              </div>

              {/* Divider */}
              {totalIn > 0 && (
                <div style={{ width: 1, background: 'rgba(255,255,255,0.2)', margin: '2px 0', alignSelf: 'stretch', flexShrink: 0 }} />
              )}

              {/* Right — Income status */}
              {totalIn > 0 && (
                <div style={{ flex: 1, minWidth: 130, paddingLeft: 20 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', marginBottom: 8 }}>
                    Income
                  </div>

                  {incomePending > 0 ? (
                    <>
                      <div style={{ fontSize: 'clamp(28px, 5.5vw, 44px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>
                        +{formatCurrencyFull(incomePending)}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>
                        pending
                        {incomeReceived > 0 && ` · ${formatCurrencyFull(incomeReceived)} received`}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                          background: 'rgba(255,255,255,0.18)', border: '1.5px solid rgba(255,255,255,0.38)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <CheckCircle2 size={17} color="#fff" strokeWidth={2.2} />
                        </div>
                        <div style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                          All received
                        </div>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>
                        {formatCurrencyFull(totalIn)} this cycle
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Grouped months */}
        {grouped.size === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <CalendarClock size={32} style={{ color: 'var(--text-4)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>Nothing planned yet</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Track upcoming bills, EMIs, and money you expect to receive.</p>
            <button onClick={() => setAddOpen(true)} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Add first item
            </button>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([ym, items]) => {
            const mOut   = items.filter(i => (i.flowType ?? 'expense') === 'expense').reduce((s, i) => s + i.amount, 0)
            const mIn    = items.filter(i => i.flowType === 'income').reduce((s, i) => s + i.amount, 0)
            const mNet   = mIn - mOut
            const mPaid  = items.reduce((s, i) => s + (paidByItem.get(i.id) ?? 0), 0)
            return (
              <div key={ym} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{monthLabel(ym)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {mOut > 0 && (
                      <span style={{ fontSize: 11.5, color: 'var(--bad-ink)' }}>↓ {formatCurrencyFull(mOut)}</span>
                    )}
                    {mIn > 0 && (
                      <span style={{ fontSize: 11.5, color: 'var(--good-ink)' }}>↑ {formatCurrencyFull(mIn)}</span>
                    )}
                    {mOut > 0 && mIn > 0 && (
                      <span className="display-num" style={{ fontSize: 12, color: mNet >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)', fontWeight: 600 }}>
                        {mNet >= 0 ? '+' : ''}{formatCurrencyFull(mNet)}
                      </span>
                    )}
                    {mPaid > 0 && !(mOut > 0 && mIn > 0) && (
                      <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{formatCurrencyFull(mPaid)} logged</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 10 }}>
                  {items.map(item => (
                    <NoteCard
                      key={item.id}
                      item={item}
                      paid={paidByItem.get(item.id) ?? 0}
                      payments={upcomingPayments.filter(p => p.upcomingId === item.id)}
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

        {/* Spent / Fulfilled section */}
        {fulfilled.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => setSpentOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0 2px', textAlign: 'left',
              }}
            >
              <CheckCircle2 size={14} style={{ color: 'var(--good)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', flex: 1 }}>
                Spent / Received ({fulfilled.length})
              </span>
              {spentOpen
                ? <ChevronUp size={14} style={{ color: 'var(--text-3)' }} />
                : <ChevronDown size={14} style={{ color: 'var(--text-3)' }} />
              }
            </button>
            {spentOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 10 }}>
                {fulfilled.map(item => (
                  <NoteCard
                    key={item.id}
                    item={item}
                    paid={paidByItem.get(item.id) ?? 0}
                    payments={upcomingPayments.filter(p => p.upcomingId === item.id)}
                    onEdit={() => setEditItem(item)}
                    onDelete={() => handleDelete(item)}
                    onLogPayment={() => setPayItem(item)}
                  />
                ))}
              </div>
            )}
          </div>
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
      {confirm && (
        <ConfirmDialog
          open={true}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </AppShell>
  )
}

// ── NoteCard ──────────────────────────────────────────────────────────────────

interface NoteCardProps {
  item: UpcomingExpense
  paid: number
  payments: UpcomingPayment[]
  onEdit: () => void
  onDelete: () => void
  onLogPayment: () => void
}

function NoteCard({ item, paid, payments, onEdit, onDelete, onLogPayment }: NoteCardProps) {
  const refresh   = useRefreshData()
  const isIncome  = item.flowType === 'income'
  const color     = isIncome ? 'var(--good)' : (CATEGORY_COLORS[item.category ?? ''] ?? '#94a3b8')
  const due       = parseISO(item.dueDate)
  const overdue   = !isIncome && isPast(due) && !isThisMonth(due)
  const daysOut   = differenceInDays(due, new Date())
  const soon      = !isIncome && daysOut >= 0 && daysOut <= 7
  const remaining = Math.max(0, item.amount - paid)
  const pct       = item.amount > 0 ? Math.min(100, (paid / item.amount) * 100) : 0
  const fulfilled = pct >= 100

  const [showPayments, setShowPayments]   = useState(false)
  const [editPay, setEditPay]             = useState<UpcomingPayment | null>(null)
  const [deletingPay, setDeletingPay]     = useState<UpcomingPayment | null>(null)

  const urgencyColor = overdue ? 'var(--bad-ink)' : soon ? 'var(--warn-ink)' : isIncome ? 'var(--good-ink)' : 'var(--text-3)'

  async function doDeletePayment(p: UpcomingPayment) {
    try {
      await deleteUpcomingPayment(p.id)
      await refresh()
      toast.success('Entry removed')
    } catch {
      toast.error('Failed to remove')
    }
  }

  return (
    <>
    <div className="card" style={{
      display: 'flex', flexDirection: 'column', gap: 10,
      opacity: fulfilled ? 0.72 : 1,
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
        <div className="display-num" style={{ fontSize: 'clamp(16px, 5vw, 22px)', color: 'var(--text)', lineHeight: 1 }}>
          {formatCurrencyFull(item.amount)}
        </div>
        {paid > 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>
            <span style={{ color: 'var(--good-ink)', fontWeight: 500 }}>{formatCurrencyFull(paid)} {isIncome ? 'received' : 'paid'}</span>
            {!fulfilled && <span> · {formatCurrencyFull(remaining)} {isIncome ? 'pending' : 'left'}</span>}
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

      {/* Payments log toggle */}
      {payments.length > 0 && (
        <button
          onClick={() => setShowPayments(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 0', color: 'var(--text-3)', fontSize: 11.5,
          }}
        >
          {showPayments ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {payments.length} {isIncome ? 'receipt' : 'payment'}{payments.length > 1 ? 's' : ''} logged
        </button>
      )}

      {/* Expanded payments list */}
      {showPayments && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 1,
          marginTop: 2,
          borderTop: '1px solid var(--border)',
          paddingTop: 8,
        }}>
          {[...payments].sort((a, b) => b.date.localeCompare(a.date)).map(p => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 8px', borderRadius: 8,
              background: 'var(--surface-2)',
              marginBottom: 4,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="display-num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {formatCurrencyFull(p.amount)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {format(parseISO(p.date), 'dd MMM yyyy')}
                  </span>
                </div>
                {p.notes && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.notes}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                <button
                  onClick={() => setEditPay(p)}
                  style={{ padding: 4, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => setDeletingPay(p)}
                  style={{ padding: 4, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--bad)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 11.5, color: urgencyColor, fontWeight: overdue || soon ? 500 : 400 }}>
          {overdue && !fulfilled ? 'Overdue · ' : ''}{isIncome ? 'Expected by ' : ''}{format(due, 'dd MMM yyyy')}
        </span>
        {!fulfilled && (
          <button
            onClick={onLogPayment}
            className="btn btn-sm"
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 8 }}
          >
            {isIncome ? '+ Received' : '+ Pay'}
          </button>
        )}
      </div>
    </div>

    {/* Edit payment modal — self-contained per card */}
    <LogPaymentModal
      open={!!editPay}
      onClose={() => setEditPay(null)}
      item={item}
      alreadyPaid={paid}
      editPayment={editPay}
    />
    <ConfirmDialog
      open={!!deletingPay}
      message="Remove this payment entry?"
      confirmLabel="Remove"
      onConfirm={() => deletingPay && doDeletePayment(deletingPay)}
      onClose={() => setDeletingPay(null)}
    />
    </>
  )
}
