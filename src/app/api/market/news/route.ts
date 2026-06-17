import { NextResponse } from 'next/server'

const RSS_FEEDS = [
  'https://feeds.feedburner.com/ndtvprofit-latest',
  'https://economictimes.indiatimes.com/markets/stocks/rss.cms',
]

interface NewsItem {
  title: string
  link: string
  pubDate: string
  source: string
  description: string
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
}

function parseRSS(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]

    const title = stripCdata(
      (block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
       block.match(/<title>([\s\S]*?)<\/title>/))?.[1]?.trim() ?? ''
    )

    // feedburner:origLink has the real article URL (FeedBurner redirect links are dead)
    const link = stripCdata(
      (block.match(/<feedburner:origLink>([\s\S]*?)<\/feedburner:origLink>/) ||
       block.match(/<guid[^>]*isPermaLink="true"[^>]*>([\s\S]*?)<\/guid>/) ||
       block.match(/<link>([\s\S]*?)<\/link>/) ||
       block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/))?.[1]?.trim() ?? ''
    )

    const pubDateRaw = (block.match(/<pubDate><!\[CDATA\[([\s\S]*?)\]\]><\/pubDate>/) ||
                        block.match(/<pubDate>([\s\S]*?)<\/pubDate>/))?.[1]?.trim() ?? ''
    const pubDate = stripCdata(pubDateRaw)

    const description = stripCdata(
      (block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
       block.match(/<description>([\s\S]*?)<\/description>/))?.[1]
       ?.replace(/<[^>]+>/g, '')
       ?.trim()
       ?.slice(0, 200) ?? ''
    )

    if (title && link) {
      items.push({ title, link, pubDate, source, description })
    }
  }

  return items.slice(0, 25)
}

export async function GET() {
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const res = await fetch(feed, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml, application/xml, text/xml' },
        next: { revalidate: 900 },
      })
      const text = await res.text()
      const source = feed.includes('ndtv') ? 'NDTV Profit' : 'Economic Times'
      return parseRSS(text, source)
    })
  )

  const allNews: NewsItem[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') allNews.push(...r.value)
  }

  // Sort by date descending
  allNews.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0
    return db - da
  })

  return NextResponse.json({
    articles: allNews.slice(0, 40),
    updatedAt: new Date().toISOString(),
  })
}
