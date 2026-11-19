'use client'

import { useState, type KeyboardEvent } from 'react'
import { format } from 'date-fns'
import { ARROW, MASK, TONE, dirOf, inr, pctOf, signedInr, signedPct } from './format'
import {
  AddPanel, AreaChart, AssetRow, CardHeader, CardState, ChartTitle, HiddenNote, PATH, PnlCell, PriceCell, RemoveFooter,
  ResultRow, RowDetail, SkeletonRows, Spark, StatGrid, SubLine, SummaryBox, Svg, Tag, cardStyle, change30, holdingStats,
  noneText, resultList,
} from './ui'
import { useSearch, type FundData, type FundPosition, type useFunds } from './useMarketData'

interface SearchResult { schemeCode: string; schemeName: string }

async function searchFunds(q: string): Promise<SearchResult[]> {
  const res = await fetch(`/api/market/mf/search?q=${encodeURIComponent(q)}`)
  const json = await res.json()
  return (json.results ?? []).slice(0, 6)
}

// "Parag Parikh Flexi Cap Fund - Direct Plan - Growth" → "Parag Parikh Flexi Cap Fund"
const shortFund = (name: string) => name.split(/\s+[-–]\s*|\s*[-–]\s+/)[0] || name

export default function FundsCard({ funds: f, masked }: { funds: ReturnType<typeof useFunds>; masked: boolean }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { results, searching } = useSearch(query, searchFunds)
  const mask = (v: string) => masked ? MASK : v

  function closeAdd() { setAddOpen(false); setQuery('') }
  function add(code: string, name: string) {
    f.add({ key: String(Number(code)), name })
    closeAdd()
  }

  const q = query.trim()
  const top = results?.find(r => !f.isListed(String(Number(r.schemeCode))))
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') closeAdd()
    if (e.key === 'Enter' && top) add(top.schemeCode, top.schemeName)
  }

  const holdingCodes = new Set(f.holdings.map(h => Number(h.key)))
  const shown = f.items.map(i => f.byCode.get(Number(i.key))).filter((d): d is FundData => !!d)
  const n = f.positions.size
  const ready = !f.loading && !f.error

  return (
    <section style={cardStyle}>
      <CardHeader
        title="Mutual funds" tag={{ label: 'NAV Daily', bg: 'var(--info-soft)', ink: 'var(--info-ink)' }}
        cadence={f.latestNav ? `NAV of ${format(f.latestNav, 'd MMM')}` : 'updated daily'}
        refreshing={f.refreshing} onRefresh={f.refresh}
        add={{ open: addOpen, toggle: () => addOpen ? closeAdd() : setAddOpen(true) }}
      />

      {addOpen && (
        <AddPanel
          title="Add a fund" query={query} onQuery={setQuery} onKeyDown={onKey}
          placeholder="Search fund name, e.g. Parag Parikh Flexi" searching={searching} onClose={closeAdd}
          hint={q ? 'Enter adds the top match' : 'Search any AMFI scheme by name or scheme code'}
        >
          {q && !!results?.length && (
            <div style={resultList}>
              {results.map(r => (
                <ResultRow
                  key={r.schemeCode} title={r.schemeName} meta={`#${r.schemeCode}`}
                  onList={f.isListed(String(Number(r.schemeCode)))} isTop={r === top} onAdd={() => add(r.schemeCode, r.schemeName)}
                />
              ))}
            </div>
          )}
          {q && !searching && results?.length === 0 && (
            <div style={noneText}>No funds match &ldquo;{q}&rdquo;. Try fewer or different words.</div>
          )}
        </AddPanel>
      )}

      {f.loading && f.items.length > 0 && <SkeletonRows count={Math.min(f.items.length, 3)} nameW="58%" subW="34%" />}

      {!f.loading && f.error && (
        <CardState icon={PATH.offline} bg="var(--bad-soft)" ink="var(--bad-ink)" title="NAVs unavailable"
          text="Couldn't reach MFAPI.in — check your connection. Your fund totals use the last known NAV." onRetry={f.refresh} />
      )}

      {ready && n > 0 && (
        <SummaryBox
          title={`Your mutual funds · ${n} ${n === 1 ? 'fund' : 'funds'}`}
          value={mask(inr(f.totals.current))}
          pct={f.totals.invested > 0 ? pctOf(f.totals.current - f.totals.invested, f.totals.invested) : null}
          stats={holdingStats(f.totals.invested, f.totals.current, f.totals.dayChange, mask)}
          margin="0 var(--cx) 14px"
        >
          {f.totals.pending > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: 12.5, color: 'var(--info-ink)', background: 'var(--info-soft)', padding: '8px 10px', borderRadius: 10 }}>
              <Svg size={14} sw={2.2} style={{ flex: 'none' }}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></Svg>
              {mask(inr(f.totals.pending))} is waiting on units and is counted at cost.
            </div>
          )}
        </SummaryBox>
      )}

      {ready && f.items.length === 0 && f.hiddenHoldings.length === 0 && (
        <CardState icon={PATH.chart} bg="var(--info-soft)" ink="var(--info-ink)"
          title="No funds on your watchlist" text="Add a fund holding in Net Worth, or tap Add to watch one." />
      )}

      {ready && shown.map(fund => (
        <FundRow
          key={fund.code} fund={fund} holding={holdingCodes.has(fund.code)} pos={f.positions.get(fund.code)} masked={masked}
          expanded={expanded === fund.code}
          onToggle={() => setExpanded(e => e === fund.code ? null : fund.code)}
          onRemove={() => { f.remove(String(fund.code)); setExpanded(null) }}
        />
      ))}

      {ready && <HiddenNote count={f.hiddenHoldings.length} onRestore={f.restoreHidden} />}
      <div style={{ height: 6 }} />
    </section>
  )
}

