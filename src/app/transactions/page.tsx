'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { TrendingUp, TrendingDown, Plus, Filter, Download } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import AddTransactionModal from '@/components/transactions/AddTransactionModal'
import { useAppStore } from '@/store/appStore'
import {
  buildMonthlySummary,
  formatCurrencyFull,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  getTransactionsForMonth,
  CATEGORY_COLORS,
} from '@/lib/utils'

export default function TransactionsPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [catFilter, setCatFilter] = useState<string>('all')

  const { transactions, selectedMonth } = useAppStore()
  const summary = buildMonthlySummary(transactions, selectedMonth)
  const monthTxs = getTransactionsForMonth(transactions, selectedMonth)

  const filtered = monthTxs.filter((t) => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false
    if (catFilter !== 'all' && t.category !== catFilter) return false
    return true
  })

  const allCats = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]

  function exportCSV() {
    const rows = [
      ['Date', 'Type', 'Category', 'Amount', 'Notes'],
      ...monthTxs.map((t) => [t.date, t.type, t.category, String(t.amount), t.notes]),
    ]
    const csv = rows.map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions-${selectedMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AppShell title="Transactions">
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card-sm">
            <p className="text-xs text-slate-500">Income</p>
            <p className="text-lg font-bold text-green-600">{formatCurrencyFull(summary.totalIncome)}</p>
          </div>
          <div className="card-sm">
            <p className="text-xs text-slate-500">Expenses</p>
            <p className="text-lg font-bold text-red-500">{formatCurrencyFull(summary.totalExpenses)}</p>
          </div>
          <div className={`card-sm ${summary.net < 0 ? 'bg-red-50' : ''}`}>
            <p className="text-xs text-slate-500">Net</p>
            <p className={`text-lg font-bold ${summary.net >= 0 ? 'text-brand-600' : 'text-red-500'}`}>
              {formatCurrencyFull(summary.net)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="card-sm">
          <div className="flex flex-wrap gap-2 items-center">
            <Filter size={14} className="text-slate-400" />
            <div className="flex gap-1">
              {(['all', 'income', 'expense'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    typeFilter === t ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="text-xs px-2 py-1.5 bg-slate-100 rounded-lg border-none focus:outline-none focus:ring-1 focus:ring-brand-400"
            >
              <option value="all">All Categories</option>
              {allCats.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              onClick={exportCSV}
              className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>

        {/* List */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
          </h3>
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-slate-400 text-sm">No transactions match your filters.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((tx) => {
                const color = CATEGORY_COLORS[tx.category] ?? '#94a3b8'
                return (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '20' }}>
                      {tx.type === 'income'
                        ? <TrendingUp size={16} style={{ color }} />
                        : <TrendingDown size={16} style={{ color }} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800 truncate">{tx.category}</span>
                        {tx.notes && <span className="text-xs text-slate-400 truncate hidden sm:block">— {tx.notes}</span>}
                      </div>
                      <p className="text-xs text-slate-400">{format(parseISO(tx.date), 'dd MMM yyyy')}</p>
                    </div>
                    <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-slate-800'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrencyFull(tx.amount)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setAddOpen(true)}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 w-14 h-14 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105"
      >
        <Plus size={24} />
      </button>
      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} />
    </AppShell>
  )
}
