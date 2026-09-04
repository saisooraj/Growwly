// ── Mutual-fund wealth projection engine ─────────────────────────────────────
//
// Pure. No side effects, no I/O, no `Date.now()`. Given a config it returns a
// deterministic projection. All monetary values are in rupees, all rates are
// decimals (0.14 === 14%).

export type MFScenario = 'conservative' | 'base' | 'optimistic'

export interface ProjectionFund {
  id: string
  name: string
  category: string
  /** Current value of units already held (₹). */
  existingCorpus: number
  /** Fresh SIP amount, ₹ per month. */
  monthlySIP: number
  /** false → paused: no new SIP, existing corpus still compounds. */
  isActive: boolean
  /** Decimal base CAGR for this fund. When set it wins over the category default. */
  cagrOverride?: number
}

export interface ProjectionConfig {
  funds: ProjectionFund[]
  /** Years: 5 | 10 | 15 | 20. */
  horizon: number
  scenario: MFScenario
  /** SIP grows by this % each year (0–20). */
  annualStepUpPercent: number
  /** Percentage points added to each fund's base CAGR, per scenario. */
  scenarioCAGROffsets?: Record<MFScenario, number>
}

export interface YearPoint {
  year: number
  invested: number
  corpus: number
}

export interface FundBreakdown {
  fundId: string
  sipCorpus: number
  existingCorpus: number
  total: number
}

export interface ProjectionSummary {
  totalCorpus: number
  totalInvested: number
  totalGain: number
  ltcgTax: number
  postTaxCorpus: number
  wealthMultiplier: number
}

export interface ProjectionResult {
  yearByYear: YearPoint[]
  fundBreakdown: FundBreakdown[]
  summary: ProjectionSummary
}

export const SCENARIO_CAGR_OFFSETS: Record<MFScenario, number> = {
  conservative: -4,
  base: 0,
  optimistic: 4,
}

// Only used when a fund has no cagrOverride (AMFI history unavailable).
export const CATEGORY_DEFAULT_CAGR: Record<string, number> = {
  flexi_cap: 0.13,
  mid_cap: 0.16,
  small_cap: 0.16,
  elss: 0.13,
  aggressive_hybrid: 0.12,
}

const CATEGORY_FALLBACK_CAGR = 0.12
const LTCG_EXEMPTION = 125000
const LTCG_RATE = 0.125

function resolveAnnualCAGR(
  fund: ProjectionFund,
  scenario: MFScenario,
  offsets: Record<MFScenario, number>,
): number {
  const base =
    fund.cagrOverride ?? CATEGORY_DEFAULT_CAGR[fund.category] ?? CATEGORY_FALLBACK_CAGR
  const offset = (offsets[scenario] ?? 0) / 100
  return Math.max(0, base + offset)
}

interface FundTrajStep {
  sipCorpus: number
  existingFV: number
  invested: number
}

// Year-by-year trajectory for a single fund, index 0..horizon.
// SIP contributions are treated as an ordinary annuity (end of month), matching
// FV = P × [((1+r)^n − 1) / r]. Step-up bumps P at each year boundary.
function projectFund(
  fund: ProjectionFund,
  annualCAGR: number,
  horizon: number,
  stepUpPercent: number,
): FundTrajStep[] {
  const rMonthly = Math.pow(1 + annualCAGR, 1 / 12) - 1
  const stepUp = stepUpPercent / 100

  const steps: FundTrajStep[] = [
    { sipCorpus: 0, existingFV: fund.existingCorpus, invested: fund.existingCorpus },
  ]

  let sipCorpus = 0
  let investedSIP = 0
  let monthly = fund.isActive ? Math.max(0, fund.monthlySIP) : 0

  for (let year = 1; year <= horizon; year++) {
    for (let m = 0; m < 12; m++) {
      sipCorpus = sipCorpus * (1 + rMonthly) + monthly
      investedSIP += monthly
    }
    steps.push({
      sipCorpus,
      existingFV: fund.existingCorpus * Math.pow(1 + annualCAGR, year),
      invested: fund.existingCorpus + investedSIP,
    })
    monthly = monthly * (1 + stepUp)
  }

  return steps
}

export function projectPortfolio(config: ProjectionConfig): ProjectionResult {
  const offsets = config.scenarioCAGROffsets ?? SCENARIO_CAGR_OFFSETS
  const horizon = Math.max(0, Math.round(config.horizon))

  const perFund = config.funds.map((fund) => ({
    fund,
    steps: projectFund(
      fund,
      resolveAnnualCAGR(fund, config.scenario, offsets),
      horizon,
      config.annualStepUpPercent,
    ),
  }))

  const yearByYear: YearPoint[] = []
  for (let y = 0; y <= horizon; y++) {
    let invested = 0
    let corpus = 0
    for (const { steps } of perFund) {
      const s = steps[y]
      invested += s.invested
      corpus += s.sipCorpus + s.existingFV
    }
    yearByYear.push({ year: y, invested, corpus })
  }

  const fundBreakdown: FundBreakdown[] = perFund.map(({ fund, steps }) => {
    const s = steps[horizon]
    return {
      fundId: fund.id,
      sipCorpus: s.sipCorpus,
      existingCorpus: s.existingFV,
      total: s.sipCorpus + s.existingFV,
    }
  })

  const last = yearByYear[horizon] ?? { year: horizon, invested: 0, corpus: 0 }
  const totalCorpus = last.corpus
  const totalInvested = last.invested
  const totalGain = totalCorpus - totalInvested
  const ltcgTax = Math.max(0, totalGain - LTCG_EXEMPTION) * LTCG_RATE
  const postTaxCorpus = totalCorpus - ltcgTax
  const wealthMultiplier = totalInvested > 0 ? totalCorpus / totalInvested : 0

  return {
    yearByYear,
    fundBreakdown,
    summary: {
      totalCorpus,
      totalInvested,
      totalGain,
      ltcgTax,
      postTaxCorpus,
      wealthMultiplier,
    },
  }
}
