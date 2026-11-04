// Default FIRE planning assumptions, as percentages the way the user sees them.
// These are planning assumptions, not forecasts: returns are not guaranteed and no
// withdrawal rate is "safe" for every market history.

import type { FireAssumptions } from '@/lib/fire'
import type { FireSettings } from '@/types'

export const DEFAULT_ASSUMPTIONS_PCT = {
  inflation: 6,
  stepUp: 10,
  withdrawalTax: 0,
  healthcareMonthly: 0,
  healthcareInflation: null as number | null, // follow general inflation
  returns: { conservative: 8, moderate: 10, optimistic: 12 },
  withdrawalRates: { conservative: 3, moderate: 3.5, optimistic: 4 },
  include: { cash: true, gold: true, realEstate: false, otherAssets: false, subtractLoans: true, emergencyFund: false },
  // One-off building costs, and the old "Gold" expense category (gold bought before savings
  // vehicles existed, already counted as a holding) aren't retirement living costs.
  excludedCategories: ['Construction', 'Gold'],
  targetRetirementAge: 50,
  targetYears: 20,
  targetAllocation: { equity: 60, debt: 30, cash: 5, other: 5 },
}

const pct = (v: number | undefined | null, fallback: number) =>
  (typeof v === 'number' && Number.isFinite(v) ? v : fallback) / 100

/** Saved settings (percentages, possibly partial) → engine assumptions (decimals). */
export function toAssumptions(f: FireSettings | undefined): FireAssumptions {
  const d = DEFAULT_ASSUMPTIONS_PCT
  const s = f ?? {}
  const inflation = pct(s.inflation, d.inflation)
  return {
    inflation,
    stepUp: pct(s.stepUp, d.stepUp),
    withdrawalTax: Math.min(0.9, Math.max(0, pct(s.withdrawalTax, d.withdrawalTax))),
    healthcareMonthly: Math.max(0, s.healthcareMonthly ?? d.healthcareMonthly),
    healthcareInflation: s.healthcareInflation == null ? inflation : s.healthcareInflation / 100,
    returns: {
      conservative: pct(s.returns?.conservative, d.returns.conservative),
      moderate: pct(s.returns?.moderate, d.returns.moderate),
      optimistic: pct(s.returns?.optimistic, d.returns.optimistic),
    },
    withdrawalRates: {
      conservative: pct(s.withdrawalRates?.conservative, d.withdrawalRates.conservative),
      moderate: pct(s.withdrawalRates?.moderate, d.withdrawalRates.moderate),
      optimistic: pct(s.withdrawalRates?.optimistic, d.withdrawalRates.optimistic),
    },
  }
}

/** Firestore rejects undefined values; drop them (and keep nulls) before saving. */
export function cleanFireSettings(f: FireSettings): FireSettings {
  return JSON.parse(JSON.stringify(f)) as FireSettings
}
