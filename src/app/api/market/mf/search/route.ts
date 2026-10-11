import { NextRequest, NextResponse } from 'next/server'

interface Scheme { schemeCode: number; schemeName: string }

// mfapi's own search matches the query as one exact phrase ("parag flexi" finds nothing, and
// word order matters), so we match words against the full scheme list instead. The list is
// ~6 MB, too big for Next's fetch cache, so it is held in memory for a day per server instance.
const LIST_TTL = 24 * 60 * 60 * 1000
interface SchemeList { at: number; schemes: { code: string; name: string; words: string[] }[] }
let list: SchemeList | null = null
let loading: Promise<SchemeList> | null = null

const normalize = (s: string) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()

async function loadList() {
  if (list && Date.now() - list.at < LIST_TTL) return list
  loading ??= fetch('https://api.mfapi.in/mf', { cache: 'no-store' })
    .then(res => res.json())
    .then((rows: Scheme[]): SchemeList => {
      list = {
        at: Date.now(),
        schemes: rows.map(r => ({ code: String(r.schemeCode), name: r.schemeName, words: normalize(r.schemeName).split(' ') })),
      }
      return list
    })
    .finally(() => { loading = null })
  return loading
}

// Direct growth plans first (what most people hold), then the closest name, then newer schemes
function planScore(words: string[]) {
  let score = 0
  if (words.includes('direct')) score += 2
  if (words.includes('growth')) score += 2
  if (words.some(w => w === 'idcw' || w === 'dividend' || w === 'bonus')) score -= 2
  return score
}

async function phraseSearch(q: string) {
  const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`, { next: { revalidate: 300 } })
  const data = await res.json()
  return (Array.isArray(data) ? data : []).map((item: Scheme) => ({
    schemeCode: String(item.schemeCode),
    schemeName: item.schemeName,
  }))
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const words = normalize(q).split(' ').filter(Boolean)
  try {
    const { schemes } = await loadList()
    const results = schemes
      // Each typed word must start a word of the name: "small" finds "Smallcap", "50" skips "250"
      .filter(s => words.every(w => s.words.some(t => t.startsWith(w))))
      .sort((a, b) =>
        planScore(b.words) - planScore(a.words) ||
        a.words.length - b.words.length ||
        Number(b.code) - Number(a.code))
      .slice(0, 15)
      .map(s => ({ schemeCode: s.code, schemeName: s.name }))
    return NextResponse.json({ results })
  } catch {
    try {
      return NextResponse.json({ results: (await phraseSearch(q)).slice(0, 15) })
    } catch {
      return NextResponse.json({ results: [] })
    }
  }
}
