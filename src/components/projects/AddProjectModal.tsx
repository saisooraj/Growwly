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
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,6,20,.44)', backdropFilter: 'blur(4px)' }} />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end sm:items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200" enterFrom="opacity-0 translate-y-4"
              enterTo="opacity-100 translate-y-0"
              leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
            >
              <Dialog.Panel style={{
                width: '100%', maxWidth: 440,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 24, boxShadow: 'var(--elev-lg)', overflow: 'hidden',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 16px', borderBottom: '1px solid var(--border)' }}>
                  <Dialog.Title style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                    {editProject ? 'Edit Project' : 'New Project'}
                  </Dialog.Title>
                  <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label className="label">Project Name</label>
                    <input className="input" placeholder="e.g., House Construction" {...register('name', { required: true })} />
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <input className="input" placeholder="Optional details..." {...register('description')} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="label">Total Budget (₹)</label>
                      <input type="number" className="input" {...register('totalBudget', { required: true })} />
                    </div>
                    <div>
                      <label className="label">Paid So Far (₹)</label>
                      <input type="number" className="input" {...register('paid')} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
