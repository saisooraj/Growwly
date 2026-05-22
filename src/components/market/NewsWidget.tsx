'use client'

import { useState, useEffect } from 'react'
import { Newspaper, RefreshCw, ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Article {
  title: string
  link: string
  pubDate: string
  source: string
  description: string
}

export default function NewsWidget() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState('')

  async function fetchNews() {
    setLoading(true)
    try {
      const res = await fetch('/api/market/news')
      const json = await res.json()
      setArticles(json.articles ?? [])
      setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNews()
    const id = setInterval(fetchNews, 15 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  function timeAgo(pubDate: string) {
    try {
      return formatDistanceToNow(new Date(pubDate), { addSuffix: true })
    } catch {
      return pubDate
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper size={16} className="text-blue-500" />
          <h3 className="font-semibold text-slate-800">Market News</h3>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">India</span>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && <span className="text-xs text-slate-400">{lastUpdated}</span>}
          <button onClick={fetchNews} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No news available — check connection</p>
      ) : (
        <div className="space-y-1">
          {articles.map((article, i) => (
            <a
              key={i}
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 leading-snug group-hover:text-brand-600 transition-colors line-clamp-2">
                  {article.title}
                </p>
                {article.description && (
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{article.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-blue-500 font-medium">{article.source}</span>
                  {article.pubDate && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs text-slate-400">{timeAgo(article.pubDate)}</span>
                    </>
                  )}
                </div>
              </div>
              <ExternalLink size={12} className="text-slate-300 group-hover:text-slate-500 mt-1 flex-shrink-0 transition-colors" />
            </a>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">Sources: NDTV Profit, Economic Times · Refreshes every 15 min</p>
    </div>
  )
}
