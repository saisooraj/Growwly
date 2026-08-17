import { NextRequest, NextResponse } from 'next/server'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/utils'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
// Only vision-capable model on Groq as of writing — a Preview-tier model, not Production.
// If Groq deprecates/renames it, this route starts failing and the scanner falls back to
// "Enter Manually" (see BillScannerModal's failed step) rather than crashing anything.
const VISION_MODEL = 'qwen/qwen3.6-27b'
const MAX_UPLOAD_SIZE = 4_000_000

interface ScanResult {
  amount: number | null
  merchant: string | null
  date: string | null
  category: string
  type: 'expense' | 'income'
}

const VALID_CATEGORIES = new Set<string>([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function buildPrompt(): string {
  return `You are reading a photo of a bill, receipt, or payment confirmation screenshot for a personal finance app.

Extract these fields and respond with ONLY a JSON object, nothing else:
{
  "amount": <the final payable/paid amount as a plain number, no currency symbols or commas — the TOTAL actually paid, not a subtotal, tax line, or discount line. null if you can't confidently identify it>,
  "merchant": <the merchant, store, or person name, e.g. "Swiggy" or "Sai Sooraj". null if not identifiable — never invent one>,
  "date": <the transaction date in YYYY-MM-DD format. null if no date is visible — never guess today's date>,
  "category": <pick the single best-fitting category from this exact list, copied verbatim: ${[...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].join(', ')}>,
  "type": <"expense" if money was paid, debited, or sent; "income" if money was received or credited. Default to "expense" if unclear>
}`
}

function normalizeResult(raw: unknown): ScanResult {
  const r = (raw ?? {}) as Record<string, unknown>
  const type: 'expense' | 'income' = r.type === 'income' ? 'income' : 'expense'
  const amount = typeof r.amount === 'number' && Number.isFinite(r.amount) && r.amount > 0 ? r.amount : null
  const merchant = typeof r.merchant === 'string' && r.merchant.trim() ? r.merchant.trim().slice(0, 60) : null
  const date = typeof r.date === 'string' && DATE_RE.test(r.date) ? r.date : null
  const category = typeof r.category === 'string' && VALID_CATEGORIES.has(r.category)
    ? r.category
    : type === 'income' ? 'Other Income' : 'Other'

  return { amount, merchant, date, category, type }
}

function extractJson(content: string): unknown {
  try {
    return JSON.parse(content)
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}

export async function POST(req: NextRequest) {
  const key = process.env.GROQ_API_KEY
  if (!key) return NextResponse.json({ error: 'OCR not configured' }, { status: 500 })

  try {
    const formData = await req.formData()
    const file = formData.get('image')
    if (!(file instanceof File) || !file.type.startsWith('image/') || file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: 'Invalid image' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`

    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VISION_MODEL,
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: buildPrompt() },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    })

    if (!res.ok) return NextResponse.json({ error: `Groq ${res.status}` }, { status: 502 })

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return NextResponse.json({ error: 'Empty response' }, { status: 502 })

    const parsed = extractJson(content)
    if (!parsed) return NextResponse.json({ error: 'Unparseable response' }, { status: 502 })

    return NextResponse.json(normalizeResult(parsed))
  } catch {
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 })
  }
}
