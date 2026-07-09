import { NextRequest, NextResponse } from 'next/server'
import { GroqProvider } from '@/lib/ai/groqProvider'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const { notes, type } = await req.json() as { notes: string; type: string }
    if (!notes?.trim()) return NextResponse.json({ category: null })

    const key = process.env.GROQ_API_KEY
    if (!key) return NextResponse.json({ category: null })

    const categories = type === 'income'
      ? INCOME_CATEGORIES.join(', ')
      : EXPENSE_CATEGORIES.join(', ')

    const provider = new GroqProvider(key, 'llama-3.1-8b-instant')
    const result = await provider.chat([
      {
        role: 'system',
        content: `You are a financial transaction categorizer. Given a transaction description, return the SINGLE most appropriate category from this list: ${categories}. Respond with ONLY the exact category name, nothing else.`,
      },
      {
        role: 'user',
        content: `Transaction description: "${notes}"`,
      },
    ])

    const suggested = result.content?.trim()
    const all = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]
    const matched = all.find(c => c.toLowerCase() === suggested?.toLowerCase())

    return NextResponse.json({ category: matched ?? null })
  } catch {
    return NextResponse.json({ category: null })
  }
}
