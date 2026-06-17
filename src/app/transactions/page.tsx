'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, Plus, SlidersHorizontal, Eye, EyeOff } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import TransactionList from '@/components/transactions/TransactionList'
import AddTransactionModal from '@/components/transactions/AddTransactionModal'
import { useAppStore } from '@/store/appStore'
import {
  buildMonthlySummary,
  formatCurrencyFull,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  getTransactionsForMonth,
} from '@/lib/utils'
import type { TransactionType } from '@/types'

const TYPE_OPTS: { id: TransactionType | 'all'; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'expense',  label: 'Expenses' },
  { id: 'income',   label: 'Income' },
  { id: 'transfer', label: 'Transfers' },
]

function TransactionsInner() {
  const searchParams = useSearchParams()
  const [addOpen, setAddOpen]       = useState(false)
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all')
  const [catFilter, setCatFilter]   = useState<string>(searchParams.get('cat') ?? 'all')
  const [showIncome,   setShowIncome]   = useState(false)
  const [showExpenses, setShowExpenses] = useState(false)
  const [showNet,      setShowNet]      = useState(false)

  const { transactions, borrowings, selectedMonth, settings } = useAppStore()
  const summary  = buildMonthlySummary(transactions, selectedMonth, settings, borrowings)
  const monthTxs = getTransactionsForMonth(transactions, selectedMonth, settings)

  const filtered = useMemo(() => {
    return monthTxs.filter(t => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      if (catFilter  !== 'all' && t.category !== catFilter) return false
      return true
    })
  }, [monthTxs, typeFilter, catFilter])

  const allCats = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]

  function exportCSV() {
    const rows = [
      ['Date', 'Type', 'Category', 'Transfer Kind', 'Amount', 'Notes'],
      ...monthTxs.map(t => [t.date, t.type, t.category, t.transferKind ?? '', String(t.amount), t.notes]),
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `transactions-${selectedMonth}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AppShell title="Transactions">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>

        {/* Summary KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 'var(--row-gap)' }}>
          {/* Income */}
          <div className="card-sm" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="h-eyebrow">Income</span>
              <button onClick={() => setShowIncome(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-3)', display: 'flex' }}>
                {showIncome ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <div className="display-num" style={{ fontSize: 22, color: 'var(--good-ink)' }}>
              {showIncome ? formatCurrencyFull(summary.totalIncome + summary.totalBorrowed) : '₹ •••'}
            </div>
            {showIncome && summary.totalBorrowed > 0 && (
              <div style={{ fontSize: 11, color: 'var(--info-ink)', marginTop: 4, fontStyle: 'italic' }}>
                incl. {formatCurrencyFull(summary.totalBorrowed)} borrowed
              </div>
            )}
          </div>

          {/* Expenses */}
          <div className="card-sm" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="h-eyebrow">Expenses</span>
              <button onClick={() => setShowExpenses(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-3)', display: 'flex' }}>
                {showExpenses ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <div className="display-num" style={{ fontSize: 22, color: 'var(--bad-ink)' }}>
              {showExpenses ? formatCurrencyFull(summary.totalExpenses) : '₹ •••'}
            </div>
          </div>

          {/* Net (true cashflow) */}
          <div className="card-sm" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="h-eyebrow">Net cashflow</span>
              <button onClick={() => setShowNet(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-3)', display: 'flex' }}>
                {showNet ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <div className="display-num" style={{ fontSize: 22, color: summary.cashNet >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)' }}>
              {showNet ? `${summary.cashNet >= 0 ? '+' : '−'}${formatCurrencyFull(Math.abs(summary.cashNet))}` : '₹ •••'}
            </div>
            {showNet && (summary.lentOutstanding > 0 || summary.borrowedOutstanding > 0) && (
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {summary.lentOutstanding > 0 && (
                  <span>−{formatCurrencyFull(summary.lentOutstanding)} <span style={{ color: 'var(--warn-ink)' }}>lent</span></span>
                )}
                {summary.borrowedOutstanding > 0 && (
                  <span>+{formatCurrencyFull(summary.borrowedOutstanding)} <span style={{ color: 'var(--info-ink)' }}>borrowed</span></span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="card-sm" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <SlidersHorizontal size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />

          {/* Type filter pills */}
          <div style={{ display: 'flex', gap: 4 }}>
            {TYPE_OPTS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setTypeFilter(opt.id)}
                style={{
                  padding: '4px 12px', borderRadius: 999,
                  fontSize: 12, fontWeight: 500,
                  border: typeFilter === opt.id ? 'none' : '1px solid var(--border)',
                  background: typeFilter === opt.id ? 'var(--text)' : 'transparent',
                  color: typeFilter === opt.id ? 'var(--bg)' : 'var(--text-2)',
                  cursor: 'pointer', transition: 'all .15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Category filter (hidden for transfer/all) */}
          {typeFilter !== 'transfer' && (
            <select
              value={catFilter}
              onChange={e => setCatFilter(e.target.value)}
              style={{
                fontSize: 12, padding: '5px 10px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text-2)',
                outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="all">All Categories</option>
              {allCats.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          <button
            onClick={exportCSV}
            className="btn btn-sm btn-ghost"
            style={{ marginLeft: 'auto', gap: 6 }}
          >
            <Download size={13} /> Export CSV
          </button>
        </div>

        {/* Transaction list */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
              {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Click any row to view or edit</span>
          </div>
          <div style={{ padding: '8px 8px' }}>
            <TransactionList
            transactions={filtered}
            groupByDay
            defaultExpandAll={catFilter !== 'all'}
            showBorrowings={catFilter === 'all' && typeFilter === 'all'}
          />
          </div>
        </div>

      </div>

      {/* FAB */}
      <button
        onClick={() => setAddOpen(true)}
        className="fixed right-4 bottom-24 lg:right-6 lg:bottom-6 z-40 flex items-center justify-center"
        style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--text)', color: 'var(--bg)',
          border: 'none', cursor: 'pointer',
          boxShadow: 'var(--shadow-lg), 0 0 0 6px color-mix(in oklch, var(--text) 8%, transparent)',
          transition: 'transform .12s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <Plus size={24} />
      </button>

      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} />
    </AppShell>
  )
}

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsInner />
    </Suspense>
  )
}
