import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { Transaction } from '@/types'
import { EMERGENCY_FUND_VEHICLE } from '@/lib/utils'

// What has been taken out of the emergency fund and not put back yet. Only contributions marked
// as a payback reduce it: a regular monthly top-up builds the fund, it doesn't repay a withdrawal.

/** Smaller amounts coming in (a small refund, a friend's share) don't trigger the prompt. */
export const MIN_MONEY_IN = 1000
const MONEY_IN_WINDOW_DAYS = 3

export function isEfWithdrawal(t: Transaction): boolean {
  return t.type === 'transfer' && (
    t.transferKind === 'ef_withdrawal' ||
    (t.transferKind === 'savings_withdrawal' && t.savingsVehicle === EMERGENCY_FUND_VEHICLE)
  )
}

export function isEfPayback(t: Transaction): boolean {
  return t.type === 'transfer' && t.efPayback === true && t.savingsVehicle === EMERGENCY_FUND_VEHICLE &&
    (t.transferKind === 'savings_contribution' || t.transferKind === 'savings_transfer')
}

const oldestFirst = (a: Transaction, b: Transaction) =>
  a.date.localeCompare(b.date) || (a.createdAt ?? '').localeCompare(b.createdAt ?? '')

export interface EfDebt { tx: Transaction; left: number }

export interface EfPaybackState {
  taken: number            // every withdrawal that has to come back
  repaid: number           // how much of that is back
  owed: number             // still to put back
  open: EfDebt[]           // unpaid withdrawals, oldest first
  notCounted: Transaction[] // withdrawals the user chose not to count
  oldestDays: number       // days since the oldest unpaid withdrawal
}

/** Paybacks clear the oldest withdrawal first. */
export function buildEfPayback(transactions: Transaction[], now = new Date()): EfPaybackState {
  const withdrawals = transactions.filter(isEfWithdrawal).sort(oldestFirst)
  const counted = withdrawals.filter(t => !t.efNoPayback)
  const taken = counted.reduce((s, t) => s + t.amount, 0)
  let pool = transactions.filter(isEfPayback).reduce((s, t) => s + t.amount, 0)

  const open: EfDebt[] = []
  for (const tx of counted) {
    const applied = Math.min(pool, tx.amount)
    pool -= applied
    const left = tx.amount - applied
    if (left >= 1) open.push({ tx, left })
  }
  const owed = open.reduce((s, d) => s + d.left, 0)
  return {
    taken,
    repaid: taken - owed,
    owed,
    open,
    notCounted: withdrawals.filter(t => t.efNoPayback),
    oldestDays: open.length ? Math.max(0, differenceInCalendarDays(now, parseISO(open[0].tx.date))) : 0,
  }
}

/** The newest money that arrived in the last few days, with no payback logged since. */
export function latestMoneyIn(transactions: Transaction[], now = new Date()): Transaction | null {
  const today = format(now, 'yyyy-MM-dd')
  const lastPayback = transactions.filter(isEfPayback).reduce((m, t) => ((t.createdAt ?? '') > m ? t.createdAt : m), '')
  const arrived = transactions.filter(t =>
    (t.type === 'income' || (t.type === 'transfer' && t.transferKind === 'loan_repayment_received')) &&
    t.amount >= MIN_MONEY_IN &&
    t.date <= today &&
    differenceInCalendarDays(now, parseISO(t.date)) <= MONEY_IN_WINDOW_DAYS &&
    (!lastPayback || (t.createdAt ?? '') > lastPayback),
  )
  return arrived.sort(oldestFirst).pop() ?? null
}
