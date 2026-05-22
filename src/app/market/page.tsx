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
      <div className="space-y-5">

        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-500">Live market data — stocks, mutual funds, gold & news.</p>
          <span className="text-xs bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full font-medium">Live</span>
        </div>

        {/* Top row: Stocks + Gold */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <StockWidget />
          <GoldWidget />
        </div>

        {/* Middle: Mutual Funds */}
        <MutualFundWidget />

        {/* Bottom: News */}
        <NewsWidget />

      </div>
    </AppShell>
  )
}
