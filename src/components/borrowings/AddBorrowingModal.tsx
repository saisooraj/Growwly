'use client'

import { Fragment, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { addBorrowing, updateBorrowing } from '@/lib/firestore'
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
}

interface Props {
  open: boolean
  onClose: () => void
  editBorrowing?: Borrowing | null
}

export default function AddBorrowingModal({ open, onClose, editBorrowing }: Props) {
  const { user } = useAuth()
  const refresh = useRefreshData()
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>()

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
      })
    }
  }, [open, editBorrowing])

  async function onSubmit(data: FormData) {
    if (!user) return
    try {
      const payload = {
        type: data.type,
        amount: Number(data.amount),
        person: data.person,
        description: data.description,
        date: data.date,
        repaidAmount: Number(data.repaidAmount),
        status: data.status,
        ...(data.dueDate ? { dueDate: data.dueDate } : {}),
      }
      if (editBorrowing) {
        await updateBorrowing(editBorrowing.id, payload)
        toast.success('Updated')
      } else {
        await addBorrowing(user.uid, payload)
        toast.success('Added')
      }
      await refresh()
      onClose()
    } catch (e: unknown) {
      console.error('addBorrowing error:', e)
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
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <Dialog.Title className="text-base font-semibold text-slate-800">
                    {editBorrowing ? 'Edit Record' : 'Add Borrowing'}
                  </Dialog.Title>
                  <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
                  <div>
                    <label className="label">Type</label>
                    <select className="input" {...register('type')}>
                      <option value="borrowed">I Borrowed (I owe)</option>
                      <option value="lent">I Lent (they owe me)</option>
                    </select>
                  </div>
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
                  <div>
                    <label className="label">Person / Source</label>
                    <input className="input" placeholder="Name of person or bank" {...register('person', { required: true })} />
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <input className="input" placeholder="Reason..." {...register('description')} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Date</label>
                      <input type="date" className="input" {...register('date')} />
                    </div>
                    <div>
                      <label className="label">Due Date</label>
                      <input type="date" className="input" {...register('dueDate')} />
                    </div>
                  </div>
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
