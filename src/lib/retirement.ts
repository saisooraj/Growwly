// ── Retirement-account valuation helpers (EPF / PPF / NPS) ───────────────────
//
// EPF and PPF have no public balance API, so we derive a current value:
//   • EPF — accrue interest + monthly contributions forward from a dated snapshot.
//   • PPF — replay the deposit history against the statutory quarterly rate.
// NPS is valued live from daily scheme NAVs (see /api/market/nps); the helper
// here only turns unit holdings + a NAV map into a corpus.
//
// All amounts in rupees, all rates in percent (8.25 === 8.25% p.a.).

import type { NpsHolding, PpfDeposit } from '@/types'

export const EPF_DEFAULT_RATE = 8.25 // FY 2024-25 rate declared by EPFO
export const PPF_DEFAULT_RATE = 7.1  // unchanged since Q1 FY 2020-21

// Statutory PPF rate history (effective-from date → % p.a.). Best-effort back to
// 2016; anything earlier falls back to the oldest entry.
const PPF_RATE_HISTORY: { from: string; rate: number }[] = [
  { from: '2016-04-01', rate: 8.1 },
  { from: '2016-10-01', rate: 8.0 },
  { from: '2017-04-01', rate: 7.9 },
  { from: '2017-07-01', rate: 7.8 },
  { from: '2018-01-01', rate: 7.6 },
  { from: '2018-10-01', rate: 8.0 },
  { from: '2019-07-01', rate: 7.9 },
  { from: '2020-04-01', rate: 7.1 },
]

function ppfRateFor(d: Date): number {
  const iso = d.toISOString().slice(0, 10)
  let rate = PPF_RATE_HISTORY[0].rate
  for (const r of PPF_RATE_HISTORY) {
    if (iso >= r.from) rate = r.rate
    else break
  }
  return rate
}

/** Whole months between two dates (never negative). */
function monthsBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()))
}

// ── EPF ─────────────────────────────────────────────────────────────────────

export interface EpfAccrualInput {
  balance: number            // last known balance
  asOf?: string              // ISO date that balance was accurate; defaults to now
  monthlyContribution?: number
  annualRate?: number        // defaults to EPF_DEFAULT_RATE
  now?: Date
}

/**
 * Project an EPF balance forward from its snapshot: each elapsed month adds the
 * contribution and one month of interest. Monthly compounding slightly overshoots
 * EPFO's year-end credit, so treat the result as an estimate, not a statement.
 */
export function accrueEpfBalance({
  balance,
  asOf,
  monthlyContribution = 0,
  annualRate = EPF_DEFAULT_RATE,
  now = new Date(),
}: EpfAccrualInput): number {
  if (!(balance > 0)) return Math.max(0, balance)
  const start = asOf ? new Date(asOf) : now
  if (isNaN(start.getTime())) return balance
  const months = Math.min(monthsBetween(start, now), 600)
  if (months === 0) return balance

  const monthlyRate = annualRate / 100 / 12
  let bal = balance
  for (let i = 0; i < months; i++) {
    bal = bal * (1 + monthlyRate) + monthlyContribution
  }
  return Math.round(bal)
}

// ── PPF ─────────────────────────────────────────────────────────────────────

export interface PpfComputeInput {
  startDate?: string         // ISO; defaults to earliest deposit
  deposits: PpfDeposit[]
  rateOverride?: number      // if set, used for every month instead of the history table
  now?: Date
}

export interface PpfComputeResult {
  balance: number            // credited balance + interest accrued this FY
  totalDeposited: number
  interestEarned: number     // lifetime interest (credited + accrued this FY)
}

/**
 * Replay PPF month by month. Interest each month is earned on the lowest balance
 * between the 5th and month-end (so deposits after the 5th earn nothing that
 * month), accumulated over the financial year and credited on 31 March.
 */
export function computePpfBalance({
  startDate,
  deposits,
  rateOverride,
  now = new Date(),
}: PpfComputeInput): PpfComputeResult {
  const sorted = [...deposits]
    .filter(d => d.amount > 0 && d.date)
    .sort((a, b) => a.date.localeCompare(b.date))

  const totalDeposited = sorted.reduce((s, d) => s + d.amount, 0)
  if (sorted.length === 0) return { balance: 0, totalDeposited: 0, interestEarned: 0 }

  const first = startDate && !isNaN(new Date(startDate).getTime())
    ? new Date(startDate)
    : new Date(sorted[0].date)

  let cursor = new Date(first.getFullYear(), first.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 1)

  let balance = 0            // interest credited at each FY end
  let fyInterest = 0         // interest accrued in the running financial year
  let interestEarned = 0
  let guard = 0

  while (cursor <= end && guard++ < 2400) {
    const y = cursor.getFullYear()
    const m = cursor.getMonth()

    let early = 0            // deposits on/before the 5th
    let late = 0             // deposits after the 5th
    for (const d of sorted) {
      const dd = new Date(d.date)
      if (dd.getFullYear() === y && dd.getMonth() === m) {
        if (dd.getDate() <= 5) early += d.amount
        else late += d.amount
      }
    }

    const minBalance = balance + early
    balance += early + late

    const rate = rateOverride ?? ppfRateFor(cursor)
    fyInterest += minBalance * (rate / 100) / 12

    if (m === 2) { // March → credit the financial year's interest
      balance += fyInterest
      interestEarned += fyInterest
      fyInterest = 0
    }

    cursor = new Date(y, m + 1, 1)
  }

  return {
    balance: Math.round(balance + fyInterest),
    totalDeposited,
    interestEarned: Math.round(interestEarned + fyInterest),
  }
}

// ── NPS ─────────────────────────────────────────────────────────────────────

/** Sum unit holdings against a { schemeCode → NAV } map. */
export function npsCorpus(holdings: NpsHolding[] | undefined, navByCode: Record<string, number>): number {
  if (!holdings?.length) return 0
  return holdings.reduce((s, h) => {
    const nav = navByCode[h.schemeCode]
    return s + (nav > 0 && h.units > 0 ? h.units * nav : 0)
  }, 0)
}
