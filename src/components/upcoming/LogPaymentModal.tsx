'use client'

import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, IndianRupee } from 'lucide-react'
import { format } from 'date-fns'
import { addUpcomingPayment, addTransaction } from '@/lib/firestore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import { formatCurrencyFull } from '@/lib/utils'
import type { UpcomingExpense } from '@/types'
import toast from 'react-hot-toast'

interface Props {
  open: boolean
  onClose: () => void
  item: UpcomingExpense | null
  alreadyPaid: number
}

export default function LogPaymentModal({ open, onClose, item, alreadyPaid }: Props) {
  const { user } = useAuth()
  const refresh  = useRefreshData()

  const remaining = item ? Math.max(0, item.amount - alreadyPaid) : 0

  const [amount, setAmount]       = useState('')
  const [date, setDate]           = useState(format(new Date(), 'yyyy-MM-dd'))
  const [notes, setNotes]         = useState('')
  const [alsoLog, setAlsoLog]     = useState(true)
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    if (open) {
      setAmount(remaining > 0 ? String(remaining) : '')
      setDate(format(new Date(), 'yyyy-MM-dd'))
      setNotes('')
      setAlsoLog(true)
    }
  }, [open, remaining])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !item || !amount || Number(amount) <= 0) return
    setSaving(true)
    try {
      let linkedTransactionId: string | undefined

      if (alsoLog) {
        linkedTransactionId = await addTransaction(user.uid, {
          type: 'expense',
          amount: Number(amount),
          category: item.category ?? 'Other',
          date,
          notes: notes || `Payment towards: ${item.label}`,
          isRecurring: false,
        })
      }

      await addUpcomingPayment(user.uid, {
        upcomingId: item.id,
        amount: Number(amount),
        date,
        notes,
        ...(linkedTransactionId ? { linkedTransactionId } : {}),
      })

      await refresh()
      toast.success('Payment logged')
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (!item) return null

  const pct = item.amount > 0 ? Math.min(100, (alreadyPaid / item.amount) * 100) : 0

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" style={{ position: 'relative', zIndex: 60 }} onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }} />
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <Dialog.Title style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                      Log payment
                    </Dialog.Title>
                    <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{item.label}</p>
                  </div>
                  <button onClick={onClose} style={{ padding: 6, borderRadius: 8, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X size={16} />
                  </button>
                </div>

                {/* Progress summary */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-3)' }}>
                      Paid <span style={{ color: 'var(--good-ink)', fontWeight: 600 }}>{formatCurrencyFull(alreadyPaid)}</span>
                    </span>
                    <span style={{ color: 'var(--text-3)' }}>
                      Remaining <span style={{ color: 'var(--text)', fontWeight: 600 }}>{formatCurrencyFull(remaining)}</span>
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 999,
                      width: `${pct}%`,
                      background: pct >= 100 ? 'var(--good)' : 'var(--brand)',
                      transition: 'width .3s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'right' }}>
                    {Math.round(pct)}% of {formatCurrencyFull(item.amount)}
                  </div>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

                  <div>
                    <label className="label">Amount paid (₹)</label>
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
                      autoFocus
                    />
                    {remaining > 0 && Number(amount) > 0 && (
                      <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>
                        After this: {formatCurrencyFull(Math.max(0, remaining - Number(amount)))} remaining
                      </p>
                    )}
                  </div>

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

                  <div>
                    <label className="label">Notes (optional)</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. UPI transfer, cheque…"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>

                  {/* Also log as transaction toggle */}
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: 12, borderRadius: 10, cursor: 'pointer',
                    background: alsoLog ? 'var(--brand-soft)' : 'var(--surface-2)',
                    border: `1px solid ${alsoLog ? 'var(--brand)' : 'var(--border)'}`,
                    transition: 'all .15s',
                  }}>
                    <input type="checkbox" checked={alsoLog} onChange={e => setAlsoLog(e.target.checked)} style={{ display: 'none' }} />
                    <div style={{
                      width: 36, height: 20, borderRadius: 999, flexShrink: 0,
                      background: alsoLog ? 'var(--brand)' : 'var(--border-strong)',
                      position: 'relative', transition: 'background .2s',
                    }}>
                      <div style={{
                        position: 'absolute', top: 2, left: alsoLog ? 18 : 2,
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#fff', transition: 'left .2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                      }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: alsoLog ? 'var(--brand-ink)' : 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <IndianRupee size={12} /> Also log as expense transaction
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>Adds to your monthly spending</div>
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={saving || !amount || Number(amount) <= 0}
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14, opacity: saving ? 0.6 : 1 }}
                  >
                    {saving ? 'Saving…' : 'Log payment'}
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
