'use client'

import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, TrendingDown, TrendingUp } from 'lucide-react'
import { format, addMonths } from 'date-fns'
import { addUpcoming, updateUpcoming } from '@/lib/firestore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/utils'
import type { UpcomingExpense, Category } from '@/types'
import toast from 'react-hot-toast'

interface Props {
  open: boolean
  onClose: () => void
  editItem?: UpcomingExpense | null
}

export default function AddUpcomingModal({ open, onClose, editItem }: Props) {
  const { user } = useAuth()
  const refresh = useRefreshData()

  const defaultDate = format(addMonths(new Date(), 1), 'yyyy-MM') + '-01'

  const [flowType, setFlowType]     = useState<'expense' | 'income'>('expense')
  const [label, setLabel]           = useState('')
  const [amount, setAmount]         = useState('')
  const [dueDate, setDueDate]       = useState(defaultDate)
  const [category, setCategory]     = useState<Category>('Living Expenses')
  const [notes, setNotes]           = useState('')
  const [isRecurring, setRecurring] = useState(false)
  const [saving, setSaving]         = useState(false)

  const isIncome = flowType === 'income'

  useEffect(() => {
    if (open) {
      const ft = (editItem?.flowType ?? 'expense') as 'expense' | 'income'
      setFlowType(ft)
      setLabel(editItem?.label ?? '')
      setAmount(editItem ? String(editItem.amount) : '')
      setDueDate(editItem?.dueDate ?? defaultDate)
      setCategory((editItem?.category as Category) ?? (ft === 'income' ? 'Other Income' : 'Living Expenses'))
      setNotes(editItem?.notes ?? '')
      setRecurring(editItem?.isRecurring ?? false)
    }
  }, [open, editItem])

  function handleFlowTypeChange(ft: 'expense' | 'income') {
    setFlowType(ft)
    setCategory(ft === 'income' ? 'Other Income' : 'Living Expenses')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !label.trim() || !amount || Number(amount) <= 0) return
    setSaving(true)
    try {
      const payload = {
        flowType,
        label: label.trim(),
        amount: Number(amount),
        dueDate,
        category,
        notes,
        isRecurring,
      }
      if (editItem) {
        await updateUpcoming(editItem.id, payload)
        toast.success('Updated')
      } else {
        await addUpcoming(user.uid, payload)
        toast.success(isIncome ? 'Expected income added' : 'Added to upcoming')
      }
      await refresh()
      onClose()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

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
              enter="ease-out duration-200" enterFrom="opacity-0 translate-y-4" enterTo="opacity-100 translate-y-0"
              leave="ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-4"
            >
              <Dialog.Panel style={{
                width: '100%', maxWidth: 420,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px', borderBottom: '1px solid var(--border)',
                }}>
                  <Dialog.Title style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                    {editItem ? 'Edit entry' : 'Add upcoming'}
                  </Dialog.Title>
                  <button onClick={onClose} style={{ padding: 6, borderRadius: 8, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* Expense / Income toggle — disabled when editing (can't change flow type) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {(['expense', 'income'] as const).map(ft => {
                      const active = flowType === ft
                      const Icon = ft === 'expense' ? TrendingDown : TrendingUp
                      const activeColor = ft === 'expense' ? 'var(--bad-ink)' : 'var(--good-ink)'
                      const activeBg   = ft === 'expense' ? 'color-mix(in oklch, var(--bad) 12%, transparent)' : 'color-mix(in oklch, var(--good) 12%, transparent)'
                      const activeBorder = ft === 'expense' ? 'var(--bad)' : 'var(--good)'
                      return (
                        <button
                          key={ft}
                          type="button"
                          disabled={!!editItem}
                          onClick={() => handleFlowTypeChange(ft)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                            padding: '10px 12px', borderRadius: 10, cursor: editItem ? 'default' : 'pointer',
                            border: `1.5px solid ${active ? activeBorder : 'var(--border)'}`,
                            background: active ? activeBg : 'var(--surface-2)',
                            color: active ? activeColor : 'var(--text-3)',
                            fontSize: 13, fontWeight: 600,
                            transition: 'all .15s',
                            opacity: editItem ? 0.7 : 1,
                          }}
                        >
                          <Icon size={14} />
                          {ft === 'expense' ? 'Going out' : 'Coming in'}
                        </button>
                      )
                    })}
                  </div>

                  <div>
                    <label className="label">{isIncome ? "What's coming in?" : 'What is it?'}</label>
                    <input
                      type="text"
                      className="input"
                      placeholder={isIncome ? 'e.g. Security deposit, Freelance payout…' : 'e.g. Rent, Credit card bill, Flight…'}
                      value={label}
                      onChange={e => setLabel(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="label">Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      style={{ fontSize: 18, fontWeight: 600 }}
                      placeholder="0"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">{isIncome ? 'Expected by' : 'Expected date'}</label>
                    <input
                      type="date"
                      className="input"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Category</label>
                    <select
                      className="input"
                      value={category}
                      onChange={e => setCategory(e.target.value as Category)}
                    >
                      {(isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">Notes (optional)</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Any extra detail…"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>

                  {/* Recurring toggle */}
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: 12, borderRadius: 10, cursor: 'pointer',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                  }}>
                    <input type="checkbox" checked={isRecurring} onChange={e => setRecurring(e.target.checked)} style={{ display: 'none' }} />
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
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Repeats monthly</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>Keep this note every month automatically</div>
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={saving || !label.trim() || !amount || Number(amount) <= 0}
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14, opacity: saving ? 0.6 : 1 }}
                  >
                    {saving ? 'Saving…' : editItem ? 'Update' : isIncome ? 'Add income' : 'Add expense'}
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
