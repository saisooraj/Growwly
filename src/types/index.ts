export type TransactionType = 'income' | 'expense'

export type Category =
  | 'Living Expenses'
  | 'Rent / Deposit'
  | 'SIP / Investments'
  | 'Gold'
  | 'Construction'
  | 'Family Events'
  | 'Borrowed / Loan'
  | 'Emergency Fund'
  | 'Salary'
  | 'Freelance'
  | 'Business'
  | 'Other Income'
  | 'Other'

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
  createdAt: string
  updatedAt: string
}

export interface MonthlySummary {
  month: string
  totalIncome: number
  totalExpenses: number
  net: number
  byCategory: Record<Category, number>
}
