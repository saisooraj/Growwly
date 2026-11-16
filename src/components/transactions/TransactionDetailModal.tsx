'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Dialog } from '@headlessui/react'
import {
  X, Pencil, Trash2, Calendar, Undo2, Receipt, Handshake, Fuel, Gem, StickyNote, Tag, Folder, Repeat,
  ScanLine, Smartphone, PencilLine, ChevronRight,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { deleteTransaction, deleteBorrowing, updateProject, updateSavingsGoal, updateBorrowing, getUserAssets, updateAsset } from '@/lib/firestore'
import { useRefreshData } from '@/hooks/useData'
import { computeProjectPaid, isSavingsTransfer, EMERGENCY_FUND_VEHICLE } from '@/lib/utils'
import { getCategoryDisplayName } from '@/lib/categoryIcons'
import { applyLink, removeLink, findLinkedAsset, type LinkInput, type LinkMode } from '@/lib/holdingLinks'
import { fuelFillFor, isFuelExpense } from '@/lib/fuel'
import { useAppStore } from '@/store/appStore'
import type { Transaction } from '@/types'
import AddTransactionModal from './AddTransactionModal'
import AddBorrowingModal from '@/components/borrowings/AddBorrowingModal'
import { KIND, MONO, R, avatarStyle, initialStyle, kindOf, lookOf, pillStyle, titleOf, type ViewTx } from './txnView'
import toast from 'react-hot-toast'

/** Page-level toast: text plus an optional Undo */
export type Notify = (text: string, undo?: () => void) => void

interface Props {
  tx: Transaction | null
  onClose: () => void
  onNavigate?: (tx: Transaction) => void
  notify?: Notify
}

export function useIsDesktop() {
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const on = () => setDesktop(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return desktop
}

const fallbackNotify: Notify = (text, undo) => {
  if (!undo) { toast(text); return }
  toast(t => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 13 }}>{text}</span>
      <button onClick={() => { toast.dismiss(t.id); undo() }} style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-ink)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Undo</button>
    </div>
  ), { duration: 5000 })
}

const num = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 })

