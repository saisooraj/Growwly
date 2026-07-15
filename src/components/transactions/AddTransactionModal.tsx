'use client'

import { Fragment, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, RefreshCw, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Split, UserPlus, Trash2, PiggyBank } from 'lucide-react'
import { IconMedal, IconCrane } from '@tabler/icons-react'
import { format, parseISO } from 'date-fns'
import { addTransaction, updateTransaction, updateProject, updateSavingsGoal, addBorrowing, updateBorrowing, setUserSettings, setEmergencyFund } from '@/lib/firestore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import { TRANSFER_KINDS, SAVINGS_VEHICLES, EMERGENCY_FUND_VEHICLE, isSavingsTransfer, buildMonthlySummary, EXPENSE_CATEGORIES, INCOME_CATEGORIES, computeProjectPaid, formatCurrencyFull } from '@/lib/utils'
import { getSavingsVehicleMeta } from '@/lib/categoryIcons'
import { useAppStore } from '@/store/appStore'
import CategoryPicker from '@/components/transactions/CategoryPicker'
import type { Transaction, TransactionType, TransferKind } from '@/types'
import toast from 'react-hot-toast'

type Tab = 'expense' | 'income' | 'transfer' | 'savings'
type SavingsKind = 'savings_contribution' | 'savings_withdrawal'

interface Props {
  open: boolean
  onClose: () => void
  editTx?: Transaction | null
  initialTab?: Tab
  initialSavingsVehicle?: string
}

type SplitMode = 'equal' | 'percentage' | 'manual'
type SplitKind = 'lent' | 'absorbed'

interface SplitParticipant {
  id: string
  name: string
  value: number   // amount (manual) | percentage (percentage) | ignored (equal)
  kind: SplitKind
}

const TYPE_TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'expense', label: 'Expense',  icon: <ArrowUpRight size={14} /> },
  { id: 'income',  label: 'Income',   icon: <ArrowDownLeft size={14} /> },
  { id: 'savings', label: 'Savings',  icon: <PiggyBank size={14} /> },
  { id: 'transfer',label: 'Transfer', icon: <ArrowLeftRight size={14} /> },
]

function savingsTabFor(tx?: Transaction | null): Tab {
  if (!tx) return 'expense'
  return isSavingsTransfer(tx) ? 'savings' : tx.type
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onChange(!on) }}
      style={{
        width: 36, height: 20, borderRadius: 999, flexShrink: 0, cursor: 'pointer',
        background: on ? 'var(--brand)' : 'var(--border-strong)',
        position: 'relative', transition: 'background .2s',
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: on ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: '#fff', transition: 'left .2s',
        boxShadow: '0 1px 3px rgba(0,0,0,.2)',
      }} />
    </div>
  )
}

