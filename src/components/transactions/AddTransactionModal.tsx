'use client'

import { Fragment, useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns'
import { addTransaction, updateTransaction, deleteTransaction, updateProject, updateSavingsGoal, addBorrowing, updateBorrowing, setUserSettings, setEmergencyFund, getRefundsOf, getUserAssets, updateAsset } from '@/lib/firestore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import { TRANSFER_KINDS, SAVINGS_VEHICLES, EMERGENCY_FUND_VEHICLE, isSavingsTransfer, buildMonthlySummary, EXPENSE_CATEGORIES, INCOME_CATEGORIES, computeProjectPaid, formatCurrencyFull } from '@/lib/utils'
import { getCategoryDisplayName, ICON_PALETTE, buildCustomCategory } from '@/lib/categoryIcons'
import { applyLink, removeLink, findLinkedAsset, linkedContribution, linkSummary, defaultHoldingFor, vehicleKinds, isLinkable, type LinkMode, type LinkInput } from '@/lib/holdingLinks'
import { useAppStore } from '@/store/appStore'
import { getCycleMonthForDate } from '@/lib/cycle'
import { isSavingsPlan } from '@/lib/budgetPlan'
import AmountInput, { groupINR } from '@/components/ui/AmountInput'
import FuelFields, { addVehicle, fuelDraftFrom, fuelPayload, type FuelDraft } from '@/components/transactions/FuelFields'
import { isFuelExpense, solveFuel, type FuelCalc } from '@/lib/fuel'
import { DEFAULT_TOP_EXPENSE, EXPENSE_GROUPS, hueOf, vehicleSheetMeta } from '@/lib/txnSheetMeta'
import {
  MONO, Sym, tone, chip, seg, field, radio, avatar, labelStyle, subLabelStyle, closeBtn, darkBtn, textInput,
  SheetCard, Keypad, CatTile, CatGlyph, NeutralTile, NumInput, Switch, Kbd, categoryLook,
} from '@/components/transactions/TxnSheetParts'
import type { Asset, Transaction, TransactionType, TransferKind } from '@/types'
import toast from 'react-hot-toast'

const GOLD_VEHICLE = 'Gold'

type Tab = 'expense' | 'income' | 'transfer' | 'savings'
type SavingsKind = 'savings_contribution' | 'savings_withdrawal'
type CardKey = 'split' | 'tags' | 'settle' | 'project' | 'repeat' | 'refunds'

interface InitialPrefill {
  amount?: number
  category?: string
  date?: string
  notes?: string
  source?: 'scan' | 'share-target'
}

interface Props {
  open: boolean
  onClose: () => void
  editTx?: Transaction | null
  initialTab?: Tab
  initialSavingsVehicle?: string
  initialPrefill?: InitialPrefill | null
  onViewOriginal?: (tx: Transaction) => void
  /** Prefilled from a bill: its picture for the banner, and a way back to the scanner */
  scanImage?: string | null
  onRescan?: () => void
}

type SplitMode = 'equal' | 'percentage' | 'manual'
type SplitKind = 'lent' | 'absorbed'

interface SplitParticipant {
  id: string
  name: string
  value: number   // amount (manual) | percentage (percentage) | ignored (equal)
  kind: SplitKind
}

const TYPE_TABS: { id: Tab; label: string; tone: 'bad' | 'good' | 'brand' | 'info' }[] = [
  { id: 'expense',  label: 'Expense',  tone: 'bad' },
  { id: 'income',   label: 'Income',   tone: 'good' },
  { id: 'savings',  label: 'Savings',  tone: 'brand' },
  { id: 'transfer', label: 'Transfer', tone: 'info' },
]

// Contributions and withdrawals live on the Savings tab; Transfer is loans only
const LOAN_KINDS: { id: TransferKind; label: string; icon: string }[] = [
  { id: 'loan_given',              label: 'Loan given',         icon: 'north_east' },
  { id: 'loan_repayment_received', label: 'Repayment received', icon: 'south_west' },
  { id: 'loan_repayment_paid',     label: 'Loan repaid',        icon: 'north_east' },
]

const DESKTOP_QUERY = '(min-width: 640px)'
const R = (n: number) => formatCurrencyFull(n)
const todayStr = () => format(new Date(), 'yyyy-MM-dd')

function savingsTabFor(tx?: Transaction | null): Tab {
  if (!tx) return 'expense'
  if (tx.type === 'refund') return 'expense'
  return isSavingsTransfer(tx) ? 'savings' : tx.type
}

// Creates a "lent" borrowing or an "absorbed" expense for each split participant.
// Shared by both the create-new-transaction and edit-transaction save paths.
async function createSplitRecords(
  uid: string,
  finalParticipants: SplitParticipant[],
  totalAmount: number,
  splitMode: SplitMode,
  notes: string,
  category: string,
  date: string,
) {
  const n = finalParticipants.length
  for (const p of finalParticipants) {
    const pAmt = splitMode === 'equal'
      ? Math.floor(totalAmount / (n + 1))
      : splitMode === 'percentage'
        ? Math.round(totalAmount * p.value / 100)
        : p.value
    if (pAmt <= 0) continue
    if (p.kind === 'lent') {
      await addBorrowing(uid, {
        type: 'lent',
        amount: pAmt,
        person: p.name,
        description: notes ? `${notes} (split)` : `${category} (split)`,
        date,
        repaidAmount: 0,
        status: 'pending',
      })
    } else {
      await addTransaction(uid, {
        type: 'expense',
        amount: pAmt,
        category: 'Covered for Others',
        date,
        notes: `${p.name}'s share${notes ? ` · ${notes}` : ''}`,
        isRecurring: false,
      } as Omit<Transaction, 'id' | 'userId' | 'createdAt'>)
    }
  }
}

function useIsDesktop() {
  const [desk, setDesk] = useState(() => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY)
    const on = () => setDesk(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return desk
}

// The visible part of the screen. On phones the sheet sits inside it, so it rides above the keyboard.
function useVisualViewport(active: boolean) {
  const [vv, setVv] = useState<{ h: number; top: number } | null>(null)
  useEffect(() => {
    const v = typeof window !== 'undefined' ? window.visualViewport : null
    if (!active || !v) { setVv(null); return }
    const on = () => setVv({ h: v.height, top: v.offsetTop })
    on()
    v.addEventListener('resize', on)
    v.addEventListener('scroll', on)
    return () => { v.removeEventListener('resize', on); v.removeEventListener('scroll', on) }
  }, [active])
  return vv
}

// Opens the browser's own date picker for a hidden date input
function openPicker(el: HTMLInputElement | null) {
  if (!el) return
  try { el.showPicker() } catch { el.focus(); el.click() }
}

function dateLabel(d: string) {
  const days = differenceInCalendarDays(new Date(), parseISO(d))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  const dt = parseISO(d)
  return format(dt, dt.getFullYear() === new Date().getFullYear() ? 'EEE, d MMM' : 'd MMM yyyy')
}

export default function AddTransactionModal({ open, onClose, editTx, initialTab, initialSavingsVehicle, initialPrefill, onViewOriginal, scanImage, onRescan }: Props) {
  const { user } = useAuth()
  const refresh = useRefreshData()
  const { projects, budgets, transactions, borrowings, contacts, settings, emergencyFund, savingsGoals, setSavingsGoals, assets } = useAppStore()
  const isDesktop = useIsDesktop()
  const mobile = !isDesktop
  const vv = useVisualViewport(open && mobile)

  // Core fields
  const [activeTab, setActiveTab]       = useState<Tab>(savingsTabFor(editTx))
  const txType: TransactionType         = activeTab === 'savings' ? 'transfer' : activeTab
  const [transferKind, setTransferKind] = useState<TransferKind>(editTx?.transferKind ?? 'loan_repayment_received')
  const [savingsKind, setSavingsKind]   = useState<SavingsKind>(
    editTx?.transferKind === 'savings_withdrawal' || editTx?.transferKind === 'ef_withdrawal' ? 'savings_withdrawal' : 'savings_contribution'
  )
  const [savingsVehicle, setSavingsVehicle] = useState<string>(editTx?.savingsVehicle ?? EMERGENCY_FUND_VEHICLE)
  // Gold savings transfers: grams/karat/price — synced into the Gold net-worth asset on create
  const [goldGrams, setGoldGrams]                 = useState(editTx?.goldGrams ? String(editTx.goldGrams) : '')
  const [goldKarat, setGoldKarat]                 = useState<18 | 22 | 24>(editTx?.goldKarat ?? 22)
  const [goldPricePerGram, setGoldPricePerGram]   = useState(editTx?.goldPricePerGram ? String(editTx.goldPricePerGram) : '')
  // The Net Worth holding this savings transaction's money belongs to
  const [holdingId, setHoldingId]   = useState('')
  const [linkUnits, setLinkUnits]   = useState('')
  const [linkScheme, setLinkScheme] = useState('')
  const [linkMode, setLinkMode]     = useState<LinkMode | null>(null)
  const holdingTouched = useRef(false)
  const [amount, setAmount]             = useState(editTx ? String(editTx.amount) : initialPrefill?.amount != null ? String(initialPrefill.amount) : '')
  const [category, setCategory]         = useState<string>(editTx?.category ?? initialPrefill?.category ?? '')
  const [date, setDate]                 = useState(editTx?.date ?? initialPrefill?.date ?? todayStr())
  const [notes, setNotes]               = useState(editTx?.notes ?? initialPrefill?.notes ?? '')
  const [tags, setTags]                 = useState<string[]>(editTx?.tags ?? [])
  const [suggestedCat, setSuggestedCat] = useState<string | null>(null)
  const [thinking, setThinking]         = useState(false)
  const [projectId, setProjectId]       = useState(editTx?.projectId ?? '')
  const [isRecurring, setIsRecurring]   = useState(editTx?.isRecurring ?? false)
  const [saving, setSaving]             = useState(false)
  // Fuel fill-ups: pump reading + odometer. Of litres, ₹/litre and amount, any two fill in the third;
  // fuelAuto is the one we filled, and it keeps following the other two until it's typed over.
  const [fuel, setFuel]                 = useState<FuelDraft>(() => fuelDraftFrom(editTx, settings))
  const [fuelAuto, setFuelAuto]         = useState<FuelCalc | null>(null)
  // Person for loan transfers (auto-synced to borrowings); the query is the search box text
  const [loanPerson, setLoanPerson]     = useState('')
  const [personQuery, setPersonQuery]   = useState('')
  const [personOpen, setPersonOpen]     = useState(false)
  // Allocation plan: borrowingId → amount to apply (editable, defaults to greedy)
  const [allocation, setAllocation] = useState<Record<string, string>>({})

  // Debt settlement state (expense only) — settles against a person's *total* "lent" balance
  const [settledPerson, setSettledPerson] = useState(editTx?.settledPerson ?? '')

  // Refund state (expense edit only — logging a refund against this expense)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundDate, setRefundDate]     = useState(todayStr())
  const [refundNotes, setRefundNotes]   = useState('')
  const [addingRefund, setAddingRefund] = useState(false)
  const [showRefundForm, setShowRefundForm] = useState(false)

  // Split state
  const [splitEnabled, setSplitEnabled]   = useState(false)
  const [splitMode, setSplitMode]         = useState<SplitMode>('equal')
  const [participants, setParticipants]   = useState<SplitParticipant[]>([])
  const [myShareValue, setMyShareValue]   = useState(0)   // your % or ₹ in percentage / manual mode
  const [newName, setNewName]             = useState('')

  // Sheet UI: which input owns the keyboard, open layers, opened detail cards (in tap order)
  const [focus, setFocus]                 = useState<'amount' | 'text' | null>(null)
  const [noteFocused, setNoteFocused]     = useState(false)
  const [dateOpen, setDateOpen]           = useState(false)
  const [catExpanded, setCatExpanded]     = useState(false)
  const [allCats, setAllCats]             = useState(false)
  const [catQuery, setCatQuery]           = useState('')
  const [customOpen, setCustomOpen]       = useState(false)
  const [customName, setCustomName]       = useState('')
  const [customIcon, setCustomIcon]       = useState(() => ICON_PALETTE.find(p => p.group === 'Misc')?.name ?? ICON_PALETTE[0].name)
  const [iconGroup, setIconGroup]         = useState('Misc')
  const [sessionCats, setSessionCats]     = useState<string[]>([])
  const [openCards, setOpenCards]         = useState<CardKey[]>([])
  const [holdingOpen, setHoldingOpen]     = useState(false)
  const [vehicleInputOpen, setVehicleInputOpen] = useState(false)
  const [vehicleDraft, setVehicleDraft]   = useState('')
  const [tagQuery, setTagQuery]           = useState('')
  const [attempted, setAttempted]         = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const panelRef   = useRef<HTMLDivElement>(null)
  const bodyRef    = useRef<HTMLDivElement>(null)
  const amountRef  = useRef<HTMLInputElement>(null)
  const dateRef    = useRef<HTMLInputElement>(null)
  const refundDateRef = useRef<HTMLInputElement>(null)
  const drag       = useRef<{ y: number; dy: number } | null>(null)

  // Unique known people from contacts + borrowings
  const knownPeople = useMemo(() => Array.from(new Set([
    ...contacts.map(c => c.name),
    ...borrowings.map(b => b.person),
  ])).sort(), [contacts, borrowings])

  // What each person owes you / you owe them, across their open records
  const balances = useMemo(() => {
    const map = new Map<string, { owesYou: number; youOwe: number }>()
    for (const b of borrowings) {
      const out = b.amount - b.repaidAmount
      if (b.status === 'repaid' || out <= 0) continue
      const e = map.get(b.person) ?? { owesYou: 0, youOwe: 0 }
      if (b.type === 'lent') e.owesYou += out
      else e.youOwe += out
      map.set(b.person, e)
    }
    return map
  }, [borrowings])
  const personMeta = (name: string) => {
    const b = balances.get(name)
    if (b?.owesYou) return `Owes you ${R(b.owesYou)}`
    if (b?.youOwe) return `You owe ${R(b.youOwe)}`
    return 'No open records'
  }

  // When editing a settled expense, the allocation it already applied — reversed before
  // recomputing so outstanding balances read as they were *before* this expense.
  const editSettlePlan = useMemo<Record<string, number>>(() => {
    if (!editTx) return {}
    if (editTx.settledAllocation && Object.keys(editTx.settledAllocation).length) return editTx.settledAllocation
    if (editTx.settledBorrowingId) return { [editTx.settledBorrowingId]: editTx.settledAmount ?? editTx.amount }
    return {}
  }, [editTx])

  // People the user can settle an expense against (they lent money, person owes them),
  // with the total still outstanding across all of that person's "lent" records.
  const settleablePeople = useMemo(() => {
    const byPerson: Record<string, number> = {}
    for (const b of borrowings) {
      if (b.type !== 'lent') continue
      const effRepaid = Math.max(0, b.repaidAmount - (editSettlePlan[b.id] ?? 0))
      const outstanding = b.amount - effRepaid
      if (outstanding > 0) byPerson[b.person] = (byPerson[b.person] ?? 0) + outstanding
    }
    return Object.entries(byPerson)
      .map(([person, outstanding]) => ({ person, outstanding }))
      .sort((a, b) => a.person.localeCompare(b.person))
  }, [borrowings, editSettlePlan])

  // That person's outstanding "lent" records, oldest first, with this expense's own
  // prior contribution reversed so a re-save doesn't under-allocate.
  const settleRecords = useMemo(() => {
    if (!settledPerson) return []
    return borrowings
      .filter(b => b.type === 'lent' && b.person.toLowerCase() === settledPerson.toLowerCase())
      .map(b => ({ ...b, repaidAmount: Math.max(0, b.repaidAmount - (editSettlePlan[b.id] ?? 0)) }))
      .filter(b => b.amount - b.repaidAmount > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [borrowings, settledPerson, editSettlePlan])

  const settleOutstanding = useMemo(
    () => settleRecords.reduce((s, b) => s + (b.amount - b.repaidAmount), 0),
    [settleRecords]
  )

  // Greedy allocation of `budget` across those records (oldest first).
  const buildSettlePlan = useCallback((budget: number) => {
    let remaining = budget
    const plan: Record<string, number> = {}
    for (const b of settleRecords) {
      if (remaining <= 0) break
      const apply = Math.min(b.amount - b.repaidAmount, remaining)
      if (apply > 0) { plan[b.id] = apply; remaining -= apply }
    }
    return plan
  }, [settleRecords])

  // Preview plan for the entered amount (submit recomputes against the post-split share).
  const settlePlan = useMemo(() => buildSettlePlan(Number(amount) || 0), [buildSettlePlan, amount])

  const settleApplied = useMemo(
    () => Object.values(settlePlan).reduce((s, v) => s + v, 0),
    [settlePlan]
  )

  // Refund editing: this modal instance is editing a refund transaction itself
  const isRefundEdit = editTx?.type === 'refund'
  const linkedOriginal = isRefundEdit ? transactions.find(t => t.id === editTx!.refundOf) : undefined
  // Most this refund can be, given the other refunds against the same expense
  const refundCeiling = linkedOriginal
    ? linkedOriginal.amount - transactions
        .filter(t => t.type === 'refund' && t.refundOf === linkedOriginal.id && t.id !== editTx!.id)
        .reduce((s, t) => s + t.amount, 0)
    : Infinity

  // Refunds already logged against this expense (when editing an expense)
  const existingRefunds = useMemo(() =>
    editTx && editTx.type === 'expense'
      ? transactions.filter(t => t.type === 'refund' && t.refundOf === editTx.id).sort((a, b) => b.date.localeCompare(a.date))
      : [],
    [editTx, transactions]
  )
  const totalRefunded = existingRefunds.reduce((s, t) => s + t.amount, 0)
  const remainingRefundable = editTx ? editTx.amount - totalRefunded : 0

  const isRepaymentKind = transferKind === 'loan_repayment_received' || transferKind === 'loan_repayment_paid'
  const loanPersonTrimmed = loanPerson.trim()

  // Search results for the person box, and whether the typed name is someone new
  const personQ = personQuery.trim().toLowerCase()
  const personResults = useMemo(() =>
    knownPeople.filter(p => !personQ || p.toLowerCase().includes(personQ)).slice(0, 5),
    [knownPeople, personQ]
  )
  const canAddPerson = !!personQ && !knownPeople.some(p => p.toLowerCase() === personQ)

  // Open records with this person that a loan transfer of this kind touches
  const personRecords = useMemo(() => {
    if (!loanPersonTrimmed) return []
    const bType = transferKind === 'loan_repayment_paid' ? 'borrowed' : 'lent'
    return borrowings.filter(b => b.type === bType && b.status !== 'repaid' && b.person.toLowerCase() === loanPersonTrimmed.toLowerCase())
  }, [loanPersonTrimmed, borrowings, transferKind])

  // Pending borrowings for the selected person (for repayment kinds)
  const pendingForPerson = useMemo(() => {
    if (!loanPersonTrimmed || !isRepaymentKind) return []
    const bType = transferKind === 'loan_repayment_received' ? 'lent' : 'borrowed'
    return borrowings
      .filter(b => b.type === bType && b.status !== 'repaid' &&
                   b.person.toLowerCase() === loanPersonTrimmed.toLowerCase())
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [loanPersonTrimmed, borrowings, transferKind, isRepaymentKind])

  // Recompute greedy allocation whenever person, amount, or pending records change
  useEffect(() => {
    if (pendingForPerson.length === 0) { setAllocation({}); return }
    const amt = Number(amount)
    if (!amt) { setAllocation({}); return }
    let remaining = amt
    const plan: Record<string, string> = {}
    for (const b of pendingForPerson) {
      if (remaining <= 0) break
      const outstanding = b.amount - b.repaidAmount
      const apply = Math.min(outstanding, remaining)
      if (apply > 0) { plan[b.id] = String(Math.round(apply * 100) / 100); remaining -= apply }
    }
    setAllocation(plan)
  }, [pendingForPerson, amount])

  const allocationTotal = useMemo(() =>
    Object.values(allocation).reduce((s, v) => s + (Number(v) || 0), 0),
    [allocation]
  )

  // Fills the form from the transaction being edited / the prefill, or clears it for "save & add another"
  function resetForm(again = false) {
    const src = again ? null : editTx ?? null
    const pre = again ? null : initialPrefill ?? null
    if (!again) {
      setActiveTab(src ? savingsTabFor(src) : (initialTab ?? 'expense'))
      setTransferKind(src?.transferKind ?? 'loan_repayment_received')
      setSavingsKind(src?.transferKind === 'savings_withdrawal' || src?.transferKind === 'ef_withdrawal' ? 'savings_withdrawal' : 'savings_contribution')
      setSavingsVehicle(src?.savingsVehicle ?? initialSavingsVehicle ?? EMERGENCY_FUND_VEHICLE)
      setDate(src?.date ?? pre?.date ?? todayStr())
    }
    setGoldGrams(src?.goldGrams ? String(src.goldGrams) : '')
    setGoldKarat(src?.goldKarat ?? 22)
    setGoldPricePerGram(src?.goldPricePerGram ? String(src.goldPricePerGram) : '')
    const linked = src ? findLinkedAsset(assets, src.id) : undefined
    const linkedEntry = linked && src ? linkedContribution(linked, src.id) : undefined
    setHoldingId(linked?.id ?? '')
    setLinkUnits(linkedEntry?.units ? String(Math.abs(linkedEntry.units)) : '')
    setLinkScheme(linkedEntry?.schemeCode ?? '')
    setLinkMode(null)
    holdingTouched.current = false
    setAmount(src ? String(src.amount) : pre?.amount != null ? String(pre.amount) : '')
    setCategory(src?.category ?? pre?.category ?? '')
    setNotes(src?.notes ?? pre?.notes ?? '')
    setTags(src?.tags ?? [])
    setProjectId(src?.projectId ?? '')
    setIsRecurring(src?.isRecurring ?? false)
    setFuel(fuelDraftFrom(src, useAppStore.getState().settings))
    setFuelAuto(null)
    setSplitEnabled(false)
    setSplitMode('equal')
    setParticipants([])
    setMyShareValue(0)
    setNewName('')
    setLoanPerson(src?.loanPerson ?? '')
    setPersonQuery('')
    setPersonOpen(false)
    setAllocation({})
    setSettledPerson(src?.settledPerson ?? '')
    setRefundAmount('')
    setRefundDate(todayStr())
    setRefundNotes('')
    setShowRefundForm(false)
    setSuggestedCat(null)
    setThinking(false)
    setFocus(!src && !pre ? 'amount' : null)
    setDateOpen(false)
    setCatExpanded(false)
    setAllCats(false)
    setCatQuery('')
    setCustomOpen(false)
    setCustomName('')
    setHoldingOpen(false)
    setVehicleInputOpen(false)
    setVehicleDraft('')
    setTagQuery('')
    setAttempted(false)
    setConfirmDiscard(false)
    // Details the transaction already has start open, so nothing saved is hidden
    const cards: CardKey[] = []
    if (src?.tags?.length) cards.push('tags')
    if (src?.settledPerson) cards.push('settle')
    if (src?.projectId) cards.push('project')
    if (src?.isRecurring) cards.push('repeat')
    if (src?.type === 'expense' && transactions.some(t => t.type === 'refund' && t.refundOf === src.id)) cards.push('refunds')
    setOpenCards(cards)
  }

  // Reset on open/close
  useEffect(() => {
    if (open) resetForm()
  }, [open, editTx, initialPrefill]) // eslint-disable-line react-hooks/exhaustive-deps

  const isFuel = activeTab === 'expense' && isFuelExpense({ type: txType, category })
  // Litres, ₹ per litre, discount and amount move together: paid = litres × price − discount
  function applyFuelMaths(changed: FuelCalc | 'discount', nextFuel: FuelDraft, nextAmount: string) {
    const prev = { litres: fuel.litres, price: fuel.price, amount, discount: fuel.discount }
    const r = solveFuel(changed, prev, { litres: nextFuel.litres, price: nextFuel.price, amount: nextAmount, discount: nextFuel.discount }, fuelAuto)
    setFuelAuto(r.auto)
    setFuel({ ...nextFuel, litres: r.vals.litres, price: r.vals.price })
    setAmount(r.vals.amount)
  }

  function patchFuel(patch: Partial<FuelDraft>) {
    const next = { ...fuel, ...patch }
    const changed = 'litres' in patch ? 'litres' : 'price' in patch ? 'price' : 'discount' in patch ? 'discount' : null
    if (changed) applyFuelMaths(changed, next, amount)
    else setFuel(next)
  }

  function changeAmount(v: string) {
    setAttempted(false)
    if (isFuel) applyFuelMaths('amount', fuel, v)
    else setAmount(v)
  }

  // The in-sheet keypad: two decimals at most, nine digits at most
  function pressKey(k: string) {
    let a = amount
    if (k === 'del') a = a.slice(0, -1)
    else if (k === '.') { if (a.includes('.')) return; a = (a || '0') + '.' }
    else {
      if (a.includes('.') && a.split('.')[1].length >= 2) return
      if (a.replace('.', '').length >= 9) return
      if (a === '0') a = ''
      a += k
    }
    changeAmount(a)
  }

  // Auto-link Gold/Construction → project
  useEffect(() => {
    if (txType !== 'expense' || editTx) return
    const rules: Record<string, string[]> = {
      'Gold':         ['gold', 'wedding'],
      'Construction': ['construction', 'house'],
    }
    const keywords = rules[category]
    if (keywords) {
      const match = projects.find(p => keywords.some(kw => p.name.toLowerCase().includes(kw)))
      if (match) setProjectId(match.id)
    }
  }, [category, txType]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-categorization from notes (debounced 600ms) ───────────────────────
  useEffect(() => {
    if (activeTab === 'savings' || txType === 'transfer' || isRefundEdit) { setThinking(false); return }
    if (notes.trim().length < 3) { setSuggestedCat(null); setThinking(false); return }
    let live = true
    setThinking(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/chat/categorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: notes.trim(), type: txType }),
        })
        const data = await res.json()
        if (!live) return
        if (data.category && data.category !== category) setSuggestedCat(data.category)
        else setSuggestedCat(null)
      } catch { /* silent */ } finally {
        if (live) setThinking(false)
      }
    }, 600)
    return () => { live = false; clearTimeout(timer) }
  }, [notes, txType, activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Split calculations ──────────────────────────────────────────────────────

  const totalAmount = Number(amount) || 0

  const getParticipantAmount = useCallback((p: SplitParticipant): number => {
    if (splitMode === 'equal') {
      const n = participants.length
      return n > 0 ? Math.floor(totalAmount / (n + 1)) : 0
    }
    if (splitMode === 'percentage') return Math.round(totalAmount * p.value / 100)
    return p.value
  }, [splitMode, participants.length, totalAmount])

  const splitActive = splitEnabled && participants.length > 0
  const myShare = (() => {
    if (!splitActive) return totalAmount
    if (splitMode === 'equal') {
      const n = participants.length
      return totalAmount - n * Math.floor(totalAmount / (n + 1))
    }
    if (splitMode === 'percentage') return Math.round(totalAmount * myShareValue / 100)
    return myShareValue
  })()

  const sumAssigned = participants.reduce((s, p) => s + getParticipantAmount(p), 0) + myShare
  // Percentages balance on the percentages themselves, so rounding each share can't knock them out
  const pctTotal = myShareValue + participants.reduce((s, p) => s + p.value, 0)
  const isBalanced = !splitActive || splitMode === 'equal'
    ? true
    : splitMode === 'percentage' ? Math.abs(pctTotal - 100) < 0.01 : Math.abs(sumAssigned - totalAmount) < 0.5
  const splitRemaining = splitMode === 'percentage'
    ? Math.round(totalAmount * (100 - pctTotal)) / 100
    : totalAmount - sumAssigned
  const myPct = totalAmount > 0 ? Math.round((myShare / totalAmount) * 1000) / 10 : 0

  // ── Participant management ──────────────────────────────────────────────────

  // Even starting values for everyone, you included, whenever people or the mode change
  function seedSplit(mode: SplitMode, people: SplitParticipant[]) {
    const n = people.length + 1
    if (mode === 'percentage') {
      const each = +(100 / n).toFixed(2)
      setMyShareValue(+(100 - each * (n - 1)).toFixed(2))
      return people.map(p => ({ ...p, value: each }))
    }
    if (mode === 'manual') {
      const each = Math.floor(totalAmount / n)
      setMyShareValue(totalAmount - each * (n - 1))
      return people.map(p => ({ ...p, value: each }))
    }
    return people
  }

  function addParticipant(name: string) {
    const nm = name.trim()
    if (!nm) return
    setNewName('')
    if (participants.some(p => p.name.toLowerCase() === nm.toLowerCase())) return
    setParticipants(seedSplit(splitMode, [...participants, { id: Math.random().toString(36).slice(2), name: nm, value: 0, kind: 'lent' }]))
  }

  function updateParticipant(id: string, changes: Partial<SplitParticipant>) {
    setParticipants(ps => ps.map(p => p.id === id ? { ...p, ...changes } : p))
  }

  function removeParticipant(id: string) {
    setParticipants(seedSplit(splitMode, participants.filter(p => p.id !== id)))
  }

  function changeSplitMode(m: SplitMode) {
    setSplitMode(m)
    setParticipants(seedSplit(m, participants))
  }

  // ── Budget alert ────────────────────────────────────────────────────────────

  function checkBudgetAlert(cat: string, addedAmount: number, d: string) {
    // Budgets follow the salary cycle, so an expense after a late-month payday counts toward next month's plan
    const month = getCycleMonthForDate(d, settings)
    const budget = budgets.find(b => b.month === month && b.category === cat && !isSavingsPlan(b))
    if (!budget || budget.planned === 0) return
    const summary = buildMonthlySummary(transactions, month, settings, borrowings)
    const alreadySpent = summary.byCategory[cat as keyof typeof summary.byCategory] ?? 0
    const newTotal = alreadySpent + addedAmount
    const pct = (newTotal / budget.planned) * 100
    if (pct >= 100)
      toast.error(`Over budget on ${getCategoryDisplayName(cat)}! ₹${Math.round(newTotal).toLocaleString('en-IN')} of ₹${budget.planned.toLocaleString('en-IN')}`, { duration: 5000 })
    else if (pct >= 80)
      toast(`${Math.round(pct)}% of ${getCategoryDisplayName(cat)} budget used`, { duration: 4000 })
  }

  // ── Holding link ────────────────────────────────────────────────────────────

  // A new savings transaction goes to the holding its vehicle obviously means, when there is
  // exactly one. An existing transaction is never re-pointed automatically.
  useEffect(() => {
    if (!open || editTx || activeTab !== 'savings' || holdingTouched.current) return
    setHoldingId(defaultHoldingFor(savingsVehicle, assets)?.id ?? '')
  }, [open, editTx, activeTab, savingsVehicle, assets])

  // A vehicle that names a holding kind (Post Office, PPF, Gold…) only offers holdings of that
  // kind; custom vehicles and Other Savings can go to any holding. The holding already chosen or
  // linked always stays in the list, so an existing link is never hidden.
  const vehicleHoldingKinds = useMemo(() => vehicleKinds(savingsVehicle), [savingsVehicle])
  const linkableAssets = useMemo(() => {
    const linkedId = editTx ? findLinkedAsset(assets, editTx.id)?.id : undefined
    return assets
      .filter(a => isLinkable(a) && (!vehicleHoldingKinds.length || vehicleHoldingKinds.includes(a.kind) || a.id === holdingId || a.id === linkedId))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [assets, vehicleHoldingKinds, holdingId, editTx])

  // Emergency Fund keeps its own tracker, so it is never linked to a holding
  const activeHoldingId = activeTab === 'savings' && savingsVehicle !== EMERGENCY_FUND_VEHICLE ? holdingId : ''
  const holding     = activeHoldingId ? assets.find(a => a.id === activeHoldingId) : undefined
  const prevHolding = editTx ? findLinkedAsset(assets, editTx.id) : undefined
  // Pointing an existing transaction at a holding it wasn't linked to: its money may or may
  // not be in that holding's balance yet, so the user has to say which.
  const isRetroLink = !!editTx && !!holding && prevHolding?.id !== holding.id
  const showGoldFields = activeTab === 'savings' && (savingsVehicle === GOLD_VEHICLE || holding?.kind === 'gold_grams')
  const npsSchemes  = holding?.kind === 'nps' ? holding.npsHoldings ?? [] : []
  const showUnits   = holding?.kind === 'mutual_fund' || npsSchemes.length > 0

  function buildLinkInput(transactionId: string, linkAmount: number, target: Asset): LinkInput {
    const units = parseFloat(linkUnits)
    const grams = parseFloat(goldGrams)
    const schemeCode = linkScheme || target.npsHoldings?.[0]?.schemeCode
    return {
      transactionId,
      date,
      amount: linkAmount,
      direction: savingsKind === 'savings_contribution' ? 'in' : 'out',
      ...(target.kind === 'gold_grams' && grams > 0 ? { grams, karat: goldKarat, pricePerGram: parseFloat(goldPricePerGram) || 0 } : {}),
      ...((target.kind === 'mutual_fund' || target.kind === 'nps') && units > 0 ? { units } : {}),
      ...(target.kind === 'nps' && units > 0 && schemeCode ? { schemeCode } : {}),
    }
  }

  // What saving does to holdings: take this transaction out of the holding it was linked to,
  // then put it into the one now selected. Pure — run on store data for the preview and on a
  // fresh read for the actual write.
  function resolveLink(pool: Asset[], transactionId: string, linkAmount: number):
    { patches: Record<string, Partial<Asset>>; warning?: string } | { error: string } {
    const patches: Record<string, Partial<Asset>> = {}
    let warning: string | undefined
    let keepGoldSale = false
    let prevMode: LinkMode = 'add'
    const prev = editTx ? findLinkedAsset(pool, editTx.id) : undefined
    const target = activeHoldingId ? pool.find(a => a.id === activeHoldingId) : undefined

    if (prev && editTx) {
      const removed = removeLink(prev, editTx.id)
      if (removed) {
        patches[prev.id] = removed.patch
        prevMode = removed.mode
        // A gold sale's grams are never put back, so re-saving the same sale must not sell them twice.
        const isGoldSale = prev.kind === 'gold_grams' && removed.restore.direction === 'out'
        if (isGoldSale && target?.id === prev.id && savingsKind === 'savings_withdrawal') keepGoldSale = true
        else warning = removed.warning
      }
    }
    if (target) {
      // Same holding as before: re-save the link the way it was made, so an edit changes only
      // what was edited. A different holding (or none before): the user chooses.
      const sameHolding = prev?.id === target.id
      if (editTx && !sameHolding && !linkMode) return { error: 'Choose whether this money is already in the holding’s balance.' }
      const mode: LinkMode = !editTx ? 'add' : !sameHolding ? linkMode! : keepGoldSale ? 'included' : prevMode
      const result = applyLink({ ...target, ...patches[target.id] }, buildLinkInput(transactionId, linkAmount, target), mode)
      if ('error' in result) return { error: result.error }
      patches[target.id] = { ...patches[target.id], ...result.patch }
    }
    return { patches, warning }
  }

  const linkResult = holding && Number(amount) > 0
    ? resolveLink(assets, editTx?.id ?? 'new', Number(amount))
    : null
  const linkError = linkResult && 'error' in linkResult ? linkResult.error : null
  // Still waiting on the user to fill something in, as opposed to a link that can't work
  const linkNeedsInput = (isRetroLink && !linkMode) || (holding?.kind === 'gold_grams' && !(parseFloat(goldGrams) > 0))
  const linkPreview = holding && linkResult && !('error' in linkResult)
    ? { before: linkSummary(holding), after: linkSummary({ ...holding, ...linkResult.patches[holding.id] }) }
    : null
  const fmtLinked = (n: number, unit: '₹' | 'g') => unit === 'g' ? `${n} g` : formatCurrencyFull(n)

  async function syncHoldingLink(transactionId: string, linkAmount: number) {
    if (!user || (!activeHoldingId && !prevHolding)) return
    try {
      const fresh = await getUserAssets(user.uid)
      const resolved = resolveLink(fresh, transactionId, linkAmount)
      if ('error' in resolved) {
        toast.error(`Saved, but the holding wasn’t updated: ${resolved.error}`, { duration: 7000 })
        return
      }
      for (const [id, patch] of Object.entries(resolved.patches)) await updateAsset(id, patch)
      if (resolved.warning) toast(resolved.warning, { duration: 7000 })
    } catch {
      toast.error('Saved, but the holding wasn’t updated. Open the transaction and link it again.', { duration: 7000 })
    }
  }

  // ── What's on screen ────────────────────────────────────────────────────────

  const isExp = activeTab === 'expense' && !isRefundEdit
  const isInc = activeTab === 'income'
  const isSav = activeTab === 'savings'
  const isTr  = activeTab === 'transfer'
  const amt   = Number(amount) || 0
  const canSplit = txType === 'expense' && !editTx?.splitApplied && !isRefundEdit
  const splitOn  = canSplit && splitEnabled && isExp
  const showKeypad = mobile && focus === 'amount' && !allCats && !saving
  const kbdOpen = mobile && focus === 'text'
  const isScan = !!initialPrefill?.source && !editTx
  const cardOpen = (k: CardKey) => openCards.includes(k)

  // Category tiles: the user's most-used over the last 60 days, the AI pick and the current pick
  const customCats = useMemo(() => Array.from(new Set([...(settings?.customCategories ?? []), ...sessionCats])), [settings?.customCategories, sessionCats])
  const usage = useMemo(() => {
    const since = format(subDays(new Date(), 60), 'yyyy-MM-dd')
    const counts: Record<string, number> = {}
    for (const t of transactions) if (t.type === txType && t.date >= since && t.category) counts[t.category] = (counts[t.category] ?? 0) + 1
    return counts
  }, [transactions, txType])
  const catTiles = useMemo(() => {
    let top: string[]
    if (isInc) top = [...INCOME_CATEGORIES]
    else {
      const ranked = [...EXPENSE_CATEGORIES, ...customCats].filter(c => usage[c]).sort((a, b) => usage[b] - usage[a])
      top = Array.from(new Set([...ranked, ...DEFAULT_TOP_EXPENSE]))
    }
    top = top.slice(0, 7)
    if (suggestedCat && !top.includes(suggestedCat)) top = [suggestedCat, ...top]
    if (category && !top.includes(category)) top = [category, ...top]
    return top.slice(0, 7)
  }, [isInc, customCats, usage, suggestedCat, category])
  const suggestion = (isExp || isInc) && !!suggestedCat && suggestedCat !== category
  const showCatGrid = !category || showKeypad || catExpanded || suggestion
  const catGroups = useMemo(() => {
    const groups: [string, string[]][] = isInc ? [['Income', [...INCOME_CATEGORIES]]] : [...EXPENSE_GROUPS]
    if (!isInc) {
      const grouped = new Set(EXPENSE_GROUPS.flatMap(g => g[1]))
      const rest = EXPENSE_CATEGORIES.filter(c => !grouped.has(c))
      if (rest.length) groups.push(['More', rest])
    }
    if (customCats.length) groups.push(['Yours', customCats])
    const q = catQuery.trim().toLowerCase()
    return groups
      .map(([label, items]) => ({ label, items: items.filter(c => !q || getCategoryDisplayName(c).toLowerCase().includes(q)) }))
      .filter(g => g.items.length)
  }, [isInc, customCats, catQuery])

  const vehicles = useMemo(() => {
    const list = [...SAVINGS_VEHICLES, ...(settings?.customSavingsVehicles ?? []).filter(v => !SAVINGS_VEHICLES.includes(v))]
    if (savingsVehicle.trim() && !list.includes(savingsVehicle)) list.push(savingsVehicle)
    return list
  }, [settings?.customSavingsVehicles, savingsVehicle])

  const showAlloc = isTr && isRepaymentKind && !!loanPersonTrimmed && pendingForPerson.length > 0 && amt > 0 && !editTx

  // Why Save is off, in priority order, and the part of the form to point at
  const block: { text: string; target: string } | null = (() => {
    if (amt <= 0) return { text: isRefundEdit ? 'Enter the refund amount' : 'Enter an amount to continue', target: 'amount' }
    if (isRefundEdit && amt > refundCeiling) return { text: `Refund can’t exceed ${R(Math.max(0, refundCeiling))}`, target: 'amount' }
    if ((isExp || isInc) && !category) return { text: 'Pick a category', target: 'cats' }
    if (isSav && linkError) return { text: 'Fix the holding link', target: 'holding' }
    if (splitOn && newName.trim()) return { text: `Tap Add to include ${newName.trim()}`, target: 'split' }
    if (splitOn && splitActive && !isBalanced) return { text: splitRemaining > 0 ? `Split is ${R(splitRemaining)} short` : `Split is ${R(-splitRemaining)} over`, target: 'split' }
    if (splitOn && splitActive && myShare <= 0) return { text: 'Your share must be more than ₹0', target: 'split' }
    if (isTr && !editTx && !loanPersonTrimmed) return { text: 'Choose who this is with', target: 'person' }
    if (showAlloc && allocationTotal > amt + 0.01) return { text: 'Allocation is more than the amount', target: 'alloc' }
    return null
  })()

  function pointAt(target: string) {
    const body = bodyRef.current
    if (target === 'amount') {
      if (body) body.scrollTo({ top: 0, behavior: 'smooth' })
      if (isDesktop) amountRef.current?.focus()
      else setFocus('amount')
      return
    }
    const el = body?.querySelector(`[data-card="${target}"]`)
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function save(again = false) {
    if (saving || !user) return
    if (block) { setAttempted(true); pointAt(block.target); return }
    if (isRefundEdit) return saveRefundEdit()
    setFocus(null)
    setSaving(true)
    try {
      const finalParticipants = splitOn ? participants : []
      const effectiveAmount = finalParticipants.length > 0 ? myShare : Number(amount)

      // Settlement allocation for this save — capped at the amount that actually
      // leaves the user's pocket (the post-split share).
      const finalSettlePlan = txType === 'expense' && settledPerson
        ? buildSettlePlan(Math.min(Number(amount) || 0, effectiveAmount))
        : {}
      const finalSettleApplied = Object.values(finalSettlePlan).reduce((s, v) => s + v, 0)

      // A vehicle name typed but not added yet becomes the vehicle for this fill-up
      const fuelFinal = isFuel && fuel.newVehicle.trim()
        ? { ...fuel, vehicleId: await addVehicle(user.uid, settings, fuel.newVehicle), newVehicle: '' }
        : fuel

      const payload: Partial<Transaction> = {
        type: txType,
        amount: effectiveAmount,
        date,
        notes,
        tags,
        isRecurring,
        ...(isRecurring ? { recurringDay: new Date(date).getDate() } : {}),
        ...(activeTab === 'savings'
          ? { transferKind: savingsKind, savingsVehicle, category: 'Other' }
          : txType === 'transfer'
            ? { transferKind, category: 'Other' }
            : { category }),
        ...(showGoldFields && parseFloat(goldGrams) > 0
          ? { goldGrams: parseFloat(goldGrams), goldKarat, goldPricePerGram: parseFloat(goldPricePerGram) || 0 }
          : {}),
        ...(isFuel ? fuelPayload(fuelFinal) : {}),
        ...(projectId && (txType === 'expense' || activeTab === 'savings') ? { projectId } : {}),
        ...(txType === 'transfer' && loanPerson.trim() ? { loanPerson: loanPerson.trim() } : {}),
        ...(txType === 'expense' && settledPerson && finalSettleApplied > 0
          ? {
              settledPerson,
              settledBorrowingId: Object.keys(finalSettlePlan)[0] ?? '',
              settledAllocation: finalSettlePlan,
              settledAmount: finalSettleApplied,
            }
          : txType === 'expense'
            ? { settledBorrowingId: '', settledPerson: '', settledAllocation: {}, settledAmount: 0 }
            : {}),
        ...(!editTx && initialPrefill?.source ? { source: initialPrefill.source } : {}),
        ...(finalParticipants.length > 0 ? { splitApplied: true } : {}),
      }

      // Persist any newly-typed tags for reuse next time
      const existingTags = settings?.customTags ?? []
      const newTags = tags.filter(t => !existingTags.includes(t))
      if (newTags.length > 0) {
        await setUserSettings(user.uid, { customTags: [...existingTags, ...newTags] })
      }

      // The vehicle used last is preselected next time
      if (isFuel && !fuel.newVehicle.trim() && fuel.vehicleId && fuel.vehicleId !== settings?.defaultVehicleId) {
        await setUserSettings(user.uid, { defaultVehicleId: fuel.vehicleId })
      }

      // Collect affected project IDs upfront so we can recompute after refresh
      const affectedProjectIds = new Set<string>()
      if (txType === 'expense' || activeTab === 'savings') {
        if (editTx?.projectId) affectedProjectIds.add(editTx.projectId)
        if (projectId) affectedProjectIds.add(projectId)
      }

      const catSuffix = txType === 'expense' || txType === 'income' ? ` · ${getCategoryDisplayName(category)}` : ''

      if (editTx) {
        if (editTx.id.startsWith('borrow-')) {
          // Synthetic borrowing row — update the underlying borrowing record
          const borrowingId = editTx.id.replace('borrow-', '')
          await updateBorrowing(borrowingId, {
            amount: Number(amount),
            date,
            ...(notes ? { description: notes } : {}),
          })
          toast.success(`Updated · ${R(Number(amount))}`)
        } else {
          await updateTransaction(editTx.id, payload)
          await syncHoldingLink(editTx.id, effectiveAmount)

          // Reconcile settlement changes on edit: net the old allocation out and the
          // new one in, per borrowing record, in a single pass.
          if (txType === 'expense') {
            const delta: Record<string, number> = {}
            for (const [id, a] of Object.entries(editSettlePlan))    delta[id] = (delta[id] ?? 0) - a
            for (const [id, a] of Object.entries(finalSettlePlan))   delta[id] = (delta[id] ?? 0) + a
            for (const [id, d] of Object.entries(delta)) {
              if (!d) continue
              const b = borrowings.find(x => x.id === id)
              if (!b) continue
              const newRepaid = Math.max(0, Math.min(b.repaidAmount + d, b.amount))
              await updateBorrowing(id, {
                repaidAmount: newRepaid,
                status: newRepaid <= 0 ? 'pending' : newRepaid >= b.amount ? 'repaid' : 'partial',
              })
            }
          }

          // Split: first time this transaction is being split (canSplit already
          // excludes transactions that already have splitApplied set).
          if (finalParticipants.length > 0) {
            await createSplitRecords(user.uid, finalParticipants, totalAmount, splitMode, notes, category, date)
            const lentCount   = finalParticipants.filter(p => p.kind === 'lent').length
            const absorbCount = finalParticipants.filter(p => p.kind === 'absorbed').length
            const parts = []
            if (lentCount)   parts.push(`${lentCount} borrowing${lentCount > 1 ? 's' : ''} created`)
            if (absorbCount) parts.push(`${absorbCount} absorbed`)
            toast.success(`Transaction updated — ${parts.join(', ')}`)
          } else {
            toast.success(`Updated · ${R(effectiveAmount)}${catSuffix}`)
          }
        }
      } else {
        // My share transaction
        const txId = await addTransaction(user.uid, payload as Omit<Transaction, 'id' | 'userId' | 'createdAt'>)

        // Savings into / out of the Emergency Fund → keep the EF tracker balance in sync
        if (activeTab === 'savings' && savingsVehicle === EMERGENCY_FUND_VEHICLE) {
          const curBal = emergencyFund?.currentBalance ?? 0
          const target = emergencyFund?.targetAmount ?? settings?.emergencyFundTarget ?? 0
          const used   = emergencyFund?.usedAmount ?? 0
          if (savingsKind === 'savings_contribution') {
            await setEmergencyFund(user.uid, {
              targetAmount: target,
              currentBalance: curBal + effectiveAmount,
              usedAmount: used,
              lastUpdated: new Date().toISOString(),
            })
          } else {
            const drawn = Math.min(effectiveAmount, curBal)
            await setEmergencyFund(user.uid, {
              targetAmount: target,
              currentBalance: Math.max(0, curBal - effectiveAmount),
              usedAmount: used + drawn,
              lastUpdated: new Date().toISOString(),
            })
          }
        }

        // Auto-sync savings contribution / withdrawal → matching savings goal by name
        if (activeTab === 'savings' && savingsVehicle) {
          const goal = savingsGoals.find(
            g => g.name.trim().toLowerCase() === savingsVehicle.trim().toLowerCase()
          )
          if (goal) {
            const delta = savingsKind === 'savings_contribution' ? effectiveAmount : -effectiveAmount
            const newAmount = Math.max(0, goal.currentAmount + delta)
            await updateSavingsGoal(goal.id, { currentAmount: newAmount })
            setSavingsGoals(savingsGoals.map(g => g.id === goal.id ? { ...g, currentAmount: newAmount } : g))
          }
        }

        // Persist a brand-new custom vehicle so it shows up next time
        if (activeTab === 'savings') {
          const known = [...SAVINGS_VEHICLES, ...(settings?.customSavingsVehicles ?? [])]
          if (savingsVehicle.trim() && !known.includes(savingsVehicle)) {
            await setUserSettings(user.uid, {
              customSavingsVehicles: [...(settings?.customSavingsVehicles ?? []), savingsVehicle.trim()],
            })
          }
        }

        await syncHoldingLink(txId, effectiveAmount)

        // ── Auto-sync loan transfers → borrowings ──────────────────────────────
        if (txType === 'transfer' && loanPerson.trim()) {
          const person = loanPerson.trim()
          if (transferKind === 'loan_given') {
            // Create a new "lent" borrowing record and link it back to the transaction
            const borrowingId = await addBorrowing(user.uid, {
              type: 'lent',
              amount: effectiveAmount,
              person,
              description: notes || `Loan given`,
              date,
              repaidAmount: 0,
              status: 'pending',
            })
            await updateTransaction(txId, { borrowingId })
          } else if (transferKind === 'loan_repayment_received' || transferKind === 'loan_repayment_paid') {
            // Apply user-edited (or greedy-defaulted) allocation
            for (const [bId, applyAmt] of Object.entries(allocation)) {
              const a = Number(applyAmt)
              if (a <= 0) continue
              const b = borrowings.find(x => x.id === bId)
              if (!b) continue
              const newRepaid = Math.min(b.repaidAmount + a, b.amount)
              await updateBorrowing(bId, {
                repaidAmount: newRepaid,
                status: newRepaid >= b.amount ? 'repaid' : 'partial',
              })
            }
          }
        }

        // ── Debt settlement: spread the amount greedily across the person's ──────
        //    outstanding "lent" records (oldest first), like a loan repayment.
        if (txType === 'expense' && settledPerson) {
          for (const [bId, applyAmt] of Object.entries(finalSettlePlan)) {
            if (applyAmt <= 0) continue
            const b = borrowings.find(x => x.id === bId)
            if (!b) continue
            const newRepaid = Math.min(b.repaidAmount + applyAmt, b.amount)
            await updateBorrowing(bId, {
              repaidAmount: newRepaid,
              status: newRepaid >= b.amount ? 'repaid' : 'partial',
            })
          }
        }

        // Split: create borrowings + absorbed transactions
        if (finalParticipants.length > 0) {
          await createSplitRecords(user.uid, finalParticipants, totalAmount, splitMode, notes, category, date)
          const lentCount   = finalParticipants.filter(p => p.kind === 'lent').length
          const absorbCount = finalParticipants.filter(p => p.kind === 'absorbed').length
          const parts = []
          if (lentCount)   parts.push(`${lentCount} borrowing${lentCount > 1 ? 's' : ''} created`)
          if (absorbCount) parts.push(`${absorbCount} absorbed`)
          toast.success(`Split saved — ${parts.join(', ')}`)
        } else {
          const verb = activeTab === 'savings'
            ? (savingsKind === 'savings_withdrawal' ? 'Withdrawn' : 'Added to savings')
            : txType === 'transfer' ? 'Transfer logged' : txType === 'income' ? 'Income added' : 'Expense added'
          toast.success(`${verb} · ${R(effectiveAmount)}${catSuffix}`)
          if (txType === 'expense') checkBudgetAlert(category, effectiveAmount, date)

          // Prompt to save custom category
          if (txType !== 'transfer') {
            const allStandard = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]
            const existing = settings?.customCategories ?? []
            if (!allStandard.includes(category) && !existing.includes(category) && category) {
              const savedCat = category
              toast(t => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Sym name="bookmark_add" size={22} fill style={{ color: 'var(--brand-ink)' }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>Save &ldquo;{getCategoryDisplayName(savedCat)}&rdquo; as a category?</span>
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    style={{ height: 32, padding: '0 10px', borderRadius: 8, border: 0, background: 'transparent', color: 'var(--text-2)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={async () => {
                      toast.dismiss(t.id)
                      await setUserSettings(user.uid, { customCategories: [...existing, savedCat] })
                      await refresh()
                      toast.success(`"${getCategoryDisplayName(savedCat)}" saved`)
                    }}
                    style={{ height: 32, padding: '0 12px', borderRadius: 8, border: 0, background: 'var(--text)', color: 'var(--bg)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Save
                  </button>
                </div>
              ), { duration: 10000 })
            }
          }
        }
      }

      await refresh()

      // Recompute project.paid from actual transaction data (avoids incremental drift)
      if (affectedProjectIds.size > 0) {
        const { transactions: freshTxs, projects: freshProjs, setProjects } = useAppStore.getState()
        const paidUpdates: Promise<void>[] = []
        const paidMap: Record<string, number> = {}
        for (const pid of Array.from(affectedProjectIds)) {
          const paid = computeProjectPaid(freshTxs, pid)
          paidMap[pid] = paid
          paidUpdates.push(updateProject(pid, { paid }))
        }
        await Promise.all(paidUpdates)
        setProjects(freshProjs.map(p => p.id in paidMap ? { ...p, paid: paidMap[p.id] } : p))
      }

      // Save & add another: same tab and date, everything else cleared
      if (again && !editTx) {
        resetForm(true)
        bodyRef.current?.scrollTo({ top: 0 })
        if (isDesktop) setTimeout(() => amountRef.current?.focus(), 0)
      } else {
        onClose()
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  // ── Refunds (logged inline against an existing expense) ────────────────────

  async function logRefund() {
    if (!user || !editTx) return
    const a = Number(refundAmount)
    if (!a || a <= 0) return
    setAddingRefund(true)
    try {
      // Re-check against a fresh read, not just the locally cached total — the local
      // copy can be stale (another device, or a refund logged moments ago elsewhere),
      // which would otherwise let two refunds silently add up to more than the expense.
      const fresh = await getRefundsOf(user.uid, editTx.id)
      const freshRefunded = fresh
        .filter(t => t.type === 'refund')
        .reduce((s, t) => s + t.amount, 0)
      const freshRemaining = editTx.amount - freshRefunded
      if (a > freshRemaining) {
        toast.error(`Refund can't exceed ${formatCurrencyFull(Math.max(0, freshRemaining))} remaining`)
        return
      }
      await addTransaction(user.uid, {
        type: 'refund',
        refundOf: editTx.id,
        category: editTx.category,
        amount: a,
        date: refundDate,
        notes: refundNotes,
        tags: [],
        isRecurring: false,
        ...(editTx.projectId ? { projectId: editTx.projectId } : {}),
      } as Omit<Transaction, 'id' | 'userId' | 'createdAt'>)
      await refresh()
      toast.success('Refund logged')
      setRefundAmount('')
      setRefundNotes('')
      setShowRefundForm(false)
    } catch {
      toast.error('Failed to log refund')
    } finally {
      setAddingRefund(false)
    }
  }

  async function removeRefund(id: string) {
    try {
      await deleteTransaction(id)
      await refresh()
      toast.success('Refund removed')
    } catch {
      toast.error('Failed to remove refund')
    }
  }

  async function saveRefundEdit() {
    if (!editTx || !linkedOriginal) return
    const a = Number(amount)
    if (!a || a <= 0) return
    setSaving(true)
    try {
      // Fresh check for the same staleness reason as logRefund above
      const fresh = await getRefundsOf(editTx.userId, linkedOriginal.id)
      const otherRefunds = fresh
        .filter(t => t.type === 'refund' && t.id !== editTx.id)
        .reduce((s, t) => s + t.amount, 0)
      const maxRefundable = linkedOriginal.amount - otherRefunds
      if (a > maxRefundable) {
        toast.error(`Refund can't exceed ${formatCurrencyFull(Math.max(0, maxRefundable))} remaining`)
        setSaving(false)
        return
      }
      await updateTransaction(editTx.id, { amount: a, date, notes })
      await refresh()
      toast.success(`Refund updated · ${R(a)}`)
      onClose()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  // ── Interaction ─────────────────────────────────────────────────────────────

  function setTab(t: Tab) {
    // Amount, date and note carry over; split and the category don't
    setActiveTab(t)
    if (t === 'transfer' && !LOAN_KINDS.some(k => k.id === transferKind)) setTransferKind('loan_repayment_received')
    setSplitEnabled(false)
    setOpenCards(cs => cs.filter(c => c !== 'split'))
    setCategory('')
    setSuggestedCat(null)
    setCatExpanded(false)
    setAllCats(false)
    setAttempted(false)
  }

  function pickCat(c: string) {
    setCategory(c)
    setCatExpanded(false)
    setAllCats(false)
    setCatQuery('')
    setFocus(f => (f === 'amount' ? null : f))
    if (suggestedCat === c) setSuggestedCat(null)
    setAttempted(false)
  }

  function createCustom() {
    const nm = customName.trim()
    if (!nm) return
    const value = buildCustomCategory(customIcon, nm)
    setSessionCats(cs => (cs.includes(value) ? cs : [...cs, value]))
    setCustomOpen(false)
    setCustomName('')
    pickCat(value)
  }

  function toggleCard(k: CardKey) {
    const on = cardOpen(k)
    setOpenCards(cs => (on ? cs.filter(c => c !== k) : [...cs, k]))
    if (k === 'split') { setSplitEnabled(!on); if (on) { setParticipants([]); setNewName('') } }
    if (k === 'settle' && on) setSettledPerson('')
    if (k === 'project' && on) setProjectId('')
    if (k === 'repeat') setIsRecurring(!on)
    if (!on) {
      setFocus(f => (f === 'amount' ? null : f))
      setTimeout(() => bodyRef.current?.querySelector(`[data-card="${k}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60)
    }
  }

  const dirty = editTx
    ? amount !== String(editTx.amount) || notes !== (editTx.notes ?? '') || date !== editTx.date || (!!category && category !== editTx.category)
    : !!amount || !!notes.trim() || participants.length > 0

  // Esc, a scrim tap and the drag handle all come here: close the innermost layer first,
  // and ask before throwing away anything typed
  function requestClose() {
    if (saving) return
    if (confirmDiscard) { setConfirmDiscard(false); return }
    if (allCats) { setAllCats(false); setCatQuery(''); return }
    if (personOpen) { setPersonOpen(false); return }
    if (holdingOpen) { setHoldingOpen(false); return }
    if (dateOpen) { setDateOpen(false); return }
    if (dirty) { setConfirmDiscard(true); return }
    onClose()
  }

  const isTyping = (el: EventTarget | null) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement

  function onPanelKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(!editTx) ; return }
    if (!isTyping(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey && /^[1-4]$/.test(e.key) && !isRefundEdit && !allCats) {
      e.preventDefault()
      setTab(TYPE_TABS[Number(e.key) - 1].id)
    }
  }

  // Enter in a single-line field saves
  function onFieldKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); save() }
  }

  // Text fields own the system keyboard: the keypad steps aside and, on phones, the sheet goes full height
  function onFocusIn(e: React.FocusEvent) {
    const el = e.target
    if (!isTyping(el) || el === amountRef.current || (el as HTMLInputElement).type === 'date') return
    setFocus('text')
    if (mobile) setTimeout(() => (el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' }), 320)
  }
  function onFocusOut() {
    setTimeout(() => {
      const a = document.activeElement
      if (!isTyping(a) || !panelRef.current?.contains(a)) setFocus(f => (f === 'text' ? null : f))
    }, 0)
  }

  // Drag the handle down to close (phones)
  function onHandleDown(e: React.PointerEvent) {
    drag.current = { y: e.clientY, dy: 0 }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onHandleMove(e: React.PointerEvent) {
    const d = drag.current
    const panel = panelRef.current
    if (!d || !panel) return
    d.dy = Math.max(0, e.clientY - d.y)
    panel.style.transition = 'none'
    panel.style.transform = `translateY(${d.dy}px)`
  }
  function onHandleUp() {
    const d = drag.current
    const panel = panelRef.current
    drag.current = null
    if (!d || !panel) return
    panel.style.transition = 'transform .25s cubic-bezier(.2,.8,.2,1)'
    panel.style.transform = ''
    if (d.dy > 100) requestClose()
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const tabTone = TYPE_TABS.find(t => t.id === activeTab)!.tone
  const amountTone = isRefundEdit ? 'bad' : tabTone
  const [amountLabel, amountIcon] = isRefundEdit ? ['Refund amount', 'undo']
    : isExp ? ['Spent', 'arrow_outward']
    : isInc ? ['Received', 'south_west']
    : isSav ? (savingsKind === 'savings_contribution' ? ['Into savings', 'savings'] : ['Back to cash', 'payments'])
    : transferKind === 'loan_given' ? ['Lent', 'north_east']
    : transferKind === 'loan_repayment_received' ? ['Received back', 'south_west'] : ['Repaid', 'north_east']
  const amountErr = attempted && amt <= 0
  const amountText = groupINR(amount) || '0'
  const amountHint = amountErr ? 'Enter an amount to continue'
    : isFuel && fuelAuto === 'amount' ? 'calculated from litres × price'
    : editTx?.type === 'expense' && isExp && totalRefunded > 0 ? `Net after refunds ${R(amt - totalRefunded)}`
    : null

  const dayDiff = differenceInCalendarDays(new Date(), parseISO(date))
  const earlier = dayDiff > 1 || dayDiff < 0
  const days = Array.from({ length: 30 }, (_, i) => subDays(new Date(), i))

  const selectedKind = TRANSFER_KINDS.find(k => k.id === transferKind)
  const notePh = isRefundEdit ? 'Notes (optional)'
    : isSav ? 'e.g. Monthly SIP, bonus into FD…'
    : isTr ? (selectedKind?.dir === 'in' ? 'e.g. Rahul paid back' : 'e.g. Lent to Priya')
    : isInc ? 'e.g. November salary'
    : 'e.g. Domino\'s pizza — we\'ll suggest a category'

  const vMeta = vehicleSheetMeta(savingsVehicle)
  const vTone = tone(vMeta.h)
  const holdingSummary = (a: Asset) => {
    const s = linkSummary(a)
    return s.unit === 'g' ? `${s.total} g` : R(s.total)
  }
  const gramsVal = parseFloat(goldGrams) || 0
  const goldCalc = gramsVal * (parseFloat(goldPricePerGram) || 0)
  const goldMatch = Math.abs(goldCalc - amt) < 1
  const gramsMissing = holding?.kind === 'gold_grams' && !(gramsVal > 0)

  // The "Add details" tray, in the design's order; a chip is dark while its card is open
  const tray: { k: CardKey; label: string; icon: string; summary: string | null }[] = []
  const project = projects.find(p => p.id === projectId)
  const autoLinked = txType === 'expense' && (category === 'Gold' || category === 'Construction') && !!projectId
  if (isExp && canSplit) tray.push({ k: 'split', label: 'Split', icon: 'call_split', summary: splitActive ? `${participants.length + 1} people` : null })
  if (!isTr && !isRefundEdit) tray.push({ k: 'tags', label: 'Tags', icon: 'sell', summary: tags.length ? String(tags.length) : null })
  if (isExp && (settleablePeople.length > 0 || settledPerson)) tray.push({ k: 'settle', label: 'Settle a debt', icon: 'handshake', summary: settledPerson ? settledPerson.split(' ')[0] : null })
  if ((isExp || isSav) && projects.length > 0) tray.push({ k: 'project', label: 'Project', icon: 'folder', summary: project ? (cardOpen('project') || !autoLinked ? project.name : 'Auto') : null })
  if (isExp || isInc) tray.push({ k: 'repeat', label: 'Repeat monthly', icon: 'event_repeat', summary: null })
  if (editTx?.type === 'expense' && isExp) tray.push({ k: 'refunds', label: 'Refunds', icon: 'undo', summary: totalRefunded ? R(totalRefunded) : null })

  const saveLabel = saving ? 'Saving…'
    : isRefundEdit ? 'Update refund'
    : editTx ? 'Update'
    : isExp ? (splitOn && splitActive ? `Save & split (${participants.length + 1} records)` : 'Add expense')
    : isInc ? 'Add income'
    : isSav ? (savingsKind === 'savings_contribution' ? 'Add to savings' : 'Withdraw from savings')
    : 'Log transfer'
  const disabled = !!block
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  const panelStyle: CSSProperties = isDesktop
    ? { width: 440, maxHeight: 'min(640px, calc(100dvh - 32px))', borderRadius: 24, boxShadow: '0 30px 70px -10px rgba(0,0,0,.3), 0 0 0 1px var(--line)' }
    : { width: '100%', borderRadius: '26px 26px 0 0', boxShadow: '0 -10px 40px rgba(0,0,0,.18)', ...(kbdOpen ? { height: 'calc(100% - 12px)' } : { maxHeight: '92%' }) }

  const fieldLabel = (text: string, extra?: CSSProperties) => <div style={{ ...labelStyle, ...extra }}>{text}</div>

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" style={{ position: 'relative', zIndex: 50 }} onClose={requestClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-out duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="txn-scrim" style={{ position: 'fixed', inset: 0 }} />
        </Transition.Child>

        <div
          style={{
            position: 'fixed', left: 0, right: 0, display: 'flex', justifyContent: 'center',
            alignItems: isDesktop ? 'center' : 'flex-end', padding: isDesktop ? 16 : 0,
            top: vv ? vv.top : 0, height: vv ? vv.h : '100%',
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="transition duration-[340ms] ease-[cubic-bezier(.2,.8,.2,1)] sm:duration-[250ms] sm:ease-out"
            enterFrom="translate-y-[105%] sm:translate-y-[3%] sm:scale-[.97] sm:opacity-0"
            enterTo="translate-y-0 sm:scale-100 sm:opacity-100"
            leave="transition duration-200 ease-out"
            leaveFrom="translate-y-0 sm:scale-100 sm:opacity-100"
            leaveTo="translate-y-[105%] sm:translate-y-[3%] sm:scale-[.97] sm:opacity-0"
          >
            <Dialog.Panel
              ref={panelRef}
              className="txn-sheet"
              aria-label={isRefundEdit ? 'Edit refund' : editTx ? 'Edit transaction' : 'Add transaction'}
              onKeyDown={onPanelKey}
              onFocus={onFocusIn}
              onBlur={onFocusOut}
              style={{ position: 'relative', display: 'flex', flexDirection: 'column', background: 'var(--sheet)', overflow: 'hidden', ...panelStyle }}
            >
              {/* Drag handle — phones */}
              {mobile && (
                <div
                  onPointerDown={onHandleDown} onPointerMove={onHandleMove} onPointerUp={onHandleUp} onPointerCancel={onHandleUp}
                  style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px', flex: 'none', cursor: 'grab', touchAction: 'none' }}
                >
                  <div style={{ width: 38, height: 5, borderRadius: 3, background: 'var(--line2)' }} />
                </div>
              )}

              {/* Title row — edit modes */}
              {editTx && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px 6px 20px', flex: 'none', ...(isDesktop ? { paddingTop: 14 } : {}) }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Dialog.Title style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.01em' }}>
                      {isRefundEdit ? 'Edit refund' : 'Edit transaction'}
                    </Dialog.Title>
                    <div style={{ fontSize: 12.5, color: 'var(--t3)', fontWeight: 500 }}>
                      {isRefundEdit ? 'Refund · editing' : `${TYPE_TABS.find(t => t.id === activeTab)!.label} · ${dateLabel(date)}`}
                    </div>
                  </div>
                  <button type="button" onClick={requestClose} aria-label="Close" style={{ ...closeBtn, width: 40, height: 40 }}><Sym name="close" /></button>
                </div>
              )}

              {/* Type tabs */}
              {!isRefundEdit && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 10px 16px', flex: 'none', ...(isDesktop && !editTx ? { paddingTop: 14 } : {}) }}>
                  <div role="tablist" aria-label="Transaction type" style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 2, padding: 3, borderRadius: 14, background: 'var(--sunk)' }}>
                    {TYPE_TABS.map(t => {
                      const sel = activeTab === t.id
                      return (
                        <button key={t.id} type="button" role="tab" aria-selected={sel} onClick={() => setTab(t.id)}
                          style={{ height: 38, border: 0, borderRadius: 11, background: sel ? `var(--${t.tone}-soft)` : 'transparent', color: sel ? `var(--${t.tone}-ink)` : 'var(--t2)', fontSize: 13.5, fontWeight: sel ? 800 : 600, cursor: 'pointer', minWidth: 0, padding: 0 }}
                        >{t.label}</button>
                      )
                    })}
                  </div>
                  {!editTx && (
                    <button type="button" onClick={requestClose} aria-label="Close" style={{ ...closeBtn, width: 40, height: 40 }}><Sym name="close" /></button>
                  )}
                </div>
              )}

              {/* Read from a bill */}
              {isScan && (
                <div style={{ margin: '0 16px 6px', display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderRadius: 14, background: 'var(--brand-soft)', flex: 'none' }}>
                  {scanImage
                    ? <img src={scanImage} alt="" style={{ width: 38, height: 46, borderRadius: 7, objectFit: 'cover', flex: 'none' }} />
                    : <div style={{ width: 38, height: 46, borderRadius: 7, background: 'repeating-linear-gradient(135deg, var(--card) 0 4px, var(--sunk) 4px 8px)', flex: 'none', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: MONO, fontSize: 7, color: 'var(--t3)', paddingBottom: 3 }}>bill</div>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--brand-ink)' }}>Read from your bill</div>
                    <div style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.35 }}>
                      {[initialPrefill?.amount, initialPrefill?.category, initialPrefill?.date, initialPrefill?.notes].filter(v => v != null && v !== '').length} fields filled · check before saving
                    </div>
                  </div>
                  {onRescan && (
                    <button type="button" onClick={onRescan} style={{ height: 36, padding: '0 12px', borderRadius: 10, border: 0, background: 'var(--card)', color: 'var(--t1)', fontSize: 13, fontWeight: 600, cursor: 'pointer', flex: 'none' }}>Rescan</button>
                  )}
                </div>
              )}

              <div ref={bodyRef} className="txn-scroll" style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '0 16px 18px', overscrollBehavior: 'contain' }}>

                {/* ── All categories + custom ── */}
                {allCats && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button type="button" onClick={() => { setAllCats(false); setCatQuery('') }} aria-label="Back" style={{ ...closeBtn, width: 40, height: 40, color: 'var(--t1)' }}><Sym name="arrow_back" /></button>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 12px', borderRadius: 14, background: 'var(--card)', border: '1px solid var(--line)' }}>
                        <Sym name="search" style={{ color: 'var(--t3)' }} />
                        <input value={catQuery} onChange={e => setCatQuery(e.target.value)} placeholder="Search categories" aria-label="Search categories"
                          style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', fontSize: 16, color: 'var(--t1)' }} />
                      </div>
                    </div>
                    {catGroups.map(g => (
                      <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--t3)' }}>{g.label}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
                          {g.items.map(c => <CatTile key={c} category={c} selected={category === c} suggested={suggestedCat === c} onClick={() => pickCat(c)} />)}
                        </div>
                      </div>
                    ))}
                    <div style={{ background: 'var(--card)', border: '1px dashed var(--line2)', borderRadius: 18, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {!customOpen ? (
                        <button type="button" onClick={() => setCustomOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 10, height: 40, border: 0, background: 'transparent', color: 'var(--t1)', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                          <span style={{ width: 34, height: 34, borderRadius: 11, background: 'var(--sunk)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t2)' }}><Sym name="add" /></span>
                          Create a custom category
                        </button>
                      ) : (() => {
                        const ct = tone(hueOf(customName.trim() || 'x'))
                        const Preview = ICON_PALETTE.find(p => p.name === customIcon)?.Icon
                        const groupIcons = ICON_PALETTE.filter(p => p.group === iconGroup)
                        return (
                          <>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>New category</div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{ width: 44, height: 44, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', background: ct.soft, color: ct.ink, flex: 'none' }}>
                                {Preview && <Preview size={22} stroke={1.8} />}
                              </span>
                              <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Name, e.g. Pet care" maxLength={40}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createCustom() } }}
                                style={{ ...textInput }} />
                            </div>
                            <div className="txn-scroll" style={{ display: 'flex', gap: 4, overflowX: 'auto', margin: '0 -12px', padding: '0 12px' }}>
                              {Array.from(new Set(ICON_PALETTE.map(p => p.group))).map(g => (
                                <button key={g} type="button" onClick={() => setIconGroup(g)} style={chip(iconGroup === g, 'brand', { height: 34, fontSize: 12.5, padding: '0 11px' })}>{g}</button>
                              ))}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 6 }}>
                              {groupIcons.map(p => {
                                const sel = customIcon === p.name
                                return (
                                  <button key={p.name} type="button" aria-label={p.label} title={p.label} onClick={() => setCustomIcon(p.name)}
                                    style={{ height: 44, borderRadius: 12, border: sel ? '1.5px solid var(--brand)' : '1px solid var(--line)', background: sel ? 'var(--brand-soft)' : 'var(--sheet)', color: sel ? 'var(--brand-ink)' : 'var(--t2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <p.Icon size={22} stroke={1.6} />
                                  </button>
                                )
                              })}
                            </div>
                            <button type="button" onClick={createCustom}
                              style={{ height: 46, borderRadius: 14, border: 0, background: customName.trim() ? 'var(--t1)' : 'var(--sunk2)', color: customName.trim() ? 'var(--sheet)' : 'var(--t3)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>
                              Use &ldquo;{customName.trim() || 'New category'}&rdquo;
                            </button>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                )}

                {!allCats && (
                  <>
                    {/* Refund of … */}
                    {isRefundEdit && linkedOriginal && (() => {
                      const look = categoryLook(linkedOriginal.category)
                      return (
                        <button type="button" onClick={() => onViewOriginal?.(linkedOriginal)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 12, margin: '4px 0 8px', borderRadius: 16, border: '1px solid var(--line)', background: 'var(--card)', cursor: 'pointer', textAlign: 'left' }}>
                          <span style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--bad-soft)', color: 'var(--bad-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                            <CatGlyph category={linkedOriginal.category} />
                          </span>
                          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 600 }}>Refund of</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{look.label} · <span style={{ fontFamily: MONO, fontWeight: 500 }}>{R(linkedOriginal.amount)}</span></span>
                            <span style={{ fontSize: 12.5, color: 'var(--t2)' }}>on {format(parseISO(linkedOriginal.date), 'MMM d, yyyy')}</span>
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-ink)', flex: 'none' }}>View original →</span>
                        </button>
                      )
                    })()}

                    {/* Amount */}
                    <div data-card="amount" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 0 6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 20 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 700, color: `var(--${amountTone}-ink)` }}>
                          <Sym name={amountIcon} size={16} />{amountLabel}
                        </span>
                        {isScan && initialPrefill?.amount != null && (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--brand-soft)', color: 'var(--brand-ink)' }}>from bill</span>
                        )}
                      </div>
                      {mobile ? (
                        <button type="button" onClick={() => { (document.activeElement as HTMLElement | null)?.blur(); setFocus('amount') }} aria-label="Amount"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 0, padding: '0 8px', minHeight: 62, cursor: 'text', color: 'inherit', maxWidth: '100%' }}>
                          <span style={{ fontSize: 26, color: 'var(--t3)', fontWeight: 500, marginRight: 4, fontFamily: MONO }}>₹</span>
                          <span style={{
                            fontFamily: MONO, fontWeight: 500, letterSpacing: '-0.04em', lineHeight: 1.1,
                            fontSize: amountText.length > 10 ? 34 : amountText.length > 8 ? 40 : 48,
                            color: amountErr ? 'var(--bad-ink)' : amount ? (isFuel && fuelAuto === 'amount' ? 'var(--brand-ink)' : 'var(--t1)') : 'var(--t4)',
                          }}>{amountText}</span>
                          {showKeypad && <span style={{ width: 2.5, height: 38, borderRadius: 2, background: 'var(--brand)', marginLeft: 3, animation: 'gw-blink 1s steps(1) infinite' }} />}
                        </button>
                      ) : (
                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 66, cursor: 'text' }}>
                          <span style={{ fontSize: 28, color: 'var(--t3)', fontWeight: 500, fontFamily: MONO }}>₹</span>
                          <AmountInput
                            ref={amountRef}
                            value={amount}
                            onValueChange={changeAmount}
                            onKeyDown={onFieldKey}
                            placeholder="0"
                            aria-label="Amount"
                            autoFocus={!editTx && !initialPrefill}
                            data-autofocus={!editTx && !initialPrefill ? true : undefined}
                            style={{
                              fontFamily: MONO, fontSize: 46, fontWeight: 500, letterSpacing: '-0.04em', border: 0, outline: 'none',
                              background: 'transparent', padding: 0, textAlign: 'left', maxWidth: 340,
                              width: `${Math.max(1, (groupINR(amount) || '0').length) + 0.3}ch`,
                              color: amountErr ? 'var(--bad-ink)' : isFuel && fuelAuto === 'amount' ? 'var(--brand-ink)' : 'var(--t1)',
                            }}
                          />
                        </label>
                      )}
                      {amountHint && <div style={{ fontSize: 12.5, fontWeight: 600, color: amountErr ? 'var(--bad-ink)' : 'var(--t3)', marginTop: 2 }}>{amountHint}</div>}
                    </div>

                    {/* Date */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingBottom: 10 }}>
                      <button type="button" onClick={() => { setDate(todayStr()); setDateOpen(false) }} style={chip(dayDiff === 0 && !dateOpen, 'brand', { height: 36, fontSize: 13, padding: '0 12px' })}>Today</button>
                      <button type="button" onClick={() => { setDate(format(subDays(new Date(), 1), 'yyyy-MM-dd')); setDateOpen(false) }} style={chip(dayDiff === 1 && !dateOpen, 'brand', { height: 36, fontSize: 13, padding: '0 12px' })}>Yesterday</button>
                      <button type="button" onClick={() => setDateOpen(o => !o)} aria-expanded={dateOpen} style={chip(earlier || dateOpen, 'brand', { height: 36, fontSize: 13, padding: '0 12px' })}>
                        <Sym name="calendar_month" size={17} />{earlier ? dateLabel(date) : 'Earlier'}
                      </button>
                    </div>
                    {dateOpen && (
                      <div className="txn-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -16px', padding: '0 16px 12px' }}>
                        {days.map((d, i) => {
                          const ds = format(d, 'yyyy-MM-dd')
                          const sel = ds === date
                          return (
                            <button key={ds} type="button" onClick={() => { setDate(ds); setDateOpen(false) }}
                              style={{ flex: 'none', width: 52, height: 64, borderRadius: 14, border: sel ? '1.5px solid var(--brand)' : '1px solid var(--line)', background: sel ? 'var(--brand-soft)' : 'var(--card)', color: sel ? 'var(--brand-ink)' : 'var(--t1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: 'pointer' }}>
                              <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', opacity: 0.75 }}>{i === 0 ? 'Today' : format(d, 'EEE')}</span>
                              <span style={{ fontFamily: MONO, fontSize: 17, fontWeight: 500 }}>{d.getDate()}</span>
                              <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.6 }}>{format(d, 'MMM')}</span>
                            </button>
                          )
                        })}
                        {/* Anything older than 30 days, or ahead */}
                        <button type="button" onClick={() => openPicker(dateRef.current)}
                          style={{ position: 'relative', flex: 'none', width: 52, height: 64, borderRadius: 14, border: '1px dashed var(--line2)', background: 'transparent', color: 'var(--t2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer' }}>
                          <Sym name="calendar_month" size={18} />
                          <span style={{ fontSize: 10, fontWeight: 700 }}>Other</span>
                          <input ref={dateRef} type="date" tabIndex={-1} aria-hidden value={date}
                            onChange={e => { if (e.target.value) { setDate(e.target.value); setDateOpen(false) } }}
                            style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }} />
                        </button>
                      </div>
                    )}

                    {/* Note */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', borderRadius: 14,
                      background: isScan && initialPrefill?.notes && notes === initialPrefill.notes ? 'var(--brand-soft)' : 'var(--card)',
                      border: noteFocused ? '1.5px solid var(--brand)' : '1px solid var(--line)',
                      boxShadow: noteFocused ? '0 0 0 4px var(--brand-soft)' : 'none',
                    }}>
                      <Sym name="notes" style={{ color: 'var(--t3)' }} />
                      <input value={notes} maxLength={200} onChange={e => setNotes(e.target.value)} onKeyDown={onFieldKey}
                        onFocus={() => setNoteFocused(true)} onBlur={() => setNoteFocused(false)}
                        placeholder={notePh} aria-label={isSav ? 'Note' : 'Description'}
                        style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', fontSize: 16, color: 'var(--t1)', height: 46 }} />
                      {thinking && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-ink)', animation: 'gw-pulse 1s ease-in-out infinite', flex: 'none' }}>✦ Reading…</span>}
                    </div>

                    {/* Category */}
                    {(isExp || isInc) && (
                      <div data-card="cats" style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 30, gap: 8 }}>
                          <span style={{ ...labelStyle, color: attempted && !category && amt > 0 ? 'var(--bad-ink)' : 'var(--t2)' }}>Category</span>
                          {suggestion && (
                            <button type="button" onClick={() => pickCat(suggestedCat!)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 11px', borderRadius: 999, border: 0, background: 'var(--brand-soft)', color: 'var(--brand-ink)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', animation: 'gw-in .25s ease-out', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              ✦ Use &ldquo;{getCategoryDisplayName(suggestedCat!)}&rdquo;
                            </button>
                          )}
                        </div>
                        {showCatGrid ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
                            {catTiles.map(c => <CatTile key={c} category={c} selected={category === c} suggested={suggestedCat === c} onClick={() => pickCat(c)} />)}
                            {isInc
                              ? <NeutralTile label="Custom" icon="add" onClick={() => { setAllCats(true); setCustomOpen(true); setFocus(null) }} />
                              : <NeutralTile label={`All ${EXPENSE_CATEGORIES.length + customCats.length}`} icon="apps" onClick={() => { setAllCats(true); setFocus(null) }} />}
                          </div>
                        ) : (() => {
                          const look = categoryLook(category)
                          const t = tone(look.h)
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 8px 10px', borderRadius: 14, background: 'var(--card)', border: '1px solid var(--line)' }}>
                              <span style={{ width: 36, height: 36, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.ink, color: 'var(--card)', flex: 'none' }}>
                                <CatGlyph category={category} fill />
                              </span>
                              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{look.label}</span>
                              <button type="button" onClick={() => setCatExpanded(true)} style={{ height: 36, padding: '0 12px', borderRadius: 10, border: 0, background: 'var(--sunk)', color: 'var(--t2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', flex: 'none' }}>Change</button>
                            </div>
                          )
                        })()}
                      </div>
                    )}

                    {/* Savings: direction + where it's going */}
                    {isSav && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          {([
                            { id: 'savings_contribution' as const, label: 'Contribute', sub: 'Into savings', icon: 'south_east' },
                            { id: 'savings_withdrawal' as const,   label: 'Withdraw',   sub: 'Back to cash', icon: 'north_west' },
                          ]).map(d => {
                            const sel = savingsKind === d.id
                            return (
                              <button key={d.id} type="button" onClick={() => setSavingsKind(d.id)} aria-pressed={sel}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, height: 54, padding: '0 12px', borderRadius: 14, border: sel ? '1.5px solid var(--brand)' : '1px solid var(--line)', background: sel ? 'var(--brand-soft)' : 'var(--card)', color: sel ? 'var(--brand-ink)' : 'var(--t2)', cursor: 'pointer', textAlign: 'left' }}>
                                <Sym name={d.icon} />
                                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                                  <span style={{ fontSize: 14, fontWeight: 700 }}>{d.label}</span>
                                  <span style={{ fontSize: 11.5, fontWeight: 500, opacity: 0.75 }}>{d.sub}</span>
                                </span>
                              </button>
                            )
                          })}
                        </div>
                        {fieldLabel('Where’s it going?', { paddingTop: 4 })}
                        <div className="txn-scroll" style={{ display: 'grid', gridAutoFlow: 'column', gridTemplateRows: 'repeat(2, auto)', gap: 6, overflowX: 'auto', margin: '0 -16px', padding: '0 16px 2px', justifyContent: 'start' }}>
                          {vehicles.map(v => {
                            const sel = savingsVehicle === v
                            const m = vehicleSheetMeta(v)
                            const t = tone(m.h)
                            return (
                              <button key={v} type="button" onClick={() => { setSavingsVehicle(v); setHoldingOpen(false) }} aria-pressed={sel}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 40, padding: '0 13px 0 6px', borderRadius: 999, border: sel ? `1.5px solid ${t.ink}` : '1px solid var(--line)', background: sel ? t.soft : 'var(--card)', color: sel ? t.ink : 'var(--t1)', fontSize: 13.5, fontWeight: sel ? 700 : 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: sel ? t.ink : t.soft, color: sel ? 'var(--card)' : t.ink }}>
                                  <Sym name={m.icon} size={17} />
                                </span>
                                {v}
                              </button>
                            )
                          })}
                          <button type="button" onClick={() => setVehicleInputOpen(o => !o)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 40, padding: '0 13px', borderRadius: 999, border: '1px dashed var(--line2)', background: 'transparent', color: 'var(--t2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <Sym name="add" size={18} />Custom
                          </button>
                        </div>
                        {vehicleInputOpen && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input value={vehicleDraft} maxLength={40} onChange={e => setVehicleDraft(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (vehicleDraft.trim()) { setSavingsVehicle(vehicleDraft.trim()); setVehicleDraft(''); setVehicleInputOpen(false) } } }}
                              placeholder="Or type a custom vehicle (e.g. Crypto, REIT)…" style={{ ...textInput, background: 'var(--card)' }} />
                            <button type="button" onClick={() => { if (vehicleDraft.trim()) { setSavingsVehicle(vehicleDraft.trim()); setVehicleDraft(''); setVehicleInputOpen(false) } }} style={darkBtn}>Add</button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Transfer: loan kind + person */}
                    {isTr && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                          {LOAN_KINDS.map(k => {
                            const sel = transferKind === k.id
                            return (
                              <button key={k.id} type="button" onClick={() => setTransferKind(k.id)} aria-pressed={sel}
                                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, height: 84, padding: 10, borderRadius: 14, border: sel ? '1.5px solid var(--info)' : '1px solid var(--line)', background: sel ? 'var(--info-soft)' : 'var(--card)', color: sel ? 'var(--info-ink)' : 'var(--t1)', cursor: 'pointer', textAlign: 'left', minWidth: 0 }}>
                                <span style={{ width: 28, height: 28, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: sel ? 'var(--info)' : 'var(--sunk)', color: sel ? '#fff' : 'var(--t2)' }}>
                                  <Sym name={k.icon} size={18} />
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{k.label}</span>
                              </button>
                            )
                          })}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12.5, color: 'var(--t2)' }}>
                          <span>{selectedKind?.sub}</span>
                          <button type="button" onClick={() => setTab('savings')} style={{ border: 0, background: 'transparent', padding: '6px 0', color: 'var(--brand-ink)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Into savings? →</button>
                        </div>
                        <div data-card="person" style={{ ...labelStyle, paddingTop: 4, color: attempted && !loanPersonTrimmed ? 'var(--bad-ink)' : 'var(--t2)' }}>
                          {transferKind === 'loan_given' ? 'Who are you lending to?' : transferKind === 'loan_repayment_received' ? 'Who paid you back?' : 'Who are you repaying?'}
                        </div>
                        {loanPersonTrimmed ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 8px 10px', borderRadius: 14, background: 'var(--card)', border: '1px solid var(--line)' }}>
                            <span style={avatar(loanPersonTrimmed, 38)}>{loanPersonTrimmed[0]?.toUpperCase()}</span>
                            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loanPersonTrimmed}</span>
                              <span style={{ fontSize: 12.5, color: 'var(--t3)' }}>{personMeta(loanPersonTrimmed)}</span>
                            </span>
                            <button type="button" onClick={() => { setLoanPerson(''); setPersonOpen(true); setAllocation({}) }} style={{ height: 36, padding: '0 12px', borderRadius: 10, border: 0, background: 'var(--sunk)', color: 'var(--t2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Change</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 14, background: 'var(--card)', border: `1px solid ${attempted ? 'var(--bad)' : 'var(--line2)'}`, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 48, padding: '0 12px' }}>
                              <Sym name="person_search" style={{ color: 'var(--t3)' }} />
                              <input value={personQuery} maxLength={60} role="combobox" aria-expanded={personOpen} aria-label="Person"
                                onChange={e => { setPersonQuery(e.target.value); setPersonOpen(true) }}
                                onFocus={() => setPersonOpen(true)}
                                onKeyDown={e => {
                                  if (e.key !== 'Enter') return
                                  e.preventDefault()
                                  const pick = canAddPerson ? personQuery.trim() : personResults[0]
                                  if (pick) { setLoanPerson(pick); setPersonQuery(''); setPersonOpen(false) }
                                }}
                                placeholder="Search people or add someone new"
                                style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', fontSize: 16, color: 'var(--t1)' }} />
                            </div>
                            {personOpen && (personResults.length > 0 || canAddPerson) && (
                              <div role="listbox" style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--line)', padding: 4 }}>
                                {personResults.map(p => (
                                  <button key={p} type="button" role="option" aria-selected={false}
                                    onClick={() => { setLoanPerson(p); setPersonQuery(''); setPersonOpen(false) }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '4px 8px', border: 0, borderRadius: 10, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                                    <span style={avatar(p)}>{p[0]?.toUpperCase()}</span>
                                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--t1)' }}>{p}</span>
                                      <span style={{ fontSize: 12, color: 'var(--t3)' }}>{personMeta(p)}</span>
                                    </span>
                                  </button>
                                ))}
                                {canAddPerson && (
                                  <button type="button" onClick={() => { setLoanPerson(personQuery.trim()); setPersonQuery(''); setPersonOpen(false) }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '4px 8px', border: 0, borderRadius: 10, background: 'var(--sunk)', cursor: 'pointer', textAlign: 'left' }}>
                                    <span style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px dashed var(--line2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t2)', flex: 'none' }}><Sym name="add" size={18} /></span>
                                    <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--t1)' }}>Add &ldquo;{personQuery.trim()}&rdquo;</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {loanPersonTrimmed && personRecords.length > 0 && (
                          <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: 'var(--good-soft)', color: 'var(--good-ink)', fontSize: 12.5, fontWeight: 700 }}>
                            <Sym name="check" size={16} />Linked to existing borrowing record
                          </span>
                        )}
                        {loanPersonTrimmed && isRepaymentKind && personRecords.length === 0 && (
                          <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'flex-start', gap: 6, padding: '7px 10px', borderRadius: 12, background: 'var(--warn-soft)', color: 'var(--warn-ink)', fontSize: 12.5, fontWeight: 600, lineHeight: 1.35 }}>
                            <Sym name="info" size={16} />No open records for {loanPersonTrimmed.split(' ')[0]} — transaction will still be logged
                          </span>
                        )}
                      </div>
                    )}

                    {/* ── Everything below waits for the keypad to close ── */}
                    {!showKeypad && (
                      <>
                        {isFuel && (
                          <FuelFields value={fuel} onChange={patchFuel} auto={fuelAuto} paid={Number(amount) || 0} date={date} editId={editTx?.id} />
                        )}

                        {/* Net Worth holding */}
                        {isSav && savingsVehicle !== EMERGENCY_FUND_VEHICLE && (
                          <div data-card="holding" style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 14 }}>
                            {fieldLabel('Net Worth holding')}
                            <div style={{ borderRadius: 14, background: 'var(--card)', border: '1px solid var(--line)', overflow: 'hidden' }}>
                              <button type="button" onClick={() => setHoldingOpen(o => !o)} aria-expanded={holdingOpen}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, padding: '0 12px', border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                                <span style={{ width: 34, height: 34, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: holding ? vTone.soft : 'var(--sunk)', color: holding ? vTone.ink : 'var(--t3)', flex: 'none' }}>
                                  <Sym name={holding ? 'link' : 'link_off'} size={19} />
                                </span>
                                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{holding ? holding.name || 'Gold' : 'Not linked'}</span>
                                  <span style={{ fontSize: 12, color: 'var(--t3)' }}>
                                    {holding
                                      ? (() => { const s = linkSummary(holding); return s.unit === 'g' ? `${s.total} g held · ${s.count} linked` : `${R(s.total)} · ${s.count} linked` })()
                                      : linkableAssets.length ? `${linkableAssets.length} ${savingsVehicle} holding${linkableAssets.length > 1 ? 's' : ''} available` : 'No holdings of this kind'}
                                  </span>
                                </span>
                                <Sym name={holdingOpen ? 'expand_less' : 'expand_more'} style={{ color: 'var(--t3)' }} />
                              </button>
                              {holdingOpen && linkableAssets.length > 0 && (
                                <div role="listbox" style={{ borderTop: '1px solid var(--line)', padding: 4 }}>
                                  {[{ id: '', name: 'Not linked', bal: '' }, ...linkableAssets.map(a => ({ id: a.id, name: a.name || 'Gold', bal: holdingSummary(a) }))].map(o => (
                                    <button key={o.id || 'none'} type="button" role="option" aria-selected={holdingId === o.id}
                                      onClick={() => { holdingTouched.current = true; setHoldingId(o.id); setLinkMode(null); setHoldingOpen(false) }}
                                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, minHeight: 46, padding: '0 8px', border: 0, borderRadius: 10, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                                      <span style={radio(holdingId === o.id)} />
                                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}>{o.name}</span>
                                      <span style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--t3)' }}>{o.bal}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            {(linkableAssets.length === 0 || !holding) && (
                              <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--t3)' }}>
                                {linkableAssets.length === 0
                                  ? `No ${savingsVehicle} holding yet. This counts under Unlinked savings in Net Worth; add a ${savingsVehicle} holding there to link it.`
                                  : 'Counts under Unlinked savings in Net Worth until it is linked to a holding.'}
                              </div>
                            )}
                            {npsSchemes.length > 1 && (
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {npsSchemes.map(h => (
                                  <button key={h.schemeCode} type="button" onClick={() => setLinkScheme(h.schemeCode)}
                                    style={chip((linkScheme || npsSchemes[0].schemeCode) === h.schemeCode, 'brand', { height: 34, fontSize: 12.5 })}>{h.schemeName}</button>
                                ))}
                              </div>
                            )}
                            {showUnits && (
                              <>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                  <span style={subLabelStyle}>{savingsKind === 'savings_contribution' ? 'Units allotted' : 'Units redeemed'}</span>
                                  <input value={linkUnits} onChange={e => setLinkUnits(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0.000" style={field({ background: 'var(--card)' })} />
                                </label>
                                {!(parseFloat(linkUnits) > 0) && (
                                  <span style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.4 }}>Units not allotted yet? Save now. The holding counts this at cost and shows it as awaiting units until you open this transaction and add them.</span>
                                )}
                              </>
                            )}
                            {isRetroLink && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                {([
                                  { id: 'included' as const, label: 'Already in its balance', sub: 'Holding total stays the same' },
                                  { id: 'add' as const,      label: 'New money',              sub: savingsKind === 'savings_contribution' ? 'Holding total goes up' : 'Holding total goes down' },
                                ]).map(m => {
                                  const sel = linkMode === m.id
                                  return (
                                    <button key={m.id} type="button" onClick={() => setLinkMode(m.id)} aria-pressed={sel}
                                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, padding: '10px 12px', borderRadius: 14, border: sel ? '1.5px solid var(--brand)' : `1px solid ${attempted && !linkMode ? 'var(--bad)' : 'var(--line)'}`, background: sel ? 'var(--brand-soft)' : 'var(--card)', color: sel ? 'var(--brand-ink)' : 'var(--t1)', cursor: 'pointer', textAlign: 'left' }}>
                                      <span style={{ fontSize: 13.5, fontWeight: 700 }}>{m.label}</span>
                                      <span style={{ fontSize: 11.5, fontWeight: 500, opacity: 0.8, lineHeight: 1.3 }}>{m.sub}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                            {linkError && (!linkNeedsInput || attempted) && (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.4, fontWeight: 600, color: 'var(--bad-ink)' }}>
                                <Sym name="error" size={16} />{linkError}
                              </div>
                            )}
                            {holding && linkPreview && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 12px', borderRadius: 12, background: 'var(--brand-soft)' }}>
                                <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: 'var(--brand-ink)' }}>
                                  {holding.name || 'Gold'}: {fmtLinked(linkPreview.before.total, linkPreview.before.unit)} → {fmtLinked(linkPreview.after.total, linkPreview.after.unit)}
                                </span>
                                <span style={{ fontSize: 12, color: 'var(--t2)' }}>
                                  {linkPreview.before.total === linkPreview.after.total
                                    ? 'Already counted — holding total stays the same'
                                    : `${fmtLinked(linkPreview.after.historical, linkPreview.after.unit)} historical + ${fmtLinked(linkPreview.after.linked, linkPreview.after.unit)} from ${linkPreview.after.count} linked`}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Gold details */}
                        {showGoldFields && (
                          <div style={{ marginTop: 14, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Sym name="diamond" style={{ color: 'var(--t2)' }} />
                              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>Gold details</span>
                              <span style={{ flex: 1 }} />
                              <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 10, background: 'var(--sunk)' }}>
                                {([18, 22, 24] as const).map(k => (
                                  <button key={k} type="button" onClick={() => setGoldKarat(k)} style={seg(goldKarat === k, { height: 30, padding: '0 10px', fontSize: 12.5, borderRadius: 8 })}>{k}K</button>
                                ))}
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                <span style={subLabelStyle}>{savingsKind === 'savings_contribution' ? 'Grams bought' : 'Grams sold'}{holding?.kind === 'gold_grams' ? '' : ' (optional)'}</span>
                                <input value={goldGrams} onChange={e => { setGoldGrams(e.target.value.replace(/[^0-9.]/g, '')); setAttempted(false) }} inputMode="decimal" placeholder="0.000"
                                  style={field(attempted && gramsMissing ? { borderColor: 'var(--bad)', boxShadow: '0 0 0 3px var(--bad-soft)' } : undefined)} />
                              </label>
                              <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                <span style={subLabelStyle}>₹/gram</span>
                                <input value={goldPricePerGram} onChange={e => setGoldPricePerGram(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" style={field()} />
                              </label>
                            </div>
                            {goldCalc > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: goldMatch ? 'var(--good-ink)' : 'var(--warn-ink)' }}>
                                  = {R(goldCalc)} {goldMatch ? '✓ matches the amount' : '— should match the amount'}
                                </span>
                                <span style={{ flex: 1 }} />
                                {!goldMatch && (
                                  <button type="button" onClick={() => changeAmount(String(Math.round(goldCalc * 100) / 100))} style={{ height: 34, padding: '0 10px', borderRadius: 10, border: 0, background: 'var(--sunk)', color: 'var(--t1)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>Use as amount</button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Will settle */}
                        {showAlloc && (
                          <div data-card="alloc" style={{ marginTop: 14, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 2px 6px' }}>
                              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', color: 'var(--t3)', whiteSpace: 'nowrap' }}>WILL SETTLE</span>
                              <span style={{ fontSize: 12, color: 'var(--t3)', whiteSpace: 'nowrap' }}>oldest first</span>
                            </div>
                            {pendingForPerson.map(b => {
                              const outstanding = b.amount - b.repaidAmount
                              const val = allocation[b.id] ?? ''
                              const full = Number(val) >= outstanding
                              return (
                                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '4px 2px', borderTop: '1px solid var(--line)' }}>
                                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.description || 'Loan'} · {format(parseISO(b.date), 'd MMM')}</span>
                                    <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--t3)' }}>{R(outstanding)} outstanding</span>
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 42, width: 116, borderRadius: 10, padding: '0 10px', flex: 'none', border: full ? '1.5px solid var(--good)' : '1px solid var(--line)', background: full ? 'var(--good-soft)' : Number(val) ? 'var(--card)' : 'var(--sheet)' }}>
                                    <span style={{ fontFamily: MONO, fontSize: 14, color: 'var(--t3)' }}>₹</span>
                                    <input value={val && Number(val) ? val : ''} inputMode="decimal" placeholder="Untouched" aria-label={`Apply to ${b.description || 'loan'}`}
                                      onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ''); setAllocation(prev => ({ ...prev, [b.id]: v })) }}
                                      style={{ width: '100%', minWidth: 0, border: 0, outline: 0, background: 'transparent', fontFamily: MONO, fontSize: 16, textAlign: 'right', color: 'var(--t1)' }} />
                                  </div>
                                </div>
                              )
                            })}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 2px 2px', borderTop: '1px solid var(--line)' }}>
                              {Math.abs(allocationTotal - amt) < 0.01
                                ? <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--good-ink)' }}>Fully allocated ✓</span>
                                : allocationTotal < amt
                                  ? <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--warn-ink)' }}>{R(amt - allocationTotal)} unallocated</span>
                                  : <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--bad-ink)' }}>{R(allocationTotal - amt)} over-allocated</span>}
                              <span style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--t2)' }}>{R(allocationTotal)} / {R(amt)}</span>
                            </div>
                          </div>
                        )}

                        {isTr && (
                          <div style={{ marginTop: 14, display: 'flex', gap: 10, padding: 12, borderRadius: 14, background: 'var(--info-soft)', color: 'var(--info-ink)', fontSize: 12.5, lineHeight: 1.45, fontWeight: 500 }}>
                            <Sym name="info" size={18} />
                            <span>Transfers are excluded from income and expense totals — they won’t affect your savings rate, health score, or budget tracking.</span>
                          </div>
                        )}

                        {/* Add details */}
                        {tray.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                              <span style={labelStyle}>Add details</span>
                              <span style={{ fontSize: 12, color: 'var(--t4)', fontWeight: 500 }}>optional</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {tray.map(c => {
                                const active = cardOpen(c.k) || (c.k === 'repeat' && isRecurring)
                                return (
                                  <button key={c.k} type="button" onClick={() => toggleCard(c.k)} aria-pressed={active}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 40, padding: '0 13px 0 10px', borderRadius: 999, border: active ? '1px solid transparent' : '1px solid var(--line)', background: active ? 'var(--t1)' : 'var(--card)', color: active ? 'var(--sheet)' : 'var(--t1)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    <Sym name={c.icon} size={18} style={{ color: active ? 'var(--sheet)' : 'var(--t3)' }} />
                                    {c.label}
                                    {c.summary && <span style={{ fontWeight: 500, opacity: 0.85 }}>· {c.summary}</span>}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Opened cards, in the order they were opened */}
                        {openCards.map(k => {
                          if (k === 'split' && splitOn) {
                            const unitPre = splitMode === 'manual' ? '₹' : ''
                            const unitPost = splitMode === 'percentage' ? '%' : ''
                            const sq = newName.trim().toLowerCase()
                            const sugg = knownPeople.filter(p => !participants.some(x => x.name === p) && (!sq || p.toLowerCase().includes(sq))).slice(0, 3)
                            const balColor = isBalanced ? 'var(--good-ink)' : 'var(--bad-ink)'
                            return (
                              <SheetCard key={k} card="split" icon="call_split" title="Split expense" closeLabel="Remove split" onClose={() => toggleCard('split')}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, padding: 3, borderRadius: 12, background: 'var(--sunk)' }}>
                                  {([['equal', 'Equal'], ['percentage', 'Percent %'], ['manual', 'Manual ₹']] as const).map(([m, label]) => (
                                    <button key={m} type="button" onClick={() => changeSplitMode(m)} style={seg(splitMode === m, { height: 34 })}>{label}</button>
                                  ))}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, background: 'var(--sheet)' }}>
                                  <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-soft)', color: 'var(--brand-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flex: 'none' }}>You</span>
                                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--t1)' }}>Your share</span>
                                    <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: MONO, color: myShare > 0 ? 'var(--good-ink)' : 'var(--bad-ink)' }}>{R(myShare)} ({myPct}%)</span>
                                  </span>
                                  {splitMode !== 'equal' && participants.length > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 40, width: 100, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)', padding: '0 10px', flex: 'none' }}>
                                      <span style={{ fontFamily: MONO, fontSize: 13, color: 'var(--t3)' }}>{unitPre}</span>
                                      <NumInput value={myShareValue} aria-label="Your share" onChange={setMyShareValue}
                                        style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', fontFamily: MONO, fontSize: 16, textAlign: 'right', color: 'var(--t1)' }} />
                                      <span style={{ fontFamily: MONO, fontSize: 13, color: 'var(--t3)' }}>{unitPost}</span>
                                    </div>
                                  )}
                                </div>
                                {participants.map(p => {
                                  const sh = getParticipantAmount(p)
                                  const first = p.name.split(' ')[0]
                                  return (
                                    <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 12, border: '1px solid var(--line)' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={avatar(p.name)}>{p.name[0]?.toUpperCase()}</span>
                                        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                                        {splitMode === 'equal' ? (
                                          <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 500, color: 'var(--t1)' }}>{R(sh)}</span>
                                        ) : (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 40, width: 100, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sheet)', padding: '0 10px', flex: 'none' }}>
                                            <span style={{ fontFamily: MONO, fontSize: 13, color: 'var(--t3)' }}>{unitPre}</span>
                                            <NumInput value={p.value} aria-label={`${p.name}'s share`} onChange={v => updateParticipant(p.id, { value: v })}
                                              style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', fontFamily: MONO, fontSize: 16, textAlign: 'right', color: 'var(--t1)' }} />
                                            <span style={{ fontFamily: MONO, fontSize: 13, color: 'var(--t3)' }}>{unitPost}</span>
                                          </div>
                                        )}
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 10, background: 'var(--sunk)', flex: 'none' }}>
                                          <button type="button" onClick={() => updateParticipant(p.id, { kind: 'lent' })} style={seg(p.kind === 'lent', { height: 30, padding: '0 10px', fontSize: 12, borderRadius: 8 })}>Lent</button>
                                          <button type="button" onClick={() => updateParticipant(p.id, { kind: 'absorbed' })} style={seg(p.kind === 'absorbed', { height: 30, padding: '0 10px', fontSize: 12, borderRadius: 8 })}>Absorbed</button>
                                        </div>
                                        <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--t3)', lineHeight: 1.3 }}>{p.kind === 'lent' ? `${first} owes you ${R(sh)}` : `You cover ${R(sh)}`}</span>
                                        <button type="button" onClick={() => removeParticipant(p.id)} aria-label="Remove person" style={{ width: 36, height: 36, borderRadius: 10, border: 0, background: 'transparent', color: 'var(--t3)', cursor: 'pointer', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sym name="delete" size={19} /></button>
                                      </div>
                                    </div>
                                  )
                                })}
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <input value={newName} maxLength={60} onChange={e => setNewName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addParticipant(newName) } }}
                                    placeholder="Add person..." aria-label="Add person"
                                    style={{ ...textInput, ...(attempted && newName.trim() ? { borderColor: 'var(--bad)' } : {}) }} />
                                  <button type="button" onClick={() => addParticipant(newName)} style={darkBtn}>Add</button>
                                </div>
                                {sugg.length > 0 && (
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {sugg.map(p => (
                                      <button key={p} type="button" onClick={() => addParticipant(p)}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 10px 0 4px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--t1)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                        <span style={avatar(p, 26)}>{p[0]?.toUpperCase()}</span>{p.split(' ')[0]}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {participants.length > 0 && totalAmount > 0 && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
                                    <div style={{ height: 6, borderRadius: 3, background: 'var(--sunk)', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${Math.min(sumAssigned / totalAmount, 1) * 100}%`, background: isBalanced ? 'var(--good)' : splitRemaining < 0 ? 'var(--bad)' : 'var(--warn)', borderRadius: 3, transition: 'width .2s' }} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                                      <span style={{ fontWeight: 700, color: balColor }}>{isBalanced ? '✓ Balanced' : splitRemaining > 0 ? `${R(splitRemaining)} remaining` : `${R(-splitRemaining)} over`}</span>
                                      <span style={{ fontFamily: MONO, color: 'var(--t2)' }}>{R(sumAssigned)} / {R(totalAmount)}</span>
                                    </div>
                                  </div>
                                )}
                              </SheetCard>
                            )
                          }
                          if (k === 'settle' && isExp && (settleablePeople.length > 0 || settledPerson)) {
                            const options = [
                              { id: '', label: 'None — log as regular expense' },
                              ...settleablePeople.map(p => ({ id: p.person, label: `${p.person} · ${R(p.outstanding)} owed to you` })),
                              ...(settledPerson && !settleablePeople.some(p => p.person === settledPerson) ? [{ id: settledPerson, label: settledPerson }] : []),
                            ]
                            return (
                              <SheetCard key={k} card="settle" icon="handshake" title="Settle a debt" gap={8} onClose={() => toggleCard('settle')}>
                                {options.map(o => (
                                  <button key={o.id || 'none'} type="button" onClick={() => setSettledPerson(o.id)} role="radio" aria-checked={settledPerson === o.id}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '0 4px', border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                                    <span style={radio(settledPerson === o.id)} />
                                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}>{o.label}</span>
                                  </button>
                                ))}
                                {settledPerson && amt > 0 && (
                                  <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--good-soft)', color: 'var(--good-ink)', fontSize: 12.5, fontWeight: 600, lineHeight: 1.45 }}>
                                    {R(settleApplied)} will come off {settledPerson.split(' ')[0]}’s total balance
                                    {settleOutstanding > 0 && (settleApplied >= settleOutstanding ? ' · Fully settled ✓' : ` · ${R(settleOutstanding - settleApplied)} still owed`)}
                                    {amt > settleApplied && ` · remaining ${R(amt - settleApplied)} logged as a regular expense`}
                                  </div>
                                )}
                              </SheetCard>
                            )
                          }
                          if (k === 'tags' && !isTr && !isRefundEdit) {
                            const sugg = (settings?.customTags ?? []).filter(t => !tags.includes(t))
                            const addTag = () => { const t = tagQuery.trim().replace(/,$/, ''); if (t && !tags.includes(t)) setTags([...tags, t]); setTagQuery('') }
                            return (
                              <SheetCard key={k} card="tags" icon="sell" title="Tags" onClose={() => toggleCard('tags')}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                  {tags.map(t => (
                                    <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 34, padding: '0 6px 0 12px', borderRadius: 999, background: 'var(--t1)', color: 'var(--sheet)', fontSize: 13, fontWeight: 600 }}>
                                      {t}
                                      <button type="button" onClick={() => setTags(tags.filter(x => x !== t))} aria-label={`Remove ${t}`} style={{ width: 24, height: 24, border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', opacity: 0.7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sym name="close" size={16} /></button>
                                    </span>
                                  ))}
                                  <input value={tagQuery} maxLength={40} onChange={e => setTagQuery(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
                                    onBlur={addTag}
                                    placeholder="Add a tag, e.g. Christmas…" aria-label="Add a tag"
                                    style={{ flex: 1, minWidth: 140, height: 36, border: 0, outline: 0, background: 'transparent', fontSize: 16, color: 'var(--t1)' }} />
                                </div>
                                {sugg.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {sugg.map(t => (
                                      <button key={t} type="button" onClick={() => setTags([...tags, t])}
                                        style={{ height: 32, padding: '0 10px', borderRadius: 999, border: '1px dashed var(--line2)', background: 'transparent', color: 'var(--t2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>+ {t}</button>
                                    ))}
                                  </div>
                                )}
                              </SheetCard>
                            )
                          }
                          if (k === 'project' && (isExp || isSav) && projects.length > 0) {
                            return (
                              <SheetCard key={k} card="project" icon="folder" title="Link to project" onClose={() => toggleCard('project')}
                                badge={autoLinked && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'var(--info-soft)', color: 'var(--info-ink)', whiteSpace: 'nowrap', flex: 'none' }}>Auto-linked</span>}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {projects.map(p => (
                                    <button key={p.id} type="button" onClick={() => setProjectId(projectId === p.id ? '' : p.id)} aria-pressed={projectId === p.id} style={chip(projectId === p.id)}>{p.name}</button>
                                  ))}
                                </div>
                              </SheetCard>
                            )
                          }
                          if (k === 'repeat' && (isExp || isInc)) {
                            return (
                              <button key={k} type="button" role="switch" aria-checked={isRecurring} onClick={() => setIsRecurring(r => !r)}
                                style={{ marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, cursor: 'pointer', textAlign: 'left' }}>
                                <Sym name="event_repeat" style={{ color: 'var(--t2)' }} />
                                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>Repeat monthly</span>
                                  <span style={{ fontSize: 12.5, color: 'var(--t3)' }}>We’ll remind you to log this every month</span>
                                </span>
                                <Switch on={isRecurring} />
                              </button>
                            )
                          }
                          if (k === 'refunds' && editTx?.type === 'expense' && isExp) {
                            const rf = Number(refundAmount) || 0
                            const over = rf > remainingRefundable
                            const canLog = rf > 0 && !over && !addingRefund
                            return (
                              <SheetCard key={k} card="refunds" icon="undo" title="Refunds" gap={8}
                                action={!showRefundForm && remainingRefundable > 0 && (
                                  <button type="button" onClick={() => setShowRefundForm(true)} style={{ height: 34, padding: '0 12px', borderRadius: 10, border: 0, background: 'var(--sunk)', color: 'var(--t1)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>↺ Refund</button>
                                )}>
                                {existingRefunds.map(r => (
                                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, borderTop: '1px solid var(--line)' }}>
                                    <span style={{ flex: 1, fontSize: 13.5, color: 'var(--t1)' }}><span style={{ fontFamily: MONO, fontWeight: 600 }}>{R(r.amount)}</span> refunded on {format(parseISO(r.date), 'MMM d, yyyy')}</span>
                                    <button type="button" onClick={() => removeRefund(r.id)} style={{ height: 32, padding: '0 10px', borderRadius: 8, border: 0, background: 'transparent', color: 'var(--bad-ink)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Remove</button>
                                  </div>
                                ))}
                                {totalRefunded > 0 && (
                                  <div style={{ padding: '8px 0 0', borderTop: '1px solid var(--line)', fontSize: 13, color: 'var(--t2)', fontWeight: 600 }}>
                                    Refunded {R(totalRefunded)} · Net expense {R(Math.max(0, editTx.amount - totalRefunded))}
                                  </div>
                                )}
                                {existingRefunds.length === 0 && !showRefundForm && (
                                  <div style={{ fontSize: 12.5, color: 'var(--t3)' }}>No refunds logged against this expense.</div>
                                )}
                                {showRefundForm && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 14, background: 'var(--sheet)', marginTop: 4 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                        <span style={subLabelStyle}>Amount</span>
                                        <input value={refundAmount} onChange={e => setRefundAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" autoFocus
                                          style={field({ background: 'var(--card)', ...(over ? { borderColor: 'var(--bad)' } : {}) })} />
                                      </label>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                        <span style={subLabelStyle}>Date</span>
                                        <button type="button" onClick={() => openPicker(refundDateRef.current)}
                                          style={{ position: 'relative', height: 44, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card)', padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: 'var(--t1)', cursor: 'pointer' }}>
                                          <Sym name="calendar_month" size={17} style={{ color: 'var(--t3)' }} />{dateLabel(refundDate)}
                                          <input ref={refundDateRef} type="date" tabIndex={-1} aria-hidden value={refundDate}
                                            onChange={e => { if (e.target.value) setRefundDate(e.target.value) }}
                                            style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }} />
                                        </button>
                                      </div>
                                    </div>
                                    <input value={refundNotes} maxLength={200} onChange={e => setRefundNotes(e.target.value)} placeholder="Notes (optional)"
                                      style={{ height: 44, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card)', padding: '0 12px', fontSize: 16, color: 'var(--t1)', outline: 'none' }} />
                                    {over && <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--bad-ink)' }}>Refunds can’t exceed the {R(remainingRefundable)} left</span>}
                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                      <button type="button" onClick={() => { setShowRefundForm(false); setRefundAmount(''); setRefundNotes('') }} style={{ height: 40, padding: '0 14px', borderRadius: 12, border: 0, background: 'transparent', color: 'var(--t2)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                      <button type="button" onClick={logRefund} disabled={!canLog}
                                        style={{ height: 40, padding: '0 16px', borderRadius: 12, border: 0, background: canLog ? 'var(--t1)' : 'var(--sunk2)', color: canLog ? 'var(--sheet)' : 'var(--t3)', fontSize: 14, fontWeight: 700, cursor: canLog ? 'pointer' : 'default' }}>
                                        {addingRefund ? 'Logging…' : 'Log refund'}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </SheetCard>
                            )
                          }
                          return null
                        })}
                      </>
                    )}
                  </>
                )}
              </div>

              {showKeypad && <Keypad onPress={pressKey} />}

              {/* Footer: why Save is off, then Save */}
              <div style={{
                flex: 'none', display: 'flex', flexDirection: 'column', gap: 8,
                padding: isDesktop ? '12px 20px 14px' : kbdOpen ? '10px 16px 10px' : '10px 16px max(16px, env(safe-area-inset-bottom))',
                borderTop: showKeypad ? 0 : '1px solid var(--line)', background: showKeypad ? 'var(--sunk)' : 'var(--sheet)',
              }}>
                {block && (
                  <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: attempted ? 'var(--bad-ink)' : 'var(--t3)' }}>
                    <Sym name={attempted ? 'error' : 'info'} size={16} />{block.text}
                  </div>
                )}
                <button type="button" onClick={() => save()} aria-disabled={disabled}
                  style={{
                    height: 54, width: '100%', borderRadius: 16, border: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    fontSize: 16, fontWeight: 700, cursor: 'pointer', transition: 'background .2s',
                    ...(disabled
                      ? { background: 'var(--sunk2)', color: 'var(--t3)', boxShadow: 'none' }
                      : { background: 'var(--brand-grad)', color: '#fff', boxShadow: '0 8px 18px -8px var(--brand-glow), inset 0 1px 0 rgba(255,255,255,.22)' }),
                    ...(saving ? { opacity: 0.85, cursor: 'progress' } : {}),
                  }}>
                  {saving && <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,.35)', borderTopColor: '#fff', animation: 'gw-spin .7s linear infinite' }} />}
                  <span>{saveLabel}</span>
                  {!disabled && !saving && <span style={{ fontFamily: MONO, fontWeight: 500, opacity: 0.85 }}>{R(amt)}</span>}
                </button>
                {isDesktop && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 14, fontSize: 12, color: 'var(--t3)', fontWeight: 500 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Kbd>↵</Kbd>Save</span>
                    {!editTx && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Kbd>{isMac ? '⌘↵' : 'Ctrl ↵'}</Kbd>Save &amp; add another</span>}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Kbd>esc</Kbd>Close</span>
                  </div>
                )}
              </div>

              {/* Discard? */}
              {confirmDiscard && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(14,15,18,.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'gw-in .18s ease-out' }}>
                  <div role="alertdialog" aria-label="Discard this entry?" style={{ width: '100%', maxWidth: 320, background: 'var(--card)', borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: '0 20px 50px -12px rgba(0,0,0,.35)' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>Discard this entry?</div>
                    <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.45 }}>What you’ve entered won’t be saved.</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button type="button" autoFocus onClick={() => setConfirmDiscard(false)} style={{ flex: 1, height: 44, borderRadius: 12, border: 0, background: 'var(--sunk)', color: 'var(--t1)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Keep editing</button>
                      <button type="button" onClick={() => { setConfirmDiscard(false); onClose() }} style={{ flex: 1, height: 44, borderRadius: 12, border: 0, background: 'var(--bad)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Discard</button>
                    </div>
                  </div>
                </div>
              )}
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  )
}
