import { NextRequest, NextResponse } from 'next/server'
import { ddmmyyyyToIso, isIsoDay, valueBefore } from '@/lib/priceHistory'

// ?codes=A,B → latest NAVs. Add &since=YYYY-MM-DD to also get each scheme's NAV just before
// that day (startNav), used for this cycle's returns on the net worth page.

export async function GET(req: NextRequest) {
  const codes = req.nextUrl.searchParams.get('codes')
  if (!codes) return NextResponse.json({ nav: {} })

  const since = req.nextUrl.searchParams.get('since')
  const schemeList = codes.split(',').map(s => s.trim()).filter(Boolean).slice(0, 20)

  try {
    const results = await Promise.allSettled(
      schemeList.map(async (code) => {
        const res = await fetch(`https://api.mfapi.in/mf/${code}`, {
          next: { revalidate: 3600 }, // NAV updates once a day
        })
        const json = await res.json()
        const latestNav = parseFloat(json.data?.[0]?.nav ?? '0')
        const prevNav   = parseFloat(json.data?.[1]?.nav ?? '0')
        const change    = prevNav > 0 ? latestNav - prevNav : 0
        const changePct = prevNav > 0 ? (change / prevNav) * 100 : 0
        return {
          code,
          schemeName: json.meta?.scheme_name ?? '',
          nav: latestNav,
          change: parseFloat(change.toFixed(4)),
          changePct: parseFloat(changePct.toFixed(2)),
          date: json.data?.[0]?.date ?? '',
          ...(isIsoDay(since) ? {
            startNav: valueBefore<{ date: string; nav: string }>(json.data ?? [], d => ddmmyyyyToIso(d.date), d => parseFloat(d.nav), since),
          } : {}),
        }
      })
    )

    const nav: Record<string, { schemeName: string; nav: number; change: number; changePct: number; date: string; startNav?: number | null }> = {}
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') nav[schemeList[i]] = r.value
    })

    return NextResponse.json({ nav, updatedAt: new Date().toISOString() })
  } catch {
    return NextResponse.json({ nav: {} })
  }
}
