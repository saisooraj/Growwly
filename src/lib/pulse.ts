import {
  format, parseISO, getDaysInMonth, differenceInCalendarDays,
  isAfter, isBefore, addDays,
} from 'date-fns'
import type {
  Transaction, UserSettings, EmergencyFund, SavingsGoal,
  Project, Borrowing, UpcomingExpense, UpcomingPayment,
  FinancialPulse, PulseHealthScore, PulseCashPosition,
  PulseUpcoming, PulseAllocation, PulseSpendCategory,
  PulseGoal, PulseBorrowingAlert, MonthlySummary,
} from '@/types'
import { buildMonthlySummary, getTransactionsForMonth, EMERGENCY_FUND_VEHICLE } from './utils'

export interface PulseSnapshot {
  transactions: Transaction[]
  settings: UserSettings | null
  emergencyFund: EmergencyFund | null
  savingsGoals: SavingsGoal[]
  projects: Project[]
  borrowings: Borrowing[]
  upcomingExpenses: UpcomingExpense[]
  upcomingPayments: UpcomingPayment[]
  selectedMonth?: string  // if provided, compute pulse for this cycle instead of current
}

// ── Health Score ─────────────────────────────────────────────────────────────

function computeHealthScore(
  snapshot: PulseSnapshot,
  curSummary: MonthlySummary,
  now: Date,
): PulseHealthScore {
  const { settings, emergencyFund, projects, savingsGoals, borrowings } = snapshot
  const dayOfMonth = now.getDate()
  const isEarlyMonth = dayOfMonth <= 7
  const { totalIncome: monthIncome, totalExpenses: monthExpenses } = curSummary

  const breakdown = {
    spendingControl: 0,
    efProgress: 0,
    savingsMomentum: 0,
    goalsProgress: 0,
    borrowingHealth: 0,
  }

  // 1. Spending control (30 pts) — expenses vs income reference
  const incomeRef = Math.max(monthIncome, settings?.monthlyIncomeTarget ?? 0)
  if (incomeRef > 0) {
    const ratio = monthExpenses / incomeRef
    if (ratio <= 0.55)      breakdown.spendingControl = 30
    else if (ratio <= 0.70) breakdown.spendingControl = 25
    else if (ratio <= 0.85) breakdown.spendingControl = 18
    else if (ratio <= 1.0)  breakdown.spendingControl = 10
    else                    breakdown.spendingControl = 0
  } else {
    breakdown.spendingControl = isEarlyMonth ? 20 : 10
  }

  // 2. Emergency fund (20 pts)
  if (emergencyFund && emergencyFund.targetAmount > 0) {
    breakdown.efProgress = Math.round(
      Math.min(emergencyFund.currentBalance / emergencyFund.targetAmount, 1) * 20
    )
  }

  // 3. Savings momentum (20 pts)
  const incomeRef2 = Math.max(monthIncome, settings?.monthlyIncomeTarget ?? 0)
  if (incomeRef2 > 0 && !isEarlyMonth) {
    const rate = (monthIncome - monthExpenses) / incomeRef2
    if (rate >= 0.25)      breakdown.savingsMomentum = 20
    else if (rate >= 0.15) breakdown.savingsMomentum = 16
    else if (rate >= 0.05) breakdown.savingsMomentum = 10
    else if (rate >= 0)    breakdown.savingsMomentum = 5
    else                   breakdown.savingsMomentum = 0
  } else {
    breakdown.savingsMomentum = isEarlyMonth ? 12 : 8
  }

  // 4. Goals progress (15 pts) — do you have goals with any progress?
  const activeProjects = projects.filter(p => p.status === 'active')
  const hasGoals =
    savingsGoals.length > 0 ||
    activeProjects.length > 0 ||
    (emergencyFund && emergencyFund.targetAmount > 0)

  if (!hasGoals) {
    breakdown.goalsProgress = 7  // neutral — no goals set
  } else {
    const all = [
      ...(emergencyFund && emergencyFund.targetAmount > 0
        ? [emergencyFund.currentBalance > 0] : []),
      ...savingsGoals.map(g => g.currentAmount > 0),
      ...activeProjects.map(p => p.paid > 0),
    ]
    const ratio = all.length > 0 ? all.filter(Boolean).length / all.length : 0
    breakdown.goalsProgress = Math.round(ratio * 15)
  }

  // 5. Borrowing health (15 pts)
  const pending = borrowings.filter(b => b.status !== 'repaid')
  const overdue = pending.filter(b => b.dueDate && isBefore(parseISO(b.dueDate), now))
  if (overdue.length > 0)   breakdown.borrowingHealth = 0
  else if (pending.length > 0) breakdown.borrowingHealth = 10
  else                      breakdown.borrowingHealth = 15

  const score = Math.min(
    breakdown.spendingControl + breakdown.efProgress + breakdown.savingsMomentum +
    breakdown.goalsProgress + breakdown.borrowingHealth,
    100
  )
  const label: PulseHealthScore['label'] =
    score >= 85 ? 'excellent' :
    score >= 65 ? 'good' :
    score >= 45 ? 'caution' : 'critical'

  return { score, label, breakdown }
}

