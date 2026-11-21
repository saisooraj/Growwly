'use client'

import { Fragment, useId, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { TONE, dirOf, inr, pctOf, signedInr, signedPct } from './format'

// Shared pieces of the market cards: header, tag, summary, stat grid, rows, charts and the add panel

export const PATH = {
  refresh: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5',
  plus: 'M5 12h14M12 5v14',
  x: 'M18 6 6 18M6 6l12 12',
  chevron: 'm6 9 6 6 6-6',
  trend: 'M22 7l-8.5 8.5-5-5L2 17M16 7h6v6',
  chart: 'M3 3v18h18M7 14l4-4 4 4 5-5',
  offline: 'M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M5 12.86a10 10 0 0 1 5.17-2.69M19 12.86a10 10 0 0 0-2-1.52M2 8.82a15 15 0 0 1 4.18-2.64M22 8.82a15 15 0 0 0-11.29-3.76M2 2l20 20',
  eye: 'M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0',
  eyeOff: 'M10.73 5.08A10.7 10.7 0 0 1 21.94 11.65a1 1 0 0 1 0 .7 10.7 10.7 0 0 1-1.44 2.49M14.08 14.16a3 3 0 0 1-4.24-4.24M17.48 17.5A10.75 10.75 0 0 1 2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14M2 2l20 20',
  external: 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  search: 'm21 21-4.3-4.3',
  warn: 'M12 8v5M12 16.5v.01',
}

export function Svg({ d, size, sw = 2, style, children }: { d?: string; size: number; sw?: number; style?: CSSProperties; children?: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
      {d && <path d={d} />}
      {children}
    </svg>
  )
}

const num: CSSProperties = { fontVariantNumeric: 'tabular-nums' }
const clip: CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }

export const cardStyle: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: 'var(--shadow)',
}

// ── Card header ──────────────────────────────────────────────────────────────

export function CardHeader({ title, tag, cadence, refreshing, onRefresh, add, padBottom = 14, noWrap }: {
  title: string
  tag?: { label: string; bg: string; ink: string }
  cadence?: string
  refreshing: boolean
  onRefresh: () => void
  add?: { open: boolean; toggle: () => void }
  padBottom?: number
  noWrap?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: `16px var(--cx) ${padBottom}px` }}>
      <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: noWrap ? 'nowrap' : undefined }}>{title}</div>
      {tag && (
        <span style={{ font: "500 10.5px/1 'Geist Mono', monospace", letterSpacing: '.05em', textTransform: 'uppercase', padding: '4px 7px', borderRadius: 6, background: tag.bg, color: tag.ink, flex: 'none' }}>
          {tag.label}
        </span>
      )}
      <span style={{ fontSize: 12.5, color: 'var(--text-3)', flex: 1, ...clip }}>{refreshing ? 'Refreshing…' : cadence}</span>
      <button onClick={onRefresh} title="Refresh" aria-label={`Refresh ${title.toLowerCase()}`} style={{
        width: 'var(--hit)', height: 'var(--hit)', borderRadius: 10, display: 'grid', placeItems: 'center',
        border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', padding: 0, flex: 'none',
      }}>
        <Svg d={PATH.refresh} size={15} />
      </button>
      {add && (
        <button onClick={add.toggle} aria-expanded={add.open} style={{
          height: 'var(--hit)', padding: '0 13px 0 10px', borderRadius: 10, border: 0,
          background: add.open ? 'var(--surface-2)' : 'var(--text)', color: add.open ? 'var(--text)' : 'var(--bg)',
          fontWeight: 600, fontSize: 13, display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer', flex: 'none',
        }}>
          <Svg d={add.open ? PATH.x : PATH.plus} size={15} sw={2.4} />
          {add.open ? 'Close' : 'Add'}
        </button>
      )}
    </div>
  )
}

// ── Tags ─────────────────────────────────────────────────────────────────────

export function Tag({ holding }: { holding: boolean }) {
  return (
    <span style={{
      flex: 'none', fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
      background: holding ? 'var(--brand-soft)' : 'transparent', color: holding ? 'var(--brand-ink)' : 'var(--text-3)',
      boxShadow: `inset 0 0 0 1px ${holding ? 'transparent' : 'var(--border)'}`,
    }}>
      {holding ? 'Holding' : 'Watchlist'}
    </span>
  )
}

