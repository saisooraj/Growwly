// View helpers shared by the transactions page, its rows and the detail sheet:
// what kind of movement a row is, how it reads, and how a day adds up.

import type { CSSProperties, ReactNode } from 'react'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { ArrowDownLeft, ArrowUpRight, Undo2 } from 'lucide-react'
import type { Asset, Borrowing, Transaction, UserSettings } from '@/types'
import { CATEGORY_COLORS, EMERGENCY_FUND_VEHICLE, formatCurrencyFull, getTransferDisplay, isSavingsTransfer } from '@/lib/utils'
import { CategoryIcon, getCategoryDisplayName, getSavingsVehicleMeta } from '@/lib/categoryIcons'
import { findLinkedAsset } from '@/lib/holdingLinks'
import { fuelFillFor, isFuelExpense } from '@/lib/fuel'

export const MONO = "'Geist Mono', ui-monospace, monospace"
export const MASK = '₹ •••'
export const R = (n: number) => formatCurrencyFull(Math.abs(n))
/** Swap every rupee figure in a sentence for the mask */
export const mask = (s: string, reveal: boolean) => (reveal ? s : s.replace(/₹[\d,.]+/g, MASK))

// Synthetic row type — Transaction extended with borrowing / refund metadata
export type ViewTx = Transaction & { _borrowDir?: 'lent' | 'borrowed'; _person?: string; _refundedAmount?: number }

export function borrowingToViewTx(b: Borrowing): ViewTx {
  return {
    id: `borrow-${b.id}`,
    userId: b.userId,
    type: b.type === 'lent' ? 'expense' : 'income',
    amount: b.amount,
    category: b.type === 'lent' ? 'Lent' : 'Borrowed',
    date: b.date,
    notes: b.description ?? '',
    createdAt: b.createdAt,
    borrowingId: b.id,
    _borrowDir: b.type as 'lent' | 'borrowed',
    _person: b.person,
  }
}

// ── Kinds ─────────────────────────────────────────────────────────────────────

export type Kind = 'exp' | 'inc' | 'ref' | 'lent' | 'borr' | 'sav' | 'savout' | 'tin' | 'tout'
export type Tone = 'good' | 'warn' | 'bad' | 'info' | 'wants' | 'neutral'

export function kindOf(tx: ViewTx): Kind {
  if (tx._borrowDir) return tx._borrowDir === 'lent' ? 'lent' : 'borr'
  if (tx.type === 'refund') return 'ref'
  if (tx.type === 'income') return 'inc'
  if (tx.type === 'expense') return 'exp'
  switch (tx.transferKind) {
    case 'savings_contribution': case 'savings_transfer': return 'sav'
    case 'savings_withdrawal': case 'ef_withdrawal': return 'savout'
    case 'loan_given': return 'lent'
    case 'loan_repayment_received': return 'tin'
    case 'loan_repayment_paid': return 'tout'
  }
  return getTransferDisplay(tx).dir === 'in' ? 'tin' : 'tout'
}

export const KIND: Record<Kind, { sign: '+' | '−'; col: string; pill: [string, Tone] }> = {
  exp:    { sign: '−', col: 'var(--t1)',       pill: ['Expense', 'neutral'] },
  inc:    { sign: '+', col: 'var(--good-ink)', pill: ['Income', 'good'] },
  ref:    { sign: '+', col: 'var(--good-ink)', pill: ['Refund', 'good'] },
  lent:   { sign: '−', col: 'var(--warn-ink)', pill: ['Lent', 'warn'] },
  borr:   { sign: '+', col: 'var(--info-ink)', pill: ['Borrowed', 'info'] },
  sav:    { sign: '−', col: 'var(--t2)',       pill: ['Savings', 'good'] },
  savout: { sign: '+', col: 'var(--t2)',       pill: ['Withdrawal', 'neutral'] },
  tin:    { sign: '+', col: 'var(--good-ink)', pill: ['Repayment received', 'info'] },
  tout:   { sign: '−', col: 'var(--t1)',       pill: ['Loan repaid', 'info'] },
}

export const TONE: Record<Tone, [string, string]> = {
  good: ['var(--good-soft)', 'var(--good-ink)'], warn: ['var(--warn-soft)', 'var(--warn-ink)'],
  bad: ['var(--bad-soft)', 'var(--bad-ink)'], info: ['var(--info-soft)', 'var(--info-ink)'],
  wants: ['var(--wants-soft)', 'var(--wants-ink)'], neutral: ['var(--s2)', 'var(--t2)'],
}

