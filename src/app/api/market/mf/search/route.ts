import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  try {
    const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`, {
      next: { revalidate: 300 },
    })
    const data = await res.json()
    const results = (Array.isArray(data) ? data : []).slice(0, 15).map((item: { schemeCode: number; schemeName: string }) => ({
      schemeCode: String(item.schemeCode),
      schemeName: item.schemeName,
    }))
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
