'use client'

import Link from 'next/link'
import { usePrivacy } from '@/store/privacyStore'

export function PrivacyBar() {
  const setMasked = usePrivacy(s => s.setMasked)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14, background: 'var(--surface2)', fontSize: 13, color: 'var(--ink2)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--info)', flex: 'none' }} />
      <span style={{ flex: 1 }}><b style={{ color: 'var(--ink)' }}>Privacy on.</b> Amounts are hidden. Scores and percentages stay visible.</span>
      <button onClick={() => setMasked(false)} className="ov-btn" style={{ fontWeight: 700, color: 'var(--brand-ink)', background: 'none', padding: 0, fontSize: 13 }}>Reveal</button>
    </div>
  )
}

export interface TrayChip { label: string; href?: string; onClick?: () => void }

// Blocks with nothing to show fold into this tray instead of leaving gaps
export function SetupTray({ chips }: { chips: TrayChip[] }) {
  const chip: React.CSSProperties = { fontSize: 13, fontWeight: 700, padding: '9px 14px', borderRadius: 999, background: 'var(--surface)', boxShadow: 'var(--shadow)', color: 'var(--ink)', textDecoration: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
  return (
    <div style={{ borderRadius: 24, padding: 20, border: '1.5px dashed var(--line)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div className="ov-title">More you can track</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginTop: 2 }}>Each one adds its own card here.</div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {chips.map(c => c.href
          ? <Link key={c.label} href={c.href} style={chip}>+ {c.label}</Link>
          : <button key={c.label} onClick={c.onClick} style={chip}>+ {c.label}</button>)}
      </div>
    </div>
  )
}

// One skeleton per card, in that card's final shape, so nothing jumps when data arrives
export function OverviewSkeleton() {
  const bar = (h: number, w: string, r = 6) => <div style={{ height: h, width: w, borderRadius: r, background: 'var(--skel)' }} />
  const row = (a: string, b: string) => (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--skel)' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>{bar(12, a)}{bar(10, b)}</div>
    </div>
  )
  const card: React.CSSProperties = { borderRadius: 24, background: 'var(--surface)', padding: 20, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14 }
  return (
    <div className="ov-grid ov-skel" aria-busy="true" aria-label="Loading your overview">
      <div data-span="8" data-tspan="8" style={{ height: 236, borderRadius: 24, background: 'var(--hero-grad)', opacity: 0.55, padding: 20, boxSizing: 'border-box', display: 'flex', gap: 16 }}>
        <div style={{ width: 76, height: 76, borderRadius: '50%', border: '7px solid rgba(255,255,255,0.12)', boxSizing: 'border-box', flex: 'none' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
          <div style={{ height: 22, width: '70%', borderRadius: 8, background: 'rgba(255,255,255,0.14)' }} />
          <div style={{ height: 12, width: '90%', borderRadius: 6, background: 'rgba(255,255,255,0.1)' }} />
        </div>
      </div>
      <div data-span="4" data-tspan="4" style={{ ...card, height: 150 }}>{bar(14, '40%')}{row('70%', '45%')}{row('60%', '35%')}</div>
      <div data-span="4" data-tspan="6" style={{ ...card, height: 250 }}>
        {bar(14, '30%')}{bar(36, '55%', 10)}{bar(10, '40%')}
        <div style={{ marginTop: 'auto' }}>{bar(8, '100%', 8)}</div>
      </div>
      <div data-span="5" data-tspan="6" style={{ ...card, height: 250, flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
        {[40, 60, 30, 75, 50, 20, 20].map((h, i) => <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 6, background: 'var(--skel)' }} />)}
      </div>
      <div data-span="3" data-tspan="12" style={{ ...card, height: 250, background: 'var(--warn-soft)' }} />
    </div>
  )
}
