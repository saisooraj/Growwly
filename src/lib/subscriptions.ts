// Subscriptions: recurring Upcoming items flagged isSubscription. Every renewal is its own
// UpcomingExpense, linked forward through nextUpcomingId, so one subscription is a chain of
// items whose newest one (the head) holds the current state: next charge, trial, cancelled.
// Nothing here writes; it reads items, payments and transactions.

import type { BillingCycle, Transaction, UpcomingExpense, UpcomingPayment } from '@/types'

// ── Dates ────────────────────────────────────────────────────────────────────

const pd = (s: string) => { const [a, b, c] = s.split('-').map(Number); return new Date(a, b - 1, c) }
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysBetween = (from: string, to: string) => Math.round((pd(to).getTime() - pd(from).getTime()) / 86400000)

/** Same day n months on, clamped to that month's last day (Jan 31 + 1 → Feb 28) */
export function addMonthsClamped(s: string, n: number): string {
  const d = pd(s)
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
  t.setDate(Math.min(d.getDate(), last))
  return iso(t)
}

export const CYCLE_MONTHS: Record<BillingCycle, number> = { monthly: 1, quarterly: 3, yearly: 12 }
export const CYCLE_LABEL: Record<BillingCycle, string> = { monthly: 'Monthly', quarterly: 'Every 3 months', yearly: 'Yearly' }
export const CYCLE_SHORT: Record<BillingCycle, string> = { monthly: '/mo', quarterly: '/3 mo', yearly: '/yr' }

export const cycleOf = (it: Pick<UpcomingExpense, 'billingCycle'>): BillingCycle => it.billingCycle ?? 'monthly'

/** The renewal after this one (monthly items use the existing month-step) */
export const nextRenewal = (date: string, cycle: BillingCycle = 'monthly') => addMonthsClamped(date, CYCLE_MONTHS[cycle])

/** What it costs per month, so monthly, quarterly and yearly plans can be added up */
export const monthlyCost = (amount: number, cycle: BillingCycle) => amount / CYCLE_MONTHS[cycle]

// ── Known services ───────────────────────────────────────────────────────────

export interface Service {
  id: string
  name: string
  keywords: string[]     // matched as whole words in notes and labels, lowercase
  color: string          // brand colour for the tile
  category: string
}

