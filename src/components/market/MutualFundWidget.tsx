'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, X, BarChart3, Search, RefreshCw } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { format } from 'date-fns'
import { useAppStore } from '@/store/appStore'
import { computeValue, type LivePrices } from '@/lib/assetValuation'
import { useWatchlist, type WatchItem } from './useWatchlist'
import { ListTag, StatGrid, HoldingSummary, HiddenHoldingsNote, rupees, signedRupees, signedPct } from './HoldingStats'

interface NavEntry { date: string; nav: string }
interface FundMeta { scheme_name: string; scheme_code: number; fund_house: string }
interface FundData {
  code: number
  name: string
  nav: number
  change1d: number
  change1dPct: number
  change1m: number
  change1mPct: number
  change3m: number
  change3mPct: number
  history: { date: string; value: number }[]
}

// What the user holds of one scheme, summed across every holding of it
interface Position { units: number; invested: number; current: number; dayChange: number; pending: number }

// Seeded into the old device-wide watchlist; dropped when that list is carried over
const LEGACY_DEFAULT_CODES = [122639, 119723]

function legacyFunds(): WatchItem[] {
  try {
    const saved: { code: number; name: string }[] = JSON.parse(localStorage.getItem('sw_mf') ?? '[]')
    return saved.filter(f => !LEGACY_DEFAULT_CODES.includes(f.code)).map(f => ({ key: String(f.code), name: f.name }))
  } catch { return [] }
}

async function fetchFund(code: number): Promise<FundData> {
  const res = await fetch(`https://api.mfapi.in/mf/${code}`)
  const json = await res.json()
  const meta: FundMeta = json.meta
  const data: NavEntry[] = json.data ?? []

  const nav0 = parseFloat(data[0]?.nav ?? '0')
  const nav1 = parseFloat(data[1]?.nav ?? String(nav0))
  const nav30 = parseFloat(data[29]?.nav ?? String(nav0))
  const nav90 = parseFloat(data[89]?.nav ?? String(nav0))

  const history = data
    .slice(0, 30)
    .reverse()
    .map(d => ({ date: d.date, value: parseFloat(parseFloat(d.nav).toFixed(2)) }))

  return {
    code,
    name: meta.scheme_name,
    nav: nav0,
    change1d: parseFloat((nav0 - nav1).toFixed(2)),
    change1dPct: nav1 > 0 ? parseFloat(((nav0 - nav1) / nav1 * 100).toFixed(2)) : 0,
    change1m: parseFloat((nav0 - nav30).toFixed(2)),
    change1mPct: nav30 > 0 ? parseFloat(((nav0 - nav30) / nav30 * 100).toFixed(2)) : 0,
    change3m: parseFloat((nav0 - nav90).toFixed(2)),
    change3mPct: nav90 > 0 ? parseFloat(((nav0 - nav90) / nav90 * 100).toFixed(2)) : 0,
    history,
  }
}