const BADGE: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, height: 20, padding: '0 7px', borderRadius: 999,
  fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', lineHeight: 1,
}
export const badgeStyle = (tone: Tone): CSSProperties => ({ ...BADGE, background: TONE[tone][0], color: TONE[tone][1] })
export const pillStyle = (tone: Tone, big = false): CSSProperties => ({
  ...BADGE, height: big ? 26 : 22, padding: big ? '0 10px' : '0 8px', fontSize: big ? 12 : 11,
  background: TONE[tone][0], color: TONE[tone][1],
})

// ── Look: avatar, icon, title ─────────────────────────────────────────────────

export interface Look { name: string; color: string; initial?: string; icon?: (size: number) => ReactNode }

export function lookOf(tx: ViewTx, k: Kind = kindOf(tx)): Look {
  if (k === 'exp' || k === 'inc' || k === 'ref') {
    const color = CATEGORY_COLORS[tx.category] ?? '#94a3b8'
    return {
      name: getCategoryDisplayName(tx.category), color,
      icon: k === 'ref'
        ? s => <Undo2 size={s} color={color} />
        : s => <CategoryIcon category={tx.category} size={s} color={color} stroke={2} />,
    }
  }
  if (k === 'sav' || k === 'savout') {
    const vehicle = tx.savingsVehicle || (tx.transferKind === 'ef_withdrawal' ? EMERGENCY_FUND_VEHICLE : 'Savings')
    const meta = getSavingsVehicleMeta(vehicle)
    return { name: vehicle, color: meta.color, icon: s => <meta.Icon size={s} color={meta.color} stroke={2} /> }
  }
  if (k === 'lent' || k === 'borr') {
    const person = tx._person ?? tx.loanPerson ?? (k === 'lent' ? 'Lent' : 'Borrowed')
    return { name: person, color: k === 'lent' ? '#f59e0b' : '#3b82f6', initial: person.trim().charAt(0).toUpperCase() || '?' }
  }
  if (k === 'tin') return { name: 'Repayment Received', color: '#10b981', icon: s => <ArrowDownLeft size={s} color="#10b981" /> }
  return { name: getTransferDisplay(tx).label === 'Transfer' ? 'Transfer' : 'Loan Repaid', color: '#64748b', icon: s => <ArrowUpRight size={s} color="#64748b" /> }
}

export const titleOf = (k: Kind, look: Look) =>
  k === 'ref' ? `${look.name} Refund` : k === 'savout' ? `${look.name} withdrawal` : look.name

export const avatarStyle = (color: string, size = 44, radius = 13): CSSProperties => ({
  width: size, height: size, flex: 'none', borderRadius: radius, display: 'grid', placeItems: 'center',
  background: `color-mix(in oklch, ${color} 16%, var(--surface))`,
})
export const initialStyle = (color: string): CSSProperties => ({
  fontSize: 16, fontWeight: 700, color: `color-mix(in oklch, ${color} 70%, var(--t1))`,
})

// ── Row model ─────────────────────────────────────────────────────────────────

export interface Seg { text: string; style?: CSSProperties }
export interface RowModel {
  id: string
  kind: Kind
  title: string
  look: Look
  badges: { label: string; tone: Tone; repeat?: boolean }[]
  lines: { segs: Seg[]; clamp?: boolean }[]
  tags: string[]
  more: string | null
  amount: string
  amountColor: string
  fullyRefunded: boolean
  net: string | null
}

export const SEP: Seg = { text: ' · ', style: { color: 'var(--t4)' } }
const num = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 })

interface RowCtx { assets: Asset[]; transactions: Transaction[]; settings: UserSettings | null }

