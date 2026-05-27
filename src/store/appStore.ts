import { create } from 'zustand'
import type {
  Transaction,
  Budget,
  Project,
  Borrowing,
  EmergencyFund,
  UserSettings,
  SavingsGoal,
  UpcomingExpense,
  UpcomingPayment,
} from '@/types'
import { getCurrentMonth } from '@/lib/utils'

interface AppState {
  transactions: Transaction[]
  budgets: Budget[]
  projects: Project[]
  borrowings: Borrowing[]
  emergencyFund: EmergencyFund | null
  settings: UserSettings | null
  savingsGoals: SavingsGoal[]
  upcomingExpenses: UpcomingExpense[]
  upcomingPayments: UpcomingPayment[]
  selectedMonth: string
  loading: boolean
  initialized: boolean

  setTransactions: (t: Transaction[]) => void
  setBudgets: (b: Budget[]) => void
  setProjects: (p: Project[]) => void
  setBorrowings: (b: Borrowing[]) => void
  setEmergencyFund: (e: EmergencyFund | null) => void
  setSettings: (s: UserSettings | null) => void
  setSavingsGoals: (g: SavingsGoal[]) => void
  setUpcomingExpenses: (u: UpcomingExpense[]) => void
  setUpcomingPayments: (p: UpcomingPayment[]) => void
  setSelectedMonth: (m: string) => void
  setLoading: (l: boolean) => void
  setInitialized: (i: boolean) => void
  reset: () => void
}

export const useAppStore = create<AppState>((set) => ({
  transactions: [],
  budgets: [],
  projects: [],
  borrowings: [],
  emergencyFund: null,
  settings: null,
  savingsGoals: [],
  upcomingExpenses: [],
  upcomingPayments: [],
  selectedMonth: getCurrentMonth(),
  loading: false,
  initialized: false,

  setTransactions: (transactions) => set({ transactions }),
  setBudgets: (budgets) => set({ budgets }),
  setProjects: (projects) => set({ projects }),
  setBorrowings: (borrowings) => set({ borrowings }),
  setEmergencyFund: (emergencyFund) => set({ emergencyFund }),
  setSettings: (settings) => set({ settings }),
  setSavingsGoals: (savingsGoals) => set({ savingsGoals }),
  setUpcomingExpenses: (upcomingExpenses) => set({ upcomingExpenses }),
  setUpcomingPayments: (upcomingPayments) => set({ upcomingPayments }),
  setSelectedMonth: (selectedMonth) => set({ selectedMonth }),
  setLoading: (loading) => set({ loading }),
  setInitialized: (initialized) => set({ initialized }),
  reset: () =>
    set({
      transactions: [],
      budgets: [],
      projects: [],
      borrowings: [],
      emergencyFund: null,
      settings: null,
      savingsGoals: [],
      upcomingExpenses: [],
      upcomingPayments: [],
      selectedMonth: getCurrentMonth(),
      initialized: false,
    }),
}))
