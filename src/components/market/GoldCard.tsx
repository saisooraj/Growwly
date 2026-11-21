'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ARROW, MASK, TONE, dirOf, inr, pctOf, signedInr, signedPct } from './format'
import {
  AreaChart, AssetRow, CardHeader, CardState, ChartTitle, PATH, PnlCell, RowDetail, StatGrid, SubLine, SummaryBox, Svg,
  cardStyle, change30, holdingStats, sectionLabel,
} from './ui'
import GoldHistoryChart from './GoldHistoryChart'
import { useGoldHistory, type GoldKarat, type useGold } from './useMarketData'
import { GRAMS_PER_SOVEREIGN, goldPricesFrom22k, goldSignal, goldYearAverage, priceForKarat } from '@/lib/gold'

const SIGNAL = {
  buy:  { label: 'BUY',  text: (period: string) => `is more than 2% below its ${period} average — a good time to buy.`,     bg: 'var(--good-soft)', ink: 'var(--good-ink)' },
  hold: { label: 'HOLD', text: (period: string) => `is within its usual ${period} range. No strong reason to buy or wait.`, bg: 'var(--warn-soft)', ink: 'var(--warn-ink)' },
  wait: { label: 'WAIT', text: (period: string) => `is more than 4% above its ${period} average. Consider waiting for a dip.`, bg: 'var(--bad-soft)', ink: 'var(--bad-ink)' },
}

const KARATS = [24, 22, 18] as const
type Karat = typeof KARATS[number]
const KARAT_OPTIONS = KARATS.map(k => ({ value: k, label: `${k}K` }))

type ChartView = 'recent' | 'history'
const CHART_OPTIONS: { value: ChartView; label: string }[] = [
  { value: 'recent', label: '30 days' },
  { value: 'history', label: 'History' },
]

const num: CSSProperties = { fontVariantNumeric: 'tabular-nums' }
const gramsNum = (g: number) => g.toLocaleString('en-IN', { maximumFractionDigits: 3 })
const grams = (g: number) => `${gramsNum(g)} g`
const sovereigns = (g: number) => {
  const n = Math.round(g / GRAMS_PER_SOVEREIGN * 100) / 100
  return `${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${n === 1 ? 'sovereign' : 'sovereigns'}`
}

