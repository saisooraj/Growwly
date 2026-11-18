import { deleteField } from 'firebase/firestore'
import {
  addTransaction, addUpcoming, addUpcomingPayment, deleteUpcoming, deleteUpcomingPayment,
  setEmergencyFund, updateUpcoming,
} from '@/lib/firestore'
import { EMERGENCY_FUND_VEHICLE, formatCurrencyFull } from '@/lib/utils'
import type { EmergencyFund, UpcomingExpense, UpcomingPayment } from '@/types'
import { nextMonth, num } from './upView'
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

/** Adds next month's copy of a recurring item and remembers it on the original */
export async function addNextMonth(uid: string, item: UpcomingExpense): Promise<string> {
  const id = await addUpcoming(uid, {
    flowType: item.flowType ?? 'expense',
    label: item.label,
    amount: item.amount,
    dueDate: nextMonth(item.dueDate),
    isRecurring: true,
    ...(item.category ? { category: item.category } : {}),
    ...(item.projectId ? { projectId: item.projectId } : {}),
    ...(item.notes ? { notes: item.notes } : {}),
  })
  await updateUpcoming(item.id, { nextUpcomingId: id })
  return id
}

/** Deletes an item and its payments. Linked transactions stay. */
export async function deleteItem(item: UpcomingExpense, payments: UpcomingPayment[]) {
  await Promise.all(payments.map(p => deleteUpcomingPayment(p.id)))
  await deleteUpcoming(item.id)
}
