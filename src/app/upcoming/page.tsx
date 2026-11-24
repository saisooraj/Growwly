'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Calendar, Check, ChevronDown, ChevronLeft, EyeOff, Folder, Plus, Repeat, Search, SlidersHorizontal } from 'lucide-react'
import toast from 'react-hot-toast'
import AppShell from '@/components/layout/AppShell'
import { useIsDesktop } from '@/components/transactions/TransactionDetailModal'
import {
  DetailSheet, FilterSheet, ItemFormSheet, PaySheet, checkBox, segBtnStyle,
  type CatOpt, type ItemDraft, type Seg,
} from '@/components/upcoming/UpcomingSheets'
import {
  MONTHS, RECURRING_MODE, addDays, catColor, catName, derive, dueText, endOfMonth, firstOfNextMonth, makeMoney,
  monthName, nextMonth, pd, plural, r2, sh, todayIso, type Derived,
} from '@/components/upcoming/upView'
import {
  addNextMonth, cancelSubscription, deleteItem, dismissSpotted, freshSubscription, linkTransactions, logPayment, nextDueOf,
  restoreSubscription, saveItem, saveSubscription, settleRemainder, undoCancelledTrial, unlinkCharge, type NewPayment, type SubDraft,
} from '@/components/upcoming/upActions'
import SubscriptionsView from '@/components/upcoming/SubscriptionsView'
import { LinkTransactionsSheet, SubscriptionFormSheet, SubscriptionSheet, blankSubDraft } from '@/components/upcoming/SubscriptionSheets'
import { buildSubscriptions, cycleOf, findSubscription, serviceById, sortSubscriptions, spotSubscriptions, type Charge, type SpottedSubscription, type Subscription } from '@/lib/subscriptions'
import { deleteUpcomingPayment, updateUpcomingPayment } from '@/lib/firestore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import { useAppStore } from '@/store/appStore'
import { usePrivacy } from '@/store/privacyStore'
import type { Transaction, UpcomingExpense, UpcomingPayment } from '@/types'

type Sheet =
  | { kind: 'detail'; id: string }
  | { kind: 'form'; editId: string | null; draft: ItemDraft; from?: 'detail' }
  | { kind: 'pay'; id: string; payId: string | null; from?: 'detail' | 'sub' }
  | { kind: 'filter' }
  | { kind: 'sub'; id: string }                                   // any item in the subscription's chain
  | { kind: 'subForm'; editId: string | null; draft: SubDraft; from?: 'detail' | 'sub'; spottedKey?: string; spottedTxnIds?: string[] }
  | { kind: 'link'; id: string }                                  // link old transactions to this subscription
type Tab = 'bills' | 'subs'
type Toast = { msg: string; action?: { label: string; on: () => void } }
type Segment = 'all' | 'bills' | 'income'

