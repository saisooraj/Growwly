import { NextRequest, NextResponse } from 'next/server'
import { isIsoDay, yahooCloseBefore } from '@/lib/priceHistory'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'application/json',
}

// The chart API has no marketState; the regular session's window tells us whether it is open now
function isRegularSession(meta: { currentTradingPeriod?: { regular?: { start: number; end: number } } }) {
  const r = meta.currentTradingPeriod?.regular
  const now = Date.now() / 1000
  return !!r && now >= r.start && now < r.end
}

export async function GET(req: NextRequest) {
  const symbols = req.nextUrl.searchParams.get('symbols') ?? 'HDFCBANK.NS'
  // Optional: also return each symbol's close just before this day (startPrice)
  const since = req.nextUrl.searchParams.get('since')
  const syms = symbols.split(',').map(s => s.trim()).filter(Boolean).slice(0, 30)

  try {
    const results = await Promise.allSettled(
      syms.map(async (symbol) => {
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
        const res = await fetch(url, { headers: HEADERS, next: { revalidate: 60 } })
        const json = await res.json()
        const meta = json.chart?.result?.[0]?.meta
        const closes = json.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
        const validCloses = closes.filter((c: number | null) => c != null)

        if (!meta) throw new Error('No data')

        const price = meta.regularMarketPrice ?? 0
        const startPrice = isIsoDay(since) ? await yahooCloseBefore(symbol, since).catch(() => null) : undefined
        // The last daily close is today's (or the latest session's) price, so the one before it is
        // the previous close. chartPreviousClose is the close before the 5-day window, not yesterday.
        const prevClose = validCloses.length >= 2 ? validCloses[validCloses.length - 2] : meta.chartPreviousClose ?? meta.previousClose ?? price
        const change = price - prevClose
        const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0

        return {
          symbol,
          name: meta.longName ?? meta.shortName ?? symbol,
          price: parseFloat(price.toFixed(2)),
          change: parseFloat(change.toFixed(2)),
          changePct: parseFloat(changePct.toFixed(2)),
          high52w: meta.fiftyTwoWeekHigh ?? null,
          low52w: meta.fiftyTwoWeekLow ?? null,
          currency: meta.currency ?? 'INR',
          marketState: isRegularSession(meta) ? 'REGULAR' : 'CLOSED',
          sparkline: validCloses.map((c: number) => parseFloat(c.toFixed(2))),
          ...(startPrice !== undefined ? { startPrice } : {}),
        }
      })
    )

    const data = results.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : { symbol: syms[i], error: true, name: syms[i], price: 0, change: 0, changePct: 0, sparkline: [] }
    )

    return NextResponse.json({ data, updatedAt: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch stocks' }, { status: 500 })
  }
}
