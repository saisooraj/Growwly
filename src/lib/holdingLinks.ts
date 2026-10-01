import type { Asset, AssetContribution, AssetKind, GoldPurchase, PpfDeposit } from '@/types'
import { legacyGoldPurchases, applyGoldPurchase, goldPurchaseTotals } from '@/lib/gold'
import { computePpfBalance } from '@/lib/retirement'

// A savings transaction's money is counted in exactly one place: inside the holding it is
// linked to, or in the Savings & Investments card while it is unlinked. The link lives only
// on the holding (a gold lot, a PPF deposit, or a contributions entry carrying the
// transaction id), so linking and unlinking are single-document writes.

export const LINKABLE_KINDS: AssetKind[] = ['mutual_fund', 'gold_grams', 'nps', 'ppf', 'epf', 'fd_rd', 'cash', 'other']

const VEHICLE_KINDS: Record<string, AssetKind[]> = {
  'gold': ['gold_grams'],
  'nps': ['nps'],
  'pf / epf': ['epf'],
  'ppf': ['ppf'],
  'sip / investments': ['mutual_fund'],
  'fixed deposit': ['fd_rd'],
  'recurring deposit': ['fd_rd'],
}

// 'add' puts new money into the holding; 'included' attributes money the holding's balance
// already contains, leaving its total unchanged.
export type LinkMode = 'add' | 'included'

export interface LinkInput {
  transactionId: string
  date: string
  amount: number
  direction: 'in' | 'out'
  units?: number
  schemeCode?: string
  grams?: number
  karat?: 18 | 22 | 24
  pricePerGram?: number
}

export type LinkResult = { patch: Partial<Asset> } | { error: string }

export interface LinkSummary {
  unit: '₹' | 'g'
  total: number
  linked: number
  historical: number
  count: number
}

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp

export function isLinkable(asset: Asset): boolean {
  return LINKABLE_KINDS.includes(asset.kind)
}

export function vehicleKinds(vehicle: string): AssetKind[] {
  return VEHICLE_KINDS[vehicle.trim().toLowerCase()] ?? []
}

// The holding a brand-new transaction for this vehicle should go to — only when unambiguous.
export function defaultHoldingFor(vehicle: string, assets: Asset[]): Asset | undefined {
  const kinds = vehicleKinds(vehicle)
  const matches = assets.filter(a => kinds.includes(a.kind))
  return matches.length === 1 ? matches[0] : undefined
}

export function linkedTransactionIds(assets: Asset[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const a of assets) {
    for (const p of a.goldPurchases ?? []) if (p.transactionId) map.set(p.transactionId, a.id)
    for (const d of a.ppfDeposits ?? []) if (d.transactionId) map.set(d.transactionId, a.id)
    for (const c of a.contributions ?? []) map.set(c.transactionId, a.id)
  }
  return map
}

export function findLinkedAsset(assets: Asset[], transactionId: string): Asset | undefined {
  const assetId = linkedTransactionIds(assets).get(transactionId)
  return assetId ? assets.find(a => a.id === assetId) : undefined
}

export function linkedContribution(asset: Asset, transactionId: string): AssetContribution | undefined {
  return asset.contributions?.find(c => c.transactionId === transactionId)
}

// Entries written before the flag existed were all already-in-balance links.
const isIncluded = (c: AssetContribution) => c.included !== false

// ── Per-kind helpers ──────────────────────────────────────────────────────────

// Lots stay in date order: a sale consumes them oldest-first, by position.
function goldPatch(lots: GoldPurchase[]): Partial<Asset> {
  const sorted = [...lots].sort((a, b) => a.date.localeCompare(b.date))
  const { totalGrams, totalInvested } = goldPurchaseTotals(sorted)
  return { goldPurchases: sorted, value: round(totalGrams, 3), investedAmount: round(totalInvested, 2) }
}

// Take grams out of the unlinked (historical) lots of one karat, oldest first.
function carveUnlinkedGold(lots: GoldPurchase[], grams: number, karat: 18 | 22 | 24): GoldPurchase[] | null {
  let remaining = grams
  const out: GoldPurchase[] = []
  for (const p of lots) {
    if (remaining <= 1e-9 || p.transactionId || p.karat !== karat) { out.push(p); continue }
    if (p.grams <= remaining + 1e-9) { remaining -= p.grams; continue }
    out.push({ ...p, grams: round(p.grams - remaining, 3) })
    remaining = 0
  }
  return remaining > 1e-6 ? null : out
}

