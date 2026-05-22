import { NextRequest, NextResponse } from 'next/server'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'application/json',
}

export async function GET(req: NextRequest) {
  const symbols = req.nextUrl.searchParams.get('symbols') ?? 'HDFCBANK.NS'
  const syms = symbols.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10)

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
        const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price
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
          marketState: meta.marketState ?? 'CLOSED',
          sparkline: validCloses.map((c: number) => parseFloat(c.toFixed(2))),
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
