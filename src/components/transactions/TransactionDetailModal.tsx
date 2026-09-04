'use client'

import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, Edit2, Trash2, Calendar, FileText, Repeat, Folder, ArrowLeftRight, RotateCcw, ArrowRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { deleteTransaction, deleteBorrowing, updateProject, updateSavingsGoal, updateBorrowing } from '@/lib/firestore'
import { useRefreshData } from '@/hooks/useData'
import { formatCurrencyFull, CATEGORY_COLORS, getTransferDisplay, computeProjectPaid, isSavingsTransfer } from '@/lib/utils'
import { CategoryIcon, getCategoryDisplayName, getSavingsVehicleMeta } from '@/lib/categoryIcons'
import { useAppStore } from '@/store/appStore'
import type { Transaction } from '@/types'
import AddTransactionModal from './AddTransactionModal'
import AddBorrowingModal from '@/components/borrowings/AddBorrowingModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'

interface Props {
  tx: Transaction | null
  onClose: () => void
  onNavigate?: (tx: Transaction) => void
}

export default function TransactionDetailModal({ tx, onClose, onNavigate }: Props) {
  const refresh = useRefreshData()
  const { projects, savingsGoals, setSavingsGoals, borrowings, transactions } = useAppStore()
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const open = !!tx

  // Synthetic borrowing rows have a fake id like "borrow-{borrowingId}"
  const isSyntheticBorrowing = tx?.id?.startsWith('borrow-')
  const linkedBorrowing = isSyntheticBorrowing
    ? borrowings.find(b => b.id === tx!.id.replace('borrow-', ''))
    : undefined

  const isRefund = tx?.type === 'refund'
  const linkedOriginal = isRefund ? transactions.find(t => t.id === tx!.refundOf) : undefined
  const linkedRefunds = tx && tx.type === 'expense'
    ? transactions.filter(t => t.type === 'refund' && t.refundOf === tx.id)
    : []
  const totalRefunded = linkedRefunds.reduce((s, t) => s + t.amount, 0)

  async function doDelete() {
    if (!tx) return
    setDeleting(true)
    try {
      if (isSyntheticBorrowing) {
        const borrowingId = tx.id.replace('borrow-', '')
        await deleteBorrowing(borrowingId)
        const { borrowings, setBorrowings, transactions, setTransactions } = useAppStore.getState()
        setBorrowings(borrowings.filter(b => b.id !== borrowingId))
        // Also delete the linked loan_given transaction if one exists
        const linkedTx = transactions.find(t => t.borrowingId === borrowingId && t.transferKind === 'loan_given')
        if (linkedTx) {
          await deleteTransaction(linkedTx.id)
          setTransactions(transactions.filter(t => t.id !== linkedTx.id))
        }
      } else {
        // Cascade-delete any linked refunds first — the undo toast only restores the parent expense
        for (const r of linkedRefunds) {
          await deleteTransaction(r.id)
        }
        await deleteTransaction(tx.id)
        const { transactions, setTransactions, projects, setProjects } = useAppStore.getState()
        const deletedIds = new Set([tx.id, ...linkedRefunds.map(r => r.id)])
        const freshTxs = transactions.filter(t => !deletedIds.has(t.id))
        setTransactions(freshTxs)
        // Recompute project.paid now that this transaction is gone
        if (tx.projectId) {
          const paid = computeProjectPaid(freshTxs, tx.projectId)
          await updateProject(tx.projectId, { paid })
          setProjects(projects.map(p => p.id === tx.projectId ? { ...p, paid } : p))
        }
        // Reverse savings contribution from matching goal
        if (isSavingsTransfer(tx) && tx.transferKind === 'savings_contribution' && tx.savingsVehicle) {
          const { savingsGoals: goals, setSavingsGoals: setGoals } = useAppStore.getState()
          const goal = goals.find(g => g.name.trim().toLowerCase() === tx.savingsVehicle!.trim().toLowerCase())
          if (goal) {
            const newAmount = Math.max(0, goal.currentAmount - tx.amount)
            await updateSavingsGoal(goal.id, { currentAmount: newAmount })
            setGoals(goals.map(g => g.id === goal.id ? { ...g, currentAmount: newAmount } : g))
          }
        }

        const isRepayment = tx.transferKind === 'loan_repayment_received' || tx.transferKind === 'loan_repayment_paid'

        // Case 1: loan_given deleted → delete the borrowing record it created
        if (tx.transferKind === 'loan_given' && tx.borrowingId) {
          const { borrowings, setBorrowings } = useAppStore.getState()
          await deleteBorrowing(tx.borrowingId)
          setBorrowings(borrowings.filter(b => b.id !== tx.borrowingId))
        }

        // Case 2: repayment with a specific borrowingId → revert that single record
        // (covers AddBorrowingModal repayments and markRepaid from BorrowingsList)
        if (isRepayment && tx.borrowingId) {
          const { borrowings, setBorrowings } = useAppStore.getState()
          const b = borrowings.find(b => b.id === tx.borrowingId)
          if (b) {
            const newRepaid = Math.max(0, b.repaidAmount - tx.amount)
            const updated = {
              repaidAmount: newRepaid,
              status: (newRepaid <= 0 ? 'pending' : newRepaid >= b.amount ? 'repaid' : 'partial') as 'pending' | 'partial' | 'repaid',
            }
            await updateBorrowing(b.id, updated)
            setBorrowings(borrowings.map(x => x.id === b.id ? { ...x, ...updated } : x))
          }
        }

        // Case 3: repayment with loanPerson but no borrowingId → reverse greedy across all records
        // (covers AddTransactionModal repayments that may span multiple borrowing records)
        if (isRepayment && tx.loanPerson && !tx.borrowingId) {
          const borrowingType = tx.transferKind === 'loan_repayment_received' ? 'lent' : 'borrowed'
          const { borrowings, setBorrowings } = useAppStore.getState()
          const affected = borrowings
            .filter(b => b.type === borrowingType && b.repaidAmount > 0 &&
                         b.person.toLowerCase() === tx.loanPerson!.toLowerCase())
            .sort((a, b) => b.date.localeCompare(a.date))
          let remaining = tx.amount
          const updates = [...borrowings]
          for (const b of affected) {
            if (remaining <= 0) break
            const toRevert = Math.min(b.repaidAmount, remaining)
            const newRepaid = b.repaidAmount - toRevert
            const updated = {
              repaidAmount: newRepaid,
              status: (newRepaid <= 0 ? 'pending' : newRepaid >= b.amount ? 'repaid' : 'partial') as 'pending' | 'partial' | 'repaid',
            }
            await updateBorrowing(b.id, updated)
            const idx = updates.findIndex(x => x.id === b.id)
            if (idx !== -1) updates[idx] = { ...updates[idx], ...updated }
            remaining -= toRevert
          }
          setBorrowings(updates)
        }

        // Case 4: settled expense deleted → give the debt back to the "lent" records it paid down
        if (tx.settledBorrowingId || tx.settledPerson) {
          const { borrowings, setBorrowings } = useAppStore.getState()
          const plan: Record<string, number> =
            tx.settledAllocation && Object.keys(tx.settledAllocation).length
              ? tx.settledAllocation
              : tx.settledBorrowingId
                ? { [tx.settledBorrowingId]: tx.settledAmount ?? tx.amount }
                : {}
          const updates = [...borrowings]
          for (const [id, amt] of Object.entries(plan)) {
            const b = borrowings.find(x => x.id === id)
            if (!b || amt <= 0) continue
            const newRepaid = Math.max(0, b.repaidAmount - amt)
            const updated = {
              repaidAmount: newRepaid,
              status: (newRepaid <= 0 ? 'pending' : newRepaid >= b.amount ? 'repaid' : 'partial') as 'pending' | 'partial' | 'repaid',
            }
            await updateBorrowing(id, updated)
            const idx = updates.findIndex(x => x.id === id)
            if (idx !== -1) updates[idx] = { ...updates[idx], ...updated }
          }
          setBorrowings(updates)
        }
      }
    } catch {
      toast.error('Failed to delete')
      setDeleting(false)
      return
    }
    onClose()
    setDeleting(false)
    refresh().catch(() => {})
    // Show undo toast — re-creates the transaction if tapped within 5s
    const snapshot = { ...tx }
    toast(t => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13 }}>Deleted</span>
        <button
          onClick={async () => {
            toast.dismiss(t.id)
            try {
              const { addTransaction: addTx } = await import('@/lib/firestore')
              const { setTransactions: setTxs, transactions: currentTxs } = useAppStore.getState()
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { id, userId, createdAt, ...payload } = snapshot
              const newId = await addTx(userId, payload as never)
              setTxs([{ ...snapshot, id: newId }, ...currentTxs])
              toast.success('Restored')
            } catch { toast.error('Could not restore') }
          }}
          style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-ink)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Undo
        </button>
      </div>
    ), { duration: 5000, icon: '🗑️' })
  }

  function handleEdit() {
    setEditOpen(true)
  }

  if (!tx) return null

  const isTransfer = tx.type === 'transfer'
  const isIncome   = tx.type === 'income'
  const transferDisp = isTransfer ? getTransferDisplay(tx) : null
  const color = isRefund
    ? 'var(--good)'
    : isTransfer
    ? (transferDisp?.isSavings ? getSavingsVehicleMeta(tx.savingsVehicle || 'Other Savings').color : 'var(--info)')
    : (CATEGORY_COLORS[tx.category] ?? '#94a3b8')
  const project = tx.projectId ? projects.find(p => p.id === tx.projectId) : null

  const amountColor = isRefund
    ? 'var(--good-ink)'
    : isTransfer
    ? (transferDisp?.dir === 'in' ? 'var(--good)' : 'var(--text-2)')
    : isIncome ? 'var(--good-ink)' : 'var(--bad-ink)'

  const prefix = isRefund
    ? '+'
    : isTransfer
    ? (transferDisp?.dir === 'in' ? '+' : '−')
    : (isIncome ? '+' : '−')

  const typeLabel = isRefund
    ? 'Refund'
    : isTransfer
    ? (transferDisp?.label ?? 'Transfer')
    : isIncome ? 'Income' : 'Expense'

  const typePillClass = isRefund ? 'good' : isTransfer ? 'info' : isIncome ? 'good' : 'bad'

  return (
    <>
      <Transition appear show={open} as={Fragment}>
        <Dialog as="div" style={{ position: 'relative', zIndex: 50 }} onClose={onClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
            leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
          >
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
          </Transition.Child>

          <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}
               className="sm:items-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200" enterFrom="opacity-0 translate-y-4" enterTo="opacity-100 translate-y-0"
              leave="ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-4"
            >
              <Dialog.Panel style={{
                width: '100%', maxWidth: 420,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden',
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: color + '20',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isRefund
                        ? <RotateCcw size={16} style={{ color }} />
                        : isTransfer
                        ? (transferDisp?.isSavings
                            ? (() => { const m = getSavingsVehicleMeta(tx.savingsVehicle || 'Other Savings'); return <m.Icon size={16} color={m.color} stroke={1.5} /> })()
                            : <ArrowLeftRight size={16} style={{ color }} />)
                        : <CategoryIcon category={tx.category} size={16} color={color} />
                      }
                    </div>
                    <div>
                      <Dialog.Title style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>
                        {isRefund ? `${getCategoryDisplayName(tx.category)} Refund` : isTransfer ? (transferDisp?.label ?? 'Transfer') : getCategoryDisplayName(tx.category)}
                      </Dialog.Title>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                        {format(parseISO(tx.date), 'dd MMM yyyy')}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    style={{ padding: 6, borderRadius: 8, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Amount hero */}
                <div style={{
                  padding: '24px 20px 20px',
                  borderBottom: '1px solid var(--border)',
                  textAlign: 'center',
                }}>
                  <div className="display-num" style={{ fontSize: 38, color: amountColor, lineHeight: 1 }}>
                    {prefix}{formatCurrencyFull(tx.amount)}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <span className={`pill ${typePillClass}`}>
                      <span className="pill-dot" />
                      {typeLabel}
                    </span>
                  </div>
                  {isTransfer && tx.savingsVehicle && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>
                      {tx.savingsVehicle}
                    </div>
                  )}
                </div>

                {/* Details */}
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                  <Row icon={<Calendar size={14} />} label="Date">
                    {format(parseISO(tx.date), 'EEEE, dd MMMM yyyy')}
                  </Row>

                  {isRefund && (
                    <Row icon={<RotateCcw size={14} />} label="Refund of">
                      {linkedOriginal ? (
                        <button
                          onClick={() => onNavigate?.(linkedOriginal)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            fontSize: 13, color: 'var(--brand-ink)', fontWeight: 600,
                            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                          }}
                        >
                          {getCategoryDisplayName(linkedOriginal.category)} · {formatCurrencyFull(linkedOriginal.amount)} on {format(parseISO(linkedOriginal.date), 'dd MMM yyyy')}
                          <ArrowRight size={12} />
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-3)' }}>Original transaction not found</span>
                      )}
                    </Row>
                  )}

                  {tx.type === 'expense' && totalRefunded > 0 && (
                    <Row icon={<RotateCcw size={14} />} label="Refunds">
                      <span>
                        Refunded {formatCurrencyFull(totalRefunded)} · Net expense{' '}
                        <strong>{formatCurrencyFull(Math.max(0, tx.amount - totalRefunded))}</strong>
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                        {linkedRefunds.map(r => (
                          <button
                            key={r.id}
                            onClick={() => onNavigate?.(r)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              fontSize: 12, color: 'var(--good-ink)', background: 'var(--good-soft)',
                              border: 'none', borderRadius: 8, padding: '4px 8px', cursor: 'pointer',
                            }}
                          >
                            <span>{format(parseISO(r.date), 'dd MMM yyyy')}</span>
                            <span style={{ fontWeight: 600 }}>+{formatCurrencyFull(r.amount)}</span>
                          </button>
                        ))}
                      </div>
                    </Row>
                  )}

                  {tx.notes && (
                    <Row icon={<FileText size={14} />} label="Notes">
                      {tx.notes}
                    </Row>
                  )}

                  {tx.tags && tx.tags.length > 0 && (
                    <Row icon={<span style={{ fontSize: 13, fontWeight: 700 }}>#</span>} label="Tags">
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {tx.tags.map(tag => (
                          <span
                            key={tag}
                            style={{
                              fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20,
                              border: '1px solid var(--border)', color: 'var(--text-2)', background: 'var(--surface-2)',
                            }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </Row>
                  )}

                  {project && (
                    <Row icon={<Folder size={14} />} label="Project">
                      {project.name}
                    </Row>
                  )}

                  {tx.isRecurring && (
                    <Row icon={<Repeat size={14} />} label="Recurring">
                      Repeats monthly on day {tx.recurringDay}
                    </Row>
                  )}

                </div>

                {/* Actions */}
                <div style={{
                  display: 'flex', gap: 8,
                  padding: '12px 20px 20px',
                }}>
                  <button
                    onClick={handleEdit}
                    className="btn-secondary"
                    style={{ flex: 1, justifyContent: 'center', gap: 8 }}
                  >
                    <Edit2 size={14} /> Edit
                  </button>
                  <button
                    onClick={() => (linkedRefunds.length > 0 ? setDeleteConfirm(true) : doDelete())}
                    disabled={deleting}
                    className="btn-danger"
                    style={{ flex: 1, justifyContent: 'center', gap: 8 }}
                  >
                    <Trash2 size={14} />
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {isSyntheticBorrowing ? (
        <AddBorrowingModal
          open={editOpen}
          onClose={() => { setEditOpen(false); onClose() }}
          editBorrowing={linkedBorrowing ?? null}
        />
      ) : (
        <AddTransactionModal
          open={editOpen}
          onClose={() => { setEditOpen(false); onClose() }}
          editTx={tx}
          onViewOriginal={t => {
            // Close both nested dialogs fully before reopening for the original —
            // swapping `tx` while the edit dialog is still mounted confuses Headless UI's
            // outside-click detection across the two portaled Dialogs and force-closes everything.
            setEditOpen(false)
            onClose()
            setTimeout(() => onNavigate?.(t), 220)
          }}
        />
      )}

      {deleteConfirm && (
        <ConfirmDialog
          open
          message={`This expense has ${formatCurrencyFull(totalRefunded)} in linked refunds (${linkedRefunds.length}). Deleting it will also delete ${linkedRefunds.length === 1 ? 'that refund' : 'those refunds'} — this can't be undone.`}
          onConfirm={() => { setDeleteConfirm(false); doDelete() }}
          onClose={() => setDeleteConfirm(false)}
        />
      )}
    </>
  )
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
        background: 'var(--surface-2)', color: 'var(--text-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>
          {label}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
