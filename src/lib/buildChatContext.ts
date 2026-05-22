import type { Transaction, Budget, Borrowing, EmergencyFund, Project } from '@/types'

export function buildChatContext(data: {
  transactions: Transaction[]
  budgets: Budget[]
  borrowings: Borrowing[]
  emergencyFund: EmergencyFund | null
  projects: Project[]
}): string {
  const { transactions, budgets, borrowings, emergencyFund, projects } = data
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const currentMonth = today.slice(0, 7)

  const lines: string[] = []

  lines.push(`Today: ${today}`)
  lines.push(`Yesterday: ${yesterday}`)
  lines.push(`Current month: ${currentMonth}`)
  lines.push('')

  // Recent transactions (last 90 days)
  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]
  const recent = transactions
    .filter(t => t.date >= cutoff)
    .sort((a, b) => b.date.localeCompare(a.date))

  lines.push(`TRANSACTIONS (last 90 days, ${recent.length} total):`)
  recent.forEach(t => {
    lines.push(`  ${t.date} | ${t.type.toUpperCase()} | ₹${t.amount} | ${t.category}${t.notes ? ` | ${t.notes}` : ''}`)
  })
  lines.push('')

  // Monthly budget for current month
  const monthBudgets = budgets.filter(b => b.month === currentMonth)
  if (monthBudgets.length > 0) {
    const monthExpenses = transactions.filter(t => t.date.startsWith(currentMonth) && t.type === 'expense')
    const totalPlanned = monthBudgets.reduce((s, b) => s + b.planned, 0)
    const totalSpent = monthExpenses.reduce((s, t) => s + t.amount, 0)
    lines.push(`BUDGET (${currentMonth}):`)
    lines.push(`  Total planned: ₹${totalPlanned} | Spent so far: ₹${totalSpent} | Remaining: ₹${totalPlanned - totalSpent}`)
    monthBudgets.forEach(b => {
      const spent = monthExpenses.filter(t => t.category === b.category).reduce((s, t) => s + t.amount, 0)
      lines.push(`  ${b.category}: planned ₹${b.planned} | spent ₹${spent} | left ₹${b.planned - spent}`)
    })
    lines.push('')
  }

  // Borrowings
  const pending = borrowings.filter(b => b.status !== 'repaid')
  if (borrowings.length > 0) {
    lines.push(`BORROWINGS (${borrowings.length} total, ${pending.length} pending):`)
    borrowings.forEach(b => {
      const outstanding = b.amount - b.repaidAmount
      lines.push(`  ${b.type.toUpperCase()} | ${b.person} | ₹${b.amount} | repaid ₹${b.repaidAmount} | outstanding ₹${outstanding} | status: ${b.status}${b.description ? ` | note: ${b.description}` : ''}`)
    })
    lines.push('')
  }

  // Emergency fund
  if (emergencyFund) {
    const pct = ((emergencyFund.currentBalance / emergencyFund.targetAmount) * 100).toFixed(0)
    lines.push(`EMERGENCY FUND:`)
    lines.push(`  Balance: ₹${emergencyFund.currentBalance} | Target: ₹${emergencyFund.targetAmount} | Progress: ${pct}%`)
    lines.push('')
  }

  // Projects
  if (projects.length > 0) {
    lines.push(`PROJECTS:`)
    projects.forEach(p => {
      lines.push(`  ${p.name} | budget ₹${p.totalBudget} | paid ₹${p.paid} | remaining ₹${p.totalBudget - p.paid} | status: ${p.status}`)
    })
    lines.push('')
  }

  return lines.join('\n')
}