export default function AddTransactionModal({ open, onClose, editTx, initialTab, initialSavingsVehicle }: Props) {
  const { user } = useAuth()
  const refresh = useRefreshData()
  const { projects, budgets, transactions, borrowings, contacts, settings, emergencyFund, savingsGoals, setSavingsGoals } = useAppStore()

  // Core fields
  const [activeTab, setActiveTab]       = useState<Tab>(savingsTabFor(editTx))
  const txType: TransactionType         = activeTab === 'savings' ? 'transfer' : activeTab
  const [transferKind, setTransferKind] = useState<TransferKind>(editTx?.transferKind ?? 'loan_repayment_received')
  const [savingsKind, setSavingsKind]   = useState<SavingsKind>(
    editTx?.transferKind === 'savings_withdrawal' || editTx?.transferKind === 'ef_withdrawal' ? 'savings_withdrawal' : 'savings_contribution'
  )
  const [savingsVehicle, setSavingsVehicle] = useState<string>(editTx?.savingsVehicle ?? EMERGENCY_FUND_VEHICLE)
  const [amount, setAmount]             = useState(editTx ? String(editTx.amount) : '')
  const [category, setCategory]         = useState<string>(editTx?.category ?? 'Food & Dining')
  const [date, setDate]                 = useState(editTx?.date ?? format(new Date(), 'yyyy-MM-dd'))
  const [notes, setNotes]               = useState(editTx?.notes ?? '')
  const [suggestedCat, setSuggestedCat] = useState<string | null>(null)
  const [projectId, setProjectId]       = useState(editTx?.projectId ?? '')
  const [isRecurring, setIsRecurring]   = useState(editTx?.isRecurring ?? false)
  const [saving, setSaving]             = useState(false)
  // Person name for loan transfers (auto-synced to borrowings)
  const [loanPerson, setLoanPerson]         = useState('')
  const [personDropdownOpen, setPersonDropdownOpen] = useState(false)
  const personInputRef = useRef<HTMLInputElement>(null)
  // Allocation plan: borrowingId → amount to apply (editable, defaults to greedy)
  const [allocation, setAllocation] = useState<Record<string, number>>({})

  // Split state
  const [splitEnabled, setSplitEnabled]   = useState(false)
  const [splitMode, setSplitMode]         = useState<SplitMode>('equal')
  const [participants, setParticipants]   = useState<SplitParticipant[]>([])
  const [newName, setNewName]             = useState('')

  // Unique known people from contacts + borrowings
  const knownPeople = Array.from(new Set([
    ...contacts.map(c => c.name),
    ...borrowings.map(b => b.person),
  ])).sort()

  const isRepaymentKind = transferKind === 'loan_repayment_received' || transferKind === 'loan_repayment_paid'
  const loanPersonTrimmed = loanPerson.trim()

  // Filtered dropdown options
  const filteredPeople = useMemo(() =>
    knownPeople.filter(p => p.toLowerCase().includes(loanPersonTrimmed.toLowerCase())),
    [knownPeople, loanPersonTrimmed]
  )
  const isNewPerson = !!loanPersonTrimmed && !knownPeople.some(p => p.toLowerCase() === loanPersonTrimmed.toLowerCase())

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
    const plan: Record<string, number> = {}
    for (const b of pendingForPerson) {
      if (remaining <= 0) break
      const outstanding = b.amount - b.repaidAmount
      const apply = Math.min(outstanding, remaining)
      if (apply > 0) { plan[b.id] = apply; remaining -= apply }
    }
    setAllocation(plan)
  }, [pendingForPerson, amount])

  const allocationTotal = useMemo(() =>
    Object.values(allocation).reduce((s, v) => s + (Number(v) || 0), 0),
    [allocation]
  )

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setActiveTab(editTx ? savingsTabFor(editTx) : (initialTab ?? 'expense'))
      setTransferKind(editTx?.transferKind ?? 'loan_repayment_received')
      setSavingsKind(editTx?.transferKind === 'savings_withdrawal' || editTx?.transferKind === 'ef_withdrawal' ? 'savings_withdrawal' : 'savings_contribution')
      setSavingsVehicle(editTx?.savingsVehicle ?? initialSavingsVehicle ?? EMERGENCY_FUND_VEHICLE)
      setAmount(editTx ? String(editTx.amount) : '')
      setCategory(editTx?.category ?? 'Food & Dining')
      setDate(editTx?.date ?? format(new Date(), 'yyyy-MM-dd'))
      setNotes(editTx?.notes ?? '')
      setProjectId(editTx?.projectId ?? '')
      setIsRecurring(editTx?.isRecurring ?? false)
      setSplitEnabled(false)
      setSplitMode('equal')
      setParticipants([])
      setNewName('')
      setLoanPerson('')
      setPersonDropdownOpen(false)
      setAllocation({})
    }
  }, [open, editTx])

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
    if (activeTab === 'savings' || txType === 'transfer') return
    if (notes.trim().length < 3) { setSuggestedCat(null); return }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/chat/categorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: notes.trim(), type: txType }),
        })
        const data = await res.json()
        if (data.category && data.category !== category) setSuggestedCat(data.category)
        else setSuggestedCat(null)
      } catch { /* silent */ }
    }, 600)
    return () => clearTimeout(timer)
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

  const myShare = (() => {
    if (!splitEnabled || participants.length === 0) return totalAmount
    if (splitMode === 'equal') {
      const n = participants.length
      return totalAmount - n * Math.floor(totalAmount / (n + 1))
    }
    if (splitMode === 'percentage') {
      const sumPct = participants.reduce((s, p) => s + p.value, 0)
      return Math.round(totalAmount * Math.max(0, 100 - sumPct) / 100)
    }
    const sumOthers = participants.reduce((s, p) => s + p.value, 0)
    return totalAmount - sumOthers
  })()

  const sumAssigned = participants.reduce((s, p) => s + getParticipantAmount(p), 0) + myShare
  const isBalanced = totalAmount > 0 && Math.abs(sumAssigned - totalAmount) < 1
  const myPct = totalAmount > 0 ? (myShare / totalAmount) * 100 : 0

  // ── Participant management ──────────────────────────────────────────────────

  function addParticipant(name: string) {
    if (!name.trim()) return
    const defaultValue = splitMode === 'percentage'
      ? Math.floor(100 / (participants.length + 2))
      : splitMode === 'manual'
      ? Math.floor(totalAmount / (participants.length + 2))
      : 0
    setParticipants(ps => [...ps, {
      id: Math.random().toString(36).slice(2),
      name: name.trim(),
      value: defaultValue,
      kind: 'lent',
    }])
    setNewName('')
  }

  function updateParticipant(id: string, changes: Partial<SplitParticipant>) {
    setParticipants(ps => ps.map(p => p.id === id ? { ...p, ...changes } : p))
  }

  function removeParticipant(id: string) {
    setParticipants(ps => ps.filter(p => p.id !== id))
  }

  // ── Budget alert ────────────────────────────────────────────────────────────

  function checkBudgetAlert(cat: string, addedAmount: number, d: string) {
    const month = d.slice(0, 7)
    const budget = budgets.find(b => b.month === month && b.category === cat)
    if (!budget || budget.planned === 0) return
    const summary = buildMonthlySummary(transactions, month)
    const alreadySpent = summary.byCategory[cat as keyof typeof summary.byCategory] ?? 0
    const newTotal = alreadySpent + addedAmount
    const pct = (newTotal / budget.planned) * 100
    if (pct >= 100)
      toast.error(`Over budget on ${cat}! ₹${Math.round(newTotal).toLocaleString('en-IN')} of ₹${budget.planned.toLocaleString('en-IN')}`, { duration: 5000 })
    else if (pct >= 80)
      toast(`${Math.round(pct)}% of ${cat} budget used`, { duration: 4000 })
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !amount || Number(amount) <= 0) return
    const pendingParticipant = splitEnabled && newName.trim()
      ? [{ id: 'tmp', name: newName.trim(), value: 0, kind: 'lent' as SplitKind }]
      : []
    const hasParticipants = splitEnabled && (participants.length + pendingParticipant.length) > 0
    if (hasParticipants && myShare <= 0) {
      toast.error('Your share must be greater than 0')
      return
    }

    setSaving(true)
    try {
      // Auto-add any participant whose name was typed but not yet confirmed via the Add button
      const finalParticipants: SplitParticipant[] = splitEnabled && newName.trim()
        ? [...participants, {
            id: Math.random().toString(36).slice(2),
            name: newName.trim(),
            value: splitMode === 'percentage'
              ? Math.floor(100 / (participants.length + 2))
              : splitMode === 'manual'
                ? Math.floor(totalAmount / (participants.length + 2))
                : 0,
            kind: 'lent' as SplitKind,
          }]
        : participants

      const effectiveAmount = splitEnabled && finalParticipants.length > 0
        ? (() => {
            if (splitMode === 'equal') {
              const n = finalParticipants.length
              return totalAmount - n * Math.floor(totalAmount / (n + 1))
            }
            if (splitMode === 'percentage') {
              const sumPct = finalParticipants.reduce((s, p) => s + p.value, 0)
              return Math.round(totalAmount * Math.max(0, 100 - sumPct) / 100)
            }
            return Math.max(0, totalAmount - finalParticipants.reduce((s, p) => s + p.value, 0))
          })()
        : Number(amount)

      const payload: Partial<Transaction> = {
        type: txType,
        amount: effectiveAmount,
        date,
        notes,
        isRecurring,
        ...(isRecurring ? { recurringDay: new Date(date).getDate() } : {}),
        ...(activeTab === 'savings'
          ? { transferKind: savingsKind, savingsVehicle, category: 'Other' }
          : txType === 'transfer'
            ? { transferKind, category: 'Other' }
            : { category }),
        ...(projectId && (txType === 'expense' || activeTab === 'savings') ? { projectId } : {}),
        ...(txType === 'transfer' && loanPerson.trim() ? { loanPerson: loanPerson.trim() } : {}),
      }

      // Collect affected project IDs upfront so we can recompute after refresh
      const affectedProjectIds = new Set<string>()
      if (txType === 'expense' || activeTab === 'savings') {
        if (editTx?.projectId) affectedProjectIds.add(editTx.projectId)
        if (projectId) affectedProjectIds.add(projectId)
      }

      if (editTx) {
        await updateTransaction(editTx.id, payload)
        toast.success('Transaction updated')
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
              const amt = Number(applyAmt)
              if (amt <= 0) continue
              const b = borrowings.find(x => x.id === bId)
              if (!b) continue
              const newRepaid = Math.min(b.repaidAmount + amt, b.amount)
              await updateBorrowing(bId, {
                repaidAmount: newRepaid,
                status: newRepaid >= b.amount ? 'repaid' : 'partial',
              })
            }
          }
        }

        // Split: create borrowings + absorbed transactions
        if (splitEnabled && finalParticipants.length > 0) {
          const n = finalParticipants.length
          for (const p of finalParticipants) {
            const pAmt = splitMode === 'equal'
              ? Math.floor(totalAmount / (n + 1))
              : splitMode === 'percentage'
                ? Math.round(totalAmount * p.value / 100)
                : p.value
            if (pAmt <= 0) continue
            if (p.kind === 'lent') {
              await addBorrowing(user.uid, {
                type: 'lent',
                amount: pAmt,
                person: p.name,
                description: notes ? `${notes} (split)` : `${category} (split)`,
                date,
                repaidAmount: 0,
                status: 'pending',
              })
            } else {
              await addTransaction(user.uid, {
                type: 'expense',
                amount: pAmt,
                category: 'Covered for Others',
                date,
                notes: `${p.name}'s share${notes ? ` · ${notes}` : ''}`,
                isRecurring: false,
              } as Omit<Transaction, 'id' | 'userId' | 'createdAt'>)
            }
          }
          const lentCount   = finalParticipants.filter(p => p.kind === 'lent').length
          const absorbCount = finalParticipants.filter(p => p.kind === 'absorbed').length
          const parts = []
          if (lentCount)   parts.push(`${lentCount} borrowing${lentCount > 1 ? 's' : ''} created`)
          if (absorbCount) parts.push(`${absorbCount} absorbed`)
          toast.success(`Split saved — ${parts.join(', ')}`)
        } else {
          toast.success(activeTab === 'savings' ? 'Savings logged' : txType === 'transfer' ? 'Transfer logged' : 'Transaction added')
          if (txType === 'expense') checkBudgetAlert(category, effectiveAmount, date)

          // Prompt to save custom category
          if (txType !== 'transfer') {
            const allStandard = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]
            const existing = settings?.customCategories ?? []
            if (!allStandard.includes(category) && !existing.includes(category) && category) {
              toast(t => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Save &ldquo;{category}&rdquo; as a category?</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={async () => {
                        toast.dismiss(t.id)
                        await setUserSettings(user.uid, { customCategories: [...existing, category] })
                        await refresh()
                        toast.success(`"${category}" saved`)
                      }}
                      style={{ flex: 1, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--brand)', color: '#fff', fontSize: 12, fontWeight: 600 }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => toast.dismiss(t.id)}
                      style={{ flex: 1, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 12 }}
                    >
                      Skip
                    </button>
                  </div>
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

      onClose()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const selectedKind = TRANSFER_KINDS.find(k => k.id === transferKind)
  const canSplit = txType === 'expense' && !editTx

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" style={{ position: 'relative', zIndex: 50 }} onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
        </Transition.Child>

        {/* ── Sheet wrapper ── */}
        <div style={{ position: 'fixed', inset: 0, overflowY: 'auto' }}>
          {/*
            Mobile  : flex-end  → sheet anchors to bottom, no side padding, flush edge
            Desktop : center    → centred modal with padding
          */}
          <div
            style={{ display: 'flex', minHeight: '100%', alignItems: 'flex-end', justifyContent: 'center' }}
            className="sm:items-center sm:p-4"
          >
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-full sm:translate-y-4 sm:opacity-0"
              enterTo="opacity-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-full sm:translate-y-4 sm:opacity-0"
            >
              <Dialog.Panel
                className="rounded-t-3xl sm:rounded-3xl"
                style={{
                  width: '100%', maxWidth: 440,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-lg)',
                  overflow: 'hidden',
                  display: 'flex', flexDirection: 'column',
                  maxHeight: '92dvh',
                }}
              >
                {/* Drag handle — mobile only */}
                <div className="sm:hidden" style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4, flexShrink: 0 }}>
                  <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--border-strong)', opacity: 0.6 }} />
                </div>

                {/* Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
                }}>
                  <Dialog.Title style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                    {editTx ? 'Edit Transaction' : 'Add Transaction'}
                  </Dialog.Title>
                  <button onClick={onClose} style={{ padding: 6, borderRadius: 8, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    <X size={16} />
                  </button>
                </div>

                <form id="add-tx-form" onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1 }}>

                  {/* Type tabs */}
                  <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--surface-2)' }}>
                    {TYPE_TABS.map(tab => (
                      <button key={tab.id} type="button" onClick={() => { setActiveTab(tab.id); setSplitEnabled(false) }}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          padding: '8px 6px', borderRadius: 9, border: 'none', cursor: 'pointer',
                          fontSize: 12, fontWeight: 500, minWidth: 0,
                          background: activeTab === tab.id ? 'var(--surface)' : 'transparent',
                          color: activeTab === tab.id
                            ? tab.id === 'expense' ? 'var(--bad-ink)' : tab.id === 'income' ? 'var(--good-ink)' : tab.id === 'savings' ? 'var(--brand-ink)' : 'var(--info-ink)'
                            : 'var(--text-3)',
                          boxShadow: activeTab === tab.id ? 'var(--shadow-sm)' : 'none',
                          transition: 'all .15s',
                        }}>
                        {tab.icon}{tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Transfer kind */}
                  {activeTab === 'transfer' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label className="label">Transfer type</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {TRANSFER_KINDS.map(k => (
                          <button key={k.id} type="button" onClick={() => setTransferKind(k.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '10px 14px', borderRadius: 10,
                              border: `1px solid ${transferKind === k.id ? 'var(--brand)' : 'var(--border)'}`,
                              background: transferKind === k.id ? 'var(--brand-soft)' : 'var(--surface)',
                              cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                            }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                              background: transferKind === k.id ? 'var(--brand)' : 'var(--surface-2)',
                              color: transferKind === k.id ? '#fff' : 'var(--text-3)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {k.dir === 'in' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: transferKind === k.id ? 'var(--brand-ink)' : 'var(--text)' }}>{k.label}</div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>{k.sub}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Person combobox — shown for all loan transfer types */}
                  {activeTab === 'transfer' && ['loan_given', 'loan_repayment_received', 'loan_repayment_paid'].includes(transferKind) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
                        <label className="label">
                          {transferKind === 'loan_given' ? 'Who are you lending to?' :
                           transferKind === 'loan_repayment_received' ? 'Who paid you back?' :
                           'Who are you repaying?'}
                        </label>
                        <input
                          ref={personInputRef}
                          type="text"
                          className="input"
                          placeholder="Search or add a person…"
                          value={loanPerson}
                          onChange={e => { setLoanPerson(e.target.value); setPersonDropdownOpen(true) }}
                          onFocus={() => setPersonDropdownOpen(true)}
                          onBlur={() => setTimeout(() => setPersonDropdownOpen(false), 150)}
                          autoComplete="off"
                          style={{ fontSize: 14 }}
                        />
                        {/* Dropdown */}
                        {personDropdownOpen && (filteredPeople.length > 0 || (loanPersonTrimmed && isNewPerson)) && (
                          <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60,
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: 12, overflow: 'hidden',
                            boxShadow: '0 8px 24px rgba(0,0,0,.18)',
                            marginTop: 4,
                          }}>
                            {filteredPeople.map(p => (
                              <button
                                key={p} type="button"
                                onMouseDown={() => { setLoanPerson(p); setPersonDropdownOpen(false) }}
                                style={{
                                  width: '100%', textAlign: 'left', padding: '10px 14px',
                                  background: 'transparent', border: 'none', cursor: 'pointer',
                                  fontSize: 13.5, color: 'var(--text)', display: 'flex',
                                  alignItems: 'center', gap: 8,
                                  borderBottom: '1px solid var(--border)',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              >
                                <span style={{
                                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                  background: 'var(--brand-soft)', color: 'var(--brand-ink)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 12, fontWeight: 800,
                                }}>
                                  {p[0]?.toUpperCase()}
                                </span>
                                {p}
                              </button>
                            ))}
                            {loanPersonTrimmed && isNewPerson && (
                              <button
                                type="button"
                                onMouseDown={() => { setPersonDropdownOpen(false) }}
                                style={{
                                  width: '100%', textAlign: 'left', padding: '10px 14px',
                                  background: 'transparent', border: 'none', cursor: 'pointer',
                                  fontSize: 13.5, color: 'var(--brand-ink)', display: 'flex',
                                  alignItems: 'center', gap: 8, fontWeight: 600,
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--brand-soft)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              >
                                <span style={{
                                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                  background: 'var(--brand-soft)', color: 'var(--brand-ink)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 16, fontWeight: 800,
                                }}>+</span>
                                Add &ldquo;{loanPersonTrimmed}&rdquo;
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Status chip */}
                      {loanPersonTrimmed && !isNewPerson && (
                        <div style={{
                          fontSize: 11.5, color: 'var(--brand-ink)',
                          padding: '4px 8px', borderRadius: 7, background: 'var(--brand-soft)',
                          alignSelf: 'flex-start',
                        }}>
                          ✓ Linked to existing borrowing record
                        </div>
                      )}
                      {loanPersonTrimmed && isNewPerson && isRepaymentKind && (
                        <div style={{
                          fontSize: 11.5, color: 'var(--warn-ink, #b45309)',
                          padding: '4px 8px', borderRadius: 7, background: 'var(--warn-soft, #fef3c7)',
                          alignSelf: 'flex-start',
                        }}>
                          No open records for {loanPersonTrimmed} — transaction will still be logged
                        </div>
                      )}

                      {/* Allocation preview — shown when person is known + amount set + pending records exist */}
                      {isRepaymentKind && loanPersonTrimmed && !isNewPerson && pendingForPerson.length > 0 && Number(amount) > 0 && (
                        <div style={{
                          background: 'var(--surface-2)', borderRadius: 12,
                          padding: '10px 12px', border: '1px solid var(--border)',
                          display: 'flex', flexDirection: 'column', gap: 0,
                        }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-4)', letterSpacing: '0.05em', marginBottom: 8 }}>
                            WILL SETTLE
                          </div>
                          {pendingForPerson.map(b => {
                            const outstanding = b.amount - b.repaidAmount
                            const applied = Number(allocation[b.id] ?? 0)
                            const untouched = applied === 0
                            return (
                              <div key={b.id} style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '6px 0',
                                borderBottom: '1px solid var(--border)',
                              }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12.5, color: untouched ? 'var(--text-4)' : 'var(--text)', fontWeight: 500, lineHeight: 1.2 }}>
                                    {b.description || 'Loan'} · {format(parseISO(b.date), 'dd MMM yy')}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 1 }}>
                                    {formatCurrencyFull(outstanding)} outstanding
                                  </div>
                                </div>
                                {untouched ? (
                                  <span style={{ fontSize: 11, color: 'var(--text-4)', padding: '3px 8px', borderRadius: 6, background: 'var(--surface-3)', flexShrink: 0 }}>
                                    Untouched
                                  </span>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>₹</span>
                                    <input
                                      type="number"
                                      min={0}
                                      max={outstanding}
                                      value={applied}
                                      onChange={e => setAllocation(prev => ({ ...prev, [b.id]: Number(e.target.value) }))}
                                      style={{
                                        width: 70, fontSize: 13, fontWeight: 700,
                                        color: 'var(--good-ink)', background: 'var(--surface)',
                                        border: '1px solid var(--border)', borderRadius: 7,
                                        padding: '3px 6px', textAlign: 'right',
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                          {/* Total vs amount */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
                            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                              {allocationTotal !== Number(amount)
                                ? <span style={{ color: allocationTotal > Number(amount) ? 'var(--bad-ink)' : 'var(--text-4)' }}>
                                    {formatCurrencyFull(Math.abs(Number(amount) - allocationTotal))}{' '}
                                    {allocationTotal > Number(amount) ? 'over-allocated' : 'unallocated'}
                                  </span>
                                : <span style={{ color: 'var(--good-ink)' }}>Fully allocated ✓</span>
                              }
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>
                              {formatCurrencyFull(allocationTotal)} / {formatCurrencyFull(Number(amount))}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Savings: direction + vehicle */}
                  {activeTab === 'savings' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {/* Direction toggle */}
                      <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 10, background: 'var(--surface-2)' }}>
                        {([
                          { id: 'savings_contribution' as const, label: 'Contribute', sub: 'Into savings', icon: <ArrowUpRight size={13} /> },
                          { id: 'savings_withdrawal' as const,   label: 'Withdraw',   sub: 'Back to cash', icon: <ArrowDownLeft size={13} /> },
                        ]).map(d => (
                          <button key={d.id} type="button" onClick={() => setSavingsKind(d.id)}
                            style={{
                              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                              padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                              background: savingsKind === d.id ? 'var(--surface)' : 'transparent',
                              color: savingsKind === d.id ? (d.id === 'savings_withdrawal' ? 'var(--good-ink)' : 'var(--text)') : 'var(--text-3)',
                              boxShadow: savingsKind === d.id ? 'var(--shadow-sm)' : 'none',
                              transition: 'all .15s',
                            }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 500 }}>{d.icon}{d.label}</span>
                            <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{d.sub}</span>
                          </button>
                        ))}
                      </div>

                      {/* Vehicle picker */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label className="label">Savings vehicle</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                          {[...SAVINGS_VEHICLES, ...(settings?.customSavingsVehicles ?? []).filter(v => !SAVINGS_VEHICLES.includes(v))].map(v => {
                            const meta = getSavingsVehicleMeta(v)
                            const active = savingsVehicle === v
                            return (
                              <button key={v} type="button" onClick={() => setSavingsVehicle(v)}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 6,
                                  padding: '5px 11px', borderRadius: 20,
                                  border: `1.5px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
                                  background: active ? 'var(--brand-soft)' : 'var(--surface-2)',
                                  color: active ? 'var(--brand-ink)' : 'var(--text-2)',
                                  fontSize: 12.5, fontWeight: 500, cursor: 'pointer', transition: 'all .12s', whiteSpace: 'nowrap',
                                }}>
                                <meta.Icon size={13} color={active ? 'var(--brand-ink)' : meta.color} stroke={1.5} />
                                {v}
                              </button>
                            )
                          })}
                        </div>
                        <input
                          type="text"
                          className="input"
                          style={{ fontSize: 13, marginTop: 2 }}
                          placeholder="Or type a custom vehicle (e.g. Crypto, REIT)…"
                          value={SAVINGS_VEHICLES.includes(savingsVehicle) || (settings?.customSavingsVehicles ?? []).includes(savingsVehicle) ? '' : savingsVehicle}
                          onChange={e => setSavingsVehicle(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Amount */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label className="label" style={{ margin: 0 }}>Amount (₹)</label>
                      {canSplit && (
                        <button
                          type="button"
                          onClick={() => setSplitEnabled(v => !v)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                            background: splitEnabled ? 'var(--brand)' : 'var(--surface-2)',
                            color: splitEnabled ? '#fff' : 'var(--text-3)',
                            border: `1px solid ${splitEnabled ? 'var(--brand)' : 'var(--border)'}`,
                            cursor: 'pointer', transition: 'all .15s',
                          }}
                        >
                          <Split size={11} />
                          {splitEnabled ? 'Splitting' : 'Split'}
                        </button>
                      )}
                    </div>
                    <input
                      type="number" step="0.01" min="0" placeholder="0"
                      className="input" style={{ fontSize: 18, fontWeight: 600 }}
                      value={amount} onChange={e => setAmount(e.target.value)} required
                    />
                  </div>

                  {/* ── Split Panel — shown when Split button in amount row is active ── */}
                  {canSplit && splitEnabled && (
                    <div style={{
                      borderRadius: 12,
                      border: '1px solid var(--brand)',
                      display: 'flex',
                      flexDirection: 'column',
                    }}>
                      {/* Panel header */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 14px',
                        background: 'var(--brand-soft)',
                        borderRadius: '12px 12px 0 0',
                      }}>
                        <Split size={13} style={{ color: 'var(--brand)', flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--brand-ink)' }}>
                          Split expense
                        </span>
                        <button type="button" onClick={() => { setSplitEnabled(false); setParticipants([]) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-ink)', display: 'flex', padding: 2, opacity: 0.7 }}>
                          <X size={13} />
                        </button>
                      </div>

                      {/* Split content */}
                      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                          {/* Mode selector */}
                          <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 9, background: 'var(--surface-3)' }}>
                            {(['equal', 'percentage', 'manual'] as SplitMode[]).map(m => (
                              <button key={m} type="button" onClick={() => setSplitMode(m)}
                                style={{
                                  flex: 1, padding: '5px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                                  fontSize: 11.5, fontWeight: 500, transition: 'all .15s',
                                  background: splitMode === m ? 'var(--surface)' : 'transparent',
                                  color: splitMode === m ? 'var(--text)' : 'var(--text-3)',
                                  boxShadow: splitMode === m ? 'var(--shadow-sm)' : 'none',
                                }}>
                                {m === 'equal' ? 'Equal' : m === 'percentage' ? 'Percent %' : 'Manual ₹'}
                              </button>
                            ))}
                          </div>

                          {/* Your share summary */}
                          {participants.length > 0 && (
                            <div style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '10px 12px', borderRadius: 10,
                              background: myShare > 0 ? 'var(--good-soft)' : 'var(--bad-soft)',
                            }}>
                              <span style={{ fontSize: 12, color: myShare > 0 ? 'var(--good-ink)' : 'var(--bad-ink)', fontWeight: 500 }}>
                                Your share
                              </span>
                              <span style={{ fontSize: 15, fontWeight: 700, color: myShare > 0 ? 'var(--good-ink)' : 'var(--bad-ink)' }}>
                                ₹{myShare.toLocaleString('en-IN')}
                                {splitMode === 'percentage' && totalAmount > 0 && (
                                  <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 6 }}>
                                    ({myPct.toFixed(0)}%)
                                  </span>
                                )}
                              </span>
                            </div>
                          )}

                          {/* Participants */}
                          {participants.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {participants.map(p => (
                                <div key={p.id} style={{
                                  display: 'flex', alignItems: 'center', gap: 6,
                                  padding: '8px 10px', borderRadius: 10,
                                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                                }}>
                                  {/* Name */}
                                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {p.name}
                                  </span>

                                  {/* Value input (percentage or manual) */}
                                  {splitMode !== 'equal' && (
                                    <input
                                      type="number" min="0"
                                      max={splitMode === 'percentage' ? 100 : undefined}
                                      step={splitMode === 'percentage' ? 1 : 0.01}
                                      value={p.value || ''}
                                      onChange={e => updateParticipant(p.id, { value: Number(e.target.value) })}
                                      style={{
                                        width: 70, padding: '4px 8px', borderRadius: 7,
                                        border: '1px solid var(--border)', background: 'var(--surface)',
                                        fontSize: 12, color: 'var(--text)', outline: 'none', textAlign: 'right',
                                      }}
                                      placeholder={splitMode === 'percentage' ? '%' : '₹'}
                                    />
                                  )}

                                  {/* Amount preview for equal mode */}
                                  {splitMode === 'equal' && (
                                    <span style={{ fontSize: 12, color: 'var(--text-2)', minWidth: 52, textAlign: 'right' }}>
                                      ₹{getParticipantAmount(p).toLocaleString('en-IN')}
                                    </span>
                                  )}

                                  {/* Lent / Absorbed toggle */}
                                  <div style={{ display: 'flex', borderRadius: 7, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
                                    {(['lent', 'absorbed'] as SplitKind[]).map(k => (
                                      <button key={k} type="button"
                                        onClick={() => updateParticipant(p.id, { kind: k })}
                                        style={{
                                          padding: '3px 8px', fontSize: 11, fontWeight: 500, border: 'none', cursor: 'pointer',
                                          background: p.kind === k
                                            ? k === 'lent' ? 'var(--warn)' : 'var(--text-3)'
                                            : 'transparent',
                                          color: p.kind === k ? '#fff' : 'var(--text-3)',
                                          transition: 'all .15s',
                                        }}>
                                        {k === 'lent' ? 'Lent' : 'Absorbed'}
                                      </button>
                                    ))}
                                  </div>

                                  {/* Remove */}
                                  <button type="button" onClick={() => removeParticipant(p.id)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 2, display: 'flex', flexShrink: 0 }}
                                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--bad)')}
                                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-4)')}>
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add person */}
                          <div style={{ display: 'flex', gap: 6 }}>
                            <div style={{ flex: 1, position: 'relative' }}>
                              <input
                                type="text"
                                list="split-people"
                                placeholder="Add person..."
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addParticipant(newName) } }}
                                style={{
                                  width: '100%', padding: '7px 10px', borderRadius: 9,
                                  border: '1px solid var(--border)', background: 'var(--surface)',
                                  fontSize: 13, color: 'var(--text)', outline: 'none',
                                }}
                              />
                              <datalist id="split-people">
                                {knownPeople
                                  .filter(n => !participants.some(p => p.name === n))
                                  .map(n => <option key={n} value={n} />)}
                              </datalist>
                            </div>
                            <button
                              type="button"
                              onClick={() => addParticipant(newName)}
                              disabled={!newName.trim()}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '7px 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
                                background: newName.trim() ? 'var(--brand)' : 'var(--surface-2)',
                                color: newName.trim() ? '#fff' : 'var(--text-3)',
                                fontSize: 12, fontWeight: 500, flexShrink: 0, transition: 'all .15s',
                              }}>
                              <UserPlus size={13} /> Add
                            </button>
                          </div>

                          {/* Balance bar */}
                          {participants.length > 0 && totalAmount > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ height: 4, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%', borderRadius: 999, transition: 'width .2s',
                                  background: isBalanced ? 'var(--good)' : 'var(--warn)',
                                  width: `${Math.min((sumAssigned / totalAmount) * 100, 100)}%`,
                                }} />
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
                                <span style={{ color: isBalanced ? 'var(--good-ink)' : 'var(--warn-ink)' }}>
                                  {isBalanced ? '✓ Balanced' : `₹${Math.abs(sumAssigned - totalAmount).toLocaleString('en-IN')} ${sumAssigned > totalAmount ? 'over' : 'remaining'}`}
                                </span>
                                <span style={{ color: 'var(--text-4)' }}>
                                  ₹{sumAssigned.toLocaleString('en-IN')} / ₹{totalAmount.toLocaleString('en-IN')}
                                </span>
                              </div>
                            </div>
                          )}

                        </div>
                    </div>
                  )}
                  {/* ── End Split Panel ──────────────────────────────────── */}

                  {/* Description — moved above category so suggestion chip is immediately visible */}
                  <div>
                    <label className="label">
                      {activeTab === 'savings' ? 'Note' : txType === 'transfer' ? 'Who / what for' : 'Description'}
                    </label>
                    <input
                      type="text"
                      placeholder={
                        activeTab === 'savings'
                          ? 'e.g. Monthly SIP, bonus into FD…'
                          : txType === 'transfer'
                            ? selectedKind?.dir === 'in' ? 'e.g. Rahul paid back' : 'e.g. Lent to Priya'
                            : 'e.g. Domino\'s pizza — we\'ll suggest a category'
                      }
                      className="input" value={notes} onChange={e => setNotes(e.target.value)}
                    />
                  </div>

                  {/* Category */}
                  {txType !== 'transfer' && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <label className="label" style={{ margin: 0 }}>Category</label>
                        {suggestedCat && (
                          <button
                            type="button"
                            onClick={() => { setCategory(suggestedCat); setSuggestedCat(null) }}
                            style={{
                              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                              background: 'var(--brand-soft)', color: 'var(--brand-ink)',
                              border: '1px solid color-mix(in oklch, var(--brand) 30%, transparent)',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            ✦ Use &ldquo;{suggestedCat}&rdquo;
                          </button>
                        )}
                      </div>
                      <CategoryPicker value={category} onChange={v => { setCategory(v); setSuggestedCat(null) }} type={txType === 'income' ? 'income' : 'expense'} />
                    </div>
                  )}

                  {/* Date */}
                  <div>
                    <label className="label">Date</label>
                    <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} required />
                  </div>

                  {/* Project */}
                  {(txType === 'expense' || activeTab === 'savings') && projects.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <label className="label" style={{ margin: 0 }}>Link to Project (optional)</label>
                        {txType === 'expense' && (category === 'Gold' || category === 'Construction') && projectId && (
                          <span style={{ fontSize: 10.5, color: 'var(--brand-ink)', fontWeight: 500 }}>
                            Auto-linked {category === 'Gold' ? <IconMedal size={12} stroke={1.5} /> : <IconCrane size={12} stroke={1.5} />}
                          </span>
                        )}
                      </div>
                      <select className="input" value={projectId} onChange={e => setProjectId(e.target.value)}>
                        <option value="">None</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Recurring */}
                  {txType !== 'transfer' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, cursor: 'pointer', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                      <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} style={{ display: 'none' }} />
                      <Toggle on={isRecurring} onChange={setIsRecurring} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <RefreshCw size={12} style={{ color: 'var(--brand)' }} />
                          Repeat monthly
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>We&apos;ll remind you to log this every month</div>
                      </div>
                    </label>
                  )}

                  {/* Transfer note */}
                  {activeTab === 'transfer' && (
                    <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--info-soft)', border: '1px solid transparent' }}>
                      <p style={{ fontSize: 12, color: 'var(--info-ink)', lineHeight: 1.5 }}>
                        Transfers are <strong>excluded from income and expense totals</strong> — they won&apos;t affect your savings rate, health score, or budget tracking.
                      </p>
                    </div>
                  )}

                </form>

                {/* Fixed footer — outside the scrollable form so it always stays at the bottom */}
                <div style={{
                  flexShrink: 0,
                  padding: '12px 20px 20px',
                  borderTop: '1px solid var(--border)',
                  background: 'var(--surface)',
                }}>
                  <button
                    type="submit"
                    form="add-tx-form"
                    disabled={saving || !amount || Number(amount) <= 0}
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 14, opacity: saving ? 0.6 : 1 }}
                  >
                    {saving ? 'Saving...' : editTx ? 'Update'
                      : splitEnabled && participants.length > 0
                        ? `Save & Split (${participants.length + 1} records)`
                        : activeTab === 'savings' ? (savingsKind === 'savings_withdrawal' ? 'Withdraw from Savings' : 'Add to Savings')
                        : txType === 'transfer' ? 'Log Transfer' : 'Add Transaction'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
