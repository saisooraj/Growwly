'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, BarChart3, Search, RefreshCw } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { format, parseISO } from 'date-fns'

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

const DEFAULT_FUNDS = [
  { code: 122639, name: 'Parag Parikh Flexi Cap — Direct' },
  { code: 119723, name: 'SBI ELSS Tax Saver — Direct' },
]

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
  const [funds, setFunds] = useState<{ code: number; name: string }[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_FUNDS
    const saved = localStorage.getItem('sw_mf')
    return saved ? JSON.parse(saved) : DEFAULT_FUNDS
  })
  const [data, setData] = useState<FundData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<{ schemeCode: number; schemeName: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  const fetchAll = useCallback(async () => {
    if (!funds.length) return
    const results = await Promise.allSettled(funds.map(f => fetchFund(f.code)))
    const valid = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<FundData>).value)
    setData(valid)
    setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
    setLoading(false)
  }, [funds])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function searchFunds(q: string) {
    if (q.length < 3) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      setSearchResults(json.slice(0, 6))
    } finally {
      setSearching(false)
    }
  }

  function addFund(code: number, name: string) {
    if (funds.find(f => f.code === code)) return
    const next = [...funds, { code, name }]
    setFunds(next)
    localStorage.setItem('sw_mf', JSON.stringify(next))
    setShowAdd(false)
    setSearchQ('')
    setSearchResults([])
    fetchFund(code).then(d => setData(prev => [...prev, d]))
  }

  function removeFund(code: number) {
    const next = funds.filter(f => f.code !== code)
    setFunds(next)
    localStorage.setItem('sw_mf', JSON.stringify(next))
    setData(d => d.filter(f => f.code !== code))
  }

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
              onChange={e => { setSearchQ(e.target.value); searchFunds(e.target.value) }}
            />
          </div>
          {searching && <p className="text-xs text-slate-400 text-center py-2">Searching...</p>}
          {searchResults.map(r => (
            <button
              key={r.schemeCode}
              onClick={() => addFund(r.schemeCode, r.schemeName)}
              className="w-full text-left text-xs p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200"
            >
              <span className="font-medium text-slate-700">{r.schemeName}</span>
              <span className="text-slate-400 ml-1">#{r.schemeCode}</span>
            </button>
          ))}
        </div>
      )}

      {/* Fund cards */}
      {loading ? (
        <div className="space-y-2">
          {funds.map(f => <div key={f.code} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {data.map(fund => (
            <div key={fund.code} className="bg-slate-50 rounded-xl overflow-hidden group">
              <div
                className="flex items-start gap-3 p-3 cursor-pointer"
                onClick={() => setExpanded(expanded === fund.code ? null : fund.code)}
              >
                <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <BarChart3 size={16} className="text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 leading-tight line-clamp-1">{fund.name}</p>
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
                {funds.length > 1 && (
                  <button onClick={e => { e.stopPropagation(); removeFund(fund.code) }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded-lg text-slate-300 hover:text-red-500 transition-all">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Expanded 30-day chart */}
              {expanded === fund.code && fund.history.length > 0 && (
                <div className="px-3 pb-3">
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
          ))}
        </div>
      )}
      <p className="text-xs text-slate-400 text-center">Source: MFAPI.in · NAV updated daily after 9 PM</p>
    </div>
  )
}
