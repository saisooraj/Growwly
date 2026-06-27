'use client'

import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Plus, X, Target, Pencil, Trash2, CalendarDays } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import { addSavingsGoal, updateSavingsGoal, deleteSavingsGoal } from '@/lib/firestore'
import { formatCurrencyFull } from '@/lib/utils'
import { GoalIcon, GOAL_ICONS, ICON_COMPONENT_MAP } from '@/lib/categoryIcons'
import { format, parseISO, differenceInMonths } from 'date-fns'
import type { SavingsGoal } from '@/types'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'

interface FormState {
  name: string
  emoji: string
  targetAmount: string
  currentAmount: string
  targetDate: string
}

const EMPTY: FormState = { name: '', emoji: 'IconTarget', targetAmount: '', currentAmount: '0', targetDate: '' }

export default function SavingsGoals() {
  const { savingsGoals } = useAppStore()
  const { user } = useAuth()
  const refresh = useRefreshData()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SavingsGoal | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)

  function openAdd() { setEditing(null); setForm(EMPTY); setOpen(true) }

  function openEdit(g: SavingsGoal) {
    setEditing(g)
    setForm({ name: g.name, emoji: g.emoji, targetAmount: String(g.targetAmount), currentAmount: String(g.currentAmount), targetDate: g.targetDate ?? '' })
    setOpen(true)
  }

  async function handleSave() {
    if (!user || !form.name || !form.targetAmount) return
    setSaving(true)
    try {
      const payload = {
        name: form.name, emoji: form.emoji,
        targetAmount: Number(form.targetAmount),
        currentAmount: Number(form.currentAmount) || 0,
        ...(form.targetDate ? { targetDate: form.targetDate } : {}),
      }
      if (editing) { await updateSavingsGoal(editing.id, payload); toast.success('Goal updated') }
      else         { await addSavingsGoal(user.uid, payload);       toast.success('Goal created!') }
      await refresh()
      setOpen(false)
    } catch { toast.error('Something went wrong') }
    finally { setSaving(false) }
  }

  function handleDelete(g: SavingsGoal) {
    setConfirm({
      message: `Delete goal "${g.name}"?`,
      onConfirm: async () => {
        try { await deleteSavingsGoal(g.id); await refresh(); toast.success('Goal deleted') }
        catch { toast.error('Failed to delete') }
      },
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Savings Goals</h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>Track what you're saving towards</p>
        </div>
        <button onClick={openAdd} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> New Goal
        </button>
      </div>

      {/* Empty state */}
      {savingsGoals.length === 0 ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Target size={26} style={{ color: 'var(--text-4)' }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>No savings goals yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Add a goal — trip, phone, home, anything</p>
          <button onClick={openAdd} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Create your first goal
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--row-gap)', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {savingsGoals.map((g) => {
            const pct = Math.min((g.currentAmount / g.targetAmount) * 100, 100)
            const remaining = g.targetAmount - g.currentAmount
            const monthsLeft = g.targetDate
              ? Math.max(differenceInMonths(parseISO(g.targetDate), new Date()), 0)
              : null
            const monthlyNeeded = monthsLeft && monthsLeft > 0 && remaining > 0
              ? Math.ceil(remaining / monthsLeft) : null
            const done = g.currentAmount >= g.targetAmount

            return (
              <div key={g.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                      background: done ? 'var(--good-soft)' : 'var(--brand-soft)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: done ? 'var(--good-ink)' : 'var(--brand-ink)',
                    }}>
                      <GoalIcon emoji={g.emoji} size={22} />
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14.5, margin: 0 }}>{g.name}</p>
                      {g.targetDate && (
                        <p style={{ fontSize: 11.5, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                          <CalendarDays size={11} />
                          {format(parseISO(g.targetDate), 'MMM yyyy')}
                          {monthsLeft !== null && ` · ${monthsLeft}mo left`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button
                      onClick={() => openEdit(g)}
                      style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(g)}
                      style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bad-soft)'; e.currentTarget.style.color = 'var(--bad-ink)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
                    <span>{formatCurrencyFull(g.currentAmount)} saved</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>{formatCurrencyFull(g.targetAmount)}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`, borderRadius: 999,
                      background: done ? 'var(--good)' : 'linear-gradient(90deg, var(--brand-2), var(--brand))',
                      transition: 'width .7s cubic-bezier(.22,1,.36,1)',
                    }} />
                  </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: done ? 'var(--good-ink)' : 'var(--brand-ink)' }}>
                    {done ? '🎉 Goal reached!' : `${pct.toFixed(0)}% done`}
                  </span>
                  {!done && monthlyNeeded && (
                    <span style={{ fontSize: 12, color: 'var(--text-4)' }}>{formatCurrencyFull(monthlyNeeded)}/mo needed</span>
                  )}
                  {!done && !monthlyNeeded && remaining > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--text-4)' }}>{formatCurrencyFull(remaining)} to go</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Transition appear show={open} as={Fragment}>
        <Dialog as="div" style={{ position: 'relative', zIndex: 50 }} onClose={() => setOpen(false)}>
          <Transition.Child as={Fragment}
            enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
            leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
          >
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,6,20,.46)', backdropFilter: 'blur(4px)' }} />
          </Transition.Child>

          <div style={{ position: 'fixed', inset: 0, overflowY: 'auto' }}>
            <div style={{ display: 'flex', minHeight: '100%', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}
                 className="sm:items-center">
              <Transition.Child as={Fragment}
                enter="ease-out duration-200" enterFrom="opacity-0 translate-y-4"
                enterTo="opacity-100 translate-y-0"
                leave="ease-in duration-150" leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-4"
              >
                <Dialog.Panel style={{
                  width: '100%', maxWidth: 440,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 24, boxShadow: 'var(--elev-lg)', overflow: 'hidden',
                }}>
                  {/* Modal header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 16px', borderBottom: '1px solid var(--border)' }}>
                    <Dialog.Title style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                      {editing ? 'Edit Goal' : 'New Savings Goal'}
                    </Dialog.Title>
                    <button
                      onClick={() => setOpen(false)}
                      style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Icon picker */}
                    <div>
                      <label className="label">Icon</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {GOAL_ICONS.map((p) => {
                          const active = form.emoji === p.name
                          const Icon = ICON_COMPONENT_MAP[p.name]
                          return (
                            <button
                              key={p.name}
                              type="button"
                              title={p.label}
                              onClick={() => setForm(f => ({ ...f, emoji: p.name }))}
                              style={{
                                width: 36, height: 36, borderRadius: 10, border: 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', transition: 'all .12s',
                                background: active ? 'var(--brand-soft)' : 'var(--surface-2)',
                                color: active ? 'var(--brand-ink)' : 'var(--text-3)',
                                outline: active ? '2px solid var(--brand)' : '2px solid transparent',
                                outlineOffset: 1,
                              }}
                            >
                              {Icon && <Icon size={18} stroke={1.5} />}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="label">Goal Name</label>
                      <input className="input" placeholder="e.g. Trip to Bali" value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label className="label">Target Amount (₹)</label>
                        <input className="input" type="number" min="1" placeholder="50000" value={form.targetAmount}
                          onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">Saved So Far (₹)</label>
                        <input className="input" type="number" min="0" placeholder="0" value={form.currentAmount}
                          onChange={e => setForm(f => ({ ...f, currentAmount: e.target.value }))} />
                      </div>
                    </div>

                    <div>
                      <label className="label">Target Date (optional)</label>
                      <input className="input" type="date" value={form.targetDate}
                        onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} />
                    </div>

                    <button
                      onClick={handleSave}
                      disabled={saving || !form.name || !form.targetAmount}
                      className="btn-primary"
                      style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 15, opacity: (saving || !form.name || !form.targetAmount) ? 0.6 : 1 }}
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

      {confirm && (
        <ConfirmDialog open message={confirm.message} onConfirm={confirm.onConfirm} onClose={() => setConfirm(null)} />
      )}
    </div>
  )
}
