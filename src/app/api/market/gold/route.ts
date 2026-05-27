import { NextResponse } from 'next/server'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

interface IBJAEntry {
  date: string   // DD/MM/YYYY
  pm: number     // per 10g, 999 purity
  am: number
}

async function fetchIBJA(): Promise<IBJAEntry[]> {
  const res = await fetch('https://ibjarates.com/', {
    headers: { 'User-Agent': UA },
    cache: 'no-store',
  })
  const html = await res.text()

  const entries: IBJAEntry[] = []
  // Each table row has: date, then Gold999 AM, Gold999 PM
  const dateBlocks = html.split(/<strong>\d{2}\/\d{2}\/\d{4}<\/strong>/)
  const dateRe = /<strong>(\d{2}\/\d{2}\/\d{4})<\/strong>/g
  const numRe  = /data-label="Gold 999">(\d+)</g
  const dateMatches: string[] = []
  let dm: RegExpExecArray | null
  while ((dm = dateRe.exec(html)) !== null) dateMatches.push(dm[1])

  for (let i = 0; i < dateMatches.length; i++) {
    const block = dateBlocks[i + 1] ?? ''
    const nums: number[] = []
    numRe.lastIndex = 0
    let nm: RegExpExecArray | null
    while ((nm = numRe.exec(block)) !== null) nums.push(parseInt(nm[1]))
    if (nums.length >= 2) {
      entries.push({ date: dateMatches[i], am: nums[0], pm: nums[1] })
    } else if (nums.length === 1) {
      entries.push({ date: dateMatches[i], am: nums[0], pm: nums[0] })
    }
  }
  return entries
}

function parseDate(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split('/')
  return `${y}-${m}-${d}`
}

export async function GET() {
  try {
    const entries = await fetchIBJA()
    if (entries.length === 0) throw new Error('No IBJA data')

    // Most recent rate (use PM if available)
    const latest = entries[0]
    const latestPer10g = latest.pm || latest.am

    const price24kPerGram = latestPer10g / 10
    const price22kPerGram = price24kPerGram * (22 / 24)
    const sovereign       = price22kPerGram * 8   // 1 sovereign = 8g
    const tenGram         = price22kPerGram * 10

    // 30-day history from IBJA — deduplicate by date, keep PM rate
    const seen = new Set<string>()
    const history = entries
      .filter(e => {
        const d = parseDate(e.date)
        if (seen.has(d)) return false
        seen.add(d)
        return true
      })
      .slice(0, 30)
      .map(e => ({
        date: parseDate(e.date),
        price22k: parseFloat(((e.pm || e.am) / 10 * (22 / 24)).toFixed(0)),
      }))
      .reverse()

    // Buy/hold/wait signal vs 30-day average
    const avg30 = history.reduce((s, h) => s + h.price22k, 0) / (history.length || 1)
    const pctAboveAvg = ((price22kPerGram - avg30) / avg30) * 100
    let signal: 'buy' | 'hold' | 'wait'
    let signalText: string
    if (pctAboveAvg < -2) {
      signal = 'buy'
      signalText = `${Math.abs(pctAboveAvg).toFixed(1)}% below 30-day avg — Good time to buy`
    } else if (pctAboveAvg > 4) {
      signal = 'wait'
      signalText = `${pctAboveAvg.toFixed(1)}% above 30-day avg — Wait for correction`
    } else {
      signal = 'hold'
      signalText = 'Near 30-day average — Neutral'
    }

    return NextResponse.json({
      price24kPerGram: Math.round(price24kPerGram),
      price22kPerGram: Math.round(price22kPerGram),
      sovereign:       Math.round(sovereign),
      tenGram:         Math.round(tenGram),
      avg30Day:        Math.round(avg30),
      signal,
      signalText,
      history,
      source: 'IBJA',
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch gold price' }, { status: 500 })
  }
}
