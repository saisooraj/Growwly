'use client'

import { useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ARROW, MASK, TONE, dirOf, inr, pctOf, signedInr, signedPct } from './format'
import {
  AreaChart, AssetRow, CardHeader, CardState, ChartTitle, PATH, PnlCell, RowDetail, StatGrid, SubLine, SummaryBox, Svg,
  cardStyle, change30, holdingStats, sectionLabel,
} from './ui'
import type { GoldKarat, useGold } from './useMarketData'

const SIGNAL = {
  buy:  { label: 'BUY',  text: '22K is more than 2% below its 30-day average — a good time to buy.',     bg: 'var(--good-soft)', ink: 'var(--good-ink)' },
  hold: { label: 'HOLD', text: '22K is within its usual 30-day range. No strong reason to buy or wait.', bg: 'var(--warn-soft)', ink: 'var(--warn-ink)' },
  wait: { label: 'WAIT', text: '22K is more than 4% above its 30-day average. Consider waiting for a dip.', bg: 'var(--bad-soft)', ink: 'var(--bad-ink)' },
}

const num: CSSProperties = { fontVariantNumeric: 'tabular-nums' }
const gramsNum = (g: number) => g.toLocaleString('en-IN', { maximumFractionDigits: 3 })
const grams = (g: number) => `${gramsNum(g)} g`

export default function GoldCard({ gold: g, masked }: { gold: ReturnType<typeof useGold>; masked: boolean }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const mask = (v: string) => masked ? MASK : v
  const d = g.data

  return (
    <section style={{ ...cardStyle, paddingBottom: 6 }}>
      <CardHeader
        title="Gold — 22K" noWrap tag={{ label: 'IBJA', bg: 'var(--warn-soft)', ink: 'var(--warn-ink)' }}
        cadence="every 5 min" refreshing={g.refreshing} onRefresh={g.refresh}
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
        const prev = h.length >= 2 ? h[h.length - 2].price22k : d.price22kPerGram
        const move = d.price22kPerGram - prev, movePct = pctOf(move, prev), mt = TONE[dirOf(movePct)]
        const vsAvg = pctOf(d.price22kPerGram - d.avg30Day, d.avg30Day)
        const signal = SIGNAL[d.signal]
        const values = h.slice(-30).map(x => x.price22k)
        const dates = h.slice(-30).map(x => { try { return format(parseISO(x.date), 'd MMM') } catch { return x.date } })
        return (
          <>
            <div style={{ padding: '0 var(--cx)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>22K per gram</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                <span style={{ fontSize: 32, fontWeight: 650, letterSpacing: '-0.03em', lineHeight: 1.1, ...num }}>{inr(d.price22kPerGram)}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12.5, fontWeight: 600, padding: '3px 9px 3px 7px', borderRadius: 999, background: mt.soft, color: mt.ink, ...num }}>
                  <Svg d={ARROW[dirOf(movePct)]} size={13} sw={2.6} />{signedInr(move)} · {signedPct(movePct)}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8, marginTop: 14 }}>
                {[
                  { label: '24K/g', value: inr(d.price24kPerGram) },
                  { label: '1 sovereign', value: inr(d.sovereign) },
                  { label: '10g · 22K', value: inr(d.tenGram) },
                ].map(r => (
                  <div key={r.label} style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '9px 10px', minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{r.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 1, whiteSpace: 'nowrap', ...num }}>{r.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 14, background: signal.bg, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', padding: '5px 9px', borderRadius: 8, background: signal.ink, color: 'var(--surface)', marginTop: 1 }}>{signal.label}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.4, textWrap: 'pretty' }}>{signal.text}</div>
                  <div style={{ fontSize: 12.5, color: signal.ink, marginTop: 3, ...num }}>30-day avg {inr(d.avg30Day)}/g · today {signedPct(vsAvg)} vs avg</div>
                </div>
              </div>
              {values.length > 1 && (
                <>
                  <div style={{ margin: '18px 0 12px' }}><ChartTitle label="30-DAY 22K PRICE" change={change30(values)} /></div>
                  <AreaChart
                    values={values} dates={dates} color="var(--brand)" height={140} gutter={40}
                    formatY={v => `₹${(v / 1000).toFixed(1)}K`} formatValue={v => `${inr(v)}/g`}
                    avg={d.avg30Day} avgLabel={`Avg ₹${(d.avg30Day / 1000).toFixed(2)}K`}
                  />
                </>
              )}
            </div>

            {g.holding ? (
              <>
                <SummaryBox
                  title={`Your gold · ${masked ? '••' : gramsNum(g.holding.grams)} g`}
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
            return (
              <div key={`${p.id}-${i}`} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, ...num }}>{masked ? '••' : gramsNum(p.grams)} g · {p.karat}K</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...num }}>
                    {p.dateLabel}{p.pricePerGram > 0 && ` · paid ${mask(inr(p.pricePerGram))}/g`} · {p.assetName}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, ...num }}>{mask(inr(now))}</div>
                  {lotGain !== null && <div style={{ fontSize: 12, color: TONE[dirOf(lotGain)].ink, ...num }}>{signedPct(lotGain)}</div>}
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
