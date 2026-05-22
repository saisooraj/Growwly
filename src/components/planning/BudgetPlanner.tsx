'use client'

import { useState } from 'react'
import { setBudget } from '@/lib/firestore'
import { useAuth } from '@/context/AuthContext'
import { useAppStore } from '@/store/appStore'
import { useRefreshData } from '@/hooks/useData'
import { EXPENSE_CATEGORIES, formatCurrencyFull, buildMonthlySummary, getBudgetStatus, STATUS_COLORS } from '@/lib/utils'
import type { Category } from '@/types'
import toast from 'react-hot-toast'
import { Check, Edit2 } from 'lucide-react'

export default function BudgetPlanner() {
  const { user } = useAuth()
  const { budgets, transactions, selectedMonth } = useAppStore()
  const refresh = useRefreshData()
  const [editing, setEditing] = useState<Category | null>(null)
  const [inputVal, setInputVal] = useState('')

  const summary = buildMonthlySummary(transactions, selectedMonth)
  const monthBudgets = budgets.filter((b) => b.month === selectedMonth)
  const budgetMap = Object.fromEntries(monthBudgets.map((b) => [b.category, b.planned]))

  async function save(cat: Category) {
    if (!user) return
    try {
      await setBudget(user.uid, selectedMonth, cat, Number(inputVal) || 0)
      await refresh()
      setEditing(null)
      toast.success('Budget saved')
    } catch {
      toast.error('Failed to save')
    }
  }

  const totalPlanned = Object.values(budgetMap).reduce((s, v) => s + v, 0)
  const totalActual = summary.totalExpenses

  return (
    <div className="space-y-3">
      {/* Totals */}
      <div className="grid grid-cols-3 gap-3 mb-2">
        <div className="card-sm">
          <p className="text-xs text-slate-500 mb-1">Total Planned</p>
          <p className="text-lg font-bold text-slate-800">{formatCurrencyFull(totalPlanned)}</p>
        </div>
        <div className="card-sm">
          <p className="text-xs text-slate-500 mb-1">Total Actual</p>
          <p className="text-lg font-bold text-slate-800">{formatCurrencyFull(totalActual)}</p>
        </div>
        <div className={`card-sm ${totalActual > totalPlanned ? 'bg-red-50' : 'bg-green-50'}`}>
          <p className="text-xs text-slate-500 mb-1">Variance</p>
          <p className={`text-lg font-bold ${totalActual > totalPlanned ? 'text-red-600' : 'text-green-600'}`}>
            {totalActual > totalPlanned ? '-' : '+'}{formatCurrencyFull(Math.abs(totalPlanned - totalActual))}
          </p>
        </div>
      </div>

      {/* Category rows */}
      {EXPENSE_CATEGORIES.map((cat) => {
        const planned = budgetMap[cat] ?? 0
        const actual = summary.byCategory[cat] ?? 0
        const status = getBudgetStatus(actual, planned)
        const sc = STATUS_COLORS[status]
        const pct = planned > 0 ? Math.min((actual / planned) * 100, 100) : 0

        return (
          <div key={cat} className="card-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">{cat}</span>
                {planned > 0 && (
                  <span className={`badge ${sc.bg} ${sc.text}`}>{sc.label}</span>
                )}
              </div>

              {editing === cat ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">₹</span>
                  <input
                    type="number"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && save(cat)}
                    className="w-24 text-sm px-2 py-1 border border-brand-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                    autoFocus
                  />
                  <button onClick={() => save(cat)} className="p-1 rounded-lg bg-brand-100 text-brand-600 hover:bg-brand-200">
                    <Check size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditing(cat); setInputVal(String(planned || '')) }}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600"
                >
                  <Edit2 size={12} />
                  {planned > 0 ? formatCurrencyFull(planned) : 'Set budget'}
                </button>
              )}
            </div>

            {planned > 0 && (
              <>
                <div className="w-full bg-slate-100 rounded-full h-2 mb-1">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      status === 'on-track' ? 'bg-green-500' :
                      status === 'warning' ? 'bg-yellow-400' : 'bg-red-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Spent: {formatCurrencyFull(actual)}</span>
                  <span>Remaining: {formatCurrencyFull(Math.max(planned - actual, 0))}</span>
                </div>
              </>
            )}

            {planned === 0 && actual > 0 && (
              <p className="text-xs text-slate-400">Spent: {formatCurrencyFull(actual)} (no budget set)</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
