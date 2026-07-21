'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, Plus, SlidersHorizontal, Eye, EyeOff, Search, X, PiggyBank, CalendarRange } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import TransactionList from '@/components/transactions/TransactionList'
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
  getLast6Months,
  getMonthLabel,
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
  const [typeFilter, setTypeFilter] = useState<FilterType>((searchParams.get('type') as FilterType) ?? 'all')
  const [catFilter, setCatFilter]   = useState<string>(searchParams.get('cat') ?? 'all')
  const [vehicleFilter, setVehicleFilter] = useState<string>(searchParams.get('vehicle') ?? 'all')
  const [searchQuery, setSearchQuery]   = useState<string>(searchParams.get('search') ?? '')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo,   setDateTo]   = useState<string>('')
  const [showIncome,    setShowIncome]   = useState(false)
  const [showExpenses,  setShowExpenses] = useState(false)
  const [showNet,       setShowNet]      = useState(false)
  const [mobileMasked,  setMobileMasked] = useState(true)

  const { transactions, borrowings, selectedMonth, settings } = useAppStore()

  const VISIBLE_COUNT = 100
  const [visibleCount, setVisibleCount] = useState(VISIBLE_COUNT)

  // Reset visible count when filters change
  useEffect(() => { setVisibleCount(VISIBLE_COUNT) }, [typeFilter, catFilter, vehicleFilter, searchQuery, selectedMonth, dateFrom, dateTo])
  const summary  = buildMonthlySummary(transactions, selectedMonth, settings, borrowings)
  const monthTxs = getTransactionsForMonth(transactions, selectedMonth, settings)

  const { carryForward, prevMonthLabel } = useMemo(() => {
    const months  = getLast6Months()
    const curIdx  = months.indexOf(selectedMonth)
    const prev    = curIdx > 0 ? months[curIdx - 1] : null
    const prevSum = prev ? buildMonthlySummary(transactions, prev, settings, borrowings) : null
    return {
      carryForward:   prevSum ? Math.max(0, prevSum.cashNet) : 0,
      prevMonthLabel: prev ? getMonthLabel(prev) : '',
    }
  }, [transactions, selectedMonth, settings, borrowings])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const usesDateFilter = dateFrom || dateTo
    const source = (q || usesDateFilter)
      ? [...transactions].sort((a, b) => b.date.localeCompare(a.date))
      : monthTxs
    return source.filter(t => {
      if (dateFrom && t.date < dateFrom) return false
      if (dateTo   && t.date > dateTo)   return false
      const savings = isSavingsTransfer(t)
      if (typeFilter === 'savings') {
        if (!savings) return false
        if (vehicleFilter !== 'all' && (t.savingsVehicle ?? '') !== vehicleFilter) return false
      } else {
        if (typeFilter === 'transfer' && !(t.type === 'transfer' && !savings)) return false
        if (typeFilter !== 'all' && typeFilter !== 'transfer' && t.type !== typeFilter) return false
        if (catFilter !== 'all' && t.category !== catFilter) return false
      }
      if (q) {
        const catDisplay = getCategoryDisplayName(t.category ?? '').toLowerCase()
        const notes      = (t.notes ?? '').toLowerCase()
        const category   = (t.category ?? '').toLowerCase()
        const amount     = String(t.amount)
        const kind       = (t.transferKind ?? '').replace(/_/g, ' ').toLowerCase()
        const vehicle    = (t.savingsVehicle ?? '').toLowerCase()
        if (
          !notes.includes(q) &&
          !category.includes(q) &&
          !catDisplay.includes(q) &&
          !amount.includes(q) &&
          !kind.includes(q) &&
          !vehicle.includes(q)
        ) return false
      }
      return true
    })
  }, [monthTxs, transactions, typeFilter, catFilter, vehicleFilter, searchQuery, dateFrom, dateTo])


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



  return (
    <AppShell title="Transactions">
      {/* ── Desktop 2-col / mobile single-col layout ── */}
      <div className="txn-layout anim-page" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>

        {/* Mobile summary strip — hidden on desktop */}
        <div className="flex flex-col lg:hidden" style={{ gap: 8 }}>
          {/* Strip header with eye toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInline: 2 }}>
            <span className="h-eyebrow">This month</span>
            <button
              onClick={() => setMobileMasked(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {mobileMasked ? <Eye size={14} /> : <EyeOff size={14} />}
              <span style={{ fontSize: 11, fontWeight: 600 }}>{mobileMasked ? 'Show' : 'Hide'}</span>
            </button>
          </div>

          <div className="grid grid-cols-3" style={{ gap: 10 }}>
            {/* Income */}
            <div className="card-sm" style={{ padding: '12px 14px' }}>
              <div className="h-eyebrow" style={{ marginBottom: 6 }}>Income</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--good-ink)', letterSpacing: '-0.015em', whiteSpace: 'nowrap' }}>
                {mobileMasked ? <span style={{ letterSpacing: '0.05em', color: 'var(--text-4)' }}>••••</span> : formatCurrencyFull(summary.totalIncome + summary.totalBorrowed + carryForward)}
              </div>
              {!mobileMasked && carryForward > 0 && (
                <div style={{ fontSize: 10, color: 'var(--brand-ink)', fontWeight: 600, marginTop: 3 }}>
                  ↩ {formatCurrencyFull(carryForward)} CF
                </div>
              )}
            </div>
            {/* Expenses */}
            <div className="card-sm" style={{ padding: '12px 14px' }}>
              <div className="h-eyebrow" style={{ marginBottom: 6 }}>Expenses</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--bad-ink)', letterSpacing: '-0.015em', whiteSpace: 'nowrap' }}>
                {mobileMasked ? <span style={{ letterSpacing: '0.05em', color: 'var(--text-4)' }}>••••</span> : formatCurrencyFull(summary.totalExpenses)}
              </div>
              {!mobileMasked && summary.savingsContributed > 0 && (
                <div style={{ fontSize: 10, color: 'var(--brand-ink)', fontWeight: 600, marginTop: 3 }}>
                  + {formatCurrencyFull(summary.savingsContributed)} saved
                </div>
              )}
            </div>
            {/* Net */}
            <div className="card-sm" style={{ padding: '12px 14px' }}>
              <div className="h-eyebrow" style={{ marginBottom: 6 }}>Net</div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.015em', whiteSpace: 'nowrap', color: (summary.cashNet + carryForward) >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)' }}>
                {mobileMasked
                  ? <span style={{ letterSpacing: '0.05em', color: 'var(--text-4)' }}>••••</span>
                  : <>{(summary.cashNet + carryForward) >= 0 ? '+' : '−'}{formatCurrencyFull(Math.abs(summary.cashNet + carryForward))}</>
                }
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--row-gap)' }}
             className="lg:txn-grid">
          {/* ── Left: filters + list ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)', minWidth: 0 }}>

            {/* Filter bar */}
            <div className="card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* ── Search input (all screen sizes) ── */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 12px', borderRadius: 11,
                border: `1px solid ${searchQuery ? 'var(--brand)' : 'var(--border)'}`,
                background: searchQuery ? 'var(--brand-soft)' : 'var(--surface-2)',
                transition: 'border-color .15s, background .15s',
              }}>
                <Search size={14} style={{ color: searchQuery ? 'var(--brand-ink)' : 'var(--text-4)', flexShrink: 0 }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by name, category, amount…"
                  style={{
                    border: 'none', background: 'transparent', outline: 'none', flex: 1,
                    fontSize: 13.5, color: 'var(--text)', fontFamily: 'inherit',
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0, color: 'var(--text-3)', flexShrink: 0 }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Type pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <SlidersHorizontal size={14} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
                <div style={{ display: 'flex', gap: 4, flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
                  {TYPE_OPTS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setTypeFilter(opt.id)}
                      style={{
                        padding: '6px 14px', borderRadius: 999, flexShrink: 0,
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

              {/* Sub-filters row: category/vehicle select + compact date range */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {(typeFilter !== 'transfer' && typeFilter !== 'savings') && (
                  <select
                    value={catFilter}
                    onChange={e => setCatFilter(e.target.value)}
                    style={{
                      fontSize: 13, padding: '7px 10px',
                      background: 'var(--surface-2)', border: '1px solid var(--border)',
                      borderRadius: 10, color: 'var(--text-2)', outline: 'none', cursor: 'pointer',
                      fontFamily: 'inherit',
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
                      fontSize: 13, padding: '7px 10px',
                      background: 'var(--surface-2)', border: '1px solid var(--border)',
                      borderRadius: 10, color: 'var(--text-2)', outline: 'none', cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <option value="all">All Vehicles</option>
                    {usedVehicles.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                )}

                {/* Compact date range — right side */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CalendarRange size={13} style={{ color: (dateFrom || dateTo) ? 'var(--brand-ink)' : 'var(--text-4)', flexShrink: 0 }} />
                  <input
                    type="date"
                    value={dateFrom}
                    max={dateTo || undefined}
                    onChange={e => setDateFrom(e.target.value)}
                    style={{
                      fontSize: 12, padding: '5px 7px',
                      background: dateFrom ? 'var(--brand-soft)' : 'var(--surface-2)',
                      border: `1px solid ${dateFrom ? 'var(--brand)' : 'var(--border)'}`,
                      borderRadius: 8, color: dateFrom ? 'var(--brand-ink)' : 'var(--text-3)',
                      outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      colorScheme: 'dark', width: 130,
                    }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-4)' }}>–</span>
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={e => setDateTo(e.target.value)}
                    style={{
                      fontSize: 12, padding: '5px 7px',
                      background: dateTo ? 'var(--brand-soft)' : 'var(--surface-2)',
                      border: `1px solid ${dateTo ? 'var(--brand)' : 'var(--border)'}`,
                      borderRadius: 8, color: dateTo ? 'var(--brand-ink)' : 'var(--text-3)',
                      outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      colorScheme: 'dark', width: 130,
                    }}
                  />
                  {(dateFrom || dateTo) && (
                    <button
                      onClick={() => { setDateFrom(''); setDateTo('') }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2, color: 'var(--text-3)', flexShrink: 0 }}
                      title="Clear dates"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
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
                  limit={visibleCount}
                  groupByDay
                  defaultExpandAll={catFilter !== 'all' || vehicleFilter !== 'all' || filtered.length > VISIBLE_COUNT}
                  showBorrowings={catFilter === 'all' && typeFilter === 'all' && !searchQuery.trim() && !dateFrom && !dateTo}
                />
                {filtered.length > visibleCount && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 0 4px' }}>
                    <p style={{ fontSize: 12, color: 'var(--text-4)', margin: 0 }}>
                      Showing {visibleCount} of {filtered.length}
                    </p>
                    <button
                      onClick={() => setVisibleCount(c => c + VISIBLE_COUNT)}
                      style={{
                        fontSize: 13, fontWeight: 600, padding: '8px 24px',
                        borderRadius: 999, border: '1px solid var(--border)',
                        background: 'var(--surface-2)', color: 'var(--text-2)',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Show more
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right: sticky summary sidebar (desktop only) ── */}
          <div className="hidden lg:flex" style={{ flexDirection: 'column', gap: 'var(--row-gap)', position: 'sticky', top: 0, alignSelf: 'start' }}>
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
                    {showIncome ? formatCurrencyFull(summary.totalIncome + summary.totalBorrowed + carryForward) : '₹ •••'}
                  </div>
                  {showIncome && summary.totalBorrowed > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--info-ink)', marginTop: 3 }}>incl. {formatCurrencyFull(summary.totalBorrowed)} borrowed</div>
                  )}
                  {showIncome && carryForward > 0 && (
                    <div style={{
                      marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 600, color: 'var(--brand-ink)',
                      background: 'var(--brand-soft)',
                      border: '1px solid color-mix(in oklch, var(--brand) 20%, transparent)',
                      borderRadius: 6, padding: '2px 8px',
                    }}>
                      ↩ {formatCurrencyFull(carryForward)} from {prevMonthLabel}
                    </div>
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
                  {showExpenses && summary.savingsContributed > 0 && (
                    <div style={{
                      marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 600, color: 'var(--brand-ink)',
                      background: 'var(--brand-soft)',
                      border: '1px solid color-mix(in oklch, var(--brand) 20%, transparent)',
                      borderRadius: 6, padding: '2px 8px',
                    }}>
                      <PiggyBank size={10} />
                      {formatCurrencyFull(summary.savingsContributed)} → savings
                    </div>
                  )}
                </div>

                <div style={{ height: 1, background: 'var(--hair)' }} />

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>Net cashflow</div>
                  <div className="display-num" style={{ fontSize: 26, color: (summary.cashNet + carryForward) >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)' }}>
                    {showNet ? `${(summary.cashNet + carryForward) >= 0 ? '+' : '−'}${formatCurrencyFull(Math.abs(summary.cashNet + carryForward))}` : '₹ •••'}
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
