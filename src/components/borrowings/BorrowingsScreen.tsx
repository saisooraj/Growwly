'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from 'next-themes'
import toast from 'react-hot-toast'
import { addBorrowing, addContact, addTransaction, deleteBorrowing, deleteContact, updateBorrowing, updateContact } from '@/lib/firestore'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import { usePrivacy } from '@/store/privacyStore'
import type { Borrowing, Transaction } from '@/types'
import {
  MON, MONL, addM, avatar, derive, dueText, emiOf, fd, firstName, groupPeople, initialOf, inr, nkey, pd, toRecs, todayISO, words,
  type DRec, type Person, type Rec,
} from './model'
import { Ico, P, PersonPanel, balance, pretty, type PersonVM, type RecVM, type TimelineGroup, type Tone } from './parts'
import {
  ConfirmBody, FormBody, PeopleBody, RepayBody, SheetFrame, SortBody, SortPopover,
  type ConfirmVM, type FormVM, type PeopleRowVM, type PeopleVM, type RepayVM, type SortOpt,
} from './sheets'

// ── UI state ──────────────────────────────────────────────────────────────────

type SheetKind = 'person' | 'form' | 'repay' | 'mark' | 'delete' | 'sort' | 'people'
interface Sheet { kind: SheetKind; key?: string; id?: string; back?: Sheet | null }
interface Form {
  mode: 'add' | 'edit'; id: string | null; type: 'lent' | 'borrowed'; amount: string; repaid: string; origRepaid: number
  person: string; desc: string; date: string; due: string; isLoan: boolean; rate: string; tenure: string; emi: string
  emiEdited: boolean; showErrors: boolean
}
interface Repay { id: string; amount: string; date: string; note: string }
interface PM {
  q: string; adding: boolean; newName: string; newPhone: string; addErr: string
  editing: string | null; editName: string; editPhone: string; deleting: string | null
}
interface UI {
  filter: 'all' | 'lent' | 'borrowed'; q: string; sort: 'balance' | 'oldest' | 'due'; selected: string; tab: 'records' | 'timeline'
  showSettledRecs: Record<string, boolean>; showSettledPeople: boolean; expanded: Record<string, boolean>
  sortOpen: boolean; sheet: Sheet | null; form: Form | null; repay: Repay | null; pm: PM | null
}

const INITIAL: UI = {
  filter: 'all', q: '', sort: 'balance', selected: '', tab: 'records', showSettledRecs: {}, showSettledPeople: false,
  expanded: {}, sortOpen: false, sheet: null, form: null, repay: null, pm: null,
}
const SORTS = [['balance', 'Biggest balance', 'Amount'], ['oldest', 'Oldest first', 'Date'], ['due', 'Due soonest', 'Due date']] as const
const SHEET_W: Record<SheetKind, string> = { form: '560px', people: '560px', repay: '480px', mark: '440px', delete: '440px', sort: '380px', person: '560px' }

/** The repayment transaction logged when money comes back or goes out against a record */
function repaymentTx(b: Borrowing, amount: number, date: string, note: string) {
  const lent = b.type === 'lent'
  return {
    type: 'transfer', transferKind: lent ? 'loan_repayment_received' : 'loan_repayment_paid',
    amount, category: 'Other', date,
    notes: note.trim() || `${lent ? `Repayment from ${b.person}` : `Repaid to ${b.person}`}${b.description ? ' · ' + b.description : ''}`,
    isRecurring: false, loanPerson: b.person, borrowingId: b.id,
  } as Omit<Transaction, 'id' | 'userId' | 'createdAt'>
}

function formErrors(f: Form) {
  const amt = parseFloat(f.amount) || 0, rep = parseFloat(f.repaid) || 0, ten = parseInt(f.tenure, 10) || 0
  const e: Partial<Record<'amount' | 'person' | 'repaid' | 'due' | 'loan', string>> = {}
  if (!(amt > 0)) e.amount = 'Enter an amount greater than ₹0'
  if (!f.person.trim()) e.person = f.isLoan && f.type === 'borrowed' ? 'Add the bank or lender' : 'Who is this with?'
  if (amt > 0 && rep > amt) e.repaid = `Can't be more than the amount (${inr(amt)})`
  if (f.due && f.date && f.due < f.date) e.due = 'This is before the date'
  if (f.isLoan && !ten) e.loan = 'Add the tenure in months'
  else if (f.isLoan && f.rate === '') e.loan = 'Add an interest rate — 0 is fine'
  return e
}

const skel = (h: number | string, delay = 0, extra?: CSSProperties): CSSProperties => ({
  height: h, borderRadius: 12, background: 'var(--skel)', animation: `bw-pulse 1.4s ease-in-out ${delay}s infinite`, ...extra,
})

