'use client'

import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, Calculator } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { format } from 'date-fns'
import { addBorrowing, updateBorrowing, addTransaction } from '@/lib/firestore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import type { Borrowing } from '@/types'
import toast from 'react-hot-toast'

interface FormData {
  type: 'borrowed' | 'lent'
  amount: string
  person: string
  description: string
  date: string
  dueDate: string
  repaidAmount: string
  status: Borrowing['status']
  isLoan: boolean
  interestRate: string
  tenureMonths: string
  emiAmount: string
}

interface Props {
  open: boolean
  onClose: () => void
  editBorrowing?: Borrowing | null
}

function calcEMI(principal: number, annualRate: number, months: number): number {
  if (!principal || !annualRate || !months) return 0
  const r = annualRate / 12 / 100
  return Math.round(principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1))
}

export default function AddBorrowingModal({ open, onClose, editBorrowing }: Props) {
  const { user } = useAuth()
  const refresh = useRefreshData()
  const { register, handleSubmit, reset, control, setValue, formState: { isSubmitting } } = useForm<FormData>()

  const isLoan = useWatch({ control, name: 'isLoan', defaultValue: false })
  const principal = useWatch({ control, name: 'amount', defaultValue: '' })
  const rate = useWatch({ control, name: 'interestRate', defaultValue: '' })
  const tenure = useWatch({ control, name: 'tenureMonths', defaultValue: '' })

  // Auto-compute EMI when principal/rate/tenure change
  useEffect(() => {
    if (isLoan && principal && rate && tenure) {
      const emi = calcEMI(Number(principal), Number(rate), Number(tenure))
      if (emi > 0) setValue('emiAmount', String(emi))
    }
  }, [principal, rate, tenure, isLoan, setValue])

  useEffect(() => {
    if (open) {
      reset({
        type: editBorrowing?.type ?? 'borrowed',
        amount: editBorrowing ? String(editBorrowing.amount) : '',
        person: editBorrowing?.person ?? '',
        description: editBorrowing?.description ?? '',
        date: editBorrowing?.date ?? format(new Date(), 'yyyy-MM-dd'),
        dueDate: editBorrowing?.dueDate ?? '',
        repaidAmount: editBorrowing ? String(editBorrowing.repaidAmount) : '0',
        status: editBorrowing?.status ?? 'pending',
        isLoan: editBorrowing?.isLoan ?? false,
        interestRate: editBorrowing?.interestRate ? String(editBorrowing.interestRate) : '',
        tenureMonths: editBorrowing?.tenureMonths ? String(editBorrowing.tenureMonths) : '',
        emiAmount: editBorrowing?.emiAmount ? String(editBorrowing.emiAmount) : '',
      })
    }
  }, [open, editBorrowing, reset])

  async function onSubmit(data: FormData) {
    if (!user) return
    try {
      const payload: Omit<Borrowing, 'id' | 'userId' | 'createdAt'> = {
        type: data.type,
        amount: Number(data.amount),
        person: data.person,
        description: data.description,
        date: data.date,
        repaidAmount: Number(data.repaidAmount),
        status: data.status,
        ...(data.dueDate ? { dueDate: data.dueDate } : {}),
        isLoan: data.isLoan,
        ...(data.isLoan && data.interestRate ? { interestRate: Number(data.interestRate) } : {}),
        ...(data.isLoan && data.tenureMonths  ? { tenureMonths:  Number(data.tenureMonths) }  : {}),
        ...(data.isLoan && data.emiAmount     ? { emiAmount:     Number(data.emiAmount) }      : {}),
      }
      if (editBorrowing) {
        const delta = payload.repaidAmount - editBorrowing.repaidAmount
        await updateBorrowing(editBorrowing.id, payload)
        if (delta > 0) {
          await addTransaction(user.uid, {
            type: 'transfer',
            transferKind: editBorrowing.type === 'lent' ? 'loan_repayment_received' : 'loan_repayment_paid',
            amount: delta,
            category: 'Other',
            date: format(new Date(), 'yyyy-MM-dd'),
            notes: editBorrowing.type === 'lent'
              ? `Repayment from ${editBorrowing.person}${editBorrowing.description ? ' · ' + editBorrowing.description : ''}`
              : `Repaid to ${editBorrowing.person}${editBorrowing.description ? ' · ' + editBorrowing.description : ''}`,
            isRecurring: false,
            borrowingId: editBorrowing.id,
          })
        }
        toast.success(delta > 0 ? 'Updated & transaction logged' : 'Updated')
      } else {
        await addBorrowing(user.uid, payload)
        toast.success('Added')
      }
      await refresh()
      onClose()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(msg.includes('permission') ? 'Permission denied — check Firestore rules' : msg)
    }
  }

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end sm:items-center justify-center p-4">
            <Transition.Child as={Fragment}
              enter="ease-out duration-200" enterFrom="opacity-0 translate-y-4"
              enterTo="opacity-100 translate-y-0"
              leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
              <Dialog.Panel className="w-full max-w-md bg-white dark:bg-[#0F1120] border border-transparent dark:border-[#1E2140] rounded-2xl shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                  <Dialog.Title className="text-base font-semibold text-slate-800 dark:text-white">
                    {editBorrowing ? 'Edit Record' : 'Add Borrowing'}
                  </Dialog.Title>
                  <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
                  {/* Type */}
                  <div>
                    <label className="label">Type</label>
                    <select className="input" {...register('type')}>
                      <option value="borrowed">I Borrowed (I owe)</option>
                      <option value="lent">I Lent (they owe me)</option>
                    </select>
                  </div>

                  {/* Loan toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" {...register('isLoan')} style={{ width: 16, height: 16, accentColor: 'var(--brand)', cursor: 'pointer' }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>
                      This is a formal loan / EMI
                    </span>
                  </label>

                  {/* Amounts */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Amount (₹)</label>
                      <input type="number" className="input" {...register('amount', { required: true })} />
                    </div>
                    <div>
                      <label className="label">Repaid So Far (₹)</label>
                      <input type="number" className="input" {...register('repaidAmount')} />
                    </div>
                  </div>

                  {/* EMI fields — shown only for loans */}
                  {isLoan && (
                    <div style={{
                      background: 'var(--surface-2)', borderRadius: 12, padding: 14,
                      display: 'flex', flexDirection: 'column', gap: 12,
                      border: '1px solid var(--border)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Calculator size={13} style={{ color: 'var(--brand)' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-ink)' }}>Loan details</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="label">Rate (%/yr)</label>
                          <input type="number" step="0.1" className="input" placeholder="8.5" {...register('interestRate')} />
                        </div>
                        <div>
                          <label className="label">Tenure (mo)</label>
                          <input type="number" className="input" placeholder="60" {...register('tenureMonths')} />
                        </div>
                        <div>
                          <label className="label">EMI (₹)</label>
                          <input type="number" className="input" placeholder="auto" {...register('emiAmount')} />
                        </div>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-4)' }}>
                        EMI is auto-calculated from principal × rate × tenure. You can override it.
                      </p>
                    </div>
                  )}

                  {/* Person */}
                  <div>
                    <label className="label">{isLoan ? 'Bank / Lender' : 'Person / Source'}</label>
                    <input className="input" placeholder={isLoan ? 'e.g. HDFC Bank' : 'Name of person'} {...register('person', { required: true })} />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="label">Description</label>
                    <input className="input" placeholder="Reason..." {...register('description')} />
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Date</label>
                      <input type="date" className="input" {...register('date')} />
                    </div>
                    <div>
                      <label className="label">{isLoan ? 'Last EMI Date' : 'Due Date'}</label>
                      <input type="date" className="input" {...register('dueDate')} />
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="label">Status</label>
                    <select className="input" {...register('status')}>
                      <option value="pending">Pending</option>
                      <option value="partial">Partial</option>
                      <option value="repaid">Repaid</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary w-full justify-center py-3 text-base disabled:opacity-60"
                  >
                    {isSubmitting ? 'Saving...' : editBorrowing ? 'Update' : 'Add Record'}
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
