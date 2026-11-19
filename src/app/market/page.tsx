'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { usePullToRefresh } from '@/components/layout/PullToRefresh'
import { useAppStore } from '@/store/appStore'
import { usePrivacy } from '@/store/privacyStore'
import MarketHero from '@/components/market/MarketHero'
import { IndexCard, IndexChips } from '@/components/market/Indices'
import StocksCard from '@/components/market/StocksCard'
import FundsCard from '@/components/market/FundsCard'
import GoldCard from '@/components/market/GoldCard'
import NewsCard from '@/components/market/NewsCard'
import { MASK, clock, inr, pctOf, signedInr } from '@/components/market/format'
import { PATH, Svg } from '@/components/market/ui'
import { useFunds, useGold, useIndices, useNews, useStocks } from '@/components/market/useMarketData'

export default function MarketPage() {
  const masked = usePrivacy(s => s.masked)
  const togglePrivacy = usePrivacy(s => s.toggle)
  const hydratePrivacy = usePrivacy(s => s.hydrate)
  useEffect(() => { hydratePrivacy() }, [hydratePrivacy])
  const initialized = useAppStore(s => s.initialized)

  const indices = useIndices()
  const stocks = useStocks()
  const funds = useFunds()
  const gold = useGold()
  const news = useNews()
  const [stockAddOpen, setStockAddOpen] = useState(false)

  usePullToRefresh(() => Promise.all([indices.load(), stocks.refresh(), funds.refresh(), gold.refresh(), news.refresh()]))

  // ── Header status: open or closed, and how fresh the prices are ──
  const times = [indices.updatedAt, stocks.updatedAt, funds.updatedAt, gold.updatedAt, news.updatedAt].filter((d): d is Date => !!d)
  const updated = times.length ? new Date(Math.max(...times.map(d => d.getTime()))) : null
  const offline = indices.failed || stocks.error || funds.error || gold.error || news.error
  const open = indices.marketOpen ?? stocks.marketOpen
  const status = !updated && (indices.loading || stocks.loading)
    ? { label: 'Loading', sub: 'Fetching prices…', dot: 'var(--text-4)', halo: 'var(--surface-2)' }
    : {
        label: open ? 'Market open' : 'Market closed',
        sub: offline ? `Some sources offline${updated ? ` · ${clock(updated)}` : ''}` : `Updated ${updated ? clock(updated) : ''}`,
        dot: offline ? 'var(--warn)' : open ? 'var(--good)' : 'var(--text-4)',
        halo: offline ? 'var(--warn-soft)' : open ? 'var(--good-soft)' : 'var(--surface-2)',
      }

  // ── Hero: stocks + funds + gold, valued as on the cards (gold left out while its rate is missing) ──
  const hasStocks = stocks.holdings.length > 0, hasFunds = funds.holdings.length > 0
  const goldIn = !!gold.holding
  const goldLeftOut = gold.hasAssets && !gold.loading && !gold.data
  const current = stocks.totals.current + funds.totals.current + (goldIn ? gold.holding!.current : 0)
  const invested = stocks.totals.invested + funds.totals.invested + (goldIn ? gold.holding!.invested : 0)
  const day = stocks.totals.dayChange + funds.totals.dayChange + (goldIn ? gold.holding!.dayChange : 0)
  const heroState = !initialized || (hasStocks && stocks.loading) || (hasFunds && funds.loading) || (gold.hasAssets && gold.loading)
    ? 'loading'
    : hasStocks || hasFunds || gold.hasAssets ? 'holdings' : 'empty'
  const mask = (v: string) => masked ? MASK : v
  const parts = [
    { label: 'Stocks', v: stocks.totals.current, color: 'rgba(255,255,255,.96)' },
    { label: 'Funds', v: funds.totals.current, color: 'rgba(255,255,255,.58)' },
    { label: 'Gold', v: goldIn ? gold.holding!.current : 0, color: 'oklch(0.86 0.12 85)' },
  ]

  return (
    <AppShell title="Market">
      <div className="mkt mkt-page anim-page">
        <div style={{ padding: 'var(--pad)' }}>
          <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 'var(--gap)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 'var(--h1)', fontWeight: 650, letterSpacing: '-0.03em', lineHeight: 1.1 }}>Market</h1>
              <p style={{ margin: '4px 0 0', color: 'var(--text-3)', fontSize: 14 }}>Stocks, funds, gold &amp; news</p>
            </div>
            <div className="mkt-status" style={{
              display: 'flex', alignItems: 'center', gap: 8,
              height: 34, padding: '0 12px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border)',
              fontSize: 13, color: 'var(--text-2)', boxSizing: 'border-box', width: 'fit-content', maxWidth: '100%',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: status.dot, boxShadow: `0 0 0 3px ${status.halo}`, flex: 'none' }} />
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{status.label}</span>
              <span style={{ width: 1, height: 14, background: 'var(--border)' }} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{status.sub}</span>
            </div>
            <button onClick={togglePrivacy} aria-pressed={masked} title={masked ? 'Show amounts' : 'Hide amounts'} aria-label={masked ? 'Show amounts' : 'Hide amounts'} style={{
              width: 'var(--hit)', height: 'var(--hit)', flex: 'none', borderRadius: 12, display: 'grid', placeItems: 'center',
              border: '1px solid var(--border)', background: masked ? 'var(--text)' : 'var(--surface)', color: masked ? 'var(--bg)' : 'var(--text-2)',
              cursor: 'pointer', padding: 0,
            }}>
              {masked ? <Svg d={PATH.eyeOff} size={17} /> : <Svg d={PATH.eye} size={17}><circle cx="12" cy="12" r="3" /></Svg>}
            </button>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: 'var(--cols)', gap: 'var(--gap)', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', minWidth: 0 }}>
              <MarketHero
                state={heroState}
                total={mask(inr(current))}
                boxes={[
                  { label: 'Total P&L', value: mask(signedInr(current - invested)), pct: pctOf(current - invested, invested), dir: current - invested },
                  { label: 'Today', value: mask(signedInr(day)), pct: pctOf(day, current - day), dir: day },
                ]}
                split={parts.map(p => ({ label: p.label, value: mask(inr(p.v)), share: current > 0 ? p.v / current * 100 : 0, color: p.color }))}
                masked={masked}
                goldLeftOut={goldLeftOut}
                onWatch={() => setStockAddOpen(true)}
              />
              <IndexChips indices={indices.data} loading={indices.loading} />
              <StocksCard stocks={stocks} masked={masked} addOpen={stockAddOpen} setAddOpen={setStockAddOpen} />
              <FundsCard funds={funds} masked={masked} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', minWidth: 0 }}>
              <IndexCard indices={indices.data} loading={indices.loading} />
              <GoldCard gold={gold} masked={masked} />
              <NewsCard news={news} />
            </div>
          </div>

          <footer style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '6px 18px', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
            <span>Stock prices: Yahoo Finance · every 60s</span>
            <span>NAVs: MFAPI.in (AMFI) · updated daily after 9 PM</span>
            <span>Gold: IBJA national rate · every 5 min · local prices may vary by ₹50–200/10g</span>
            <span>News: NDTV Profit, Economic Times · every 15 min</span>
          </footer>
        </div>
      </div>
    </AppShell>
  )
}
