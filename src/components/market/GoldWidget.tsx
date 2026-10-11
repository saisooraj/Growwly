'use client'

import { useState, useEffect, useMemo } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, Minus, ChevronDown } from 'lucide-react'
import { IconCoin } from '@tabler/icons-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts'
import { format, parseISO } from 'date-fns'
import { useAppStore } from '@/store/appStore'
import { computeValue } from '@/lib/assetValuation'
import { legacyGoldPurchases, priceForKarat, type GoldPrices } from '@/lib/gold'
import type { Asset } from '@/types'
import { HoldingSummary, StatGrid, rupees, signedPct } from './HoldingStats'

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
  const assets = useAppStore(s => s.assets)
  const goldAssets = useMemo(() => assets.filter(a => a.kind === 'gold_grams'), [assets])

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

      {goldAssets.length > 0 && <YourGold assets={goldAssets} data={data} />}

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

// ── The user's own gold ──────────────────────────────────────────────────────

const KARATS = [24, 22, 18] as const
const grams = (g: number) => `${g.toLocaleString('en-IN', { maximumFractionDigits: 3 })} g`

function YourGold({ assets, data }: { assets: Asset[]; data: GoldData }) {
  const [showLots, setShowLots] = useState(false)

  // The same per-karat rates Net Worth values gold at
  const prices: GoldPrices = {
    price22k: data.price22kPerGram,
    price24k: parseFloat((data.price22kPerGram * 24 / 22).toFixed(2)),
    price18k: parseFloat((data.price22kPerGram * 18 / 22).toFixed(2)),
  }

  let invested = 0, current = 0
  for (const a of assets) {
    const v = computeValue(a, { gold: prices })
    current += v.currentValue
    invested += v.investedAmount ?? 0
  }

  const lots = assets
    .flatMap(a => legacyGoldPurchases(a).map(p => ({ ...p, assetName: a.name })))
    .filter(p => p.grams > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
  const totalGrams = lots.reduce((s, p) => s + p.grams, 0)

  const byKarat = KARATS.map(karat => {
    const ks = lots.filter(p => p.karat === karat)
    const g = ks.reduce((s, p) => s + p.grams, 0)
    const paid = ks.reduce((s, p) => s + p.grams * p.pricePerGram, 0)
    const rate = priceForKarat(karat, prices)
    return { karat, grams: g, paid, avgPaid: g > 0 && paid > 0 ? paid / g : null, rate, value: g * rate }
  }).filter(k => k.grams > 0)

  // Every karat moves with the 22K rate, so the last day's 22K move scales the whole holding
  const h = data.history
  const prev = h.length >= 2 ? h[h.length - 2].price22k : 0
  const last = h.length >= 1 ? h[h.length - 1].price22k : 0
  const dayChange = prev > 0 && last > 0 ? current * (1 - prev / last) : 0

  return (
    <div className="space-y-3">
      <HoldingSummary
        title={`Your gold · ${grams(totalGrams)}`}
        invested={invested}
        current={current}
        dayChange={dayChange}
        note={invested === 0 ? 'Add purchase prices to your gold in Net Worth to see profit and loss.' : undefined}
      />

      {/* One row per karat held */}
      <div className="space-y-2">
        {byKarat.map(k => {
          const gain = k.paid > 0 ? k.value - k.paid : null
          return (
            <div key={k.karat} className="bg-amber-50/60 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-800 mb-2">{k.karat}K · {grams(k.grams)}</p>
              <StatGrid cols={2} stats={[
                { label: 'Avg paid / g', value: k.avgPaid ? rupees(k.avgPaid) : '—' },
                { label: 'Today / g', value: rupees(k.rate) },
                { label: 'Value', value: rupees(k.value) },
                {
                  label: 'Gain',
                  value: gain !== null ? signedPct(gain / k.paid * 100) : '—',
                  change: gain ?? undefined,
                },
              ]} />
            </div>
          )
        })}
      </div>

      {/* Purchase lots */}
      {lots.length > 0 && (
        <div>
          <button onClick={() => setShowLots(v => !v)}
            className="w-full flex items-center justify-between text-xs font-medium text-slate-500 hover:text-slate-700 py-1">
            <span>{lots.length} {lots.length === 1 ? 'purchase' : 'purchases'}</span>
            <ChevronDown size={14} className={`transition-transform ${showLots ? 'rotate-180' : ''}`} />
          </button>
          {showLots && (
            <div className="divide-y divide-slate-100">
              {lots.map((p, i) => {
                const now = p.grams * priceForKarat(p.karat, prices)
                const paid = p.grams * p.pricePerGram
                const gain = paid > 0 ? now - paid : null
                let date = p.date
                try { date = format(parseISO(p.date), 'd MMM yyyy') } catch {}
                return (
                  <div key={`${p.id}-${i}`} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{grams(p.grams)} · {p.karat}K</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {date}{p.pricePerGram > 0 && ` · paid ${rupees(p.pricePerGram)}/g`}{assets.length > 1 && ` · ${p.assetName}`}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-semibold text-slate-800">{rupees(now)}</p>
                      {gain !== null && (
                        <p className="text-[11px] font-medium" style={{ color: gain >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)' }}>
                          {signedPct(gain / paid * 100)}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
