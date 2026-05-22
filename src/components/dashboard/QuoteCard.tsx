'use client'

import { useEffect, useState } from 'react'
import { Quote } from 'lucide-react'

interface QuoteData {
  quote: string
  author: string
}

const CACHE_KEY = 'growwly_last_quote'

export default function QuoteCard() {
  const [data, setData] = useState<QuoteData | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    fetch(`/api/quote?t=${Date.now()}`)
      .then(r => r.json())
      .then((d: QuoteData) => {
        setData(d)
        localStorage.setItem(CACHE_KEY, JSON.stringify(d))
      })
      .catch(() => {})
  }, [])

  if (!data) return (
    <div className="rounded-2xl px-5 py-4 bg-gradient-to-br from-brand-600/10 to-fuchsia-600/10 border border-brand-200/30 dark:border-brand-500/20 space-y-2 animate-pulse">
      <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
      <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mt-1" />
    </div>
  )

  return (
    <div className="relative overflow-hidden rounded-2xl px-5 py-4 bg-gradient-to-br from-brand-600/10 to-fuchsia-600/10 border border-brand-200/30 dark:border-brand-500/20">
      <Quote size={28} className="absolute top-3 right-4 text-brand-300/30 dark:text-brand-500/20" />
      <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed pr-8 font-medium">
        "{data.quote}"
      </p>
      <p className="text-xs text-brand-500 dark:text-brand-400 font-semibold mt-2">
        — {data.author}
      </p>
    </div>
  )
}