export function Pill({ value, size = 12.5, pad = '3px 8px' }: { value: number; size?: number; pad?: string }) {
  const t = TONE[dirOf(value)]
  return (
    <span style={{ fontSize: size, fontWeight: 600, padding: pad, borderRadius: 999, background: t.soft, color: t.ink, ...num }}>
      {signedPct(value)}
    </span>
  )
}

// ── Holding summary ──────────────────────────────────────────────────────────

export interface SumStat { label: string; value: string; sub: string; ink: string }

// Invested · Total P&L · Day change, for a summary box. `mask` hides the user's ₹ amounts.
export function holdingStats(invested: number, current: number, day: number, mask: (v: string) => string): SumStat[] {
  const pnl = current - invested
  const known = invested > 0
  return [
    { label: 'Invested', value: known ? mask(inr(invested)) : '—', sub: ' ', ink: 'var(--text)' },
    { label: 'Total P&L', value: known ? mask(signedInr(pnl)) : '—', sub: known ? signedPct(pctOf(pnl, invested)) : ' ', ink: known ? TONE[dirOf(pnl)].ink : 'var(--text)' },
    { label: 'Day change', value: mask(signedInr(day)), sub: signedPct(pctOf(day, current - day)), ink: TONE[dirOf(day)].ink },
  ]
}

export function SummaryBox({ title, value, pct, stats, margin, valueSize = 14, children }: {
  title: string
  value: string
  pct: number | null
  stats: SumStat[] | null
  margin: string
  valueSize?: number
  children?: ReactNode
}) {
  return (
    <div style={{ margin, padding: '14px 16px', borderRadius: 16, background: 'var(--surface-2)' }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 500 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 24, fontWeight: 650, letterSpacing: '-0.025em', ...num }}>{value}</span>
        {pct !== null && <Pill value={pct} />}
      </div>
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          {stats.map(t => (
            <div key={t.label} style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{t.label}</div>
              <div style={{ fontSize: valueSize, fontWeight: 600, color: t.ink, marginTop: 2, ...num, ...clip }}>{t.value}</div>
              <div style={{ fontSize: 12, color: t.ink, ...num }}>{t.sub}</div>
            </div>
          ))}
        </div>
      )}
      {children}
    </div>
  )
}

// ── Stat grid (inside an expanded row) ───────────────────────────────────────

export interface Stat { label: string; value: string; ink?: string }

export function StatGrid({ stats, cols = 'var(--statCols)' }: { stats: Stat[]; cols?: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {stats.map(t => (
        <div key={t.label} style={{ background: 'var(--surface)', padding: '10px 12px', minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{t.label}</div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: t.ink ?? 'var(--text)', marginTop: 2, ...num, ...clip }}>{t.value}</div>
        </div>
      ))}
    </div>
  )
}

export const sectionLabel: CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '.04em' }

// ── States ───────────────────────────────────────────────────────────────────

export function SkeletonRows({ count, nameW, subW }: { count: number; nameW: string; subW: string }) {
  const bar = (style: CSSProperties) => <div className="mkt-skel" style={{ background: 'var(--surface-2)', ...style }} />
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--rowPad)', borderTop: '1px solid var(--border)' }}>
          {bar({ width: 36, height: 36, borderRadius: 11 })}
          <div style={{ flex: 1 }}>
            {bar({ width: nameW, height: 12, borderRadius: 6 })}
            {bar({ width: subW, height: 10, borderRadius: 5, marginTop: 8 })}
          </div>
          <div style={{ width: 80 }}>
            {bar({ height: 12, borderRadius: 6 })}
            {bar({ width: '60%', height: 10, borderRadius: 5, margin: '8px 0 0 auto' })}
          </div>
        </div>
      ))}
    </>
  )
}

