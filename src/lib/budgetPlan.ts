import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { Budget, Transaction, UserSettings } from '@/types'
import { getCycleRange } from './cycle'
import { EMERGENCY_FUND_VEHICLE, EXPENSE_CATEGORIES, SAVINGS_VEHICLES, getTransferDisplay, isSavingsTransfer } from './utils'
import { getMonthsEndingAt } from './spendingAnalytics'

// ── Defaults ───────────────────────────────────────────────────────────────────

export const DEFAULT_RULE = { needs: 50, wants: 30, savings: 20 }

export const DEFAULT_NEEDS = [
  'Food & Dining', 'Groceries', 'Transport', 'Fuel', 'Healthcare',
  'Utilities', 'Insurance', 'Rent / Deposit', 'Living Expenses',
  'Home & Maintenance', 'Education', 'Family',
]
export const DEFAULT_SAVINGS = [
  'Gold', 'Construction',
]

export type Bucket = 'needs' | 'wants' | 'savings'
export const BUCKETS: Bucket[] = ['needs', 'wants', 'savings']

// A budget doc is either a spending limit on an expense category (no kind) or a
// savings plan for a vehicle (kind 'savings'). Anything that treats budgets as
// spending limits must skip savings plans.
export type PlanKind = 'expense' | 'savings'

export function isSavingsPlan(b: Pick<Budget, 'kind'>): boolean {
  return b.kind === 'savings'
}

export function planKey(kind: PlanKind, name: string): string {
  return `${kind}:${name}`
}

// ── Plan model ─────────────────────────────────────────────────────────────────

export type RowStatus =
  | 'none'    // no budget set
  | 'ok'      // spending, within plan and on pace
  | 'ahead'   // spending faster than the cycle is passing
  | 'over'    // spent more than planned
  | 'paid'    // plan was all fixed costs and they're posted
  | 'short'   // savings: still below the plan
  | 'saved'   // savings: plan met or beaten

export interface PlanRow {
  key: string
  name: string
  kind: PlanKind        // how the budget is stored; merged rows (e.g. Gold) are 'expense'
  isVehicle: boolean    // show the savings-vehicle icon
  bucket: Bucket
  planned: number       // 0 = no budget
  actual: number
  recurring: number     // part of `actual` from recurring transactions
  lastMonth: number
  avg3: number          // 3-month average, rounded to ₹100
  paceMark: number | null  // 0–1 position on the bar where spend should be today
  status: RowStatus
  visible: boolean      // has a plan or any recent activity
}

export interface PlanGroup {
  bucket: Bucket
  rows: PlanRow[]       // visible rows, planned first then by activity
  hidden: PlanRow[]     // rows with no plan and no recent activity
  planned: number
  actual: number
  targetPct: number
  target: number        // targetPct of income, in ₹
}

export interface PlanCycle {
  start: string
  end: string
  days: number
  elapsed: number       // days passed including today (0 for a future cycle)
  daysLeft: number      // days remaining including today
  phase: 'past' | 'live' | 'future'
  pace: number          // 0–1 share of the cycle that has passed
}

export interface BudgetPlan {
  cycle: PlanCycle
  income: { amount: number; source: 'actual' | 'target' | 'last' | 'none' }
  rule: { needs: number; wants: number; savings: number }
  groups: PlanGroup[]
  totals: {
    spendPlanned: number      // needs + wants plans
    spendBudgeted: number     // spent in categories that have a plan
    spendUnbudgeted: number   // spent in needs/wants categories with no plan
    left: number              // spendPlanned − spendBudgeted
    savePlanned: number
    saved: number             // actual in savings rows that have a plan
    forecast: number | null   // projected budgeted spend at cycle end
  }
  suggestions: {
    avgRows: PlanRow[]        // visible rows with no plan but a 3-month average
    avgTotal: number
    prevMonth: string
    prevRows: { row: PlanRow; planned: number }[]   // rows planned last month but not this month
    prevTotal: number
  }
}

function roundSuggestion(n: number): number {
  if (n <= 0) return 0
  return Math.max(100, Math.round(n / 100) * 100)
}

function vehicleOf(t: Transaction): string {
  return t.savingsVehicle || (t.transferKind === 'ef_withdrawal' ? EMERGENCY_FUND_VEHICLE : 'Other Savings')
}

