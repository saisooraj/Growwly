import { NextRequest, NextResponse } from 'next/server'
import { GroqProvider } from '@/lib/ai/groqProvider'
import type { AITool } from '@/lib/ai/provider'
import type { FinancialSnapshot, PendingAction } from '@/lib/ai/types'
import type { ChatbotProviderConfig } from '@/lib/ai/chatbotSettings'

// ── Finance action tools ─────────────────────────────────────────────────────

const FINANCE_TOOLS: AITool[] = [
  {
    name: 'add_transaction',
    description: 'Add a new income or expense transaction for the user. Use this when the user explicitly asks to record, log, or add a transaction.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['income', 'expense'],
          description: 'Transaction type — income or expense',
        },
        amount: { type: 'number', description: 'Amount in the user\'s currency' },
        category: { type: 'string', description: 'Category (e.g. Food, Fuel, Salary). Pick from available categories if possible.' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format. Use today\'s date if not specified.' },
        notes: { type: 'string', description: 'Optional short description or notes' },
      },
      required: ['type', 'amount', 'category', 'date'],
    },
  },
  {
    name: 'update_transaction',
    description: 'Update fields of an existing transaction. Only use when user provides the transaction ID or enough context to identify it uniquely from the recent transactions list.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Transaction ID from the recent transactions list' },
        amount: { type: 'number', description: 'New amount' },
        category: { type: 'string', description: 'New category' },
        date: { type: 'string', description: 'New date YYYY-MM-DD' },
        notes: { type: 'string', description: 'New notes' },
        description: { type: 'string', description: 'Human-readable description of what is being updated, for the confirmation preview' },
      },
      required: ['id', 'description'],
    },
  },
  {
    name: 'delete_transaction',
    description: 'Delete an existing transaction. Only use when the user explicitly asks to delete or remove a specific transaction.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Transaction ID from the recent transactions list' },
        description: { type: 'string', description: 'Human-readable description like "₹500 Food expense on 5 Jul 2026" for the confirmation card' },
      },
      required: ['id', 'description'],
    },
  },
  {
    name: 'set_budget',
    description: 'Set or update the monthly budget for a specific category. Use when the user asks to set, update, or change a budget.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'The expense category to budget for (e.g. Food & Dining, Transport)' },
        amount: { type: 'number', description: 'Monthly budget amount in rupees' },
        month: { type: 'string', description: 'Month in YYYY-MM format. Use the current month if not specified.' },
        description: { type: 'string', description: 'Confirmation preview, e.g. "Set Food & Dining budget to ₹8,000 for July 2026"' },
      },
      required: ['category', 'amount', 'month', 'description'],
    },
  },
  {
    name: 'create_goal',
    description: 'Create a new savings goal. Use when the user wants to set up a savings target.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Goal name, e.g. "Europe Trip" or "Emergency Fund"' },
        targetAmount: { type: 'number', description: 'Target amount in rupees' },
        targetDate: { type: 'string', description: 'Optional target date in YYYY-MM-DD format' },
        description: { type: 'string', description: 'Confirmation preview, e.g. "Create goal \'Europe Trip\' — ₹1,50,000 target by Dec 2026"' },
      },
      required: ['name', 'targetAmount', 'description'],
    },
  },
  {
    name: 'create_project',
    description: 'Create a new project to track a one-off budget (e.g. home renovation, wedding). Use when the user wants to track spending for a specific event or project.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project name, e.g. "Home Renovation" or "Wedding"' },
        totalBudget: { type: 'number', description: 'Total project budget in rupees' },
        description: { type: 'string', description: 'Optional project description' },
        endDate: { type: 'string', description: 'Optional target end date in YYYY-MM-DD format' },
        projectDescription: { type: 'string', description: 'Confirmation preview, e.g. "Create project \'Home Renovation\' with ₹5,00,000 budget"' },
      },
      required: ['name', 'totalBudget', 'projectDescription'],
    },
  },
]

// ── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(s: FinancialSnapshot): string {
  const fmt = (n: number) => `${s.currency}${Math.round(n).toLocaleString('en-IN')}`

  const topThis = Object.entries(s.thisMonth.byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat, amt]) => `  ${cat}: ${fmt(amt)}`)
    .join('\n')

  const topLast = Object.entries(s.lastMonth.byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat, amt]) => `  ${cat}: ${fmt(amt)}`)
    .join('\n')

  const recentTxnLines = s.recentTransactions.slice(0, 150)
    .map(t => `  [${t.id}] ${t.date} | ${t.type.toUpperCase()} | ${t.category} | ${fmt(t.amount)}${t.notes ? ` | ${t.notes}` : ''}`)
    .join('\n')

  const budgetLines = s.budgets.length
    ? s.budgets.map(b => `  ${b.category}: planned ${fmt(b.planned)}, spent ${fmt(b.spent)} (${b.spent > b.planned ? 'over budget!' : `${fmt(b.planned - b.spent)} remaining`})`).join('\n')
    : '  No budgets set'

  const goalLines = s.savingsGoals.length
    ? s.savingsGoals.map(g => `  ${g.emoji} ${g.name}: ${fmt(g.current)} / ${fmt(g.target)} (${g.pct}%)`).join('\n')
    : '  None'

  const efLine = s.emergencyFund
    ? `${fmt(s.emergencyFund.current)} / ${fmt(s.emergencyFund.target)} (${s.emergencyFund.pct}%)`
    : 'Not configured'

  const borrowingLines = s.activeBorrowings.length
    ? s.activeBorrowings.map(b =>
        `  ${b.type === 'lent' ? 'Lent to' : 'Borrowed from'} ${b.person}: ${fmt(b.outstanding)} outstanding${b.dueDate ? ` (due ${b.dueDate})` : ''}`
      ).join('\n')
    : '  None'

  const categoryList = s.availableCategories.slice(0, 40).join(', ')

  return `You are Growwly's AI Finance Assistant — a smart, concise personal finance advisor built into the user's finance app.

TODAY: ${s.today}
CURRENT MONTH: ${s.currentMonth}
CURRENCY: ${s.currency}

════ THIS MONTH (${s.currentMonth}) ════
Income:    ${fmt(s.thisMonth.income)}
Expenses:  ${fmt(s.thisMonth.expenses)}
Net:       ${fmt(s.thisMonth.net)}
Days left: ${s.thisMonth.daysLeft}
Monthly income target: ${fmt(s.settings.monthlyIncomeTarget)}

Top spending categories:
${topThis || '  (no expenses yet)'}

════ LAST MONTH ════
Income:   ${fmt(s.lastMonth.income)}
Expenses: ${fmt(s.lastMonth.expenses)}
Net:      ${fmt(s.lastMonth.net)}
Top spending:
${topLast || '  (no data)'}

════ BUDGETS ════
${budgetLines}

════ SAVINGS GOALS ════
${goalLines}

════ EMERGENCY FUND ════
${efLine}

════ ACTIVE BORROWINGS ════
${borrowingLines}

════ RECENT TRANSACTIONS (last 90 days) ════
Format: [ID] Date | TYPE | Category | Amount | Notes
${recentTxnLines || '  No transactions found'}

════ AVAILABLE CATEGORIES ════
${categoryList || 'Food, Fuel, Salary, Transport, Shopping, Healthcare, Entertainment, Utilities'}

════ RULES ════
1. ONLY answer finance, money, budgeting, expenses, income, savings, investment, and transaction-related questions.
2. If asked ANYTHING outside finance (movies, coding, general knowledge, personal advice, etc.), respond EXACTLY: "I can only help with finance-related questions such as expenses, budgets, savings, and transactions."
3. Format all amounts with the currency symbol. Use Indian number format.
4. Be concise but insightful. Use bullet points for category breakdowns.
5. When the user asks to ADD, UPDATE, or DELETE data — use the appropriate tool. Never make database changes without going through the tool call → confirmation flow. You can also SET BUDGETS (set_budget), CREATE SAVINGS GOALS (create_goal), and CREATE PROJECTS (create_project).
6. When referencing a specific transaction, mention its date and category for clarity.
7. For "how much did I spend on X" questions, sum all transactions in that category across the requested period.
8. Do not make up data. Only answer from the financial data provided above.`
}

// ── Preview generator ────────────────────────────────────────────────────────

function generateActionPreview(
  toolName: string,
  args: Record<string, unknown>,
  snapshot: FinancialSnapshot
): string {
  const fmt = (n: number) => `${snapshot.currency}${Math.round(n).toLocaleString('en-IN')}`

  if (toolName === 'add_transaction') {
    const date = args.date as string
    const formattedDate = formatDateHuman(date)
    return `Please confirm this transaction:\n\nType: ${String(args.type).charAt(0).toUpperCase() + String(args.type).slice(1)}\nCategory: ${args.category}\nAmount: ${fmt(args.amount as number)}\nDate: ${formattedDate}${args.notes ? `\nNotes: ${args.notes}` : ''}`
  }

  if (toolName === 'update_transaction') {
    return `Please confirm this update:\n\n${args.description}`
  }

  if (toolName === 'delete_transaction') {
    return `Please confirm deletion:\n\n${args.description}`
  }

  if (toolName === 'set_budget')     return `Please confirm:\n\n${args.description}`
  if (toolName === 'create_goal')    return `Please confirm:\n\n${args.description}`
  if (toolName === 'create_project') return `Please confirm:\n\n${args.projectDescription}`

  return 'Please confirm this action.'
}

function formatDateHuman(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

// ── Route handler ────────────────────────────────────────────────────────────

function resolveProvider(config: Partial<ChatbotProviderConfig> | undefined): GroqProvider {
  const key = config?.groqApiKey?.trim() || process.env.GROQ_API_KEY
  if (!key) throw new Error('AI service is not configured. Please add GROQ_API_KEY to your environment.')
  const model = config?.groqModel || 'llama-3.3-70b-versatile'
  return new GroqProvider(key, model)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      snapshot: FinancialSnapshot
      providerConfig?: Partial<ChatbotProviderConfig>
    }

    const { messages, snapshot, providerConfig } = body

    if (!Array.isArray(messages) || !snapshot?.userId) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const provider = resolveProvider(providerConfig)
    const systemPrompt = buildSystemPrompt(snapshot)

    const aiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ]

    const response = await provider.chat(aiMessages, FINANCE_TOOLS)

    if (response.toolCall) {
      const preview = generateActionPreview(
        response.toolCall.name,
        response.toolCall.arguments,
        snapshot
      )
      const action: PendingAction = {
        type: response.toolCall.name as PendingAction['type'],
        payload: response.toolCall.arguments as unknown as PendingAction['payload'],
        preview,
      }
      return NextResponse.json({ type: 'action', action })
    }

    return NextResponse.json({ type: 'message', content: response.content })
  } catch (err) {
    console.error('[Chat API]', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