export default function GoldCard({ gold: g, masked }: { gold: ReturnType<typeof useGold>; masked: boolean }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [karat, setKarat] = useState<Karat>(22)
  const [chartView, setChartView] = useState<ChartView>('recent')
  const past = useGoldHistory(chartView === 'history')
  const yearAvg = useMemo(() => past.history ? goldYearAverage(past.history) : null, [past.history])
  const mask = (v: string) => masked ? MASK : v
  const d = g.data

  return (
    <section style={{ ...cardStyle, paddingBottom: 6 }}>
      <CardHeader
        title="Gold" noWrap refreshing={g.refreshing} onRefresh={g.refresh}
      />

      {g.loading && (
        <div style={{ padding: '0 var(--cx) 14px' }}>
          <div className="mkt-skel" style={{ width: '55%', height: 28, borderRadius: 8, background: 'var(--surface-2)' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
            {[0, 1, 2].map(i => <div key={i} className="mkt-skel" style={{ height: 52, borderRadius: 12, background: 'var(--surface-2)' }} />)}
          </div>
          <div className="mkt-skel" style={{ height: 56, borderRadius: 14, background: 'var(--surface-2)', marginTop: 14 }} />
          <div className="mkt-skel" style={{ height: 130, borderRadius: 12, background: 'var(--surface-2)', marginTop: 14 }} />
        </div>
      )}

      {!g.loading && !d && (
        <CardState icon={PATH.offline} bg="var(--bad-soft)" ink="var(--bad-ink)" title="Gold prices unavailable"
          text="Check your connection. We'll retry in 5 min." onRetry={g.refresh} pad="18px var(--cx) 24px" border={false} />
      )}

      {!g.loading && d && (() => {
        const h = d.history
        // The feed is 22K; other karats follow it by purity
        const scale = karat / 22
        const rate = priceForKarat(karat, goldPricesFrom22k(d.price22kPerGram))
        const prev = (h.length >= 2 ? h[h.length - 2].price22k : d.price22kPerGram) * scale
        const move = rate - prev, movePct = pctOf(move, prev), mt = TONE[dirOf(movePct)]
        const avg = d.avg30Day !== null ? d.avg30Day * scale : null
        // The suggestion follows the chart view: 30-day average, or 1-year average on History
        const isHistory = chartView === 'history'
        const signalPeriod = isHistory ? '1-year' : '30-day'
        const signalAvg22 = isHistory ? yearAvg : d.avg30Day
        const signalAvg = signalAvg22 !== null ? signalAvg22 * scale : null
        const vsAvg = signalAvg !== null ? pctOf(rate - signalAvg, signalAvg) : 0
        const signalKey = isHistory ? (yearAvg !== null ? goldSignal(d.price22kPerGram, yearAvg) : null) : d.signal
        const signal = signalKey ? SIGNAL[signalKey] : null
        const values = h.slice(-30).map(x => x.price22k * scale)
        const dates = h.slice(-30).map(x => { try { return format(parseISO(x.date), 'd MMM') } catch { return x.date } })
        return (
          <>
            <div style={{ padding: '0 var(--cx)' }}>
              <Segmented label="Gold purity" options={KARAT_OPTIONS} value={karat} onChange={setKarat} marginBottom={14} />
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{karat}K per gram</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                <span style={{ fontSize: 32, fontWeight: 650, letterSpacing: '-0.03em', lineHeight: 1.1, ...num }}>{inr(rate)}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12.5, fontWeight: 600, padding: '3px 9px 3px 7px', borderRadius: 999, background: mt.soft, color: mt.ink, ...num }}>
                  <Svg d={ARROW[dirOf(movePct)]} size={13} sw={2.6} />{signedInr(move)} · {signedPct(movePct)}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8, marginTop: 14 }}>
                {[
                  { label: `1 sovereign · ${karat}K`, value: inr(rate * GRAMS_PER_SOVEREIGN) },
                  { label: `10 g · ${karat}K`, value: inr(rate * 10) },
                ].map(r => (
                  <div key={r.label} style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '9px 10px', minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{r.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 1, whiteSpace: 'nowrap', ...num }}>{r.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <Segmented label="Suggestion and chart period" options={CHART_OPTIONS} value={chartView} onChange={setChartView} />
              </div>
              {isHistory && past.loading && !past.error && (
                <div className="mkt-skel" style={{ height: 74, borderRadius: 14, background: 'var(--surface-2)', marginTop: 12 }} />
              )}
              {signal && signalAvg !== null && (
                <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 14, background: signal.bg, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', padding: '5px 9px', borderRadius: 8, background: signal.ink, color: 'var(--surface)', marginTop: 1 }}>{signal.label}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.4, textWrap: 'pretty' }}>{karat}K {signal.text(signalPeriod)}</div>
                    <div style={{ fontSize: 12.5, color: signal.ink, marginTop: 3, ...num }}>{signalPeriod} avg {inr(signalAvg)}/g · today {signedPct(vsAvg)} vs avg</div>
                  </div>
                </div>
              )}
              {chartView === 'history' && (
                <GoldHistoryChart
                  history={past.history} loading={past.loading} error={past.error} onRetry={past.retry}
                  karat={karat} rate={rate} buys={past.buys} unplotted={past.unplotted} masked={masked}
                />
              )}
              {chartView === 'recent' && values.length > 1 && (
                <>
                  <div style={{ margin: '18px 0 12px' }}>
                    <ChartTitle label={`${avg !== null ? '30-DAY' : 'RECENT'} ${karat}K PRICE`} change={change30(values)} period={avg !== null ? 'in 30 days' : 'recently'} />
                  </div>
                  <AreaChart
                    values={values} dates={dates} color="var(--brand)" height={140} gutter={40}
                    formatY={v => `₹${(v / 1000).toFixed(1)}K`} formatValue={v => `${inr(v)}/g`}
                    avg={avg ?? undefined} avgLabel={avg !== null ? `Avg ₹${(avg / 1000).toFixed(2)}K` : undefined}
                  />
                  {h.some(x => x.estimated) && (
                    <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text-3)', textWrap: 'pretty' }}>
                      Latest days are IBJA rates. Earlier days are estimated from the GOLDBEES gold ETF.
                    </div>
                  )}
                </>
              )}
            </div>

            {g.holding ? (
              <>
                <SummaryBox
                  title={`Your gold · ${masked ? '•• g · •• sovereigns' : `${grams(g.holding.grams)} · ${sovereigns(g.holding.grams)}`}`}
                  value={mask(inr(g.holding.current))}
                  pct={g.holding.invested > 0 ? pctOf(g.holding.current - g.holding.invested, g.holding.invested) : null}
                  stats={g.holding.invested > 0 ? holdingStats(g.holding.invested, g.holding.current, g.holding.dayChange, mask) : null}
                  margin="16px var(--cx) 12px" valueSize={13.5}
                >
                  {g.holding.invested === 0 && (
                    <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-3)', textWrap: 'pretty' }}>
                      Add purchase prices to your gold in Net Worth to see profit and loss.
                    </div>
                  )}
                </SummaryBox>
                {g.holding.byKarat.map(k => (
                  <KaratRow key={k.karat} k={k} masked={masked}
                    expanded={expanded === k.karat} onToggle={() => setExpanded(e => e === k.karat ? null : k.karat)} />
                ))}
              </>
            ) : (
              <div style={{ margin: '16px var(--cx) 10px', padding: '12px 14px', borderRadius: 14, border: '1px dashed var(--border)', fontSize: 13, color: 'var(--text-3)', textWrap: 'pretty' }}>
                Own gold? Add it in <Link href="/networth" style={{ fontWeight: 600, textDecoration: 'none' }}>Net Worth</Link> with what you paid, and we&rsquo;ll track its value and gain here.
              </div>
            )}
          </>
        )
      })()}
    </section>
  )
}

