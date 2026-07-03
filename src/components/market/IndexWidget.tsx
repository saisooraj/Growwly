'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface IndexData {
  symbol:    string
  label:     string
  value:     number
  change:    number
  changePct: number
  error?:    boolean
}

export default function IndexWidget() {
  const [data, setData]       = useState<IndexData[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchIndices() {
    try {
      const res  = await fetch('/api/market/indices')
      const json = await res.json()
      if (json.data) setData(json.data)
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchIndices()
    const id = setInterval(fetchIndices, 60_000)
    return () => clearInterval(id)
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', gap: 10 }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ flex: 1, height: 76, borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--border)', animation: 'pulse 1.5s ease infinite' }} />
      ))}
    </div>
  )

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {data.map(ix => {
        const up = ix.changePct >= 0
        return (
          <div
            key={ix.symbol}
            className="card"
            style={{ flex: 1, minWidth: 0, padding: '12px 14px' }}
          >
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
              {ix.label}
            </div>
            <div className="display-num" style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              {ix.error ? '—' : ix.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            {!ix.error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                {up
                  ? <TrendingUp  size={11} style={{ color: 'var(--good-ink)', flexShrink: 0 }} />
                  : <TrendingDown size={11} style={{ color: 'var(--bad-ink)',  flexShrink: 0 }} />
                }
                <span className="display-num" style={{ fontSize: 12, fontWeight: 700, color: up ? 'var(--good-ink)' : 'var(--bad-ink)' }}>
                  {up ? '+' : ''}{ix.changePct.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
