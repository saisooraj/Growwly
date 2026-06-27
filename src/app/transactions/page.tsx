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
  buildSavingsByVehicle,
  isSavingsTransfer,
  formatCurrencyFull,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  getTransactionsForMonth,
  CATEGORY_COLORS,
} from '@/lib/utils'
import type { TransactionType } from '@/types'
import { getCategoryDisplayName, getSavingsVehicleMeta } from '@/lib/categoryIcons'

type FilterType = TransactionType | 'all' | 'savings'

const TYPE_OPTS: { id: FilterType; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'expense',  label: 'Expenses' },
  { id: 'income',   label: 'Income' },
  { id: 'savings',  label: 'Savings' },
  { id: 'transfer', label: 'Transfers' },
]

function TransactionsInner() {
  const searchParams = useSearchParams()
  const [addOpen, setAddOpen]       = useState(false)
  const [typeFilter, setTypeFilter] = useState<FilterType>((searchParams.get('type') as FilterType) ?? 'all')
  const [catFilter, setCatFilter]   = useState<string>(searchParams.get('cat') ?? 'all')
  const [vehicleFilter, setVehicleFilter] = useState<string>(searchParams.get('vehicle') ?? 'all')
  const [showIncome,   setShowIncome]   = useState(false)
  const [showExpenses, setShowExpenses] = useState(false)
  const [showNet,      setShowNet]      = useState(false)

  const { transactions, borrowings, selectedMonth, settings } = useAppStore()
  const summary  = buildMonthlySummary(transactions, selectedMonth, settings, borrowings)
  const monthTxs = getTransactionsForMonth(transactions, selectedMonth, settings)

  const filtered = useMemo(() => {
    return monthTxs.filter(t => {
      const savings = isSavingsTransfer(t)
      if (typeFilter === 'savings') {
        if (!savings) return false
        if (vehicleFilter !== 'all' && (t.savingsVehicle ?? '') !== vehicleFilter) return false
        return true
      }
      if (typeFilter === 'transfer') return t.type === 'transfer' && !savings  // loans only
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      if (catFilter  !== 'all' && t.category !== catFilter) return false
      return true
    })
  }, [monthTxs, typeFilter, catFilter, vehicleFilter])

  // Savings aggregates (selected month, respecting the vehicle sub-filter)
  const savingsView = useMemo(() => {
    const openingBalances = settings?.savingsOpeningBalances ?? {}
    const inScope = monthTxs.filter(t => isSavingsTransfer(t) && (vehicleFilter === 'all' || (t.savingsVehicle ?? '') === vehicleFilter))
    let contributed = 0, withdrawn = 0
    for (const t of inScope) {
      if (t.transferKind === 'savings_withdrawal' || t.transferKind === 'ef_withdrawal') withdrawn += t.amount
      else contributed += t.amount
    }
    const allTime = buildSavingsByVehicle(transactions, openingBalances)
    const balance = vehicleFilter === 'all'
      ? Object.values(allTime).reduce((s, v) => s + v.balance, 0)
      : (allTime[vehicleFilter]?.balance ?? 0)
    return { contributed, withdrawn, net: contributed - withdrawn, balance }
  }, [monthTxs, transactions, vehicleFilter, settings])

  // Vehicles the user has actually used (for the sub-filter dropdown)
  const usedVehicles = useMemo(
    () => Object.keys(buildSavingsByVehicle(transactions, settings?.savingsOpeningBalances ?? {})).sort((a, b) => a.localeCompare(b)),
    [transactions, settings]
  )

  const customCats = settings?.customCategories ?? []
  const allCats = [
    ...EXPENSE_CATEGORIES,
    ...INCOME_CATEGORIES,
    ...customCats.filter(c => ![...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].includes(c)),
  ].sort((a, b) => getCategoryDisplayName(a).localeCompare(getCategoryDisplayName(b)))

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

  // Top expense categories for sidebar
  const topCats = useMemo(() =>
    Object.entries(summary.byCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5),
    [summary.byCategory]
  )
  const topCatsTotal = topCats.reduce((s, [, v]) => s + v, 0) || 1

  // Reusable KPI stat block
  function StatBlock({
    label, value, color, masked, onToggle, shown, sub,
  }: { label: string; value: string | null; color: string; masked: boolean; onToggle: () => void; shown: boolean; sub?: React.ReactNode }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="h-eyebrow">{label}</span>
          <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-3)', display: 'flex' }}>
            {shown ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
        <div className="display-num" style={{ fontSize: 22, color }}>{shown && value ? value : '₹ •••'}</div>
        {sub}
      </div>
    )
  }

  return (
    <AppShell title="Transactions">
      {/* ── Desktop 2-col / mobile single-col layout ── */}
      <div className="txn-layout anim-page" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>

        {/* Mobile summary strip — hidden on desktop */}
        <div className="grid grid-cols-3 lg:hidden" style={{ gap: 10 }}>
          {[
            { label: 'Income',   value: formatCurrencyFull(summary.totalIncome), color: 'var(--good-ink)' },
            { label: 'Expenses', value: formatCurrencyFull(summary.totalExpenses), color: 'var(--bad-ink)' },
            { label: 'Net',      value: `${summary.cashNet >= 0 ? '+' : '−'}${formatCurrencyFull(Math.abs(summary.cashNet))}`, color: summary.cashNet >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)' },
          ].map(s => (
            <div key={s.label} className="card-sm" style={{ padding: '12px 14px' }}>
              <div className="h-eyebrow" style={{ marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: s.color, letterSpacing: '-0.015em' }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--row-gap)' }}
             className="lg:txn-grid">
          {/* ── Left: filters + list ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)', minWidth: 0 }}>

            {/* Filter bar */}
            <div className="card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Type pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <SlidersHorizontal size={14} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
                  {TYPE_OPTS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setTypeFilter(opt.id)}
                      style={{
                        padding: '6px 14px', borderRadius: 999,
                        fontSize: 12.5, fontWeight: 600,
                        border: 'none',
                        background: typeFilter === opt.id ? 'var(--text)' : 'var(--surface-2)',
                        color: typeFilter === opt.id ? 'var(--bg)' : 'var(--text-2)',
                        cursor: 'pointer', transition: 'background .15s, color .15s',
                        fontFamily: 'inherit',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button onClick={exportCSV} className="btn btn-sm btn-ghost" style={{ gap: 5, flexShrink: 0 }}>
                  <Download size={13} /> Export
                </button>
              </div>

              {/* Sub-filters row */}
              {(typeFilter !== 'transfer' && typeFilter !== 'savings') && (
                <select
                  value={catFilter}
                  onChange={e => setCatFilter(e.target.value)}
                  style={{
                    fontSize: 13, padding: '8px 12px',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 10, color: 'var(--text-2)', outline: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', maxWidth: 280,
                  }}
                >
                  <option value="all">All Categories</option>
                  {allCats.map(c => (
                    <option key={c} value={c}>{getCategoryDisplayName(c)}</option>
                  ))}
                </select>
              )}
              {typeFilter === 'savings' && usedVehicles.length > 0 && (
                <select
                  value={vehicleFilter}
                  onChange={e => setVehicleFilter(e.target.value)}
                  style={{
                    fontSize: 13, padding: '8px 12px',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 10, color: 'var(--text-2)', outline: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', maxWidth: 280,
                  }}
                >
                  <option value="all">All Vehicles</option>
                  {usedVehicles.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Savings summary */}
            {typeFilter === 'savings' && (
              <div className="card-sm" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                {(() => {
                  const meta = vehicleFilter !== 'all' ? getSavingsVehicleMeta(vehicleFilter) : null
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 160 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: (meta?.color ?? 'var(--brand)') + '20' }}>
                        {meta ? <meta.Icon size={18} color={meta.color} stroke={1.5} /> : <span style={{ color: 'var(--brand)' }}>₹</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{vehicleFilter === 'all' ? 'Total saved (all-time)' : `${vehicleFilter} · balance`}</div>
                        <div className="display-num" style={{ fontSize: 20 }}>{formatCurrencyFull(savingsView.balance)}</div>
                      </div>
                    </div>
                  )
                })()}
                <div style={{ display: 'flex', gap: 18 }}>
                  {[
                    { label: 'In', value: `+${formatCurrencyFull(savingsView.contributed)}`, color: 'var(--good-ink)' },
                    { label: 'Out', value: `−${formatCurrencyFull(savingsView.withdrawn)}`, color: 'var(--bad-ink)' },
                    { label: 'Net', value: `${savingsView.net >= 0 ? '+' : '−'}${formatCurrencyFull(Math.abs(savingsView.net))}`, color: savingsView.net >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)' },
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transaction list */}
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Tap any row to edit</span>
              </div>
              <div style={{ padding: '8px 8px' }}>
                <TransactionList
                  transactions={filtered}
                  groupByDay
                  defaultExpandAll={catFilter !== 'all' || vehicleFilter !== 'all'}
                  showBorrowings={catFilter === 'all' && typeFilter === 'all'}
                />
              </div>
            </div>
          </div>

          {/* ── Right: sticky summary sidebar (desktop only) ── */}
          <div className="hidden lg:flex" style={{ flexDirection: 'column', gap: 'var(--row-gap)', position: 'sticky', top: 96, alignSelf: 'start' }}>
            {/* KPI card */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <span className="h-eyebrow">This month</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--good-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Plus size={13} style={{ color: 'var(--good-ink)', transform: 'rotate(0deg)' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>Money in</span>
                    <button onClick={() => setShowIncome(v => !v)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', display: 'flex' }}>
                      {showIncome ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>
                  <div className="display-num" style={{ fontSize: 26, color: 'var(--good-ink)' }}>
                    {showIncome ? formatCurrencyFull(summary.totalIncome + summary.totalBorrowed) : '₹ •••'}
                  </div>
                  {showIncome && summary.totalBorrowed > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--info-ink)', marginTop: 3 }}>incl. {formatCurrencyFull(summary.totalBorrowed)} borrowed</div>
                  )}
                </div>

                <div style={{ height: 1, background: 'var(--hair)' }} />

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Plus size={13} style={{ color: 'var(--text-3)', transform: 'rotate(45deg)' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>Money out</span>
                    <button onClick={() => setShowExpenses(v => !v)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', display: 'flex' }}>
                      {showExpenses ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>
                  <div className="display-num" style={{ fontSize: 26, color: 'var(--text)' }}>
                    {showExpenses ? formatCurrencyFull(summary.totalExpenses) : '₹ •••'}
                  </div>
                </div>

                <div style={{ height: 1, background: 'var(--hair)' }} />

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>Net cashflow</div>
                  <div className="display-num" style={{ fontSize: 26, color: summary.cashNet >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)' }}>
                    {showNet ? `${summary.cashNet >= 0 ? '+' : '−'}${formatCurrencyFull(Math.abs(summary.cashNet))}` : '₹ •••'}
                  </div>
                  <button onClick={() => setShowNet(v => !v)} style={{ marginTop: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: 0 }}>
                    {showNet ? <><EyeOff size={11} /> Hide</> : <><Eye size={11} /> Show</>}
                  </button>
                </div>
              </div>
            </div>

            {/* Top categories */}
            {topCats.length > 0 && typeFilter !== 'income' && typeFilter !== 'savings' && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <span className="h-eyebrow">Top categories</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {topCats.map(([cat, amt]) => {
                    const barPct = (amt / topCatsTotal) * 100
                    const color = CATEGORY_COLORS[cat] ?? '#94a3b8'
                    return (
                      <div key={cat}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>{getCategoryDisplayName(cat)}</span>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{formatCurrencyFull(amt)}</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${barPct}%`, background: color, borderRadius: 999 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop-only FAB */}
      <button
        onClick={() => setAddOpen(true)}
        className="hidden lg:flex fixed right-6 bottom-6 z-40 items-center gap-2"
        style={{
          padding: '12px 20px', borderRadius: 16,
          background: 'linear-gradient(150deg, var(--brand-2), var(--brand))',
          color: '#fff', border: 'none', cursor: 'pointer',
          fontSize: 14, fontWeight: 700,
          boxShadow: '0 8px 24px -6px var(--brand)',
          transition: 'transform .12s ease',
          fontFamily: 'inherit',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1.03)')}
      >
        <Plus size={18} strokeWidth={2.6} /> Add transaction
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