export function CardState({ icon, bg, ink, title, text, onRetry, pad = '22px var(--cx) 28px', border = true }: {
  icon: string
  bg: string
  ink: string
  title: string
  text: string
  onRetry?: () => void
  pad?: string
  border?: boolean
}) {
  return (
    <div style={{ padding: pad, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6, borderTop: border ? '1px solid var(--border)' : undefined }}>
      <div style={{ width: 44, height: 44, borderRadius: 14, background: bg, color: ink, display: 'grid', placeItems: 'center', marginBottom: 4 }}>
        <Svg d={icon} size={20} />
      </div>
      <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
      <div style={{ fontSize: 13.5, color: 'var(--text-3)', maxWidth: 320, textWrap: 'pretty' }}>{text}</div>
      {onRetry && (
        <button onClick={onRetry} style={{ marginTop: 8, height: 36, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Try again
        </button>
      )}
    </div>
  )
}

export function HiddenNote({ count, onRestore, icon }: { count: number; onRestore: () => void; icon?: boolean }) {
  if (count === 0) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px var(--cx)', borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text-3)' }}>
      {icon && <Svg d={PATH.eyeOff} size={15} />}
      {count} {count === 1 ? 'holding' : 'holdings'} hidden
      <span style={{ color: 'var(--border)' }}>·</span>
      <a href="#" onClick={e => { e.preventDefault(); onRestore() }} style={{ fontWeight: 600, textDecoration: 'none' }}>Show again</a>
    </div>
  )
}

// ── Asset row ────────────────────────────────────────────────────────────────
// Badge · name with tag and a line under it · sparkline · price and move · my P&L · chevron.
// On a phone the sparkline and P&L columns drop out and the line under the name can change.

export interface Badge { bg: string; ink: string; path: string }

export function AssetRow({ badge, name, tag, sub, subPhone, spark, price, pnl, expanded, onToggle, cols = 'var(--rowCols)', children }: {
  badge: Badge
  name: string
  tag?: ReactNode
  sub: ReactNode
  subPhone?: ReactNode
  spark?: ReactNode
  price?: ReactNode
  pnl?: ReactNode
  expanded: boolean
  onToggle: () => void
  cols?: string
  children?: ReactNode
}) {
  function onKey(e: KeyboardEvent) {
    if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
    e.preventDefault()
    onToggle()
  }
  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <div role="button" tabIndex={0} aria-expanded={expanded} onClick={onToggle} onKeyDown={onKey} className="mkt-hov" style={{
        display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center', padding: 'var(--rowPad)', cursor: 'pointer',
        background: expanded ? 'var(--surface-2)' : 'transparent',
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: badge.bg, color: badge.ink }}>
          <Svg d={badge.path} size={18} sw={2.2} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: 14.5, minWidth: 0, ...clip }}>{name}</span>
            {tag}
          </div>
          {subPhone === undefined ? sub : (
            <>
              <div style={{ display: 'var(--deskB)' }}>{sub}</div>
              <div style={{ display: 'var(--phoneB)' }}>{subPhone}</div>
            </>
          )}
        </div>
        {spark !== undefined && <div style={{ display: 'var(--deskB)', position: 'relative', width: 76, height: 28 }}>{spark}</div>}
        {price !== undefined && <div style={{ textAlign: 'right', minWidth: 0 }}>{price}</div>}
        {pnl !== undefined && <div style={{ display: 'var(--deskB)', textAlign: 'right', minWidth: 0 }}>{pnl}</div>}
        <Svg d={PATH.chevron} size={16} style={{ color: 'var(--text-3)', transition: 'transform .2s', transform: expanded ? 'rotate(180deg)' : 'none' }} />
      </div>
      {expanded && children}
    </div>
  )
}

export function SubLine({ children, ink = 'var(--text-3)', style }: { children: ReactNode; ink?: string; style?: CSSProperties }) {
  return <div style={{ fontSize: 12.5, color: ink, marginTop: 2, ...clip, ...num, ...style }}>{children}</div>
}

export function PriceCell({ price, move, movePhone, ink }: { price: string; move: string; movePhone: string; ink: string }) {
  return (
    <>
      <div style={{ fontWeight: 600, fontSize: 14.5, whiteSpace: 'nowrap', ...num }}>{price}</div>
      <div style={{ fontSize: 12.5, fontWeight: 500, color: ink, marginTop: 2, whiteSpace: 'nowrap', ...num }}>
        <span style={{ display: 'var(--deskI)' }}>{move}</span>
        <span style={{ display: 'var(--phoneI)' }}>{movePhone}</span>
      </div>
    </>
  )
}

