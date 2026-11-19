'use client'

import { useState, type KeyboardEvent } from 'react'
import { ARROW, MASK, TONE, dirOf, inr, pctOf, signedInr, signedPct } from './format'
import {
  AddPanel, AssetRow, CardHeader, CardState, HiddenNote, PATH, PnlCell, PriceCell, RemoveFooter, ResultRow, RowDetail,
  SkeletonRows, Spark, StatGrid, SubLine, SummaryBox, Tag, cardStyle, holdingStats, noneText, resultList,
} from './ui'
import { useSearch, type StockData, type StockPosition, type useStocks } from './useMarketData'
import type { WatchItem } from './useWatchlist'

const POPULAR = [
  { symbol: 'RELIANCE.NS',  label: 'Reliance' },
  { symbol: 'TCS.NS',       label: 'TCS' },
  { symbol: 'INFY.NS',      label: 'Infosys' },
  { symbol: 'SBIN.NS',      label: 'SBI' },
  { symbol: 'ICICIBANK.NS', label: 'ICICI Bank' },
  { symbol: 'WIPRO.NS',     label: 'Wipro' },
  { symbol: 'AXISBANK.NS',  label: 'Axis Bank' },
  { symbol: 'ITC.NS',       label: 'ITC' },
]

const shortName = (name: string) => name.replace(/\s+(Limited|Ltd\.?)$/i, '')
const exchangeLabel = (symbol: string) => symbol.endsWith('.BO') ? 'BSE' : symbol.endsWith('.NS') ? 'NSE' : ''
const bare = (symbol: string) => symbol.replace(/\.(NS|BO)$/, '')

interface SearchResult { symbol: string; name: string; exchange: string; type: string }

async function searchStocks(q: string): Promise<SearchResult[]> {
  const res = await fetch(`/api/market/stocks/search?q=${encodeURIComponent(q)}`)
  const json = await res.json()
  const results: SearchResult[] = (json.results ?? []).filter((r: SearchResult) => r.type === 'EQUITY' || r.type === 'ETF')
  // Indian listings first
  results.sort((a, b) => Number(!!exchangeLabel(b.symbol)) - Number(!!exchangeLabel(a.symbol)))
  return results.slice(0, 6)
}

