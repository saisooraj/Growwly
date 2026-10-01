'use client'

import { useEffect, useState } from 'react'
import type { Asset } from '@/types'
import type { LivePrices } from '@/lib/assetValuation'

const uniq = (xs: (string | undefined)[]) => Array.from(new Set(xs.filter((x): x is string => !!x))).sort().join(',')

// Live market prices for whatever the user holds. Re-fetches when the set of instruments changes.
export function useLivePrices(assets: Asset[]): LivePrices {
  const [prices, setPrices] = useState<LivePrices>({})

  const hasGold = assets.some(a => a.kind === 'gold_grams')
  const tickers = uniq(assets.filter(a => a.kind === 'stocks').map(a => a.ticker))
  const mfCodes = uniq(assets.filter(a => a.kind === 'mutual_fund').map(a => a.schemeCode))
  const npsCodes = uniq(assets.filter(a => a.kind === 'nps').flatMap(a => (a.npsHoldings ?? []).map(h => h.schemeCode)))

  useEffect(() => {
    let cancelled = false
    const get = (url: string) => fetch(url).then(r => r.json()).catch(() => null)

    Promise.all([
      hasGold ? get('/api/market/gold') : null,
      tickers ? get(`/api/market/stocks?symbols=${encodeURIComponent(tickers)}`) : null,
      mfCodes ? get(`/api/market/mf/nav?codes=${encodeURIComponent(mfCodes)}`) : null,
      npsCodes ? get(`/api/market/nps?codes=${encodeURIComponent(npsCodes)}`) : null,
    ]).then(([gold, stocks, mf, nps]) => {
      if (cancelled) return
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
      setPrices(next)
    })

    return () => { cancelled = true }
  }, [hasGold, tickers, mfCodes, npsCodes])

  return prices
}
