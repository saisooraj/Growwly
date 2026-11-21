'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format, parseISO, subYears } from 'date-fns'
import { useAppStore } from '@/store/appStore'
import { computeValue, type LivePrices } from '@/lib/assetValuation'
import { goldBuys, goldPricesFrom22k, legacyGoldPurchases, priceForKarat, type GoldDayPrice } from '@/lib/gold'
import type { Asset, GoldPurchase } from '@/types'
import { useWatchlist, type WatchItem } from './useWatchlist'

// The page's data, one hook per source. The page reads them all so the hero can total the
// holdings and the header can say how fresh the prices are.

// A refresh the user asked for, so the card can say "Refreshing…"
function useManualRefresh(load: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false)
  const refresh = useCallback(async () => {
    setRefreshing(true)
    try { await load() } finally { setRefreshing(false) }
  }, [load])
  return { refreshing, refresh }
}

function usePoll(load: () => Promise<void>, ms: number | null) {
  useEffect(() => {
    load()
    if (ms === null) return
    const id = setInterval(load, ms)
    return () => clearInterval(id)
  }, [load, ms])
}

// Search once typing pauses; a reply for an older query is dropped. `search` must be stable.
export function useSearch<T>(query: string, search: (q: string) => Promise<T[]>) {
  const [results, setResults] = useState<T[] | null>(null)
  const [searching, setSearching] = useState(false)
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults(null); setSearching(false); return }
    let stale = false
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const found = await search(q)
        if (!stale) setResults(found)
      } catch {
        if (!stale) setResults([])
      } finally {
        if (!stale) setSearching(false)
      }
    }, 350)
    return () => { stale = true; clearTimeout(t) }
  }, [query, search])
  return { results, searching }
}

// ── Indices ──────────────────────────────────────────────────────────────────

export interface IndexData { symbol: string; label: string; value: number; change: number; changePct: number; error?: boolean }

const INDEX_LABELS = ['NIFTY 50', 'SENSEX', 'BANK NIFTY']

export function useIndices() {
  const [data, setData] = useState<IndexData[]>([])
  const [marketOpen, setMarketOpen] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/market/indices')
      const json = await res.json()
      if (!json.data) throw new Error('No indices')
      setData(json.data)
      setMarketOpen(json.marketOpen ?? null)
      setFailed(false)
      setUpdatedAt(new Date())
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])
  usePoll(load, 60_000)

  // Nothing loaded at all: show each index as failed rather than an empty card
  const shown: IndexData[] = data.length ? data : INDEX_LABELS.map(label => ({ symbol: label, label, value: 0, change: 0, changePct: 0, error: true }))
  return { data: shown, marketOpen, loading, failed: failed || data.some(d => d.error), updatedAt, load }
}

// ── Stocks ───────────────────────────────────────────────────────────────────

