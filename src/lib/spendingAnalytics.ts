import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
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

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Spend still to come this cycle in one category, judged from earlier cycles:
// what they spent from today's day of the cycle onwards. Medians, so one unusual
// cycle (a deposit) doesn't skew it. Capped at the usual cycle total less what's
// already spent, so a bill paid earlier than usual isn't expected a second time.
// `priorTotals` / `priorRests` hold one value per earlier cycle that had activity.
export function expectedRest(priorTotals: number[], priorRests: number[], actual: number): number {
  if (priorTotals.length === 0) return 0
  const usualRest = median(priorRests.map(v => Math.max(0, v)))
  const usualTotal = median(priorTotals.map(v => Math.max(0, v)))
  return Math.min(usualRest, Math.max(0, usualTotal - actual))
}

// Month-end spend for the cycle in progress: what's been spent so far plus, per
// category, what usually still comes (see expectedRest). Costs that land early
// (rent, a monthly grocery run) don't get stretched across the month the way a
// flat daily rate would stretch them. Without any history it falls back to this
// cycle's day-rate, leaving recurring bills out. Null unless `month` is live.
export function projectCycleSpend(
  transactions: Transaction[],
  month: string,
  settings?: UserSettings | null,
  today: string = format(new Date(), 'yyyy-MM-dd'),
): number | null {
  const months = getMonthsEndingAt(month, 4)
  const ranges = months.map(m => getCycleRange(m, settings))
  const cur = ranges[3]
  if (today < cur.start || today > cur.end) return null

  const elapsed = differenceInCalendarDays(parseISO(today), parseISO(cur.start)) + 1
  const days = differenceInCalendarDays(parseISO(cur.end), parseISO(cur.start)) + 1
  const restFrom = ranges.slice(0, 3).map(r => format(addDays(parseISO(r.start), elapsed), 'yyyy-MM-dd'))

  let spent = 0
  let recurringNow = 0
  const now: Record<string, number> = {}
  const prior: Record<string, number[]> = {}
  const rest: Record<string, number[]> = {}
  const active = [false, false, false]

  for (const t of transactions) {
    if (t.type !== 'expense' && t.type !== 'refund') continue
    if (t.date < ranges[0].start || t.date > cur.end) continue
    const signed = t.type === 'refund' ? -t.amount : t.amount
    if (t.date >= cur.start) {
      spent += signed
      now[t.category] = (now[t.category] ?? 0) + signed
      if (t.isRecurring && t.type === 'expense') recurringNow += t.amount
      continue
    }
    for (let i = 2; i >= 0; i--) {
      if (t.date < ranges[i].start || t.date > ranges[i].end) continue
      active[i] = true
      ;(prior[t.category] ?? (prior[t.category] = [0, 0, 0]))[i] += signed
      if (t.date >= restFrom[i]) (rest[t.category] ?? (rest[t.category] = [0, 0, 0]))[i] += signed
      break
    }
  }

  const priorIdx = [0, 1, 2].filter(i => active[i])
  if (priorIdx.length === 0) {
    return spent + Math.max(0, spent - recurringNow) / elapsed * (days - elapsed)
  }
  let toCome = 0
  for (const cat of Object.keys(prior)) {
    const r = rest[cat] ?? [0, 0, 0]
    toCome += expectedRest(priorIdx.map(i => prior[cat][i]), priorIdx.map(i => r[i]), Math.max(0, now[cat] ?? 0))
  }
  return spent + toCome
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