// ── Allocations ──────────────────────────────────────────────────────────────

function computeAllocations(
  freeCash: number,
  snapshot: PulseSnapshot,
  daysLeft: number,
  monthTxs: Transaction[],
): PulseAllocation[] {
  const { settings, emergencyFund, projects } = snapshot
  if (freeCash < 500) return []

  // Which goals already received contributions this month?
  const efFundedThisMonth = monthTxs.some(
    t => (t.transferKind === 'savings_contribution' || t.transferKind === 'savings_transfer') &&
         t.savingsVehicle === EMERGENCY_FUND_VEHICLE
  )
  const sipFundedThisMonth = monthTxs.some(
    t => (t.transferKind === 'savings_contribution' || t.transferKind === 'savings_transfer') &&
         t.savingsVehicle === 'SIP / Investments'
  )
  const projectsFundedThisMonth = new Set(
    monthTxs.filter(t => t.projectId).map(t => t.projectId!)
  )

  const allocations: PulseAllocation[] = []
  let remaining = freeCash

  // 1. EF top-up (skip if already contributed this month)
  if (!efFundedThisMonth && emergencyFund && emergencyFund.targetAmount > 0 &&
      emergencyFund.currentBalance < emergencyFund.targetAmount) {
    const gap = emergencyFund.targetAmount - emergencyFund.currentBalance
    const suggestion = Math.min(gap, Math.round(remaining * 0.4))
    if (suggestion >= 500) {
      const newPct = Math.min(
        ((emergencyFund.currentBalance + suggestion) / emergencyFund.targetAmount) * 100, 100
      )
      allocations.push({
        label: 'Emergency Fund',
        amount: suggestion,
        reason: `Takes you to ${newPct.toFixed(0)}% of target`,
        type: 'ef',
      })
      remaining -= suggestion
    }
  }

  // 2. Active projects sorted by deadline (skip ones already funded this month)
  const activeProjects = projects
    .filter(p =>
      p.status === 'active' &&
      p.paid < p.totalBudget &&
      p.totalBudget > 0 &&
      !projectsFundedThisMonth.has(p.id)
    )
    .sort((a, b) => {
      if (a.endDate && b.endDate) return a.endDate < b.endDate ? -1 : 1
      if (a.endDate) return -1
      return 1
    })

  for (const proj of activeProjects.slice(0, 2)) {
    if (remaining < 500) break
    const gap = proj.totalBudget - proj.paid
    const suggestion = Math.min(gap, Math.round(remaining * 0.35))
    if (suggestion >= 500) {
      const newPct = Math.min(((proj.paid + suggestion) / proj.totalBudget) * 100, 100)
      allocations.push({
        label: proj.name,
        amount: suggestion,
        reason: `${newPct.toFixed(0)}% funded`,
        type: 'project',
      })
      remaining -= suggestion
    }
  }

  // 3. Two-week spending buffer
  if (settings?.weeklyBudget && daysLeft > 7) {
    const bufferSuggestion = Math.min(
      Math.round(settings.weeklyBudget * 2),
      Math.round(remaining * 0.5)
    )
    if (bufferSuggestion >= 500) {
      allocations.push({
        label: '2-week buffer',
        amount: bufferSuggestion,
        reason: 'Keep accessible for daily expenses',
        type: 'buffer',
      })
      remaining -= bufferSuggestion
    }
  }

  // 4. SIP / Mutual Fund (skip if already invested this month)
  // Cap at ₹30k (user's usual target); always suggest something if there's meaningful cash left
  const SIP_CAP = 30000
  if (!sipFundedThisMonth && remaining >= 1500) {
    const sipSuggestion = Math.min(SIP_CAP, Math.round(remaining * 0.6))
    if (sipSuggestion >= 500 && sipSuggestion <= remaining - 500) {
      const atTarget = sipSuggestion >= SIP_CAP
      allocations.push({
        label: 'Mutual Fund / SIP',
        amount: sipSuggestion,
        reason: atTarget ? 'Your monthly SIP target' : 'Partial — invest what you can this month',
        type: 'sip',
      })
      remaining -= sipSuggestion
    }
  }

  // 5. Discretionary
  if (remaining >= 500) {
    allocations.push({
      label: 'Discretionary',
      amount: Math.round(remaining),
      reason: 'Truly yours to spend freely',
      type: 'discretionary',
    })
  }

  return allocations
}

