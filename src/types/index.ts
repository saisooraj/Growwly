export type TransactionType = 'income' | 'expense' | 'transfer' | 'refund'

export type TransferKind =
  | 'loan_given'
  | 'loan_repayment_received'
  | 'loan_repayment_paid'
  | 'savings_transfer'        // legacy → savings_contribution
  | 'ef_withdrawal'           // legacy → savings_withdrawal (Emergency Fund)
  | 'savings_contribution'    // cash → a savings vehicle
  | 'savings_withdrawal'      // a savings vehicle → cash

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
  tags?: string[]          // free-form labels, e.g. "Christmas" — independent of category, many-to-many
  projectId?: string
  isRecurring?: boolean
  recurringDay?: number // day-of-month to repeat (1–31)
  transferKind?: TransferKind
  savingsVehicle?: string  // for savings transfers: which vehicle (Emergency Fund, SIP, Stocks…)
  borrowingId?: string       // optional link to a single Borrowing record
  loanPerson?: string        // person name for loan transfers (used to reverse greedy allocation on delete)
  settledBorrowingId?: string // if set, this expense partially or fully offsets a "lent" borrowing
  settledPerson?: string      // denormalized person name for the settled borrowing
  refundOf?: string           // if set (type 'refund'), the id of the expense this refunds
  source?: 'scan' | 'share-target' // set when created via the bill scanner; absent means manual entry
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

