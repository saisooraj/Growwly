import type { AIProvider, AIMessage, AITool, AIResponse } from './provider'
import { GROQ_FALLBACK_CHAIN } from './chatbotConfig'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Status codes that mean "this model is overloaded/unavailable — try another"
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504])

function buildBody(model: string, messages: AIMessage[], tools?: AITool[]): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.3,
    max_tokens: 1024,
  }
  if (tools && tools.length > 0) {
    body.tools = tools.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }))
    body.tool_choice = 'auto'
  }
  return body
}

async function callGroq(
  apiKey: string,
  model: string,
  messages: AIMessage[],
  tools?: AITool[]
): Promise<{ response: AIResponse; model: string }> {
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildBody(model, messages, tools)),
  })

  if (!res.ok) {
    const text = await res.text()
    const err = new Error(`Groq ${res.status}: ${text}`) as Error & { status: number }
    err.status = res.status
    throw err
  }

  const data = await res.json()
  const msg = data.choices?.[0]?.message
  if (!msg) throw new Error('Empty response from Groq')

  if (msg.tool_calls?.length > 0) {
    const tc = msg.tool_calls[0]
    let args: Record<string, unknown> = {}
    try { args = JSON.parse(tc.function.arguments) } catch { args = tc.function.arguments ?? {} }
    return { response: { content: null, toolCall: { name: tc.function.name, arguments: args } }, model }
  }

  return { response: { content: msg.content ?? '', toolCall: null }, model }
}

export class GroqProvider implements AIProvider {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = 'llama-3.3-70b-versatile') {
    this.apiKey = apiKey
    this.model = model
  }

  async chat(messages: AIMessage[], tools?: AITool[]): Promise<AIResponse> {
    // Build the chain: chosen model first, then fallbacks (skip any that duplicate the chosen model)
    const chain = [this.model, ...GROQ_FALLBACK_CHAIN.filter(m => m !== this.model)]

    let lastError: Error | null = null

    for (let i = 0; i < chain.length; i++) {
      const model = chain[i]
      try {
        const { response } = await callGroq(this.apiKey, model, messages, tools)
        // Log if we fell back so it's visible in server logs
        if (i > 0) console.info(`[Groowtt] Fell back to model: ${model}`)
        return response
      } catch (err) {
        lastError = err as Error
        const status = (err as Error & { status?: number }).status
        const isRetryable = status !== undefined && RETRYABLE_STATUSES.has(status)

        if (!isRetryable || i === chain.length - 1) {
          // Non-retryable error or exhausted all fallbacks
          break
        }
        console.warn(`[Groowtt] Model ${model} failed (${status}), trying fallback…`)
      }
    }

    throw lastError ?? new Error('All Groq models failed')
  }
}

// Factory — kept for backward compat
export function createAIProvider(apiKey: string, model?: string): AIProvider {
  return new GroqProvider(apiKey, model)
}
