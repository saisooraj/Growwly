'use client'

import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { RefreshCw, Check, X, SkipForward } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import { addTransaction } from '@/lib/firestore'
import { formatCurrencyFull, getCurrentMonth } from '@/lib/utils'
import { getCategoryDisplayName } from '@/lib/categoryIcons'
import { format } from 'date-fns'
import type { Transaction } from '@/types'
import toast from 'react-hot-toast'

function getDueRecurring(transactions: Transaction[]): Transaction[] {
  const currentMonth = getCurrentMonth()
  const today = new Date()

  return transactions
    .filter(t => t.isRecurring && t.recurringDay)
    .filter(template => {
      const alreadyLogged = transactions.some(
        t =>
          t.isRecurring && t.category === template.category &&
          t.notes === template.notes && t.amount === template.amount &&
          t.date.startsWith(currentMonth) && t.id !== template.id
      )
      if (alreadyLogged) return false
      if (template.date.startsWith(currentMonth)) return false
      return today.getDate() >= (template.recurringDay ?? 1)
    })
    .reduce<Transaction[]>((acc, t) => {
      const key = `${t.category}|${t.notes}|${t.amount}`
      if (!acc.find(a => `${a.category}|${a.notes}|${a.amount}` === key)) acc.push(t)
      return acc
    }, [])
}

const STORAGE_KEY = 'recurring_dismissed_month'

export default function RecurringPromptModal() {
  const { transactions } = useAppStore()
  const { user } = useAuth()
  const refresh = useRefreshData()
  const [open, setOpen] = useState(false)
  const [due, setDue] = useState<Transaction[]>([])
  const [logging, setLogging] = useState<string | null>(null)

  useEffect(() => {
    if (transactions.length === 0) return
    const currentMonth = getCurrentMonth()
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (dismissed === currentMonth) return
    const dueItems = getDueRecurring(transactions)
    if (dueItems.length > 0) { setDue(dueItems); setOpen(true) }
  }, [transactions])

  function dismiss() { localStorage.setItem(STORAGE_KEY, getCurrentMonth()); setOpen(false) }

  async function logOne(template: Transaction) {
    if (!user) return
    setLogging(template.id)
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      await addTransaction(user.uid, {
        type: template.type, amount: template.amount,
        category: template.category, date: today, notes: template.notes,
        isRecurring: true, recurringDay: template.recurringDay,
        ...(template.projectId ? { projectId: template.projectId } : {}),
      })
      setDue(prev => prev.filter(t => t.id !== template.id))
      toast.success(`Logged ${getCategoryDisplayName(template.category)}`)
      if (due.length <= 1) { dismiss(); await refresh() }
    } catch {
      toast.error('Failed to log')
    } finally {
      setLogging(null)
    }
  }

  async function logAll() {
    if (!user) return
    for (const t of due) await logOne(t)
    await refresh()
  }

  if (due.length === 0) return null

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" style={{ position: 'relative', zIndex: 50 }} onClose={dismiss}>
        <Transition.Child as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,6,20,.42)', backdropFilter: 'blur(4px)' }} />
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
                {/* Header */}
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                    background: 'var(--brand-soft)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <RefreshCw size={16} style={{ color: 'var(--brand-ink)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Dialog.Title style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                      Recurring transactions due
                    </Dialog.Title>
                    <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0, marginTop: 2 }}>
                      {due.length} item{due.length > 1 ? 's' : ''} to log this month
                    </p>
                  </div>
                  <button
                    onClick={dismiss}
                    style={{ width: 30, height: 30, borderRadius: 9, border: 'none', background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Item list */}
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {due.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 14, background: 'var(--surface-2)' }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{getCategoryDisplayName(t.category)}</p>
                        {t.notes && <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' }}>{t.notes}</p>}
                        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' }}>
                          {t.type === 'expense' ? 'Expense' : 'Income'} · {formatCurrencyFull(t.amount)}
                        </p>
                      </div>
                      <button
                        onClick={() => logOne(t)}
                        disabled={logging === t.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '7px 14px', borderRadius: 10, border: 'none',
                          background: 'var(--brand)', color: '#fff',
                          fontSize: 12, fontWeight: 700, cursor: logging === t.id ? 'default' : 'pointer',
                          opacity: logging === t.id ? 0.6 : 1, flexShrink: 0,
                          fontFamily: 'inherit',
                        }}
                      >
                        {logging === t.id ? 'Logging…' : <><Check size={12} /> Log it</>}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8 }}>
                  {due.length > 1 && (
                    <button
                      onClick={logAll}
                      className="btn-primary"
                      style={{ flex: 1, justifyContent: 'center', padding: '11px', fontSize: 13 }}
                    >
                      <Check size={14} /> Log all
                    </button>
                  )}
                  <button
                    onClick={dismiss}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '11px', fontSize: 13, fontWeight: 600, color: 'var(--text-2)',
                      background: 'var(--surface-2)', border: 'none', borderRadius: 12, cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  >
                    <SkipForward size={14} /> Skip for now
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