// Hero stat tints that read on the brand gradient
const GLASS = { background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)' }
const WATCH = { background: 'rgba(255,200,110,.2)', border: '1px solid rgba(255,214,150,.5)' }
const RISK = { background: 'rgba(255,140,120,.2)', border: '1px solid rgba(255,170,150,.5)' }

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }
const eyebrow: CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)' }
const ellipsis: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const tnum: CSSProperties = { fontVariantNumeric: 'tabular-nums' }
const dot = (c: string, s = 8): CSSProperties => ({ width: s, height: s, borderRadius: '50%', flexShrink: 0, background: c })
const checkCircle = (s: number): CSSProperties => ({ width: s, height: s, borderRadius: '50%', background: 'var(--good-soft)', color: 'var(--good-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 })

export default function UpcomingPage() {
  const desktop = useIsDesktop(), phone = !desktop
  const { user } = useAuth()
  const refresh = useRefreshData()
  const { upcomingExpenses: items, upcomingPayments: payments, projects, emergencyFund, initialized, transactions, settings } = useAppStore()
  const masked = usePrivacy(s => s.masked)
  const toggleMask = usePrivacy(s => s.toggle)
  const hydratePrivacy = usePrivacy(s => s.hydrate)
  useEffect(() => { hydratePrivacy() }, [hydratePrivacy])
  const { money, signed } = useMemo(() => makeMoney(masked), [masked])
  const today = todayIso()

  const [tab, setTab] = useState<Tab>('bills')
  const [segment, setSegment] = useState<Segment>('all')
  const [view, setView] = useState<'pending' | 'settled'>('pending')
  const [q, setQ] = useState('')
  const [cats, setCats] = useState<string[]>([])
  const [catPop, setCatPop] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [sheetKey, setSheetKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [toastState, setToastState] = useState<Toast | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  const notify = useCallback((msg: string, action?: Toast['action']) => {
    clearTimeout(toastTimer.current)
    setToastState({ msg, action })
    toastTimer.current = setTimeout(() => setToastState(null), action ? 6000 : 2600)
  }, [])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  // The rail and jump targets stop just below the sticky header
  const [headEl, setHeadEl] = useState<HTMLElement | null>(null)
  const [headH, setHeadH] = useState(0)
  useEffect(() => {
    if (!headEl) return
    const ro = new ResizeObserver(() => setHeadH(headEl.offsetHeight))
    ro.observe(headEl)
    return () => ro.disconnect()
  }, [headEl])

  const popRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!catPop) return
    const onDown = (e: MouseEvent) => { if (!popRef.current?.contains(e.target as Node)) setCatPop(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [catPop])

  // ── Derived data ──────────────────────────────────────────────────────────
  const all = useMemo(() => items.map(it => derive(it, payments, today)), [items, payments, today])
  const subs = useMemo(() => sortSubscriptions(buildSubscriptions(items, payments, today)), [items, payments, today])
  const spotted = useMemo(() => spotSubscriptions(transactions, items, settings?.dismissedSubscriptions, today), [transactions, items, settings?.dismissedSubscriptions, today])
  const subAlerts = subs.filter(s => s.status.kind === 'trial-ended' || s.status.kind === 'due' || (s.status.kind === 'trial' && s.status.days <= 3)).length + spotted.length

  // ?tab=subscriptions opens the Subscriptions tab; &sub=<id> also opens that subscription (links from Overview)
  const linked = useRef(false)
  useEffect(() => {
    if (linked.current || !initialized) return
    linked.current = true
    const q = new URLSearchParams(window.location.search)
    if (q.get('tab') === 'subscriptions') setTab('subs')
    const id = q.get('sub')
    if (id && items.some(i => i.id === id)) { setTab('subs'); setSheet({ kind: 'sub', id }); setSheetKey(k => k + 1) }
  }, [initialized, items])
  const switchTab = (t: Tab) => {
    setTab(t)
    const url = new URL(window.location.href)
    if (t === 'subs') url.searchParams.set('tab', 'subscriptions'); else url.searchParams.delete('tab')
    url.searchParams.delete('sub')
    window.history.replaceState(null, '', url.toString())
    window.scrollTo(0, 0)
  }
  const ql = q.trim().toLowerCase()
  const filtering = !!ql || cats.length > 0
  const ok = (x: Derived) =>
    (segment === 'all' || (segment === 'bills' ? !x.inc : x.inc))
    && (!ql || `${x.it.label} ${catName(x.it.category)} ${x.it.notes ?? ''}`.toLowerCase().includes(ql))
    && (!cats.length || cats.includes(x.it.category ?? ''))

  const thisMonth = today.slice(0, 7)
  const pend = all.filter(x => !x.settled && ok(x)).sort((a, b) => a.it.dueDate.localeCompare(b.it.dueDate) || Number(a.inc) - Number(b.inc))
  const gmap = new Map<string, Derived[]>()
  for (const x of pend) {
    const k = !x.inc && x.d < 0 ? 'overdue' : x.d <= 7 ? 'week' : x.it.dueDate.startsWith(thisMonth) ? 'later' : x.it.dueDate.slice(0, 7)
    if (!gmap.has(k)) gmap.set(k, [])
    gmap.get(k)!.push(x)
  }
  const rank = (k: string) => (k === 'overdue' ? 0 : k === 'week' ? 1 : k === 'later' ? 2 : 3)
  const groups = Array.from(gmap.keys()).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map(k => {
    const xs = gmap.get(k)!
    const out = xs.filter(x => !x.inc).reduce((a, x) => a + x.remaining, 0)
    const inn = xs.filter(x => x.inc).reduce((a, x) => a + x.remaining, 0)
    const hasOut = xs.some(x => !x.inc), hasIn = xs.some(x => x.inc)
    const logged = xs.reduce((a, x) => a + x.paid, 0)
    let title: string, sub: string, dotC = 'var(--text-4)', titleColor = 'var(--text)'
    if (k === 'overdue') { title = 'Overdue'; sub = `${plural(xs.length, 'bill')} past due`; dotC = 'var(--bad)'; titleColor = 'var(--bad-ink)' }
    else if (k === 'week') { title = 'This week'; sub = `${sh(today)} – ${sh(addDays(today, 7))}`; dotC = 'var(--warn)' }
    else if (k === 'later') { title = `Later in ${monthName(today)}`; sub = `${sh(addDays(today, 8))} – ${pd(endOfMonth(today)).getDate()}`; dotC = 'var(--brand)' }
    else { const d = pd(`${k}-01`); title = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; sub = plural(xs.length, 'item') }
    return { key: k, title, sub, dotC, titleColor, xs, out, inn, hasOut, hasIn, logged }
  })

  const setl = all.filter(x => x.settled).sort((a, b) => (b.last ?? b.it.dueDate).localeCompare(a.last ?? a.it.dueDate))
  const setlF = setl.filter(ok)
  const sgMap = new Map<string, Derived[]>()
  for (const x of setlF) { const k = (x.last ?? x.it.dueDate).slice(0, 7); if (!sgMap.has(k)) sgMap.set(k, []); sgMap.get(k)!.push(x) }
  const recent = setl.slice(0, phone ? 3 : 4)
  const pendTotal = all.filter(x => !x.settled).length
  const hasItems = items.length > 0
  const loading = !initialized

  const hero = buildHero(all, today, money, signed)
  const present = Array.from(new Set(items.map(i => i.category).filter((c): c is NonNullable<typeof c> => !!c)))
  const catOpts: CatOpt[] = present.map(n => {
    const sel = cats.includes(n)
    return {
      name: n, label: catName(n), color: catColor(n), sel,
      count: all.filter(x => x.it.category === n && (view === 'settled' ? x.settled : !x.settled)).length,
      on: () => setCats(cs => (sel ? cs.filter(c => c !== n) : [...cs, n])),
    }
  })
  const segs: Seg[] = ([['all', 'All'], ['bills', 'Bills'], ['income', phone ? 'Income' : 'Expected income']] as [Segment, string][])
    .map(([key, label]) => ({ key, label, sel: segment === key, on: () => setSegment(key) }))
  const clearFilters = () => { setQ(''); setCats([]); setSegment('all'); setCatPop(false) }
  const shownCount = view === 'settled' ? setlF.length : pend.length

  // ── Actions ───────────────────────────────────────────────────────────────
  const findItem = (id: string) => items.find(i => i.id === id)
  const open = (s: Sheet) => { setSheet(s); setSheetKey(k => k + 1) }
  const openAdd = (pre?: Partial<ItemDraft>) => open({
    kind: 'form', editId: null,
    draft: { flow: 'expense', label: '', amount: '', date: firstOfNextMonth(today), cat: 'Food & Dining', project: null, notes: '', recurring: false, ...pre },
  })
  const subDraftOf = (it: UpcomingExpense): SubDraft => ({
    label: it.label, amount: String(it.amount), cycle: cycleOf(it), trial: !!it.isTrial, date: it.dueDate,
    cat: it.category ?? 'Subscriptions', notes: it.notes ?? '',
  })
  const openSubAdd = (pre?: Partial<SubDraft>, spotted?: SpottedSubscription) => open({ kind: 'subForm', editId: null, draft: blankSubDraft(firstOfNextMonth(today), pre), spottedKey: spotted?.key, spottedTxnIds: spotted?.txnIds })
  const openEdit = (it: UpcomingExpense) => it.isSubscription ? open({ kind: 'subForm', editId: it.id, from: 'detail', draft: subDraftOf(it) }) : open({
    kind: 'form', editId: it.id, from: 'detail',
    draft: { flow: it.flowType ?? 'expense', label: it.label, amount: String(it.amount), date: it.dueDate, cat: it.category ?? 'Other', project: it.projectId ?? null, notes: it.notes ?? '', recurring: !!it.isRecurring },
  })
  const closeSheet = useCallback(() => {
    setSheet(s => {
      if (s?.kind === 'link') return items.some(i => i.id === s.id) ? { kind: 'sub', id: s.id } : null
      if (!s || !(s.kind === 'pay' || s.kind === 'form' || s.kind === 'subForm') || !s.from) return null
      const id = s.kind === 'pay' ? s.id : s.editId
      if (!id || !items.some(i => i.id === id)) return null
      return s.from === 'sub' ? { kind: 'sub', id } : { kind: 'detail', id }
    })
  }, [items])

  async function run(fn: () => Promise<void>) {
    if (saving) return
    setSaving(true)
    try { await fn() } catch (e) { console.error(e); toast.error('Something went wrong') } finally { setSaving(false) }
  }

  async function addNext(it: UpcomingExpense) {
    if (!user || it.nextUpcomingId) return
    await run(async () => {
      const next = nextDueOf(it)
      await addNextMonth(user.uid, it)
      await refresh()
      notify(it.isSubscription ? `Next ${it.label} renewal added · ${sh(next)}` : `${monthName(next)}’s ${it.label} added · ${sh(next)}`)
    })
  }

  // A recurring item just got settled: add next month's now, or offer to.
  // Subscriptions renew on their own, so their next renewal is always added.
  async function afterSettle(it: UpcomingExpense): Promise<{ extra: string; action?: Toast['action'] }> {
    if (!user || !it.isRecurring || it.nextUpcomingId || it.cancelledOn) return { extra: '' }
    if (it.isSubscription) { await addNextMonth(user.uid, it); return { extra: ` · renews ${sh(nextDueOf(it))}` } }
    const m = monthName(nextMonth(it.dueDate))
    if (RECURRING_MODE === 'auto') { await addNextMonth(user.uid, it); return { extra: ` · ${m}’s added` } }
    return { extra: '', action: { label: `Add ${m}’s`, on: () => { setToastState(null); addNext(it) } } }
  }

  const onSaveItem = (f: ItemDraft) => {
    if (!user || sheet?.kind !== 'form') return
    const editId = sheet.editId
    run(async () => {
      await saveItem(user.uid, editId, f)
      await refresh()
      if (editId) { setSheet({ kind: 'detail', id: editId }); notify('Updated') }
      else { setSheet(null); setView('pending'); notify(f.flow === 'expense' ? 'Added to upcoming' : 'Expected income added') }
    })
  }

  const onSavePay = (x: Derived, p: NewPayment, from?: 'detail' | 'sub') => {
    if (!user) return
    run(async () => {
      await logPayment(user.uid, x.it, p, emergencyFund)
      let msg = x.inc ? 'Receipt logged' : 'Payment logged', action: Toast['action']
      if (x.it.amount > 0 && r2(x.paid + p.amount) >= x.it.amount) { const r = await afterSettle(x.it); msg += r.extra; action = r.action }
      await refresh()
      setSheet(from === 'detail' ? { kind: 'detail', id: x.it.id } : from === 'sub' ? { kind: 'sub', id: x.it.id } : null)
      notify(msg, action)
    })
  }

  const onSavePayEdit = (pay: UpcomingPayment, p: { amount: number; date: string; notes: string }) => run(async () => {
    await updateUpcomingPayment(pay.id, p)
    await refresh()
    setSheet({ kind: 'detail', id: pay.upcomingId })
    notify('Updated')
  })

  const markSettled = (x: Derived) => {
    if (!user) return
    run(async () => {
      await settleRemainder(user.uid, x.it, x.remaining, today)
      const r = await afterSettle(x.it)
      await refresh()
      notify(`Marked settled${r.extra}`, r.action)
    })
  }

  // ── Subscriptions ──
  const onSaveSub = (f: SubDraft, linkPast: boolean) => {
    if (!user || sheet?.kind !== 'subForm') return
    const { editId, from, spottedKey, spottedTxnIds } = sheet
    run(async () => {
      const id = await saveSubscription(user.uid, editId, f)
      // Tracked from a suggestion: don't suggest it again even if the name was changed
      if (spottedKey) await dismissSpotted(user.uid, spottedKey, settings?.dismissedSubscriptions)
      const past = linkPast && !editId ? transactions.filter(t => spottedTxnIds?.includes(t.id)) : []
      if (past.length) await linkTransactions(user.uid, freshSubscription(user.uid, id, f, today), past, payments)
      await refresh()
      if (editId) { setSheet(from === 'detail' ? { kind: 'detail', id: editId } : { kind: 'sub', id: editId }); notify('Updated') }
      else {
        setSheet(null); if (tab !== 'subs') switchTab('subs')
        notify(`${f.label.trim()} added${past.length ? ` · ${plural(past.length, 'past charge')} linked` : f.trial ? ' · we’ll flag it before the trial ends' : ''}`)
      }
    })
  }
  const onLinkTxns = (sub: Subscription, txns: Transaction[]) => {
    if (!user) return
    run(async () => {
      await linkTransactions(user.uid, sub, txns, payments)
      await refresh()
      setSheet({ kind: 'sub', id: sub.head.id })
      notify(`${plural(txns.length, 'charge')} linked to ${sub.head.label}`)
    })
  }
  const onUnlink = (sub: Subscription, c: Charge) => {
    run(async () => {
      await unlinkCharge(c, sub)
      await refresh()
      // Reopen through a renewal that's still there: a past charge made by linking is deleted with it
      const keep = sub.chain.find(i => i.id !== c.upcomingId)
      setSheet(keep ? { kind: 'sub', id: keep.id } : null)
      notify('Unlinked · the expense stays in Transactions')
    })
  }
  const onCancelSub = (sub: Subscription) => {
    if (!user) return
    run(async () => {
      const { removed } = await cancelSubscription(sub, today)
      await refresh()
      setSheet(null)
      const label = sub.head.label
      notify(`${label} marked cancelled`, removed ? { label: 'Undo', on: () => { setToastState(null); run(async () => { await undoCancelledTrial(user.uid, removed); await refresh(); notify(`${label} is back`) }) } } : undefined)
    })
  }
  const onRestoreSub = (sub: Subscription) => {
    if (!user) return
    run(async () => { await restoreSubscription(user.uid, sub); await refresh(); notify(`${sub.head.label} restored`) })
  }
  const onTrack = (sp: SpottedSubscription) => openSubAdd({
    label: sp.service?.name ?? sp.label, amount: String(sp.amount), date: sp.nextDate, cat: sp.category,
  }, sp)
  const onDismiss = (sp: SpottedSubscription) => {
    if (!user) return
    run(async () => {
      await dismissSpotted(user.uid, sp.key, settings?.dismissedSubscriptions)
      notify(`${sp.label} won’t be suggested again`)
    })
  }

  const delPay = (p: UpcomingPayment) => run(async () => { await deleteUpcomingPayment(p.id); await refresh(); notify('Payment removed') })
  const delItem = (x: Derived) => run(async () => { await deleteItem(x.it, x.ps); setSheet(null); await refresh(); notify('Removed') })

  const goSettled = () => { setView('settled'); window.scrollTo(0, 0) }
  const jump = (key: string) => {
    const el = document.querySelector(`[data-grp="${key}"]`)
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - headH - 2, behavior: 'smooth' })
  }

  // ── Rows ──────────────────────────────────────────────────────────────────
  const row = (x: Derived, i: number) => {
    const { it, paid, remaining, d, inc } = x
    const overdue = !inc && d < 0, soon = !inc && d >= 0 && d <= 7, urgent = overdue || soon
    const tiny = remaining > 0 && remaining < 1
    const pct = it.amount > 0 ? Math.min(100, Math.round(paid / it.amount * 100)) : 100
    const dt = pd(it.dueDate)
    const dateBg = overdue ? 'var(--bad-soft)' : soon ? 'var(--warn-soft)' : inc ? 'var(--good-soft)' : 'var(--surface-2)'
    const dateInk = overdue ? 'var(--bad-ink)' : soon ? 'var(--warn-ink)' : inc ? 'var(--good-ink)' : 'var(--text-2)'
    const project = phone || !it.projectId ? null : projects.find(p => p.id === it.projectId)?.name
    const progTxt = tiny ? 'Less than ₹1 left'
      : phone ? `${money(remaining)}${inc ? ' pending' : ' left'}`
      : `${money(paid)}${inc ? ' received · ' : ' paid · '}${money(remaining)}${inc ? ' pending' : ' left'}`
    return (
      <div key={it.id} onClick={() => open({ kind: 'detail', id: it.id })} className="up-hov" style={{ display: 'flex', alignItems: 'center', gap: phone ? 12 : 14, padding: phone ? '12px 12px' : '14px 18px', borderTop: i === 0 ? 'none' : '1px solid var(--border)', cursor: 'pointer', transition: 'background .15s' }}>
        <div style={{ width: 46, height: 50, flexShrink: 0, borderRadius: 12, background: dateBg, color: dateInk, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em' }}>{MONTHS[dt.getMonth()].slice(0, 3).toUpperCase()}</span>
          <span style={{ fontSize: 18, fontWeight: 600, lineHeight: 1, ...tnum }}>{dt.getDate()}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ flex: 1, minWidth: 0, ...ellipsis, fontWeight: 500, fontSize: 15 }}>{it.label}</span>
            {it.isRecurring && <Repeat size={14} strokeWidth={2} style={{ flexShrink: 0, color: 'var(--text-3)' }} />}
            <span style={{ fontWeight: 600, fontSize: 15, ...tnum, whiteSpace: 'nowrap', color: inc ? 'var(--good-ink)' : 'var(--text)' }}>{(inc ? '+' : '') + money(it.amount)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text-3)', minWidth: 0 }}>
            <span style={{ color: overdue ? 'var(--bad-ink)' : soon ? 'var(--warn-ink)' : inc ? 'var(--good-ink)' : 'var(--text-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>{dueText(x, it.dueDate)}</span>
            <span style={{ color: 'var(--text-4)' }}>·</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}><span style={dot(catColor(it.category), 7)} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{catName(it.category)}</span></span>
            {project && <><span style={{ color: 'var(--text-4)' }}>·</span><span style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}><Folder size={12} strokeWidth={2} />{project}</span></>}
          </div>
          {paid > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 1 }}>
              <div style={{ flex: 1, height: 5, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: inc ? 'var(--good)' : 'var(--brand)', borderRadius: 99 }} /></div>
              <span style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap', ...tnum }}>{progTxt}</span>
            </div>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); if (tiny) markSettled(x); else open({ kind: 'pay', id: it.id, payId: null }) }}
          style={{
            height: 42, minWidth: phone ? 66 : 84, padding: '0 14px', borderRadius: 12, border: 0, fontWeight: 600, fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexShrink: 0,
            background: tiny ? 'var(--surface-2)' : urgent ? 'var(--brand)' : inc ? 'var(--good-soft)' : 'var(--brand-soft)',
            color: tiny ? 'var(--text)' : urgent ? 'var(--on-brand)' : inc ? 'var(--good-ink)' : 'var(--brand-ink)',
          }}
        >{tiny ? 'Settle' : inc ? 'Receive' : 'Pay'}</button>
      </div>
    )
  }

  const settledRow = (x: Derived, i: number, compact: boolean) => {
    const { it, paid, inc } = x
    const over = r2(paid - it.amount)
    const nm = monthName(nextDueOf(it))
    const canNext = RECURRING_MODE === 'prompt' && !!it.isRecurring && !it.nextUpcomingId && !it.cancelledOn
    const nxt = it.nextUpcomingId ? findItem(it.nextUpcomingId) : undefined
    const sub = `${inc ? 'Received' : 'Paid'} ${sh(x.last ?? it.dueDate)}`
    const amountTxt = (inc ? '+' : '') + money(paid > it.amount ? paid : it.amount)
    const nextBtn = (h: number, fs: number, pad: string, r: number) => canNext && (
      <button onClick={e => { e.stopPropagation(); addNext(it) }} style={{ height: h, padding: pad, borderRadius: r, border: '1px solid var(--border-strong)', background: 'transparent', fontWeight: 500, fontSize: fs, cursor: 'pointer', whiteSpace: 'nowrap' }}>Add {nm.slice(0, 3)}</button>
    )
    if (compact) {
      return (
        <div key={it.id} onClick={() => open({ kind: 'detail', id: it.id })} className="up-hov" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer' }}>
          <span style={checkCircle(26)}><Check size={13} strokeWidth={2.6} /></span>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ ...ellipsis, fontWeight: 500, color: 'var(--text-2)' }}>{it.label}</div><div style={{ fontSize: 12, color: 'var(--text-3)' }}>{sub}</div></div>
          {canNext ? nextBtn(32, 12, '0 10px', 9) : <span style={{ fontSize: 13, color: 'var(--text-3)', ...tnum, whiteSpace: 'nowrap' }}>{amountTxt}</span>}
        </div>
      )
    }
    return (
      <div key={it.id} onClick={() => open({ kind: 'detail', id: it.id })} className="up-hov" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: phone && view === 'pending' ? '12px 14px' : '12px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--border)', cursor: 'pointer' }}>
        <span style={checkCircle(32)}><Check size={15} strokeWidth={2.4} /></span>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
            <span style={{ flex: 1, minWidth: 0, ...ellipsis, fontWeight: 500, color: 'var(--text-2)' }}>{it.label}</span>
            {view === 'settled' && it.isRecurring && <Repeat size={13} strokeWidth={2} style={{ flexShrink: 0, color: 'var(--text-3)' }} />}
            <span style={{ ...tnum, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{amountTxt}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--text-3)', flexWrap: 'wrap', alignItems: 'center' }}>
            <span>{sub}</span>
            <span style={{ textDecoration: 'line-through', color: 'var(--text-4)' }}>Due {sh(it.dueDate)}</span>
            {over > 0 && <span style={{ padding: '1px 7px', borderRadius: 99, background: 'var(--info-soft)', color: 'var(--info-ink)' }}>{money(over)} over</span>}
            {nxt && <span>· Next: {sh(nxt.dueDate)}</span>}
          </div>
        </div>
        {nextBtn(36, 13, '0 12px', 10)}
      </div>
    )
  }

  // ── Sheet ─────────────────────────────────────────────────────────────────
  let sheetEl: JSX.Element | null = null
  if (sheet?.kind === 'detail') {
    const it = findItem(sheet.id)
    if (it) {
      const x = derive(it, payments, today)
      sheetEl = (
        <DetailSheet
          key={sheetKey} desktop={desktop} x={x} money={money} masked={masked} projects={projects}
          nextItem={it.nextUpcomingId ? findItem(it.nextUpcomingId) : undefined}
          onClose={closeSheet} onEdit={() => openEdit(it)} onDelete={() => delItem(x)}
          onPay={() => open({ kind: 'pay', id: it.id, payId: null, from: 'detail' })}
          onSettle={() => markSettled(x)} onAddNext={() => addNext(it)}
          onEditPay={p => open({ kind: 'pay', id: it.id, payId: p.id, from: 'detail' })}
          onDeletePay={delPay}
        />
      )
    }
  } else if (sheet?.kind === 'form') {
    sheetEl = <ItemFormSheet key={sheetKey} desktop={desktop} editing={!!sheet.editId} initial={sheet.draft} today={today} projects={projects} saving={saving} onClose={closeSheet} onSave={onSaveItem} />
  } else if (sheet?.kind === 'pay') {
    const it = findItem(sheet.id)
    const pay = sheet.payId ? payments.find(p => p.id === sheet.payId) ?? null : null
    if (it && (!sheet.payId || pay)) {
      const x = derive(it, payments, today), from = sheet.from
      sheetEl = (
        <PaySheet
          key={sheetKey} desktop={desktop} x={x} editPay={pay} money={money} today={today} projects={projects}
          efBalance={emergencyFund?.currentBalance ?? 0} saving={saving} onClose={closeSheet}
          onSave={p => onSavePay(x, p, from)} onSaveEdit={p => pay && onSavePayEdit(pay, p)}
        />
      )
    }
  } else if (sheet?.kind === 'filter') {
    sheetEl = <FilterSheet segs={segs} cats={catOpts} shown={shownCount} onClear={clearFilters} onClose={closeSheet} />
  } else if (sheet?.kind === 'sub') {
    const sub = findSubscription(subs, sheet.id)
    if (sub) {
      sheetEl = (
        <SubscriptionSheet
          key={sheetKey} desktop={desktop} sub={sub} money={money} onClose={closeSheet}
          onEdit={() => open({ kind: 'subForm', editId: sub.head.id, from: 'sub', draft: subDraftOf(sub.head) })}
          onPay={() => open({ kind: 'pay', id: sub.head.id, payId: null, from: 'sub' })}
          onAddNext={() => addNext(sub.head)}
          onCancel={() => onCancelSub(sub)} onRestore={() => onRestoreSub(sub)}
          onLink={() => open({ kind: 'link', id: sub.head.id })} onUnlink={c => onUnlink(sub, c)}
        />
      )
    }
  } else if (sheet?.kind === 'subForm') {
    const pastCount = sheet.spottedTxnIds ? transactions.filter(t => sheet.spottedTxnIds!.includes(t.id)).length : 0
    sheetEl = <SubscriptionFormSheet key={sheetKey} desktop={desktop} editing={!!sheet.editId} initial={sheet.draft} today={today} saving={saving} pastCount={pastCount} onClose={closeSheet} onSave={onSaveSub} />
  } else if (sheet?.kind === 'link') {
    const sub = findSubscription(subs, sheet.id)
    if (sub) sheetEl = <LinkTransactionsSheet key={sheetKey} desktop={desktop} sub={sub} transactions={transactions} payments={payments} money={money} saving={saving} onClose={closeSheet} onLink={txns => onLinkTxns(sub, txns)} />
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const iconBtn: CSSProperties = { position: 'relative', width: 44, height: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
  const showControls = hasItems && !loading && tab === 'bills'
  const subsTab = tab === 'subs'
  const addNow = () => (subsTab ? openSubAdd() : openAdd())
  const catLabel = cats.length ? cats.length === 1 ? catName(cats[0]) : `${cats.length} categories` : 'Category'
  const caughtUpSub = setl.length
    ? `Nothing pending${segment === 'bills' ? ' in bills' : segment === 'income' ? ' in expected income' : ''}. ${setl.length} settled items are kept below.`
    : 'Nothing pending right now.'

  return (
    <AppShell title="Upcoming">
      <div className="up up-page anim-page">
        {/* Sticky page header */}
        <div ref={setHeadEl} style={{ position: 'sticky', top: 0, zIndex: 5, background: 'color-mix(in oklab, var(--bg) 88%, transparent)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 1160, margin: '0 auto', padding: phone ? 'max(14px, calc(env(safe-area-inset-top, 0px) + 6px)) 16px 12px' : '22px 32px 14px', display: 'flex', flexDirection: 'column', gap: 14, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ margin: 0, fontSize: phone ? 26 : 28, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.15 }}>Upcoming</h1>
                {desktop && <div style={{ color: 'var(--text-3)', marginTop: 3 }}>{subsTab ? 'Every subscription, when it renews and what it costs you.' : 'Bills, EMIs and money you expect, in the order they land.'}</div>}
              </div>
              {masked && (
                <button onClick={toggleMask} aria-label="Show amounts" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', borderRadius: 99, border: 0, background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer' }}>
                  <EyeOff size={14} strokeWidth={2} />Hidden
                </button>
              )}
              {desktop && (
                <button onClick={addNow} style={{ height: 42, padding: '0 18px', borderRadius: 12, border: 0, background: 'var(--brand)', color: 'var(--on-brand)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 6px 16px -8px var(--brand)' }}>
                  <Plus size={17} strokeWidth={2.2} />{subsTab ? 'Add subscription' : 'Add item'}
                </button>
              )}
              {phone && showControls && (
                <>
                  <button onClick={() => { setSearchOpen(o => !o); if (searchOpen) setQ('') }} aria-label="Search" style={iconBtn}><Search size={19} strokeWidth={2} /></button>
                  <button onClick={() => open({ kind: 'filter' })} aria-label="Filter" style={iconBtn}>
                    <SlidersHorizontal size={19} strokeWidth={2} />
                    {(cats.length > 0 || segment !== 'all') && <span style={{ position: 'absolute', top: 8, right: 8, ...dot('var(--brand)') }} />}
                  </button>
                </>
              )}
            </div>
            <div role="tablist" aria-label="Upcoming views" style={{ display: 'flex', gap: 22, marginTop: -2, marginBottom: showControls ? 0 : phone ? -12 : -14 }}>
              {([['bills', 'Bills', 0], ['subs', 'Subscriptions', subAlerts]] as const).map(([k, label, badge]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => switchTab(k)} style={{ height: 40, padding: 0, border: 0, background: 'transparent', borderBottom: `2.5px solid ${tab === k ? 'var(--text)' : 'transparent'}`, color: tab === k ? 'var(--text)' : 'var(--text-3)', fontWeight: 600, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                  {label}
                  {badge > 0 && <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 99, background: 'var(--bad)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>{badge}</span>}
                </button>
              ))}
            </div>
            {phone && searchOpen && hasItems && !subsTab && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 12px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)' }}>
                <Search size={17} strokeWidth={2} style={{ flexShrink: 0, color: 'var(--text-3)' }} />
                <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search bills, income, notes" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', fontSize: 16 }} />
              </div>
            )}
            {showControls && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {desktop && (
                  <div style={{ display: 'flex', gap: 22, marginRight: 'auto' }}>
                    {([['pending', 'Pending', pendTotal], ['settled', 'Settled', setl.length]] as const).map(([k, label, count]) => (
                      <button key={k} onClick={() => setView(k)} style={{ height: 38, padding: 0, border: 0, background: 'transparent', borderBottom: `2px solid ${view === k ? 'var(--text)' : 'transparent'}`, color: view === k ? 'var(--text)' : 'var(--text-3)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                        {label}<span style={{ fontSize: 12, fontWeight: 500, padding: '1px 7px', borderRadius: 99, background: 'var(--surface-2)', color: 'var(--text-3)' }}>{count}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', padding: 3, borderRadius: 12, background: 'var(--surface-2)', gap: 2, flex: phone ? '1' : '0 0 auto' }}>
                  {segs.map(s => <button key={s.key} onClick={s.on} style={{ flex: 1, height: 36, padding: '0 14px', borderRadius: 9, border: 0, ...segBtnStyle(s.sel), fontWeight: 500, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>{s.label}</button>)}
                </div>
                {desktop && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, width: 230, padding: '0 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', boxSizing: 'border-box' }}>
                      <Search size={16} strokeWidth={2} style={{ flexShrink: 0, color: 'var(--text-3)' }} />
                      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent' }} />
                    </div>
                    <div ref={popRef} style={{ position: 'relative' }}>
                      <button onClick={() => setCatPop(p => !p)} aria-expanded={catPop} style={{ height: 42, padding: '0 14px', borderRadius: 12, border: `1px solid ${cats.length ? 'var(--brand)' : 'var(--border)'}`, background: cats.length ? 'var(--brand-soft)' : 'var(--surface)', color: cats.length ? 'var(--brand-ink)' : 'var(--text)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <SlidersHorizontal size={16} strokeWidth={2} />{catLabel}<ChevronDown size={14} strokeWidth={2} />
                      </button>
                      {catPop && (
                        <div className="up-pop" style={{ position: 'absolute', right: 0, top: 48, width: 250, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 20px 50px -20px rgba(0,0,0,.35)', padding: 8, zIndex: 10 }}>
                          {catOpts.map(c => (
                            <button key={c.name} onClick={c.on} className="up-hov" style={{ width: '100%', height: 40, display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px', border: 0, borderRadius: 10, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                              <span style={checkBox(c.sel, 18)}>{c.sel && <Check size={12} strokeWidth={3} />}</span>
                              <span style={dot(c.color)} />
                              <span style={{ flex: 1 }}>{c.label}</span>
                              <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{c.count}</span>
                            </button>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px 4px', borderTop: '1px solid var(--border)', marginTop: 6 }}>
                            <button onClick={() => setCats([])} style={{ border: 0, background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', padding: '6px 0' }}>Clear</button>
                            <button onClick={() => setCatPop(false)} style={{ border: 0, background: 'transparent', color: 'var(--brand-ink)', fontWeight: 600, cursor: 'pointer', padding: '6px 0' }}>Done</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ maxWidth: 1160, margin: '0 auto', padding: phone ? '16px 16px 40px' : '24px 32px 56px', boxSizing: 'border-box' }}>
          {loading && (
            <div className="up-pulse" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ height: phone ? 220 : 190, borderRadius: 'var(--radius-xl)', background: 'var(--surface-2)' }} />
              {[0, 1].map(g => (
                <div key={g} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ width: 140, height: 14, borderRadius: 6, background: 'var(--surface-2)' }} />
                  <div style={card}>
                    {['62%', '48%', '70%'].map((w, i) => (
                      <div key={w} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderTop: i ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ width: 46, height: 50, borderRadius: 12, background: 'var(--surface-2)' }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}><div style={{ width: w, height: 12, borderRadius: 6, background: 'var(--surface-2)' }} /><div style={{ width: '40%', height: 10, borderRadius: 6, background: 'var(--surface-2)' }} /></div>
                        <div style={{ width: 70, height: 40, borderRadius: 12, background: 'var(--surface-2)' }} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && subsTab && (
            <SubscriptionsView
              desktop={desktop} subs={subs} payments={payments} spotted={spotted} today={today} money={money} stickyTop={headH + 16}
              onOpen={id => open({ kind: 'sub', id })}
              onAdd={serviceId => { const svc = serviceId ? serviceById(serviceId) : undefined; openSubAdd(svc ? { label: svc.name, cat: svc.category } : undefined) }}
              onTrack={onTrack} onDismiss={onDismiss}
            />
          )}

          {!loading && !subsTab && !hasItems && (
            <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, padding: phone ? '44px 20px' : '72px 24px' }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--brand-soft)', color: 'var(--brand-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Calendar size={28} strokeWidth={1.8} /></div>
              <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>Nothing planned yet</div>
              <div style={{ color: 'var(--text-3)', maxWidth: 340, textWrap: 'pretty' } as CSSProperties}>Track upcoming bills, EMIs, and money you expect to receive.</div>
              <button onClick={() => openAdd()} style={{ height: 46, padding: '0 22px', borderRadius: 12, border: 0, background: 'var(--brand)', color: 'var(--on-brand)', fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>Add first item</button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', marginTop: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Or start with</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {([['Rent', 'expense', 'Rent / Deposit'], ['Credit card bill', 'expense', 'Other'], ['Freelance payout', 'income', 'Freelance']] as const).map(([label, flow, cat]) => (
                    <button key={label} onClick={() => openAdd({ label, flow, cat, recurring: label === 'Rent' })} style={{ height: 36, padding: '0 14px', borderRadius: 99, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><span style={dot(catColor(cat))} />{label}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!loading && !subsTab && hasItems && (
            <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'minmax(0,1fr) 288px' : 'minmax(0,1fr)', gap: 24, alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>

                {view === 'pending' && !filtering && (
                  <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-xl)', padding: phone ? 20 : '26px 28px', color: '#fff', background: 'linear-gradient(140deg, var(--hero-a) 0%, var(--hero-b) 100%)', boxShadow: '0 22px 44px -22px color-mix(in oklab, var(--hero-a) 80%, transparent)' }}>
                    <div style={{ position: 'absolute', right: -140, top: -160, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.26), rgba(255,255,255,0) 62%)', pointerEvents: 'none' }} />
                    <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 22 }}>
                      <div style={{ flex: '1 1 250px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.88 }}>{hero.label}</span>
                          {hero.overdueTxt && <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: '#FFE1D9', color: '#8C2B12' }}>{hero.overdueTxt}</span>}
                        </div>
                        {hero.num && <div style={{ fontSize: phone ? 38 : 48, fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1.05, ...tnum }}>{hero.num}</div>}
                        {hero.okTitle && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
                            <span style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={22} strokeWidth={2.4} /></span>
                            <div><div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>{hero.okTitle}</div><div style={{ opacity: 0.85 }}>{hero.okSub}</div></div>
                          </div>
                        )}
                        {hero.sub && <div style={{ fontSize: 13, opacity: 0.88 }}>{hero.sub}</div>}
                        {hero.month && (
                          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}><span style={{ opacity: 0.88 }}>{hero.month.label}</span><span style={{ ...tnum, fontWeight: 500 }}>{hero.month.val}</span></div>
                            <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,.2)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${hero.month.pct}%`, borderRadius: 99, background: '#fff' }} /></div>
                          </div>
                        )}
                      </div>
                      <div style={{ flex: '1 1 330px', display: 'grid', gridTemplateColumns: phone ? 'repeat(2,minmax(0,1fr))' : 'repeat(auto-fit,minmax(96px,1fr))', gap: 10, alignContent: 'stretch' }}>
                        {hero.stats.map((s, i, arr) => (
                          <div key={s.label} style={{ gridColumn: phone && arr.length === 3 && i === 2 ? '1 / -1' : 'auto', borderRadius: 14, padding: phone ? 12 : 14, ...s.tint, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, backdropFilter: 'blur(4px)' }}>
                            <span style={{ fontSize: 12, opacity: 0.88 }}>{s.label}</span>
                            <span style={{ fontSize: phone ? 17 : 19, fontWeight: 600, ...tnum, ...ellipsis, letterSpacing: '-0.01em' }}>{s.value}</span>
                            <span style={{ fontSize: 12, opacity: 0.8, marginTop: 'auto' }}>{s.sub}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ position: 'relative', marginTop: 16, fontSize: 12, opacity: 0.72 }}>{hero.scope}</div>
                  </div>
                )}

                {view === 'pending' && (
                  <>
                    {groups.map(g => (
                      <div key={g.key} data-grp={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px', flexWrap: 'wrap', rowGap: 4 }}>
                          <span style={dot(g.dotC)} />
                          <span style={{ fontSize: 15, fontWeight: 600, color: g.titleColor }}>{g.title}</span>
                          <span style={{ color: 'var(--text-3)', fontSize: 13 }}>{g.sub}</span>
                          <span style={{ flex: 1 }} />
                          <span style={{ display: 'flex', gap: 12, fontSize: 13, ...tnum }}>
                            {g.hasOut && <span style={{ color: 'var(--bad-ink)' }}>↓ {money(g.out, true)}</span>}
                            {g.hasIn && <span style={{ color: 'var(--good-ink)' }}>↑ {money(g.inn, true)}</span>}
                            {g.hasOut && g.hasIn && <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>Net {signed(g.inn - g.out)}</span>}
                            {!(g.hasOut && g.hasIn) && g.logged > 0 && <span style={{ color: 'var(--text-3)' }}>{money(g.logged, true)} logged</span>}
                          </span>
                        </div>
                        <div style={{ ...card, overflow: 'hidden' }}>{g.xs.map(row)}</div>
                      </div>
                    ))}

                    {groups.length === 0 && !filtering && (
                      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, padding: 20 }}>
                        <span style={checkCircle(40)}><Check size={20} strokeWidth={2.2} /></span>
                        <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>You’re all caught up</div><div style={{ color: 'var(--text-3)', fontSize: 13 }}>{caughtUpSub}</div></div>
                        <button onClick={() => openAdd()} style={{ height: 40, padding: '0 14px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'transparent', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>Plan next</button>
                      </div>
                    )}

                    {groups.length === 0 && filtering && (
                      <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '40px 20px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 600 }}>No pending items match</div>
                        <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Try another word or category.</div>
                        <button onClick={clearFilters} style={{ height: 40, padding: '0 16px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'transparent', fontWeight: 500, cursor: 'pointer', marginTop: 4 }}>Clear filters</button>
                      </div>
                    )}

                    {phone && recent.length > 0 && !filtering && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
                          <span style={dot('var(--good)')} />
                          <span style={{ fontSize: 15, fontWeight: 600 }}>Recently settled</span>
                          <span style={{ flex: 1 }} />
                          <button onClick={goSettled} style={{ border: 0, background: 'transparent', color: 'var(--brand-ink)', fontWeight: 600, cursor: 'pointer', height: 36 }}>See all · {setl.length}</button>
                        </div>
                        <div style={{ ...card, overflow: 'hidden' }}>{recent.map((x, i) => settledRow(x, i, false))}</div>
                      </div>
                    )}
                  </>
                )}

                {view === 'settled' && (
                  <>
                    {phone && (
                      <button onClick={() => setView('pending')} style={{ alignSelf: 'flex-start', height: 40, padding: '0 12px 0 6px', borderRadius: 12, border: 0, background: 'transparent', color: 'var(--text-2)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}><ChevronLeft size={18} strokeWidth={2} />Pending</button>
                    )}
                    {Array.from(sgMap.entries()).map(([k, xs]) => {
                      const d = pd(`${k}-01`)
                      return (
                        <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
                            <span style={{ fontSize: 15, fontWeight: 600 }}>Settled in {MONTHS[d.getMonth()]} {d.getFullYear()}</span>
                            <span style={{ color: 'var(--text-3)', fontSize: 13 }}>{plural(xs.length, 'item')}</span>
                            <span style={{ flex: 1 }} />
                            <span style={{ fontSize: 13, color: 'var(--text-3)', ...tnum }}>{money(xs.filter(x => !x.inc).reduce((a, x) => a + x.paid, 0), true)} out</span>
                          </div>
                          <div style={{ ...card, overflow: 'hidden' }}>{xs.map((x, i) => settledRow(x, i, false))}</div>
                        </div>
                      )
                    })}
                    {sgMap.size === 0 && <div style={{ ...card, padding: '40px 20px', textAlign: 'center', color: 'var(--text-3)' }}>Nothing settled yet. Paid items will collect here, grouped by month.</div>}
                  </>
                )}
              </div>

              {desktop && (
                <div style={{ position: 'sticky', top: headH, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {groups.length > 1 && (
                    <div style={{ ...card, padding: 8 }}>
                      <div style={{ ...eyebrow, padding: '10px 10px 6px' }}>Jump to</div>
                      {groups.map(g => (
                        <button key={g.key} onClick={() => jump(g.key)} className="up-hov" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, height: 40, padding: '0 10px', border: 0, borderRadius: 10, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                          <span style={dot(g.dotC, 7)} />
                          <span style={{ flex: 1, fontWeight: 500, color: g.titleColor }}>{g.title}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-3)', ...tnum }}>{g.hasOut ? money(g.out, true) : `↑ ${money(g.inn, true)}`}</span>
                          <span style={{ fontSize: 11, minWidth: 20, textAlign: 'center', padding: '1px 6px', borderRadius: 99, background: 'var(--surface-2)', color: 'var(--text-3)' }}>{g.xs.length}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {recent.length > 0 && (
                    <div style={{ ...card, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px 8px' }}><span style={{ ...eyebrow, flex: 1 }}>Recently settled</span></div>
                      {recent.map((x, i) => settledRow(x, i, true))}
                      <button onClick={goSettled} style={{ width: '100%', height: 44, border: 0, borderTop: '1px solid var(--border)', background: 'transparent', color: 'var(--brand-ink)', fontWeight: 600, cursor: 'pointer', marginTop: 6 }}>See all settled · {setl.length}</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Phone: add sits beside the AI button, so nothing stacks */}
      {phone && (
        <button onClick={addNow} aria-label={subsTab ? 'Add subscription' : 'Add upcoming item'} className="up" style={{ position: 'fixed', zIndex: 40, right: 74, bottom: 'calc(max(100px, calc(env(safe-area-inset-bottom, 0px) + 80px)) - 5px)', width: 60, height: 60, borderRadius: 20, border: 0, background: 'var(--brand)', color: 'var(--on-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 12px 26px -10px var(--brand)' }}>
          <Plus size={26} strokeWidth={2.2} />
        </button>
      )}

      {toastState && (
        <div className="up" style={{ position: 'fixed', left: 0, right: 0, bottom: phone ? 'calc(max(100px, calc(env(safe-area-inset-bottom, 0px) + 80px)) + 66px)' : 24, display: 'flex', justifyContent: 'center', zIndex: 110, pointerEvents: 'none', padding: '0 16px' }}>
          <div role="status" className="up-toast" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 14, padding: '10px 10px 10px 16px', minHeight: 44, boxSizing: 'border-box', borderRadius: 14, background: '#1E211D', color: '#F3F3EE', boxShadow: '0 16px 40px -14px rgba(0,0,0,.5)', maxWidth: '100%' }}>
            <Check size={16} strokeWidth={2.6} style={{ flexShrink: 0, color: 'oklch(0.8 0.13 152)' }} />
            <span style={{ fontWeight: 500 }}>{toastState.msg}</span>
            {toastState.action && <button onClick={toastState.action.on} style={{ height: 34, padding: '0 12px', borderRadius: 9, border: 0, background: 'oklch(0.8 0.13 152)', color: '#0F2416', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{toastState.action.label}</button>}
          </div>
        </div>
      )}

      {sheetEl}
    </AppShell>
  )
}

// ── Hero ─────────────────────────────────────────────────────────────────────

interface Hero {
  label: string; overdueTxt?: string; num?: string; okTitle?: string; okSub?: string; sub?: string
  month?: { label: string; val: string; pct: number }
  stats: { label: string; value: string; sub: string; tint: CSSProperties }[]
  scope: string
}

function buildHero(all: Derived[], today: string, money: (n: number, round?: boolean) => string, signed: (n: number) => string): Hero {
  const m = (n: number) => money(n, true)
  const sum = (xs: Derived[], f: (x: Derived) => number) => xs.reduce((a, x) => a + f(x), 0)
  const exps = all.filter(x => !x.inc), incs = all.filter(x => x.inc)
  const pendExp = exps.filter(x => !x.settled), pendInc = incs.filter(x => !x.settled)
  // Next 30 days counts today and the 29 days after it, overdue included
  const in30d = (x: Derived) => x.d < 30
  const week = pendExp.filter(x => x.d <= 7), od = pendExp.filter(x => x.d < 0)
  const dueWeek = sum(week, x => x.remaining)
  const out30 = sum(pendExp.filter(in30d), x => x.remaining)
  const in30 = sum(pendInc.filter(in30d), x => x.remaining)
  const ym = today.slice(0, 7), mName = monthName(today)
  const inMonth = (xs: Derived[]) => xs.filter(x => x.it.dueDate.startsWith(ym))
  const monT = sum(inMonth(exps), x => x.it.amount), monP = sum(inMonth(exps), x => Math.min(x.paid, x.it.amount))
  const monIT = sum(inMonth(incs), x => x.it.amount), monIP = sum(inMonth(incs), x => Math.min(x.paid, x.it.amount))
  const range = `${sh(today)} – ${sh(addDays(today, 29))}`

  if (exps.length === 0) {
    const nextI = pendInc.slice().sort((a, b) => a.d - b.d)[0]
    return {
      label: 'Coming in · next 30 days',
      num: in30 > 0 ? `+${m(in30)}` : undefined,
      okTitle: in30 === 0 ? (pendInc.length ? 'Nothing due in 30 days' : 'All received') : undefined,
      okSub: pendInc.length ? `Next: ${nextI?.it.label ?? ''}` : `${m(sum(incs, x => x.paid))} received in total`,
      month: monIT > 0 ? { label: `${mName} · received`, val: `${m(monIP)} of ${m(monIT)}`, pct: Math.round(monIP / monIT * 100) } : undefined,
      stats: [
        { label: 'Pending, all dates', value: `+${m(sum(pendInc, x => x.remaining))}`, sub: `${pendInc.length} expected`, tint: GLASS },
        { label: `Received in ${mName.slice(0, 3)}`, value: m(monIP), sub: `of ${m(monIT)}`, tint: GLASS },
      ],
      scope: `Next 30 days = ${range}. Late payments count as pending.`,
    }
  }

  const nextE = pendExp.filter(x => x.d > 7).sort((a, b) => a.d - b.d)[0]
  const net = in30 - out30
  const hero: Hero = {
    label: 'Due this week',
    overdueTxt: od.length ? `${od.length} overdue · ${m(sum(od, x => x.remaining))}` : undefined,
    num: dueWeek > 0 ? m(dueWeek) : undefined,
    okTitle: dueWeek > 0 ? undefined : pendExp.length ? 'Nothing due this week' : 'All settled',
    okSub: pendExp.length
      ? nextE ? `Next: ${nextE.it.label.slice(0, 32)}${nextE.it.label.length > 32 ? '…' : ''} · ${sh(nextE.it.dueDate)}` : ''
      : 'Every bill is paid.',
    sub: dueWeek > 0 ? `${plural(week.length, 'bill')}${od.length ? ', including overdue' : ''} · through ${sh(addDays(today, 7))}` : undefined,
    month: monT > 0 ? { label: `${mName} bills · paid`, val: `${m(monP)} of ${m(monT)}`, pct: Math.round(monP / monT * 100) } : undefined,
    stats: [{ label: 'Going out', value: m(out30), sub: plural(pendExp.filter(in30d).length, 'bill'), tint: out30 > 0 && od.length ? WATCH : GLASS }],
    scope: `Next 30 days = ${range} · includes overdue · unpaid amounts only`,
  }
  if (incs.length) {
    hero.stats.push({ label: 'Coming in', value: `+${m(in30)}`, sub: `${pendInc.filter(in30d).length} expected`, tint: GLASS })
    hero.stats.push({ label: 'Net, 30 days', value: signed(net), sub: net < 0 ? 'more out than in' : 'more in than out', tint: net < 0 ? (net < -50000 ? RISK : WATCH) : GLASS })
  } else {
    hero.stats.push({ label: 'After 30 days', value: m(sum(pendExp.filter(x => !in30d(x)), x => x.remaining)), sub: 'planned later', tint: GLASS })
  }
  return hero
}
