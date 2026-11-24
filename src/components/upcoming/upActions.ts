import { deleteField } from 'firebase/firestore'
import {
  addTransaction, addUpcoming, addUpcomingPayment, deleteUpcoming, deleteUpcomingPayment,
  setEmergencyFund, setUserSettings, updateUpcoming,
} from '@/lib/firestore'
import { EMERGENCY_FUND_VEHICLE, formatCurrencyFull } from '@/lib/utils'
import { buildSubscriptions, cycleOf, linkedTxnIds, nextRenewal, planLink, type Charge, type Subscription } from '@/lib/subscriptions'
import type { BillingCycle, EmergencyFund, Transaction, UpcomingExpense, UpcomingPayment } from '@/types'
import { num } from './upView'
import type { ItemDraft } from './UpcomingSheets'

/** Adds a new item, or saves edits to one (a cleared project is removed) */
export async function saveItem(uid: string, editId: string | null, f: ItemDraft) {
  const project = f.flow === 'expense' ? f.project : null
  const data = {
    flowType: f.flow,
    label: f.label.trim(),
    amount: num(f.amount),
    dueDate: f.date,
    category: f.cat as UpcomingExpense['category'],
    notes: f.notes,
    isRecurring: f.recurring,
  }
  if (editId) await updateUpcoming(editId, { ...data, projectId: project ?? (deleteField() as unknown as undefined) })
  else await addUpcoming(uid, { ...data, ...(project ? { projectId: project } : {}) })
}

export interface NewPayment {
  amount: number
  date: string
  notes: string
  toTxn: boolean         // also log an expense / income transaction
  category: string
  projectId: string | null
  efAmount: number       // part taken from the Emergency Fund (expenses only)
}

/** Logs a payment against an item, with its transaction and Emergency Fund withdrawal */
export async function logPayment(uid: string, item: UpcomingExpense, p: NewPayment, ef: EmergencyFund | null) {
  const inc = item.flowType === 'income'
  const efAmt = !inc && ef ? Math.min(p.efAmount, p.amount, ef.currentBalance) : 0
  let linkedTransactionId: string | undefined

  if (p.toTxn) {
    const efNote = efAmt > 0 ? ` (${formatCurrencyFull(efAmt)} from Emergency Fund)` : ''
    linkedTransactionId = await addTransaction(uid, {
      type: inc ? 'income' : 'expense',
      amount: p.amount,
      category: p.category || (inc ? 'Other Income' : 'Other'),
      date: p.date,
      notes: (p.notes || (inc ? `Received: ${item.label}` : `Payment towards: ${item.label}`)) + efNote,
      isRecurring: false,
      ...(!inc && p.projectId ? { projectId: p.projectId } : {}),
    })
  }

  await addUpcomingPayment(uid, {
    upcomingId: item.id,
    amount: p.amount,
    date: p.date,
    notes: p.notes,
    ...(linkedTransactionId ? { linkedTransactionId } : {}),
    ...(efAmt > 0 ? { efAmount: efAmt } : {}),
  })

  // Take it out of the fund and log an ef withdrawal transfer, so it shows in
  // transactions and offsets cashNet
  if (efAmt > 0 && ef) {
    await Promise.all([
      setEmergencyFund(uid, {
        targetAmount: ef.targetAmount,
        currentBalance: Math.max(0, ef.currentBalance - efAmt),
        usedAmount: (ef.usedAmount ?? 0) + efAmt,
        lastUpdated: new Date().toISOString(),
      }),
      addTransaction(uid, {
        type: 'transfer',
        transferKind: 'savings_withdrawal',
        savingsVehicle: EMERGENCY_FUND_VEHICLE,
        amount: efAmt,
        category: 'Other',
        date: p.date,
        notes: `EF withdrawal for: ${item.label}`,
        isRecurring: false,
      }),
    ])
  }
}

/** Closes an item left with paise owing, without touching Transactions */
export async function settleRemainder(uid: string, item: UpcomingExpense, remaining: number, date: string) {
  await addUpcomingPayment(uid, { upcomingId: item.id, amount: remaining, date, notes: 'Rounding adjustment' })
}

/** The date a recurring item repeats on next: a month on, or its subscription's billing cycle */
export const nextDueOf = (item: UpcomingExpense) => nextRenewal(item.dueDate, item.isSubscription ? cycleOf(item) : 'monthly')