export interface StockData {
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

// What the user holds of one ticker, summed across every holding of it
export interface StockPosition { quantity: number; invested: number; current: number; dayChange: number }

// Seeded into the old device-wide watchlist; dropped when that list is carried over
const LEGACY_DEFAULT_SYMBOLS = ['HDFCBANK.NS']

function legacyStocks(): WatchItem[] {
  try {
    const saved: string[] = JSON.parse(localStorage.getItem('sw_stocks') ?? '[]')
    return saved.filter(s => !LEGACY_DEFAULT_SYMBOLS.includes(s)).map(s => ({ key: s, name: s }))
  } catch { return [] }
}

export function useStocks() {
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

  const watch = useWatchlist('stocks', holdings, legacyStocks)

  const [data, setData] = useState<StockData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  // The symbol list the last fetch answered, so a stock with no price yet isn't shown as failed
  const [fetchedKey, setFetchedKey] = useState<string | null>(null)
  const fetchSeq = useRef(0)

  // Prices for every holding (hidden ones still count in the totals) plus the stocks on show
  const fetchKey = useMemo(() => Array.from(new Set([...holdings, ...watch.items].map(i => i.key))).sort().join(','), [holdings, watch.items])

  const load = useCallback(async () => {
    const seq = ++fetchSeq.current
    if (!fetchKey) { setData([]); setError(false); setLoading(false); setFetchedKey(''); return }
    try {
      const res = await fetch(`/api/market/stocks?symbols=${encodeURIComponent(fetchKey)}`)
      const json = await res.json()
      if (seq !== fetchSeq.current) return
      if (!json.data) throw new Error('No prices')
      setData(json.data)
      setError(false)
      setUpdatedAt(new Date())
    } catch {
      if (seq === fetchSeq.current) setError(true)
    } finally {
      if (seq === fetchSeq.current) { setLoading(false); setFetchedKey(fetchKey) }
    }
  }, [fetchKey])
  usePoll(load, 60_000)
  const { refreshing, refresh } = useManualRefresh(load)

  const bySymbol = useMemo(() => new Map(data.map(d => [d.symbol.toUpperCase(), d])), [data])

  // Valued the same way as Net Worth, from the prices fetched here
  const positions = useMemo(() => {
    const prices: LivePrices = { stocks: {} }
    for (const d of data) if (!d.error) prices.stocks![d.symbol.toUpperCase()] = d
    const map = new Map<string, StockPosition>()
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

  return {
    ...watch, holdings, bySymbol, positions, totals, loading, error, updatedAt, refreshing, refresh,
    settled: fetchedKey === fetchKey,
    marketOpen: data.some(d => d.marketState === 'REGULAR'),
  }
}

// ── Mutual funds ─────────────────────────────────────────────────────────────

interface NavEntry { date: string; nav: string }
export interface FundData {
  code: number
  name: string
  nav: number
  navDate: Date | null
  change1d: number
  change1dPct: number
  change1mPct: number
  change3mPct: number
  // The last 30 NAVs, oldest first, with "16 Nov" style dates
  history: { label: string; value: number }[]
}

// What the user holds of one scheme, summed across every holding of it
export interface FundPosition { units: number; invested: number; current: number; dayChange: number; pending: number }

// Seeded into the old device-wide watchlist; dropped when that list is carried over
const LEGACY_DEFAULT_CODES = [122639, 119723]

function legacyFunds(): WatchItem[] {
  try {
    const saved: { code: number; name: string }[] = JSON.parse(localStorage.getItem('sw_mf') ?? '[]')
    return saved.filter(f => !LEGACY_DEFAULT_CODES.includes(f.code)).map(f => ({ key: String(f.code), name: f.name }))
  } catch { return [] }
}

// mfapi dates are dd-mm-yyyy
function navDate(s: string | undefined) {
  if (!s) return null
  const [d, m, y] = s.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return isNaN(date.getTime()) ? null : date
}

// `data` is newest first
function toFund(code: number, name: string, data: NavEntry[]): FundData {
  const nav0 = parseFloat(data[0].nav)
  const nav1 = parseFloat(data[1]?.nav ?? String(nav0))
  const nav30 = parseFloat(data[29]?.nav ?? String(nav0))
  const nav90 = parseFloat(data[89]?.nav ?? String(nav0))
  const pct = (from: number) => from > 0 ? (nav0 - from) / from * 100 : 0

  return {
    code,
    name: name || String(code),
    nav: nav0,
    navDate: navDate(data[0].date),
    change1d: nav0 - nav1,
    change1dPct: pct(nav1),
    change1mPct: pct(nav30),
    change3mPct: pct(nav90),
    history: data.slice(0, 30).reverse().map(d => {
      const date = navDate(d.date)
      return { label: date ? format(date, 'd MMM') : d.date, value: parseFloat(d.nav) }
    }),
  }
}

// Through our own NAV route, 20 schemes a request: mfapi leaves out the CORS header for some
// schemes, so a browser can't fetch those from it directly. A scheme with no NAVs is left out.
async function fetchFunds(codes: number[]): Promise<FundData[]> {
  const batches: number[][] = []
  for (let i = 0; i < codes.length; i += 20) batches.push(codes.slice(i, i + 20))
  const replies = await Promise.allSettled(batches.map(async batch => {
    const res = await fetch(`/api/market/mf/nav?codes=${batch.join(',')}&history=1`)
    const json = await res.json()
    return batch.flatMap(code => {
      const f = json.nav?.[String(code)]
      return f?.navs?.length ? [toFund(code, f.schemeName, f.navs)] : []
    })
  }))
  return replies.flatMap(r => r.status === 'fulfilled' ? r.value : [])
}

export function useFunds() {
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

  const watch = useWatchlist('mf', holdings, legacyFunds)

  const [data, setData] = useState<FundData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const fetchSeq = useRef(0)

  // NAVs for every holding (hidden ones still count in the totals) plus the funds on show
  const fetchKey = useMemo(() => Array.from(new Set([...holdings, ...watch.items].map(i => i.key))).sort().join(','), [holdings, watch.items])

  const load = useCallback(async () => {
    const seq = ++fetchSeq.current
    const codes = fetchKey ? fetchKey.split(',').map(Number) : []
    const valid = await fetchFunds(codes)
    // A fetch for an older list (before a fund was added or removed) must not overwrite a newer one
    if (seq !== fetchSeq.current) return
    setData(valid)
    setError(codes.length > 0 && valid.length === 0)
    if (valid.length) setUpdatedAt(new Date())
    setLoading(false)
  }, [fetchKey])
  usePoll(load, null)
  const { refreshing, refresh } = useManualRefresh(load)

  const byCode = useMemo(() => new Map(data.map(d => [d.code, d])), [data])

  // Valued the same way as Net Worth, from the NAVs fetched here
  const positions = useMemo(() => {
    const prices: LivePrices = { mf: {} }
    for (const d of data) prices.mf![String(d.code)] = { nav: d.nav, change: d.change1d, changePct: d.change1dPct, schemeName: d.name }
    const map = new Map<number, FundPosition>()
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

  // The newest NAV date across the funds on show
  const latestNav = data.reduce<Date | null>((m, d) => d.navDate && (!m || d.navDate > m) ? d.navDate : m, null)

  return { ...watch, holdings, byCode, positions, totals, loading, error, updatedAt, refreshing, refresh, latestNav }
}

// ── Gold ─────────────────────────────────────────────────────────────────────

export interface GoldData {
  price24kPerGram: number
  price22kPerGram: number
  sovereign: number
  tenGram: number
  avg30Day: number | null // null when there isn't enough history for a real 30-day average
  signal: 'buy' | 'hold' | 'wait' | null
  signalText: string | null
  history: GoldDayPrice[]
  updatedAt: string
}

export interface GoldLot extends GoldPurchase { assetName: string; dateLabel: string }
export interface GoldKarat {
  karat: 18 | 22 | 24
  grams: number
  paid: number
  avgPaid: number | null
  rate: number
  value: number
  dayChange: number
  lots: GoldLot[]
}

const KARATS = [24, 22, 18] as const

// The user's gold at today's rates: the same per-karat rates Net Worth values it at
function goldHoldings(assets: Asset[], data: GoldData) {
  const prices = goldPricesFrom22k(data.price22kPerGram)

  let invested = 0, current = 0
  for (const a of assets) {
    const v = computeValue(a, { gold: prices })
    current += v.currentValue
    invested += v.investedAmount ?? 0
  }

  // Every karat moves with the 22K rate, so the last day's 22K move scales the whole holding
  const h = data.history
  const prev = h.length >= 2 ? h[h.length - 2].price22k : 0
  const last = h.length >= 1 ? h[h.length - 1].price22k : 0
  const dayShare = prev > 0 && last > 0 ? 1 - prev / last : 0

  const lots: GoldLot[] = assets
    .flatMap(a => legacyGoldPurchases(a).map(p => {
      let dateLabel = p.date
      try { dateLabel = format(parseISO(p.date), 'd MMM yyyy') } catch {}
      return { ...p, assetName: a.name, dateLabel }
    }))
    .filter(p => p.grams > 0)
    .sort((a, b) => b.date.localeCompare(a.date))

  const byKarat: GoldKarat[] = KARATS.map(karat => {
    const ks = lots.filter(p => p.karat === karat)
    const grams = ks.reduce((s, p) => s + p.grams, 0)
    const paid = ks.reduce((s, p) => s + p.grams * p.pricePerGram, 0)
    const rate = priceForKarat(karat, prices)
    const value = grams * rate
    return { karat, grams, paid, avgPaid: grams > 0 && paid > 0 ? paid / grams : null, rate, value, dayChange: value * dayShare, lots: ks }
  }).filter(k => k.grams > 0)

  return {
    invested, current, dayChange: current * dayShare,
    grams: lots.reduce((s, p) => s + p.grams, 0),
    byKarat, prices,
  }
}

// The long gold chart: one year, or back to the first purchase if that is older. Loads the
// first time the History view is opened.
export function useGoldHistory(enabled: boolean) {
  const assets = useAppStore(s => s.assets)
  const transactions = useAppStore(s => s.transactions)
  const { buys, unplotted } = useMemo(() => goldBuys(assets, transactions), [assets, transactions])
  const from = useMemo(() => {
    const yearAgo = format(subYears(new Date(), 1), 'yyyy-MM-dd')
    return buys.length && buys[0].date < yearAgo ? buys[0].date : yearAgo
  }, [buys])

  const [history, setHistory] = useState<GoldDayPrice[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const loadedFrom = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || loadedFrom.current === from) return
    let stale = false
    setLoading(true)
    setError(false)
    fetch(`/api/market/gold?historyFrom=${from}`)
      .then(res => res.json())
      .then(json => {
        if (stale) return
        if (!Array.isArray(json.longHistory) || json.longHistory.length < 2) throw new Error('No gold history')
        loadedFrom.current = from
        setHistory(json.longHistory)
        setLoading(false)
      })
      .catch(() => {
        if (stale) return
        setError(true)
        setLoading(false)
      })
    return () => { stale = true }
  }, [enabled, from, attempt])

  return { history, loading, error, retry: () => setAttempt(a => a + 1), buys, unplotted }
}

export function useGold() {
  const assets = useAppStore(s => s.assets)
  const goldAssets = useMemo(() => assets.filter(a => a.kind === 'gold_grams'), [assets])

  const [data, setData] = useState<GoldData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/market/gold')
      const json = await res.json()
      if (!res.ok || json.error || !json.price22kPerGram) throw new Error('No gold rate')
      setData(json)
      setError(false)
      setUpdatedAt(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])
  usePoll(load, 5 * 60 * 1000)
  const { refreshing, refresh } = useManualRefresh(load)

  const holding = useMemo(() => data && goldAssets.length ? goldHoldings(goldAssets, data) : null, [goldAssets, data])

  return { data, loading, error, updatedAt, refreshing, refresh, holding, hasAssets: goldAssets.length > 0 }
}

// ── News ─────────────────────────────────────────────────────────────────────

export interface Article { title: string; link: string; pubDate: string; source: string; description: string }

export function useNews() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/market/news')
      const json = await res.json()
      const list: Article[] = json.articles ?? []
      if (!list.length) throw new Error('No news')
      setArticles(list)
      setError(false)
      setUpdatedAt(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])
  usePoll(load, 15 * 60 * 1000)
  const { refreshing, refresh } = useManualRefresh(load)

  return { articles, loading, error, updatedAt, refreshing, refresh }
}
