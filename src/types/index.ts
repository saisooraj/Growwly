export type TransactionType = 'income' | 'expense' | 'transfer'

export type TransferKind =
  | 'loan_given'
  | 'loan_repayment_received'
  | 'loan_repayment_paid'
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
  // Salary cycle
  salaryCycleRule?: 'none' | 'last-working-day' | 'fixed-day'
  salaryCycleFixedDay?: number                    // 1–31, used when rule = 'fixed-day'
  cycleOverrides?: Record<string, string>         // { "2026-06": "2026-05-30" } per-month overrides
  customCategories?: string[]                     // user-defined categories saved for reuse
  dailyLivingCost?: number                        // legacy — superseded by dailyLivingSchedules
  dailyLivingItems?: { label: string; amount: number }[]  // legacy
  dailyLivingSchedules?: {                        // per-day-of-week schedules
    days: number[]                               // 0=Sun 1=Mon … 6=Sat
    items: { label: string; amount: number }[]
    total: number
  }[]
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
  net: number           // P&L net: income − expenses (no borrowings)
  cashNet: number       // True cashflow: net − lent + borrowed
  totalLent: number
  totalBorrowed: number
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

// ── Financial Pulse ──────────────────────────────────────────────────────────

export interface PulseHealthScore {
  score: number   // 0–100
  label: 'excellent' | 'good' | 'caution' | 'critical'
  breakdown: {
    spendingControl: number   // max 30
    efProgress: number        // max 20
    savingsMomentum: number   // max 20
    goalsProgress: number     // max 15
    borrowingHealth: number   // max 15
  }
}

export interface PulseCashPosition {
  monthIncome: number
  borrowedIncome: number  // portion of monthIncome that is borrowed
  monthExpenses: number
  upcomingTotal: number   // expenses due in next 30 days
  freeCash: number        // income − expenses − upcoming
  daysLeft: number
  dailyBudget: number     // freeCash / daysLeft
}

export interface PulseUpcoming {
  label: string
  amount: number
  dueDate: string
  daysUntil: number
  type: 'expense' | 'income' | 'borrowing'
}

export interface PulseAllocation {
  label: string
  amount: number
  reason: string
  type: 'ef' | 'project' | 'buffer' | 'discretionary'
}

export interface PulseSpendCategory {
  category: string
  amount: number
  prevAmount: number
  changePct: number | null   // null if no prior month data
}

export interface PulseGoal {
  label: string
  emoji: string
  current: number
  target: number
  pct: number
  dueDate?: string
  type: 'ef' | 'savings' | 'project'
}

export interface PulseBorrowingAlert {
  person: string
  amount: number
  outstanding: number
  type: 'borrowed' | 'lent'
  dueDate?: string
  isOverdue: boolean
  daysOverdue?: number
}

export interface FinancialPulse {
  month: string
  generatedAt: string
  triggerType: 'month-start' | 'payday' | 'manual'
  headline: string
  health: PulseHealthScore
  cashPosition: PulseCashPosition
  upcoming: PulseUpcoming[]
  allocations: PulseAllocation[]
  spendAnalysis: PulseSpendCategory[]
  goals: PulseGoal[]
  borrowingAlerts: PulseBorrowingAlert[]
}