export default function MutualFundWidget() {
  const assets = useAppStore(s => s.assets)
  const mfAssets = useMemo(() => assets.filter(a => a.kind === 'mutual_fund' && Number(a.schemeCode)), [assets])

  const holdings = useMemo(() => {
    const seen = new Set<string>()
    const list: WatchItem[] = []
    for (const a of mfAssets) {
      const key = String(Number(a.schemeCode))
      if (seen.has(key)) continue
      seen.add(key)
      list.push({ key, name: a.name })
    }
    return list
  }, [mfAssets])

  const { items, hiddenHoldings, add, remove, restoreHidden, isListed } = useWatchlist('mf', holdings, legacyFunds)

  const [data, setData] = useState<FundData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<{ schemeCode: string; schemeName: string }[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const fetchSeq = useRef(0)

  // NAVs for every holding (hidden ones still count in the totals) plus the funds on show
  const fetchKey = useMemo(() => Array.from(new Set([...holdings, ...items].map(i => i.key))).sort().join(','), [holdings, items])

  const fetchAll = useCallback(async () => {
    const seq = ++fetchSeq.current
    const codes = fetchKey ? fetchKey.split(',').map(Number) : []
    const results = await Promise.allSettled(codes.map(fetchFund))
    // A fetch for an older list (before a fund was added or removed) must not overwrite a newer one
    if (seq !== fetchSeq.current) return
    const valid = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<FundData>).value)
    setData(valid)
    setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
    setLoading(false)
  }, [fetchKey])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Search once typing pauses; a reply for an older query is dropped
  useEffect(() => {
    const q = searchQ.trim()
    if (q.length < 2) { setSearchResults(null); setSearching(false); return }
    let stale = false
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/market/mf/search?q=${encodeURIComponent(q)}`)
        const json = await res.json()
        if (!stale) setSearchResults(json.results ?? [])
      } catch {
        if (!stale) setSearchResults([])
      } finally {
        if (!stale) setSearching(false)
      }
    }, 300)
    return () => { stale = true; clearTimeout(t) }
  }, [searchQ])

  const byCode = useMemo(() => new Map(data.map(d => [d.code, d])), [data])

  // Valued the same way as Net Worth, from the NAVs fetched here
  const positions = useMemo(() => {
    const prices: LivePrices = { mf: {} }
    for (const d of data) prices.mf![String(d.code)] = { nav: d.nav, change: d.change1d, changePct: d.change1dPct, schemeName: d.name }
    const map = new Map<number, Position>()
    for (const a of mfAssets) {
      const code = Number(a.schemeCode)
      const v = computeValue({ ...a, schemeCode: String(code) }, prices)
      const units = a.units ?? 0
      const p = map.get(code) ?? { units: 0, invested: 0, current: 0, dayChange: 0, pending: 0 }
      p.units += units
      p.invested += v.gainPct !== null ? v.currentValue - v.gain : (a.investedAmount ?? a.value)
      p.current += v.currentValue
      p.dayChange += units * (byCode.get(code)?.change1d ?? 0)
      p.pending += v.pendingAmount
      map.set(code, p)
    }
    return map
  }, [mfAssets, data, byCode])

  const totals = useMemo(() => {
    let invested = 0, current = 0, dayChange = 0, pending = 0
    positions.forEach(p => { invested += p.invested; current += p.current; dayChange += p.dayChange; pending += p.pending })
    return { invested, current, dayChange, pending }
  }, [positions])

  function addFund(code: number, name: string) {
    setShowAdd(false)
    setSearchQ('')
    add({ key: String(code), name })
  }

  function removeFund(code: number) {
    remove(String(code))
    if (expanded === code) setExpanded(null)
  }

  const shown = items.map(i => byCode.get(Number(i.key))).filter((d): d is FundData => !!d)
  const holdingCodes = new Set(holdings.map(h => Number(h.key)))

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-purple-500" />
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Mutual Funds</h3>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">NAV Daily</span>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && <span className="text-xs text-slate-400">{lastUpdated}</span>}
          <button onClick={fetchAll} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
            <RefreshCw size={13} />
          </button>
          <button onClick={() => setShowAdd(v => !v)} className="btn-primary py-1 px-2.5 text-xs">
            <Plus size={13} /> Add
          </button>
        </div>
      </div>

      {/* Search panel */}
      {showAdd && (
        <div className="bg-slate-50 rounded-xl p-3 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-8 text-sm"
              placeholder="Search fund name..."
              value={searchQ}
              autoFocus
              onChange={e => setSearchQ(e.target.value)}
            />
          </div>
          {searching && <p className="text-xs text-slate-400 text-center py-2">Searching...</p>}
          {!searching && searchResults?.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-2">No funds match &ldquo;{searchQ.trim()}&rdquo;. Try fewer or different words.</p>
          )}
          {!searching && searchResults?.map(r => {
            const code = Number(r.schemeCode)
            const onList = isListed(String(code))
            return (
              <button
                key={r.schemeCode}
                onClick={() => addFund(code, r.schemeName)}
                disabled={onList}
                className="w-full flex items-center gap-2 text-left text-xs p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200 disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:border-transparent"
              >
                <span className="flex-1 min-w-0">
                  <span className="font-medium text-slate-700">{r.schemeName}</span>
                  <span className="text-slate-400 ml-1">#{r.schemeCode}</span>
                </span>
                {onList && <span className="flex-shrink-0 text-[10px] text-slate-500">On list</span>}
              </button>
            )
          })}
        </div>
      )}

      {!loading && positions.size > 0 && (
        <HoldingSummary
          title={`Your mutual funds · ${positions.size} ${positions.size === 1 ? 'fund' : 'funds'}`}
          invested={totals.invested}
          current={totals.current}
          dayChange={totals.dayChange}
          note={totals.pending > 0 ? `${rupees(totals.pending)} is waiting on units and is counted at cost.` : undefined}
        />
      )}

      {/* Fund cards */}
      {loading && items.length > 0 ? (
        <div className="space-y-2">
          {items.map(f => <div key={f.key} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">
          No funds on your watchlist. Add a mutual fund holding in Net Worth, or tap Add to watch one.
        </p>
      ) : (
        <div className="space-y-3">
          {shown.map(fund => {
            const pos = positions.get(fund.code)
            const gain = pos ? pos.current - pos.invested : 0
            return (
              <div key={fund.code} className="bg-slate-50 rounded-xl overflow-hidden">
                <div
                  className="flex items-start gap-3 p-3 cursor-pointer"
                  onClick={() => setExpanded(expanded === fund.code ? null : fund.code)}
                >
                  <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <BarChart3 size={16} className="text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 leading-tight line-clamp-1">{fund.name}</p>
                      <ListTag holding={holdingCodes.has(fund.code)} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-slate-400">1D: <span className={fund.change1dPct >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>{fund.change1dPct >= 0 ? '+' : ''}{fund.change1dPct}%</span></span>
                      <span className="text-xs text-slate-400">1M: <span className={fund.change1mPct >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>{fund.change1mPct >= 0 ? '+' : ''}{fund.change1mPct}%</span></span>
                      <span className="text-xs text-slate-400">3M: <span className={fund.change3mPct >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>{fund.change3mPct >= 0 ? '+' : ''}{fund.change3mPct}%</span></span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-800">₹{fund.nav.toFixed(2)}</p>
                    <p className={`text-xs font-medium ${fund.change1d >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {fund.change1d >= 0 ? '+' : ''}₹{fund.change1d}
                    </p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); removeFund(fund.code) }}
                    aria-label={`Remove ${fund.name} from watchlist`}
                    title="Remove from watchlist"
                    className="p-1.5 -m-0.5 hover:bg-red-100 rounded-lg text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* What the user holds of this fund */}
                {pos && (
                  <div className="mx-3 pb-3 pt-2.5 border-t border-slate-200/70">
                    <StatGrid stats={[
                      { label: 'Units', value: pos.units > 0 ? pos.units.toLocaleString('en-IN', { maximumFractionDigits: 3 }) : '—' },
                      { label: 'Avg NAV', value: pos.units > 0 && pos.invested > 0 ? rupees((pos.invested - pos.pending) / pos.units, 2) : '—' },
                      { label: 'Invested', value: pos.invested > 0 ? rupees(pos.invested) : '—' },
                      { label: 'Current value', value: rupees(pos.current) },
                      {
                        label: 'P&L',
                        value: pos.invested > 0 ? <>{signedRupees(gain)} <span className="font-normal">({signedPct(gain / pos.invested * 100)})</span></> : '—',
                        change: pos.invested > 0 ? gain : undefined,
                      },
                      { label: 'Day change', value: signedRupees(pos.dayChange), change: pos.dayChange },
                    ]} />
                  </div>
                )}

                {/* Expanded 30-day chart */}
                {expanded === fund.code && fund.history.length > 0 && (
                  <div className="px-3 pb-3 pt-2">
                    <p className="text-xs text-slate-400 mb-2">30-day NAV</p>
                    <ResponsiveContainer width="100%" height={100}>
                      <AreaChart data={fund.history} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                        <defs>
                          <linearGradient id={`mfGrad${fund.code}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={v => {
                          try { return format(new Date(v.split('-').reverse().join('-')), 'dd MMM') } catch { return v }
                        }} interval={6} axisLine={false} tickLine={false} />
                        <Tooltip
                          formatter={(v: number) => [`₹${v}`, 'NAV']}
                          contentStyle={{ borderRadius: '8px', fontSize: 11, border: '1px solid #e2e8f0' }}
                        />
                        <Area type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={1.5} fill={`url(#mfGrad${fund.code})`} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <HiddenHoldingsNote count={hiddenHoldings.length} onRestore={restoreHidden} />
      <p className="text-xs text-slate-400 text-center">Source: MFAPI.in · NAV updated daily after 9 PM</p>
    </div>
  )
}
