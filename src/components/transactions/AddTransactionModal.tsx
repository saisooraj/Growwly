'use client'

import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { addTransaction, updateTransaction } from '@/lib/firestore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'
import type { Transaction, TransactionType } from '@/types'
import toast from 'react-hot-toast'

interface FormData {
  type: TransactionType
  amount: string
  category: string
  date: string
  notes: string
  projectId: string
}

interface Props {
  open: boolean
  onClose: () => void
  editTx?: Transaction | null
}

export default function AddTransactionModal({ open, onClose, editTx }: Props) {
  const { user } = useAuth()
  const refresh = useRefreshData()
  const projects = useAppStore((s) => s.projects)

  const { register, handleSubmit, watch, reset, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: {
      type: editTx?.type ?? 'expense',
      amount: editTx ? String(editTx.amount) : '',
      category: editTx?.category ?? 'Living Expenses',
      date: editTx?.date ?? format(new Date(), 'yyyy-MM-dd'),
      notes: editTx?.notes ?? '',
      projectId: editTx?.projectId ?? '',
    },
  })

  const txType = watch('type')
  const categories = txType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  async function onSubmit(data: FormData) {
    if (!user) return
    try {
      const payload = {
        type: data.type,
        amount: Number(data.amount),
        category: data.category as Transaction['category'],
        date: data.date,
        notes: data.notes,
        ...(data.projectId ? { projectId: data.projectId } : {}),
      }
      if (editTx) {
        await updateTransaction(editTx.id, payload)
        toast.success('Transaction updated')
      } else {
        await addTransaction(user.uid, payload)
        toast.success('Transaction added')
      }
      await refresh()
      reset()
      onClose()
    } catch {
      toast.error('Something went wrong')
    }
  }

  function handleClose() {
    reset()
    onClose()
  }

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end sm:items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200" enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-150" leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="w-full max-w-md bg-white dark:bg-[#0F1120] border border-transparent dark:border-[#1E2140] rounded-2xl shadow-xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <Dialog.Title className="text-base font-semibold text-slate-800">
                    {editTx ? 'Edit Transaction' : 'Add Transaction'}
                  </Dialog.Title>
                  <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
                  {/* Type Toggle */}
                  <div>
                    <label className="label">Type</label>
                    <div className="flex gap-2">
                      {(['expense', 'income'] as const).map((t) => (
                        <label key={t} className="flex-1">
                          <input type="radio" value={t} {...register('type')} className="sr-only" />
                          <div className={`text-center py-2.5 rounded-xl text-sm font-medium cursor-pointer border-2 transition-all ${
                            txType === t
                              ? t === 'expense'
                                ? 'border-red-500 bg-red-50 text-red-600'
                                : 'border-green-500 bg-green-50 text-green-600'
                              : 'border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}>
                            {t === 'expense' ? '↑ Expense' : '↓ Income'}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="label">Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0"
                      className="input text-lg font-semibold"
                      {...register('amount', { required: true, min: 0.01 })}
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="label">Category</label>
                    <select className="input" {...register('category', { required: true })}>
                      {categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="label">Date</label>
                    <input type="date" className="input" {...register('date', { required: true })} />
                  </div>

                  {/* Project (optional) */}
                  {txType === 'expense' && projects.length > 0 && (
                    <div>
                      <label className="label">Link to Project (optional)</label>
                      <select className="input" {...register('projectId')}>
                        <option value="">None</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="label">Notes</label>
                    <input
                      type="text"
                      placeholder="Optional note..."
                      className="input"
                      {...register('notes')}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary w-full justify-center py-3 text-base disabled:opacity-60"
                  >
                    {isSubmitting ? 'Saving...' : editTx ? 'Update' : 'Add Transaction'}
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