export interface Contact {
  id: string
  userId: string
  name: string
  phone?: string
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
  // Optional loan/EMI fields — only shown when isLoan is true
  isLoan?: boolean
  interestRate?: number   // annual % (e.g. 8.5)
  tenureMonths?: number   // total loan tenure
  emiAmount?: number      // monthly EMI
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
  spendingRule?: { needs: number; wants: number; savings: number }
  categoryBuckets?: { needs: string[]; savings: string[] }
  customCategories?: string[]                     // user-defined categories saved for reuse
  customTags?: string[]                            // user-defined transaction tags saved for reuse
  customSavingsVehicles?: string[]                // user-defined savings vehicles saved for reuse
  savingsOpeningBalances?: Record<string, number> // prior balance per vehicle before tracking started
  noSpendDays?: string[]                           // YYYY-MM-DD dates user marked as no-spend (counts for streak)
  showHealthTab?: boolean                         // show Health tab in navigation (default: false)
  showTasksTab?: boolean                          // show Tasks tab in navigation (default: false)
  accentColor?: 'green' | 'purple' | 'orange' | 'pink' | 'blue' | 'black'  // brand accent (default: green)
  seenBadges?: number[]                            // badge thresholds the user has already seen (cross-device)
  seenAnnouncements?: string[]                     // announcement ids already shown — "id:platform" when the announcement is oncePerPlatform, else just "id" (cross-device)
  featureUsage?: Record<string, { useCount: number; lastUsedAt: string }>  // per-feature usage counters, used to trigger nudges for unused features
  dashboardCardOrder?: string[]                   // ordered list of dashboard block IDs
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

// ── Announcements ─────────────────────────────────────────────────────────────
// Admin-authored in-app messaging: onboarding tours and one-off feature spotlights.
// Definitions live in the `announcements` collection (admin-SDK only); delivery
// state (what a user has seen) lives on UserSettings.seenAnnouncements.

export type AnnouncementType = 'onboarding_tour' | 'feature_spotlight'
export type AnnouncementStatus = 'draft' | 'active' | 'archived'
export type AnnouncementAudience = 'all' | 'new_users'
export type AnnouncementPlatformTarget = 'mobile' | 'desktop'
// 'app_load' (default): evaluated once per session, like the get-started tour.
// 'salary_logged': evaluated right after the user adds a Salary-category income
// transaction — the delivery mechanism for feature nudges tied to a real action.
export type AnnouncementTrigger = 'app_load' | 'salary_logged'

export interface AnnouncementStep {
  iconKey: string
  title: string
  body: string
}

export interface Announcement {
  id: string
  type: AnnouncementType
  status: AnnouncementStatus
  priority: number                          // higher shows first when multiple are due
  platforms: AnnouncementPlatformTarget[]   // empty = all platforms
  audience: AnnouncementAudience
  oncePerPlatform: boolean                  // true: shown once per platform; false: shown once, ever
  startAt?: string                          // ISO — omitted means "always started"
  endAt?: string                            // ISO — omitted means "never ends"
  triggerPoint?: AnnouncementTrigger        // omitted = 'app_load'
  featureKey?: string                       // e.g. 'salary_cycle' — matches a specific triggerPoint context
  targetUserId?: string                     // when set, only this user gets it — overrides `audience` (used for feedback replies)
  // onboarding_tour content
  steps?: AnnouncementStep[]
  // feature_spotlight content
  title?: string
  body?: string
  iconKey?: string
  ctaLabel?: string
  ctaHref?: string
  createdAt: string
  updatedAt: string
}

// ── Feedback ─────────────────────────────────────────────────────────────────
// User-submitted bug reports / feature requests / general feedback, triaged in
// /admin/feedback. Once addressed, the admin can reply via a targeted Announcement
// (Announcement.targetUserId) so the specific user sees it on next app load.

export type FeedbackType = 'bug' | 'feature_request' | 'other'
export type FeedbackStatus = 'new' | 'in_progress' | 'resolved' | 'wont_fix'

export interface Feedback {
  id: string
  userId: string
  userEmail: string | null
  userName: string | null
  type: FeedbackType
  message: string
  context?: string      // page/route the user was on when they submitted it
  status: FeedbackStatus
  adminNote?: string
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
  projectId?: string
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
  lentOutstanding: number
  borrowedOutstanding: number
  repaymentReceived: number
  repaymentPaid: number
  savingsContributed: number   // cash moved into savings vehicles this period
  savingsWithdrawn: number     // cash pulled back out of savings this period
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
  savingsContributed: number
  savingsWithdrawn: number   // cash pulled back out of savings this cycle
  totalLent: number
  lentOutstanding: number // portion of this cycle's new loans still unpaid (nets out same-cycle repayments)
  repaymentPaid: number   // borrowed money you paid back this month (real cash outflow)
  upcomingTotal: number   // expense outflows still owed in next 30 days
  upcomingIncome: number  // income still pending to arrive in next 30 days
  carryForward: number    // previous cycle's positive cashNet
  surplusNet: number      // cashNet + carryForward — matches Net cashflow everywhere else
  freeCash: number        // surplusNet − savings − upcoming (daily-budget base)
  daysLeft: number
  dailyBudget: number     // freeCash / daysLeft
}

export interface PulseUpcoming {
  label: string
  amount: number
  dueDate: string
  daysUntil: number      // negative when overdue
  isOverdue: boolean
  type: 'expense' | 'income' | 'borrowing'
}

export interface PulseAllocation {
  label: string
  amount: number
  reason: string
  type: 'ef' | 'project' | 'sip' | 'buffer' | 'discretionary' | 'repayment' | 'custom'
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

// ── Health ────────────────────────────────────────────────────────────────────

export type HealthCategory = 'legs' | 'back' | 'neck' | 'strength' | 'full-body'
export type HealthScheduleType = 'daily' | 'hourly-window' | 'weekly'

export interface HealthRoutine {
  id: string
  userId: string
  name: string
  subtitle?: string         // e.g. "1.8km · legs"
  category: HealthCategory
  scheduleType: HealthScheduleType
  reminderTime?: string     // "HH:MM" — informational for now
  daysOfWeek?: string[]     // ['mon','wed','fri'] — for weekly scheduleType
  targetCount?: number      // for hourly-window: how many breaks per day
  order: number
  active: boolean
  createdAt: string
}

export interface HealthLog {
  id: string
  userId: string
  date: string              // YYYY-MM-DD
  routineId: string
  count: number             // 1 for daily/weekly; increments for hourly-window
  completedAt?: string      // ISO timestamp of last tap
  createdAt: string
}

// ── Net Worth ─────────────────────────────────────────────────────────────────

export type AssetKind =
  | 'cash'
  | 'fd_rd'
  | 'gold_grams'
  | 'mutual_fund'
  | 'stocks'
  | 'real_estate'
  | 'vehicle'
  | 'epf_ppf'
  | 'other'

export interface Asset {
  id: string
  userId: string
  name: string
  kind: AssetKind
  value: number          // grams for gold_grams; invested amount for MF/stocks; current value for rest
  // Gold
  karat?: 18 | 22 | 24
  // Mutual Fund
  schemeCode?: string    // AMFI scheme code
  units?: number         // units held
  // Stocks
  ticker?: string        // e.g. "RELIANCE.NS"
  quantity?: number      // number of shares
  avgBuyPrice?: number   // average buy price per share
  // Common for MF + stocks (what was put in)
  investedAmount?: number
  createdAt: string
  updatedAt: string
}

export type LiabilityKind =
  | 'home_loan'
  | 'car_loan'
  | 'personal_loan'
  | 'credit_card'
  | 'other'

export interface Liability {
  id: string
  userId: string
  name: string
  kind: LiabilityKind
  principal: number       // original loan amount (or current balance for credit card)
  interestRate: number    // annual % (0 for credit card or if unknown)
  tenureMonths: number    // original tenure (0 for credit card)
  startDate: string       // YYYY-MM-DD
  emiAmount?: number      // auto-calculated or manually overridden
  createdAt: string
  updatedAt: string
}
