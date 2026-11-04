// ── FIRE inputs from the user's own data ─────────────────────────────────────
//
// Turns transactions, holdings, the emergency fund and loans into the handful of numbers
// the FIRE engine (lib/fire.ts) needs, and records where each came from. Each rupee is
// counted once, the same way the Net Worth page counts it: a savings transaction linked to
// a holding is inside that holding's value, so it is not counted again as unlinked savings.

import { buildMonthlySummary, buildSavingsByVehicle, getCycleMonth, getTransactionsForMonth, isSavingsTransfer, getTransferDisplay, EMERGENCY_FUND_VEHICLE } from '@/lib/utils'
import { getMonthsEndingAt } from '@/lib/spendingAnalytics'
import { linkedTransactionIds } from '@/lib/holdingLinks'
import { liabilityOutstanding } from '@/lib/loans'
import { DEFAULT_ASSUMPTIONS_PCT } from '@/lib/fireDefaults'
import type { AssetWithValue, LivePrices } from '@/lib/assetValuation'
import type { EmergencyFund, FireSettings, Liability, Transaction, UserSettings } from '@/types'

export type ValueSource = 'records' | 'calculated' | 'manual' | 'assumed' | 'missing'

export interface SourcedValue {
  value: number
  /** What the data says, before any manual override. */
  auto: number
  source: ValueSource
  note: string
}

export type AllocClass = 'equity' | 'debt' | 'cash' | 'gold' | 'other'
export const ALLOC_CLASSES: AllocClass[] = ['equity', 'debt', 'cash', 'gold', 'other']

export interface PortfolioLine {
  id: string
  name: string
  group: string            // display label for the kind, e.g. "Mutual fund"
  value: number
  /** Share of the value in each asset class (sums to 1). */
  split: Partial<Record<AllocClass, number>>
  included: boolean
  /** Why it's left out, or which switch controls it. */
  note?: string
  toggle?: keyof NonNullable<FireSettings['include']>
}

export interface FireData {
  monthsUsed: number
  window: { from: string; to: string; partial: boolean } | null
  monthlyExpenses: SourcedValue
  monthlyIncome: SourcedValue
  monthlyInvestment: SourcedValue & { cashSavings: number; epf: number }
  portfolio: SourcedValue
  lines: PortfolioLine[]
  emergencyFund: number
  loans: number
  netWorth: number
  /** Rupees per class across the included lines (before subtracting loans), with the emergency fund as cash. */
  allocation: Record<AllocClass, number>
  /** The emergency fund part of allocation.cash. */
  allocationEf: number
  /** Whether the emergency fund is counted in the FI portfolio (off by default: it's a reserve). */
  efCounted: boolean
  /** Average monthly spend per category over the window, largest first, for the exclusion picker. */
  categories: { name: string; monthly: number }[]
  age: number | null
}

export interface FireDataInput {
  transactions: Transaction[]
  settings: UserSettings | null
  valuedAssets: AssetWithValue[]
  prices: LivePrices
  liabilities: Liability[]
  emergencyFund: EmergencyFund | null
  now?: Date
}

// ── Classification ────────────────────────────────────────────────────────────

const DEBT_FUND = /\b(debt|liquid|gilt|bond|overnight|money\s*market|duration|credit\s*risk|banking\s*(?:and|&)\s*psu|floater|fixed\s*maturity|fmp|treasury|arbitrage|target\s*maturity|ultra\s*short|low\s*duration)\b/i
const GOLD_FUND = /\bgold\b/i

/** Asset class of a mutual fund from its scheme name. Hybrids count as equity (their larger part). */
export function mutualFundClass(name: string | undefined | null): AllocClass {
  if (!name) return 'equity'
  if (GOLD_FUND.test(name)) return 'gold'
  if (DEBT_FUND.test(name)) return 'debt'
  return 'equity'
}

// NPS scheme names end "SCHEME E/C/G/A - TIER I/II": E is equity, C corporate bonds,
// G government securities, A alternative assets.
function npsSplit(a: AssetWithValue, prices: LivePrices): Partial<Record<AllocClass, number>> {
  const parts: Partial<Record<AllocClass, number>> = {}
  let total = 0
  for (const h of a.npsHoldings ?? []) {
    const nav = prices.nps?.[h.schemeCode]?.nav
    if (!nav || !(h.units > 0)) continue
    const name = `${h.schemeName} ${prices.nps?.[h.schemeCode]?.schemeName ?? ''}`
    const m = name.match(/scheme\s*[-–]?\s*([ECGA])\b/i)
    const cls: AllocClass = !m ? 'other' : m[1].toUpperCase() === 'E' ? 'equity' : m[1].toUpperCase() === 'A' ? 'other' : 'debt'
    parts[cls] = (parts[cls] ?? 0) + nav * h.units
    total += nav * h.units
  }
  if (total <= 0) return { other: 1 }
  for (const k of Object.keys(parts) as AllocClass[]) parts[k] = parts[k]! / total
  return parts
}

