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
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
        const res  = await fetch(url, { headers: HEADERS, next: { revalidate: 60 } })
        const json = await res.json()
        const meta = json.chart?.result?.[0]?.meta
        if (!meta) throw new Error('No data')
        const closes: number[] = (json.chart.result[0].indicators?.quote?.[0]?.close ?? []).filter((c: number | null) => c != null)

        const price     = meta.regularMarketPrice ?? 0
        // The last daily close is the latest session's price, so the one before it is the previous close
        const prevClose = closes.length >= 2 ? closes[closes.length - 2] : meta.chartPreviousClose ?? meta.previousClose ?? price
        const change    = price - prevClose
        const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0
        // The chart API has no marketState; the regular session's window tells us whether it is open now
        const regular   = meta.currentTradingPeriod?.regular
        const now       = Date.now() / 1000
        const open      = !!regular && now >= regular.start && now < regular.end

        return {
          symbol,
          label,
          value:     parseFloat(price.toFixed(2)),
          change:    parseFloat(change.toFixed(2)),
          changePct: parseFloat(changePct.toFixed(2)),
          open,
        }
      })
    )

    const data = results.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : { ...INDICES[i], value: 0, change: 0, changePct: 0, error: true }
    )
    const live = results.find(r => r.status === 'fulfilled')
    const marketOpen = live && live.status === 'fulfilled' ? live.value.open : null

    return NextResponse.json({ data, marketOpen, updatedAt: new Date().toISOString() })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch indices' }, { status: 500 })
  }
}
