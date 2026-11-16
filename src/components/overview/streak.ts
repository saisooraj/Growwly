import { format, subDays } from 'date-fns'
import type { Transaction } from '@/types'

export type DayStatus = 'logged' | 'nospend' | 'empty'

const day = (i: number) => format(subDays(new Date(), i), 'yyyy-MM-dd')

// Consecutive days before today with something logged or marked no-spend
export function computeStreak(transactions: Transaction[], noSpend: Set<string>): number {
  const tx = new Set(transactions.map(t => t.date))
  let n = 0
  for (let i = 1; i <= 365; i++) {
    const d = day(i)
    if (tx.has(d) || noSpend.has(d)) n++
    else break
  }
  return n
}

// The last 7 days before today, oldest first
export function lastSevenDays(transactions: Transaction[], noSpend: Set<string>): { date: string; label: string; status: DayStatus }[] {
  const tx = new Set(transactions.map(t => t.date))
  return Array.from({ length: 7 }, (_, k) => {
    const i = 7 - k
    const d = day(i)
    return {
      date: d,
      label: format(subDays(new Date(), i), 'EEEEEE'),
      status: tx.has(d) ? 'logged' : noSpend.has(d) ? 'nospend' : 'empty',
    }
  })
}

// The empty days right after the streak ends: marking them no-spend restores it
export function restorableDays(transactions: Transaction[], noSpend: Set<string>, streak: number): { date: string; label: string }[] {
  const tx = new Set(transactions.map(t => t.date))
  const out: { date: string; label: string }[] = []
  for (let i = streak + 1; i <= streak + 30; i++) {
    const d = day(i)
    if (tx.has(d) || noSpend.has(d)) break
    out.push({ date: d, label: format(subDays(new Date(), i), 'EEE, d MMM') })
  }
  // Only worth offering when real data sits behind the gap, i.e. there was a streak to restore
  const hasEarlier = transactions.some(t => t.date < (out[out.length - 1]?.date ?? ''))
  return hasEarlier ? out : []
}
