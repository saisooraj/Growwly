export type TransactionType = 'income' | 'expense' | 'transfer'

export type TransferKind =
  | 'loan_given'
  | 'loan_repayment_received'
  | 'savings_transfer'

export type Category = string

export type FinancialMode = 'normal' | 'high-expense'

export interface Transaction {
  id: string
  userId: string
  type: TransactionType
  amount: number
  category: Category
  date: string // ISO date string YYYY-MM-DD
  notes: string
  createdAt: string
  projectId?: string
  isRecurring?: boolean
  recurringDay?: number // day-of-month to repeat (1–31)
  transferKind?: TransferKind
  borrowingId?: string  // optional link to a Borrowing record
}

export interface SavingsGoal {
  id: string
  userId: string
  name: string
  emoji: string
  targetAmount: number
  currentAmount: number
  targetDate?: string // YYYY-MM-DD
  createdAt: string
}

export interface Budget {
  id: string
  userId: string
  month: string // "YYYY-MM"
  category: Category
  planned: number
  createdAt: string
}

export interface Project {
  id: string
  userId: string
  name: string
  description: string
  totalBudget: number
  paid: number
  startDate: string
  endDate?: string
  status: 'active' | 'completed' | 'paused'
  createdAt: string
}

export interface Borrowing {
  id: string
  userId: string
  type: 'borrowed' | 'lent'
  amount: number
  person: string
  description: string
  date: string
  dueDate?: string
  repaidAmount: number
  status: 'pending' | 'partial' | 'repaid'
  createdAt: string
}

export interface EmergencyFund {
  id: string
  userId: string
  targetAmount: number
  currentBalance: number
  usedAmount: number
  lastUpdated: string
}

export interface WeeklyBudget {
  id: string
  userId: string
  amount: number
  createdAt: string
}

export interface UserSettings {
  id: string
  userId: string
  financialMode: FinancialMode
  currency: string
  monthlyIncomeTarget: number
  emergencyFundTarget: number
  weeklyBudget: number
  notificationsEnabled: boolean
  pushReminderEnabled?: boolean
  pushReminderHour?: number   // 0–23, hour in user's local time
  createdAt: string
  updatedAt: string
}

export interface UpcomingPayment {
  id: string
  userId: string
  upcomingId: string
  amount: number
  date: string       // YYYY-MM-DD
  notes?: string
  linkedTransactionId?: string
  createdAt: string
}

export interface UpcomingExpense {
  id: string
  userId: string
  flowType?: 'expense' | 'income'  // defaults to 'expense' for legacy records
  label: string
  amount: number
  dueDate: string       // YYYY-MM-DD
  category?: Category
  notes?: string
  isRecurring?: boolean
  createdAt: string
}

export interface MonthlySummary {
  month: string
  totalIncome: number
  totalExpenses: number
  net: number
  byCategory: Record<Category, number>
}

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export type TaskPriority = 'immediate' | 'this-week' | 'later' | 'someday'

export interface Task {
  id: string
  userId: string
  title: string
  nextAction?: string
  dueDate?: string       // YYYY-MM-DD
  priority: TaskPriority
  status: 'pending' | 'done'
  tags: string[]
  subtasks: Subtask[]
  createdAt: string
  completedAt?: string
}