// A PPF holding saved without a deposit log still has a balance — keep it as one deposit.
function ppfDepositsOf(asset: Asset): PpfDeposit[] {
  if (asset.ppfDeposits?.length) return asset.ppfDeposits
  if (asset.value <= 0) return []
  return [{ date: (asset.createdAt || new Date().toISOString()).slice(0, 10), amount: asset.value }]
}

function ppfPatch(asset: Asset, deposits: PpfDeposit[]): Partial<Asset> {
  const p = computePpfBalance({ startDate: asset.ppfStartDate, deposits, rateOverride: asset.annualRate })
  return { ppfDeposits: deposits, value: p.balance, investedAmount: p.totalDeposited }
}

// Rupee-balance kinds (everything except gold and PPF): the amount the holding is "made of".
function flatBase(asset: Asset): number {
  return asset.investedAmount ?? asset.value
}

function flatDelta(asset: Asset, entry: AssetContribution, dir: 1 | -1): Partial<Asset> {
  const amount = dir * entry.amount
  if (asset.kind === 'mutual_fund') {
    const invested = Math.max(0, round((asset.investedAmount ?? asset.value) + amount, 2))
    return {
      investedAmount: invested,
      value: invested,
      ...(entry.units ? { units: Math.max(0, round((asset.units ?? 0) + dir * entry.units, 4)) } : {}),
    }
  }
  const patch: Partial<Asset> = { value: Math.max(0, round(asset.value + amount, 2)) }
  if (asset.investedAmount !== undefined) patch.investedAmount = Math.max(0, round(asset.investedAmount + amount, 2))
  if (asset.kind === 'nps' && entry.units && entry.schemeCode && asset.npsHoldings?.length) {
    const units = entry.units
    patch.npsHoldings = asset.npsHoldings.map(h =>
      h.schemeCode === entry.schemeCode ? { ...h, units: Math.max(0, round(h.units + dir * units, 4)) } : h
    )
  }
  return patch
}

// ── Link / unlink ─────────────────────────────────────────────────────────────

export function applyLink(asset: Asset, input: LinkInput, mode: LinkMode): LinkResult {
  if (!isLinkable(asset)) return { error: 'This kind of holding can’t be linked to a transaction.' }
  if (!(input.amount > 0)) return { error: 'Enter an amount first.' }

  if (asset.kind === 'gold_grams') {
    if (!input.grams || input.grams <= 0) return { error: 'Enter the grams to link this to a gold holding.' }
    const karat = input.karat ?? 22
    const lot = { grams: input.grams, karat, pricePerGram: input.pricePerGram ?? 0, date: input.date, transactionId: input.transactionId }
    let lots = legacyGoldPurchases(asset)
    if (input.direction === 'in') {
      if (mode === 'included') {
        const carved = carveUnlinkedGold(lots, input.grams, karat)
        if (!carved) return { error: `This holding has less than ${input.grams}g of unlinked ${karat}K gold. Choose "New money" instead.` }
        lots = carved
      }
      lots = applyGoldPurchase(lots, lot, 'buy')
      if (mode === 'included') lots = lots.map(p => p.transactionId === input.transactionId ? { ...p, included: true } : p)
      return { patch: goldPatch(lots) }
    }
    if (mode === 'add') lots = applyGoldPurchase(lots, lot, 'sell')
    const entry: AssetContribution = { transactionId: input.transactionId, date: input.date, amount: -input.amount, grams: input.grams, karat, included: mode === 'included' }
    return { patch: { ...goldPatch(lots), contributions: [...(asset.contributions ?? []), entry] } }
  }

  if (asset.kind === 'ppf') {
    if (input.direction === 'out') return { error: 'PPF withdrawals can’t be linked. Adjust the deposits on the holding instead.' }
    let deposits = ppfDepositsOf(asset)
    if (mode === 'included') {
      let remaining = input.amount
      const out: PpfDeposit[] = []
      for (const d of deposits) {
        if (remaining <= 0 || d.transactionId || d.interest) { out.push(d); continue }
        if (d.amount <= remaining) { remaining -= d.amount; continue }
        out.push({ ...d, amount: round(d.amount - remaining, 2) })
        remaining = 0
      }
      if (remaining > 0) return { error: 'This holding’s unlinked deposits are smaller than this transaction. Choose "New money" instead.' }
      deposits = out
    }
    return { patch: ppfPatch(asset, [...deposits, { date: input.date, amount: input.amount, transactionId: input.transactionId, ...(mode === 'included' ? { included: true } : {}) }]) }
  }

  const sign = input.direction === 'in' ? 1 : -1
  const entry: AssetContribution = {
    transactionId: input.transactionId,
    date: input.date,
    amount: sign * input.amount,
    ...(input.units ? { units: sign * input.units } : {}),
    ...(input.units && input.schemeCode ? { schemeCode: input.schemeCode } : {}),
    included: mode === 'included',
  }
  const contributions = [...(asset.contributions ?? []), entry]
  if (mode === 'included') {
    const linked = contributions.reduce((s, c) => s + c.amount, 0)
    if (linked > flatBase(asset) + 0.005) {
      return { error: 'Linked transactions would add up to more than this holding’s balance. Update the holding’s total first, or choose "New money".' }
    }
    return { patch: { contributions } }
  }
  return { patch: { ...flatDelta(asset, entry, 1), contributions } }
}