export function PnlCell({ value, sub, ink, subInk = ink, size = 14 }: { value: string; sub: string; ink: string; subInk?: string; size?: number }) {
  return (
    <>
      <div style={{ fontWeight: 600, fontSize: size, color: ink, whiteSpace: 'nowrap', ...num }}>{value}</div>
      <div style={{ fontSize: 12.5, color: subInk, marginTop: 2, ...num }}>{sub}</div>
    </>
  )
}

export function RowDetail({ children, pad = 'var(--detailPad)', gap = 16 }: { children: ReactNode; pad?: string; gap?: number }) {
  return <div style={{ padding: pad, background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap }}>{children}</div>
}

export function RemoveFooter({ holding, onRemove }: { holding: boolean; onRemove: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <button onClick={e => { e.stopPropagation(); onRemove() }} style={{
        height: 34, padding: '0 12px 0 9px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)',
        color: 'var(--text-2)', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
      }}>
        <Svg d={PATH.x} size={14} sw={2.2} />
        {holding ? 'Hide from card' : 'Remove from watchlist'}
      </button>
      {holding && <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Still counts in your totals. Manage it in Net Worth.</span>}
    </div>
  )
}

// ── Sparkline (76 × 28, hover shows the value) ───────────────────────────────

export function Spark({ values, color, format }: { values: number[]; color: string; format: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null)
  const n = values.length
  if (n < 2) return null
  const w = 76, h = 28
  const lo = Math.min(...values), hi = Math.max(...values), r = hi - lo || 1
  const pts = values.map((v, i) => [i / (n - 1) * w, 3 + (1 - (v - lo) / r) * (h - 6)])
  const at = pts[hover ?? n - 1]
  return (
    <>
      <svg width={76} height={28} viewBox="0 0 76 28" style={{ overflow: 'visible', display: 'block' }} aria-hidden>
        <polyline points={pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} fill="none" strokeWidth={1.6}
          strokeLinejoin="round" strokeLinecap="round" style={{ stroke: color }} />
      </svg>
      <div style={{ position: 'absolute', left: at[0], top: at[1], width: 6, height: 6, borderRadius: '50%', background: color, transform: 'translate(-50%,-50%)', boxShadow: '0 0 0 2px var(--surface)' }} />
      {hover !== null && (
        <div style={{ position: 'absolute', left: '50%', bottom: 'calc(100% + 3px)', transform: 'translateX(-50%)', fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 6, background: 'var(--text)', color: 'var(--bg)', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 2, ...num }}>
          {format(values[hover])}
        </div>
      )}
      <div onMouseLeave={() => setHover(null)} style={{ position: 'absolute', inset: '-4px 0', display: 'flex' }}>
        {values.map((_, i) => <div key={i} onMouseEnter={() => setHover(i)} style={{ flex: 1 }} />)}
      </div>
    </>
  )
}

// ── 30-day area chart (hover shows date and value) ───────────────────────────

export const change30 = (values: number[]) => values.length > 1 && values[0] ? (values[values.length - 1] / values[0] - 1) * 100 : 0

// A point plotted on top of the line, such as a purchase at the price paid
export interface ChartMark { index: number; value: number; color: string; label: string }

