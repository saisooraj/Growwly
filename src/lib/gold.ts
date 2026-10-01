import type { Asset, GoldPurchase } from '@/types'

export interface GoldPrices {
  price18k: number
  price22k: number
  price24k: number
}

export function priceForKarat(karat: 18 | 22 | 24, prices: GoldPrices): number {
  return karat === 24 ? prices.price24k : karat === 18 ? prices.price18k : prices.price22k
}

// Assets created before per-lot tracking existed only have a single value/karat/investedAmount.
// Represent that as an equivalent one-lot purchase so the rest of the gold math has one code path.
export function legacyGoldPurchases(asset: Asset): GoldPurchase[] {
  if (asset.goldPurchases?.length) return asset.goldPurchases
  if (!asset.value) return []
  const karat = asset.karat ?? 22
  const pricePerGram = asset.investedAmount && asset.value ? asset.investedAmount / asset.value : 0
  return [{
    id: 'legacy',
    date: asset.updatedAt?.slice(0, 10) || asset.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    grams: asset.value,
    karat,
    pricePerGram,
  }]
}

// Append a buy, or FIFO-reduce grams (and their cost basis) from the same-karat lots for a sell.
export function applyGoldPurchase(
  purchases: GoldPurchase[],
  entry: { grams: number; karat: 18 | 22 | 24; pricePerGram: number; date: string; transactionId?: string },
  direction: 'buy' | 'sell'
): GoldPurchase[] {
  if (direction === 'buy') {
    return [...purchases, {
      id: entry.transactionId ?? Math.random().toString(36).slice(2),
      date: entry.date,
      grams: entry.grams,
      karat: entry.karat,
      pricePerGram: entry.pricePerGram,
      transactionId: entry.transactionId,
    }]
  }

  // Sell: reduce oldest same-karat lots first.
  let remaining = entry.grams
  const result: GoldPurchase[] = []
  for (const p of purchases) {
    if (remaining <= 0 || p.karat !== entry.karat) { result.push(p); continue }
    if (p.grams <= remaining) { remaining -= p.grams; continue } // lot fully sold, drop it
    result.push({ ...p, grams: p.grams - remaining })
    remaining = 0
  }
  return result
}

export function goldPurchaseTotals(purchases: GoldPurchase[]): { totalGrams: number; totalInvested: number } {
  let totalGrams = 0
  let totalInvested = 0
  for (const p of purchases) {
    totalGrams += p.grams
    totalInvested += p.grams * p.pricePerGram
  }
  return { totalGrams, totalInvested }
}

export function goldCurrentValue(purchases: GoldPurchase[], prices: GoldPrices): number {
  return purchases.reduce((sum, p) => sum + p.grams * priceForKarat(p.karat, prices), 0)
}

// asset.value is grams (not rupees) for gold_grams — anywhere assets are summed into a rupee
// total, gold needs its live rupee value substituted in instead of the raw field.
// Prices are null on first render and whenever the IBJA scrape fails, so fall back to cost
// basis rather than 0 — an out-of-date value beats silently dropping the whole holding.
export function assetValueInRupees(asset: Asset, goldPrices: GoldPrices | null): number {
  if (asset.kind !== 'gold_grams') return asset.value
  const purchases = legacyGoldPurchases(asset)
  if (!goldPrices) return goldPurchaseTotals(purchases).totalInvested
  return goldCurrentValue(purchases, goldPrices)
}
