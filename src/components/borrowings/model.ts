import type { Borrowing, Contact, Transaction } from '@/types'

// ── Dates & money ─────────────────────────────────────────────────────────────

export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const pd = (s: string) => { const a = s.split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]) }
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const todayISO = () => iso(new Date())
/** "17 Nov", or "17 Nov 2025" outside the current year */
export const fd = (s: string) => {
  if (!s) return ''
  const d = pd(s)
  return `${d.getDate()} ${MON[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`
}
/** Whole days from today to `s` (negative = in the past) */
export const dd = (s: string) => Math.round((pd(s).getTime() - pd(todayISO()).getTime()) / 864e5)
export const inr = (n: number) => '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN')
export const addM = (s: string, k: number) => { const d = pd(s); return iso(new Date(d.getFullYear(), d.getMonth() + k, d.getDate())) }
export const emiOf = (p: number, rate: number, n: number) => {
  if (!p || !n) return 0
  const r = rate / 1200
  if (!r) return Math.round(p / n)
  const f = Math.pow(1 + r, n)
  return Math.round(p * r * f / (f - 1))
}
/** "2.5 lakh" / "1.25 crore" under the amount field; nothing below a lakh */
export const words = (n: number) => {
  if (!n) return ''
  if (n >= 1e7) return (n / 1e7).toFixed(n % 1e7 ? 2 : 0) + ' crore'
  if (n >= 1e5) return (n / 1e5).toFixed(n % 1e5 ? 2 : 0) + ' lakh'
  return ''
}

// ── People ────────────────────────────────────────────────────────────────────

export const nkey = (s: string) => (s || '').trim().toLowerCase()
export const firstName = (n: string) => { const t = (n || '').trim(); return /^(mom|dad|papa|mummy)$/i.test(t) ? t : t.split(/\s+/)[0] }
export const initialOf = (n: string) => (Array.from((n || '?').trim())[0] || '?').toUpperCase()
const HUES = [158, 24, 250, 70, 300, 200, 340, 110]
const hueOf = (n: string) => { let h = 7; for (const ch of nkey(n)) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0; return HUES[h % HUES.length] }
export const avatar = (name: string, dark: boolean) => {
  const h = hueOf(name)
  return dark
    ? { avBg: `oklch(0.33 0.06 ${h})`, avInk: `oklch(0.88 0.08 ${h})` }
    : { avBg: `oklch(0.92 0.05 ${h})`, avInk: `oklch(0.4 0.1 ${h})` }
}

// ── Records ───────────────────────────────────────────────────────────────────

export interface Settlement { kind: 'repay' | 'expense'; title: string; amount: number; date: string; id: string }
export interface Loan { rate: number; tenure: number; emi: number }
export interface Rec {
  id: string; person: string; type: 'lent' | 'borrowed'; amount: number; repaid: number
  desc: string; date: string; due: string; loan: Loan | null; settlements: Settlement[]; closed: boolean; b: Borrowing
}
export interface DRec extends Rec {
  out: number; isOpen: boolean; partial: boolean; monthsPaid: number; monthsLeft: number; nextEmi: string
  eff: string; dueDays: number | null; overdue: boolean; soon: boolean; settledOn: string
}
export interface Person {
  key: string; name: string; phone: string; isContact: boolean; contact: Contact | null; records: DRec[]
  lent: number; owe: number; net: number; open: DRec[]; settled: DRec[]; openCount: number
  overdueX?: DRec; soonX?: DRec; nearestDue: string; oldest: string; last: string
}

/** Borrowings with their settlements: repayments linked by borrowingId, and expenses that settled them */
export function toRecs(borrowings: Borrowing[], transactions: Transaction[]): Rec[] {
  const lentById = new Map(borrowings.map(b => [b.id, b.type === 'lent']))
  const byId = new Map<string, Settlement[]>()
  for (const t of transactions) {
    const isSettle = !!(t.settledBorrowingId || t.settledPerson || t.settledAllocation)
    const ids = new Set<string>()
    if (t.borrowingId && t.transferKind !== 'loan_given') ids.add(t.borrowingId)
    if (t.settledBorrowingId) ids.add(t.settledBorrowingId)
    if (t.settledAllocation) Object.keys(t.settledAllocation).forEach(k => ids.add(k))
    for (const id of Array.from(ids)) {
      if (!lentById.has(id)) continue
      const s: Settlement = isSettle
        ? { kind: 'expense', id: t.id, date: t.date, amount: t.settledAllocation?.[id] ?? t.settledAmount ?? t.amount,
            title: t.category ? `${t.category}${t.notes ? ` · ${t.notes}` : ''}` : t.notes || 'Expense' }
        : { kind: 'repay', id: t.id, date: t.date, amount: t.amount,
            title: t.notes || (lentById.get(id) ? 'Repayment received' : 'Repayment made') }
      byId.set(id, [...(byId.get(id) ?? []), s])
    }
  }
  return borrowings.map(b => {
    const rate = b.interestRate ?? 0, tenure = b.tenureMonths ?? 0
    return {
      id: b.id, person: b.person, type: b.type, amount: b.amount, repaid: b.repaidAmount || 0,
      desc: b.description || '', date: b.date, due: b.dueDate || '',
      loan: b.isLoan ? { rate, tenure, emi: b.emiAmount || emiOf(b.amount, rate, tenure) } : null,
      settlements: byId.get(b.id) ?? [], closed: b.status === 'repaid', b,
    }
  })
}

