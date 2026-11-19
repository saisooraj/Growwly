'use client'

import type { CSSProperties } from 'react'
import { ARROW, TONE, dirOf, signedPct, whole } from './format'
import { Svg, cardStyle } from './ui'
import type { IndexData } from './useMarketData'

function view(ix: IndexData) {
  const t = TONE[dirOf(ix.changePct)]
  return ix.error
    ? { value: '—', pct: 'Couldn’t load', ink: 'var(--text-3)', soft: 'var(--surface-2)', arrow: null }
    : { value: whole(ix.value), pct: signedPct(ix.changePct), ink: t.ink, soft: t.soft, arrow: ARROW[dirOf(ix.changePct)] }
}

const nameStyle = { fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: 'var(--text-3)' }
const skel = (style: CSSProperties) => <div className="mkt-skel" style={{ background: 'var(--surface-2)', ...style }} />

// The right rail's first card on wide screens: one index per row
export function IndexCard({ indices, loading }: { indices: IndexData[]; loading: boolean }) {
  return (
    <section style={{ display: 'var(--idxCard)', ...cardStyle, padding: '6px 0' }}>
      {indices.map((ix, i) => {
        const v = view(ix)
        return (
          <div key={ix.symbol} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', borderTop: i ? '1px solid var(--border)' : 0 }}>
            {loading ? (
              <>
                <div style={{ flex: 1 }}>
                  {skel({ width: '50%', height: 10, borderRadius: 5 })}
                  {skel({ width: '70%', height: 15, borderRadius: 6, marginTop: 8 })}
                </div>
                {skel({ width: 60, height: 22, borderRadius: 999 })}
              </>
            ) : (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={nameStyle}>{ix.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 650, letterSpacing: '-0.015em', marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{v.value}</div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12.5, fontWeight: 600, padding: '4px 9px 4px 7px', borderRadius: 999, background: v.soft, color: v.ink, fontVariantNumeric: 'tabular-nums' }}>
                  {v.arrow && <Svg d={v.arrow} size={13} sw={2.6} />}{v.pct}
                </span>
              </>
            )}
          </div>
        )
      })}
    </section>
  )
}

// Phones and narrower desktops: chips that scroll sideways under the hero
export function IndexChips({ indices, loading }: { indices: IndexData[]; loading: boolean }) {
  return (
    <div className="mkt-chips" style={{ display: 'var(--chips)', gap: 8, overflowX: 'auto', margin: 'var(--chipsM)', padding: 'var(--chipsP)', scrollSnapType: 'x mandatory' }}>
      {indices.map(ix => {
        const v = view(ix)
        return (
          <div key={ix.symbol} style={{ flex: 'none', width: 146, scrollSnapAlign: 'start', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '11px 13px', boxShadow: 'var(--shadow)' }}>
            {loading ? (
              <>
                {skel({ width: '60%', height: 10, borderRadius: 5 })}
                {skel({ width: '80%', height: 16, borderRadius: 6, marginTop: 9 })}
                {skel({ width: '40%', height: 10, borderRadius: 5, marginTop: 8 })}
              </>
            ) : (
              <>
                <div style={nameStyle}>{ix.label}</div>
                <div style={{ fontSize: 17, fontWeight: 650, marginTop: 3, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{v.value}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12.5, fontWeight: 600, color: v.ink, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {v.arrow && <Svg d={v.arrow} size={13} sw={2.6} />}{v.pct}
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
