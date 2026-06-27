'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { IconCoin } from '@tabler/icons-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts'
import { format, parseISO } from 'date-fns'

interface GoldData {
  price24kPerGram: number
  price22kPerGram: number
  sovereign: number
  tenGram: number
  avg30Day: number
  signal: 'buy' | 'hold' | 'wait'
  signalText: string
  history: { date: string; price22k: number }[]
  updatedAt: string
  error?: string
}

const SIGNAL_STYLES = {
  buy:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  icon: TrendingUp,   label: 'Good time to buy' },
  hold: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', icon: Minus,        label: 'Neutral — Hold' },
  wait: { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    icon: TrendingDown, label: 'Wait for correction' },
}

export default function GoldWidget() {
  const [data, setData] = useState<GoldData | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchGold() {
    setLoading(true)
    try {
      const res = await fetch('/api/market/gold')
      const json = await res.json()
      setData(json)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGold()
    const id = setInterval(fetchGold, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  if (loading) {
    return (
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <IconCoin size={18} className="text-amber-500" stroke={1.5} />
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Gold — 22K</h3>
        </div>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!data || data.error) {
    return (
      <div className="card">
        <p className="text-sm text-slate-400 text-center py-4">Gold prices unavailable — check connection</p>
      </div>
    )
  }

  const signal = SIGNAL_STYLES[data.signal]
  const SignalIcon = signal.icon

  const chartHistory = data.history.slice(-30).map(h => ({
    ...h,
    dateLabel: (() => { try { return format(parseISO(h.date), 'dd MMM') } catch { return h.date } })(),
  }))

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconCoin size={18} className="text-amber-500" stroke={1.5} />
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Gold — 22K (IBJA)</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            {new Date(data.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button onClick={fetchGold} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Price grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-yellow-50 rounded-xl p-3">
          <p className="text-xs text-yellow-700 font-medium mb-0.5">22K / gram</p>
          <p className="text-xl font-bold text-yellow-800">₹{data.price22kPerGram.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-xs text-slate-500 font-medium mb-0.5">24K / gram</p>
          <p className="text-xl font-bold text-slate-800">₹{data.price24kPerGram.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-xs text-slate-500 font-medium mb-0.5">1 Sovereign (8g)</p>
          <p className="text-lg font-bold text-slate-800">₹{data.sovereign.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-xs text-slate-500 font-medium mb-0.5">10 grams (22K)</p>
          <p className="text-lg font-bold text-slate-800">₹{data.tenGram.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Buy signal */}
      <div className={`flex items-start gap-3 p-3 rounded-xl border ${signal.bg} ${signal.border}`}>
        <SignalIcon size={16} className={`${signal.text} mt-0.5 flex-shrink-0`} />
        <div>
          <p className={`text-sm font-semibold ${signal.text}`}>{signal.label}</p>
          <p className={`text-xs ${signal.text} opacity-80`}>{data.signalText}</p>
          <p className="text-xs text-slate-400 mt-0.5">30-day avg: ₹{data.avg30Day.toLocaleString('en-IN')}/g</p>
        </div>
      </div>

      {/* Monthly history chart */}
      {chartHistory.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 font-medium mb-2">30-Day Price History (22K/gram)</p>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={chartHistory} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="dateLabel" tick={{ fontSize: 9, fill: '#94a3b8' }} interval={6} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={v => `₹${(v/1000).toFixed(0)}K`}
                domain={['auto', 'auto']}
              />
              <ReferenceLine y={data.avg30Day} stroke="#94a3b8" strokeDasharray="3 3"
                label={{ value: 'Avg', fontSize: 9, fill: '#94a3b8', position: 'right' }}
              />
              <Tooltip
                formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, '22K/gram']}
                contentStyle={{ borderRadius: '8px', fontSize: 11, border: '1px solid #e2e8f0' }}
              />
              <Area type="monotone" dataKey="price22k" stroke="#f59e0b" strokeWidth={2} fill="url(#goldGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">
        IBJA national rate · Local prices may vary by ₹50–200/10g · Refreshes every 5 min
      </p>
    </div>
  )
}
