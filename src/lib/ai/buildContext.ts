import type { FinancialSnapshot } from './types'
import type { Transaction, Budget, SavingsGoal, EmergencyFund, Borrowing, UserSettings } from '@/types'

interface StoreSnapshot {
  userId: string
  transactions: Transaction[]
  budgets: Budget[]
  savingsGoals: SavingsGoal[]
  emergencyFund: EmergencyFund | null
  borrowings: Borrowing[]
  settings: UserSettings | null
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function getCurrentMonth(): string {
  return getToday().slice(0, 7)
}

function getLastMonth(): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 7)
}

function getDaysLeftInMonth(): number {
  const now = new Date()
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return last.getDate() - now.getDate()
}

function get90DaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 90)
  return d.toISOString().slice(0, 10)
}

function summarizeTxns(txns: Transaction[]) {
  const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  let expenses = 0
  const byCategory: Record<string, number> = {}
  for (const t of txns) {
    if (t.type === 'expense') {
      expenses += t.amount
      byCategory[t.category] = (byCategory[t.category] ?? 0) + t.amount
    } else if (t.type === 'refund') {
      expenses -= t.amount
      byCategory[t.category] = (byCategory[t.category] ?? 0) - t.amount
    }
  }
  return { income, expenses, net: income - expenses, byCategory }
}

export function buildFinancialSnapshot(store: StoreSnapshot): FinancialSnapshot {
  const today = getToday()
  const currentMonth = getCurrentMonth()
  const lastMonth = getLastMonth()
  const cutoff = get90DaysAgo()

  const thisMonthTxns = store.transactions.filter(t => t.date.startsWith(currentMonth))
  const lastMonthTxns = store.transactions.filter(t => t.date.startsWith(lastMonth))
  const recentTxns = store.transactions
    .filter(t => t.date >= cutoff)
    .slice(0, 200)

  const thisMonthSummary = summarizeTxns(thisMonthTxns)
  const lastMonthSummary = summarizeTxns(lastMonthTxns)

  const thisMonthBudgets = store.budgets.filter(b => b.month === currentMonth)
  const budgetsWithSpent = thisMonthBudgets.map(b => ({
    category: b.category,
    month: b.month,
    planned: b.planned,
    spent: thisMonthSummary.byCategory[b.category] ?? 0,
  }))

  const goals = store.savingsGoals.map(g => ({
    name: g.name,
    emoji: g.emoji,
    target: g.targetAmount,
    current: g.currentAmount,
    pct: Math.round((g.currentAmount / (g.targetAmount || 1)) * 100),
  }))

  const ef = store.emergencyFund
    ? {
        target: store.emergencyFund.targetAmount,
        current: store.emergencyFund.currentBalance,
        pct: Math.round((store.emergencyFund.currentBalance / (store.emergencyFund.targetAmount || 1)) * 100),
      }
    : null

  const activeBorrowings = store.borrowings
    .filter(b => b.status !== 'repaid')
    .map(b => ({
      type: b.type,
      person: b.person,
      amount: b.amount,
      outstanding: b.amount - b.repaidAmount,
      dueDate: b.dueDate,
    }))

  // Collect unique categories from all transactions for the LLM
  const categorySet = new Set<string>()
  for (const t of store.transactions) {
    if (t.category) categorySet.add(t.category)
  }
  if (store.settings?.customCategories) {
    for (const c of store.settings.customCategories) categorySet.add(c)
  }
  const availableCategories = Array.from(categorySet).sort()

  return {
    userId: store.userId,
    currency: store.settings?.currency ?? '₹',
    today,
    currentMonth,
    settings: {
      monthlyIncomeTarget: store.settings?.monthlyIncomeTarget ?? 0,
      weeklyBudget: store.settings?.weeklyBudget ?? 0,
      emergencyFundTarget: store.settings?.emergencyFundTarget ?? 0,
    },
    thisMonth: { ...thisMonthSummary, daysLeft: getDaysLeftInMonth() },
    lastMonth: lastMonthSummary,
    recentTransactions: recentTxns.map(t => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      category: t.category,
      date: t.date,
      notes: t.notes ?? '',
    })),
    budgets: budgetsWithSpent,
    savingsGoals: goals,
    emergencyFund: ef,
    activeBorrowings,
    availableCategories,
  }
}