function Segmented<T extends string | number>({ label, options, value, onChange, marginBottom = 0 }: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  marginBottom?: number
}) {
  return (
    <div role="group" aria-label={label} style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))`, gap: 3, padding: 3, marginBottom, borderRadius: 12, background: 'var(--surface-2)' }}>
      {options.map(o => {
        const on = o.value === value
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(o.value)} style={{
            height: 'var(--hit)', padding: 0, border: 0, borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--text)' : 'var(--text-3)',
            boxShadow: on ? '0 1px 2px rgba(0,0,0,.12)' : 'none', ...num,
          }}>{o.label}</button>
        )
      })}
    </div>
  )
}

// One row per karat held; the purchases behind it open underneath
function KaratRow({ k, masked, expanded, onToggle }: {
  k: GoldKarat
  masked: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const mask = (v: string) => masked ? MASK : v
  const gain = k.paid > 0 ? k.value - k.paid : null
  const gainPct = gain !== null ? pctOf(gain, k.paid) : 0
  const pt = TONE[dirOf(gain ?? 0)], dt = TONE[dirOf(k.dayChange)]
  const g = masked ? '•• g' : grams(k.grams)

  return (
    <AssetRow
      cols="36px minmax(0,1fr) auto 16px"
      badge={{ bg: pt.soft, ink: pt.ink, path: ARROW[dirOf(gain ?? 0)] }}
      name={`${k.karat}K gold`}
      sub={<SubLine>{g} · Today {inr(k.rate)}/g</SubLine>}
      price={gain !== null
        ? <PnlCell value={mask(signedInr(gain))} sub={signedPct(gainPct)} ink={pt.ink} />
        : <PnlCell value={mask(inr(k.value))} sub="No buy price" ink="var(--text)" subInk="var(--text-4)" />}
      expanded={expanded}
      onToggle={onToggle}
    >
      <RowDetail pad="4px var(--cx) 16px" gap={14}>
        <StatGrid cols="repeat(2, minmax(0,1fr))" stats={[
          { label: 'Grams', value: masked ? '••' : grams(k.grams) },
          { label: 'Avg paid/g', value: k.avgPaid ? mask(inr(k.avgPaid)) : '—' },
          { label: 'Today/g', value: inr(k.rate) },
          { label: 'Value', value: mask(inr(k.value)) },
          { label: 'Gain', value: gain !== null ? `${mask(signedInr(gain))} · ${signedPct(gainPct)}` : '—', ink: gain !== null ? pt.ink : undefined },
          { label: 'Day change', value: mask(signedInr(k.dayChange)), ink: dt.ink },
        ]} />
        <div>
          <div style={{ ...sectionLabel, marginBottom: 6 }}>{k.lots.length} {k.lots.length === 1 ? 'PURCHASE' : 'PURCHASES'}</div>
          {k.lots.map((p, i) => {
            const now = p.grams * k.rate
            const lotGain = p.pricePerGram > 0 ? (k.rate / p.pricePerGram - 1) * 100 : null
            const lotGainAmount = p.pricePerGram > 0 ? now - p.grams * p.pricePerGram : null
            return (
              <div key={`${p.id}-${i}`} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, ...num }}>{masked ? '••' : gramsNum(p.grams)} g · {p.karat}K</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...num }}>
                    {p.dateLabel}{p.pricePerGram > 0 && ` · paid ${mask(inr(p.pricePerGram))}/g`} · {p.assetName}
                  </div>
                </div>
                <div style={{ flex: 'none', textAlign: 'right' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, ...num }}>{mask(inr(now))}</div>
                  {lotGain !== null && lotGainAmount !== null && (
                    <div style={{ fontSize: 12, color: TONE[dirOf(lotGain)].ink, whiteSpace: 'nowrap', ...num }}>
                      {mask(signedInr(lotGainAmount))} · {signedPct(lotGain)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
          Edit gold and purchase prices in <Link href="/networth" style={{ fontWeight: 600, textDecoration: 'none' }}>Net Worth</Link>.
        </div>
      </RowDetail>
    </AssetRow>
  )
}