export function derive(r: Rec): DRec {
  const out = Math.max(0, r.amount - (r.repaid || 0))
  const isOpen = out > 0 && !r.closed
  const partial = isOpen && r.repaid > 0
  let monthsPaid = 0, monthsLeft = 0, nextEmi = ''
  if (r.loan && r.loan.emi && r.loan.tenure) {
    monthsPaid = Math.min(r.loan.tenure, Math.floor((r.repaid || 0) / r.loan.emi))
    monthsLeft = r.loan.tenure - monthsPaid
    nextEmi = isOpen ? addM(r.date, monthsPaid + 1) : ''
  }
  const eff = r.loan ? nextEmi : r.due
  const dueDays = isOpen && eff ? dd(eff) : null
  const settledOn = r.settlements.reduce((a, s) => s.date > a ? s.date : a, '')
  return { ...r, out, isOpen, partial, monthsPaid, monthsLeft, nextEmi, eff, dueDays,
    overdue: dueDays !== null && dueDays < 0, soon: dueDays !== null && dueDays >= 0 && dueDays <= 7, settledOn }
}

export function dueText(x: DRec) {
  const p = x.loan ? 'EMI ' : ''
  const d = x.dueDays ?? 0
  if (x.overdue) { const n = -d; return `${x.loan ? 'EMI overdue' : 'Overdue'} · ${n}${n === 1 ? ' day' : ' days'}` }
  if (d === 0) return p + (p ? 'due today' : 'Due today')
  if (d === 1) return p + (p ? 'due tomorrow' : 'Due tomorrow')
  return `${p ? 'EMI due' : 'Due'} in ${d} days`
}

/** One entry per person: saved contacts plus names that only appear on records, matched without case */
export function groupPeople(records: Rec[], contacts: Contact[]): Person[] {
  const map = new Map<string, { key: string; name: string; phone: string; isContact: boolean; contact: Contact | null; records: DRec[] }>()
  for (const c of contacts) map.set(nkey(c.name), { key: nkey(c.name), name: c.name.trim(), phone: c.phone || '', isContact: true, contact: c, records: [] })
  for (const r of records) {
    const k = nkey(r.person)
    if (!map.has(k)) map.set(k, { key: k, name: r.person.trim(), phone: '', isContact: false, contact: null, records: [] })
    map.get(k)!.records.push(derive(r))
  }
  return Array.from(map.values()).map(p => {
    let lent = 0, owe = 0
    const open: DRec[] = [], settled: DRec[] = []
    for (const x of p.records) {
      if (x.isOpen) { open.push(x); if (x.type === 'lent') lent += x.out; else owe += x.out } else settled.push(x)
    }
    open.sort((a, b) => (+b.overdue - +a.overdue) || (+b.soon - +a.soon) || b.date.localeCompare(a.date))
    settled.sort((a, b) => (b.settledOn || b.date).localeCompare(a.settledOn || a.date))
    const overdueX = open.filter(x => x.overdue).sort((a, b) => (a.dueDays ?? 0) - (b.dueDays ?? 0))[0]
    const soonX = open.filter(x => x.soon).sort((a, b) => (a.dueDays ?? 0) - (b.dueDays ?? 0))[0]
    const dues = open.filter(x => x.eff).map(x => x.eff).sort()
    const oldest = open.map(x => x.date).sort()[0] || ''
    const last = p.records.map(x => x.settledOn || x.date).sort().pop() || ''
    return { ...p, lent, owe, net: lent - owe, open, settled, openCount: open.length, overdueX, soonX, nearestDue: dues[0] || '', oldest, last }
  })
}