export default function StocksCard({ stocks: s, masked, addOpen, setAddOpen }: {
  stocks: ReturnType<typeof useStocks>
  masked: boolean
  addOpen: boolean
  setAddOpen: (open: boolean) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const { results, searching } = useSearch(query, searchStocks)
  const mask = (v: string) => masked ? MASK : v

  function closeAdd() { setAddOpen(false); setQuery('') }
  function add(symbol: string, name: string) {
    s.add({ key: symbol.toUpperCase(), name })
    closeAdd()
  }

  const q = query.trim()
  const top = results?.find(r => !s.isListed(r.symbol.toUpperCase()))
  const raw = q.toUpperCase().replace(/\s+/g, '')
  const rawSymbol = /\.[A-Z]+$/.test(raw) ? raw : `${raw}.NS`

  // Enter adds the top match, or the typed text as a symbol when nothing matched
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') closeAdd()
    if (e.key !== 'Enter' || !q) return
    if (top) add(top.symbol, shortName(top.name))
    else if (results?.length === 0) add(rawSymbol, rawSymbol)
  }

  const holdingKeys = new Set(s.holdings.map(h => h.key))
  // A stock with no reply yet is left out until its first fetch answers
  const rows = s.items.flatMap(item => {
    const d = s.bySymbol.get(item.key)
    if (!d && !s.settled) return []
    return [{ item, data: d && !d.error ? d : null }]
  })
  const n = s.positions.size

  return (
    <section style={cardStyle}>
      <CardHeader
        title="Stocks" tag={{ label: 'NSE Live', bg: 'var(--good-soft)', ink: 'var(--good-ink)' }}
        cadence="every 60s" refreshing={s.refreshing} onRefresh={s.refresh}
        add={{ open: addOpen, toggle: () => addOpen ? closeAdd() : setAddOpen(true) }}
      />

      {addOpen && (
        <AddPanel
          title="Add a stock" query={query} onQuery={setQuery} onKeyDown={onKey}
          placeholder="Search company or symbol, e.g. Tata Motors" searching={searching} onClose={closeAdd}
          hint={q ? 'Enter adds the top match · Indian listings first' : 'Type a name or NSE symbol (e.g. TATAMOTORS.NS)'}
        >
          {!q && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)', margin: '14px 2px 8px' }}>Popular</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {POPULAR.map(p => {
                  const on = s.isListed(p.symbol)
                  return (
                    <button key={p.symbol} onClick={() => { if (!on) add(p.symbol, p.label) }} style={{
                      height: 34, padding: '0 13px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface)',
                      color: on ? 'var(--text-4)' : 'var(--text)', fontSize: 13, fontWeight: 500, cursor: on ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {p.label}
                      {on && <span style={{ fontSize: 11, color: 'var(--text-4)' }}>On list</span>}
                    </button>
                  )
                })}
              </div>
            </>
          )}
          {q && !!results?.length && (
            <div style={resultList}>
              {results.map(r => (
                <ResultRow
                  key={r.symbol} title={shortName(r.name)} meta={bare(r.symbol)} badge={exchangeLabel(r.symbol) || r.exchange}
                  onList={s.isListed(r.symbol.toUpperCase())} isTop={r === top} onAdd={() => add(r.symbol, shortName(r.name))}
                />
              ))}
            </div>
          )}
          {q && !searching && results?.length === 0 && (
            <div style={noneText}>No listing matches &ldquo;{q}&rdquo;. Press Enter to add {rawSymbol} as a symbol.</div>
          )}
        </AddPanel>
      )}

      {s.loading && s.items.length > 0 && <SkeletonRows count={Math.min(s.items.length, 4)} nameW="38%" subW="22%" />}

      {!s.loading && n > 0 && (
        <SummaryBox
          title={`Your stocks · ${n} ${n === 1 ? 'company' : 'companies'}`}
          value={mask(inr(s.totals.current))}
          pct={s.totals.invested > 0 ? pctOf(s.totals.current - s.totals.invested, s.totals.invested) : null}
          stats={holdingStats(s.totals.invested, s.totals.current, s.totals.dayChange, mask)}
          margin="0 var(--cx) 14px"
        />
      )}

      {!s.loading && s.items.length === 0 && s.hiddenHoldings.length === 0 && (
        <CardState icon={PATH.trend} bg="var(--brand-soft)" ink="var(--brand-ink)"
          title="No stocks on your watchlist" text="Add a stock holding in Net Worth, or tap Add to watch one." />
      )}

      {!s.loading && rows.map(({ item, data }) => (
        <StockRow
          key={item.key} item={item} data={data} holding={holdingKeys.has(item.key)} pos={s.positions.get(item.key)}
          masked={masked} expanded={expanded === item.key}
          onToggle={() => setExpanded(e => e === item.key ? null : item.key)}
          onRemove={() => { s.remove(item.key); setExpanded(null) }}
        />
      ))}

      {!s.loading && <HiddenNote count={s.hiddenHoldings.length} onRestore={s.restoreHidden} icon />}
      <div style={{ height: 6 }} />
    </section>
  )
}

