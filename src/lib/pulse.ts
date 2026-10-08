import {
  format, parseISO, getDaysInMonth, differenceInCalendarDays,
  isAfter, isBefore, addDays,
} from 'date-fns'
import type {
  Transaction, UserSettings, EmergencyFund, SavingsGoal, Budget,
  Project, Borrowing, UpcomingExpense, UpcomingPayment,
  FinancialPulse, PulseHealthScore, PulseCashPosition,
  PulseUpcoming, PulseAllocation, PulseSpendCategory,
  PulseGoal, PulseBorrowingAlert, MonthlySummary,
} from '@/types'
import { buildBudgetPlan, type BudgetPlan } from './budgetPlan'
import { buildMonthlySummary, computeCarryForward, getTransactionsForMonth, getLast6Months, EMERGENCY_FUND_VEHICLE, formatCurrencyFull } from './utils'

export interface PulseSnapshot {
  transactions: Transaction[]
  settings: UserSettings | null
  budgets: Budget[]
  emergencyFund: EmergencyFund | null
  savingsGoals: SavingsGoal[]
  projects: Project[]
  borrowings: Borrowing[]
  upcomingExpenses: UpcomingExpense[]
  upcomingPayments: UpcomingPayment[]
  selectedMonth?: string  // if provided, compute pulse for this cycle instead of current
}