// Popular in India. Keywords are specific on purpose: "apple" alone would catch fruit.
export const SERVICES: Service[] = [
  { id: 'netflix', name: 'Netflix', keywords: ['netflix'], color: '#E50914', category: 'Entertainment' },
  { id: 'spotify', name: 'Spotify Premium', keywords: ['spotify'], color: '#1DB954', category: 'Entertainment' },
  { id: 'youtube', name: 'YouTube Premium', keywords: ['youtube', 'yt premium', 'youtube music'], color: '#FF0000', category: 'Entertainment' },
  { id: 'prime', name: 'Amazon Prime', keywords: ['amazon prime', 'prime video', 'prime membership', 'prime subscription'], color: '#00A8E1', category: 'Entertainment' },
  { id: 'hotstar', name: 'JioHotstar', keywords: ['hotstar', 'jiohotstar', 'jio hotstar', 'jiocinema', 'jio cinema', 'disney'], color: '#0F1A5F', category: 'Entertainment' },
  { id: 'sonyliv', name: 'SonyLIV', keywords: ['sonyliv', 'sony liv'], color: '#2B2B2B', category: 'Entertainment' },
  { id: 'zee5', name: 'ZEE5', keywords: ['zee5'], color: '#8230C6', category: 'Entertainment' },
  { id: 'applemusic', name: 'Apple Music', keywords: ['apple music'], color: '#FA243C', category: 'Entertainment' },
  { id: 'appletv', name: 'Apple TV+', keywords: ['apple tv', 'apple tv+'], color: '#111111', category: 'Entertainment' },
  { id: 'icloud', name: 'iCloud+', keywords: ['icloud', 'apple one', 'apple storage'], color: '#3693F3', category: 'Subscriptions' },
  { id: 'googleone', name: 'Google One', keywords: ['google one', 'google storage', 'gemini advanced', 'google ai pro'], color: '#4285F4', category: 'Subscriptions' },
  { id: 'chatgpt', name: 'ChatGPT Plus', keywords: ['chatgpt', 'openai'], color: '#10A37F', category: 'Subscriptions' },
  { id: 'claude', name: 'Claude', keywords: ['claude', 'anthropic'], color: '#D97757', category: 'Subscriptions' },
  { id: 'perplexity', name: 'Perplexity Pro', keywords: ['perplexity'], color: '#20808D', category: 'Subscriptions' },
  { id: 'microsoft365', name: 'Microsoft 365', keywords: ['microsoft 365', 'office 365', 'ms 365', 'm365'], color: '#D83B01', category: 'Subscriptions' },
  { id: 'adobe', name: 'Adobe', keywords: ['adobe', 'photoshop', 'lightroom', 'creative cloud'], color: '#FA0F00', category: 'Subscriptions' },
  { id: 'canva', name: 'Canva Pro', keywords: ['canva'], color: '#00C4CC', category: 'Subscriptions' },
  { id: 'notion', name: 'Notion', keywords: ['notion'], color: '#191919', category: 'Subscriptions' },
  { id: 'github', name: 'GitHub Copilot', keywords: ['github', 'copilot'], color: '#24292F', category: 'Subscriptions' },
  { id: 'linkedin', name: 'LinkedIn Premium', keywords: ['linkedin'], color: '#0A66C2', category: 'Subscriptions' },
  { id: 'bumble', name: 'Bumble Premium', keywords: ['bumble'], color: '#F5B700', category: 'Subscriptions' },
  { id: 'tinder', name: 'Tinder', keywords: ['tinder'], color: '#FE3C72', category: 'Subscriptions' },
  { id: 'hinge', name: 'Hinge', keywords: ['hinge'], color: '#2B2B2B', category: 'Subscriptions' },
  { id: 'audible', name: 'Audible', keywords: ['audible'], color: '#F8991C', category: 'Entertainment' },
  { id: 'kindle', name: 'Kindle Unlimited', keywords: ['kindle unlimited'], color: '#146EB4', category: 'Education' },
  { id: 'duolingo', name: 'Duolingo', keywords: ['duolingo'], color: '#58CC02', category: 'Education' },
  { id: 'swiggyone', name: 'Swiggy One', keywords: ['swiggy one'], color: '#FC8019', category: 'Subscriptions' },
  { id: 'zomatogold', name: 'Zomato Gold', keywords: ['zomato gold'], color: '#E23744', category: 'Subscriptions' },
  { id: 'cult', name: 'cult.fit', keywords: ['cult fit', 'cultfit', 'cultpass', 'cult pass'], color: '#1B1B1B', category: 'Fitness' },
  { id: 'xbox', name: 'Xbox Game Pass', keywords: ['game pass', 'xbox'], color: '#107C10', category: 'Entertainment' },
  { id: 'psplus', name: 'PlayStation Plus', keywords: ['ps plus', 'playstation plus', 'playstation'], color: '#003791', category: 'Entertainment' },
  { id: 'dropbox', name: 'Dropbox', keywords: ['dropbox'], color: '#0061FF', category: 'Subscriptions' },
  { id: 'zoom', name: 'Zoom', keywords: ['zoom'], color: '#0B5CFF', category: 'Subscriptions' },
  { id: 'discord', name: 'Discord Nitro', keywords: ['discord', 'nitro'], color: '#5865F2', category: 'Entertainment' },
  { id: 'grammarly', name: 'Grammarly', keywords: ['grammarly'], color: '#15C39A', category: 'Subscriptions' },
  { id: 'medium', name: 'Medium', keywords: ['medium membership'], color: '#111111', category: 'Subscriptions' },
]

/** Shown first in the add form's quick picks */
export const QUICK_PICKS = ['netflix', 'spotify', 'youtube', 'prime', 'hotstar', 'chatgpt', 'icloud', 'googleone', 'applemusic', 'linkedin']

/** Lowercase words only, so "Payment towards: Netflix!" → "payment towards netflix" */
export const normText = (s: string) => s.toLowerCase().replace(/[^a-z0-9+]+/g, ' ').trim()

export function matchService(text: string | undefined): Service | undefined {
  if (!text) return undefined
  const t = ` ${normText(text)} `
  return SERVICES.find(s => s.keywords.some(k => t.includes(` ${k} `)))
}

export const serviceById = (id: string) => SERVICES.find(s => s.id === id)

// ── Grouping items into subscriptions ────────────────────────────────────────

export type SubStatus =
  | { kind: 'cancelled'; on: string }
  | { kind: 'trial'; days: number }         // free trial running, ends in `days`
  | { kind: 'trial-ended'; days: number }   // trial over, first charge not logged (days ≤ 0)
  | { kind: 'due'; days: number }           // renewal date passed, not logged (days < 0)
  | { kind: 'soon'; days: number }          // renews within 3 days
  | { kind: 'active'; days: number }

export interface Charge { id: string; upcomingId: string; amount: number; date: string; txnId?: string }

