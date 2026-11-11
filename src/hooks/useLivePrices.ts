'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Asset } from '@/types'
import type { LivePrices } from '@/lib/assetValuation'

const uniq = (xs: (string | undefined)[]) => Array.from(new Set(xs.filter((x): x is string => !!x))).sort().join(',')

// Prices are kept for a few minutes across page visits, so coming back to a page shows the
// numbers straight away instead of re-valuing everything. Pull-to-refresh skips this.
const CACHE_MS = 5 * 60_000
const TIMEOUT_MS = 10_000
const cache = new Map<string, { at: number; prices: LivePrices }>()

interface Instruments { hasGold: boolean; tickers: string; mfCodes: string; npsCodes: string; since?: string }

async function fetchPrices({ hasGold, tickers, mfCodes, npsCodes, since }: Instruments): Promise<LivePrices> {
  // A slow source gives up after TIMEOUT_MS: its holdings fall back to their saved values
  const get = (url: string) => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    return fetch(url, { cache: 'no-store', signal: ctrl.signal })
      .then(r => r.json())
      .catch(() => null)
      .finally(() => clearTimeout(timer))
  }
  const q = since ? `since=${since}` : ''

  const [gold, stocks, mf, nps] = await Promise.all([
    hasGold ? get(`/api/market/gold${q ? `?${q}` : ''}`) : null,
    tickers ? get(`/api/market/stocks?symbols=${encodeURIComponent(tickers)}${q ? `&${q}` : ''}`) : null,
    mfCodes ? get(`/api/market/mf/nav?codes=${encodeURIComponent(mfCodes)}${q ? `&${q}` : ''}`) : null,
    npsCodes ? get(`/api/market/nps?codes=${encodeURIComponent(npsCodes)}${q ? `&${q}` : ''}`) : null,
  ])
  const next: LivePrices = {}
  if (gold?.price22kPerGram) {
    next.gold = {
      price22k: gold.price22kPerGram,
      price24k: parseFloat((gold.price22kPerGram * 24 / 22).toFixed(2)),
      price18k: parseFloat((gold.price22kPerGram * 18 / 22).toFixed(2)),
    }
  }
  if (stocks?.data) {
    const map: NonNullable<LivePrices['stocks']> = {}
    for (const s of stocks.data) map[s.symbol] = s
    next.stocks = map
  }
  if (mf?.nav) next.mf = mf.nav
  if (nps?.nav) next.nps = nps.nav
  if (since) {
    const start: NonNullable<LivePrices['start']> = { since }
    if (gold?.start22kPerGram > 0) {
      const p22 = gold.start22kPerGram
      start.gold = { price22k: p22, price24k: p22 * 24 / 22, price18k: p22 * 18 / 22 }
    }
    const pick = (rows: { key: string; v?: number | null }[]) =>
      Object.fromEntries(rows.filter(r => (r.v ?? 0) > 0).map(r => [r.key, r.v as number]))
    if (stocks?.data) start.stocks = pick(stocks.data.map((s: { symbol: string; startPrice?: number | null }) => ({ key: s.symbol, v: s.startPrice })))
    if (mf?.nav) start.mf = pick(Object.entries(mf.nav as Record<string, { startNav?: number | null }>).map(([key, n]) => ({ key, v: n.startNav })))
    if (nps?.nav) start.nps = pick(Object.entries(nps.nav as Record<string, { startNav?: number | null }>).map(([key, n]) => ({ key, v: n.startNav })))
    next.start = start
  }
  return next
}

/**
 * Live market prices for whatever the user holds, plus whether they have arrived for the
 * current set of holdings (`loaded`) and a `refresh` that fetches them again, skipping the
 * cache. Pass `since` (an ISO day) to also get each price as it stood just before that day.
 */
export function useLivePricesState(assets: Asset[], since?: string): {
  prices: LivePrices
  loaded: boolean
  refresh: () => Promise<void>
} {
  const hasGold = assets.some(a => a.kind === 'gold_grams')
  const tickers = uniq(assets.filter(a => a.kind === 'stocks').map(a => a.ticker))
  const mfCodes = uniq(assets.filter(a => a.kind === 'mutual_fund').map(a => a.schemeCode))
  const npsCodes = uniq(assets.filter(a => a.kind === 'nps').flatMap(a => (a.npsHoldings ?? []).map(h => h.schemeCode)))
  const key = [hasGold ? 'gold' : '', tickers, mfCodes, npsCodes, since ?? ''].join('|')

  const cached = () => {
    const c = cache.get(key)
    return c && Date.now() - c.at < CACHE_MS ? c.prices : null
  }
  // Prices from the last fetch stay on screen while a new set is fetched
  const [state, setState] = useState<{ key: string; prices: LivePrices } | null>(() => {
    const c = cached()
    return c ? { key, prices: c } : null
  })
  const [nonce, setNonce] = useState(0)
  const forceRef = useRef(false)
  const waiting = useRef<(() => void)[]>([])
  const settle = () => { waiting.current.splice(0).forEach(done => done()) }

  useEffect(() => {
    let cancelled = false
    const force = forceRef.current
    forceRef.current = false
    const c = force ? null : cached()
    if (c) {
      setState(s => (s?.key === key && s.prices === c ? s : { key, prices: c }))
      settle()
      return
    }
    fetchPrices({ hasGold, tickers, mfCodes, npsCodes, since }).then(prices => {
      if (cancelled) return
      cache.set(key, { at: Date.now(), prices })
      setState({ key, prices })
      settle()
    })
    return () => { cancelled = true }
  }, [key, nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  // Never leave a refresh hanging when the page goes away mid-fetch
  useEffect(() => settle, [])

  const refresh = useCallback(() => new Promise<void>(resolve => {
    waiting.current.push(resolve)
    forceRef.current = true
    setNonce(n => n + 1)
  }), [])

  return { prices: state?.prices ?? EMPTY, loaded: state?.key === key, refresh }
}

const EMPTY: LivePrices = {}

// Live market prices for whatever the user holds. Re-fetches when the set of instruments changes.
// Pass `since` (an ISO day) to also get each price as it stood just before that day, in `start`.
export function useLivePrices(assets: Asset[], since?: string): LivePrices {
  return useLivePricesState(assets, since).prices
}