function FundRow({ fund, holding, pos, masked, expanded, onToggle, onRemove }: {
  fund: FundData
  holding: boolean
  pos: FundPosition | undefined
  masked: boolean
  expanded: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  const mask = (v: string) => masked ? MASK : v
  const dir = dirOf(fund.change1dPct), t = TONE[dir]
  const navs = fund.history.map(h => h.value)
  const month = change30(navs), mt = TONE[dirOf(month)]
  const units = pos?.units ?? 0, invested = pos?.invested ?? 0, current = pos?.current ?? 0, pending = pos?.pending ?? 0
  const gain = current - invested, gainPct = pctOf(gain, invested), pt = TONE[dirOf(gain)]
  const hasPnl = holding && invested > 0
  const rets = [
    { label: '1D', value: fund.change1dPct },
    { label: '1M', value: fund.change1mPct },
    { label: '3M', value: fund.change3mPct },
  ]
  const pnlLine = <SubLine ink={pt.ink}>P&amp;L {mask(signedInr(gain))} · {signedPct(gainPct)}</SubLine>
  const retsLine = (
    <div style={{ display: 'flex', gap: 10, fontSize: 12.5, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', fontVariantNumeric: 'tabular-nums' }}>
      {rets.map(r => (
        <span key={r.label} style={{ color: 'var(--text-3)' }}>
          {r.label} <span style={{ color: TONE[dirOf(r.value)].ink, fontWeight: 500 }}>{signedPct(r.value)}</span>
        </span>
      ))}
    </div>
  )

  return (
    <AssetRow
      badge={{ bg: t.soft, ink: t.ink, path: ARROW[dir] }}
      name={shortFund(fund.name)}
      tag={<Tag holding={holding} />}
      // A held fund's line under the name becomes its P&L on a phone; the returns move into the detail
      sub={retsLine}
      subPhone={hasPnl ? pnlLine : retsLine}
      spark={<Spark values={navs.slice(-10)} color={mt.line} format={v => inr(v, true)} />}
      price={<PriceCell price={inr(fund.nav, true)} move={`${signedInr(fund.change1d, true)} · ${signedPct(fund.change1dPct)}`} movePhone={signedPct(fund.change1dPct)} ink={t.ink} />}
      pnl={hasPnl
        ? <PnlCell value={mask(signedInr(gain))} sub={signedPct(gainPct)} ink={pt.ink} />
        : <PnlCell value="—" sub={holding ? '' : 'Watching'} ink="var(--text-4)" />}
      expanded={expanded}
      onToggle={onToggle}
    >
      <RowDetail>
        <div style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{fund.name}</span>
          <span style={{ fontFamily: "'Geist Mono', monospace", color: 'var(--text-3)' }}>#{fund.code}</span>
        </div>
        {navs.length > 1 && (
          <div>
            <div style={{ marginBottom: 12 }}><ChartTitle label="30-DAY NAV" change={month} /></div>
            <AreaChart
              values={navs} dates={fund.history.map(h => h.label)} color={mt.line} height={150} gutter={46}
              formatY={v => `₹${v.toFixed(v < 100 ? 1 : 0)}`} formatValue={v => `NAV ${inr(v, true)}`}
            />
          </div>
        )}
        {holding && pos && (
          <StatGrid stats={[
            { label: 'Units', value: units > 0 ? (masked ? '••' : units.toLocaleString('en-IN', { maximumFractionDigits: 3 })) : '—' },
            { label: 'Avg NAV', value: units > 0 && invested > 0 ? mask(inr((invested - pending) / units, true)) : '—' },
            { label: 'Invested', value: invested > 0 ? mask(inr(invested)) : '—' },
            { label: 'Current value', value: mask(inr(current)) },
            { label: 'P&L', value: hasPnl ? `${mask(signedInr(gain))} · ${signedPct(gainPct)}` : '—', ink: hasPnl ? pt.ink : undefined },
            { label: 'Day change', value: `${mask(signedInr(pos.dayChange))} · ${signedPct(fund.change1dPct)}`, ink: t.ink },
          ]} />
        )}
        {hasPnl && (
          <div style={{ display: 'var(--phoneF)', gap: 8 }}>
            {rets.map(r => (
              <div key={r.label} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{r.label} return</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: TONE[dirOf(r.value)].ink, fontVariantNumeric: 'tabular-nums' }}>{signedPct(r.value)}</div>
              </div>
            ))}
          </div>
        )}
        <RemoveFooter holding={holding} onRemove={onRemove} />
      </RowDetail>
    </AssetRow>
  )
}
