export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  action?: PendingAction
  isError?: boolean
}

export type ActionType =
  | 'add_transaction'
  | 'update_transaction'
  | 'delete_transaction'
  | 'set_budget'
  | 'create_goal'
  | 'create_project'

export interface AddTransactionPayload {
  type: 'income' | 'expense'
  amount: number
  category: string
  date: string // YYYY-MM-DD
  notes?: string
}

export interface UpdateTransactionPayload {
  id: string
  amount?: number
  category?: string
  date?: string
  notes?: string
  description?: string // human-readable for preview
}

export interface DeleteTransactionPayload {
  id: string
  description: string // human-readable for preview
}

export interface SetBudgetPayload {
  category: string
  amount: number
  month: string // YYYY-MM
  description: string
}

export interface CreateGoalPayload {
  name: string
  targetAmount: number
  targetDate?: string
  description: string
}

export interface CreateProjectPayload {
  name: string
  totalBudget: number
  description?: string
  endDate?: string
  projectDescription: string
}

export type ActionPayload =
  | AddTransactionPayload
  | UpdateTransactionPayload
  | DeleteTransactionPayload
  | SetBudgetPayload
  | CreateGoalPayload
  | CreateProjectPayload

export interface PendingAction {
  type: ActionType
  payload: ActionPayload
  preview: string
}

export interface FinancialSnapshot {
  userId: string
  currency: string
  today: string
  currentMonth: string
  settings: {
    monthlyIncomeTarget: number
    weeklyBudget: number
    emergencyFundTarget: number
  }
  thisMonth: {
    income: number
    expenses: number
    net: number
    byCategory: Record<string, number>
    daysLeft: number
  }
  lastMonth: {
    income: number
    expenses: number
    net: number
    byCategory: Record<string, number>
  }
  recentTransactions: Array<{
    id: string
    type: string
    amount: number
    category: string
    date: string
    notes: string
  }>
  budgets: Array<{
    category: string
    month: string
    planned: number
    spent: number
  }>
  savingsGoals: Array<{
    name: string
    emoji: string
    target: number
    current: number
    pct: number
  }>
  emergencyFund: {
    target: number
    current: number
    pct: number
  } | null
  activeBorrowings: Array<{
    type: 'borrowed' | 'lent'
    person: string
    amount: number
    outstanding: number
    dueDate?: string
  }>
  availableCategories: string[]
}