export interface Subscription {
  id: string                  // the head item's id
  head: UpcomingExpense
  chain: UpcomingExpense[]    // oldest → newest, head last
  service?: Service
  cycle: BillingCycle
  monthly: number             // cost per month
  yearly: number              // cost per year
  charges: Charge[]           // every payment across the chain, newest first
  paidTotal: number
  headPaid: number
  headRemaining: number
  headSettled: boolean
  nextDate: string            // the next charge: the head's due date, or the renewal after it once paid
  status: SubStatus
  since: string               // first item's due date
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function buildSubscriptions(items: UpcomingExpense[], payments: UpcomingPayment[], today: string): Subscription[] {
  const subs = items.filter(i => i.isSubscription)
  const byId = new Map(subs.map(i => [i.id, i]))
  const prevOf = new Map<string, UpcomingExpense>()
  for (const i of subs) if (i.nextUpcomingId && byId.has(i.nextUpcomingId)) prevOf.set(i.nextUpcomingId, i)
  const paidBy = new Map<string, UpcomingPayment[]>()
  for (const p of payments) { const a = paidBy.get(p.upcomingId); if (a) a.push(p); else paidBy.set(p.upcomingId, [p]) }

  const heads = subs.filter(i => !i.nextUpcomingId || !byId.has(i.nextUpcomingId))
  return heads.map(head => {
    const chain: UpcomingExpense[] = [head]
    const seen = new Set([head.id])
    for (let p = prevOf.get(head.id); p && !seen.has(p.id); p = prevOf.get(p.id)) { chain.unshift(p); seen.add(p.id) }

    const charges: Charge[] = chain.flatMap(it => (paidBy.get(it.id) ?? []).map(p => ({ id: p.id, upcomingId: it.id, amount: p.amount, date: p.date, txnId: p.linkedTransactionId })))
      .sort((a, b) => b.date.localeCompare(a.date))
    const headPaid = r2((paidBy.get(head.id) ?? []).reduce((a, p) => a + p.amount, 0))
    const headSettled = head.amount > 0 && headPaid >= head.amount
    const cycle = cycleOf(head)
    const nextDate = headSettled ? nextRenewal(head.dueDate, cycle) : head.dueDate
    const days = daysBetween(today, nextDate)

    let status: SubStatus
    if (head.cancelledOn) status = { kind: 'cancelled', on: head.cancelledOn }
    else if (head.isTrial && !headSettled) status = days > 0 ? { kind: 'trial', days } : { kind: 'trial-ended', days }
    else if (!headSettled && days < 0) status = { kind: 'due', days }
    else if (days <= 3) status = { kind: 'soon', days }
    else status = { kind: 'active', days }

    return {
      id: head.id, head, chain,
      service: matchService(head.label),
      cycle,
      monthly: monthlyCost(head.amount, cycle),
      yearly: monthlyCost(head.amount, cycle) * 12,
      charges,
      paidTotal: r2(charges.reduce((a, c) => a + c.amount, 0)),
      headPaid, headRemaining: Math.max(0, r2(head.amount - headPaid)), headSettled,
      nextDate, status,
      since: chain[0].dueDate,
    }
  })
}

/** Needs a decision first, then soonest charge; cancelled last */
export function sortSubscriptions(subs: Subscription[]): Subscription[] {
  const rank = (s: Subscription) => ({ 'trial-ended': 0, due: 1, trial: 2, soon: 3, active: 4, cancelled: 5 })[s.status.kind]
  return subs.slice().sort((a, b) => rank(a) - rank(b) || a.nextDate.localeCompare(b.nextDate) || a.head.label.localeCompare(b.head.label))
}

/** The subscription a given item belongs to (any renewal in its chain) */
export const findSubscription = (subs: Subscription[], itemId: string) => subs.find(s => s.chain.some(c => c.id === itemId))

// ── Calendar ─────────────────────────────────────────────────────────────────

export interface CalendarCharge {
  date: string
  sub: Subscription
  amount: number
  state: 'paid' | 'due' | 'upcoming'
  trial: boolean            // the charge that lands when a trial ends
  projected: boolean        // a future renewal not yet added as an item
}

/** Every charge in a month (YYYY-MM): logged ones, unpaid items, and renewals worked out ahead */
export function chargesInMonth(subs: Subscription[], payments: UpcomingPayment[], ym: string, today: string): CalendarCharge[] {
  const paid = new Map<string, number>()
  for (const p of payments) paid.set(p.upcomingId, (paid.get(p.upcomingId) ?? 0) + p.amount)
  const end = `${ym}-31`
  const out: CalendarCharge[] = []
  for (const sub of subs) {
    for (const it of sub.chain) {
      if (!it.dueDate.startsWith(ym)) continue
      const done = it.amount > 0 && (paid.get(it.id) ?? 0) >= it.amount
      // A cancelled head that was never paid isn't a charge any more
      if (!done && it.cancelledOn) continue
      out.push({ date: it.dueDate, sub, amount: it.amount, state: done ? 'paid' : it.dueDate < today ? 'due' : 'upcoming', trial: !!it.isTrial, projected: false })
    }
    if (sub.status.kind === 'cancelled') continue
    // Step from the head's own date so a 31st doesn't drift to the 28th after February
    const step = CYCLE_MONTHS[sub.cycle]
    for (let k = 1; k < 400; k++) {
      const d = addMonthsClamped(sub.head.dueDate, step * k)
      if (d > end) break
      if (d.startsWith(ym)) out.push({ date: d, sub, amount: sub.head.amount, state: 'upcoming', trial: false, projected: true })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.sub.head.label.localeCompare(b.sub.head.label))
}

// ── Spotting subscriptions in logged spending ────────────────────────────────

export interface SpottedSubscription {
  key: string               // stable id, also what's stored when dismissed
  label: string
  amount: number            // the latest charge
  lastDate: string
  nextDate: string          // a month after the latest charge
  category: string
  count: number             // matching expenses found
  reason: 'service' | 'category' | 'repeat'
  service?: Service
  txnIds: string[]          // the matching expenses, linked as past charges when it's tracked
}

// Categories where a same-name, same-amount monthly expense is likely a plan rather than a habit
const REPEAT_CATEGORIES = new Set(['Entertainment', 'Subscriptions', 'Utilities', 'Education', 'Fitness', 'Insurance', 'Office Expense', 'Personal Care', 'Healthcare', 'Other'])
const LOOKBACK_DAYS = 100   // how far back to read
const FRESH_DAYS = 45       // the latest charge must be this recent to count as a live subscription

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, 0.05 * Math.max(a, b))

/**
 * Expenses that look like subscriptions not yet tracked: a known service in the notes, anything
 * logged under Subscriptions, or the same note and amount about a month apart.
 */
export function spotSubscriptions(
  transactions: Transaction[], items: UpcomingExpense[], dismissed: string[] | undefined, today: string,
): SpottedSubscription[] {
  const start = (() => { const d = pd(today); d.setDate(d.getDate() - LOOKBACK_DAYS); return iso(d) })()
  const exps = transactions.filter(t => t.type === 'expense' && t.amount > 0 && t.date >= start && t.date <= today)

  // Already tracked: any subscription (cancelled too) or recurring Upcoming item
  const tracked = items.filter(i => i.isSubscription || i.isRecurring)
  const trackedServices = new Set(tracked.map(i => matchService(i.label)?.id).filter(Boolean) as string[])
  const trackedNames = tracked.map(i => normText(i.label)).filter(n => n.length >= 3)
  const isTracked = (label: string, service?: Service) => {
    if (service && trackedServices.has(service.id)) return true
    const n = normText(label)
    return n.length >= 3 && trackedNames.some(t => t === n || (t.length >= 4 && n.includes(t)) || (n.length >= 4 && t.includes(n)))
  }
  const skip = new Set(dismissed ?? [])

  const groups = new Map<string, { txns: Transaction[]; reason: SpottedSubscription['reason']; label: string; service?: Service }>()
  const put = (key: string, t: Transaction, reason: SpottedSubscription['reason'], label: string, service?: Service) => {
    const g = groups.get(key)
    if (g) g.txns.push(t); else groups.set(key, { txns: [t], reason, label, service })
  }
  const loose: Transaction[] = []
  for (const t of exps) {
    // Payments logged from Upcoming carry "Payment towards: <label>" and are tracked already
    if (/^payment towards:/i.test(t.notes ?? '')) continue
    const service = matchService(t.notes)
    if (service) { put(`svc:${service.id}`, t, 'service', service.name, service); continue }
    const note = normText(t.notes ?? '')
    if (t.category === 'Subscriptions') { put(`cat:${note || Math.round(t.amount)}`, t, 'category', (t.notes ?? '').trim() || 'Subscription'); continue }
    if (note.length >= 3 && REPEAT_CATEGORIES.has(t.category)) loose.push(t)
  }

  // Same note, near-same amount, 26–35 days apart
  const byNote = new Map<string, Transaction[]>()
  for (const t of loose) { const n = normText(t.notes); const a = byNote.get(n); if (a) a.push(t); else byNote.set(n, [t]) }
  byNote.forEach((ts, n) => {
    const s = ts.slice().sort((a, b) => a.date.localeCompare(b.date))
    const hits = new Set<Transaction>()
    for (let i = 1; i < s.length; i++) {
      for (let j = i - 1; j >= 0; j--) {
        const gap = daysBetween(s[j].date, s[i].date)
        if (gap > 35) break
        if (gap >= 26 && close(s[i].amount, s[j].amount)) { hits.add(s[i]); hits.add(s[j]) }
      }
    }
    if (hits.size >= 2) hits.forEach(t => put(`rep:${n}`, t, 'repeat', (t.notes ?? '').trim()))
  })

  const out: SpottedSubscription[] = []
  groups.forEach((g, key) => {
    if (skip.has(key)) return
    const last = g.txns.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0]
    if (daysBetween(last.date, today) > FRESH_DAYS) return
    if (isTracked(g.label, g.service)) return
    out.push({
      key, label: g.label, amount: last.amount, lastDate: last.date, nextDate: nextRenewal(last.date, 'monthly'),
      category: g.service?.category ?? last.category, count: g.txns.length, reason: g.reason, service: g.service,
      txnIds: g.txns.map(t => t.id),
    })
  })
  return out.sort((a, b) => b.lastDate.localeCompare(a.lastDate))
}

