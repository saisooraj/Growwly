import { NextRequest, NextResponse } from 'next/server'

// Free-tier vision models can be slow (rate-limited/low priority) — give the request room,
// but Vercel Hobby caps function duration at 60s regardless of this value.
export const maxDuration = 45

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const REQUEST_TIMEOUT_MS = 40_000
// Free-tier vision model on OpenRouter (no credit card, 50 req/day / 20 req/min as of writing).
// If this particular model is deprecated, swap the id — OpenRouter lists current :free vision
// models at https://openrouter.ai/models?modality=text%2Bimage-%3Etext&max_price=0
const VISION_MODEL = 'nvidia/nemotron-nano-12b-v2-vl:free'
const MAX_UPLOAD_SIZE = 4_000_000

const PROMPT = 'Extract all text from this image thoroughly. Do NOT miss any words, headings, ' +
  'amounts, dates, or text near the edges — this is a bill, receipt, or payment confirmation ' +
  'screenshot. Maintain the original reading order. Respond with only the transcribed text, ' +
  'nothing else.'

export async function POST(req: NextRequest) {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return NextResponse.json({ error: 'OCR not configured' }, { status: 500 })

  try {
    const formData = await req.formData()
    const file = formData.get('image')
    if (!(file instanceof File) || !file.type.startsWith('image/') || file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: 'Invalid image' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let res: Response
    try {
      res = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: VISION_MODEL,
          temperature: 0.1,
          max_tokens: 2000,
          // This model is a "reasoning" model — without this, it can spend the whole token
          // budget on internal reasoning and leave message.content empty. We just need a
          // direct transcription, not deliberation.
          reasoning: { effort: 'none' },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: PROMPT },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!res.ok) {
      const body = await res.text()
      console.error(`[scan-receipt] OpenRouter ${res.status}: ${body.slice(0, 500)}`)
      return NextResponse.json({ error: `OpenRouter ${res.status}`, detail: body.slice(0, 300) }, { status: 502 })
    }

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content
    if (!text || typeof text !== 'string') {
      const detail = JSON.stringify(data).slice(0, 500)
      console.error('[scan-receipt] Empty/malformed OpenRouter response:', detail)
      return NextResponse.json({ error: 'Empty response', detail }, { status: 502 })
    }

    return NextResponse.json({ text })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[scan-receipt] Timed out waiting for OpenRouter')
      return NextResponse.json({ error: 'Timed out' }, { status: 504 })
    }
    console.error('[scan-receipt] Scan failed:', err)
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 })
  }
}
