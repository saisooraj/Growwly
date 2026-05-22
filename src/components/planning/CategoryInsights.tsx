'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, EXPENSE_CATEGORIES, formatCurrencyFull } from '@/lib/utils'
import { format, subMonths, parseISO } from 'date-fns'

export default function CategoryInsights() {
  const { transactions, selectedMonth } = useAppStore()

  const prevMonthDate = subMonths(parseISO(`${selectedMonth}-01`), 1)
  const prevMonth = format(prevMonthDate, 'yyyy-MM')

  const currSummary = buildMonthlySummary(transactions, selectedMonth)
  const prevSummary = buildMonthlySummary(transactions, prevMonth)

  const rows = EXPENSE_CATEGORIES
    .map(cat => {
      const curr = currSummary.byCategory[cat] ?? 0
      const prev = prevSummary.byCategory[cat] ?? 0
      const diff = curr - prev
      const pct = prev > 0 ? Math.round((diff / prev) * 100) : null
      return { cat, curr, prev, diff, pct }
    })
    .filter(r => r.curr > 0 || r.prev > 0)
    .sort((a, b) => b.curr - a.curr)

  if (rows.length === 0) {
    return (
      <div className="card text-center py-8">
        <p className="text-sm text-slate-400">No spending data to compare yet.</p>
      </div>
    )
  }

  const prevLabel = format(prevMonthDate, 'MMM')
  const currLabel = format(parseISO(`${selectedMonth}-01`), 'MMM')

  return (
    <div className="card space-y-1">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Month-over-Month</h3>
        <span className="text-xs text-slate-400">{prevLabel} → {currLabel}</span>
      </div>

      {rows.map(({ cat, curr, prev, diff, pct }) => {
        const isUp = diff > 0
        const isDown = diff < 0
        const isSame = diff === 0
        const isAnomaly = pct !== null && Math.abs(pct) >= 50 && curr > 1000

        return (
          <div
            key={cat}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${
              isAnomaly && isUp ? 'bg-red-50 dark:bg-red-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{cat}</p>
              <p className="text-xs text-slate-400">
                {prev > 0 ? formatCurrencyFull(prev) : '—'} → {curr > 0 ? formatCurrencyFull(curr) : '—'}
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isUp && <TrendingUp size={14} className={isAnomaly ? 'text-red-500' : 'text-orange-400'} />}
              {isDown && <TrendingDown size={14} className="text-green-500" />}
              {isSame && <Minus size={14} className="text-slate-400" />}

              <span className={`text-xs font-semibold ${
                isUp ? (isAnomaly ? 'text-red-600' : 'text-orange-500') :
                isDown ? 'text-green-600' : 'text-slate-400'
              }`}>
                {pct !== null
                  ? `${isUp ? '+' : ''}${pct}%`
                  : prev === 0 && curr > 0
                    ? 'New'
                    : prev > 0 && curr === 0
                      ? '−100%'
                      : '—'
                }
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
