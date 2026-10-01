import { accrueEpfBalance, computePpfBalance, npsCorpus } from '@/lib/retirement'
import { legacyGoldPurchases, goldPurchaseTotals, goldCurrentValue } from '@/lib/gold'
import type { Asset } from '@/types'

// One valuation for every holding, shared by the net worth total and the holdings list so
// the two can never disagree. Asset.value alone is not a rupee value for every kind: it is
// grams for gold and the invested amount for mutual funds and stocks.

export interface LivePrices {
  gold?: { price22k: number; price18k: number; price24k: number }
  stocks?: Record<string, { price: number; change: number; changePct: number; name: string }>
  mf?: Record<string, { nav: number; change: number; changePct: number; schemeName: string }>
  nps?: Record<string, { nav: number; schemeName: string; changePct: number }>
}

export interface AssetWithValue extends Asset {
  currentValue: number
  gain: number
  gainPct: number | null
}

export function computeValue(asset: Asset, prices: LivePrices): AssetWithValue {
  let currentValue = asset.value
  let value = asset.value
  let gain = 0
  let gainPct: number | null = null
  let investedAmount = asset.investedAmount

  if (asset.kind === 'gold_grams') {
    const purchases = legacyGoldPurchases(asset)
    const { totalGrams, totalInvested } = goldPurchaseTotals(purchases)
    value = totalGrams
    investedAmount = totalInvested > 0 ? totalInvested : asset.investedAmount
    const goldPrices = prices.gold
    if (goldPrices) {
      currentValue = goldCurrentValue(purchases, { price18k: goldPrices.price18k, price22k: goldPrices.price22k, price24k: goldPrices.price24k })
      if (totalInvested > 0) {
        gain = currentValue - totalInvested
        gainPct = (gain / totalInvested) * 100
      }
    } else {
      // No live rate yet (first render, or the IBJA scrape failed): cost basis, never the gram count
      currentValue = totalInvested
    }
  } else if (asset.kind === 'mutual_fund' && asset.schemeCode) {
    const nav = prices.mf?.[asset.schemeCode]?.nav ?? 0
    currentValue = nav > 0 && asset.units ? asset.units * nav : asset.value
    const invested = asset.investedAmount ?? asset.value
    if (currentValue > 0 && invested > 0) {
      gain = currentValue - invested
      gainPct = (gain / invested) * 100
    }
  } else if (asset.kind === 'stocks' && asset.ticker) {
    const stockData = prices.stocks?.[asset.ticker]
    const price = stockData?.price ?? 0
    currentValue = price > 0 && asset.quantity ? asset.quantity * price : asset.value
    const invested = asset.investedAmount ?? (asset.quantity && asset.avgBuyPrice ? asset.quantity * asset.avgBuyPrice : 0)
    if (currentValue > 0 && invested > 0) {
      gain = currentValue - invested
      gainPct = (gain / invested) * 100
    }
  } else if (asset.kind === 'epf') {
    currentValue = accrueEpfBalance({
      balance: asset.value,
      asOf: asset.balanceAsOf,
      monthlyContribution: asset.monthlyContribution,
      annualRate: asset.annualRate,
    })
    if (asset.investedAmount && asset.investedAmount > 0) {
      gain = currentValue - asset.investedAmount
      gainPct = (gain / asset.investedAmount) * 100
    }
  } else if (asset.kind === 'ppf') {
    const p = computePpfBalance({
      startDate: asset.ppfStartDate,
      deposits: asset.ppfDeposits ?? [],
      rateOverride: asset.annualRate,
    })
    currentValue = p.balance > 0 ? p.balance : asset.value
    const invested = asset.investedAmount ?? p.totalDeposited
    if (currentValue > 0 && invested > 0) {
      gain = currentValue - invested
      gainPct = (gain / invested) * 100
    }
  } else if (asset.kind === 'nps') {
    const navMap: Record<string, number> = {}
    for (const [code, v] of Object.entries(prices.nps ?? {})) navMap[code] = v.nav
    const live = npsCorpus(asset.npsHoldings, navMap)
    currentValue = live > 0 ? live : asset.value
    if (asset.investedAmount && asset.investedAmount > 0 && currentValue > 0) {
      gain = currentValue - asset.investedAmount
      gainPct = (gain / asset.investedAmount) * 100
    }
  } else if (asset.investedAmount && asset.investedAmount > 0) {
    gain = currentValue - asset.investedAmount
    gainPct = (gain / asset.investedAmount) * 100
  }

  return { ...asset, value, currentValue, gain, gainPct, investedAmount }
}
