import { NextRequest, NextResponse } from 'next/server'

// NPS scheme NAVs — sourced from npsnav.in (free, no key, non-commercial use).
// Daily NAVs published by the CRAs; this proxy caches them so the client makes
// one call regardless of how many schemes the user holds.
//
//   ?action=schemes                 → { results: [{ schemeCode, schemeName }] }
//   ?action=history&code=SM008003   → { history: [{ date, value }] }
//   ?codes=SM008003,SM001003        → { nav: { CODE: { nav, schemeName, changePct } } }

const BASE = 'https://npsnav.in/api'
const UA = 'Mozilla/5.0 (compatible; SpendWise/1.0)'

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action')

  try {
    if (action === 'schemes') {
      const res = await fetch(`${BASE}/schemes`, {
        headers: { 'User-Agent': UA },
        next: { revalidate: 86400 },
      })
      const json = await res.json()
      const results = (Array.isArray(json.data) ? json.data : [])
        .map((row: [string, string]) => ({ schemeCode: row[0], schemeName: row[1] }))
        .filter((r: { schemeCode: string; schemeName: string }) => r.schemeCode && r.schemeName)
      return NextResponse.json({ results })
    }

    if (action === 'history') {
      const code = req.nextUrl.searchParams.get('code')?.trim()
      if (!code) return NextResponse.json({ history: [] })
      const res = await fetch(`${BASE}/historical/${encodeURIComponent(code)}`, {
        headers: { 'User-Agent': UA },
        next: { revalidate: 21600 },
      })
      const json = await res.json()
      const history = (Array.isArray(json.data) ? json.data : [])
        .slice(0, 40)
        .map((d: { date: string; nav: number }) => ({ date: d.date, value: d.nav }))
        .reverse()
      return NextResponse.json({ history })
    }

    // Default: latest NAV for the requested scheme codes.
    const codes = req.nextUrl.searchParams.get('codes')
    if (!codes) return NextResponse.json({ nav: {} })
    const wanted = new Set(codes.split(',').map(s => s.trim()).filter(Boolean).slice(0, 30))

    const res = await fetch(`${BASE}/latest`, {
      headers: { 'User-Agent': UA },
      next: { revalidate: 21600 }, // NAVs refresh once per business day
    })
    const json = await res.json()
    const rows: Record<string, string>[] = Array.isArray(json.data) ? json.data : []

    const nav: Record<string, { nav: number; schemeName: string; changePct: number }> = {}
    for (const row of rows) {
      const code = row['Scheme Code']
      if (!wanted.has(code)) continue
      nav[code] = {
        nav: parseFloat(row['NAV'] ?? '0') || 0,
        schemeName: row['Scheme Name'] ?? '',
        changePct: parseFloat(row['1D'] ?? '0') || 0,
      }
    }
    return NextResponse.json({ nav, updatedAt: new Date().toISOString() })
  } catch {
    return NextResponse.json(
      action === 'schemes' ? { results: [] } : action === 'history' ? { history: [] } : { nav: {} },
    )
  }
}
