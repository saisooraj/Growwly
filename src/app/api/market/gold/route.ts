import { NextRequest, NextResponse } from 'next/server'
import { isIsoDay, valueBefore, yahooDailyCloses } from '@/lib/priceHistory'
import { GOLD_AVG_MIN_DAYS, goldDailyHistory, goldSignal, goldThirtyDayHistory } from '@/lib/gold'

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

  // The page lists each day twice: once in a morning (AM) table and once in an evening (PM) table
  const byDate = new Map<string, IBJAEntry>()
  const rowRe = /(?:data-label="(AM|PM)"[^>]*>\s*)?<strong>(\d{2}\/\d{2}\/\d{4})<\/strong>(?:(?!<strong>)[\s\S])*?data-label="Gold 999">(\d+)</g
  let row: RegExpExecArray | null
  while ((row = rowRe.exec(html)) !== null) {
    const entry = byDate.get(row[2]) ?? { date: row[2], am: 0, pm: 0 }
    if (row[1] === 'PM') entry.pm = parseInt(row[3])
    else entry.am = parseInt(row[3])
    byDate.set(row[2], entry)
  }
  return Array.from(byDate.values()).sort((a, b) => parseDate(b.date).localeCompare(parseDate(a.date)))
}

function parseDate(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split('/')
  return `${y}-${m}-${d}`
}

// IBJA's page only lists the last few days, so the rate at an older date is estimated from
// the move in GOLDBEES (an ETF that tracks the domestic gold price): today's IBJA rate scaled
// by the ETF's close then vs now.
async function start22kPerGram(since: string, price22kNow: number): Promise<number | null> {
  try {
    const { closes, price } = await yahooDailyCloses('GOLDBEES.NS')
    const then = valueBefore(closes, c => c.date, c => c.close, since)
    if (!then || !(price > 0)) return null
    return parseFloat((price22kNow * then / price).toFixed(2))
  } catch { return null }
}

// Older days for the charts. A slow or failed ETF lookup must never hold up today's gold rate.
async function goldEtfCloses(fromDay?: string): Promise<{ date: string; close: number }[]> {
  const none: { date: string; close: number }[] = []
  return Promise.race([
    yahooDailyCloses('GOLDBEES.NS', fromDay).then(r => r.closes).catch(() => none),
    new Promise<typeof none>(resolve => setTimeout(() => resolve(none), fromDay ? 8000 : 4000)),
  ])
}

// ?since=YYYY-MM-DD additionally returns start22kPerGram, the 22K rate just before that day.
// ?historyFrom=YYYY-MM-DD additionally returns longHistory, the daily 22K rate from that day.
export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get('since')
  const historyFrom = req.nextUrl.searchParams.get('historyFrom')
  try {
    const entries = await fetchIBJA()
    if (entries.length === 0) throw new Error('No IBJA data')

    // Most recent rate: the evening one, or the morning one until the evening rate is published
    const latest = entries[0]
    const latestPer10g = latest.pm || latest.am

    const price24kPerGram = latestPer10g / 10
    const price22kPerGram = price24kPerGram * (22 / 24)
    const sovereign       = price22kPerGram * 8   // 1 sovereign = 8g
    const tenGram         = price22kPerGram * 10

    // IBJA's listed days, at the evening rate where there is one
    const ibjaDays = entries.map(e => ({
      date: parseDate(e.date),
      price22k: parseFloat(((e.pm || e.am) / 10 * (22 / 24)).toFixed(0)),
    }))
    const [recentCloses, longCloses] = await Promise.all([
      goldEtfCloses(),
      isIsoDay(historyFrom) ? goldEtfCloses(historyFrom) : null,
    ])
    const history = goldThirtyDayHistory(ibjaDays, recentCloses)
    const hasFullHistory = history.length >= GOLD_AVG_MIN_DAYS

    // Buy/hold/wait signal vs 30-day average, only when there really are 30 days behind it
    const avg30 = history.reduce((s, h) => s + h.price22k, 0) / (history.length || 1)
    const pctAboveAvg = ((price22kPerGram - avg30) / avg30) * 100
    const signal = hasFullHistory ? goldSignal(price22kPerGram, avg30) : null
    const signalText =
      signal === 'buy' ? `${Math.abs(pctAboveAvg).toFixed(1)}% below 30-day avg — Good time to buy`
      : signal === 'wait' ? `${pctAboveAvg.toFixed(1)}% above 30-day avg — Wait for correction`
      : signal === 'hold' ? 'Near 30-day average — Neutral'
      : null

    return NextResponse.json({
      price24kPerGram: Math.round(price24kPerGram),
      price22kPerGram: Math.round(price22kPerGram),
      sovereign:       Math.round(sovereign),
      tenGram:         Math.round(tenGram),
      avg30Day:        hasFullHistory ? Math.round(avg30) : null,
      signal,
      signalText,
      history,
      ...(isIsoDay(historyFrom) ? { longHistory: longCloses?.length ? goldDailyHistory(ibjaDays, longCloses, historyFrom) : null } : {}),
      ...(isIsoDay(since) ? { start22kPerGram: await start22kPerGram(since, price22kPerGram) } : {}),
      source: 'IBJA',
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch gold price' }, { status: 500 })
  }
}
