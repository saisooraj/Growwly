'use client'

import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Plus, X, Target, Pencil, Trash2, CalendarDays } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import { addSavingsGoal, updateSavingsGoal, deleteSavingsGoal } from '@/lib/firestore'
import { formatCurrencyFull } from '@/lib/utils'
import { format, parseISO, differenceInMonths } from 'date-fns'
import type { SavingsGoal } from '@/types'
import toast from 'react-hot-toast'

const EMOJIS = ['🏠', '✈️', '🚗', '📱', '💍', '🎓', '💰', '🏖️', '🎯', '🛍️', '🏋️', '💻']

interface FormState {
  name: string
  emoji: string
  targetAmount: string
  currentAmount: string
  targetDate: string
}

const EMPTY: FormState = { name: '', emoji: '🎯', targetAmount: '', currentAmount: '0', targetDate: '' }

export default function SavingsGoals() {
  const { savingsGoals } = useAppStore()
  const { user } = useAuth()
  const refresh = useRefreshData()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SavingsGoal | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  function openAdd() {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }

  function openEdit(g: SavingsGoal) {
    setEditing(g)
    setForm({
      name: g.name,
      emoji: g.emoji,
      targetAmount: String(g.targetAmount),
      currentAmount: String(g.currentAmount),
      targetDate: g.targetDate ?? '',
    })
    setOpen(true)
  }

  async function handleSave() {
    if (!user || !form.name || !form.targetAmount) return
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        emoji: form.emoji,
        targetAmount: Number(form.targetAmount),
        currentAmount: Number(form.currentAmount) || 0,
        ...(form.targetDate ? { targetDate: form.targetDate } : {}),
      }
      if (editing) {
        await updateSavingsGoal(editing.id, payload)
        toast.success('Goal updated')
      } else {
        await addSavingsGoal(user.uid, payload)
        toast.success('Goal created!')
      }
      await refresh()
      setOpen(false)
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(g: SavingsGoal) {
    if (!confirm(`Delete "${g.name}"?`)) return
    try {
      await deleteSavingsGoal(g.id)
      await refresh()
      toast.success('Goal deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Savings Goals</h2>
          <p className="text-xs text-slate-400 mt-0.5">Track what you're saving towards</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-1.5 text-sm px-3 py-2">
          <Plus size={15} /> New Goal
        </button>
      </div>

      {savingsGoals.length === 0 ? (
        <div className="card flex flex-col items-center py-10 text-center">
          <Target size={32} className="text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">No savings goals yet</p>
          <p className="text-xs text-slate-400 mt-1">Add a goal — trip, phone, home, anything</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {savingsGoals.map((g) => {
            const pct = Math.min((g.currentAmount / g.targetAmount) * 100, 100)
            const remaining = g.targetAmount - g.currentAmount
            const monthsLeft = g.targetDate
              ? Math.max(differenceInMonths(parseISO(g.targetDate), new Date()), 0)
              : null
            const monthlyNeeded = monthsLeft && monthsLeft > 0 && remaining > 0
              ? Math.ceil(remaining / monthsLeft)
              : null
            const done = g.currentAmount >= g.targetAmount

            return (
              <div key={g.id} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{g.emoji}</span>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{g.name}</p>
                      {g.targetDate && (
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <CalendarDays size={11} />
                          {format(parseISO(g.targetDate), 'MMM yyyy')}
                          {monthsLeft !== null && ` · ${monthsLeft}mo left`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(g)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(g)} className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="mb-2">
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>{formatCurrencyFull(g.currentAmount)} saved</span>
                    <span className="font-medium">{formatCurrencyFull(g.targetAmount)}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-700 ${
                        done ? 'bg-green-500' : 'bg-gradient-to-r from-brand-500 to-fuchsia-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className={`font-semibold ${done ? 'text-green-600' : 'text-brand-600'}`}>
                    {done ? '🎉 Goal reached!' : `${pct.toFixed(0)}% done`}
                  </span>
                  {!done && monthlyNeeded && (
                    <span className="text-slate-400">{formatCurrencyFull(monthlyNeeded)}/mo needed</span>
                  )}
                  {!done && !monthlyNeeded && remaining > 0 && (
                    <span className="text-slate-400">{formatCurrencyFull(remaining)} to go</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Transition appear show={open} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setOpen(false)}>
          <Transition.Child as={Fragment}
            enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
            leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-end sm:items-center justify-center p-4">
              <Transition.Child as={Fragment}
                enter="ease-out duration-200" enterFrom="opacity-0 translate-y-4 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-150" leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:scale-95"
              >
                <Dialog.Panel className="w-full max-w-md bg-white dark:bg-[#0F1120] border border-transparent dark:border-[#1E2140] rounded-2xl shadow-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#1E2140]">
                    <Dialog.Title className="text-base font-semibold text-slate-800 dark:text-slate-100">
                      {editing ? 'Edit Goal' : 'New Savings Goal'}
                    </Dialog.Title>
                    <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                      <X size={18} />
                    </button>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Emoji picker */}
                    <div>
                      <label className="label">Icon</label>
                      <div className="flex flex-wrap gap-2">
                        {EMOJIS.map((e) => (
                          <button
                            key={e}
                            type="button"
                            onClick={() => setForm(f => ({ ...f, emoji: e }))}
                            className={`w-9 h-9 text-lg rounded-xl transition-all ${
                              form.emoji === e
                                ? 'bg-brand-100 dark:bg-brand-900/40 ring-2 ring-brand-500'
                                : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100'
                            }`}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="label">Goal Name</label>
                      <input
                        className="input"
                        placeholder="e.g. Trip to Bali"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Target Amount (₹)</label>
                        <input
                          className="input"
                          type="number"
                          min="1"
                          placeholder="50000"
                          value={form.targetAmount}
                          onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label">Saved So Far (₹)</label>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          placeholder="0"
                          value={form.currentAmount}
                          onChange={e => setForm(f => ({ ...f, currentAmount: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="label">Target Date (optional)</label>
                      <input
                        className="input"
                        type="date"
                        value={form.targetDate}
                        onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                      />
                    </div>

                    <button
                      onClick={handleSave}
                      disabled={saving || !form.name || !form.targetAmount}
                      className="btn-primary w-full justify-center py-3 text-base disabled:opacity-60"
                    >
                      {saving ? 'Saving...' : editing ? 'Update Goal' : 'Create Goal'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  )
}
