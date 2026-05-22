import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Gemini API key not configured.' }, { status: 500 })
  }

  const { message, context, history } = await req.json()

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const systemPrompt = `You are Growwly Assistant, a personal finance AI built into the Growwly app.
You have access to the user's complete financial data below. Answer questions concisely and helpfully.
Use ₹ for currency. For dates, today is ${new Date().toISOString().split('T')[0]}.
Keep answers short and to the point — 1 to 4 sentences max unless a breakdown is needed.
Never make up data — only use what is provided. If data isn't available, say so.

--- USER FINANCIAL DATA ---
${context}
--- END DATA ---`

  const chat = model.startChat({
    history: [
      {
        role: 'user',
        parts: [{ text: systemPrompt }],
      },
      {
        role: 'model',
        parts: [{ text: "Got it! I have your financial data loaded. Ask me anything about your spending, budgets, borrowings, or savings." }],
      },
      ...(history ?? []),
    ],
  })

  const result = await chat.sendMessage(message)
  const text = result.response.text()

  return NextResponse.json({ reply: text })
}