export default function TransactionDetailModal({ tx, onClose, onNavigate, notify = fallbackNotify }: Props) {
  const refresh = useRefreshData()
  const { projects, borrowings, transactions, assets, settings } = useAppStore()
  const desktop = useIsDesktop()
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirm, setConfirm] = useState(false)

  // A different transaction starts without the delete confirmation showing
  useEffect(() => { setConfirm(false) }, [tx?.id])

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
    // What was taken out of a holding, so Undo can put it back
    let unlinked: { assetId: string; restore: LinkInput; mode: LinkMode } | null = null
    let unlinkWarning: string | undefined
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
        // Take this transaction's money back out of the holding it was linked to — before
        // deleting, so a failure here leaves a transaction that can simply be re-linked.
        if (isSavingsTransfer(tx)) {
          const fresh = await getUserAssets(tx.userId)
          const asset = findLinkedAsset(fresh, tx.id)
          const removed = asset ? removeLink(asset, tx.id) : null
          if (asset && removed) {
            await updateAsset(asset.id, removed.patch)
            unlinked = { assetId: asset.id, restore: removed.restore, mode: removed.mode }
            unlinkWarning = removed.warning
          }
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
            // If the linked repayments add up to more than the record shows as
            // repaid (e.g. a double-logged close-out), deleting the surplus one
            // shouldn't reopen the record — only the part that was counted comes off.
            // (tx is already out of the store by now, so add it back in.)
            const { transactions: remainingTx } = useAppStore.getState()
            const linkedTotal = tx.amount + remainingTx
              .filter(t => t.id !== tx.id && t.borrowingId === b.id && t.transferKind === tx.transferKind)
              .reduce((s, t) => s + t.amount, 0)
            const surplus = Math.max(0, linkedTotal - b.repaidAmount)
            const toRevert = Math.max(0, tx.amount - surplus)
            const newRepaid = Math.max(0, b.repaidAmount - toRevert)
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
    if (unlinkWarning) toast(unlinkWarning, { duration: 7000 })
    if (isSyntheticBorrowing) { notify('Deleted'); return }
    // Undo re-creates the transaction if tapped within 5s
    const snapshot = { ...tx }
    const relink = unlinked
    notify('Deleted', async () => {
      try {
        const { addTransaction: addTx } = await import('@/lib/firestore')
        const { setTransactions: setTxs, transactions: currentTxs } = useAppStore.getState()
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, userId, createdAt, ...payload } = snapshot
        const newId = await addTx(userId, payload as never)
        setTxs([{ ...snapshot, id: newId }, ...currentTxs])
        if (relink) {
          const asset = (await getUserAssets(userId)).find(a => a.id === relink.assetId)
          // A gold sale's grams were never put back, so restoring it must not sell them again
          const mode = asset?.kind === 'gold_grams' && relink.restore.direction === 'out' ? 'included' : relink.mode
          const result = asset ? applyLink(asset, { ...relink.restore, transactionId: newId }, mode) : null
          if (asset && result && 'patch' in result) await updateAsset(asset.id, result.patch)
          await refresh()
        }
        notify('Restored')
      } catch { toast.error('Could not restore') }
    })
  }

  function onDeleteClick() {
    if (linkedRefunds.length > 0 && !confirm) { setConfirm(true); return }
    doDelete()
  }

  // ── What the sheet shows ──────────────────────────────────────────────────

  const view: ViewTx | null = tx
    ? isSyntheticBorrowing && linkedBorrowing
      ? { ...tx, _borrowDir: linkedBorrowing.type, _person: linkedBorrowing.person }
      : tx
    : null
  const k = view ? kindOf(view) : 'exp'
  const look = view ? lookOf(view, k) : null
  const K = KIND[k]

  const rows: { icon: ReactNode; label: string; value: ReactNode; sub?: string; go?: Transaction; list?: { text: string; meta: string; go: Transaction }[] }[] = []
  let sub: string | null = null
  if (tx && look) {
    const ic = (I: typeof Calendar) => <I size={16} color="var(--t2)" />
    rows.push({ icon: ic(Calendar), label: 'Date', value: format(parseISO(tx.date), 'EEEE, d MMMM yyyy') })
    if (isRefund) {
      rows.push(linkedOriginal
        ? { icon: ic(Undo2), label: 'Refund of', value: `${getCategoryDisplayName(linkedOriginal.category)} · ${R(linkedOriginal.amount)} on ${format(parseISO(linkedOriginal.date), 'dd MMM yyyy')} →`, go: linkedOriginal }
        : { icon: ic(Undo2), label: 'Refund of', value: 'Original transaction not found' })
    }
    if (tx.type === 'expense' && totalRefunded > 0) {
      rows.push({
        icon: ic(Receipt), label: 'Refunds',
        value: `Refunded ${R(totalRefunded)} · Net expense ${R(Math.max(0, tx.amount - totalRefunded))}`,
        list: linkedRefunds.map(r => ({ text: `+${R(r.amount)}`, meta: format(parseISO(r.date), 'dd MMM yyyy') + (r.notes?.trim() ? ` · ${r.notes.trim()}` : ''), go: r })),
      })
    }
    if (tx.settledPerson) {
      rows.push({ icon: ic(Handshake), label: 'Settled via', value: tx.settledPerson, sub: `${R(tx.settledAmount ?? tx.amount)} taken off what ${tx.settledPerson} owes you` })
    }
    if (isFuelExpense(tx) && tx.fuelLitres) {
      const vehicle = settings?.vehicles?.find(v => v.id === tx.vehicleId)?.name
        ?? (settings?.vehicles?.length === 1 ? settings.vehicles[0].name : undefined)
      const fill = fuelFillFor(transactions, settings, tx.id)
      const value = [vehicle, `${tx.fuelLitres} L${tx.fuelPricePerLitre ? ` at ₹${num(tx.fuelPricePerLitre)}/L` : ''}`, tx.fuelDiscount ? `₹${num(tx.fuelDiscount)} off` : null].filter(Boolean).join(' · ')
      const subParts = [
        tx.odometerKm ? `Odometer ${num(tx.odometerKm)} km` : null,
        fill?.km ? `${num(fill.km)} km since last fill` : null,
        fill?.kmPerLitre ? `${fill.kmPerLitre.toFixed(1)} km/l` : null,
      ].filter(Boolean)
      rows.push({ icon: ic(Fuel), label: 'Fuel fill-up', value, sub: subParts.length ? subParts.join(' · ') : undefined })
    }
    if (tx.goldGrams) {
      rows.push({ icon: ic(Gem), label: 'Gold', value: `${tx.goldGrams} g · ${tx.goldKarat ?? 22}K${tx.goldPricePerGram ? ` · ₹${num(tx.goldPricePerGram)}/g` : ''}` })
    }
    if (tx.notes?.trim()) rows.push({ icon: ic(StickyNote), label: 'Notes', value: tx.notes.trim() })
    if (tx.tags?.length) rows.push({ icon: ic(Tag), label: 'Tags', value: tx.tags.map(t => `#${t}`).join('   ') })
    const project = tx.projectId ? projects.find(p => p.id === tx.projectId) : null
    if (project) rows.push({ icon: ic(Folder), label: 'Project', value: project.name })
    if (tx.isRecurring) rows.push({ icon: ic(Repeat), label: 'Recurring', value: `Repeats monthly on day ${tx.recurringDay}` })
    if (!isSyntheticBorrowing) {
      const [SrcIcon, srcLabel] = tx.source === 'scan' || tx.source === 'share-target'
        ? [ScanLine, 'Scanned bill'] : tx.source === 'ios-shortcut' ? [Smartphone, 'iPhone Shortcut'] : [PencilLine, 'Added manually']
      rows.push({ icon: ic(SrcIcon), label: 'Source', value: srcLabel })
    }

    if (k === 'sav' || k === 'savout') {
      const holding = findLinkedAsset(assets, tx.id)
      sub = holding
        ? `${look.name} → ${holding.name || 'Gold'}`
        : look.name !== EMERGENCY_FUND_VEHICLE ? `${look.name} · not linked to a holding` : null
    }
  }

  const sheet = !desktop
  const VAL = { fontSize: 14, lineHeight: '20px', color: 'var(--t1)', overflowWrap: 'anywhere' as const }
  const refundWord = linkedRefunds.length === 1 ? 'refund' : 'refunds'

  return (
    <>
      <Dialog open={open && !editOpen} onClose={onClose} className="txn-scope" style={{ position: 'relative', zIndex: 50 }}>
        <div className="txn-anim-fade" style={{ position: 'fixed', inset: 0, background: 'var(--scrim)' }} aria-hidden />
        <div style={sheet
          ? { position: 'fixed', left: 0, right: 0, bottom: 0, maxHeight: '90%', display: 'flex' }
          : { position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: 40 }}>
          {tx && look && (
            <Dialog.Panel
              className={sheet ? 'txn-anim-sheet' : 'txn-anim-pop'}
              style={{
                display: 'flex', flexDirection: 'column', width: '100%', maxWidth: sheet ? undefined : 420,
                maxHeight: sheet ? '100%' : 'calc(100dvh - 80px)',
                background: 'var(--surface)', color: 'var(--t1)', borderRadius: sheet ? '24px 24px 0 0' : 24,
                boxShadow: 'var(--shadow-lg)', overflow: 'hidden', border: sheet ? 0 : '1px solid var(--border)',
              }}
            >
              {sheet && <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0', flex: 'none' }}><span style={{ width: 36, height: 5, borderRadius: 3, background: 'var(--s3)' }} /></div>}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 0 20px', flex: 'none' }}>
                <div style={avatarStyle(look.color, 40, 12)}>
                  {look.initial ? <span style={initialStyle(look.color)}>{look.initial}</span> : look.icon?.(18)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Dialog.Title style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', overflowWrap: 'anywhere' }}>{titleOf(k, look)}</Dialog.Title>
                  <div style={{ fontSize: 13, color: 'var(--t2)' }}>{format(parseISO(tx.date), 'EEE, d MMM')}</div>
                </div>
                <button onClick={onClose} aria-label="Close" style={{ width: 44, height: 44, borderRadius: 999, border: 0, background: 'var(--s2)', display: 'grid', placeItems: 'center', color: 'var(--t1)', flex: 'none' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: '22px 20px 18px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start', flex: 'none' }}>
                <div style={{ fontFamily: MONO, fontSize: 40, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.05, color: K.col, overflowWrap: 'anywhere' }}>
                  {K.sign}{R(tx.amount)}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={pillStyle(K.pill[1], true)}>{K.pill[0]}</span>
                  {sub && <span style={{ fontSize: 13, color: 'var(--t2)' }}>{sub}</span>}
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column' }}>
                {rows.map(r => (
                  <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '32px minmax(0,1fr)', gap: 12, padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--s2)', display: 'grid', placeItems: 'center' }}>{r.icon}</div>
                    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--t3)' }}>{r.label}</div>
                      {r.go ? (
                        <button dir="auto" onClick={() => onNavigate?.(r.go!)} style={{ ...VAL, color: 'var(--good-ink)', fontWeight: 600, background: 'none', border: 0, padding: 0, textAlign: 'left' }}>{r.value}</button>
                      ) : (
                        <div dir="auto" style={VAL}>{r.value}</div>
                      )}
                      {r.sub && <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.45 }}>{r.sub}</div>}
                      {r.list && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                          {r.list.map(it => (
                            <button key={it.go.id} className="txn-hover" onClick={() => onNavigate?.(it.go)} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '0 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--t1)', textAlign: 'left' }}>
                              <span style={{ fontFamily: MONO, fontSize: 13, color: 'var(--good-ink)', fontWeight: 600 }}>{it.text}</span>
                              <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--t2)' }}>{it.meta}</span>
                              <ChevronRight size={14} color="var(--t3)" style={{ flex: 'none' }} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {confirm && (
                <div style={{ margin: '12px 20px 0', padding: '12px 14px', borderRadius: 12, background: 'var(--bad-soft)', color: 'var(--bad-ink)', fontSize: 13, lineHeight: 1.45, fontWeight: 500, flex: 'none' }}>
                  This expense has {linkedRefunds.length} {refundWord} linked to it. Deleting removes the {refundWord} too.
                </div>
              )}

              <div style={{
                display: 'flex', gap: 10, flex: 'none', borderTop: '1px solid var(--border)', marginTop: 4,
                padding: sheet ? '14px 20px max(20px, calc(env(safe-area-inset-bottom, 0px) + 2px))' : '16px 20px 20px',
              }}>
                <button className="txn-hover" onClick={() => setEditOpen(true)} style={{ flex: 1, height: 48, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 15, fontWeight: 600, color: 'var(--t1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Pencil size={16} />Edit
                </button>
                <button onClick={onDeleteClick} disabled={deleting} style={{
                  flex: 1, height: 48, borderRadius: 12, border: confirm ? 0 : '1px solid var(--border)',
                  background: confirm ? 'var(--bad)' : 'var(--surface)', color: confirm ? '#fff' : 'var(--bad-ink)',
                  fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: deleting ? 0.6 : 1,
                }}>
                  <Trash2 size={16} />{deleting ? 'Deleting…' : confirm ? 'Delete both' : 'Delete'}
                </button>
              </div>
            </Dialog.Panel>
          )}
        </div>
      </Dialog>

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
            // Close both dialogs fully before reopening for the original — swapping `tx`
            // while the edit dialog is still mounted confuses Headless UI's outside-click
            // detection across the two portaled Dialogs and force-closes everything.
            setEditOpen(false)
            onClose()
            setTimeout(() => onNavigate?.(t), 220)
          }}
        />
      )}
    </>
  )
}
