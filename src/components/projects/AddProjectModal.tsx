'use client'

import { Fragment, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { addProject, updateProject } from '@/lib/firestore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import type { Project } from '@/types'
import toast from 'react-hot-toast'

interface FormData {
  name: string
  description: string
  totalBudget: string
  paid: string
  startDate: string
  endDate: string
  status: Project['status']
}

interface Props {
  open: boolean
  onClose: () => void
  editProject?: Project | null
}

export default function AddProjectModal({ open, onClose, editProject }: Props) {
  const { user } = useAuth()
  const refresh = useRefreshData()

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>()

  useEffect(() => {
    if (open) {
      reset({
        name: editProject?.name ?? '',
        description: editProject?.description ?? '',
        totalBudget: editProject ? String(editProject.totalBudget) : '',
        paid: editProject ? String(editProject.paid) : '0',
        startDate: editProject?.startDate ?? format(new Date(), 'yyyy-MM-dd'),
        endDate: editProject?.endDate ?? '',
        status: editProject?.status ?? 'active',
      })
    }
  }, [open, editProject])

  async function onSubmit(data: FormData) {
    if (!user) return
    try {
      const payload = {
        name: data.name,
        description: data.description,
        totalBudget: Number(data.totalBudget),
        paid: Number(data.paid),
        startDate: data.startDate,
        status: data.status,
        ...(data.endDate ? { endDate: data.endDate } : {}),
      }
      if (editProject) {
        await updateProject(editProject.id, payload)
        toast.success('Project updated')
      } else {
        await addProject(user.uid, payload)
        toast.success('Project created')
      }
      await refresh()
      onClose()
    } catch {
      toast.error('Something went wrong')
    }
  }

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
              enter="ease-out duration-200" enterFrom="opacity-0 translate-y-4"
              enterTo="opacity-100 translate-y-0"
              leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
            >
              <Dialog.Panel className="w-full max-w-md bg-white dark:bg-[#0F1120] border border-transparent dark:border-[#1E2140] rounded-2xl shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <Dialog.Title className="text-base font-semibold text-slate-800">
                    {editProject ? 'Edit Project' : 'New Project'}
                  </Dialog.Title>
                  <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
                  <div>
                    <label className="label">Project Name</label>
                    <input className="input" placeholder="e.g., House Construction" {...register('name', { required: true })} />
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <input className="input" placeholder="Optional details..." {...register('description')} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Total Budget (₹)</label>
                      <input type="number" className="input" {...register('totalBudget', { required: true })} />
                    </div>
                    <div>
                      <label className="label">Paid So Far (₹)</label>
                      <input type="number" className="input" {...register('paid')} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Start Date</label>
                      <input type="date" className="input" {...register('startDate')} />
                    </div>
                    <div>
                      <label className="label">End Date</label>
                      <input type="date" className="input" {...register('endDate')} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select className="input" {...register('status')}>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary w-full justify-center py-3 text-base disabled:opacity-60"
                  >
                    {isSubmitting ? 'Saving...' : editProject ? 'Update Project' : 'Create Project'}
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
