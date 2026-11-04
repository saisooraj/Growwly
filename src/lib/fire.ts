// ── FIRE (financial independence) projection engine ──────────────────────────
//
// Pure: no I/O, no Date.now(), no imports. Everything is in rupees and every rate is a
// decimal (0.06 === 6%).
//
// Conventions, used everywhere in this file:
// • Returns and inflation are nominal annual rates, compounded monthly at the equivalent
//   monthly rate (1 + annual)^(1/12) − 1, so twelve months compound to exactly the annual rate.
// • Contributions land at the END of each month (an ordinary annuity): month m's balance is
//   last month's balance grown one month, plus month m's SIP.
// • The SIP steps up every 12 months from today: months 1–12 at the starting SIP, 13–24 at
//   SIP × (1 + step-up), and so on.
// • The FI target is nominal and moves with inflation: at month m it is the annual retirement
//   spend priced at month m, divided by the withdrawal rate (grossed up for tax on withdrawals).
//   "Today's money" figures divide nominal rupees by (1 + inflation)^(m/12), applied once.
// • A negative starting balance (more debt than investments) earns nothing: new money pays
//   it down first, then compounds as usual.

export type ScenarioKey = 'conservative' | 'moderate' | 'optimistic'
export const SCENARIO_KEYS: ScenarioKey[] = ['conservative', 'moderate', 'optimistic']

export interface FireAssumptions {
  inflation: number
  stepUp: number
  /** Effective tax on money withdrawn in retirement. Grosses the corpus up: 10% tax → 1/0.9×. */
  withdrawalTax: number
  /** Extra monthly healthcare + insurance in retirement, in today's rupees, on top of the lifestyle budget. */
  healthcareMonthly: number
  /** Inflation for the healthcare line. */
  healthcareInflation: number
  returns: Record<ScenarioKey, number>
  withdrawalRates: Record<ScenarioKey, number>
}

export interface Scenario {
  annualReturn: number
  withdrawalRate: number
}

export function scenarioOf(a: FireAssumptions, key: ScenarioKey): Scenario {
  return { annualReturn: a.returns[key], withdrawalRate: a.withdrawalRates[key] }
}

// ── Building blocks ───────────────────────────────────────────────────────────

/** Monthly rate equivalent to an annual rate. Clamped so a rate at or below −100% stays finite. */
export function monthlyRate(annual: number): number {
  return Math.pow(1 + Math.max(annual, -0.99), 1 / 12) - 1
}

/** Growth factor over `months` at an annual rate: (1 + annual)^(months/12). */
export function growth(annual: number, months: number): number {
  return Math.pow(1 + Math.max(annual, -0.99), months / 12)
}

/** Corpus as a multiple of annual spend: 1 / (withdrawal rate × (1 − tax)). Infinity when undefined. */
export function corpusMultiple(withdrawalRate: number, withdrawalTax = 0): number {
  const net = withdrawalRate * (1 - withdrawalTax)
  return net > 0 ? 1 / net : Infinity
}

/** SIP paid in month m (1-indexed) given a starting SIP and an annual step-up. */
export function sipForMonth(startSip: number, stepUp: number, month: number): number {
  if (month < 1) return 0
  return Math.max(0, startSip) * Math.pow(1 + stepUp, Math.floor((month - 1) / 12))
}

export interface RetirementSpend {
  /** Monthly lifestyle spend in today's rupees. */
  monthly: number
}

/** Annual retirement spend in nominal rupees at month m (lifestyle + healthcare, each with its own inflation). */
export function annualSpendAt(spend: RetirementSpend, a: FireAssumptions, month: number): number {
  return 12 * (
    Math.max(0, spend.monthly) * growth(a.inflation, month) +
    Math.max(0, a.healthcareMonthly) * growth(a.healthcareInflation, month)
  )
}

/** Nominal FI target at month m. Month 0 is today's FI corpus. */
export function fiTargetAt(spend: RetirementSpend, a: FireAssumptions, withdrawalRate: number, month: number): number {
  const annual = annualSpendAt(spend, a, month)
  if (annual <= 0) return 0
  return annual * corpusMultiple(withdrawalRate, a.withdrawalTax)
}

/** Nominal rupees at month m → today's purchasing power. */
export function toTodaysMoney(nominal: number, inflation: number, month: number): number {
  return nominal / growth(inflation, month)
}

// ── Portfolio path ────────────────────────────────────────────────────────────

export interface PathInput {
  start: number
  startSip: number
  stepUp: number
  annualReturn: number
  months: number
}

export interface Path {
  /** balance[m] = value at the end of month m; balance[0] = start. Length months + 1. */
  balance: number[]
  /** Cumulative contributions after month m (excludes the starting balance). */
  contributed: number[]
  /** sip[m] = SIP paid in month m; sip[0] = 0. */
  sip: number[]
}

