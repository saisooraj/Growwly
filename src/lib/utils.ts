import { type ClassValue, clsx } from 'clsx'
import { format, startOfWeek, endOfWeek, parseISO, isWithinInterval } from 'date-fns'
import type { Transaction, MonthlySummary, Category, UserSettings, Borrowing } from '@/types'
import { getCycleRange } from './cycle'

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
  month: string,
  settings?: UserSettings | null
): Transaction[] {
  const { start, end } = getCycleRange(month, settings)
  return transactions.filter((t) =>
    isWithinInterval(parseISO(t.date), { start: parseISO(start), end: parseISO(end) })
  )
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
  month: string,
  settings?: UserSettings | null,
  borrowings?: Borrowing[] | null
): MonthlySummary {
  const { start, end } = getCycleRange(month, settings)
  const monthTxs = getTransactionsForMonth(transactions, month, settings)
  const byCategory: Record<string, number> = {}
  let totalIncome = 0
  let totalExpenses = 0

  let repaymentReceived = 0  // lent money came back
  let repaymentPaid     = 0  // borrowed money repaid by you

  for (const t of monthTxs) {
    if (t.type === 'transfer') {
      // Repayment transfers adjust cashNet but not income/expenses
      if (t.transferKind === 'loan_repayment_received') repaymentReceived += t.amount
      if (t.transferKind === 'loan_repayment_paid')     repaymentPaid     += t.amount
      continue
    }
    if (t.type === 'income') {
      totalIncome += t.amount
    } else {
      totalExpenses += t.amount
      byCategory[t.category] = (byCategory[t.category] ?? 0) + t.amount
    }
  }

  let totalLent = 0
  let totalBorrowed = 0
  if (borrowings) {
    for (const b of borrowings) {
      if (b.date < start || b.date > end) continue
      if (b.type === 'lent')     totalLent     += b.amount
      else                       totalBorrowed += b.amount
    }
  }

  const net     = totalIncome - totalExpenses
  const cashNet = net - totalLent + totalBorrowed + repaymentReceived - repaymentPaid

  return {
    month,
    totalIncome,
    totalExpenses,
    net,
    cashNet,
    totalLent,
    totalBorrowed,
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
  'on-track': { pill: 'good',    bar: 'var(--good)', label: 'On Track' },
  'warning':  { pill: 'warn',    bar: 'var(--warn)', label: 'Near Limit' },
  'over':     { pill: 'bad',     bar: 'var(--bad)',  label: 'Over Budget' },
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
    id: 'loan_repayment_paid' as const,
    label: 'Loan Repaid',
    sub: 'You repaid money you owed',
    dir: 'out' as const,
  },
  {
    id: 'savings_transfer' as const,
    label: 'Savings / Investment',
    sub: 'Moved to savings or investment account',
    dir: 'out' as const,
  },
] as const

export const EXPENSE_CATEGORIES: Category[] = [
  'Food & Dining',
  'Groceries',
  'Transport',
  'Fuel',
  'Entertainment',
  'Shopping',
  'Healthcare',
  'Utilities',
  'Subscriptions',
  'Personal Care',
  'Education',
  'Travel',
  'Fitness',
  'Home & Maintenance',
  'Insurance',
  'Gifts & Donations',
  'Living Expenses',
  'Rent / Deposit',
  'SIP / Investments',
  'Gold',
  'Construction',
  'Family',
  'Family Events',
  'Borrowed / Loan',
  'Emergency Fund',
  'Food with Her',
  'Treat',
  'Office Expense',
  'Relationship',
  'Covered for Others',
  'Other',
]

export const INCOME_CATEGORIES: Category[] = [
  'Salary',
  'Freelance',
  'Business',
  'Rental Income',
  'Dividends / Interest',
  'Bonus / Gift',
  'Other Income',
]

export const CATEGORY_EMOJI: Record<string, string> = {
  'Food & Dining': '🍽️',
  'Groceries': '🛒',
  'Transport': '🚌',
  'Fuel': '⛽',
  'Entertainment': '🎬',
  'Shopping': '🛍️',
  'Healthcare': '🏥',
  'Utilities': '💡',
  'Subscriptions': '📱',
  'Personal Care': '💆',
  'Education': '📚',
  'Travel': '✈️',
  'Fitness': '💪',
  'Home & Maintenance': '🏠',
  'Insurance': '🛡️',
  'Gifts & Donations': '🎁',
  'Living Expenses': '🏡',
  'Rent / Deposit': '🏢',
  'SIP / Investments': '📈',
  'Gold': '🥇',
  'Construction': '🏗️',
  'Family': '👨‍👩‍👧‍👦',
  'Family Events': '🎊',
  'Borrowed / Loan': '🤝',
  'Emergency Fund': '🆘',
  'Food with Her': '🍜',
  'Treat': '🥳',
  'Office Expense': '💼',
  'Relationship': '💑',
  'Covered for Others': '🤲',
  'Other': '📦',
  'Salary': '💼',
  'Freelance': '💻',
  'Business': '🏪',
  'Rental Income': '🔑',
  'Dividends / Interest': '📊',
  'Bonus / Gift': '🎁',
  'Other Income': '💰',
}

export const CATEGORY_COLORS: Record<string, string> = {
  'Food & Dining': '#f97316',
  'Groceries': '#84cc16',
  'Transport': '#6366f1',
  'Fuel': '#f59e0b',
  'Entertainment': '#a855f7',
  'Shopping': '#ec4899',
  'Healthcare': '#14b8a6',
  'Utilities': '#3b82f6',
  'Subscriptions': '#8b5cf6',
  'Personal Care': '#f472b6',
  'Education': '#0ea5e9',
  'Travel': '#06b6d4',
  'Fitness': '#22c55e',
  'Home & Maintenance': '#78716c',
  'Insurance': '#64748b',
  'Gifts & Donations': '#e879f9',
  'Living Expenses': '#6366f1',
  'Rent / Deposit': '#f59e0b',
  'SIP / Investments': '#10b981',
  'Gold': '#f97316',
  'Construction': '#ef4444',
  'Family': '#10b981',
  'Family Events': '#8b5cf6',
  'Borrowed / Loan': '#ec4899',
  'Emergency Fund': '#14b8a6',
  'Food with Her': '#f43f5e',
  'Treat': '#f59e0b',
  'Office Expense': '#0ea5e9',
  'Relationship': '#e11d48',
  'Covered for Others': '#f97316',
  'Other': '#94a3b8',
  'Salary': '#22c55e',
  'Freelance': '#3b82f6',
  'Business': '#0ea5e9',
  'Rental Income': '#10b981',
  'Dividends / Interest': '#84cc16',
  'Bonus / Gift': '#f97316',
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