/** Desktop layout from 1024px, where the app shows its sidebar instead of the nav pill */
function useIsDesktop() {
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const on = () => setDesktop(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return desktop
}

export default function BorrowingsScreen() {
  const { user } = useAuth()
  const refresh = useRefreshData()
  const { borrowings, contacts, transactions, initialized } = useAppStore()
  const desktop = useIsDesktop()
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
  const privacy = usePrivacy(st => st.masked)
  const togglePrivacy = usePrivacy(st => st.toggle)
  const hydratePrivacy = usePrivacy(st => st.hydrate)
  useEffect(() => { hydratePrivacy() }, [hydratePrivacy])

  const [s, setS] = useState<UI>(INITIAL)
  const update = (p: Partial<UI> | ((prev: UI) => Partial<UI>)) => setS(prev => ({ ...prev, ...(typeof p === 'function' ? p(prev) : p) }))
  const patch = (p: Partial<UI>) => () => update(p)
  const [busy, setBusy] = useState(false)
  const [toastText, setToastText] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  const showToast = (t: string) => { clearTimeout(toastTimer.current); setToastText(t); toastTimer.current = setTimeout(() => setToastText(null), 2600) }
  useEffect(() => () => clearTimeout(toastTimer.current), [])
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isPhone = !desktop, isDesktop = desktop
  const device = isPhone ? 'phone' : 'desktop'
  const m = (n: number) => privacy ? '₹ ••••' : inr(n)
  const av = (name: string) => avatar(name, dark)

  const recs: Rec[] = toRecs(borrowings, transactions)
  const people = groupPeople(recs, contacts)
  const withRecs = people.filter(p => p.records.length)
  const isLoading = !initialized
  const isFirstRun = !isLoading && recs.length === 0
  const isReady = !isLoading && !isFirstRun

  // Close sheets with Escape, keep the page behind still, and close the sort popover on an outside click
  const sortRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!s.sheet && !s.sortOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (s.sheet) closeSheet(); else update({ sortOpen: false }) } }
    const onDown = (e: PointerEvent) => { if (s.sortOpen && sortRef.current && !sortRef.current.contains(e.target as Node)) update({ sortOpen: false }) }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown) }
  })
  const anySheet = !!s.sheet
  useEffect(() => {
    if (!anySheet) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [anySheet])

  // ── Sheet plumbing ──────────────────────────────────────────────────────────

  const nameOf = (key: string) => contacts.find(c => nkey(c.name) === key)?.name ?? recs.find(r => nkey(r.person) === key)?.person.trim() ?? ''

  function formPatch(mode: 'add' | 'edit', id: string | null, personName: string): Partial<UI> {
    if (mode === 'edit') {
      const r = recs.find(x => x.id === id)
      if (!r) return {}
      return {
        form: {
          mode, id: r.id, type: r.type, amount: String(r.amount), repaid: r.repaid ? String(r.repaid) : '', origRepaid: r.repaid || 0,
          person: r.person.trim(), desc: r.desc, date: r.date, due: r.due, isLoan: !!r.loan,
          rate: r.loan ? String(r.loan.rate) : '', tenure: r.loan ? String(r.loan.tenure) : '', emi: r.loan ? String(r.loan.emi) : '',
          emiEdited: !!r.loan && r.loan.emi !== emiOf(r.amount, r.loan.rate, r.loan.tenure), showErrors: false,
        },
        sheet: { kind: 'form' },
      }
    }
    return {
      form: { mode: 'add', id: null, type: 'lent', amount: '', repaid: '', origRepaid: 0, person: personName, desc: '', date: todayISO(), due: '', isLoan: false, rate: '', tenure: '', emi: '', emiEdited: false, showErrors: false },
      sheet: { kind: 'form' },
    }
  }
  function repayPatch(id: string | null, key: string | null): Partial<UI> {
    let r = id ? recs.find(x => x.id === id) : undefined
    if (!r && key) r = recs.filter(x => nkey(x.person) === key && derive(x).isOpen).sort((a, b) => a.date.localeCompare(b.date))[0]
    if (!r) return {}
    const out = r.amount - r.repaid
    const def = r.loan && r.loan.emi ? Math.min(out, r.loan.emi) : out
    return { repay: { id: r.id, amount: String(def), date: todayISO(), note: '' }, sheet: { kind: 'repay' } }
  }
  function pmPatch(mode: 'add' | 'edit' | null, person: string): Partial<UI> {
    const pm: PM = { q: '', adding: mode === 'add', newName: mode === 'add' ? person : '', newPhone: '', addErr: '', editing: null, editName: '', editPhone: '', deleting: null }
    if (mode === 'edit' && person) {
      const k = nkey(person), c = contacts.find(c => nkey(c.name) === k)
      pm.editing = k; pm.editName = c ? c.name : person; pm.editPhone = c?.phone ?? ''
    }
    return { pm, sheet: { kind: 'people' } }
  }
  function openSheet(p: Partial<UI>) {
    if (!p.sheet) return
    update(prev => ({ ...p, sortOpen: false, sheet: { ...p.sheet!, back: prev.sheet?.kind === 'person' ? prev.sheet : null } }))
  }
  function closeSheet() { update(prev => ({ sheet: prev.sheet?.back ?? null, form: null, repay: null, pm: null })) }
  const openPerson = (key: string) => update(isPhone ? { selected: key, tab: 'records', sheet: { kind: 'person', key } } : { selected: key, tab: 'records' })

  // ── Actions ─────────────────────────────────────────────────────────────────

  function remind(p: Person, list: DRec[]) {
    if (!list.length) return
    const lent = list[0].type === 'lent'
    const total = list.reduce((a, x) => a + x.out, 0)
    const what = list.map(x => x.desc || (lent ? 'the money I lent you' : 'the money you lent me')).join(', ')
    const nm = firstName(p.name)
    const msg = lent
      ? `Hi ${nm}, just a reminder that you owe me ${inr(total)} for ${what}. Please let me know when you can repay.`
      : `Hi ${nm}, I still owe you ${inr(total)} for ${what}. I'll arrange to repay soon.`
    const digits = (p.phone || '').replace(/\D/g, '')
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
    showToast(digits ? `Opening WhatsApp for ${nm}…` : 'Opening WhatsApp — no number saved')
  }
  const remindPerson = (p: Person) => { const lent = p.open.filter(x => x.type === 'lent'); remind(p, lent.length ? lent : p.open.filter(x => x.type === 'borrowed').slice(0, 1)) }

  // Records with a close-out in flight: the sheet closes before the writes land, so a second
  // tap on a still-visible "Mark fully repaid" mustn't log the same repayment twice.
  const closing = useRef(new Set<string>())
  async function markRepaid(id: string) {
    if (!user || closing.current.has(id)) return
    const b = useAppStore.getState().borrowings.find(x => x.id === id)
    closeSheet()
    if (!b || b.status === 'repaid') return
    closing.current.add(id)
    const out = b.amount - b.repaidAmount
    const { borrowings: cur, setBorrowings } = useAppStore.getState()
    setBorrowings(cur.map(x => x.id === id ? { ...x, repaidAmount: x.amount, status: 'repaid' as const } : x))
    try {
      if (out > 0) await addTransaction(user.uid, repaymentTx(b, out, todayISO(), ''))
      await updateBorrowing(id, { repaidAmount: b.amount, status: 'repaid' })
      showToast(out > 0 ? 'Marked repaid & transaction logged' : 'Marked repaid')
    } catch {
      toast.error('Couldn’t mark it repaid')
      await refresh()
    } finally {
      closing.current.delete(id)
    }
  }

  async function deleteRecord(id: string) {
    const { borrowings: cur, setBorrowings } = useAppStore.getState()
    setBorrowings(cur.filter(b => b.id !== id))
    closeSheet()
    try {
      await deleteBorrowing(id)
      showToast('Record deleted')
    } catch {
      toast.error('Couldn’t delete the record')
      await refresh()
    }
  }

  async function saveForm() {
    const F = s.form
    if (!F || !user || busy) return
    if (Object.keys(formErrors(F)).length) return update(prev => ({ form: prev.form && { ...prev.form, showErrors: true } }))
    const amt = parseFloat(F.amount), rep = parseFloat(F.repaid) || 0, ten = parseInt(F.tenure, 10) || 0, rate = parseFloat(F.rate) || 0
    const emi = F.isLoan ? (F.emiEdited ? parseFloat(F.emi) || 0 : emiOf(amt, rate, ten)) : 0
    const date = F.date || todayISO()
    const due = F.isLoan && !F.due ? addM(date, ten) : F.due
    const person = F.person.trim()
    const payload = {
      type: F.type, amount: amt, person, description: F.desc.trim(), date, repaidAmount: rep,
      status: (rep >= amt ? 'repaid' : rep > 0 ? 'partial' : 'pending') as Borrowing['status'],
      isLoan: F.isLoan, ...(F.isLoan ? { interestRate: rate, tenureMonths: ten, emiAmount: emi } : {}),
    }
    const diff = F.mode === 'edit' ? rep - F.origRepaid : 0
    setBusy(true)
    try {
      if (F.mode === 'edit' && F.id) {
        const old = borrowings.find(b => b.id === F.id)
        // An empty dueDate clears one that was removed in the form
        await updateBorrowing(F.id, { ...payload, dueDate: due })
        if (diff > 0 && old) await addTransaction(user.uid, repaymentTx({ ...old, ...payload }, diff, todayISO(), ''))
      } else {
        await addBorrowing(user.uid, { ...payload, ...(due ? { dueDate: due } : {}) })
      }
      update(prev => ({ selected: nkey(person), form: null, sheet: prev.sheet?.back ?? null }))
      showToast(diff > 0 ? 'Updated & transaction logged' : F.mode === 'edit' ? 'Record updated' : 'Record added')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(msg.includes('permission') ? 'Permission denied — check Firestore rules' : 'Couldn’t save the record')
    } finally {
      setBusy(false)
    }
  }

  async function saveRepay() {
    const RP = s.repay
    if (!RP || !user || busy) return
    const b = useAppStore.getState().borrowings.find(x => x.id === RP.id)
    if (!b) return
    const out = b.amount - b.repaidAmount, amt = parseFloat(RP.amount) || 0
    if (!(amt > 0) || amt > out) return
    const repaid = b.repaidAmount + amt
    setBusy(true)
    try {
      await addTransaction(user.uid, repaymentTx(b, amt, RP.date || todayISO(), RP.note))
      await updateBorrowing(b.id, { repaidAmount: repaid, status: repaid >= b.amount ? 'repaid' : 'partial' })
      closeSheet()
      showToast(amt === out ? 'Repayment logged — record settled' : 'Repayment logged')
    } catch {
      toast.error('Couldn’t log the repayment')
    } finally {
      setBusy(false)
    }
  }

  // ── Records and people → what the rows show ────────────────────────────────

  const recVM = (x: DRec, p: Person, autoId: string): RecVM => {
    const lent = x.type === 'lent'
    // The tile shows the date that matters next (due or next EMI), else the day it was lent or borrowed
    const tileISO = x.isOpen && x.eff ? x.eff : x.date
    const tileD = pd(tileISO)
    const urgent = x.overdue || x.soon
    const status = !x.isOpen ? '' : urgent ? dueText(x) : x.eff ? `${x.loan ? 'Next EMI' : 'Due'} ${fd(x.eff)}` : ''
    const meta: string[] = []
    if (!x.isOpen) meta.push(x.settledOn ? 'Settled ' + fd(x.settledOn) : 'Settled', `${lent ? 'lent' : 'borrowed'} ${fd(x.date)}`)
    else {
      meta.push(lent ? 'Owed to you' : 'You owe')
      if (x.loan) meta.push('EMI loan')
      if (x.eff) meta.push(`${lent ? 'lent' : 'borrowed'} ${fd(x.date)}`)
    }
    const expanded = s.expanded[x.id] !== undefined ? !!s.expanded[x.id] : x.id === autoId
    const sorted = [...x.settlements].sort((a, b) => b.date.localeCompare(a.date))
    const more = sorted.length - 3
    const pct = Math.round(x.repaid / x.amount * 100)
    const tenure = x.loan?.tenure ?? 0
    const progress = !x.isOpen ? null
      : x.loan ? { pct: (tenure ? Math.round(x.monthsPaid / tenure * 100) : 0) + '%', label: `${x.monthsPaid} of ${tenure} EMIs · ${m(x.out)} left${x.due ? ' · ends ' + fd(x.due) : ''}` }
      : x.partial ? { pct: pct + '%', label: `${m(x.repaid)} ${lent ? 'back' : 'paid'} · ${m(x.out)} left` }
      : null
    return {
      id: x.id, closed: !x.isOpen, title: x.desc || (lent ? 'Lent' : 'Borrowed'),
      amount: m(x.amount), amountTone: !x.isOpen ? 'muted' : lent ? 'good' : 'ink',
      tileMon: MON[tileD.getMonth()].toUpperCase(), tileDay: String(tileD.getDate()),
      tileTone: x.overdue ? 'bad' : x.soon ? 'warn' : 'neutral',
      status, statusTone: x.overdue ? 'bad' : x.soon ? 'warn' : 'muted', meta: meta.join(' · '),
      progress,
      loan: x.loan ? {
        emi: m(x.loan.emi) + '/mo', rate: x.loan.rate + '% a yr', left: `${x.monthsLeft} of ${tenure}`, next: x.isOpen && x.nextEmi ? fd(x.nextEmi) : '—',
      } : null,
      action: x.isOpen ? (lent ? 'Receive' : 'Pay') : '', actionUrgent: urgent,
      expanded,
      onToggle: () => update(prev => ({ expanded: { ...prev.expanded, [x.id]: !expanded } })),
      settlements: sorted.slice(0, 3).map(st => ({ title: st.title, isExpense: st.kind === 'expense', amount: m(st.amount), date: fd(st.date), tone: st.kind === 'expense' ? 'warn' : 'info' })),
      moreSettlements: more > 0 ? `+ ${more} earlier ${more === 1 ? 'repayment' : 'repayments'} in Timeline` : '',
      isOpen: x.isOpen,
      onRepay: () => openSheet(repayPatch(x.id, null)),
      onMark: () => openSheet({ sheet: { kind: 'mark', id: x.id } }),
      onRemind: () => remind(p, [x]),
      onEdit: () => openSheet(formPatch('edit', x.id, '')),
      onDelete: () => openSheet({ sheet: { kind: 'delete', id: x.id } }),
    }
  }

  const personVM = (p: Person, inSheet: boolean): PersonVM => {
    const nm = firstName(p.name)
    const tone: Tone = p.openCount === 0 ? 'neutral' : p.net > 0 ? 'good' : p.net < 0 ? 'bad' : 'neutral'
    const netLabel = p.openCount === 0 ? `All settled with ${nm}` : p.net > 0 ? `${nm} owes you` : p.net < 0 ? `You owe ${nm}` : `You and ${nm} are even`
    const bits: string[] = []
    if (p.lent) bits.push(`Owed to you ${m(p.lent)}`)
    if (p.owe) bits.push(`You owe ${m(p.owe)}`)
    bits.push(`${p.records.length} ${p.records.length === 1 ? 'record' : 'records'}`)
    let warnText = '', warnTone: Tone = 'warn'
    const ob = p.open.find(x => x.overdue && x.type === 'borrowed')
    const ol = p.open.find(x => x.overdue && x.type === 'lent')
    if (ob) { warnTone = 'bad'; warnText = `Your repayment to ${nm} is ${-(ob.dueDays ?? 0)} days overdue — this lowers your health score.` }
    else if (ol) { warnText = `${m(ol.out)} from ${nm} is ${-(ol.dueDays ?? 0)} days overdue. A friendly nudge might help.` }
    const autoId = p.open[0]?.id ?? ''
    const showSettled = !!s.showSettledRecs[p.key]

    type Ev = TimelineGroup['items'][number] & { iso: string }
    const events: Ev[] = []
    for (const x of p.records) {
      const lent = x.type === 'lent'
      events.push({ iso: x.date, date: '', glyph: lent ? '↑' : '↓', tone: lent ? 'good' : 'bad', title: (lent ? 'Lent' : 'Borrowed') + (x.loan ? ' · EMI loan' : ''), sub: x.desc || '—', amount: m(x.amount), isExpense: false })
      for (const st of x.settlements) {
        if (st.kind === 'expense') events.push({ iso: st.date, date: '', glyph: '₹', tone: 'warn', title: st.title, sub: `Settled “${x.desc || (lent ? 'Lent' : 'Borrowed')}”`, amount: m(st.amount), isExpense: true })
        else events.push({ iso: st.date, date: '', glyph: '✓', tone: 'info', title: st.title, sub: `for ${x.desc || (lent ? 'Lent' : 'Borrowed')}`, amount: m(st.amount), isExpense: false })
      }
    }
    events.sort((a, b) => b.iso.localeCompare(a.iso))
    const timeline: TimelineGroup[] = []
    for (const e of events) {
      const d = pd(e.iso), label = `${MONL[d.getMonth()]} ${d.getFullYear()}`
      let g = timeline[timeline.length - 1]
      if (!g || g.label !== label) { g = { label, items: [] }; timeline.push(g) }
      g.items.push({ ...e, date: fd(e.iso) })
    }

    return {
      key: p.key, name: p.name, initial: initialOf(p.name), ...av(p.name),
      sub: p.phone || (p.isContact ? 'No phone saved' : 'From borrowings · not a saved contact'),
      isPhone: inSheet, onClose: closeSheet,
      tone, netLabel, netAmount: p.openCount === 0 ? 'Settled' : m(Math.abs(p.net)), breakdown: bits.join(' · '),
      warnText, warnTone, noOpen: p.openCount === 0,
      onRemind: () => remindPerson(p),
      onRepay: () => openSheet(repayPatch(null, p.key)),
      onAdd: () => openSheet(formPatch('add', null, p.name)),
      contactLabel: p.isContact ? 'Edit contact' : 'Save contact',
      onContact: () => openSheet(pmPatch(p.isContact ? 'edit' : 'add', p.name)),
      tabTimeline: s.tab === 'timeline', onTabRecords: patch({ tab: 'records' }), onTabTimeline: patch({ tab: 'timeline' }),
      recordsTabLabel: `Records · ${p.records.length}`,
      openRecords: p.open.map(x => recVM(x, p, autoId)), noOpenText: `Nothing open with ${nm} right now.`,
      settledCount: p.settled.length, showSettled,
      settledToggle: showSettled ? 'Hide settled records' : `Show ${p.settled.length} settled`,
      onToggleSettled: () => update(prev => ({ showSettledRecs: { ...prev.showSettledRecs, [p.key]: !showSettled } })),
      settledRecords: showSettled ? p.settled.map(x => recVM(x, p, '')) : [],
      timeline,
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────

  const openPeople = withRecs.filter(p => p.openCount > 0)
  const settledPeople = withRecs.filter(p => p.openCount === 0)
  const owed = openPeople.reduce((a, p) => a + p.lent, 0)
  const owe = openPeople.reduce((a, p) => a + p.owe, 0)
  const net = owed - owe
  const nOweYou = openPeople.filter(p => p.lent > 0).length
  const nPending = openPeople.reduce((a, p) => a + p.open.filter(x => x.type === 'borrowed').length, 0)
  const overdueBorrowed = openPeople.flatMap(p => p.open.filter(x => x.overdue && x.type === 'borrowed').map(x => ({ p, x })))
  const sumTone: Tone = net > 0 ? 'good' : net < 0 ? 'bad' : 'neutral'

  // ── Needs attention: overdue money you owe first, then overdue owed to you, then due this week ─

  const att: { p: Person; x: DRec }[] = []
  for (const p of openPeople) for (const x of p.open) if (x.overdue || x.soon) att.push({ p, x })
  const rank = (a: { x: DRec }) => a.x.overdue ? (a.x.type === 'borrowed' ? 0 : 1) : 2
  att.sort((a, b) => rank(a) - rank(b) || (a.x.dueDays ?? 0) - (b.x.dueDays ?? 0))
  const nOver = att.filter(a => a.x.overdue).length, nSoon = att.length - nOver
  const attentionSub = [nOver ? `${nOver} overdue` : '', nSoon ? `${nSoon} due this week` : ''].filter(Boolean).join(' · ')

  // ── People list ─────────────────────────────────────────────────────────────

  const q = s.q.trim().toLowerCase()
  const descMatch = (p: Person) => q ? p.records.find(r => (r.desc || '').toLowerCase().includes(q))?.desc ?? '' : ''
  const match = (p: Person) => !q || p.name.toLowerCase().includes(q) || !!descMatch(p)
  const byFilter = (p: Person) => s.filter === 'lent' ? p.lent > 0 : s.filter === 'borrowed' ? p.owe > 0 : true
  const sorters: Record<UI['sort'], (a: Person, b: Person) => number> = {
    balance: (a, b) => Math.abs(b.net) - Math.abs(a.net) || a.name.localeCompare(b.name),
    oldest: (a, b) => (a.oldest || '9').localeCompare(b.oldest || '9'),
    due: (a, b) => (a.nearestDue || '9999').localeCompare(b.nearestDue || '9999'),
  }
  const mainList = openPeople.filter(byFilter).filter(match).sort(sorters[s.sort])
  const settledList = (s.filter === 'all' ? settledPeople : []).filter(match).sort((a, b) => b.last.localeCompare(a.last))
  const showSettledGroup = q ? true : s.showSettledPeople
  const selKey = s.selected && withRecs.some(p => p.key === s.selected) ? s.selected : ((mainList[0] || settledList[0] || openPeople[0])?.key ?? '')
  const onlyOne = withRecs.length === 1 && isPhone && !q
  const allSquare = isReady && s.filter === 'all' && !q && openPeople.length === 0
  const listEmpty = isReady && !onlyOne && !allSquare && mainList.length === 0 && !(q && settledList.length)
  let empty: { tone: Tone; title: string; body: string; action: string; onAction: () => void } = { tone: 'neutral', title: '', body: '', action: '', onAction: () => {} }
  if (q) empty = { tone: 'neutral', title: `No one matches “${s.q.trim()}”`, body: 'Try a name, or a word from what it was for — like “rent” or “Goa”.', action: 'Clear search', onAction: patch({ q: '' }) }
  else if (s.filter === 'lent') empty = { tone: 'good', title: 'Nobody owes you right now', body: 'Money you lend — and bill splits — show up here until they\'re paid back.', action: 'Show everyone', onAction: patch({ filter: 'all' }) }
  else if (s.filter === 'borrowed') empty = { tone: 'good', title: 'You don\'t owe anyone', body: 'Nice. Anything you borrow shows up here until you\'ve paid it back.', action: 'Show everyone', onAction: patch({ filter: 'all' }) }
  const cnt = { all: openPeople.length, lent: openPeople.filter(p => p.lent > 0).length, borrowed: openPeople.filter(p => p.owe > 0).length }
  const sortOpts: SortOpt[] = SORTS.map(([k, label, hint]) => ({
    key: k, label, hint, active: s.sort === k,
    on: () => update(prev => ({ sort: k, sortOpen: false, sheet: prev.sheet?.kind === 'sort' ? null : prev.sheet })),
  }))
  const sortCur = SORTS.find(x => x[0] === s.sort) ?? SORTS[0]
  const nRes = mainList.length + settledList.length
  const detailP = isDesktop || onlyOne ? withRecs.find(p => p.key === selKey) : undefined
  const sheetP = s.sheet?.kind === 'person' ? withRecs.find(p => p.key === s.sheet!.key) : undefined

  // ── Sheets ──────────────────────────────────────────────────────────────────

  const sk = s.sheet?.kind
  let sheetTitle = '', sheetSub: string | undefined
  let sheetBody: ReactNode = null

  if (sk === 'person' && sheetP) {
    sheetTitle = sheetP.name
    sheetBody = <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '12px 16px calc(24px + var(--sab))' }}><PersonPanel p={personVM(sheetP, true)} /></div>
  }

  if (sk === 'form' && s.form) {
    const F = s.form
    const e = formErrors(F)
    const show = (k: keyof typeof e) => (e[k] && (F.showErrors || k === 'repaid')) ? e[k]! : ''
    const amt = parseFloat(F.amount) || 0, rep = parseFloat(F.repaid) || 0
    const autoEmi = F.isLoan ? emiOf(amt, parseFloat(F.rate) || 0, parseInt(F.tenure, 10) || 0) : 0
    const diff = F.mode === 'edit' ? rep - F.origRepaid : 0
    const loanLender = F.isLoan && F.type === 'borrowed'
    const setF = (p: Partial<Form>) => update(prev => ({ form: prev.form && { ...prev.form, ...p } }))
    const upd = (k: keyof Form) => (v: string) => setF({ [k]: v })
    const pq = nkey(F.person)
    const sugg = people.filter(p => p.isContact || p.records.length).filter(p => pq ? p.key.includes(pq) && p.key !== pq : true).slice(0, pq ? 4 : 5)
      .map(p => ({ name: p.name, initial: initialOf(p.name), ...av(p.name), on: () => setF({ person: p.name }) }))
    const shownErrs = (['amount', 'person', 'repaid', 'due', 'loan'] as const).filter(k => show(k))
    sheetTitle = F.mode === 'edit' ? 'Edit record' : 'Add record'
    sheetSub = F.mode === 'edit' ? `${F.person} · ${F.desc || (F.type === 'lent' ? 'Lent' : 'Borrowed')}` : 'Money you lent or borrowed'
    const f: FormVM = {
      summary: F.showErrors && shownErrs.length ? `Fix ${shownErrs.length} ${shownErrs.length === 1 ? 'thing' : 'things'} to save` : '',
      isLent: F.type === 'lent', setLent: () => setF({ type: 'lent' }), setBorrowed: () => setF({ type: 'borrowed' }),
      amount: F.amount, onAmount: upd('amount'), amountWords: words(amt), amountErr: show('amount'),
      person: F.person, onPerson: upd('person'), personLabel: loanLender ? 'Bank / Lender' : 'Person',
      personPh: loanLender ? 'e.g. Uncle Suresh, KreditBee' : 'Who is this with?', personErr: show('person'), sugg,
      desc: F.desc, onDesc: upd('desc'), date: F.date, onDate: upd('date'), due: F.due, onDue: upd('due'),
      dueLabel: F.isLoan ? 'Last EMI date' : 'Due date · optional', dueErr: show('due'),
      repaid: F.repaid, onRepaid: upd('repaid'), repaidErr: show('repaid'),
      status: amt > 0 && rep >= amt ? 'repaid' : rep > 0 ? 'partial' : 'pending',
      setPending: () => setF({ repaid: '' }), setRepaid: () => update(prev => ({ form: prev.form && { ...prev.form, repaid: prev.form.amount } })),
      logText: diff > 0 && !e.repaid ? `Saving logs a ${inr(diff)} “${F.type === 'lent' ? 'Repayment received' : 'Repayment made'}” transaction dated today — the extra you've just added.` : '',
      isLoan: F.isLoan, toggleLoan: () => setF({ isLoan: !F.isLoan }),
      rate: F.rate, onRate: upd('rate'), tenure: F.tenure, onTenure: upd('tenure'),
      emi: F.emiEdited ? F.emi : (autoEmi ? String(autoEmi) : ''), onEmi: v => setF({ emi: v, emiEdited: true }),
      emiEdited: F.emiEdited, resetEmi: () => setF({ emiEdited: false }), resetLabel: autoEmi ? `Reset to ${inr(autoEmi)}` : 'Reset',
      emiHint: F.emiEdited ? 'EMI edited by you.' : 'EMI is worked out from amount, rate and tenure — you can edit it.',
      rateErr: !!show('loan') && F.rate === '', tenureErr: !!show('loan') && !(parseInt(F.tenure, 10) > 0), loanErr: show('loan'),
      save: () => { void saveForm() }, saveLabel: busy ? 'Saving…' : F.mode === 'edit' ? 'Save changes' : 'Save record', busy,
    }
    sheetBody = <FormBody f={f} onCancel={closeSheet} />
  }

  if (sk === 'repay' && s.repay) {
    const RP = s.repay
    const r = recs.find(x => x.id === RP.id)
    if (r) {
      const x = derive(r), lent = x.type === 'lent', amt = parseFloat(RP.amount) || 0
      const p = withRecs.find(pp => pp.key === nkey(r.person))
      const setR = (v: Partial<Repay>) => update(prev => ({ repay: prev.repay && { ...prev.repay, ...v } }))
      const quick: { label: string; v: number }[] = []
      if (x.loan && x.loan.emi) quick.push({ label: `1 EMI · ${m(x.loan.emi)}`, v: Math.min(x.loan.emi, x.out) })
      quick.push({ label: `Full · ${m(x.out)}`, v: x.out })
      if (!x.loan && x.out >= 200) quick.push({ label: `Half · ${m(Math.round(x.out / 2))}`, v: Math.round(x.out / 2) })
      const err = !(amt > 0) ? 'Enter how much was repaid' : amt > x.out ? `That's more than the ${m(x.out)} left` : ''
      sheetTitle = 'Record a repayment'
      sheetSub = lent ? `${p ? p.name : r.person} paid you back` : `You paid ${p ? p.name : r.person} back`
      const rp: RepayVM = {
        choices: p && p.open.length > 1 ? p.open.map(o => ({
          id: o.id, title: o.desc || (o.type === 'lent' ? 'Lent' : 'Borrowed'), out: m(o.out), active: o.id === r.id,
          on: () => setR({ id: o.id, amount: String(o.loan && o.loan.emi ? Math.min(o.out, o.loan.emi) : o.out) }),
        })) : [],
        tone: lent ? 'good' : 'bad', recTitle: x.desc || (lent ? 'Lent' : 'Borrowed'), out: m(x.out),
        amount: RP.amount, onAmount: v => setR({ amount: v }),
        quick: quick.map(qk => ({ label: qk.label, active: amt === qk.v, on: () => setR({ amount: String(qk.v) }) })),
        err: !!err, previewTone: err ? 'bad' : amt === x.out ? 'good' : 'info',
        preview: err || (amt === x.out ? 'This settles the record in full' : `${m(x.out - amt)} will still be left after this`),
        date: RP.date, onDate: v => setR({ date: v }), note: RP.note, onNote: v => setR({ note: v }),
        notePh: lent ? 'Repayment received' : 'Repayment made',
        logNote: `Logs a “${lent ? 'Repayment received' : 'Repayment made'}” transaction in Transactions.`,
        save: () => { void saveRepay() }, saveLabel: amt > 0 && !err ? 'Record ' + m(amt) : 'Record repayment', busy,
      }
      sheetBody = <RepayBody rp={rp} onCancel={closeSheet} />
    }
  }

  if ((sk === 'mark' || sk === 'delete') && s.sheet?.id) {
    const r = recs.find(x => x.id === s.sheet!.id)
    if (r) {
      const x = derive(r), lent = x.type === 'lent', pn = nameOf(nkey(r.person)), t = x.desc || (lent ? 'Lent' : 'Borrowed')
      const base = {
        recTone: (!x.isOpen ? 'neutral' : lent ? 'good' : 'bad') as Tone, recTitle: t,
        recSub: `${lent ? 'Lent to' : 'Borrowed from'} ${pn} · ${fd(x.date)}`,
        recAmount: x.isOpen ? m(x.out) + (x.partial ? ' left' : '') : m(x.amount),
      }
      const cf: ConfirmVM = sk === 'mark'
        ? { ...base, isMark: true, tone: 'good', title: 'Mark as fully repaid?',
            body: x.out > 0
              ? `This closes the record and logs a ${m(x.out)} “${lent ? 'Repayment received' : 'Repayment made'}” transaction dated today, for the amount still outstanding.`
              : 'Nothing is outstanding, so no transaction will be logged — the record just closes.',
            onEdit: () => update(prev => ({ ...formPatch('edit', x.id, ''), sheet: { kind: 'form', back: prev.sheet?.back ?? null } })),
            onConfirm: () => { void markRepaid(x.id) } }
        : { ...base, isMark: false, tone: 'bad', title: 'Delete this record?',
            body: `It's removed from ${pn}'s history and from your totals. This can't be undone.`,
            onEdit: () => {}, onConfirm: () => { void deleteRecord(x.id) } }
      sheetTitle = cf.title
      sheetBody = <ConfirmBody cf={cf} onCancel={closeSheet} />
    }
  }

  if (sk === 'sort') {
    sheetTitle = 'Sort people'; sheetSub = 'People with open money always come first'
    sheetBody = <SortBody opts={sortOpts} />
  }

  if (sk === 'people' && s.pm) {
    const PMs = s.pm
    const pq = nkey(PMs.q)
    const setP = (v: Partial<PM>) => update(prev => ({ pm: prev.pm && { ...prev.pm, ...v } }))
    const updP = (k: keyof PM) => (v: string) => setP({ [k]: v, addErr: '' })
    const run = async (fn: () => Promise<void>, done: string, fail: string) => {
      setBusy(true)
      try { await fn(); showToast(done) } catch { toast.error(fail); await refresh() } finally { setBusy(false) }
    }
    const recordsOf = (key: string) => useAppStore.getState().borrowings.filter(b => nkey(b.person) === key)
    const list: PeopleRowVM[] = people
      .filter(p => !pq || p.key.includes(pq) || (p.phone || '').replace(/\D/g, '').includes(pq.replace(/\D/g, '') || '§'))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(p => {
        const n = p.records.length
        const mode = PMs.deleting === p.key ? 'del' : PMs.editing === p.key ? 'edit' : 'view'
        return {
          key: p.key, name: p.name, initial: initialOf(p.name), ...av(p.name),
          pill: n === 0 ? 'No records' : p.openCount === 0 ? 'Settled' : p.net === 0 ? 'Even' : (p.net > 0 ? '+' : '−') + m(Math.abs(p.net)),
          pillTone: n === 0 || p.openCount === 0 || p.net === 0 ? 'neutral' : p.net > 0 ? 'good' : 'bad',
          sub: p.isContact ? (p.phone || 'no phone') : 'from borrowings',
          mode, canEdit: p.isContact,
          onEdit: () => setP({ editing: p.key, editName: p.name, editPhone: p.phone, deleting: null }),
          onSave: () => setP({ adding: true, newName: p.name, newPhone: '' }),
          onDelete: () => setP({ deleting: p.key, editing: null }),
          renameNote: n ? `Renaming updates all ${n} ${n === 1 ? 'record' : 'records'}.` : '',
          delTitle: `Delete ${p.name}?`,
          delBody: p.isContact && n
            ? `${firstName(p.name)} has ${n} ${n === 1 ? 'record' : 'records'}. Keep them and remove just the contact, or delete everything.`
            : p.isContact ? 'This removes the saved contact. There are no records with them.'
            : `${firstName(p.name)} isn't a saved contact — they only appear in ${n} ${n === 1 ? 'record' : 'records'}. Deleting removes ${n === 1 ? 'it' : 'all of them'}.`,
          optContactOnly: p.isContact, contactOnlyLabel: n ? 'Contact only' : 'Delete contact',
          optAll: n > 0, allLabel: p.isContact ? 'Contact + all records' : `Delete all ${n} records`,
          delContactOnly: () => run(async () => {
            if (p.contact) await deleteContact(p.contact.id)
            setP({ deleting: null })
          }, 'Contact deleted', 'Couldn’t delete the contact'),
          delAll: () => run(async () => {
            if (p.contact) await deleteContact(p.contact.id)
            await Promise.all(recordsOf(p.key).map(b => deleteBorrowing(b.id)))
            setP({ deleting: null })
          }, p.isContact ? 'Contact and records deleted' : 'Records deleted', 'Couldn’t delete everything'),
        }
      })
    sheetTitle = 'People'
    sheetSub = `${people.length} ${people.length === 1 ? 'person' : 'people'} · saved contacts and names from records`
    const pm: PeopleVM = {
      q: PMs.q, onQ: updP('q'),
      startAdd: () => update(prev => ({ pm: prev.pm && { ...prev.pm, adding: true, newName: prev.pm.q, newPhone: '', addErr: '' } })),
      adding: PMs.adding, newName: PMs.newName, newPhone: PMs.newPhone, onNewName: updP('newName'), onNewPhone: updP('newPhone'),
      addErr: PMs.addErr, cancelAdd: () => setP({ adding: false, addErr: '' }),
      saveAdd: () => {
        const nm = PMs.newName.trim(), phone = PMs.newPhone.trim()
        if (!nm) return setP({ addErr: 'Add a name' })
        if (contacts.some(c => nkey(c.name) === nkey(nm))) return setP({ addErr: `${nm} is already saved` })
        if (!user) return
        void run(async () => {
          await addContact(user.uid, { name: nm, ...(phone ? { phone } : {}) })
          setP({ adding: false, newName: '', newPhone: '' })
        }, `${nm} saved`, 'Couldn’t save the contact')
      },
      editName: PMs.editName, editPhone: PMs.editPhone, onEditName: updP('editName'), onEditPhone: updP('editPhone'),
      cancelEdit: () => setP({ editing: null }),
      saveEdit: () => {
        const key = PMs.editing, nm = PMs.editName.trim()
        const c = contacts.find(c => nkey(c.name) === key)
        if (!key || !nm || !c) return
        void run(async () => {
          await updateContact(c.id, { name: nm, phone: PMs.editPhone.trim() })
          // Renaming carries through to every record with them
          await Promise.all(recordsOf(key).filter(b => b.person !== nm).map(b => updateBorrowing(b.id, { person: nm })))
          update(prev => ({ selected: prev.selected === key ? nkey(nm) : prev.selected, pm: prev.pm && { ...prev.pm, editing: null } }))
        }, 'Contact updated', 'Couldn’t update the contact')
      },
      cancelDel: () => setP({ deleting: null }),
      list, emptyText: pq ? `No one matches “${PMs.q}”.` : 'No people yet. Add someone to get started.', busy,
    }
    sheetBody = <PeopleBody pm={pm} />
  }

  const sheetOpen = !!sheetBody
  // A sheet whose person or record has gone (deleted here or elsewhere) closes instead of lingering
  useEffect(() => {
    if (s.sheet && !sheetOpen) update({ sheet: null, form: null, repay: null, pm: null })
  })

  // ── Render ──────────────────────────────────────────────────────────────────

  const openAdd = () => openSheet(formPatch('add', null, ''))
  const openPeopleSheet = () => openSheet(pmPatch(null, ''))
  const searchInput = (phone: boolean) => (
    <input value={s.q} onChange={e => update({ q: e.target.value })} placeholder="Search people or notes" aria-label="Search people or notes"
      style={{ border: 0, outline: 0, background: 'transparent', flex: 1, minWidth: 0, fontSize: phone ? 15 : 13.5 }} />
  )
  const people40 = (size: number) => <Ico d={P.people} size={size} circles={[[9, 8, 4]]} />
  // Header controls as on Goals: pill buttons on the paper, lifted by the card shadow
  const headBtn: CSSProperties = { flex: 'none', height: 44, border: 0, borderRadius: 999, background: 'var(--surface)', boxShadow: 'var(--shadow)', cursor: 'pointer', color: 'var(--ink)' }
  // The app's privacy switch: dark when amounts are hidden
  const privacyColors: CSSProperties = privacy ? { background: 'var(--ink)', color: 'var(--paper)' } : { color: 'var(--ink-2)' }
  const eye = privacy ? <Ico d={P.eyeOff} size={20} /> : <Ico d={P.eye} size={20} circles={[[12, 12, 3]]} />

  return (
    <div className="bw bw-page" data-device={device}>
      <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--paper)', padding: isPhone ? 'max(20px, calc(env(safe-area-inset-top, 0px) + 8px)) 16px 12px' : '28px 32px 16px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', alignItems: 'center', gap: isPhone ? 8 : 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: isPhone ? 26 : 30, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.15 }}>Borrowings</h1>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Who owes whom — settled cleanly.</div>
          </div>
          {isDesktop && (
            <label className="bw-field" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, width: 280, padding: '0 8px 0 16px', borderRadius: 999, background: 'var(--surface)', boxShadow: 'var(--shadow)', boxSizing: 'border-box', color: 'var(--ink-3)' }}>
              <Ico d={P.search} size={17} join={false} circles={[[11, 11, 7]]} style={{ flex: 'none' }} />
              {searchInput(false)}
              {q && <button onClick={patch({ q: '' })} aria-label="Clear search" style={{ width: 28, height: 28, border: 0, borderRadius: 999, background: 'var(--sunk)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-2)' }}><Ico d={P.close} size={12} sw={2.5} join={false} /></button>}
            </label>
          )}
          {isPhone ? (
            <button onClick={togglePrivacy} aria-label={privacy ? 'Show amounts' : 'Hide amounts'} aria-pressed={privacy} style={{ ...headBtn, width: 44, display: 'grid', placeItems: 'center', ...privacyColors }}>{eye}</button>
          ) : (
            <button onClick={togglePrivacy} aria-pressed={privacy} style={{ ...headBtn, padding: '0 16px 0 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, ...privacyColors }}>
              {eye}{privacy ? 'Amounts hidden' : 'Hide amounts'}
            </button>
          )}
          <button onClick={openPeopleSheet} style={{ ...headBtn, padding: isPhone ? '0 14px 0 12px' : '0 18px 0 14px', display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: isPhone ? 14 : 13.5 }}>{people40(18)}People</button>
          {isDesktop && (
            <button onClick={openAdd} style={{ ...headBtn, padding: '0 18px 0 14px', background: 'var(--brand)', color: 'var(--on-brand)', boxShadow: '0 6px 16px -6px var(--brand)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13.5 }}>
              <Ico d={P.plus} size={18} sw={2.4} join={false} />Add record
            </button>
          )}
        </div>
      </header>

      {isLoading && (
        <div aria-busy="true" aria-label="Loading borrowings" style={{ padding: '16px var(--pad)', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1160, margin: '0 auto', boxSizing: 'border-box' }}>
          <div style={skel(isPhone ? 300 : 170, 0, { borderRadius: 24 })} />
          <div style={{ display: 'flex', gap: 10, overflow: 'hidden' }}>
            {[0, 0.15, 0.3].map(d => <div key={d} style={skel(150, d, { flex: 'var(--att-flex)', borderRadius: 20 })} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--ld-cols)', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ height: 'var(--hit)', borderRadius: 999, background: 'var(--skel)' }} />
              {[0, 0.1, 0.2, 0.3, 0.4].map(d => <div key={d} style={skel(70, d, { borderRadius: 18 })} />)}
            </div>
            {isDesktop && (
              <div style={{ height: 520, borderRadius: 24, background: 'var(--surface)', boxShadow: 'var(--shadow)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--skel)' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ height: 16, width: '40%', borderRadius: 6, background: 'var(--skel)' }} />
                    <div style={{ height: 12, width: '24%', borderRadius: 6, background: 'var(--skel)' }} />
                  </div>
                </div>
                <div style={skel(120, 0, { borderRadius: 20 })} />
                <div style={{ height: 66, borderRadius: 16, background: 'var(--skel)' }} />
                <div style={skel(110, 0.2, { borderRadius: 16 })} />
              </div>
            )}
          </div>
        </div>
      )}

      {isFirstRun && (
        <div style={{ padding: '24px var(--pad) var(--list-pb)', display: 'flex', justifyContent: 'center' }}>
          <div style={{ maxWidth: 560, width: '100%', background: 'var(--surface)', borderRadius: 24, padding: '32px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, boxSizing: 'border-box', boxShadow: 'var(--shadow)' }}>
            <div style={{ position: 'relative', width: 132, height: 76, marginBottom: 6 }}>
              <div data-tone="good" style={{ position: 'absolute', left: 0, top: 0, width: 76, height: 76, borderRadius: '50%', background: 'var(--ts)', color: 'var(--ti)', display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 600 }}>↓</div>
              <div data-tone="bad" style={{ position: 'absolute', right: 0, top: 0, width: 76, height: 76, borderRadius: '50%', background: 'var(--ts)', color: 'var(--ti)', display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 600, boxShadow: '0 0 0 4px var(--surface)' }}>↑</div>
            </div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', ...balance }}>Keep track of who owes whom</h2>
            <p style={{ margin: 0, fontSize: 14.5, color: 'var(--ink-2)', maxWidth: 420, ...pretty }}>Log money you lend to friends and family, or borrow from them. We total it up per person, flag anything overdue, and help you send a friendly WhatsApp reminder.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6, width: '100%' }}>
              <button onClick={openAdd} style={{ height: 48, padding: '0 22px 0 18px', borderRadius: 999, border: 0, background: 'var(--brand)', color: 'var(--on-brand)', fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 6px 16px -6px var(--brand)' }}><Ico d={P.plus} size={18} sw={2.4} join={false} />Add record</button>
              <button onClick={openPeopleSheet} style={{ height: 48, padding: '0 20px', borderRadius: 999, border: 0, background: 'var(--sunk)', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>Add people</button>
            </div>
            <div data-tone="info" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', background: 'var(--ts)', color: 'var(--ti)', borderRadius: 16, padding: '12px 14px', fontSize: 13, marginTop: 8, lineHeight: 1.45 }}>
              <Ico d={P.info} size={18} join={false} circles={[[12, 12, 9]]} style={{ flex: 'none', marginTop: 1 }} />
              <span>Splitting a bill, or logging a “Loan given” transfer in Add transaction, lands here automatically.</span>
            </div>
          </div>
        </div>
      )}

      {isReady && (
        <div style={{ padding: '16px var(--pad) var(--list-pb)', display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1160, margin: '0 auto', boxSizing: 'border-box', width: '100%' }}>
          <section aria-label="Where you stand" className="bw-hero" style={{ borderRadius: 24, padding: isPhone ? 20 : 24, color: '#fff', background: 'var(--hero)', boxShadow: 'var(--hero-shadow)', display: 'grid', gridTemplateColumns: 'var(--sum-cols)', gap: 12 }}>
            <div style={{ gridColumn: 'var(--net-span)', display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center', minWidth: 0, padding: isPhone ? '0 0 4px' : '0 12px 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14.5, color: 'rgba(255,255,255,.8)', fontWeight: 600 }}>{net > 0 ? 'Overall, people owe you' : net < 0 ? 'Overall, you owe' : 'Overall, you\'re'}</span>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 999, background: 'rgba(255,255,255,.18)', color: net < 0 ? 'var(--on-hero-bad)' : '#fff', whiteSpace: 'nowrap' }}>{net > 0 ? 'You\'re ahead' : net < 0 ? 'You\'re behind' : 'Settled'}</span>
              </div>
              <div className="bw-num" style={{ fontSize: isPhone ? 38 : 44, fontWeight: 600, lineHeight: 1.1, overflowWrap: 'anywhere', marginTop: 2 }}>{net === 0 ? 'Settled' : m(Math.abs(net))}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.72)' }}>{net === 0 ? 'Nothing open either way' : 'once everyone settles up'}</div>
            </div>
            {([
              [P.owed, 'Owed to you', owed, nOweYou ? `${nOweYou} ${nOweYou === 1 ? 'person owes' : 'people owe'} you` : 'Nobody owes you', '#fff'],
              [P.owe, 'You owe', owe, nPending ? `${nPending} pending ${nPending === 1 ? 'settlement' : 'settlements'}` : 'You don\'t owe anyone', 'var(--on-hero-bad)'],
            ] as const).map(([icon, label, amt, sub, tint]) => (
              <div key={label} style={{ background: 'rgba(255,255,255,.12)', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.85)' }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,.18)', color: tint, display: 'grid', placeItems: 'center', flex: 'none' }}><Ico d={icon} size={14} sw={2.4} /></span>{label}
                </div>
                <div className="bw-num" style={{ fontSize: isPhone ? 20 : 22, fontWeight: 600, overflowWrap: 'anywhere', lineHeight: 1.2, marginTop: 4 }}>{amt ? m(amt) : '—'}</div>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.68)' }}>{sub}</div>
              </div>
            ))}
            {overdueBorrowed.length > 0 && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 14, background: 'rgba(255,255,255,.12)', fontSize: 13, color: 'rgba(255,255,255,.9)', lineHeight: 1.4 }}>
                <Ico d={P.warn} size={16} sw={2.2} stroke="var(--on-hero-bad)" style={{ flex: 'none', marginTop: 1 }} />
                <span>Your repayment to {overdueBorrowed[0].p.name} is overdue — it&apos;s lowering your health score until it&apos;s paid.</span>
              </div>
            )}
          </section>

          {att.length > 0 && (
            <section aria-label="Needs attention" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>Needs attention</h2>
                <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{attentionSub}</span>
              </div>
              <div className="bw-noscroll" style={{ display: 'flex', gap: 12, overflowX: 'auto', flexWrap: 'var(--att-wrap)' as CSSProperties['flexWrap'], margin: '0 calc(var(--pad) * -1) -22px', padding: '2px var(--pad) 22px' }}>
                {att.map(({ p, x }) => {
                  const lent = x.type === 'lent'
                  const a = av(p.name)
                  return (
                    <div key={x.id} data-tone={x.overdue ? 'bad' : 'warn'} role="button" tabIndex={0} onClick={() => openPerson(p.key)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPerson(p.key) } }} className="bw-hov"
                      style={{ flex: 'var(--att-flex)', minWidth: 0, background: 'var(--surface)', boxShadow: 'var(--shadow)', borderRadius: 20, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer', boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--ts)', color: 'var(--ti)', fontSize: 11.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                          <Ico d={P.clock} size={12} sw={2.6} join={false} circles={[[12, 12, 9]]} />{dueText(x)}
                        </span>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, background: a.avBg, color: a.avInk, flex: 'none' }}>{initialOf(p.name)}</div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lent ? `${firstName(p.name)} owes you` : `You owe ${p.name}`}</div>
                        <div className="bw-num" style={{ fontSize: 20, fontWeight: 600, marginTop: 2 }}>{x.loan && x.loan.emi ? m(Math.min(x.loan.emi, x.out)) : m(x.out)}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.loan ? `${x.desc} · EMI` : x.desc}</div>
                      </div>
                      {x.overdue && !lent && <div style={{ fontSize: 12, color: 'var(--ti)', fontWeight: 600 }}>Lowers your health score</div>}
                      <button onClick={e => { e.stopPropagation(); if (lent) remind(p, [x]); else openSheet(repayPatch(x.id, null)) }}
                        style={{ marginTop: 'auto', height: 'var(--hit)', borderRadius: 999, border: 0, background: 'var(--sunk)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        {lent ? 'Remind on WhatsApp' : 'Record repayment'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'var(--ld-cols)', gap: 20, alignItems: 'start' }}>
            <section aria-label="People" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
              {isPhone && (
                <label className="bw-field" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 46, padding: '0 6px 0 16px', borderRadius: 999, background: 'var(--surface)', boxShadow: 'var(--shadow)', boxSizing: 'border-box', color: 'var(--ink-3)' }}>
                  <Ico d={P.search} size={18} join={false} circles={[[11, 11, 7]]} style={{ flex: 'none' }} />
                  {searchInput(true)}
                  {q && <button onClick={patch({ q: '' })} aria-label="Clear search" style={{ width: 34, height: 34, border: 0, borderRadius: 999, background: 'var(--sunk)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-2)' }}><Ico d={P.close} size={14} sw={2.5} join={false} /></button>}
                </label>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div role="tablist" aria-label="Filter" style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', background: 'var(--sunk)', borderRadius: 999, padding: 4, gap: 4, minWidth: 0 }}>
                  {([['all', 'All'], ['lent', 'Lent'], ['borrowed', 'Borrowed']] as const).map(([k, label]) => (
                    <button key={k} role="tab" onClick={patch({ filter: k })} data-seg={String(s.filter === k)} aria-selected={s.filter === k}
                      style={{ height: 'calc(var(--hit) - 6px)', border: 0, borderRadius: 999, background: 'transparent', fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', padding: '0 4px', minWidth: 0 }}>
                      {label}<span className="bw-num" style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>{cnt[k]}</span>
                    </button>
                  ))}
                </div>
                <div ref={sortRef} style={{ position: 'relative', flex: 'none' }}>
                  <button onClick={() => isPhone ? openSheet({ sheet: { kind: 'sort' } }) : update(prev => ({ sortOpen: !prev.sortOpen }))} aria-label={'Sort: ' + sortCur[1]}
                    style={{ height: 'var(--hit)', padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--surface)', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-2)' }}>
                    <Ico d={P.sort} size={16} sw={2.2} join={false} />{isPhone ? 'Sort' : sortCur[1]}
                  </button>
                  {isDesktop && s.sortOpen && <SortPopover opts={sortOpts} />}
                </div>
              </div>
              {q && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-3)', padding: '0 2px' }}>
                  <span>{`${nRes} ${nRes === 1 ? 'result' : 'results'} for “${s.q.trim()}”`}</span>
                  <button onClick={patch({ q: '' })} style={{ border: 0, background: 'transparent', color: 'var(--brand-ink)', fontWeight: 600, fontSize: 13, cursor: 'pointer', height: 'var(--hit)', padding: '0 4px' }}>Clear</button>
                </div>
              )}

              {onlyOne && detailP && (
                <div style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)', borderRadius: 24, padding: 16 }}>
                  <PersonPanel p={personVM(detailP, false)} />
                </div>
              )}

              {!onlyOne && mainList.map(personCard)}
              {!onlyOne && settledList.length > 0 && showSettledGroup && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-3)', padding: '8px 2px 0' }}>
                    <span>{q ? 'Settled' : `Settled · ${settledList.length}`}</span><span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                  </div>
                  {settledList.map(personCard)}
                </>
              )}

              {allSquare && (
                <div data-tone="good" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)', borderRadius: 24, padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--ts)', color: 'var(--ti)', display: 'grid', placeItems: 'center', marginBottom: 4 }}><Ico d={P.check} size={26} sw={2.4} /></div>
                  <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em' }}>Everyone&apos;s square.</div>
                  <div style={{ fontSize: 13.5, color: 'var(--ink-2)', maxWidth: 320, ...pretty }}>Nobody owes you, and you don&apos;t owe anyone. Past records are tucked away below whenever you need them.</div>
                </div>
              )}

              {listEmpty && (
                <div data-tone={empty.tone} style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)', borderRadius: 24, padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--ts)', color: 'var(--ti)', display: 'grid', placeItems: 'center', marginBottom: 4 }}><Ico d={P.search} size={22} sw={2.2} join={false} circles={[[11, 11, 7]]} /></div>
                  <div style={{ fontSize: 17, fontWeight: 700, overflowWrap: 'anywhere' }}>{empty.title}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--ink-2)', maxWidth: 320, ...pretty }}>{empty.body}</div>
                  <button onClick={empty.onAction} style={{ marginTop: 6, height: 'var(--hit)', padding: '0 18px', borderRadius: 999, border: 0, background: 'var(--sunk)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>{empty.action}</button>
                </div>
              )}

              {!q && s.filter === 'all' && settledList.length > 0 && !onlyOne && (
                <button onClick={() => update(prev => ({ showSettledPeople: !prev.showSettledPeople }))} style={{ height: 'var(--hit)', borderRadius: 999, border: '1px dashed var(--line-2)', background: 'transparent', color: 'var(--ink-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 2 }}>
                  {s.showSettledPeople ? 'Hide settled people' : `Show ${settledList.length} settled ${settledList.length === 1 ? 'person' : 'people'}`}
                </button>
              )}
            </section>

            {isDesktop && detailP && (
              <section aria-label="Person details" style={{ position: 'sticky', top: 112, background: 'var(--surface)', borderRadius: 24, padding: 22, boxShadow: 'var(--shadow)', minWidth: 0 }}>
                <PersonPanel p={personVM(detailP, false)} />
              </section>
            )}
          </div>
        </div>
      )}

      {isPhone && !isLoading && !sheetOpen && (
        <button onClick={openAdd} className="bw-fab" style={{ position: 'fixed', zIndex: 40, height: 54, padding: '0 22px 0 18px', borderRadius: 999, border: 0, background: 'var(--brand)', color: 'var(--on-brand)', fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 10px 24px -8px var(--brand)' }}>
          <Ico d={P.plus} size={20} sw={2.4} join={false} />Add record
        </button>
      )}

      {mounted && createPortal(
        <div className="bw" data-device={device}>
          {sheetOpen && (
            <SheetFrame title={sheetTitle} sub={sheetSub} width={isPhone ? '100%' : SHEET_W[sk!]} onClose={closeSheet}>{sheetBody}</SheetFrame>
          )}
          {toastText && (
            <div role="status" style={{ position: 'fixed', left: '50%', bottom: 'var(--toast-b)', transform: 'translateX(-50%)', zIndex: 260, background: 'var(--ink)', color: 'var(--paper)', padding: '12px 18px', borderRadius: 999, fontSize: 13.5, fontWeight: 600, boxShadow: '0 12px 30px -10px rgba(0,0,0,.4)', display: 'flex', gap: 8, alignItems: 'center', whiteSpace: 'nowrap', animation: 'bw-toast .2s ease-out' }}>
              <Ico d={P.check} size={16} sw={2.6} stroke="var(--brand)" />{toastText}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )

  function personCard(p: Person) {
    const flagX = p.overdueX || p.soonX
    const nm = descMatch(p)
    const a = av(p.name)
    const netTone: Tone = p.openCount === 0 || p.net === 0 ? 'neutral' : p.net > 0 ? 'good' : 'bad'
    const count = `${p.records.length} ${p.records.length === 1 ? 'record' : 'records'}`
    return (
      <div key={p.key} role="button" tabIndex={0} onClick={() => openPerson(p.key)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPerson(p.key) } }}
        data-sel={String(isDesktop && p.key === selKey)} data-dim={String(p.openCount === 0)}
        className="bw-hov" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)', borderRadius: 20, padding: '14px 12px 14px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', minHeight: 70, boxSizing: 'border-box' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 16, background: a.avBg, color: a.avInk }}>{initialOf(p.name)}</div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{p.name}</span>
            {flagX && <span data-tone={p.overdueX ? 'bad' : 'warn'} style={{ flex: 'none', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--ts)', color: 'var(--ti)', whiteSpace: 'nowrap' }}>{p.overdueX ? 'Overdue' : (p.soonX?.loan ? 'EMI soon' : 'Due soon')}</span>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', fontSize: 12.5, color: 'var(--ink-3)' }}>
            {p.lent > 0 && <span>Lent <span className="bw-num">{m(p.lent)}</span></span>}
            {p.owe > 0 && <span>Owe <span className="bw-num">{m(p.owe)}</span></span>}
            <span>{p.openCount === 0 ? `${count} · all settled` : count}</span>
          </div>
          {nm && <div style={{ fontSize: 12, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Matches “{nm}”</div>}
        </div>
        <div style={{ flex: 'none', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="bw-num" style={{ fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap', color: netTone === 'good' ? 'var(--good-ink)' : netTone === 'bad' ? 'var(--ink)' : 'var(--ink-2)' }}>
            {p.openCount === 0 ? 'Settled' : p.net === 0 ? 'Even' : (p.net > 0 ? '+' : '−') + m(Math.abs(p.net))}
          </span>
          {p.openCount > 0 && p.net !== 0 && <span style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{p.net > 0 ? 'owes you' : 'you owe'}</span>}
        </div>
        <Ico d={P.chevRight} size={16} stroke="var(--ink-3)" style={{ flex: 'none' }} />
      </div>
    )
  }
}