// Undo a link — the exact inverse of applyLink. Money that linking added is taken back out;
// money the holding already contained stays, and merely stops being attributed to the
// transaction. Re-applying `restore` in `mode` puts the link back as it was.
export function removeLink(
  asset: Asset,
  transactionId: string
): { patch: Partial<Asset>; restore: LinkInput; mode: LinkMode; warning?: string } | null {
  const lot = asset.goldPurchases?.find(p => p.transactionId === transactionId)
  if (lot) {
    const lots = lot.included
      ? asset.goldPurchases!.map(p => p.transactionId === transactionId
          ? { id: p.id, date: p.date, grams: p.grams, karat: p.karat, pricePerGram: p.pricePerGram }
          : p)
      : asset.goldPurchases!.filter(p => p.transactionId !== transactionId)
    return {
      patch: goldPatch(lots),
      mode: lot.included ? 'included' : 'add',
      restore: { transactionId, date: lot.date, amount: round(lot.grams * lot.pricePerGram, 2), direction: 'in', grams: lot.grams, karat: lot.karat, pricePerGram: lot.pricePerGram },
    }
  }

  const deposit = asset.ppfDeposits?.find(d => d.transactionId === transactionId)
  if (deposit) {
    const deposits = deposit.included
      ? asset.ppfDeposits!.map(d => d.transactionId === transactionId ? { date: d.date, amount: d.amount } : d)
      : asset.ppfDeposits!.filter(d => d.transactionId !== transactionId)
    return {
      patch: ppfPatch(asset, deposits),
      mode: deposit.included ? 'included' : 'add',
      restore: { transactionId, date: deposit.date, amount: deposit.amount, direction: 'in' },
    }
  }

  const entry = linkedContribution(asset, transactionId)
  if (!entry) return null
  const contributions = asset.contributions!.filter(c => c.transactionId !== transactionId)
  const restore: LinkInput = {
    transactionId,
    date: entry.date,
    amount: Math.abs(entry.amount),
    direction: entry.amount >= 0 ? 'in' : 'out',
    ...(entry.units ? { units: Math.abs(entry.units) } : {}),
    ...(entry.schemeCode ? { schemeCode: entry.schemeCode } : {}),
    ...(entry.grams ? { grams: entry.grams } : {}),
    ...(entry.karat ? { karat: entry.karat } : {}),
  }
  if (asset.kind === 'gold_grams') {
    // A sale consumed lots oldest-first; which ones is not recorded, so they can't be rebuilt.
    return {
      patch: { contributions }, restore, mode: isIncluded(entry) ? 'included' : 'add',
      ...(isIncluded(entry) ? {} : { warning: 'The gold sold was not put back. Re-add those grams on the holding if the sale never happened.' }),
    }
  }
  if (isIncluded(entry)) return { patch: { contributions }, restore, mode: 'included' }
  return { patch: { ...flatDelta(asset, entry, -1), contributions }, restore, mode: 'add' }
}

export function linkSummary(asset: Asset): LinkSummary {
  if (asset.kind === 'gold_grams') {
    const lots = legacyGoldPurchases(asset)
    const linkedLots = lots.filter(p => p.transactionId)
    const total = lots.reduce((s, p) => s + p.grams, 0)
    const linked = linkedLots.reduce((s, p) => s + p.grams, 0)
    return { unit: 'g', total: round(total, 3), linked: round(linked, 3), historical: round(total - linked, 3), count: linkedLots.length }
  }
  if (asset.kind === 'ppf') {
    const deposits = ppfDepositsOf(asset).filter(d => !d.interest)
    const linkedDeposits = deposits.filter(d => d.transactionId)
    const total = deposits.reduce((s, d) => s + d.amount, 0)
    const linked = linkedDeposits.reduce((s, d) => s + d.amount, 0)
    return { unit: '₹', total, linked, historical: round(total - linked, 2), count: linkedDeposits.length }
  }
  const contributions = asset.contributions ?? []
  const total = flatBase(asset)
  const linked = contributions.reduce((s, c) => s + c.amount, 0)
  return { unit: '₹', total, linked, historical: round(total - linked, 2), count: contributions.length }
}