/** Adds the next copy of a recurring item (next month's, or a subscription's next renewal) and remembers it on the original */
export async function addNextMonth(uid: string, item: UpcomingExpense): Promise<string> {
  const id = await addUpcoming(uid, {
    flowType: item.flowType ?? 'expense',
    label: item.label,
    amount: item.amount,
    dueDate: nextDueOf(item),
    isRecurring: true,
    ...(item.category ? { category: item.category } : {}),
    ...(item.projectId ? { projectId: item.projectId } : {}),
    ...(item.notes ? { notes: item.notes } : {}),
    // A renewal is never a trial, even when the item before it was
    ...(item.isSubscription ? { isSubscription: true, billingCycle: cycleOf(item) } : {}),
  })
  await updateUpcoming(item.id, { nextUpcomingId: id })
  return id
}

// ── Subscriptions ────────────────────────────────────────────────────────────

export interface SubDraft {
  label: string
  amount: string
  cycle: BillingCycle
  trial: boolean
  date: string      // trial end when trial is on, else the next renewal
  cat: string
  notes: string
}

type NewItem = Omit<UpcomingExpense, 'id' | 'userId' | 'createdAt'>

/** Adds a subscription, or saves edits to its current renewal (later renewals copy from it). Returns the item's id. */
export async function saveSubscription(uid: string, editId: string | null, f: SubDraft): Promise<string> {
  const data = {
    flowType: 'expense' as const,
    label: f.label.trim(),
    amount: num(f.amount),
    dueDate: f.date,
    category: f.cat,
    notes: f.notes.trim(),
    isRecurring: true,
    isSubscription: true,
    billingCycle: f.cycle,
  }
  if (editId) { await updateUpcoming(editId, { ...data, isTrial: f.trial ? true : (deleteField() as unknown as undefined) }); return editId }
  return addUpcoming(uid, { ...data, ...(f.trial ? { isTrial: true } : {}) })
}

/** A just-added subscription as a Subscription, for linking before the listener catches up */
export function freshSubscription(uid: string, id: string, f: SubDraft, today: string): Subscription {
  const item: UpcomingExpense = {
    id, userId: uid, createdAt: new Date().toISOString(), flowType: 'expense', label: f.label.trim(), amount: num(f.amount),
    dueDate: f.date, category: f.cat, notes: f.notes.trim(), isRecurring: true, isSubscription: true, billingCycle: f.cycle,
    ...(f.trial ? { isTrial: true } : {}),
  }
  return buildSubscriptions([item], [], today)[0]
}

const LINK_NOTE = 'Linked from Transactions'

/**
 * Ties old expenses to a subscription. Each one either pays a renewal already in Upcoming (when its
 * date is close) or becomes a past renewal of its own, threaded into the chain in date order. The
 * transactions themselves aren't touched, and spending totals don't change: payments only record
 * what's been paid against each renewal.
 */
export async function linkTransactions(uid: string, sub: Subscription, txns: Transaction[], payments: UpcomingPayment[]) {
  const taken = linkedTxnIds(payments)
  const plan = planLink(sub, txns.filter(t => !taken.has(t.id)), payments)
  const { head, cycle } = sub

  for (const { item, txn } of plan.attach) {
    await addUpcomingPayment(uid, { upcomingId: item.id, amount: txn.amount, date: txn.date, notes: LINK_NOTE, linkedTransactionId: txn.id })
    // What was actually charged is the real price
    if (txn.amount !== item.amount) await updateUpcoming(item.id, { amount: txn.amount })
  }

  type Node = { id: string; dueDate: string; next?: string; fresh: boolean }
  const made: Node[] = []
  for (const txn of plan.create) {
    const id = await addUpcoming(uid, {
      flowType: 'expense', label: head.label, amount: txn.amount, dueDate: txn.date,
      isRecurring: true, isSubscription: true, billingCycle: cycle, pastCharge: true,
      ...(head.category ? { category: head.category } : {}),
    })
    await addUpcomingPayment(uid, { upcomingId: id, amount: txn.amount, date: txn.date, notes: LINK_NOTE, linkedTransactionId: txn.id })
    made.push({ id, dueDate: txn.date, fresh: true })
  }
  if (!made.length && !plan.attach.length) return

  // Re-thread the chain oldest → newest; a new past charge sorts before an existing item on the same day
  const nodes: Node[] = [...made, ...sub.chain.map(it => ({ id: it.id, dueDate: it.dueDate, next: it.nextUpcomingId, fresh: false }))]
    .map((n, i) => ({ n, i }))
    .sort((a, b) => a.n.dueDate.localeCompare(b.n.dueDate) || Number(b.n.fresh) - Number(a.n.fresh) || a.i - b.i)
    .map(x => x.n)
  for (let i = 0; i < nodes.length - 1; i++) {
    if (nodes[i].next !== nodes[i + 1].id) await updateUpcoming(nodes[i].id, { nextUpcomingId: nodes[i + 1].id })
  }

  // Keep a renewal coming up when the newest renewal is now paid
  if (head.cancelledOn) return
  const last = nodes[nodes.length - 1]
  const attachedHead = plan.attach.find(a => a.item.id === head.id)
  // (only when the old newest renewal is paid too, so two unpaid renewals never pile up)
  if (last.fresh && (sub.headSettled || attachedHead)) {
    const txn = plan.create.find(t => t.date === last.dueDate)!
    await addNextMonth(uid, { ...head, id: last.id, amount: txn.amount, dueDate: last.dueDate, nextUpcomingId: undefined, isTrial: undefined, pastCharge: true })
  } else if (last.id === head.id && attachedHead && !head.nextUpcomingId) {
    await addNextMonth(uid, { ...head, amount: attachedHead.txn.amount })
  }
}