// ── Linking old transactions ─────────────────────────────────────────────────

export interface LinkCandidate { txn: Transaction; strong: boolean }

/** Transactions already tied to an Upcoming payment (any item), so each rupee is counted once */
export const linkedTxnIds = (payments: UpcomingPayment[]) => new Set(payments.map(p => p.linkedTransactionId).filter(Boolean) as string[])

/** True when an expense's notes name this subscription */
export function namesSubscription(sub: Subscription, t: Transaction): boolean {
  const svc = sub.service ?? matchService(sub.head.label)
  if (svc && matchService(t.notes)?.id === svc.id) return true
  const a = normText(sub.head.label), b = normText(t.notes ?? '')
  return a.length >= 3 && b.length >= 3 && (b.includes(a) || a.includes(b))
}

/**
 * Expenses that could be past charges: ones whose notes name the subscription (strong), then ones
 * in the same category at about the same price (weak). Already-linked ones are left out, and a
 * cancelled subscription only takes charges up to its last renewal.
 */
export function linkCandidates(sub: Subscription, transactions: Transaction[], payments: UpcomingPayment[]): LinkCandidate[] {
  const taken = linkedTxnIds(payments)
  const cap = sub.status.kind === 'cancelled' ? sub.head.dueDate : '9999-12-31'
  const out: LinkCandidate[] = []
  for (const t of transactions) {
    if (t.type !== 'expense' || t.amount <= 0 || taken.has(t.id) || t.date > cap) continue
    if (namesSubscription(sub, t)) out.push({ txn: t, strong: true })
    else if (t.category === sub.head.category && Math.abs(t.amount - sub.head.amount) <= 0.15 * sub.head.amount) out.push({ txn: t, strong: false })
  }
  return out.sort((a, b) => Number(b.strong) - Number(a.strong) || b.txn.date.localeCompare(a.txn.date))
}

