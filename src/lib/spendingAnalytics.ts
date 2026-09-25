import { addDays, format, parseISO } from 'date-fns'
import type { Transaction, UserSettings } from '@/types'
import { getCycleRange } from './cycle'

export interface CategoryTrendResult {
  months: string[]                              // oldest → newest
  byCategoryByMonth: Record<string, number[]>    // category -> per-month amounts, aligned to `months`
  totalsByMonth: number[]
  totalByCategory: Record<string, number>        // sum across all months in the window
}

// Returns `count` budget-month labels ending at (and including) `endMonth`, oldest → newest.
export function getMonthsEndingAt(endMonth: string, count: number): string[] {
  const [year, month] = endMonth.split('-').map(Number)
  const out: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

// Single-pass category × month aggregation for expense/refund transactions.
//
// buildMonthlySummary/computeCarryForward compute multi-month data by scanning the
// FULL transaction array once PER MONTH (via parseISO + isWithinInterval per
// transaction) — O(months × transactions) with a Date allocation per item per month.
// Transaction dates are already ISO 'yyyy-MM-dd' strings, so instead we precompute
// each month's cycle boundaries once (O(months)) and do exactly one pass over the
// transactions, locating each one's month bucket via a binary search over the
// (sorted, contiguous) boundary strings — no date parsing, no per-month rescans.
export function buildCategoryTrend(
  transactions: Transaction[],
  months: string[],
  settings?: UserSettings | null,
): CategoryTrendResult {
  const ranges = months.map(m => getCycleRange(m, settings))
  const starts = ranges.map(r => r.start)

  const byCategoryByMonth: Record<string, number[]> = {}
  const totalsByMonth = new Array(months.length).fill(0)

  function findMonthIndex(date: string): number {
    let lo = 0
    let hi = starts.length - 1
    let ans = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (starts[mid] <= date) { ans = mid; lo = mid + 1 } else hi = mid - 1
    }
    if (ans === -1 || date > ranges[ans].end) return -1
    return ans
  }

  for (const t of transactions) {
    if (t.type !== 'expense' && t.type !== 'refund') continue
    const idx = findMonthIndex(t.date)
    if (idx === -1) continue
    const signed = t.type === 'refund' ? -t.amount : t.amount
    const arr = byCategoryByMonth[t.category] ?? (byCategoryByMonth[t.category] = new Array(months.length).fill(0))
    arr[idx] += signed
    totalsByMonth[idx] += signed
  }

  const totalByCategory: Record<string, number> = {}
  for (const [cat, arr] of Object.entries(byCategoryByMonth)) {
    totalByCategory[cat] = arr.reduce((s, v) => s + v, 0)
  }

  return { months, byCategoryByMonth, totalsByMonth, totalByCategory }
}

export interface DailySpendPoint {
  date: string
  amount: number
  byCategory: [string, number][]   // that day's categories, sorted desc by amount
}
export interface TopTransaction { id: string; date: string; category: string; amount: number; notes: string }

export interface CurrentPeriodDetail {
  dailySpend: DailySpendPoint[]       // every calendar day in [start, end], oldest → newest, 0 where no spend
  topTransactions: TopTransaction[]   // largest single expenses, sorted desc, capped at topN
  recurringTotal: number
  oneOffTotal: number
}

// One extra pass over an already-filtered transaction array (bounded to a single
// cycle via cheap string comparisons, same as buildCategoryTrend) — computes the
// daily heatmap (with a per-day category breakdown for hover), the "biggest
// expenses" list, and the recurring/one-off split together, so these page
// sections share a single scan instead of separate ones.
export function buildCurrentPeriodDetail(
  transactions: Transaction[],
  start: string,
  end: string,
  topN = 10,
): CurrentPeriodDetail {
  const dailyTotal = new Map<string, number>()
  const dailyByCategory = new Map<string, Map<string, number>>()
  const endDate = parseISO(end)
  for (let d = parseISO(start); d <= endDate; d = addDays(d, 1)) {
    const key = format(d, 'yyyy-MM-dd')
    dailyTotal.set(key, 0)
    dailyByCategory.set(key, new Map())
  }

  let recurringTotal = 0
  let oneOffTotal = 0
  const expenseTxns: TopTransaction[] = []

  for (const t of transactions) {
    if (t.type !== 'expense' && t.type !== 'refund') continue
    if (t.date < start || t.date > end) continue
    const signed = t.type === 'refund' ? -t.amount : t.amount
    dailyTotal.set(t.date, (dailyTotal.get(t.date) ?? 0) + signed)
    const catMap = dailyByCategory.get(t.date) ?? (dailyByCategory.set(t.date, new Map()), dailyByCategory.get(t.date)!)
    catMap.set(t.category, (catMap.get(t.category) ?? 0) + signed)
    if (t.isRecurring) recurringTotal += signed
    else oneOffTotal += signed
    if (t.type === 'expense') {
      expenseTxns.push({ id: t.id, date: t.date, category: t.category, amount: t.amount, notes: t.notes })
    }
  }

  expenseTxns.sort((a, b) => b.amount - a.amount)

  return {
    dailySpend: Array.from(dailyTotal.entries())
      .map(([date, amount]) => ({
        date,
        amount,
        byCategory: Array.from(dailyByCategory.get(date) ?? [])
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1]),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    topTransactions: expenseTxns.slice(0, topN),
    recurringTotal,
    oneOffTotal,
  }
}

// Splits sorted (name, value) entries into the top `max` and a "rest" bucket,
// mirroring the dashboard pie chart's top-N + "Other" pattern.
export function bucketTopSlices(
  entries: [string, number][],
  max: number,
): { top: [string, number][]; rest: [string, number][]; otherTotal: number } {
  const sorted = entries.filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a)
  const top = sorted.slice(0, max)
  const rest = sorted.slice(max)
  const otherTotal = rest.reduce((s, [, v]) => s + v, 0)
  return { top, rest, otherTotal }
}
