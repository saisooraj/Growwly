import { type ClassValue, clsx } from 'clsx'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO, isWithinInterval } from 'date-fns'
import type { Transaction, MonthlySummary, Category } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(amount: number, currency = '₹'): string {
  if (amount >= 100000) {
    return `${currency}${(amount / 100000).toFixed(1)}L`
  }
  if (amount >= 1000) {
    return `${currency}${(amount / 1000).toFixed(1)}K`
  }
  return `${currency}${amount.toFixed(0)}`
}

export function formatCurrencyFull(amount: number, currency = '₹'): string {
  return `${currency}${amount.toLocaleString('en-IN')}`
}

export function getCurrentMonth(): string {
  return format(new Date(), 'yyyy-MM')
}

export function getMonthLabel(month: string): string {
  return format(parseISO(`${month}-01`), 'MMMM yyyy')
}

export function getTransactionsForMonth(
  transactions: Transaction[],
  month: string
): Transaction[] {
  const start = startOfMonth(parseISO(`${month}-01`))
  const end = endOfMonth(start)
  return transactions.filter((t) => {
    const d = parseISO(t.date)
    return isWithinInterval(d, { start, end })
  })
}

export function getTransactionsForWeek(
  transactions: Transaction[],
  date: Date = new Date()
): Transaction[] {
  const start = startOfWeek(date, { weekStartsOn: 1 })
  const end = endOfWeek(date, { weekStartsOn: 1 })
  return transactions.filter((t) => {
    const d = parseISO(t.date)
    return isWithinInterval(d, { start, end })
  })
}

export function buildMonthlySummary(
  transactions: Transaction[],
  month: string
): MonthlySummary {
  const monthTxs = getTransactionsForMonth(transactions, month)
  const byCategory: Record<string, number> = {}
  let totalIncome = 0
  let totalExpenses = 0

  for (const t of monthTxs) {
    if (t.type === 'transfer') continue  // transfers are not P&L
    if (t.type === 'income') {
      totalIncome += t.amount
    } else {
      totalExpenses += t.amount
      byCategory[t.category] = (byCategory[t.category] ?? 0) + t.amount
    }
  }

  return {
    month,
    totalIncome,
    totalExpenses,
    net: totalIncome - totalExpenses,
    byCategory: byCategory as Record<Category, number>,
  }
}

export function getLast6Months(): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(format(d, 'yyyy-MM'))
  }
  return months
}

export function getBudgetStatus(actual: number, planned: number): 'on-track' | 'warning' | 'over' {
  if (planned === 0) return 'on-track'
  const ratio = actual / planned
  if (ratio <= 0.85) return 'on-track'
  if (ratio <= 1.0) return 'warning'
  return 'over'
}

export const STATUS_COLORS = {
  'on-track': { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', label: '🟢 On Track' },
  'warning':  { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500', label: '🟡 Slightly Over' },
  'over':     { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', label: '🔴 Over Budget' },
} as const

export const TRANSFER_KINDS = [
  {
    id: 'loan_given' as const,
    label: 'Loan Given',
    sub: 'You lent money to someone',
    dir: 'out' as const,
  },
  {
    id: 'loan_repayment_received' as const,
    label: 'Repayment Received',
    sub: 'Someone paid you back',
    dir: 'in' as const,
  },
  {
    id: 'savings_transfer' as const,
    label: 'Savings / Investment',
    sub: 'Moved to savings or investment account',
    dir: 'out' as const,
  },
] as const

export const EXPENSE_CATEGORIES: Category[] = [
  'Living Expenses',
  'Rent / Deposit',
  'SIP / Investments',
  'Gold',
  'Construction',
  'Family Events',
  'Borrowed / Loan',
  'Emergency Fund',
  'Other',
]

export const INCOME_CATEGORIES: Category[] = [
  'Salary',
  'Freelance',
  'Business',
  'Other Income',
]

export const CATEGORY_COLORS: Record<string, string> = {
  'Living Expenses': '#6366f1',
  'Rent / Deposit': '#f59e0b',
  'SIP / Investments': '#10b981',
  'Gold': '#f97316',
  'Construction': '#ef4444',
  'Family Events': '#8b5cf6',
  'Borrowed / Loan': '#ec4899',
  'Emergency Fund': '#14b8a6',
  'Other': '#94a3b8',
  'Salary': '#22c55e',
  'Freelance': '#3b82f6',
  'Business': '#0ea5e9',
  'Other Income': '#84cc16',
}

export function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
