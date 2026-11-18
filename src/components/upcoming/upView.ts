import { CATEGORY_COLORS } from '@/lib/utils'
import { getCategoryDisplayName } from '@/lib/categoryIcons'
import type { UpcomingExpense, UpcomingPayment } from '@/types'

// What happens when a "Repeats monthly" item is settled: 'prompt' offers to add next month's,
// 'auto' adds it straight away
export const RECURRING_MODE: 'prompt' | 'auto' = 'prompt'

export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MS = 86400000

export const pd = (s: string) => { const [a, b, c] = s.split('-').map(Number); return new Date(a, b - 1, c) }
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const todayIso = () => iso(new Date())
export const addDays = (s: string, n: number) => { const d = pd(s); d.setDate(d.getDate() + n); return iso(d) }
/** Calendar days from today to s (negative when s is in the past) */
export const daysTo = (s: string, today: string) => Math.round((pd(s).getTime() - pd(today).getTime()) / MS)
/** "Nov 17", or "Jan 15, 2027" outside the current year */
export const sh = (s: string) => { const d = pd(s); return `${MON[d.getMonth()]} ${d.getDate()}${d.getFullYear() !== new Date().getFullYear() ? `, ${d.getFullYear()}` : ''}` }
export const wsh = (s: string) => `${WD[pd(s).getDay()]}, ${sh(s)}`
export const fullD = (s: string) => { const d = pd(s); return `${WD[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` }
export const monthName = (s: string) => MONTHS[pd(s).getMonth()]
/** Same day next month, clamped to the month's last day */
export const nextMonth = (s: string) => {
  const d = pd(s)
  const t = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
  t.setDate(Math.min(d.getDate(), last))
  return iso(t)
}
export const endOfMonth = (s: string) => { const d = pd(s); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }
export const firstOfNextMonth = (s: string) => { const d = pd(s); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 1)) }

export const num = (v: string | number | undefined) => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0 }
export const r2 = (n: number) => Math.round(n * 100) / 100
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const NF0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const NF2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const plainInr = (n: number) => `₹${Number.isInteger(n) ? NF0.format(n) : NF2.format(n)}`

/** "₹1.25 crore" / "₹4.5 lakh", empty below a lakh */
export const words = (n: number) => {
  const t = (x: number) => x.toFixed(2).replace(/\.?0+$/, '')
  if (n >= 1e7) return `₹${t(n / 1e7)} crore`
  if (n >= 1e5) return `₹${t(n / 1e5)} lakh`
  return ''
}

export const MASK = '₹••••'
/** ₹ formatter that honours the privacy mask. `round` drops paise (totals). */
export function makeMoney(masked: boolean) {
  const money = (n: number, round?: boolean) => {
    if (masked) return MASK
    if (n > 0 && n < 1) return '<₹1'
    return `₹${round || Number.isInteger(r2(n)) ? NF0.format(Math.round(n)) : NF2.format(n)}`
  }
  const signed = (n: number) => `${n >= 0 ? '+' : '−'}${money(Math.abs(n), true)}`
  return { money, signed }
}

export const catColor = (c?: string) => (c && CATEGORY_COLORS[c]) || 'var(--text-4)'
export const catName = (c?: string) => (c ? getCategoryDisplayName(c) : 'Uncategorised')

export interface Derived {
  it: UpcomingExpense
  ps: UpcomingPayment[]   // newest first
  paid: number
  remaining: number
  settled: boolean
  d: number               // days until due
  inc: boolean
  last?: string           // latest payment date
}

export function derive(it: UpcomingExpense, payments: UpcomingPayment[], today: string): Derived {
  const ps = payments.filter(p => p.upcomingId === it.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const paid = r2(ps.reduce((a, p) => a + p.amount, 0))
  return {
    it, ps, paid,
    remaining: Math.max(0, r2(it.amount - paid)),
    settled: it.amount > 0 && paid >= it.amount,
    d: daysTo(it.dueDate, today),
    inc: it.flowType === 'income',
    last: ps[0]?.date,
  }
}

/** Due line for a row: "Overdue · Nov 3", "Due tomorrow", "Expected Tue, Nov 18"… */
export function dueText(x: Pick<Derived, 'd' | 'inc'>, due: string, weekday = true) {
  const { d, inc } = x
  if (inc) return d < 0 ? `Was expected ${sh(due)}` : d === 0 ? 'Expected today' : d === 1 ? 'Expected tomorrow' : d <= 7 && weekday ? `Expected ${wsh(due)}` : `Expected by ${sh(due)}`
  return d < 0 ? `Overdue · ${sh(due)}` : d === 0 ? 'Due today' : d === 1 ? 'Due tomorrow' : d <= 7 && weekday ? `Due ${wsh(due)}` : `Due ${sh(due)}`
}