function StockRow({ item, data: d, holding, pos, masked, expanded, onToggle, onRemove }: {
  item: WatchItem
  data: StockData | null
  holding: boolean
  pos: StockPosition | undefined
  masked: boolean
  expanded: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  const mask = (v: string) => masked ? MASK : v
  const key = item.key
  const dir = dirOf(d?.changePct ?? 0), t = TONE[dir]
  const qty = pos?.quantity ?? 0, invested = pos?.invested ?? 0, current = pos?.current ?? 0
  const gain = current - invested, gainPct = pctOf(gain, invested), pt = TONE[dirOf(gain)]
  const hasPnl = holding && invested > 0
  const avgBuy = qty > 0 && invested > 0 ? invested / qty : null
  const ex = exchangeLabel(key)
  const symLine = `${bare(key)}${ex ? ` · ${ex}` : ''}`
  const shares = masked ? '••' : qty.toLocaleString('en-IN')

  return (
    <AssetRow
      badge={d ? { bg: t.soft, ink: t.ink, path: ARROW[dir] } : { bg: 'var(--warn-soft)', ink: 'var(--warn-ink)', path: PATH.warn }}
      name={shortName(d?.name ?? item.name)}
      tag={<Tag holding={holding} />}
      sub={<SubLine>{symLine}{holding && qty > 0 ? ` · ${shares} shares` : ''}</SubLine>}
      subPhone={hasPnl
        ? <SubLine ink={pt.ink}>P&amp;L {mask(signedInr(gain))} · {signedPct(gainPct)}</SubLine>
        : <SubLine>{symLine}</SubLine>}
      spark={d ? <Spark values={d.sparkline} color={t.line} format={v => inr(v, true)} /> : null}
      price={d
        ? <PriceCell price={inr(d.price, true)} move={`${signedInr(d.change, true)} · ${signedPct(d.changePct)}`} movePhone={signedPct(d.changePct)} ink={t.ink} />
        : <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--warn-ink)', whiteSpace: 'nowrap' }}>Price unavailable</div>}
      pnl={hasPnl
        ? <PnlCell value={mask(signedInr(gain))} sub={signedPct(gainPct)} ink={pt.ink} />
        : <PnlCell value="—" sub={holding ? '' : 'Watching'} ink="var(--text-4)" />}
      expanded={expanded}
      onToggle={onToggle}
    >
      <RowDetail>
        {holding && pos && (
          <StatGrid stats={[
            { label: 'Shares', value: qty > 0 ? shares : '—' },
            { label: 'Avg buy', value: avgBuy ? mask(inr(avgBuy, true)) : '—' },
            { label: 'Invested', value: invested > 0 ? mask(inr(invested)) : '—' },
            { label: 'Current value', value: mask(inr(current)) },
            { label: 'P&L', value: hasPnl ? `${mask(signedInr(gain))} · ${signedPct(gainPct)}` : '—', ink: hasPnl ? pt.ink : undefined },
            { label: 'Day change', value: `${mask(signedInr(pos.dayChange))} · ${signedPct(d?.changePct ?? 0)}`, ink: t.ink },
          ]} />
        )}
        {d && d.high52w != null && d.low52w != null && d.high52w > d.low52w && (
          <Range52 low={d.low52w} high={d.high52w} price={d.price} avgBuy={hasPnl ? avgBuy : null}
            dotColor={t.line} segColor={pt.line} masked={masked} />
        )}
        {!d && (
          <div style={{ fontSize: 13, color: 'var(--text-2)', textWrap: 'pretty' }}>
            Yahoo Finance didn&rsquo;t return a price for {key}. We&rsquo;ll try again on the next refresh.
          </div>
        )}
        <RemoveFooter holding={holding} onRemove={onRemove} />
      </RowDetail>
    </AssetRow>
  )
}

// Where today's price sits in the 52-week range, and the user's average buy when they hold it.
// The stretch between the two is tinted by whether they're up or down.
function Range52({ low, high, price, avgBuy, dotColor, segColor, masked }: {
  low: number
  high: number
  price: number
  avgBuy: number | null
  dotColor: string
  segColor: string
  masked: boolean
}) {
  const at = (v: number) => Math.max(0, Math.min(100, (v - low) / (high - low) * 100))
  const today = at(price), avg = avgBuy !== null ? at(avgBuy) : today
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 12, color: 'var(--text-3)' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-2)', letterSpacing: '.04em' }}>52-WEEK RANGE</span>
      </div>
      <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'var(--surface-3)', margin: '14px 0 10px' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.min(today, avg)}%`, width: `${Math.abs(today - avg)}%`, background: avgBuy !== null ? segColor : 'transparent', borderRadius: 3, opacity: 0.55 }} />
        {avgBuy !== null && <div style={{ position: 'absolute', top: -5, width: 2, height: 16, left: `${avg}%`, background: 'var(--text)', transform: 'translateX(-1px)', borderRadius: 1 }} />}
        <div style={{ position: 'absolute', top: '50%', left: `${today}%`, width: 14, height: 14, borderRadius: '50%', background: 'var(--surface)', border: `3.5px solid ${dotColor}`, transform: 'translate(-50%,-50%)', boxSizing: 'border-box', boxShadow: '0 1px 3px rgba(0,0,0,.18)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
        <span>Low {inr(low, true)}</span><span>High {inr(high, true)}</span>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, fontSize: 12.5, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', border: `3px solid ${dotColor}`, boxSizing: 'border-box' }} />Today {inr(price, true)}
        </span>
        {avgBuy !== null && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 2, height: 12, background: 'var(--text)', borderRadius: 1 }} />Your avg buy {masked ? MASK : inr(avgBuy, true)}
          </span>
        )}
      </div>
    </div>
  )
}