// Builds the whole planning view for one budget month in a single pass over the
// transactions: this cycle plus the three before it (for "last month" and the
// 3-month average suggestions).
export function buildBudgetPlan(
  transactions: Transaction[],
  budgets: Budget[],
  settings: UserSettings | null | undefined,
  month: string,
  today: string = format(new Date(), 'yyyy-MM-dd'),
): BudgetPlan {
  const rule = settings?.spendingRule ?? DEFAULT_RULE
  const needsSet = new Set(settings?.categoryBuckets?.needs ?? DEFAULT_NEEDS)
  const savingsSet = new Set(settings?.categoryBuckets?.savings ?? DEFAULT_SAVINGS)

  // ── Cycle ──
  const months = getMonthsEndingAt(month, 4)      // [m-3, m-2, m-1, m]
  const ranges = months.map(m => getCycleRange(m, settings))
  const cur = ranges[3]
  const days = differenceInCalendarDays(parseISO(cur.end), parseISO(cur.start)) + 1
  const phase: PlanCycle['phase'] = today < cur.start ? 'future' : today > cur.end ? 'past' : 'live'
  const elapsed = phase === 'future' ? 0
    : phase === 'past' ? days
    : differenceInCalendarDays(parseISO(today), parseISO(cur.start)) + 1
  const cycle: PlanCycle = {
    start: cur.start, end: cur.end, days, elapsed,
    daysLeft: days - elapsed + (phase === 'live' ? 1 : 0),
    phase, pace: days > 0 ? elapsed / days : 0,
  }

  // ── One pass: per-month category spend, vehicle net savings, income ──
  const catByMonth: Record<string, number[]> = {}
  const vehByMonth: Record<string, number[]> = {}
  const recurringByCat: Record<string, number> = {}
  const income = [0, 0, 0, 0]
  const active = [false, false, false, false]

  for (const t of transactions) {
    if (t.date < ranges[0].start || t.date > cur.end) continue
    let i = -1
    for (let k = 3; k >= 0; k--) {
      if (t.date >= ranges[k].start && t.date <= ranges[k].end) { i = k; break }
    }
    if (i === -1) continue
    active[i] = true

    if (t.type === 'income') {
      income[i] += t.amount
    } else if (t.type === 'expense' || t.type === 'refund') {
      const signed = t.type === 'refund' ? -t.amount : t.amount
      const arr = catByMonth[t.category] ?? (catByMonth[t.category] = [0, 0, 0, 0])
      arr[i] += signed
      if (i === 3 && t.isRecurring && t.type === 'expense') {
        recurringByCat[t.category] = (recurringByCat[t.category] ?? 0) + t.amount
      }
    } else if (isSavingsTransfer(t)) {
      const v = vehicleOf(t)
      const arr = vehByMonth[v] ?? (vehByMonth[v] = [0, 0, 0, 0])
      arr[i] += getTransferDisplay(t).dir === 'out' ? t.amount : -t.amount
    }
  }

  // Average over the prior months that have any activity, so a new user's first
  // month isn't divided by three.
  const activePrior = Math.max(1, active.slice(0, 3).filter(Boolean).length)

  // ── Plans for this month and last ──
  const prevMonth = months[2]
  const planned: Record<string, number> = {}
  const prevPlanned: Record<string, number> = {}
  for (const b of budgets) {
    if (b.planned <= 0) continue
    const key = planKey(isSavingsPlan(b) ? 'savings' : 'expense', b.category)
    if (b.month === month) planned[key] = b.planned
    else if (b.month === prevMonth) prevPlanned[key] = b.planned
  }
  const plannedNames = (kind: PlanKind) => [...Object.keys(planned), ...Object.keys(prevPlanned)]
    .filter(k => k.startsWith(`${kind}:`))
    .map(k => k.slice(kind.length + 1))

  // ── Row universe ──
  const categories = Array.from(new Set([
    ...EXPENSE_CATEGORIES,
    ...(settings?.customCategories ?? []),
    ...Object.keys(catByMonth),
    ...plannedNames('expense'),
  ]))
  const vehicles = new Set([
    ...SAVINGS_VEHICLES,
    ...(settings?.customSavingsVehicles ?? []),
    ...Object.keys(vehByMonth),
    ...plannedNames('savings'),
  ])

  const zero = [0, 0, 0, 0]
  const rows: PlanRow[] = []

  function addRow(name: string, kind: PlanKind, isVehicle: boolean, bucket: Bucket, byMonth: number[], recurring: number) {
    const key = planKey(kind, name)
    const p = planned[key] ?? 0
    const actual = Math.max(0, byMonth[3])
    const lastMonth = Math.max(0, byMonth[2])
    const avg3 = roundSuggestion((Math.max(0, byMonth[0]) + Math.max(0, byMonth[1]) + lastMonth) / activePrior)

    let status: RowStatus = 'none'
    let paceMark: number | null = null
    if (p > 0 && bucket === 'savings') {
      status = actual >= p ? 'saved' : 'short'
    } else if (p > 0) {
      // Recurring costs land whenever they're due, so only the variable part of the
      // plan is expected to track the calendar.
      const fixed = Math.min(recurring, p)
      const variable = p - fixed
      const variableSpent = Math.max(0, actual - recurring)
      if (phase !== 'future') paceMark = Math.min(1, (fixed + variable * cycle.pace) / p)
      if (actual > p) status = 'over'
      else if (variable <= 0) status = 'paid'
      else if (phase === 'live' && variableSpent / variable > cycle.pace + 0.1) status = 'ahead'
      else status = 'ok'
    }

    rows.push({
      key, name, kind, isVehicle, bucket,
      planned: p, actual, recurring, lastMonth, avg3, paceMark, status,
      visible: p > 0 || actual > 0 || avg3 > 0 || (prevPlanned[key] ?? 0) > 0,
    })
  }

  for (const cat of categories) {
    const bucket: Bucket = needsSet.has(cat) ? 'needs' : savingsSet.has(cat) ? 'savings' : 'wants'
    const catMonths = catByMonth[cat] ?? zero
    // A savings-bucket category that is also a savings vehicle (Gold) is one row:
    // buying gold as an expense and moving cash into Gold both count toward it.
    if (bucket === 'savings' && vehicles.has(cat)) {
      vehicles.delete(cat)
      const vehMonths = vehByMonth[cat] ?? zero
      addRow(cat, 'expense', true, bucket, catMonths.map((v, i) => v + vehMonths[i]), recurringByCat[cat] ?? 0)
    } else {
      addRow(cat, 'expense', false, bucket, catMonths, recurringByCat[cat] ?? 0)
    }
  }
  for (const v of Array.from(vehicles)) {
    addRow(v, 'savings', true, 'savings', vehByMonth[v] ?? zero, 0)
  }

  // ── Income: this cycle's, else the target from settings, else last cycle's ──
  const incomeInfo: BudgetPlan['income'] =
    income[3] > 0 ? { amount: income[3], source: 'actual' }
    : (settings?.monthlyIncomeTarget ?? 0) > 0 ? { amount: settings!.monthlyIncomeTarget, source: 'target' }
    : income[2] > 0 ? { amount: income[2], source: 'last' }
    : { amount: 0, source: 'none' }

  // ── Groups ──
  const groups: PlanGroup[] = BUCKETS.map(bucket => {
    const all = rows.filter(r => r.bucket === bucket)
    const visible = all
      .filter(r => r.visible)
      .sort((a, b) => (Number(b.planned > 0) - Number(a.planned > 0)) || (b.actual - a.actual) || (b.avg3 - a.avg3))
    return {
      bucket,
      rows: visible,
      hidden: all.filter(r => !r.visible),
      planned: visible.reduce((s, r) => s + r.planned, 0),
      actual: visible.reduce((s, r) => s + r.actual, 0),
      targetPct: rule[bucket],
      target: Math.round(incomeInfo.amount * rule[bucket] / 100),
    }
  })

  // ── Totals ──
  const spendRows = rows.filter(r => r.bucket !== 'savings')
  const budgeted = spendRows.filter(r => r.planned > 0)
  const spendPlanned = budgeted.reduce((s, r) => s + r.planned, 0)
  const spendBudgeted = budgeted.reduce((s, r) => s + r.actual, 0)
  const spendUnbudgeted = spendRows.filter(r => r.planned === 0).reduce((s, r) => s + r.actual, 0)
  const saveRows = rows.filter(r => r.bucket === 'savings' && r.planned > 0)

  // Forecast: recurring costs as posted, everything else extrapolated at the
  // current daily rate. Too noisy in the first few days to be worth showing.
  let forecast: number | null = null
  if (phase === 'past') forecast = spendBudgeted
  else if (phase === 'live' && elapsed >= 5 && budgeted.length > 0) {
    forecast = budgeted.reduce((s, r) => {
      const variableSpent = Math.max(0, r.actual - r.recurring)
      return s + Math.max(r.actual, r.recurring + variableSpent / elapsed * days)
    }, 0)
  }

  // ── Suggestions ──
  const avgRows = rows.filter(r => r.visible && r.planned === 0 && r.avg3 > 0)
  const prevRows = rows
    .filter(r => r.planned === 0 && (prevPlanned[r.key] ?? 0) > 0)
    .map(row => ({ row, planned: prevPlanned[row.key] }))

  return {
    cycle,
    income: incomeInfo,
    rule,
    groups,
    totals: {
      spendPlanned, spendBudgeted, spendUnbudgeted,
      left: spendPlanned - spendBudgeted,
      savePlanned: saveRows.reduce((s, r) => s + r.planned, 0),
      saved: saveRows.reduce((s, r) => s + r.actual, 0),
      forecast,
    },
    suggestions: {
      avgRows,
      avgTotal: avgRows.reduce((s, r) => s + r.avg3, 0),
      prevMonth,
      prevRows,
      prevTotal: prevRows.reduce((s, r) => s + r.planned, 0),
    },
  }
}
