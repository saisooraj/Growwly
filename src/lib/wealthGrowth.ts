import { accrueEpfBalance, computePpfBalance } from '@/lib/retirement'
import { legacyGoldPurchases, priceForKarat } from '@/lib/gold'
import type { AssetWithValue, LivePrices } from '@/lib/assetValuation'

// How the money in holdings is growing, for the net worth hero:
//   • lifetime — what went into holdings that track a cost basis, and what it has earned
//   • since    — what holdings earned since a date (the cycle start), with new money taken out
//
// "Returns since" for a market holding = value now − value at the start − money put in since.
// Buys made since the start are counted at what was paid, so new money never shows up as a
// return. Holdings with no price history (FD, real estate, cash…) earn nothing here.

// Vehicles carry a purchase price but they lose value by design; that isn't an investment return.
const NOT_AN_INVESTMENT = new Set(['vehicle'])

export function lifetimeReturns(assets: AssetWithValue[]): { invested: number; returns: number; pct: number | null } {
  let invested = 0, returns = 0
  for (const a of assets) {
    if (a.gainPct === null || NOT_AN_INVESTMENT.has(a.kind)) continue
    invested += a.currentValue - a.gain
    returns += a.gain
  }
  return { invested, returns, pct: invested > 0 ? (returns / invested) * 100 : null }
}

// The last day before the cycle: balances that accrue by date are read as of then, matching
// market prices, which are the last close before the cycle start.
function dayBefore(isoDay: string): Date {
  const d = new Date(`${isoDay}T00:00:00`)
  d.setDate(d.getDate() - 1)
  return d
}

/** Whole calendar months between two dates — the step accrueEpfBalance moves in. */
function monthsBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()))
}

// Unit-based holding: units held now at today's price, less the units held at the start at the
// start price, less what the units bought (or sold) since cost (or fetched).
function unitReturn(unitsNow: number, priceNow: number, priceStart: number, flows: { units: number; amount: number }[]): number {
  const newUnits = flows.reduce((s, f) => s + f.units, 0)
  const newCost = flows.reduce((s, f) => s + f.amount, 0)
  const startUnits = Math.max(0, unitsNow - newUnits)
  return unitsNow * priceNow - startUnits * priceStart - newCost
}

/**
 * What one holding earned since `since`, plus money that arrived on its own (EPF's monthly
 * credit) rather than through a logged savings transaction.
 */
export function holdingGrowthSince(
  a: AssetWithValue, prices: LivePrices, since: string, now = new Date(),
): { returns: number; added: number } {
  const start = prices.start
  const none = { returns: 0, added: 0 }
  const flowsSince = (a.contributions ?? []).filter(c => c.date >= since && c.units)

  switch (a.kind) {
    case 'mutual_fund': {
      const code = a.schemeCode
      const navNow = code ? prices.mf?.[code]?.nav ?? 0 : 0
      const navStart = code ? start?.mf?.[code] ?? 0 : 0
      if (!(navNow > 0 && navStart > 0 && (a.units ?? 0) > 0)) return none
      return { returns: unitReturn(a.units!, navNow, navStart, flowsSince.map(c => ({ units: c.units!, amount: c.amount }))), added: 0 }
    }

    case 'nps': {
      const holdings = a.npsHoldings ?? []
      let returns = 0
      for (const h of holdings) {
        const navNow = prices.nps?.[h.schemeCode]?.nav ?? 0
        const navStart = start?.nps?.[h.schemeCode] ?? 0
        if (!(navNow > 0 && navStart > 0 && h.units > 0)) continue
        const flows = flowsSince
          .filter(c => c.schemeCode === h.schemeCode || (!c.schemeCode && holdings.length === 1))
          .map(c => ({ units: c.units!, amount: c.amount }))
        returns += unitReturn(h.units, navNow, navStart, flows)
      }
      return { returns, added: 0 }
    }

    case 'stocks': {
      // Share counts aren't recorded per buy, so every share is treated as held all cycle.
      const priceNow = a.ticker ? prices.stocks?.[a.ticker]?.price ?? 0 : 0
      const priceStart = a.ticker ? start?.stocks?.[a.ticker] ?? 0 : 0
      if (!(priceNow > 0 && priceStart > 0 && (a.quantity ?? 0) > 0)) return none
      return { returns: a.quantity! * (priceNow - priceStart), added: 0 }
    }

    case 'gold_grams': {
      if (!prices.gold || !start?.gold) return none
      let returns = 0
      for (const lot of legacyGoldPurchases(a)) {
        const pNow = priceForKarat(lot.karat, prices.gold)
        // A lot bought this cycle has earned from its buy price; anything older from the start
        // price. The legacy single lot carries an edit date, not a buy date, so it's always older.
        const boughtSince = lot.id !== 'legacy' && lot.date >= since && lot.pricePerGram > 0
        returns += lot.grams * (pNow - (boughtSince ? lot.pricePerGram : priceForKarat(lot.karat, start.gold)))
      }
      // Gold sold this cycle: what it fetched against what it was worth at the start
      for (const c of a.contributions ?? []) {
        if (c.date < since || !c.grams || c.amount >= 0) continue
        returns += -c.amount - Math.abs(c.grams) * priceForKarat(c.karat ?? 22, start.gold)
      }
      return { returns, added: 0 }
    }

    case 'epf': {
      // Balance accrues in monthly steps of interest + contribution from a dated snapshot
      if (!(a.value > 0)) return none
      const startDate = dayBefore(since)
      const input = { balance: a.value, asOf: a.balanceAsOf, monthlyContribution: a.monthlyContribution, annualRate: a.annualRate }
      const valueStart = accrueEpfBalance({ ...input, now: startDate })
      const valueNow = accrueEpfBalance({ ...input, now })
      const asOf = a.balanceAsOf ? new Date(a.balanceAsOf) : now
      if (isNaN(asOf.getTime())) return none
      const steps = Math.min(monthsBetween(asOf, now), 600) - Math.min(monthsBetween(asOf, startDate), 600)
      const added = Math.max(0, steps) * (a.monthlyContribution ?? 0)
      return { returns: valueNow - valueStart - added, added }
    }

    case 'ppf': {
      const deposits = a.ppfDeposits ?? []
      if (!deposits.length) return none
      const opts = { startDate: a.ppfStartDate, deposits, rateOverride: a.annualRate }
      const earnedNow = computePpfBalance({ ...opts, now }).interestEarned
      const earnedStart = computePpfBalance({ ...opts, now: dayBefore(since) }).interestEarned
      return { returns: earnedNow - earnedStart, added: 0 }
    }

    default:
      return none
  }
}

/**
 * Growth across all holdings since `since`. `ready` is false until the start-of-cycle prices
 * have loaded, so the page can hold off showing a returns figure that is still filling in.
 */
export function growthSince(
  assets: AssetWithValue[], prices: LivePrices, since: string, now = new Date(),
): { returns: number; added: number; ready: boolean } {
  let returns = 0, added = 0
  for (const a of assets) {
    if (NOT_AN_INVESTMENT.has(a.kind)) continue
    const g = holdingGrowthSince(a, prices, since, now)
    returns += g.returns
    added += g.added
  }
  const needsPrices = assets.some(a => ['mutual_fund', 'nps', 'stocks', 'gold_grams'].includes(a.kind))
  return { returns, added, ready: !needsPrices || prices.start?.since === since }
}