/** Takes a charge off a subscription. The transaction stays; a past renewal made by linking goes with it. */
export async function unlinkCharge(charge: Charge, sub: Subscription) {
  await deleteUpcomingPayment(charge.id)
  const idx = sub.chain.findIndex(c => c.id === charge.upcomingId)
  const item = sub.chain[idx]
  if (!item?.pastCharge || sub.charges.some(c => c.upcomingId === item.id && c.id !== charge.id)) return
  const prev = idx > 0 ? sub.chain[idx - 1] : null
  if (prev) {
    await updateUpcoming(prev.id, {
      nextUpcomingId: (item.nextUpcomingId ?? deleteField()) as unknown as undefined,
      // A cancellation recorded on this renewal moves to the one before it
      ...(item.cancelledOn ? { cancelledOn: item.cancelledOn, isRecurring: false } : {}),
    })
  }
  await deleteUpcoming(item.id)
}

/**
 * Stops a subscription. An unpaid next charge is removed from Upcoming, so it leaves every total,
 * and the cancellation is kept on the last paid renewal. With nothing paid yet (a trial cancelled
 * in time) the item is removed and handed back so the caller can offer Undo.
 */
export async function cancelSubscription(sub: Subscription, today: string): Promise<{ removed: NewItem | null }> {
  const { head, chain } = sub
  if (sub.headPaid > 0) {
    await updateUpcoming(head.id, { cancelledOn: today, isRecurring: false })
    return { removed: null }
  }
  const prev = chain.length > 1 ? chain[chain.length - 2] : null
  if (prev) {
    await updateUpcoming(prev.id, { cancelledOn: today, isRecurring: false, nextUpcomingId: deleteField() as unknown as undefined })
    await deleteUpcoming(head.id)
    return { removed: null }
  }
  await deleteUpcoming(head.id)
  const { id: _id, userId: _u, createdAt: _c, ...rest } = head
  return { removed: rest }
}

/** Puts back a subscription removed by cancelling before anything was paid */
export async function undoCancelledTrial(uid: string, item: NewItem) {
  await addUpcoming(uid, item)
}

/** Starts a cancelled subscription again: renewals resume from the one after its last charge */
export async function restoreSubscription(uid: string, sub: Subscription) {
  const { head } = sub
  await updateUpcoming(head.id, { cancelledOn: deleteField() as unknown as undefined, isRecurring: true })
  if (sub.headSettled && !head.nextUpcomingId) await addNextMonth(uid, { ...head, isRecurring: true })
}

/** Hides a spotted subscription for good ("Not a subscription") */
export async function dismissSpotted(uid: string, key: string, current: string[] | undefined) {
  if (current?.includes(key)) return
  await setUserSettings(uid, { dismissedSubscriptions: [...(current ?? []), key] })
}

/** Deletes an item and its payments. Linked transactions stay. */
export async function deleteItem(item: UpcomingExpense, payments: UpcomingPayment[]) {
  await Promise.all(payments.map(p => deleteUpcomingPayment(p.id)))
  await deleteUpcoming(item.id)
}
