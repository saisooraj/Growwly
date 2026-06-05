'use client'

import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, RefreshCw, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react'
import { format } from 'date-fns'
import { addTransaction, updateTransaction, updateProject } from '@/lib/firestore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import {
  TRANSFER_KINDS,
  buildMonthlySummary,
} from '@/lib/utils'
import { useAppStore } from '@/store/appStore'
import CategoryPicker from '@/components/transactions/CategoryPicker'
import type { Transaction, TransactionType, TransferKind } from '@/types'
import toast from 'react-hot-toast'

interface Props {
  open: boolean
  onClose: () => void
  editTx?: Transaction | null
}

const TYPE_TABS: { id: TransactionType; label: string; icon: React.ReactNode }[] = [
  { id: 'expense', label: 'Expense',  icon: <ArrowUpRight size={14} /> },
  { id: 'income',  label: 'Income',   icon: <ArrowDownLeft size={14} /> },
  { id: 'transfer',label: 'Transfer', icon: <ArrowLeftRight size={14} /> },
]

export default function AddTransactionModal({ open, onClose, editTx }: Props) {
  const { user } = useAuth()
  const refresh = useRefreshData()
  const { projects, budgets, transactions } = useAppStore()

  const [txType, setTxType]           = useState<TransactionType>(editTx?.type ?? 'expense')
  const [transferKind, setTransferKind] = useState<TransferKind>(editTx?.transferKind ?? 'loan_repayment_received')
  const [amount, setAmount]           = useState(editTx ? String(editTx.amount) : '')
  const [category, setCategory]       = useState<string>(editTx?.category ?? 'Food & Dining')
  const [date, setDate]               = useState(editTx?.date ?? format(new Date(), 'yyyy-MM-dd'))
  const [notes, setNotes]             = useState(editTx?.notes ?? '')
  const [projectId, setProjectId]     = useState(editTx?.projectId ?? '')
  const [isRecurring, setIsRecurring] = useState(editTx?.isRecurring ?? false)
  const [saving, setSaving]           = useState(false)

  // Reset when editTx changes or modal opens
  useEffect(() => {
    if (open) {
      setTxType(editTx?.type ?? 'expense')
      setTransferKind(editTx?.transferKind ?? 'loan_repayment_received')
      setAmount(editTx ? String(editTx.amount) : '')
      setCategory(editTx?.category ?? 'Food & Dining')
      setDate(editTx?.date ?? format(new Date(), 'yyyy-MM-dd'))
      setNotes(editTx?.notes ?? '')
      setProjectId(editTx?.projectId ?? '')
      setIsRecurring(editTx?.isRecurring ?? false)
    }
  }, [open, editTx])

  // Auto-link certain categories → matching project (new transactions only)
  useEffect(() => {
    if (txType !== 'expense' || editTx) return
    const rules: Record<string, string[]> = {
      'Gold':         ['gold', 'wedding'],
      'Construction': ['construction', 'house'],
    }
    const keywords = rules[category]
    if (keywords) {
      const match = projects.find(p =>
        keywords.some(kw => p.name.toLowerCase().includes(kw))
      )
      if (match) setProjectId(match.id)
    }
  }, [category, txType]) // eslint-disable-line react-hooks/exhaustive-deps

  function checkBudgetAlert(cat: string, addedAmount: number, d: string) {
    const month = d.slice(0, 7)
    const budget = budgets.find(b => b.month === month && b.category === cat)
    if (!budget || budget.planned === 0) return
    const summary = buildMonthlySummary(transactions, month)
    const alreadySpent = summary.byCategory[cat as keyof typeof summary.byCategory] ?? 0
    const newTotal = alreadySpent + addedAmount
    const pct = (newTotal / budget.planned) * 100
    if (pct >= 100) {
      toast.error(`Over budget on ${cat}! ₹${Math.round(newTotal).toLocaleString('en-IN')} of ₹${budget.planned.toLocaleString('en-IN')}`, { duration: 5000 })
    } else if (pct >= 80) {
      toast(`${Math.round(pct)}% of ${cat} budget used`, { duration: 4000 })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !amount || Number(amount) <= 0) return
    setSaving(true)
    try {
      const payload: Partial<Transaction> = {
        type: txType,
        amount: Number(amount),
        date,
        notes,
        isRecurring,
        ...(isRecurring ? { recurringDay: new Date(date).getDate() } : {}),
        ...(txType === 'transfer'
          ? { transferKind, category: 'Other' }
          : { category }),
        ...(projectId && txType === 'expense' ? { projectId } : {}),
      }

      if (editTx) {
        await updateTransaction(editTx.id, payload)
        // Sync project.paid: adjust for amount/project changes
        if (txType === 'expense') {
          const oldProjId = editTx.projectId
          const newProjId = projectId || undefined
          const oldAmt = editTx.amount
          const newAmt = Number(amount)
          if (oldProjId && oldProjId !== newProjId) {
            const oldProj = projects.find(p => p.id === oldProjId)
            if (oldProj) await updateProject(oldProjId, { paid: Math.max(0, oldProj.paid - oldAmt) })
          }
          if (newProjId) {
            const proj = projects.find(p => p.id === newProjId)
            if (proj) {
              const adjusted = oldProjId === newProjId ? proj.paid - oldAmt + newAmt : proj.paid + newAmt
              await updateProject(newProjId, { paid: Math.max(0, adjusted) })
            }
          }
        }
        toast.success('Transaction updated')
      } else {
        await addTransaction(user.uid, payload as Omit<Transaction, 'id' | 'userId' | 'createdAt'>)
        // Sync project.paid for new expense linked to a project
        if (txType === 'expense' && projectId) {
          const proj = projects.find(p => p.id === projectId)
          if (proj) await updateProject(projectId, { paid: proj.paid + Number(amount) })
        }
        toast.success(txType === 'transfer' ? 'Transfer logged' : 'Transaction added')
        if (txType === 'expense') checkBudgetAlert(category, Number(amount), date)
      }
      await refresh()
      onClose()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const selectedKind = TRANSFER_KINDS.find(k => k.id === transferKind)

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

        <div style={{ position: 'fixed', inset: 0, overflowY: 'auto' }}>
          <div style={{ display: 'flex', minHeight: '100%', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}
               className="sm:items-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-4"
              enterTo="opacity-100 translate-y-0"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-4"
            >
              <Dialog.Panel style={{
                width: '100%', maxWidth: 440,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden',
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <Dialog.Title style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                    {editTx ? 'Edit Transaction' : 'Add Transaction'}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    style={{ padding: 6, borderRadius: 8, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Type tabs */}
                  <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 12, background: 'var(--surface-2)' }}>
                    {TYPE_TABS.map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setTxType(tab.id)}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          padding: '8px 10px', borderRadius: 9, border: 'none', cursor: 'pointer',
                          fontSize: 13, fontWeight: 500,
                          background: txType === tab.id ? 'var(--surface)' : 'transparent',
                          color: txType === tab.id
                            ? tab.id === 'expense' ? 'var(--bad-ink)'
                            : tab.id === 'income'  ? 'var(--good-ink)'
                            : 'var(--info-ink)'
                            : 'var(--text-3)',
                          boxShadow: txType === tab.id ? 'var(--shadow-sm)' : 'none',
                          transition: 'all .15s',
                        }}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Transfer kind selector */}
                  {txType === 'transfer' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label className="label">Transfer type</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {TRANSFER_KINDS.map(k => (
                          <button
                            key={k.id}
                            type="button"
                            onClick={() => setTransferKind(k.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '10px 14px', borderRadius: 10,
                              border: `1px solid ${transferKind === k.id ? 'var(--brand)' : 'var(--border)'}`,
                              background: transferKind === k.id ? 'var(--brand-soft)' : 'var(--surface)',
                              cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                            }}
                          >
                            <div style={{
                              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                              background: transferKind === k.id ? 'var(--brand)' : 'var(--surface-2)',
                              color: transferKind === k.id ? '#fff' : 'var(--text-3)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {k.dir === 'in'
                                ? <ArrowDownLeft size={15} />
                                : <ArrowUpRight size={15} />
                              }
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: transferKind === k.id ? 'var(--brand-ink)' : 'var(--text)' }}>
                                {k.label}
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>{k.sub}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Amount */}
                  <div>
                    <label className="label">Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0"
                      className="input"
                      style={{ fontSize: 18, fontWeight: 600 }}
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      required
                    />
                  </div>

                  {/* Category (income/expense only) */}
                  {txType !== 'transfer' && (
                    <div>
                      <label className="label">Category</label>
                      <CategoryPicker
                        value={category}
                        onChange={setCategory}
                        type={txType === 'income' ? 'income' : 'expense'}
                      />
                    </div>
                  )}

                  {/* Date */}
                  <div>
                    <label className="label">Date</label>
                    <input
                      type="date"
                      className="input"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      required
                    />
                  </div>

                  {/* Project (expense only) */}
                  {txType === 'expense' && projects.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <label className="label" style={{ margin: 0 }}>Link to Project (optional)</label>
                        {(category === 'Gold' || category === 'Construction') && projectId && (
                          <span style={{ fontSize: 10.5, color: 'var(--brand-ink)', fontWeight: 500 }}>
                            Auto-linked {category === 'Gold' ? '🥇' : '🏗️'}
                          </span>
                        )}
                      </div>
                      <select
                        className="input"
                        value={projectId}
                        onChange={e => setProjectId(e.target.value)}
                      >
                        <option value="">None</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="label">
                      {txType === 'transfer' ? 'Who / what for' : 'Notes'}
                    </label>
                    <input
                      type="text"
                      placeholder={
                        txType === 'transfer'
                          ? selectedKind?.dir === 'in' ? 'e.g. Rahul paid back' : 'e.g. Lent to Priya'
                          : 'Optional note...'
                      }
                      className="input"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>

                  {/* Recurring (income/expense only) */}
                  {txType !== 'transfer' && (
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: 12, borderRadius: 10, cursor: 'pointer',
                      background: 'var(--surface-2)', border: '1px solid var(--border)',
                    }}>
                      <input
                        type="checkbox"
                        checked={isRecurring}
                        onChange={e => setIsRecurring(e.target.checked)}
                        style={{ display: 'none' }}
                      />
                      {/* Toggle */}
                      <div style={{
                        width: 36, height: 20, borderRadius: 999, flexShrink: 0,
                        background: isRecurring ? 'var(--brand)' : 'var(--border-strong)',
                        position: 'relative', transition: 'background .2s',
                      }}>
                        <div style={{
                          position: 'absolute', top: 2, left: isRecurring ? 18 : 2,
                          width: 16, height: 16, borderRadius: '50%',
                          background: '#fff', transition: 'left .2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                        }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <RefreshCw size={12} style={{ color: 'var(--brand)' }} />
                          Repeat monthly
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
                          We&apos;ll remind you to log this every month
                        </div>
                      </div>
                    </label>
                  )}

                  {/* Transfer note */}
                  {txType === 'transfer' && (
                    <div style={{
                      padding: '10px 14px', borderRadius: 10,
                      background: 'var(--info-soft)', border: '1px solid transparent',
                    }}>
                      <p style={{ fontSize: 12, color: 'var(--info-ink)', lineHeight: 1.5 }}>
                        Transfers are <strong>excluded from income and expense totals</strong> — they won&apos;t affect your savings rate, health score, or budget tracking.
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={saving || !amount || Number(amount) <= 0}
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14, opacity: saving ? 0.6 : 1 }}
                  >
                    {saving ? 'Saving...' : editTx ? 'Update' : txType === 'transfer' ? 'Log Transfer' : 'Add Transaction'}
                  </button>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
