'use client'

import { useState } from 'react'
import { ArrowUp, ArrowDown, ArrowDownRight, Handshake, Eye, EyeOff } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, formatCurrencyFull, getLast6Months } from '@/lib/utils'
import { getCycleRange, formatCycleRange } from '@/lib/cycle'

interface StatProps {
  label: string
  dateRange?: string
  value: string
  sub: string
  hint?: string
  tone?: 'good' | 'bad' | 'warn' | 'info' | 'neutral'
  icon: React.ReactNode
  maskable?: boolean
  masked?: boolean
  maskSub?: boolean
  onToggleMask?: () => void
}

function Stat({ label, dateRange, value, sub, hint, tone = 'neutral', icon, maskable, masked, maskSub, onToggleMask }: StatProps) {
  const accentColor =
    tone === 'good'    ? 'var(--good)'     :
    tone === 'bad'     ? 'var(--bad)'      :
    tone === 'warn'    ? 'var(--warn)'     :
    tone === 'info'    ? 'var(--info)'     :
    'var(--text-3)'

  const valueColor =
    tone === 'good'    ? 'var(--good-ink)' :
    tone === 'bad'     ? 'var(--bad-ink)'  :
    tone === 'warn'    ? 'var(--warn-ink)' :
    tone === 'info'    ? 'var(--info-ink)' :
    'var(--text)'

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <span className="h-eyebrow">{label}</span>
          {dateRange && (
            <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 2, fontWeight: 400, letterSpacing: 0 }}>
              {dateRange}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {maskable && (
            <button
              onClick={onToggleMask}
              style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-2)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
            >
              {masked ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
          )}
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
      </div>
      <div className="display-num" style={{ fontSize: 'clamp(18px, 5.5vw, 30px)', lineHeight: 1, color: valueColor }}>
        {masked ? '₹ ••••••' : value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
        {masked && maskSub ? '•••••••' : sub}
      </div>
      {hint && !masked && (
        <div style={{ fontSize: 11, color: 'var(--info-ink)', marginTop: -8, fontStyle: 'italic' }}>
          {hint}
        </div>
      )}
    </div>
  )
}

export default function SummaryCards() {
  const [maskIncome, setMaskIncome]   = useState(true)
  const [maskExpense, setMaskExpense] = useState(true)
  const [maskNet, setMaskNet]         = useState(true)
  const [maskOwed, setMaskOwed]       = useState(true)
  const { transactions, selectedMonth, budgets, borrowings, settings } = useAppStore()

  const months = getLast6Months()
  const curIdx = months.indexOf(selectedMonth)
  const prevMonth = curIdx > 0 ? months[curIdx - 1] : null

  const cur  = buildMonthlySummary(transactions, selectedMonth, settings, borrowings)
  const prev = prevMonth ? buildMonthlySummary(transactions, prevMonth, settings, borrowings) : null

  const { start, end } = getCycleRange(selectedMonth, settings)
  const cycleLabel = settings?.salaryCycleRule && settings.salaryCycleRule !== 'none'
    ? formatCycleRange(start, end)
    : null

  const totalBudget = budgets.filter(b => b.month === selectedMonth).reduce((s, b) => s + b.planned, 0)

  const incomeChange = prev && prev.totalIncome > 0
    ? ((cur.totalIncome - prev.totalIncome) / prev.totalIncome * 100).toFixed(1)
    : null

  const expenseChange = prev && prev.totalExpenses > 0
    ? ((cur.totalExpenses - prev.totalExpenses) / prev.totalExpenses * 100).toFixed(1)
    : null

  const pendingBorrow = borrowings
    .filter(b => b.type === 'lent' && b.status !== 'repaid')
    .reduce((s, b) => s + (b.amount - b.repaidAmount), 0)

  const pendingBorrowCount = borrowings
    .filter(b => b.type === 'lent' && b.status !== 'repaid').length

  const carryForward  = prev ? Math.max(0, prev.cashNet) : 0
  const netCashflow   = cur.cashNet + carryForward
  const isDeficit     = netCashflow < 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--row-gap)' }}>
      <Stat
        label="Income"
        dateRange={cycleLabel ?? undefined}
        value={formatCurrencyFull(cur.totalIncome + cur.totalBorrowed + carryForward)}
        sub={incomeChange !== null ? `${Number(incomeChange) > 0 ? '+' : ''}${incomeChange}% vs last month` : 'This month'}
        hint={cur.totalBorrowed > 0 ? `incl. ${formatCurrencyFull(cur.totalBorrowed)} borrowed` : undefined}
        tone="good"
        icon={<ArrowUp size={14} />}
        maskable
        masked={maskIncome}
        onToggleMask={() => setMaskIncome(v => !v)}
      />
      <Stat
        label="Expenses"
        dateRange={cycleLabel ?? undefined}
        value={formatCurrencyFull(cur.totalExpenses)}
        sub={totalBudget > 0 ? `vs ${formatCurrencyFull(totalBudget)} planned` : (expenseChange !== null ? `${Number(expenseChange) > 0 ? '+' : ''}${expenseChange}% vs last month` : 'This month')}
        tone="bad"
        icon={<ArrowDown size={14} />}
        maskable
        masked={maskExpense}
        maskSub={totalBudget > 0}
        onToggleMask={() => setMaskExpense(v => !v)}
      />
      <Stat
        label="Net cashflow"
        dateRange={cycleLabel ?? undefined}
        value={formatCurrencyFull(Math.abs(netCashflow))}
        sub={isDeficit ? 'Deficit — burning savings' : 'Surplus this month'}
        hint={carryForward > 0 ? `incl. ${formatCurrencyFull(carryForward)} from last month` : undefined}
        tone={isDeficit ? 'bad' : 'good'}
        icon={<ArrowDownRight size={14} />}
        maskable
        masked={maskNet}
        onToggleMask={() => setMaskNet(v => !v)}
      />
      <Stat
        label="Owed to you"
        value={formatCurrencyFull(pendingBorrow)}
        sub={pendingBorrow > 0 ? `${pendingBorrowCount} record${pendingBorrowCount !== 1 ? 's' : ''} pending` : 'All clear'}
        tone={pendingBorrow > 0 ? 'warn' : 'neutral'}
        icon={<Handshake size={14} />}
        maskable
        masked={maskOwed}
        onToggleMask={() => setMaskOwed(v => !v)}
      />
    </div>
  )
}