export function rowModel(tx: ViewTx, ctx: RowCtx): RowModel {
  const k = kindOf(tx)
  const look = lookOf(tx, k)
  const K = KIND[k]

  const badges: RowModel['badges'] = []
  if (k === 'lent') badges.push({ label: 'lent', tone: 'warn' })
  if (k === 'borr') badges.push({ label: 'borrowed', tone: 'info' })
  if (k === 'sav') badges.push({ label: 'savings', tone: 'good' })
  if (k === 'savout') badges.push({ label: 'withdrawal', tone: 'neutral' })
  if (k === 'tin' || k === 'tout') badges.push({ label: 'transfer', tone: 'info' })
  if (tx.settledPerson) badges.push({ label: `via ${tx.settledPerson}`, tone: 'wants' })
  if (tx.isRecurring) badges.push({ label: 'recurring', tone: 'neutral', repeat: true })
  if (tx._refundedAmount) badges.push({ label: `↺ refunded ${R(tx._refundedAmount)}`, tone: 'good' })

  const lines: RowModel['lines'] = []
  if (k === 'tin' && tx.loanPerson) lines.push({ segs: [{ text: `from ${tx.loanPerson}` }] })
  if (k === 'tout' && tx.loanPerson) lines.push({ segs: [{ text: `to ${tx.loanPerson}` }] })
  const note = tx.notes?.trim()
  if (note) lines.push({ segs: [{ text: note }], clamp: true })
  if (tx.goldGrams) {
    const segs: Seg[] = [{ text: `${tx.goldGrams}g` }, SEP, { text: `${tx.goldKarat ?? 22}K` }]
    if (tx.goldPricePerGram) segs.push(SEP, { text: `₹${num(tx.goldPricePerGram)}/g` })
    lines.push({ segs })
  }
  if (isFuelExpense(tx) && tx.fuelLitres) {
    const vehicle = ctx.settings?.vehicles?.find(v => v.id === tx.vehicleId)?.name
      ?? (ctx.settings?.vehicles?.length === 1 ? ctx.settings.vehicles[0].name : undefined)
    const segs: Seg[] = []
    const push = (s: Seg) => { if (segs.length) segs.push(SEP); segs.push(s) }
    if (vehicle) push({ text: vehicle })
    push({ text: `${tx.fuelLitres} L` })
    if (tx.fuelPricePerLitre) push({ text: `₹${num(tx.fuelPricePerLitre)}/L` })
    if (tx.fuelDiscount) push({ text: `₹${num(tx.fuelDiscount)} off` })
    const kmpl = fuelFillFor(ctx.transactions, ctx.settings, tx.id)?.kmPerLitre
    if (kmpl) push({ text: `${kmpl.toFixed(1)} km/l`, style: { color: 'var(--good-ink)', fontWeight: 700 } })
    lines.push({ segs })
  }
  if (k === 'sav' || k === 'savout') {
    const asset = findLinkedAsset(ctx.assets, tx.id)
    if (asset) lines.push({ segs: [{ text: '→ ', style: { color: 'var(--t3)' } }, { text: asset.name || 'Gold' }] })
  }

  const allTags = tx.tags ?? []
  const fully = !!tx._refundedAmount && tx._refundedAmount >= tx.amount
  return {
    id: tx.id, kind: k, title: titleOf(k, look), look, badges, lines,
    tags: allTags.slice(0, 3).map(t => `#${t}`),
    more: allTags.length > 3 ? `+${allTags.length - 3}` : null,
    amount: `${K.sign}${R(tx.amount)}`,
    amountColor: fully ? 'var(--t3)' : K.col,
    fullyRefunded: fully,
    net: tx._refundedAmount ? `net ${R(Math.max(0, tx.amount - tx._refundedAmount))}` : null,
  }
}

// ── Days ──────────────────────────────────────────────────────────────────────

export function dayLabel(dateStr: string): string {
  const d = parseISO(dateStr)
  if (isToday(d)) return `Today · ${format(d, 'MMM d')}`
  if (isYesterday(d)) return `Yesterday · ${format(d, 'MMM d')}`
  return format(d, d.getFullYear() === new Date().getFullYear() ? 'EEE, MMM d' : 'EEE, MMM d, yyyy')
}

export interface DayTotal { text: string; color: string }

export function dayTotals(txs: ViewTx[]): DayTotal[] {
  let inc = 0, ref = 0, spent = 0, saved = 0
  for (const t of txs) {
    const k = kindOf(t)
    if (k === 'inc' || k === 'tin') inc += t.amount
    else if (k === 'ref') ref += t.amount
    else if (k === 'exp') spent += t.amount
    else if (k === 'sav') saved += t.amount
  }
  const out: DayTotal[] = []
  if (inc) out.push({ text: `↓ ${R(inc)} in`, color: 'var(--good-ink)' })
  if (ref) out.push({ text: `↺ ${R(ref)} refunded`, color: 'var(--good-ink)' })
  if (spent) out.push({ text: `↑ ${R(spent)} spent`, color: 'var(--bad-ink)' })
  if (saved) out.push({ text: `↑ ${R(saved)} saved`, color: 'var(--warn-ink)' })
  return out
}

// ── Search ────────────────────────────────────────────────────────────────────

export function matchesQuery(t: ViewTx, q: string, assets: Asset[]): boolean {
  q = q.toLowerCase()
  const k = kindOf(t)
  const holding = isSavingsTransfer(t) ? findLinkedAsset(assets, t.id)?.name : undefined
  const hay = [
    t.notes, t.category, getCategoryDisplayName(t.category ?? ''), String(t.amount), num(t.amount),
    KIND[k].pill[0], (t.transferKind ?? '').replace(/_/g, ' '), t.savingsVehicle, holding,
    t._person, t.loanPerson, t.settledPerson, ...(t.tags ?? []).map(x => `#${x}`),
  ].filter(Boolean).join(' ').toLowerCase()
  if (hay.includes(q)) return true
  const digits = q.replace(/[₹,\s]/g, '')
  return digits.length > 1 && /^\d+$/.test(digits) && String(t.amount).includes(digits)
}