export function AreaChart({ values, dates, axisDates, color, formatY, formatValue, height, gutter, avg, avgLabel, marks = [] }: {
  values: number[]
  dates: string[]
  axisDates?: string[]
  color: string
  formatY: (v: number) => string
  formatValue: (v: number) => string
  height: number
  gutter: number
  avg?: number
  avgLabel?: string
  marks?: ChartMark[]
}) {
  const gid = `mkt${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [hover, setHover] = useState<number | null>(null)
  const n = values.length
  if (n < 2) return null
  let lo = Math.min(...values), hi = Math.max(...values)
  if (avg != null) { lo = Math.min(lo, avg); hi = Math.max(hi, avg) }
  for (const m of marks) { lo = Math.min(lo, m.value); hi = Math.max(hi, m.value) }
  // Follows the pointer or a tap, snapping to a nearby mark so small dots are easy to hit
  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const raw = Math.max(0, Math.min(n - 1, Math.round((e.clientX - box.left) / box.width * (n - 1))))
    let best = raw, gap = Math.max(1, Math.round(n * 0.02)) + 1
    for (const m of marks) {
      const dist = Math.abs(m.index - raw)
      if (dist < gap) { gap = dist; best = m.index }
    }
    setHover(best)
  }
  const hoverMarks = hover !== null ? marks.filter(m => m.index === hover) : []
  const pad = (hi - lo) * 0.14 || 1
  const L = lo - pad, H = hi + pad
  const X = (i: number) => i / (n - 1) * 100
  const Y = (v: number) => (1 - (v - L) / (H - L)) * 100
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(2)} ${Y(v).toFixed(2)}`).join(' ')
  const yTicks = [hi, (hi + lo) / 2, lo]
  const xIdx = [0, Math.round((n - 1) / 3), Math.round(2 * (n - 1) / 3), n - 1]
  const hx = hover !== null ? X(hover) : 0
  return (
    <div style={{ position: 'relative', paddingLeft: gutter }}>
      <div onMouseLeave={() => setHover(null)} style={{ position: 'relative', height }}>
        {yTicks.map((v, i) => (
          <Fragment key={i}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: `${Y(v).toFixed(2)}%`, borderTop: '1px dashed var(--border)' }} />
            <span style={{ position: 'absolute', left: -gutter, width: gutter - 6, textAlign: 'right', top: `${Y(v).toFixed(2)}%`, transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-3)', ...num }}>
              {formatY(v)}
            </span>
          </Fragment>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} aria-hidden>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.26 }} />
              <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <path d={`${line} L100 100 L0 100 Z`} fill={`url(#${gid})`} />
          <path d={line} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" style={{ stroke: color }} />
        </svg>
        {avg != null && (
          <>
            <div style={{ position: 'absolute', left: 0, right: 0, top: `${Y(avg)}%`, borderTop: '1.5px dashed var(--text-3)' }} />
            <span style={{ position: 'absolute', left: 4, top: `${Y(avg)}%`, transform: 'translateY(-125%)', fontSize: 10.5, fontWeight: 600, color: 'var(--text-2)', background: 'var(--surface)', padding: '1px 5px', borderRadius: 4, ...num }}>
              {avgLabel}
            </span>
          </>
        )}
        {marks.map((m, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${X(m.index)}%`, top: `${Y(m.value)}%`, width: 9, height: 9, borderRadius: '50%',
            background: m.color, boxShadow: '0 0 0 1.5px var(--surface)', transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 2,
          }} />
        ))}
        {hover !== null && (
          <>
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${hx}%`, borderLeft: '1px solid var(--text-4)' }} />
            <div style={{ position: 'absolute', left: `${hx}%`, top: `${Y(values[hover])}%`, width: 9, height: 9, borderRadius: '50%', background: color, boxShadow: '0 0 0 2.5px var(--surface)', transform: 'translate(-50%,-50%)' }} />
            <div style={{
              position: 'absolute', top: -6, left: `${hx}%`, transform: `translate(${hx > 70 ? '-100%' : hx < 30 ? '0' : '-50%'},-100%)`,
              background: 'var(--text)', color: 'var(--bg)', borderRadius: 8, padding: '5px 8px', fontSize: 12, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 3, ...num,
            }}>
              <span style={{ opacity: 0.7 }}>{dates[hover]}</span> · <b>{formatValue(values[hover])}</b>
              {hoverMarks.slice(0, 3).map((m, i) => <div key={i} style={{ marginTop: 2 }}>{m.label}</div>)}
              {hoverMarks.length > 3 && <div style={{ marginTop: 2, opacity: 0.7 }}>+{hoverMarks.length - 3} more</div>}
            </div>
          </>
        )}
        <div onPointerDown={pick} onPointerMove={pick} style={{ position: 'absolute', inset: 0, touchAction: 'pan-y', zIndex: 2 }} />
      </div>
      <div style={{ position: 'relative', height: 18, marginTop: 6 }}>
        {xIdx.map((i, k) => (
          <span key={k} style={{ position: 'absolute', left: `${X(i)}%`, transform: `translateX(${k === 0 ? '0' : k === 3 ? '-100%' : '-50%'})`, fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
            {(axisDates ?? dates)[i]}
          </span>
        ))}
      </div>
    </div>
  )
}

