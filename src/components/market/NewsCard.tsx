'use client'

import { useState, type CSSProperties, type UIEvent } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { CardHeader, CardState, PATH, Svg, cardStyle } from './ui'
import type { useNews } from './useMarketData'

const PAGE_SIZE = 6

function timeAgo(pubDate: string) {
  try { return formatDistanceToNow(new Date(pubDate), { addSuffix: true }) } catch { return pubDate }
}

export default function NewsCard({ news }: { news: ReturnType<typeof useNews> }) {
  const [count, setCount] = useState(PAGE_SIZE)
  const { articles } = news
  const visible = articles.slice(0, count)

  // More headlines as the list nears its end
  function onScroll(e: UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 40 && count < articles.length) setCount(c => c + PAGE_SIZE)
  }

  const bar = (style: CSSProperties) => <div className="mkt-skel" style={{ background: 'var(--surface-2)', ...style }} />

  return (
    <section style={{ ...cardStyle, overflow: 'hidden' }}>
      <CardHeader
        title="News" tag={{ label: 'India', bg: 'var(--surface-2)', ink: 'var(--text-2)' }} padBottom={12}
        cadence="every 15 min" refreshing={news.refreshing} onRefresh={async () => { await news.refresh(); setCount(PAGE_SIZE) }}
      />

      {news.loading && [0, 1, 2, 3].map(i => (
        <div key={i} style={{ padding: '12px var(--cx)', borderTop: '1px solid var(--border)' }}>
          {bar({ height: 12, borderRadius: 6 })}
          {bar({ width: '70%', height: 12, borderRadius: 6, marginTop: 7 })}
          {bar({ width: '36%', height: 10, borderRadius: 5, marginTop: 10 })}
        </div>
      ))}

      {!news.loading && articles.length === 0 && (
        <CardState icon={PATH.offline} bg="var(--surface-2)" ink="var(--text-3)" title="No news available" text="Check your connection and refresh." />
      )}

      {!news.loading && articles.length > 0 && (
        <div onScroll={onScroll} style={{ maxHeight: 480, overflowY: 'auto', scrollbarWidth: 'thin' }}>
          {visible.map((n, i) => (
            <a key={`${n.link}-${i}`} href={n.link} target="_blank" rel="noopener noreferrer" className="mkt-hov" style={{
              display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 16px', gap: 12, padding: '12px var(--cx)',
              borderTop: '1px solid var(--border)', textDecoration: 'none', color: 'inherit',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.35, color: 'var(--text)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textWrap: 'pretty' }}>
                  {n.title}
                </div>
                {n.description && (
                  <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.description}</div>
                )}
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6, display: 'flex', gap: 6 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>{n.source}</span>
                  {n.pubDate && <>·<span>{timeAgo(n.pubDate)}</span></>}
                </div>
              </div>
              <Svg d={PATH.external} size={15} style={{ color: 'var(--text-4)', marginTop: 2 }} />
            </a>
          ))}
          <div style={{ padding: '12px var(--cx) 14px', borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text-3)', textAlign: 'center' }}>
            {count < articles.length ? 'Scroll for more headlines' : 'You’re all caught up'}
          </div>
        </div>
      )}
    </section>
  )
}
