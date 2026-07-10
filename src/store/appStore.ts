import { create } from 'zustand'
import type {
  Transaction,
  Budget,
  Project,
  Borrowing,
  Contact,
  EmergencyFund,
  UserSettings,
  SavingsGoal,
  UpcomingExpense,
  UpcomingPayment,
  Task,
  Asset,
  Liability,
  HealthRoutine,
  HealthLog,
} from '@/types'
import { getCurrentMonth } from '@/lib/utils'

interface AppState {
  transactions: Transaction[]
  budgets: Budget[]
  projects: Project[]
  borrowings: Borrowing[]
  contacts: Contact[]
  emergencyFund: EmergencyFund | null
  settings: UserSettings | null
  savingsGoals: SavingsGoal[]
  upcomingExpenses: UpcomingExpense[]
  upcomingPayments: UpcomingPayment[]
  tasks: Task[]
  assets: Asset[]
  liabilities: Liability[]
  healthRoutines: HealthRoutine[]
  healthLogs: HealthLog[]
  selectedMonth: string
  loading: boolean
  initialized: boolean

  setTransactions: (t: Transaction[]) => void
  setBudgets: (b: Budget[]) => void
  setProjects: (p: Project[]) => void
  setBorrowings: (b: Borrowing[]) => void
  setContacts: (c: Contact[]) => void
  setEmergencyFund: (e: EmergencyFund | null) => void
  setSettings: (s: UserSettings | null) => void
  setSavingsGoals: (g: SavingsGoal[]) => void
  setUpcomingExpenses: (u: UpcomingExpense[]) => void
  setUpcomingPayments: (p: UpcomingPayment[]) => void
  setTasks: (t: Task[]) => void
  setAssets: (a: Asset[]) => void
  setLiabilities: (l: Liability[]) => void
  setHealthRoutines: (r: HealthRoutine[]) => void
  setHealthLogs: (l: HealthLog[]) => void
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
  contacts: [],
  emergencyFund: null,
  settings: null,
  savingsGoals: [],
  upcomingExpenses: [],
  upcomingPayments: [],
  tasks: [],
  assets: [],
  liabilities: [],
  healthRoutines: [],
  healthLogs: [],
  selectedMonth: getCurrentMonth(),
  loading: false,
  initialized: false,

  setTransactions: (transactions) => set({ transactions }),
  setBudgets: (budgets) => set({ budgets }),
  setProjects: (projects) => set({ projects }),
  setBorrowings: (borrowings) => set({ borrowings }),
  setContacts: (contacts) => set({ contacts }),
  setEmergencyFund: (emergencyFund) => set({ emergencyFund }),
  setSettings: (settings) => set({ settings }),
  setSavingsGoals: (savingsGoals) => set({ savingsGoals }),
  setUpcomingExpenses: (upcomingExpenses) => set({ upcomingExpenses }),
  setUpcomingPayments: (upcomingPayments) => set({ upcomingPayments }),
  setTasks: (tasks) => set({ tasks }),
  setAssets: (assets) => set({ assets }),
  setLiabilities: (liabilities) => set({ liabilities }),
  setHealthRoutines: (healthRoutines) => set({ healthRoutines }),
  setHealthLogs: (healthLogs) => set({ healthLogs }),
  setSelectedMonth: (selectedMonth) => set({ selectedMonth }),
  setLoading: (loading) => set({ loading }),
  setInitialized: (initialized) => set({ initialized }),
  reset: () =>
    set({
      transactions: [],
      budgets: [],
      projects: [],
      borrowings: [],
      contacts: [],
      emergencyFund: null,
      settings: null,
      savingsGoals: [],
      upcomingExpenses: [],
      upcomingPayments: [],
      tasks: [],
      assets: [],
      liabilities: [],
      healthRoutines: [],
      healthLogs: [],
      selectedMonth: getCurrentMonth(),
      initialized: false,
    }),
}))