const VEHICLE_CLASS: Record<string, AllocClass> = {
  'SIP / Investments': 'equity',
  'Stocks': 'equity',
  'PF / EPF': 'debt',
  'Fixed Deposit': 'debt',
  'Recurring Deposit': 'debt',
  'Post Office': 'debt',
  'Gold': 'gold',
}

const KIND_LABEL: Record<string, string> = {
  cash: 'Cash & savings', fd_rd: 'FD / RD', post_office: 'Post Office', gold_grams: 'Gold',
  mutual_fund: 'Mutual fund', stocks: 'Stocks', real_estate: 'Real estate', vehicle: 'Vehicle',
  epf: 'EPF', ppf: 'PPF', nps: 'NPS', epf_ppf: 'EPF / PPF / NPS', other: 'Other asset',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function ageFromDob(dob: string | undefined, now: Date): number | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null
  const d = new Date(`${dob}T00:00:00`)
  if (isNaN(d.getTime()) || d > now) return null
  const age = (now.getTime() - d.getTime()) / (365.2425 * 24 * 3600 * 1000)
  return age > 0 && age < 120 ? age : null
}

function sourced(auto: number, override: number | undefined, source: ValueSource, note: string): SourcedValue {
  if (override != null && Number.isFinite(override)) return { value: override, auto, source: 'manual', note: 'Entered by you' }
  return { value: auto, auto, source, note }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function deriveFireData(input: FireDataInput): FireData {
  const { transactions, settings, valuedAssets, prices, liabilities, emergencyFund } = input
  const now = input.now ?? new Date()
  const fire = settings?.fire ?? {}
  const overrides = fire.overrides ?? {}
  const include = { ...DEFAULT_ASSUMPTIONS_PCT.include, ...(fire.include ?? {}) }
  const excluded = new Set(fire.excludedCategories ?? DEFAULT_ASSUMPTIONS_PCT.excludedCategories)

  // Window: the last 12 completed salary cycles that have any income or spending in them.
  // The current cycle is half-done, so it only stands in when there's nothing else.
  const current = getCycleMonth(settings)
  let months = getMonthsEndingAt(prevMonth(current), 12)
  let summaries = months.map(m => buildMonthlySummary(transactions, m, settings))
  const active = summaries.map((s, i) => (s.totalIncome > 0 || s.totalExpenses > 0 ? i : -1)).filter(i => i >= 0)
  let partial = false
  if (active.length === 0) {
    months = [current]
    summaries = [buildMonthlySummary(transactions, current, settings)]
    partial = summaries[0].totalIncome > 0 || summaries[0].totalExpenses > 0
  } else {
    months = active.map(i => months[i])
    summaries = active.map(i => summaries[i])
  }
  const hasData = active.length > 0 || partial
  const monthsUsed = hasData ? months.length : 0
  const window = hasData ? { from: months[0], to: months[months.length - 1], partial } : null

  // Expenses: income-statement spending (transfers, savings and loans already left out, refunds
  // netted), less the categories the user marked as not part of retirement life.
  const byCat: Record<string, number> = {}
  let expenseSum = 0, incomeSum = 0
  for (const s of summaries) {
    incomeSum += s.totalIncome
    expenseSum += s.totalExpenses
    for (const [cat, amt] of Object.entries(s.byCategory)) byCat[cat] = (byCat[cat] ?? 0) + amt
  }
  const excludedSum = Object.entries(byCat).filter(([c]) => excluded.has(c)).reduce((s, [, v]) => s + v, 0)
  const avgExpenses = monthsUsed > 0 ? Math.max(0, (expenseSum - excludedSum) / monthsUsed) : 0
  const avgIncome = monthsUsed > 0 ? incomeSum / monthsUsed : 0
  const categories = Object.entries(byCat)
    .map(([name, total]) => ({ name, monthly: monthsUsed > 0 ? total / monthsUsed : 0 }))
    .filter(c => c.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly)

  const spanNote = !window ? '' : window.partial
    ? 'this cycle so far (no earlier history)'
    : `average of ${monthsUsed} cycle${monthsUsed === 1 ? '' : 's'}`

  // Investing: savings put in less taken out, leaving out the emergency fund (a reserve, not
  // retirement money) unless the user counts it toward FI. EPF credited from salary never passes through the bank, so it comes from
  // the EPF holding's monthly contribution — and when that's set, PF transactions are skipped so
  // the same contribution isn't counted twice.
  const linked = linkedTransactionIds(valuedAssets)
  const epfAssets = valuedAssets.filter(a => a.kind === 'epf' || a.kind === 'epf_ppf')
  const epfMonthly = epfAssets.reduce((s, a) => s + Math.max(0, a.monthlyContribution ?? 0), 0)
  const epfIds = new Set(epfAssets.map(a => a.id))
  let netSaved = 0
  for (const m of months) {
    for (const t of getTransactionsForMonth(transactions, m, settings)) {
      if (!isSavingsTransfer(t)) continue
      const vehicle = t.savingsVehicle || (t.transferKind === 'ef_withdrawal' ? EMERGENCY_FUND_VEHICLE : 'Other Savings')
      // Emergency fund savings count only when the fund itself counts toward FI
      if (vehicle === EMERGENCY_FUND_VEHICLE && !include.emergencyFund) continue
      if (epfMonthly > 0 && (vehicle === 'PF / EPF' || epfIds.has(linked.get(t.id) ?? ''))) continue
      netSaved += getTransferDisplay(t).dir === 'out' ? t.amount : -t.amount
    }
  }
  const cashSavings = monthsUsed > 0 ? Math.max(0, netSaved / monthsUsed) : 0
  const autoInvestment = cashSavings + epfMonthly

  // Portfolio: what could actually fund retirement.
  const lines: PortfolioLine[] = []
  for (const a of valuedAssets) {
    const base = { id: a.id, name: a.name, group: KIND_LABEL[a.kind] ?? 'Asset', value: Math.max(0, a.currentValue) }
    switch (a.kind) {
      case 'mutual_fund': lines.push({ ...base, split: { [mutualFundClass(a.name)]: 1 }, included: true }); break
      case 'stocks': lines.push({ ...base, split: { equity: 1 }, included: true }); break
      case 'fd_rd': case 'post_office': case 'epf': case 'ppf': case 'epf_ppf':
        lines.push({ ...base, split: { debt: 1 }, included: true }); break
      case 'nps': lines.push({ ...base, split: npsSplit(a, prices), included: true }); break
      case 'gold_grams': lines.push({ ...base, split: { gold: 1 }, included: !!include.gold, toggle: 'gold' }); break
      case 'cash': lines.push({ ...base, split: { cash: 1 }, included: !!include.cash, toggle: 'cash', note: 'Includes day-to-day money' }); break
      case 'real_estate': lines.push({ ...base, split: { other: 1 }, included: !!include.realEstate, toggle: 'realEstate', note: 'Only counts if you would sell it or it pays rent' }); break
      case 'vehicle': lines.push({ ...base, split: { other: 1 }, included: false, note: 'Loses value; can’t fund retirement' }); break
      default: lines.push({ ...base, split: { other: 1 }, included: !!include.otherAssets, toggle: 'otherAssets' })
    }
  }
  const byVehicle = buildSavingsByVehicle(transactions.filter(t => !linked.has(t.id)), settings?.savingsOpeningBalances ?? {})
  for (const [name, v] of Object.entries(byVehicle)) {
    if (name === EMERGENCY_FUND_VEHICLE || v.balance <= 0) continue
    lines.push({
      id: `vehicle:${name}`, name, group: 'Unlinked savings', value: v.balance,
      split: { [VEHICLE_CLASS[name] ?? 'other']: 1 }, included: true,
    })
  }

  const ef = Math.max(0, emergencyFund?.currentBalance ?? 0)
  const loans = liabilities.reduce((s, l) => s + Math.max(0, liabilityOutstanding(l)), 0)
  const allocation: Record<AllocClass, number> = { equity: 0, debt: 0, cash: 0, gold: 0, other: 0 }
  let includedSum = 0, allSum = 0
  for (const l of lines) {
    allSum += l.value
    if (!l.included) continue
    includedSum += l.value
    for (const [k, f] of Object.entries(l.split) as [AllocClass, number][]) allocation[k] += l.value * f
  }
  // The emergency fund is a reserve, so by default it stays out of the FI portfolio; the user can
  // switch it in. Either way it's cash they hold, so it's always part of the allocation mix.
  const efCounted = !!include.emergencyFund && ef > 0
  const autoPortfolio = includedSum + (efCounted ? ef : 0) - (include.subtractLoans ? loans : 0)
  allocation.cash += ef

  return {
    monthsUsed,
    window,
    monthlyExpenses: sourced(avgExpenses, overrides.monthlyExpenses, hasData ? 'calculated' : 'missing',
      hasData ? `From your transactions: ${spanNote}` : 'No spending recorded yet'),
    monthlyIncome: sourced(avgIncome, overrides.monthlyIncome, hasData ? 'calculated' : 'missing',
      hasData ? `From your transactions: ${spanNote}` : 'No income recorded yet'),
    monthlyInvestment: {
      ...sourced(autoInvestment, overrides.monthlyInvestment, hasData || epfMonthly > 0 ? 'calculated' : 'missing',
        [hasData ? `Savings: ${spanNote}` : '', epfMonthly > 0 ? 'EPF from your holding' : '']
          .filter(Boolean).join(' + ') || 'No savings recorded yet'),
      cashSavings, epf: epfMonthly,
    },
    portfolio: sourced(autoPortfolio, overrides.portfolio, lines.length > 0 || efCounted ? 'records' : 'missing',
      lines.length > 0 || efCounted ? `Your holdings${efCounted ? ' and emergency fund' : ''}${include.subtractLoans && loans > 0 ? ', less loans' : ''}` : 'No holdings added yet'),
    lines,
    emergencyFund: ef,
    loans,
    netWorth: allSum + ef - loans,
    allocation,
    allocationEf: ef,
    efCounted,
    categories,
    age: ageFromDob(settings?.dateOfBirth, now),
  }
}
