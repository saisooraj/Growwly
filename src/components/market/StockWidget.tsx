'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, X, TrendingUp, TrendingDown, RefreshCw, Minus, Search } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { useAppStore } from '@/store/appStore'
import { computeValue, type LivePrices } from '@/lib/assetValuation'
import { useWatchlist, type WatchItem } from './useWatchlist'
import { ListTag, StatGrid, HoldingSummary, HiddenHoldingsNote, rupees, signedRupees, signedPct } from './HoldingStats'

interface StockData {
  symbol: string
  name: string
  price: number
  change: number
  changePct: number
  high52w: number | null
  low52w: number | null
  marketState: string
  sparkline: number[]
  error?: boolean
}

interface SearchResult { symbol: string; name: string; exchange: string; type: string }

// What the user holds of one ticker, summed across every holding of it
interface Position { quantity: number; invested: number; current: number; dayChange: number }

// Seeded into the old device-wide watchlist; dropped when that list is carried over
const LEGACY_DEFAULT_SYMBOLS = ['HDFCBANK.NS']

function legacyStocks(): WatchItem[] {
  try {
    const saved: string[] = JSON.parse(localStorage.getItem('sw_stocks') ?? '[]')
    return saved.filter(s => !LEGACY_DEFAULT_SYMBOLS.includes(s)).map(s => ({ key: s, name: s }))
  } catch { return [] }
}

const POPULAR = [
  { symbol: 'RELIANCE.NS', label: 'Reliance' },
  { symbol: 'TCS.NS',      label: 'TCS' },
  { symbol: 'INFY.NS',     label: 'Infosys' },
  { symbol: 'SBIN.NS',     label: 'SBI' },
  { symbol: 'ICICIBANK.NS',label: 'ICICI Bank' },
  { symbol: 'WIPRO.NS',    label: 'Wipro' },
  { symbol: 'AXISBANK.NS', label: 'Axis Bank' },
  { symbol: 'ITC.NS',      label: 'ITC' },
]

const shortName = (name: string) => name.replace(' Limited', '').replace(' Ltd', '')
const exchangeLabel = (symbol: string) => symbol.endsWith('.BO') ? 'BSE' : symbol.endsWith('.NS') ? 'NSE' : ''