// ── Headline ─────────────────────────────────────────────────────────────────

function generateHeadline(
  health: PulseHealthScore,
  cash: PulseCashPosition,
  alerts: PulseBorrowingAlert[],
): string {
  const overdueCount = alerts.filter(a => a.isOverdue).length
  if (overdueCount > 0) {
    return `${overdueCount} overdue ${overdueCount === 1 ? 'repayment needs' : 'repayments need'} your attention`
  }
  if (health.label === 'critical') return 'Finances need immediate attention this month'
  if (health.label === 'caution') return 'A few areas to watch — review the details below'
  if (cash.surplusNet > 0 && health.label === 'excellent') {
    return `Excellent shape — ₹${cash.surplusNet.toLocaleString('en-IN')} surplus this cycle`
  }
  if (cash.surplusNet > 0) {
    return `Solid month — ₹${cash.surplusNet.toLocaleString('en-IN')} surplus`
  }
  return 'Here is your financial snapshot for this month'
}

// ── Main compute function ────────────────────────────────────────────────────

export function computePulse(
  snapshot: PulseSnapshot,
  triggerType: FinancialPulse['triggerType'] = 'manual',
): FinancialPulse {
  const { transactions, emergencyFund, savingsGoals, projects, borrowings, upcomingExpenses, upcomingPayments } = snapshot
  const now = new Date()
  const month = snapshot.selectedMonth ?? format(now, 'yyyy-MM')
  const [y, m] = month.split('-').map(Number)
  const prevMonth = format(new Date(y, m - 2, 1), 'yyyy-MM')

  const curSummary  = buildMonthlySummary(transactions, month,     snapshot.settings, borrowings)
  const prevSummary = buildMonthlySummary(transactions, prevMonth, snapshot.settings, borrowings)

  const daysLeft    = Math.max(getDaysInMonth(now) - now.getDate(), 0)
  const thirtyDaysOut = addDays(now, 30)

  // Build paid amounts map
  const paidByUpcoming = new Map<string, number>()
  for (const p of upcomingPayments) {
    paidByUpcoming.set(p.upcomingId, (paidByUpcoming.get(p.upcomingId) ?? 0) + p.amount)
  }

  // Upcoming expenses: anything still owed that is either overdue (past due date)
  // or due within the next 30 days. Overdue items stay until paid.
  const relevantUpcoming = upcomingExpenses.filter(u => {
    const d = parseISO(u.dueDate)
    const remaining = u.amount - (paidByUpcoming.get(u.id) ?? 0)
    return isBefore(d, thirtyDaysOut) &&
           (u.flowType === 'expense' || !u.flowType) &&
           remaining > 0
  })
  const upcomingTotal = relevantUpcoming.reduce((s, u) => {
    const remaining = u.amount - (paidByUpcoming.get(u.id) ?? 0)
    return s + remaining
  }, 0)

  // Upcoming income: money still pending to arrive in the next 30 days
  const upcomingIncome = upcomingExpenses.reduce((s, u) => {
    if (u.flowType !== 'income') return s
    const d = parseISO(u.dueDate)
    if (!isBefore(d, thirtyDaysOut)) return s
    const remaining = u.amount - (paidByUpcoming.get(u.id) ?? 0)
    return remaining > 0 ? s + remaining : s
  }, 0)

  const carryForward  = Math.max(0, prevSummary.cashNet)
  const surplusNet    = curSummary.cashNet + carryForward   // matches Net cashflow everywhere
  // surplusNet already has savings deducted (via cashNet formula), so only subtract upcoming
  const freeCash      = Math.max(surplusNet - upcomingTotal, 0)
  const dailyBudget   = daysLeft > 0 ? Math.round(freeCash / daysLeft) : 0

  const cashPosition: PulseCashPosition = {
    monthIncome:        curSummary.totalIncome + curSummary.totalBorrowed,
    borrowedIncome:     curSummary.totalBorrowed,
    monthExpenses:      curSummary.totalExpenses,
    savingsContributed: curSummary.savingsContributed,
    totalLent:          curSummary.totalLent,
    upcomingTotal,
    upcomingIncome,
    carryForward,
    surplusNet,
    freeCash,
    daysLeft,
    dailyBudget,
  }

  const health = computeHealthScore(snapshot, curSummary, now)

  // ── Upcoming items list ────────────────────────────────────────────────────
  const upcoming: PulseUpcoming[] = []
  for (const u of relevantUpcoming) {
    const d = parseISO(u.dueDate)
    const remaining = u.amount - (paidByUpcoming.get(u.id) ?? 0)
    const daysUntil = differenceInCalendarDays(d, now)
    upcoming.push({
      label: u.label,
      amount: remaining,
      dueDate: u.dueDate,
      daysUntil,
      isOverdue: daysUntil < 0,
      type: 'expense',
    })
  }
  for (const b of borrowings) {
    if (b.status === 'repaid' || !b.dueDate) continue
    const d = parseISO(b.dueDate)
    if (isAfter(d, now) && isBefore(d, thirtyDaysOut)) {
      upcoming.push({
        label: `${b.type === 'borrowed' ? 'Repay' : 'Collect from'} ${b.person}`,
        amount: b.amount - b.repaidAmount,
        dueDate: b.dueDate,
        daysUntil: differenceInCalendarDays(d, now),
        isOverdue: false,
        type: 'borrowing',
      })
    }
  }
  // Overdue first (most overdue at top), then soonest due
  upcoming.sort((a, b) => a.daysUntil - b.daysUntil)

  // ── Allocations ────────────────────────────────────────────────────────────
  const monthTxs = getTransactionsForMonth(transactions, month, snapshot.settings)
  const allocations = computeAllocations(freeCash, snapshot, daysLeft, monthTxs)

  // ── Spend analysis (top 5 categories, MoM) ────────────────────────────────
  const spendAnalysis: PulseSpendCategory[] = Object.entries(curSummary.byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, amount]) => {
      const prevAmount = (prevSummary.byCategory as Record<string, number>)[category] ?? 0
      const changePct = prevAmount > 0 ? ((amount - prevAmount) / prevAmount) * 100 : null
      return { category, amount, prevAmount, changePct }
    })

  // ── Goals ──────────────────────────────────────────────────────────────────
  const goals: PulseGoal[] = []
  if (emergencyFund && emergencyFund.targetAmount > 0) {
    goals.push({
      label: 'Emergency Fund',
      emoji: 'IconAlertOctagon',
      current: emergencyFund.currentBalance,
      target: emergencyFund.targetAmount,
      pct: Math.min((emergencyFund.currentBalance / emergencyFund.targetAmount) * 100, 100),
      type: 'ef',
    })
  }
  for (const g of savingsGoals) {
    if (g.targetAmount <= 0) continue
    goals.push({
      label: g.name,
      emoji: g.emoji || 'IconTarget',
      current: g.currentAmount,
      target: g.targetAmount,
      pct: Math.min((g.currentAmount / g.targetAmount) * 100, 100),
      dueDate: g.targetDate,
      type: 'savings',
    })
  }
  for (const p of projects.filter(p => p.status === 'active')) {
    if (p.totalBudget <= 0) continue
    goals.push({
      label: p.name,
      emoji: 'IconCrane',
      current: p.paid,
      target: p.totalBudget,
      pct: Math.min((p.paid / p.totalBudget) * 100, 100),
      dueDate: p.endDate,
      type: 'project',
    })
  }

  // ── Borrowing alerts ───────────────────────────────────────────────────────
  const borrowingAlerts: PulseBorrowingAlert[] = borrowings
    .filter(b => b.status !== 'repaid')
    .map(b => {
      const isOverdue = !!b.dueDate && isBefore(parseISO(b.dueDate), now)
      return {
        person: b.person,
        amount: b.amount,
        outstanding: b.amount - b.repaidAmount,
        type: b.type,
        dueDate: b.dueDate,
        isOverdue,
        daysOverdue: isOverdue && b.dueDate
          ? differenceInCalendarDays(now, parseISO(b.dueDate))
          : undefined,
      }
    })
    .sort((a, b) => (b.isOverdue ? 1 : 0) - (a.isOverdue ? 1 : 0))

  const headline = generateHeadline(health, cashPosition, borrowingAlerts)

  return {
    month,
    generatedAt: now.toISOString(),
    triggerType,
    headline,
    health,
    cashPosition,
    upcoming,
    allocations,
    spendAnalysis,
    goals,
    borrowingAlerts,
  }
}