export function ChartTitle({ label, change, period = 'in 30 days' }: { label: string; change: number; period?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={sectionLabel}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: TONE[dirOf(change)].ink, ...num }}>{signedPct(change)} {period}</span>
    </div>
  )
}

// ── Add panel: inline on desktop, a bottom sheet on phones ───────────────────

export function AddPanel({ title, query, onQuery, onKeyDown, placeholder, searching, hint, onClose, children }: {
  title: string
  query: string
  onQuery: (q: string) => void
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
  placeholder: string
  searching: boolean
  hint: string
  onClose: () => void
  children?: ReactNode
}) {
  return (
    <>
      <div onClick={onClose} style={{ display: 'var(--phoneB)', position: 'fixed', inset: 0, background: 'var(--scrim)', zIndex: 109 }} />
      <div className="mkt-sheet" role="dialog" aria-label={title} style={{
        position: 'var(--sheetPos)' as CSSProperties['position'], left: 0, right: 0, bottom: 0, zIndex: 110,
        margin: 'var(--panelM)', borderRadius: 'var(--panelR)', background: 'var(--panelBg)', padding: 'var(--panelPad)',
        boxShadow: 'var(--panelSh)', maxHeight: 'var(--sheetMaxH)', overflowY: 'auto',
      }}>
        <div style={{ display: 'var(--phoneB)', width: 40, height: 4, borderRadius: 2, background: 'var(--surface-3)', margin: '0 auto 14px' }} />
        <div style={{ display: 'var(--phoneF)', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ flex: 1, fontSize: 18, fontWeight: 650, letterSpacing: '-0.02em' }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={{ width: 40, height: 40, borderRadius: 12, border: 0, background: 'var(--surface-2)', color: 'var(--text-2)', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}>
            <Svg d={PATH.x} size={18} />
          </button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 44, padding: '0 12px', borderRadius: 12, background: 'var(--surface)', border: '1.5px solid var(--brand)', boxShadow: '0 0 0 4px var(--brand-soft)' }}>
          <Svg size={17} style={{ color: 'var(--text-3)', flex: 'none' }}><circle cx="11" cy="11" r="8" /><path d={PATH.search} /></Svg>
          <input value={query} onChange={e => onQuery(e.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} autoFocus
            style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', font: 'inherit', fontSize: 14.5, color: 'var(--text)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{searching ? 'Searching…' : ''}</span>
        </label>
        {children}
        <div style={{ fontSize: 12, color: 'var(--text-3)', margin: '10px 2px 0' }}>{hint}</div>
      </div>
    </>
  )
}

export function ResultRow({ title, meta, badge, onList, isTop, onAdd }: {
  title: string
  meta: string
  badge?: string
  onList: boolean
  isTop: boolean
  onAdd: () => void
}) {
  return (
    <div role="button" tabIndex={0} onClick={() => { if (!onList) onAdd() }} onKeyDown={e => { if (e.key === 'Enter' && !onList) onAdd() }}
      className="mkt-res" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, cursor: onList ? 'default' : 'pointer', opacity: onList ? 0.5 : 1 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, ...clip }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: "'Geist Mono', monospace", marginTop: 1 }}>{meta}</div>
      </div>
      {badge && <span style={{ font: "500 10.5px/1 'Geist Mono', monospace", padding: '4px 6px', borderRadius: 5, background: 'var(--surface-3)', color: 'var(--text-2)' }}>{badge}</span>}
      <span style={{ fontSize: 12, fontWeight: 600, color: onList ? 'var(--text-3)' : 'var(--brand-ink)', width: 52, textAlign: 'right' }}>
        {onList ? 'On list' : isTop ? '↵ Add' : ''}
      </span>
    </div>
  )
}

export const resultList: CSSProperties = { display: 'flex', flexDirection: 'column', marginTop: 8 }
export const noneText: CSSProperties = { padding: '14px 4px 4px', fontSize: 13.5, color: 'var(--text-2)' }