export default function StockWidget() {
  const assets = useAppStore(s => s.assets)
  const stockAssets = useMemo(() => assets.filter(a => a.kind === 'stocks' && a.ticker), [assets])

  const holdings = useMemo(() => {
    const seen = new Set<string>()
    const list: WatchItem[] = []
    for (const a of stockAssets) {
      const key = a.ticker!.trim().toUpperCase()
      if (seen.has(key)) continue
      seen.add(key)
      list.push({ key, name: a.name })
    }
    return list
  }, [stockAssets])

  const { items, hiddenHoldings, add, remove, restoreHidden, isListed } = useWatchlist('stocks', holdings, legacyStocks)

  const [data, setData] = useState<StockData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [showAdd, setShowAdd] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const fetchSeq = useRef(0)

  // Prices for every holding (hidden ones still count in the totals) plus the stocks on show
  const fetchKey = useMemo(() => Array.from(new Set([...holdings, ...items].map(i => i.key))).sort().join(','), [holdings, items])

  const fetchStocks = useCallback(async () => {
    const seq = ++fetchSeq.current
    if (!fetchKey) { setData([]); setLoading(false); return }
    try {
      const res = await fetch(`/api/market/stocks?symbols=${encodeURIComponent(fetchKey)}`)
      const json = await res.json()
      if (seq !== fetchSeq.current) return
      setData(json.data ?? [])
      setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
    } catch {
      // silent
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [fetchKey])

  useEffect(() => {
    fetchStocks()
    const id = setInterval(fetchStocks, 60000)
    return () => clearInterval(id)
  }, [fetchStocks])

  // Search once typing pauses; a reply for an older query is dropped
  useEffect(() => {
    const q = searchQ.trim()
    if (q.length < 2) { setSearchResults(null); setSearching(false); return }
    let stale = false
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/market/stocks/search?q=${encodeURIComponent(q)}`)
        const json = await res.json()
        const results: SearchResult[] = (json.results ?? []).filter((r: SearchResult) => r.type === 'EQUITY' || r.type === 'ETF')
        // Indian listings first
        results.sort((a, b) => Number(!!exchangeLabel(b.symbol)) - Number(!!exchangeLabel(a.symbol)))
        if (!stale) setSearchResults(results)
      } catch {
        if (!stale) setSearchResults([])
      } finally {
        if (!stale) setSearching(false)
      }
    }, 300)
    return () => { stale = true; clearTimeout(t) }
  }, [searchQ])

  const bySymbol = useMemo(() => new Map(data.map(d => [d.symbol.toUpperCase(), d])), [data])

  // Valued the same way as Net Worth, from the prices fetched here
  const positions = useMemo(() => {
    const prices: LivePrices = { stocks: {} }
    for (const d of data) if (!d.error) prices.stocks![d.symbol.toUpperCase()] = d
    const map = new Map<string, Position>()
    for (const a of stockAssets) {
      const key = a.ticker!.trim().toUpperCase()
      const v = computeValue({ ...a, ticker: key }, prices)
      const qty = a.quantity ?? 0
      const p = map.get(key) ?? { quantity: 0, invested: 0, current: 0, dayChange: 0 }
      p.quantity += qty
      p.invested += v.gainPct !== null
        ? v.currentValue - v.gain
        : (a.investedAmount ?? (qty && a.avgBuyPrice ? qty * a.avgBuyPrice : 0))
      p.current += v.currentValue
      p.dayChange += qty * (prices.stocks![key]?.change ?? 0)
      map.set(key, p)
    }
    return map
  }, [stockAssets, data])

  const totals = useMemo(() => {
    let invested = 0, current = 0, dayChange = 0
    positions.forEach(p => { invested += p.invested; current += p.current; dayChange += p.dayChange })
    return { invested, current, dayChange }
  }, [positions])

  function addSymbol(sym: string, name?: string) {
    const s = sym.toUpperCase().trim()
    if (!s) return
    add({ key: s, name: name ?? s })
    setSearchQ('')
    setShowAdd(false)
  }

  const shown = items.map(i => bySymbol.get(i.key)).filter((d): d is StockData => !!d)
  const holdingKeys = new Set(holdings.map(h => h.key))
  const marketOpen = data.some(d => d.marketState === 'REGULAR')

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-brand-500" />
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Stocks</h3>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">NSE Live</span>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && <span className="text-xs text-slate-400">Updated {lastUpdated}</span>}
          <button onClick={fetchStocks} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
            <RefreshCw size={13} />
          </button>
          <button onClick={() => setShowAdd(v => !v)} className="btn-primary py-1 px-2.5 text-xs">
            <Plus size={13} /> Add
          </button>
        </div>
      </div>

      {/* Add stock panel */}
      {showAdd && (
        <div className="bg-slate-50 rounded-xl p-3 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-8 text-sm"
              placeholder="Search company or symbol, e.g. Tata Motors"
              value={searchQ}
              autoFocus
              onChange={e => setSearchQ(e.target.value)}
              // Enter adds the top match, or the typed text as a symbol when nothing matched
              onKeyDown={e => {
                if (e.key !== 'Enter') return
                const top = searchResults?.find(r => !isListed(r.symbol.toUpperCase()))
                if (top) addSymbol(top.symbol, top.name)
                else if (searchResults?.length === 0) addSymbol(searchQ)
              }}
            />
          </div>
          {searching && <p className="text-xs text-slate-400 text-center py-2">Searching...</p>}
          {!searching && searchResults?.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-2">
              No stocks match &ldquo;{searchQ.trim()}&rdquo;. Press Enter to add it as a symbol (e.g. TATAMOTORS.NS).
            </p>
          )}
          {!searching && searchResults?.map(r => {
            const onList = isListed(r.symbol.toUpperCase())
            const exch = exchangeLabel(r.symbol) || r.exchange
            return (
              <button
                key={r.symbol}
                onClick={() => addSymbol(r.symbol, r.name)}
                disabled={onList}
                className="w-full flex items-center gap-2 text-left text-xs p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200 disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:border-transparent"
              >
                <span className="flex-1 min-w-0">
                  <span className="font-medium text-slate-700">{shortName(r.name)}</span>
                  <span className="text-slate-400 ml-1">{r.symbol.replace(/\.(NS|BO)$/, '')}{exch && ` · ${exch}`}</span>
                </span>
                {onList && <span className="flex-shrink-0 text-[10px] text-slate-500">On list</span>}
              </button>
            )
          })}
          {searchResults === null && !searching && (
            <div className="flex flex-wrap gap-1.5">
              {POPULAR.filter(p => !isListed(p.symbol)).map(p => (
                <button
                  key={p.symbol}
                  onClick={() => addSymbol(p.symbol, p.label)}
                  className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:border-brand-400 hover:text-brand-600 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && positions.size > 0 && (
        <HoldingSummary
          title={`Your stocks · ${positions.size} ${positions.size === 1 ? 'company' : 'companies'}`}
          invested={totals.invested}
          current={totals.current}
          dayChange={totals.dayChange}
        />
      )}

      {/* Stock cards */}
      {loading && items.length > 0 ? (
        <div className="space-y-2">
          {items.map(s => <div key={s.key} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">
          No stocks on your watchlist. Add a stock holding in Net Worth, or tap Add to watch one.
        </p>
      ) : (
        <div className="space-y-2">
          {shown.map(stock => {
            const key = stock.symbol.toUpperCase()
            const pos = positions.get(key)
            const gain = pos ? pos.current - pos.invested : 0
            return (
              <div key={stock.symbol} className="bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3 p-3">
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    stock.change >= 0 ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {stock.change > 0
                      ? <TrendingUp size={16} className="text-green-600" />
                      : stock.change < 0
                      ? <TrendingDown size={16} className="text-red-500" />
                      : <Minus size={16} className="text-slate-400" />
                    }
                  </div>

                  {/* Name + symbol */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{shortName(stock.name)}</p>
                      <ListTag holding={holdingKeys.has(key)} />
                    </div>
                    <p className="text-xs text-slate-400">
                      {stock.symbol.replace(/\.(NS|BO)$/, '')}{exchangeLabel(stock.symbol) && ` · ${exchangeLabel(stock.symbol)}`}
                    </p>
                  </div>

                  {/* Sparkline */}
                  {stock.sparkline.length > 1 && (
                    <div className="w-16 h-8 hidden sm:block">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={stock.sparkline.map((v, i) => ({ v, i }))}>
                          <Line type="monotone" dataKey="v" stroke={stock.change >= 0 ? '#22c55e' : '#ef4444'} strokeWidth={1.5} dot={false} />
                          <Tooltip
                            content={({ active, payload }) =>
                              active && payload?.[0] ? (
                                <span className="text-xs bg-slate-800 text-white px-1.5 py-0.5 rounded">
                                  ₹{payload[0].value}
                                </span>
                              ) : null
                            }
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Price + change */}
                  <div className="text-right flex-shrink-0">
                    {stock.error ? (
                      <p className="text-xs text-slate-400">Price unavailable</p>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-slate-800">₹{stock.price.toLocaleString('en-IN')}</p>
                        <p className={`text-xs font-medium ${stock.change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePct >= 0 ? '+' : ''}{stock.changePct.toFixed(2)}%)
                        </p>
                      </>
                    )}
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => remove(key)}
                    aria-label={`Remove ${shortName(stock.name)} from watchlist`}
                    title="Remove from watchlist"
                    className="p-1.5 -m-0.5 hover:bg-red-100 rounded-lg text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* What the user holds of this stock */}
                {pos && (
                  <div className="mx-3 pb-3 pt-2.5 border-t border-slate-200/70 space-y-2">
                    <StatGrid stats={[
                      { label: 'Shares', value: pos.quantity > 0 ? pos.quantity.toLocaleString('en-IN') : '—' },
                      { label: 'Avg buy', value: pos.quantity > 0 && pos.invested > 0 ? rupees(pos.invested / pos.quantity, 2) : '—' },
                      { label: 'Invested', value: pos.invested > 0 ? rupees(pos.invested) : '—' },
                      { label: 'Current value', value: rupees(pos.current) },
                      {
                        label: 'P&L',
                        value: pos.invested > 0 ? <>{signedRupees(gain)} <span className="font-normal">({signedPct(gain / pos.invested * 100)})</span></> : '—',
                        change: pos.invested > 0 ? gain : undefined,
                      },
                      { label: 'Day change', value: signedRupees(pos.dayChange), change: pos.dayChange },
                    ]} />
                    {stock.high52w != null && stock.low52w != null && stock.high52w > stock.low52w && (
                      <FiftyTwoWeekRange low={stock.low52w} high={stock.high52w} price={stock.price}
                        avgBuy={pos.quantity > 0 && pos.invested > 0 ? pos.invested / pos.quantity : null} />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <HiddenHoldingsNote count={hiddenHoldings.length} onRestore={restoreHidden} />
      <p className="text-xs text-slate-400 text-center">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: marketOpen ? '#22c55e' : '#ef4444', display: 'inline-block', flexShrink: 0 }} />
          {marketOpen ? 'Market Open' : 'Market Closed'}
        </span> · Data from Yahoo Finance · Refreshes every 60s
      </p>
    </div>
  )
}

// Where today's price (and the user's average buy) sits in the 52-week range
function FiftyTwoWeekRange({ low, high, price, avgBuy }: { low: number; high: number; price: number; avgBuy: number | null }) {
  const at = (v: number) => `${Math.min(100, Math.max(0, ((v - low) / (high - low)) * 100))}%`
  return (
    <div>
      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
        <span>52W low {rupees(low)}</span>
        <span>52W high {rupees(high)}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-slate-200">
        {avgBuy !== null && (
          <span title={`Your avg buy ${rupees(avgBuy, 2)}`} className="absolute top-1/2 w-0.5 h-3 bg-slate-500 rounded"
            style={{ left: at(avgBuy), transform: 'translate(-50%, -50%)' }} />
        )}
        <span title={`Now ${rupees(price, 2)}`} className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-brand-500 ring-2 ring-white"
          style={{ left: at(price), transform: 'translate(-50%, -50%)' }} />
      </div>
      {avgBuy !== null && <p className="text-[10px] text-slate-400 mt-1">Dot: today&rsquo;s price · Line: your average buy</p>}
    </div>
  )
}
