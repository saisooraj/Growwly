'use client'

import { AlertTriangle, TrendingDown, ShieldOff, ArrowDown, Flame, X } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, getTransactionsForWeek } from '@/lib/utils'
import { formatCurrencyFull } from '@/lib/utils'
import { useState } from 'react'

interface Alert {
  id: string
  icon: typeof AlertTriangle
  color: string
  bg: string
  message: string
}

export default function AlertsPanel() {
  const { transactions, selectedMonth, emergencyFund, budgets, settings, borrowings } = useAppStore()
  const [dismissed, setDismissed] = useState<string[]>([])

  const summary = buildMonthlySummary(transactions, selectedMonth)
  const alerts: Alert[] = []

  // Deficit alert
  if (summary.net < 0) {
    alerts.push({
      id: 'deficit',
      icon: TrendingDown,
      color: 'text-red-600',
      bg: 'bg-red-50',
      message: `Cash deficit of ${formatCurrencyFull(Math.abs(summary.net))} this month — spending exceeds income.`,
    })
  }

  // Overspend per category
  const monthBudgets = budgets.filter((b) => b.month === selectedMonth)
  for (const b of monthBudgets) {
    const actual = summary.byCategory[b.category as keyof typeof summary.byCategory] ?? 0
    if (actual > b.planned && b.planned > 0) {
      alerts.push({
        id: `over-${b.category}`,
        icon: AlertTriangle,
        color: 'text-orange-600',
        bg: 'bg-orange-50',
        message: `${b.category} exceeded plan by ${formatCurrencyFull(actual - b.planned)}.`,
      })
    }
  }

  // Emergency fund low
  if (emergencyFund) {
    const pct = (emergencyFund.currentBalance / emergencyFund.targetAmount) * 100
    if (pct < 30) {
      alerts.push({
        id: 'ef-low',
        icon: ShieldOff,
        color: 'text-red-600',
        bg: 'bg-red-50',
        message: `Emergency fund is at ${pct.toFixed(0)}% — consider rebuilding.`,
      })
    }
  }

  // Weekly overspend
  const weeklyBudget = settings?.weeklyBudget ?? 0
  if (weeklyBudget > 0) {
    const weekSpent = getTransactionsForWeek(transactions)
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)
    if (weekSpent > weeklyBudget) {
      alerts.push({
        id: 'weekly-over',
        icon: ArrowDown,
        color: 'text-yellow-700',
        bg: 'bg-yellow-50',
        message: `Weekly spending exceeded by ${formatCurrencyFull(weekSpent - weeklyBudget)}.`,
      })
    }
  }

  // High expense mode
  if (settings?.financialMode === 'high-expense') {
    const pendingBorrow = borrowings
      .filter((b) => b.type === 'borrowed' && b.status !== 'repaid')
      .reduce((s, b) => s + (b.amount - b.repaidAmount), 0)
    if (pendingBorrow > 0) {
      alerts.push({
        id: 'high-borrow',
        icon: Flame,
        color: 'text-orange-700',
        bg: 'bg-orange-50',
        message: `High Expense Mode: ${formatCurrencyFull(pendingBorrow)} in pending borrowings. Plan repayment.`,
      })
    }
  }

  const visible = alerts.filter((a) => !dismissed.includes(a.id))

  if (visible.length === 0) return null

  return (
    <div className="space-y-2">
      {visible.map((alert) => (
        <div key={alert.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl ${alert.bg}`}>
          <alert.icon size={16} className={`${alert.color} mt-0.5 flex-shrink-0`} />
          <p className={`text-sm font-medium flex-1 ${alert.color}`}>{alert.message}</p>
          <button onClick={() => setDismissed((d) => [...d, alert.id])} className="text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