export function projectPath({ start, startSip, stepUp, annualReturn, months }: PathInput): Path {
  const n = Math.max(0, Math.floor(months))
  const r = monthlyRate(annualReturn)
  const balance = [start]
  const contributed = [0]
  const sip = [0]
  let bal = start
  let paid = 0
  for (let m = 1; m <= n; m++) {
    const s = sipForMonth(startSip, stepUp, m)
    bal = (bal > 0 ? bal * (1 + r) : bal) + s
    paid += s
    balance.push(bal)
    contributed.push(paid)
    sip.push(s)
  }
  return { balance, contributed, sip }
}

/** Balance after `months`, without keeping the path. */
export function finalBalance(input: PathInput): number {
  const n = Math.max(0, Math.floor(input.months))
  const r = monthlyRate(input.annualReturn)
  let bal = input.start
  for (let m = 1; m <= n; m++) {
    bal = (bal > 0 ? bal * (1 + r) : bal) + sipForMonth(input.startSip, input.stepUp, m)
  }
  return bal
}

// ── Time to FI ────────────────────────────────────────────────────────────────

export interface PlanInput {
  portfolio: number
  monthlySip: number
  spend: RetirementSpend
  /** Age today in years (fractional), or null when unknown. */
  age: number | null
  /** Today's calendar position, for retirement years. */
  startYear: number
  startMonthIndex: number // 0 = January
  /** Longest horizon searched, in months. */
  horizonMonths: number
}

export type FireStatus = 'reached' | 'already' | 'unreachable' | 'no-expenses'

export interface Milestone {
  fraction: number
  months: number | null
  age: number | null
  year: number | null
}

export interface FireResult {
  status: FireStatus
  months: number | null
  years: number | null
  retirementAge: number | null
  retirementYear: number | null
  targetToday: number
  /** Nominal FI target at the FI date. */
  futureCorpus: number | null
  projectedPortfolio: number | null
  sipAtRetirement: number | null
  /** Starting portfolio + every contribution up to the FI date. */
  totalInvested: number | null
  /** Projected portfolio − total invested. */
  gains: number | null
  /** portfolio / today's FI corpus, both in today's money. */
  progressToday: number
  milestones: Milestone[]
}

export const MILESTONES = [0.25, 0.5, 0.75, 1]

/** Default search horizon: to age 100, or 70 years when age is unknown. */
export function horizonFor(age: number | null): number {
  if (age == null) return 70 * 12
  return Math.max(12, Math.round((100 - age) * 12))
}

export function yearAt(startYear: number, startMonthIndex: number, months: number): number {
  return startYear + Math.floor((startMonthIndex + months) / 12)
}

export function computeFire(input: PlanInput, a: FireAssumptions, sc: Scenario): FireResult {
  const targetToday = fiTargetAt(input.spend, a, sc.withdrawalRate, 0)
  const progressToday = targetToday > 0 && Number.isFinite(targetToday)
    ? Math.max(0, input.portfolio) / targetToday : 0
  const empty: FireResult = {
    status: 'no-expenses', months: null, years: null, retirementAge: null, retirementYear: null,
    targetToday, futureCorpus: null, projectedPortfolio: null, sipAtRetirement: null,
    totalInvested: null, gains: null, progressToday,
    milestones: MILESTONES.map(fraction => ({ fraction, months: null, age: null, year: null })),
  }
  if (!(targetToday > 0)) return empty
  if (!Number.isFinite(targetToday)) return { ...empty, status: 'unreachable' }

  const path = projectPath({
    start: input.portfolio, startSip: input.monthlySip, stepUp: a.stepUp,
    annualReturn: sc.annualReturn, months: input.horizonMonths,
  })

  const at = (m: number | null) => ({
    months: m,
    age: m != null && input.age != null ? input.age + m / 12 : null,
    year: m != null ? yearAt(input.startYear, input.startMonthIndex, m) : null,
  })

  const firstMonth = (fraction: number): number | null => {
    for (let m = 0; m < path.balance.length; m++) {
      if (path.balance[m] >= fraction * fiTargetAt(input.spend, a, sc.withdrawalRate, m)) return m
    }
    return null
  }

  const milestones = MILESTONES.map(fraction => ({ fraction, ...at(firstMonth(fraction)) }))
  const m = milestones[milestones.length - 1].months
  if (m == null) return { ...empty, status: 'unreachable', milestones }

  const totalInvested = input.portfolio + path.contributed[m]
  const t = at(m)
  return {
    status: m === 0 ? 'already' : 'reached',
    months: m,
    years: m / 12,
    retirementAge: t.age,
    retirementYear: t.year,
    targetToday,
    futureCorpus: fiTargetAt(input.spend, a, sc.withdrawalRate, m),
    projectedPortfolio: path.balance[m],
    sipAtRetirement: m === 0 ? input.monthlySip : path.sip[m],
    totalInvested,
    gains: path.balance[m] - totalInvested,
    progressToday,
    milestones,
  }
}