// How close an expense must be to an unpaid renewal's date to count as paying it
const MATCH_DAYS: Record<BillingCycle, number> = { monthly: 15, quarterly: 30, yearly: 45 }

export interface LinkPlan {
  attach: { item: UpcomingExpense; txn: Transaction }[]   // pays a renewal already in Upcoming
  create: Transaction[]                                    // becomes a past renewal of its own
}

/** Works out where each chosen expense goes, without writing anything */
export function planLink(sub: Subscription, txns: Transaction[], payments: UpcomingPayment[]): LinkPlan {
  const paid = new Map<string, number>()
  for (const p of payments) paid.set(p.upcomingId, (paid.get(p.upcomingId) ?? 0) + p.amount)
  const open = sub.chain.filter(it => !it.cancelledOn && (paid.get(it.id) ?? 0) === 0)
  const used = new Set<string>()
  const plan: LinkPlan = { attach: [], create: [] }
  for (const t of txns.slice().sort((a, b) => a.date.localeCompare(b.date))) {
    let best: UpcomingExpense | undefined, bestGap = Infinity
    for (const it of open) {
      if (used.has(it.id)) continue
      const gap = Math.abs(daysBetween(it.dueDate, t.date))
      if (gap <= MATCH_DAYS[sub.cycle] && gap < bestGap) { best = it; bestGap = gap }
    }
    if (best) { used.add(best.id); plan.attach.push({ item: best, txn: t }) }
    else plan.create.push(t)
  }
  return plan
}
