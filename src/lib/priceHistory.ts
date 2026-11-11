// Server-side helpers for "what was the price just before a date" — used to value holdings
// at the start of the salary cycle so the net worth page can show this month's returns.
// `since` is always an ISO day (YYYY-MM-DD); the price returned is the last one published
// strictly before it, i.e. the closing value the cycle started from.

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'application/json',
}

export const isIsoDay = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

// "06-11-2026" → "2026-11-06"
export function ddmmyyyyToIso(d: string): string {
  const [dd, mm, yyyy] = d.split(/[-/]/)
  return `${yyyy}-${mm}-${dd}`
}

// Last value dated before `since` from a list in any order. null when none is that old.
export function valueBefore<T>(rows: T[], dateOf: (r: T) => string, valueOf: (r: T) => number, since: string): number | null {
  let best: { date: string; value: number } | null = null
  for (const r of rows) {
    const date = dateOf(r), value = valueOf(r)
    if (!(value > 0) || date >= since) continue
    if (!best || date > best.date) best = { date, value }
  }
  return best?.value ?? null
}

// Daily closes for a Yahoo symbol over the last three months (enough for any salary cycle).
export async function yahooDailyCloses(symbol: string): Promise<{ closes: { date: string; close: number }[]; price: number }> {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`
  const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 3600 } })
  const json = await res.json()
  const result = json.chart?.result?.[0]
  const offset: number = result?.meta?.gmtoffset ?? 19800
  const stamps: number[] = result?.timestamp ?? []
  const raw: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? []
  const closes = stamps
    .map((t, i) => ({ date: new Date((t + offset) * 1000).toISOString().slice(0, 10), close: raw[i] ?? 0 }))
    .filter(c => c.close > 0)
  return { closes, price: result?.meta?.regularMarketPrice ?? 0 }
}

export async function yahooCloseBefore(symbol: string, since: string): Promise<number | null> {
  const { closes } = await yahooDailyCloses(symbol)
  return valueBefore(closes, c => c.date, c => c.close, since)
}
