'use client'

import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { ChevronLeft, ChevronRight, X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { IconChartBar, IconTrophy, IconCoin } from '@tabler/icons-react'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, formatCurrencyFull, getLast6Months } from '@/lib/utils'
import { format, subMonths, parseISO } from 'date-fns'

const STORAGE_KEY = 'recap_seen_month'

function getPrevMonth(): string {
  const d = subMonths(new Date(), 1)
  return format(d, 'yyyy-MM')
}

export default function MonthlyRecap() {
  const { transactions, emergencyFund, borrowings } = useAppStore()
  const [open, setOpen] = useState(false)
  const [slide, setSlide] = useState(0)

  const prevMonth = getPrevMonth()
  const currMonth = format(new Date(), 'yyyy-MM')

  const prevSummary = buildMonthlySummary(transactions, prevMonth)
  const twoMonthsAgo = format(subMonths(new Date(), 2), 'yyyy-MM')
  const twoAgoSummary = buildMonthlySummary(transactions, twoMonthsAgo)

  useEffect(() => {
    if (transactions.length === 0) return
    const seen = localStorage.getItem(STORAGE_KEY)
    if (seen === currMonth) return
    if (prevSummary.totalExpenses === 0 && prevSummary.totalIncome === 0) return
    setOpen(true)
  }, [transactions])

  function close() {
    localStorage.setItem(STORAGE_KEY, currMonth)
    setOpen(false)
  }

  const prevLabel = format(parseISO(`${prevMonth}-01`), 'MMMM yyyy')

  // Top spending category last month
  const topCategory = Object.entries(prevSummary.byCategory)
    .sort(([, a], [, b]) => b - a)[0]

  // Spending trend vs 2 months ago
  const spendDiff = prevSummary.totalExpenses - twoAgoSummary.totalExpenses
  const spendPct = twoAgoSummary.totalExpenses > 0
    ? Math.round((spendDiff / twoAgoSummary.totalExpenses) * 100)
    : null

  // Pending borrowings
  const pendingLent = borrowings
    .filter(b => b.type === 'lent' && b.status !== 'repaid')
    .reduce((s, b) => s + (b.amount - b.repaidAmount), 0)
  const pendingBorrowed = borrowings
    .filter(b => b.type === 'borrowed' && b.status !== 'repaid')
    .reduce((s, b) => s + (b.amount - b.repaidAmount), 0)

  const efPct = emergencyFund
    ? Math.round((emergencyFund.currentBalance / emergencyFund.targetAmount) * 100)
    : null

  const slides = [
    // Slide 0: Spending overview
    <div key="spend" className="text-center py-4 space-y-4">
      <div className="flex justify-center"><IconChartBar size={40} className="text-brand-500" stroke={1.5} /></div>
      <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{prevLabel} recap</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1a1d30]">
          <p className="text-xs text-slate-500 mb-1">Total Spent</p>
          <p className="text-xl font-bold text-red-500">{formatCurrencyFull(prevSummary.totalExpenses)}</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1a1d30]">
          <p className="text-xs text-slate-500 mb-1">Total Income</p>
          <p className="text-xl font-bold text-green-500">{formatCurrencyFull(prevSummary.totalIncome)}</p>
        </div>
      </div>
      <div className={`p-3 rounded-xl ${prevSummary.net >= 0 ? 'bg-green-50 dark:bg-green-900/10' : 'bg-red-50 dark:bg-red-900/10'}`}>
        <p className="text-xs text-slate-500 mb-0.5">Net</p>
        <p className={`text-2xl font-bold ${prevSummary.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {prevSummary.net >= 0 ? '+' : ''}{formatCurrencyFull(prevSummary.net)}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">{prevSummary.net >= 0 ? 'You saved money last month' : 'Spending exceeded income'}</p>
      </div>
    </div>,

    // Slide 1: Top category + trend
    <div key="category" className="text-center py-4 space-y-4">
      <div className="flex justify-center"><IconTrophy size={40} className="text-amber-500" stroke={1.5} /></div>
      <p className="text-lg font-bold text-slate-800 dark:text-slate-100">Biggest spend</p>
      {topCategory ? (
        <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/10">
          <p className="text-2xl font-bold text-orange-600">{topCategory[0]}</p>
          <p className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1">{formatCurrencyFull(topCategory[1])}</p>
          <p className="text-xs text-slate-400 mt-1">
            {prevSummary.totalExpenses > 0
              ? `${Math.round((topCategory[1] / prevSummary.totalExpenses) * 100)}% of total spending`
              : ''}
          </p>
        </div>
      ) : (
        <p className="text-slate-400 text-sm">No spending data</p>
      )}
      {spendPct !== null && (
        <div className="flex items-center justify-center gap-2 text-sm">
          {spendDiff > 0
            ? <TrendingUp size={16} className="text-red-500" />
            : spendDiff < 0
              ? <TrendingDown size={16} className="text-green-500" />
              : <Minus size={16} className="text-slate-400" />}
          <span className={spendDiff > 0 ? 'text-red-500' : spendDiff < 0 ? 'text-green-500' : 'text-slate-400'}>
            {spendDiff > 0 ? '+' : ''}{spendPct}% vs {format(parseISO(`${twoMonthsAgo}-01`), 'MMMM')}
          </span>
        </div>
      )}
    </div>,

    // Slide 2: Borrowings + emergency fund
    <div key="money" className="text-center py-4 space-y-4">
      <div className="flex justify-center"><IconCoin size={40} className="text-brand-500" stroke={1.5} /></div>
      <p className="text-lg font-bold text-slate-800 dark:text-slate-100">Money owed</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/10">
          <p className="text-xs text-red-500 mb-1">You owe</p>
          <p className="text-xl font-bold text-red-600">{formatCurrencyFull(pendingBorrowed)}</p>
        </div>
        <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/10">
          <p className="text-xs text-green-600 mb-1">Owed to you</p>
          <p className="text-xl font-bold text-green-600">{formatCurrencyFull(pendingLent)}</p>
        </div>
      </div>
      {emergencyFund && efPct !== null && (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1a1d30]">
          <p className="text-xs text-slate-500 mb-2">Emergency Fund</p>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all ${efPct >= 100 ? 'bg-green-500' : efPct >= 50 ? 'bg-brand-500' : 'bg-orange-500'}`}
              style={{ width: `${Math.min(efPct, 100)}%` }}
            />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{efPct}% of target</p>
          <p className="text-xs text-slate-400">{formatCurrencyFull(emergencyFund.currentBalance)} / {formatCurrencyFull(emergencyFund.targetAmount)}</p>
        </div>
      )}
    </div>,
  ]

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={close}>
        <Transition.Child as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child as={Fragment}
              enter="ease-out duration-300" enterFrom="opacity-0 scale-90"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200" leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-90"
            >
              <Dialog.Panel className="w-full max-w-sm bg-white dark:bg-[#0F1120] border border-slate-100 dark:border-[#1E2140] rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#1E2140]">
                  <div className="flex gap-1.5">
                    {slides.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setSlide(i)}
                        className={`h-1.5 rounded-full transition-all ${
                          i === slide ? 'w-5 bg-brand-500' : 'w-1.5 bg-slate-200 dark:bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                  <button onClick={close} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                    <X size={16} />
                  </button>
                </div>

                {/* Slide content */}
                <div className="px-5 min-h-[280px]">
                  {slides[slide]}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between px-4 py-4 border-t border-slate-100 dark:border-[#1E2140]">
                  <button
                    onClick={() => setSlide(s => Math.max(s - 1, 0))}
                    disabled={slide === 0}
                    className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  {slide < slides.length - 1 ? (
                    <button
                      onClick={() => setSlide(s => s + 1)}
                      className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors"
                    >
                      Next →
                    </button>
                  ) : (
                    <button
                      onClick={close}
                      className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors"
                    >
                      Start {format(new Date(), 'MMMM')} fresh
                    </button>
                  )}

                  <button
                    onClick={() => setSlide(s => Math.min(s + 1, slides.length - 1))}
                    disabled={slide === slides.length - 1}
                    className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={18} />
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
