'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, TrendingUp, TrendingDown, RefreshCw, Minus } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrencyFull } from '@/lib/utils'

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

const DEFAULT_SYMBOLS = ['HDFCBANK.NS']

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

export default function StockWidget() {
  const [symbols, setSymbols] = useState<string[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_SYMBOLS
    const saved = localStorage.getItem('sw_stocks')
    return saved ? JSON.parse(saved) : DEFAULT_SYMBOLS
  })
  const [data, setData] = useState<StockData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [addInput, setAddInput] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const fetchStocks = useCallback(async () => {
    if (!symbols.length) return
    try {
      const res = await fetch(`/api/market/stocks?symbols=${symbols.join(',')}`)
      const json = await res.json()
      setData(json.data ?? [])
      setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [symbols])

  useEffect(() => {
    fetchStocks()
    const id = setInterval(fetchStocks, 60000)
    return () => clearInterval(id)
  }, [fetchStocks])

  function addSymbol(sym: string) {
    const s = sym.toUpperCase().trim()
    if (!s || symbols.includes(s)) return
    const next = [...symbols, s]
    setSymbols(next)
    localStorage.setItem('sw_stocks', JSON.stringify(next))
    setAddInput('')
    setShowAdd(false)
  }

  function removeSymbol(sym: string) {
    const next = symbols.filter(s => s !== sym)
    setSymbols(next)
    localStorage.setItem('sw_stocks', JSON.stringify(next))
    setData(d => d.filter(s => s.symbol !== sym))
  }

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
          <div className="flex gap-2">
            <input
              className="input text-sm flex-1"
              placeholder="NSE symbol e.g. RELIANCE.NS"
              value={addInput}
              onChange={e => setAddInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSymbol(addInput)}
            />
            <button onClick={() => addSymbol(addInput)} className="btn-primary px-3">Add</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR.filter(p => !symbols.includes(p.symbol)).map(p => (
              <button
                key={p.symbol}
                onClick={() => addSymbol(p.symbol)}
                className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:border-brand-400 hover:text-brand-600 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stock cards */}
      {loading ? (
        <div className="space-y-2">
          {symbols.map(s => <div key={s} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {data.map(stock => (
            <div key={stock.symbol} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl group">
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
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {stock.name.replace(' Limited', '').replace(' Ltd', '')}
                </p>
                <p className="text-xs text-slate-400">{stock.symbol.replace('.NS', '')} · NSE</p>
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
                <p className="text-sm font-bold text-slate-800">₹{stock.price.toLocaleString('en-IN')}</p>
                <p className={`text-xs font-medium ${stock.change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePct >= 0 ? '+' : ''}{stock.changePct.toFixed(2)}%)
                </p>
              </div>

              {/* Remove */}
              {symbols.length > 1 && (
                <button
                  onClick={() => removeSymbol(stock.symbol)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded-lg text-slate-300 hover:text-red-500 transition-all"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: data[0]?.marketState === 'REGULAR' ? '#22c55e' : '#ef4444', display: 'inline-block', flexShrink: 0 }} />
          {data[0]?.marketState === 'REGULAR' ? 'Market Open' : 'Market Closed'}
        </span> · Data from Yahoo Finance · Refreshes every 60s
      </p>
    </div>
  )
}
