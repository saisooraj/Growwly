'use client'

import Link from 'next/link'
import { ARROW, dirOf, signedPct } from './format'
import { Svg } from './ui'

export interface HeroSplit { label: string; value: string; share: number; color: string }

// The answer at the top: what the user's stocks, funds and gold are worth, the profit on them and
// today's move, split by kind. A user with none of these gets a way to start instead.
export default function MarketHero({ state, total, boxes, split, masked, goldLeftOut, onWatch }: {
  state: 'loading' | 'holdings' | 'empty'
  total: string
  boxes: { label: string; value: string; pct: number; dir: number }[]
  split: HeroSplit[]
  masked: boolean
  goldLeftOut: boolean
  onWatch: () => void
}) {
  const eyebrow = { fontSize: 11.5, fontWeight: 600, letterSpacing: '.09em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,.82)' }
  return (
    <section style={{
      position: 'relative', overflow: 'hidden', borderRadius: 24, padding: 'var(--heroPad)', color: '#fff',
      background: 'linear-gradient(150deg, var(--hero-a) 0%, var(--hero-b) 100%)', boxShadow: 'var(--hero-sh)',
    }}>
      <div style={{ position: 'absolute', right: -90, top: -140, width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(closest-side, var(--hero-glow), transparent)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative' }}>
        {state === 'loading' && (
          <>
            <div className="mkt-skel" style={{ width: 140, height: 12, borderRadius: 6, background: 'rgba(255,255,255,.18)' }} />
            <div className="mkt-skel" style={{ width: 260, maxWidth: '70%', height: 40, borderRadius: 10, background: 'rgba(255,255,255,.18)', marginTop: 14 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10, marginTop: 20 }}>
              <div className="mkt-skel" style={{ height: 68, borderRadius: 14, background: 'rgba(255,255,255,.12)' }} />
              <div className="mkt-skel" style={{ height: 68, borderRadius: 14, background: 'rgba(255,255,255,.12)' }} />
            </div>
            <div className="mkt-skel" style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,.14)', marginTop: 20 }} />
          </>
        )}

        {state === 'holdings' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, ...eyebrow }}>Market value · stocks, funds &amp; gold</div>
              {masked && <span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 8px', borderRadius: 999, background: 'rgba(255,255,255,.16)' }}>Amounts hidden</span>}
            </div>
            <div style={{ fontSize: 'var(--heroNum)', fontWeight: 650, letterSpacing: '-0.035em', lineHeight: 1.05, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{total}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10, marginTop: 18 }}>
              {boxes.map(b => (
                <div key={b.label} style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 14, padding: '11px 14px', minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.85)', fontWeight: 500 }}>{b.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 19, fontWeight: 650, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{b.value}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600, padding: '2px 7px 2px 5px', borderRadius: 999, background: 'rgba(255,255,255,.18)', fontVariantNumeric: 'tabular-nums' }}>
                      <Svg d={ARROW[dirOf(b.dir)]} size={12} sw={2.6} />{signedPct(b.pct)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 3, height: 8, marginTop: 20, borderRadius: 4, overflow: 'hidden' }}>
              {split.map(x => <div key={x.label} style={{ width: `${x.share.toFixed(2)}%`, background: x.color }} />)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginTop: 12 }}>
              {split.map(x => (
                <div key={x.label} style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,.85)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: x.color, flex: 'none' }} />
                    {x.label}
                    <span style={{ color: 'rgba(255,255,255,.7)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(x.share)}%</span>
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, marginTop: 2, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.value}</div>
                </div>
              ))}
            </div>
            {goldLeftOut && (
              <div style={{ marginTop: 14, fontSize: 12.5, padding: '8px 10px', borderRadius: 10, background: 'rgba(0,0,0,.18)' }}>
                Gold rates are unavailable right now, so gold is left out of these totals.
              </div>
            )}
          </>
        )}

        {state === 'empty' && (
          <>
            <div style={eyebrow}>Your market money</div>
            <div style={{ fontSize: 26, fontWeight: 650, letterSpacing: '-0.025em', lineHeight: 1.15, marginTop: 10, maxWidth: 440, textWrap: 'pretty' }}>
              Track stocks, funds and gold in one place
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,.88)', maxWidth: 460, textWrap: 'pretty' }}>
              Holdings you add in Net Worth appear here with live value and profit. Or start by watching a few stocks.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <Link href="/networth" style={{ height: 40, padding: '0 16px', borderRadius: 12, border: 0, background: '#fff', color: 'var(--hero-btn)', fontWeight: 600, fontSize: 14, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                Add holdings in Net Worth
              </Link>
              <button onClick={onWatch} style={{ height: 40, padding: '0 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.3)', background: 'rgba(255,255,255,.12)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                Watch a stock
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
