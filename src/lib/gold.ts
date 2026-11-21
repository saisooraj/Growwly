import type { Asset, GoldPurchase, Transaction } from '@/types'

export interface GoldPrices {
  price18k: number
  price22k: number
  price24k: number
}

export interface GoldDayPrice {
  date: string
  price22k: number
  estimated?: boolean // from the GOLDBEES ETF, on a day IBJA's page no longer lists
}

// Fewer trading days than this in the window is too thin to call a 30-day average
export const GOLD_AVG_MIN_DAYS = 15

// The last 30 calendar days of 22K rates, oldest first
export function goldThirtyDayHistory(ibja: GoldDayPrice[], etf: { date: string; close: number }[]): GoldDayPrice[] {
  if (!ibja.length) return []
  const latest = ibja.reduce((day, d) => d.date > day ? d.date : day, ibja[0].date)
  const from = new Date(`${latest}T00:00:00Z`)
  from.setUTCDate(from.getUTCDate() - 29)
  return goldDailyHistory(ibja, etf, from.toISOString().slice(0, 10))
}

// Daily 22K rates from `fromDay`, oldest first. IBJA's page only lists a few days, so earlier
// days follow GOLDBEES, scaled to meet IBJA's oldest listed rate without a jump.
export function goldDailyHistory(ibja: GoldDayPrice[], etf: { date: string; close: number }[], fromDay: string): GoldDayPrice[] {
  const official = [...ibja].sort((a, b) => a.date.localeCompare(b.date))
  const inWindow = official.filter(d => d.date >= fromDay)
  if (!inWindow.length) return []
  const oldest = inWindow[0]

  const closes = etf.filter(c => c.close > 0).sort((a, b) => a.date.localeCompare(b.date))
  const anchor = closes.filter(c => c.date <= oldest.date).pop()
  if (!anchor) return inWindow

  const earlier = closes
    .filter(c => c.date >= fromDay && c.date < oldest.date)
    .map(c => ({ date: c.date, price22k: Math.round(oldest.price22k * c.close / anchor.close), estimated: true }))
  return [...earlier, ...inWindow]
}

export type GoldSignal = 'buy' | 'hold' | 'wait'

// More than 2% below the average is a buy, more than 4% above is a wait
export function goldSignal(price: number, average: number): GoldSignal {
  const pctAboveAvg = (price - average) / average * 100
  return pctAboveAvg < -2 ? 'buy' : pctAboveAvg > 4 ? 'wait' : 'hold'
}

// Fewer trading days than this in the last year is too thin to call a 1-year average
const GOLD_YEAR_MIN_DAYS = 120

// Average 22K rate over the 12 months to the latest day. Always one year, even when the chart
// goes back further, because gold's long rise would make an all-time average say "wait" forever.
export function goldYearAverage(days: GoldDayPrice[]): number | null {
  if (!days.length) return null
  const latest = days.reduce((day, d) => d.date > day ? d.date : day, days[0].date)
  const from = new Date(`${latest}T00:00:00Z`)
  from.setUTCFullYear(from.getUTCFullYear() - 1)
  const fromDay = from.toISOString().slice(0, 10)
  const year = days.filter(d => d.date > fromDay)
  if (year.length < GOLD_YEAR_MIN_DAYS) return null
  return year.reduce((s, d) => s + d.price22k, 0) / year.length
}

// Fewer points for a long chart, keeping each stretch's real high and low
export function thinGoldHistory(days: GoldDayPrice[], max = 160): GoldDayPrice[] {
  if (days.length <= max) return days
  const buckets = Math.floor((max - 2) / 2)
  const kept = new Set<GoldDayPrice>([days[0], days[days.length - 1]])
  for (let b = 0; b < buckets; b++) {
    const part = days.slice(Math.floor(b * days.length / buckets), Math.floor((b + 1) * days.length / buckets))
    kept.add(part.reduce((lo, d) => d.price22k < lo.price22k ? d : lo))
    kept.add(part.reduce((hi, d) => d.price22k > hi.price22k ? d : hi))
  }
  return days.filter(d => kept.has(d))
}

export interface GoldBuy {
  id: string
  date: string
  grams: number
  karat: 18 | 22 | 24
  pricePerGram: number
}

// Every gold purchase with a real date and price, oldest first. Saved transactions keep the
// original grams, so gold that has since been sold still shows; holdings add the manual lots.
export function goldBuys(assets: Asset[], transactions: Transaction[]): { buys: GoldBuy[]; unplotted: number } {
  const isDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d)
  const buys: GoldBuy[] = []
  const fromTransactions = new Set<string>()
  let unplotted = 0

  for (const t of transactions) {
    if (!t.goldGrams || t.goldGrams <= 0) continue
    if (t.transferKind === 'savings_withdrawal' || t.transferKind === 'ef_withdrawal') continue
    fromTransactions.add(t.id)
    const date = (t.date ?? '').slice(0, 10)
    if (!(t.goldPricePerGram && t.goldPricePerGram > 0) || !isDay(date)) { unplotted++; continue }
    buys.push({ id: t.id, date, grams: t.goldGrams, karat: t.goldKarat ?? 22, pricePerGram: t.goldPricePerGram })
  }

  for (const a of assets) {
    if (a.kind !== 'gold_grams') continue
    // A holding from before per-purchase tracking has no real purchase date
    if (!a.goldPurchases?.length) { if (a.value > 0) unplotted++; continue }
    for (const p of a.goldPurchases) {
      if (p.grams <= 0 || (p.transactionId && fromTransactions.has(p.transactionId))) continue
      const date = (p.date ?? '').slice(0, 10)
      if (!(p.pricePerGram > 0) || !isDay(date)) { unplotted++; continue }
      if (buys.some(b => b.date === date && b.karat === p.karat && b.grams === p.grams && b.pricePerGram === p.pricePerGram)) continue
      buys.push({ id: `${a.id}-${p.id}`, date, grams: p.grams, karat: p.karat, pricePerGram: p.pricePerGram })
    }
  }

  return { buys: buys.sort((x, y) => x.date.localeCompare(y.date)), unplotted }
}

export function priceForKarat(karat: 18 | 22 | 24, prices: GoldPrices): number {
  return karat === 24 ? prices.price24k : karat === 18 ? prices.price18k : prices.price22k
}

export const GRAMS_PER_SOVEREIGN = 8

// Every karat is priced from the 22K rate by purity, so all gold screens agree
export function goldPricesFrom22k(price22k: number): GoldPrices {
  return {
    price22k,
    price24k: parseFloat((price22k * 24 / 22).toFixed(2)),
    price18k: parseFloat((price22k * 18 / 22).toFixed(2)),
  }
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