// ── Reverse: what it takes to retire by a date ────────────────────────────────

export interface ReverseInput {
  portfolio: number
  monthlySip: number
  stepUp: number
  annualReturn: number
  /** Months until the chosen retirement date. */
  months: number
  /** Nominal FI target at that date. */
  target: number
}

export interface ReverseResult {
  target: number
  /** Portfolio at the date with the current SIP and step-up. */
  projected: number
  /** projected − target: positive is a surplus, negative a shortfall. */
  gap: number
  /** Starting SIP needed at the current step-up; 0 when the portfolio alone gets there. Null when no SIP could. */
  requiredSip: number | null
  /** Step-up needed at the current SIP; 0 when none is needed. Null when even MAX_STEP_UP falls short. */
  requiredStepUp: number | null
}

export const MAX_STEP_UP = 0.5
const MAX_SIP = 1e10

function bisect(f: (x: number) => number, target: number, lo: number, hi: number): number {
  // f increasing; returns the smallest x in [lo, hi] with f(x) ≥ target (to ~1e-9 relative)
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) >= target) hi = mid; else lo = mid
    if (hi - lo <= Math.max(1e-9, hi * 1e-12)) break
  }
  return hi
}

export function reversePlan(input: ReverseInput): ReverseResult {
  const months = Math.max(0, Math.floor(input.months))
  const base = { start: input.portfolio, annualReturn: input.annualReturn, months }
  const fb = (startSip: number, stepUp: number) => finalBalance({ ...base, startSip, stepUp })
  const projected = fb(input.monthlySip, input.stepUp)
  const target = input.target

  let requiredSip: number | null
  if (!Number.isFinite(target)) requiredSip = null
  else if (fb(0, input.stepUp) >= target) requiredSip = 0
  else if (months === 0) requiredSip = null
  else {
    let hi = Math.max(1000, input.monthlySip)
    while (fb(hi, input.stepUp) < target && hi < MAX_SIP) hi *= 2
    requiredSip = fb(hi, input.stepUp) >= target ? bisect(s => fb(s, input.stepUp), target, 0, hi) : null
  }

  let requiredStepUp: number | null
  if (!Number.isFinite(target)) requiredStepUp = null
  else if (fb(input.monthlySip, 0) >= target) requiredStepUp = 0
  else if (input.monthlySip <= 0 || fb(input.monthlySip, MAX_STEP_UP) < target) requiredStepUp = null
  else requiredStepUp = bisect(g => fb(input.monthlySip, g), target, 0, MAX_STEP_UP)

  return { target, projected, gap: projected - target, requiredSip, requiredStepUp }
}

// ── Coast FIRE ────────────────────────────────────────────────────────────────

/**
 * Coast FI number: what the portfolio must be today to grow, with no further
 * contributions, to `target` (nominal) in `months`.
 */
export function coastNumber(target: number, annualReturn: number, months: number): number {
  return target / growth(annualReturn, Math.max(0, months))
}

// ── Chart series ──────────────────────────────────────────────────────────────

export interface ChartPoint {
  year: number
  age: number | null
  /** Portfolio per scenario, nominal. */
  conservative: number
  moderate: number
  optimistic: number
  /** FI target per scenario, nominal (each scenario has its own withdrawal rate). */
  target: Record<ScenarioKey, number>
  /** SIP paid in the last month of this year, per the shared step-up. */
  sip: number
}

export function buildChartSeries(input: PlanInput, a: FireAssumptions, years: number): ChartPoint[] {
  const months = Math.max(1, Math.round(years)) * 12
  const paths = Object.fromEntries(SCENARIO_KEYS.map(k => [k, projectPath({
    start: input.portfolio, startSip: input.monthlySip, stepUp: a.stepUp,
    annualReturn: a.returns[k], months,
  })])) as Record<ScenarioKey, Path>
  const out: ChartPoint[] = []
  for (let y = 0; y <= months / 12; y++) {
    const m = y * 12
    out.push({
      year: y,
      age: input.age != null ? input.age + y : null,
      conservative: paths.conservative.balance[m],
      moderate: paths.moderate.balance[m],
      optimistic: paths.optimistic.balance[m],
      target: Object.fromEntries(SCENARIO_KEYS.map(k => [k, fiTargetAt(input.spend, a, a.withdrawalRates[k], m)])) as Record<ScenarioKey, number>,
      sip: m === 0 ? input.monthlySip : paths.moderate.sip[m],
    })
  }
  return out
}
