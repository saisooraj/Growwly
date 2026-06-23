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

  const recurringTemplates = transactions.filter(t => t.isRecurring && t.recurringDay)

  return recurringTemplates.filter(template => {
    const alreadyLogged = transactions.some(
      t =>
        t.isRecurring &&
        t.category === template.category &&
        t.notes === template.notes &&
        t.amount === template.amount &&
        t.date.startsWith(currentMonth) &&
        t.id !== template.id
    )
    if (alreadyLogged) return false

    // Don't prompt for the same month the template was created
    if (template.date.startsWith(currentMonth)) return false

    // Only prompt after the due day has passed this month
    return today.getDate() >= (template.recurringDay ?? 1)
  })
  // Deduplicate by category+notes+amount (keep the most recent template)
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
    if (dueItems.length > 0) {
      setDue(dueItems)
      setOpen(true)
    }
  }, [transactions])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, getCurrentMonth())
    setOpen(false)
  }

  async function logOne(template: Transaction) {
    if (!user) return
    setLogging(template.id)
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      await addTransaction(user.uid, {
        type: template.type,
        amount: template.amount,
        category: template.category,
        date: today,
        notes: template.notes,
        isRecurring: true,
        recurringDay: template.recurringDay,
        ...(template.projectId ? { projectId: template.projectId } : {}),
      })
      setDue(prev => prev.filter(t => t.id !== template.id))
      toast.success(`Logged ${template.category}`)
      if (due.length <= 1) {
        dismiss()
        await refresh()
      }
    } catch {
      toast.error('Failed to log')
    } finally {
      setLogging(null)
    }
  }

  async function logAll() {
    if (!user) return
    for (const t of due) {
      await logOne(t)
    }
    await refresh()
  }

  if (due.length === 0) return null

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={dismiss}>
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
                <div className="px-5 py-4 border-b border-slate-100 dark:border-[#1E2140]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                      <RefreshCw size={15} className="text-brand-600" />
                    </div>
                    <div>
                      <Dialog.Title className="text-base font-semibold text-slate-800 dark:text-slate-100">
                        Recurring transactions due
                      </Dialog.Title>
                      <p className="text-xs text-slate-400">{due.length} item{due.length > 1 ? 's' : ''} to log this month</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  {due.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#1a1d30]">
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{getCategoryDisplayName(t.category)}</p>
                        {t.notes && <p className="text-xs text-slate-400">{t.notes}</p>}
                        <p className="text-xs text-slate-400 mt-0.5">
                          {t.type === 'expense' ? 'Expense' : 'Income'} · {formatCurrencyFull(t.amount)}
                        </p>
                      </div>
                      <button
                        onClick={() => logOne(t)}
                        disabled={logging === t.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium disabled:opacity-50 transition-colors"
                      >
                        {logging === t.id ? (
                          <span>Logging...</span>
                        ) : (
                          <><Check size={12} /> Log it</>
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="px-4 pb-4 flex gap-2">
                  {due.length > 1 && (
                    <button
                      onClick={logAll}
                      className="flex-1 btn-primary justify-center py-2.5 text-sm"
                    >
                      <Check size={14} /> Log all
                    </button>
                  )}
                  <button
                    onClick={dismiss}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
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
