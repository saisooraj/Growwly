import { NextResponse } from 'next/server'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'application/json',
}

const INDICES = [
  { symbol: '^NSEI',    label: 'NIFTY 50'   },
  { symbol: '^BSESN',   label: 'SENSEX'      },
  { symbol: '^NSEBANK', label: 'BANK NIFTY'  },
]

export async function GET() {
  try {
    const results = await Promise.allSettled(
      INDICES.map(async ({ symbol, label }) => {
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`
        const res  = await fetch(url, { headers: HEADERS, next: { revalidate: 60 } })
        const json = await res.json()
        const meta = json.chart?.result?.[0]?.meta
        if (!meta) throw new Error('No data')

        const price     = meta.regularMarketPrice ?? 0
        const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price
        const change    = price - prevClose
        const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0

        return {
          symbol,
          label,
          value:     parseFloat(price.toFixed(2)),
          change:    parseFloat(change.toFixed(2)),
          changePct: parseFloat(changePct.toFixed(2)),
        }
      })
    )

    const data = results.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : { ...INDICES[i], value: 0, change: 0, changePct: 0, error: true }
    )

    return NextResponse.json({ data, updatedAt: new Date().toISOString() })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch indices' }, { status: 500 })
  }
}