// ── Health Score ─────────────────────────────────────────────────────────────
// Each part asks "are you keeping the plan you set?" — Spending, Emergency fund and
// Savings read the Planning page for the same cycle, so a plan that shows as met
// there scores full here. A part with nothing to keep (no goals, nothing owed)
// scores full; without a plan, Spending and Savings fall back to income ratios.

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function computeHealthScore(
  snapshot: PulseSnapshot,
  plan: BudgetPlan,
  curSummary: MonthlySummary,
  now: Date,
): PulseHealthScore {
  const { settings, emergencyFund, projects, savingsGoals, borrowings } = snapshot
  const { cycle, totals } = plan
  const isEarlyCycle = cycle.phase === 'future' || (cycle.phase === 'live' && cycle.elapsed <= 7)
  const { totalIncome: monthIncome, totalExpenses: monthExpenses } = curSummary
  const incomeRef = Math.max(monthIncome, settings?.monthlyIncomeTarget ?? 0)
  const planRows = plan.groups.flatMap(g => g.rows).filter(r => r.planned > 0)

  const breakdown: PulseHealthScore['breakdown'] = {
    spendingControl: 0,
    efProgress: 0,
    savingsMomentum: 0,
    goalsProgress: 0,
    borrowingHealth: 0,
  }
  const notes: PulseHealthScore['notes'] = {
    spendingControl: '',
    efProgress: '',
    savingsMomentum: '',
    goalsProgress: '',
    borrowingHealth: '',
  }

  // 1. Spending (30) — every needs/wants budget still within its plan counts equally
  const budgets = planRows.filter(r => r.bucket !== 'savings')
  if (budgets.length > 0) {
    const over = budgets.filter(r => r.status === 'over').length
    breakdown.spendingControl = Math.round(30 * (budgets.length - over) / budgets.length)
    notes.spendingControl = over === 0
      ? `All ${plural(budgets.length, 'budget')} within plan`
      : `${over} of ${plural(budgets.length, 'budget')} over plan`
  } else if (incomeRef > 0) {
    const ratio = monthExpenses / incomeRef
    breakdown.spendingControl =
      ratio <= 0.55 ? 30 : ratio <= 0.70 ? 25 : ratio <= 0.85 ? 18 : ratio <= 1.0 ? 10 : 0
    notes.spendingControl = `No budgets set · ${pct(ratio)} of income spent`
  } else {
    breakdown.spendingControl = isEarlyCycle ? 20 : 10
    notes.spendingControl = 'No budgets or income yet'
  }

  // 2. Emergency fund (20) — this cycle's plan for it; a full fund needs nothing more
  const ef = emergencyFund && emergencyFund.targetAmount > 0 ? emergencyFund : null
  const efRow = planRows.find(r => r.name === EMERGENCY_FUND_VEHICLE)
  if (ef && ef.currentBalance >= ef.targetAmount) {
    breakdown.efProgress = 20
    notes.efProgress = 'Fully funded'
  } else if (efRow) {
    const ratio = Math.min(efRow.actual / efRow.planned, 1)
    breakdown.efProgress = Math.round(20 * ratio)
    notes.efProgress = ratio >= 1 ? 'This month’s plan met' : `${pct(ratio)} of this month’s plan added`
  } else if (ef) {
    const ratio = ef.currentBalance / ef.targetAmount
    breakdown.efProgress = Math.round(20 * ratio)
    notes.efProgress = `No monthly plan · ${pct(ratio)} of the goal`
  } else {
    notes.efProgress = 'Not set up'
  }

  // 3. Savings (20) — the Saved tile on the Planning page: all savings plans together
  if (totals.savePlanned > 0) {
    const ratio = Math.min(totals.saved / totals.savePlanned, 1)
    breakdown.savingsMomentum = Math.round(20 * ratio)
    notes.savingsMomentum = ratio >= 1 ? 'Savings plan met' : `${pct(ratio)} of the savings plan saved`
  } else if (incomeRef > 0 && !isEarlyCycle) {
    const rate = (monthIncome - monthExpenses) / incomeRef
    breakdown.savingsMomentum =
      rate >= 0.25 ? 20 : rate >= 0.15 ? 16 : rate >= 0.05 ? 10 : rate >= 0 ? 5 : 0
    notes.savingsMomentum = `No savings plan · ${pct(Math.max(rate, 0))} of income left over`
  } else {
    breakdown.savingsMomentum = isEarlyCycle ? 12 : 8
    notes.savingsMomentum = 'No savings plan yet'
  }

  // 4. Goals (15) — share on track. A savings goal with a date is on track while it
  // keeps up with the time passed (10% slack); without a date, once it has started.
  // A project is on track while it stays within its budget.
  const goalChecks = [
    ...savingsGoals.filter(g => g.targetAmount > 0).map(g => {
      if (g.currentAmount >= g.targetAmount) return true
      if (g.targetDate) {
        const span = differenceInCalendarDays(parseISO(g.targetDate), parseISO(g.createdAt))
        if (span > 0) {
          const pace = Math.min(Math.max(differenceInCalendarDays(now, parseISO(g.createdAt)) / span, 0), 1)
          return g.currentAmount >= g.targetAmount * pace * 0.9
        }
      }
      return g.currentAmount > 0
    }),
    ...projects.filter(p => p.status === 'active' && p.totalBudget > 0).map(p => p.paid <= p.totalBudget),
  ]
  if (goalChecks.length === 0) {
    breakdown.goalsProgress = 15
    notes.goalsProgress = 'No goals to track'
  } else {
    const onTrack = goalChecks.filter(Boolean).length
    breakdown.goalsProgress = Math.round(15 * onTrack / goalChecks.length)
    notes.goalsProgress = onTrack === goalChecks.length
      ? `All ${plural(goalChecks.length, 'goal')} on track`
      : `${goalChecks.length - onTrack} of ${plural(goalChecks.length, 'goal')} behind`
  }

  // 5. Debt (15) — only money you owe; money you lent is owed to you
  const owed = borrowings.filter(b => b.type === 'borrowed' && b.status !== 'repaid' && b.amount - b.repaidAmount > 0)
  const overdue = owed.filter(b => b.dueDate && isBefore(parseISO(b.dueDate), now))
  if (overdue.length > 0) {
    breakdown.borrowingHealth = 0
    notes.borrowingHealth = `${plural(overdue.length, 'repayment')} overdue`
  } else if (owed.length > 0) {
    breakdown.borrowingHealth = 12
    notes.borrowingHealth = `${plural(owed.length, 'repayment')} pending, none overdue`
  } else {
    breakdown.borrowingHealth = 15
    notes.borrowingHealth = 'Nothing owed'
  }

  const score = Math.min(
    breakdown.spendingControl + breakdown.efProgress + breakdown.savingsMomentum +
    breakdown.goalsProgress + breakdown.borrowingHealth,
    100
  )
  const label: PulseHealthScore['label'] =
    score >= 85 ? 'excellent' :
    score >= 65 ? 'good' :
    score >= 45 ? 'caution' : 'critical'

  return { score, label, breakdown, notes }
}

