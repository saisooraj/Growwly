import { NextRequest, NextResponse } from 'next/server'

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 1) return NextResponse.json({ results: [] })

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false&region=IN&lang=en-IN`
    const res = await fetch(url, { headers: HEADERS, next: { revalidate: 60 } })
    const json = await res.json()

    const results = (json.quotes ?? [])
      .filter((q: { quoteType?: string }) => q.quoteType === 'EQUITY' || q.quoteType === 'MUTUALFUND' || q.quoteType === 'ETF')
      .slice(0, 10)
      .map((q: { symbol: string; longname?: string; shortname?: string; exchange?: string; quoteType?: string }) => ({
        symbol: q.symbol,
        name: q.longname ?? q.shortname ?? q.symbol,
        exchange: q.exchange ?? '',
        type: q.quoteType ?? 'EQUITY',
      }))

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
