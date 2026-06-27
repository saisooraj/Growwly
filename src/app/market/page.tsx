'use client'

export const dynamic = 'force-dynamic'

import AppShell from '@/components/layout/AppShell'
import StockWidget from '@/components/market/StockWidget'
import MutualFundWidget from '@/components/market/MutualFundWidget'
import GoldWidget from '@/components/market/GoldWidget'
import NewsWidget from '@/components/market/NewsWidget'

export default function MarketPage() {
  return (
    <AppShell title="Market Watch">
      <div className="anim-page" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Live market data — stocks, mutual funds, gold & news.</p>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
            background: 'var(--good-soft)', color: 'var(--good-ink)',
          }}>Live</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--row-gap)' }}>
          <StockWidget />
          <GoldWidget />
        </div>

        <MutualFundWidget />
        <NewsWidget />

      </div>
    </AppShell>
  )
}
