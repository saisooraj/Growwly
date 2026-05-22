'use client'

import { useAppStore } from '@/store/appStore'
import { getTransactionsForWeek, formatCurrencyFull } from '@/lib/utils'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { CalendarClock } from 'lucide-react'

export default function WeeklyTracker() {
  const { transactions, settings } = useAppStore()
  const weeklyBudget = settings?.weeklyBudget ?? 0

  const weekTxs = getTransactionsForWeek(transactions).filter((t) => t.type === 'expense')
  const spent = weekTxs.reduce((s, t) => s + t.amount, 0)
  const remaining = weeklyBudget - spent
  const pct = weeklyBudget > 0 ? Math.min((spent / weeklyBudget) * 100, 100) : 0

  const now = new Date()
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'MMM d')
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'MMM d')

  const barColor = pct < 70 ? 'bg-green-500' : pct < 90 ? 'bg-yellow-400' : 'bg-red-500'

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarClock size={16} className="text-brand-500" />
          <h3 className="text-sm font-semibold text-slate-700">Weekly Spend</h3>
        </div>
        <span className="text-xs text-slate-400">{weekStart} – {weekEnd}</span>
      </div>

      {weeklyBudget > 0 ? (
        <>
          <div className="flex justify-between mb-2">
            <span className="text-2xl font-bold text-slate-800">{formatCurrencyFull(spent)}</span>
            <span className="text-sm text-slate-400 self-end">of {formatCurrencyFull(weeklyBudget)}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className={`text-xs font-medium ${remaining >= 0 ? 'text-slate-500' : 'text-red-500'}`}>
            {remaining >= 0
              ? `${formatCurrencyFull(remaining)} remaining`
              : `${formatCurrencyFull(Math.abs(remaining))} over budget`}
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-400">Set a weekly budget in Settings.</p>
      )}
    </div>
  )
}
