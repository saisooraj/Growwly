import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await fetch('https://zenquotes.io/api/random', { cache: 'no-store' })
    const data = await res.json()
    const { q, a } = data[0]
    return NextResponse.json({ quote: q, author: a })
  } catch {
    return NextResponse.json(
      { quote: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
      { status: 200 }
    )
  }
}
