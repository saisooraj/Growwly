'use client'

import { AlertTriangle, TrendingDown, ShieldOff, ArrowDown, Flame, X } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, getTransactionsForWeek, formatCurrencyFull } from '@/lib/utils'
import { useState } from 'react'

interface Alert {
  id: string
  icon: typeof AlertTriangle
  colorVar: string
  bgVar: string
  message: string
}

export default function AlertsPanel() {
  const { transactions, selectedMonth, emergencyFund, budgets, settings, borrowings } = useAppStore()
  const [dismissed, setDismissed] = useState<string[]>([])

  const summary = buildMonthlySummary(transactions, selectedMonth)
  const alerts: Alert[] = []

  if (summary.net < 0) {
    alerts.push({
      id: 'deficit',
      icon: TrendingDown,
      colorVar: 'var(--bad-ink)',
      bgVar: 'var(--bad-soft)',
      message: `Cash deficit of ${formatCurrencyFull(Math.abs(summary.net))} this month — spending exceeds income.`,
    })
  }

  const monthBudgets = budgets.filter(b => b.month === selectedMonth)
  for (const b of monthBudgets) {
    const actual = summary.byCategory[b.category as keyof typeof summary.byCategory] ?? 0
    if (actual > b.planned && b.planned > 0) {
      alerts.push({
        id: `over-${b.category}`,
        icon: AlertTriangle,
        colorVar: 'var(--warn-ink)',
        bgVar: 'var(--warn-soft)',
        message: `${b.category} exceeded plan by ${formatCurrencyFull(actual - b.planned)}.`,
      })
    }
  }

  if (emergencyFund) {
    const pct = (emergencyFund.currentBalance / emergencyFund.targetAmount) * 100
    if (pct < 30) {
      alerts.push({
        id: 'ef-low',
        icon: ShieldOff,
        colorVar: 'var(--bad-ink)',
        bgVar: 'var(--bad-soft)',
        message: `Emergency fund is at ${pct.toFixed(0)}% — consider rebuilding.`,
      })
    }
  }

  const weeklyBudget = settings?.weeklyBudget ?? 0
  if (weeklyBudget > 0) {
    const weekSpent = getTransactionsForWeek(transactions)
      .filter(t => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)
    if (weekSpent > weeklyBudget) {
      alerts.push({
        id: 'weekly-over',
        icon: ArrowDown,
        colorVar: 'var(--warn-ink)',
        bgVar: 'var(--warn-soft)',
        message: `Weekly spending exceeded by ${formatCurrencyFull(weekSpent - weeklyBudget)}.`,
      })
    }
  }

  if (settings?.financialMode === 'high-expense') {
    const pendingBorrow = borrowings
      .filter(b => b.type === 'borrowed' && b.status !== 'repaid')
      .reduce((s, b) => s + (b.amount - b.repaidAmount), 0)
    if (pendingBorrow > 0) {
      alerts.push({
        id: 'high-borrow',
        icon: Flame,
        colorVar: 'var(--warn-ink)',
        bgVar: 'var(--warn-soft)',
        message: `High Expense Mode: ${formatCurrencyFull(pendingBorrow)} in pending borrowings. Plan repayment.`,
      })
    }
  }

  const visible = alerts.filter(a => !dismissed.includes(a.id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2">
      {visible.map(alert => (
        <div
          key={alert.id}
          className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: alert.bgVar }}
        >
          <alert.icon size={15} style={{ color: alert.colorVar, marginTop: 2, flexShrink: 0 }} />
          <p className="text-sm font-medium flex-1" style={{ color: alert.colorVar }}>
            {alert.message}
          </p>
          <button
            onClick={() => setDismissed(d => [...d, alert.id])}
            style={{ color: 'var(--text-3)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-2)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