// ── Allocations ──────────────────────────────────────────────────────────────

function computeAllocations(
  freeCash: number,
  snapshot: PulseSnapshot,
  daysLeft: number,
  monthTxs: Transaction[],
): PulseAllocation[] {
  const { settings, emergencyFund, projects, borrowings } = snapshot
  if (freeCash < 500) return []
  const now = new Date()

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

  // 2. Borrowed money repayment (you owe someone — settle before investing)
  const pendingBorrowings = borrowings
    .filter(b => b.type === 'borrowed' && b.status !== 'repaid')
    .sort((a, b) => {
      const aOver = a.dueDate && parseISO(a.dueDate) < now
      const bOver = b.dueDate && parseISO(b.dueDate) < now
      if (aOver && !bOver) return -1
      if (!aOver && bOver) return 1
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return 0
    })

  for (const b of pendingBorrowings.slice(0, 2)) {
    if (remaining < 500) break
    const owed = b.amount - b.repaidAmount
    if (owed <= 0) continue
    const suggestion = Math.min(owed, Math.round(remaining * 0.4))
    if (suggestion < 500) continue
    const isOverdue = b.dueDate && parseISO(b.dueDate) < now
    const reason = isOverdue
      ? 'Overdue repayment'
      : b.dueDate
        ? `Due ${format(parseISO(b.dueDate), 'dd MMM')}`
        : `${formatCurrencyFull(owed)} outstanding`
    allocations.push({
      label: `Repay ${b.person}`,
      amount: suggestion,
      reason,
      type: 'repayment',
    })
    remaining -= suggestion
  }

  // 3. Active projects sorted by deadline (skip ones already funded this month)
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

  // 4. Two-week spending buffer
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

  // 5. SIP / Mutual Fund (skip if already invested this month)
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

  const prevMonth   = format(new Date(y, m - 2, 1), 'yyyy-MM')
  const curSummary  = buildMonthlySummary(transactions, month,      snapshot.settings, borrowings)
  const prevSummary = buildMonthlySummary(transactions, prevMonth,  snapshot.settings, borrowings)

  const allMonths = getLast6Months()
  const curIdx    = allMonths.indexOf(month)
  const carryForwardToMonth = curIdx > 0
    ? computeCarryForward(allMonths.slice(0, curIdx), transactions, snapshot.settings, borrowings)
    : 0

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

  const carryForward  = carryForwardToMonth
  const surplusNet    = curSummary.cashNet + carryForward   // matches Net cashflow everywhere
  // surplusNet already has savings deducted (via cashNet formula), so only subtract upcoming
  const freeCash      = Math.max(surplusNet - upcomingTotal, 0)
  const dailyBudget   = daysLeft > 0 ? Math.round(freeCash / daysLeft) : 0

  const cashPosition: PulseCashPosition = {
    monthIncome:        curSummary.totalIncome + curSummary.totalBorrowed,
    borrowedIncome:     curSummary.totalBorrowed,
    monthExpenses:      curSummary.totalExpenses,
    savingsContributed: curSummary.savingsContributed,
    savingsWithdrawn:   curSummary.savingsWithdrawn,
    totalLent:          curSummary.totalLent,
    lentOutstanding:    curSummary.lentOutstanding,
    repaymentPaid:      curSummary.repaymentPaid,
    upcomingTotal,
    upcomingIncome,
    carryForward,
    surplusNet,
    freeCash,
    daysLeft,
    dailyBudget,
  }

  const plan   = buildBudgetPlan(transactions, snapshot.budgets, snapshot.settings, month)
  const health = computeHealthScore(snapshot, plan, curSummary, now)

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
