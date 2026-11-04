'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import type { ScenarioKey } from '@/lib/fire'
import type { ValueSource } from '@/lib/fireInputs'

export const MASK = '₹ •••'
export const MONO = "'Geist Mono', ui-monospace, monospace"

/** ₹ in lakhs / crores: ₹5.49 Cr, ₹18.2 L, ₹4.35 L, ₹48,808. */
export function fmtShort(v: number | null | undefined, masked = false): string {
  if (v == null || !Number.isFinite(v)) return '—'
  if (masked) return MASK
  const sign = v < 0 ? '−' : ''
  const a = Math.abs(v)
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(a >= 1e9 ? 0 : 2)} Cr`
  if (a >= 1e5) { const l = a / 1e5; return `${sign}₹${l.toFixed(l >= 10 ? 1 : 2)} L` }
  return `${sign}₹${Math.round(a).toLocaleString('en-IN')}`
}

/** Full ₹ with Indian grouping, rounded to the rupee. */
export function fmtFull(v: number | null | undefined, masked = false): string {
  if (v == null || !Number.isFinite(v)) return '—'
  if (masked) return MASK
  return `${v < 0 ? '−' : ''}₹${Math.round(Math.abs(v)).toLocaleString('en-IN')}`
}

/** Chart axis: ₹2 Cr, ₹50 L, ₹40k. */
export function fmtAxis(v: number): string {
  if (v === 0) return '0'
  if (v >= 1e7) return `₹${+(v / 1e7).toFixed(1)} Cr`
  if (v >= 1e5) return `₹${Math.round(v / 1e5)} L`
  return `₹${Math.round(v / 1000)}k`
}

export function fmtYears(years: number | null): string {
  if (years == null) return '—'
  if (years <= 0) return 'Now'
  if (years < 1) return `${Math.max(1, Math.round(years * 12))} mo`
  return `${years.toFixed(1)} yrs`
}

/** 10, 3.5, 12.25 — no trailing zeros. */
export const pct = (decimal: number) => `${+(decimal * 100).toFixed(2)}%`

export const SCENARIO_META: Record<ScenarioKey, { label: string; color: string; short: string }> = {
  conservative: { label: 'Conservative', short: 'Cons.', color: 'var(--fire-c0)' },
  moderate:     { label: 'Moderate',     short: 'Mod.',  color: 'var(--fire-c1)' },
  optimistic:   { label: 'Optimistic',   short: 'Opt.',  color: 'var(--fire-c2)' },
}

// ── Tooltip: the (i) button ───────────────────────────────────────────────────
// Desktop: hover opens it, leaving closes it, a click pins it open. Touch: a tap opens and
// pins it; a tap anywhere else, the ×, or scrolling closes it. Cards clip their content, so
// the bubble renders into <body> with fixed positioning: kept 12px inside both screen edges,
// below the icon when there's room and above it otherwise.

const TIP_GAP = 6
const TIP_MARGIN = 12

export interface TipText { title: string; body: string }

export function Tip({ tip, size = 15, label }: { tip: TipText; size?: number; label?: string }) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const canHover = typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches

  const close = () => { setOpen(false); setPinned(false) }

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    const btn = btnRef.current, bubble = bubbleRef.current
    if (!btn || !bubble) return
    const r = btn.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight
    const width = Math.min(300, vw - TIP_MARGIN * 2)
    bubble.style.width = `${width}px`
    const h = bubble.offsetHeight
    const left = Math.min(Math.max(r.left + r.width / 2 - width / 2, TIP_MARGIN), vw - width - TIP_MARGIN)
    const below = r.bottom + TIP_GAP
    const above = r.top - TIP_GAP - h
    const top = below + h <= vh - TIP_MARGIN || above < TIP_MARGIN ? Math.min(below, vh - h - TIP_MARGIN) : above
    setPos({ left, top: Math.max(TIP_MARGIN, top), width })
  }, [open, pinned])

  useEffect(() => {
    if (!open) return
    const inside = (t: EventTarget | null) => !!t && (btnRef.current?.contains(t as Node) || bubbleRef.current?.contains(t as Node))
    const onDown = (e: PointerEvent) => { if (!inside(e.target)) close() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const onMove = (e: Event) => { if (!bubbleRef.current?.contains(e.target as Node)) close() }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef} type="button" aria-label={label ?? `About ${tip.title.toLowerCase()}`} aria-expanded={open} aria-describedby={open ? id : undefined}
        onClick={e => {
          e.stopPropagation()
          if (pinned) close()
          else { setOpen(true); setPinned(true) }
        }}
        onMouseEnter={canHover ? () => { if (!pinned) setOpen(true) } : undefined}
        onMouseLeave={canHover ? () => { if (!pinned) setOpen(false) } : undefined}
        onFocus={canHover ? () => setOpen(true) : undefined}
        onBlur={canHover ? () => { if (!pinned) setOpen(false) } : undefined}
        style={{
          width: 32, height: 32, margin: '-8px -7px', flex: 'none', padding: 0, border: 'none', background: 'transparent',
          cursor: 'pointer', color: 'inherit', display: 'inline-grid', placeItems: 'center', verticalAlign: 'middle',
        }}
      >
        <span style={{
          width: size, height: size, borderRadius: '50%', border: '1.3px solid currentColor', display: 'grid', placeItems: 'center',
          font: `700 ${size * 0.63}px/1 ${MONO}`, opacity: 0.75,
        }}>i</span>
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={bubbleRef} id={id} role="tooltip" onPointerDown={e => e.stopPropagation()} style={{
          position: 'fixed', zIndex: 300, left: pos?.left ?? 0, top: pos?.top ?? 0, width: pos?.width ?? 300,
          visibility: pos ? 'visible' : 'hidden', boxSizing: 'border-box',
          padding: '12px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border-strong)',
          boxShadow: 'var(--elev-lg)', display: 'flex', flexDirection: 'column', gap: 6,
          textTransform: 'none', letterSpacing: 'normal', textAlign: 'left', whiteSpace: 'normal', fontFamily: 'inherit',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 18 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{tip.title}</span>
            {pinned && (
              <button type="button" onClick={close} aria-label="Close"
                style={{ width: 32, height: 32, margin: '-8px -8px -8px 0', border: 'none', background: 'none', color: 'var(--text-3)', fontSize: 17, cursor: 'pointer', fontFamily: 'inherit' }}>
                ×
              </button>
            )}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-2)', fontWeight: 400 }}>{tip.body}</div>
        </div>,
        document.body,
      )}
    </>
  )
}

// ── Tags: what kind of number is this? ────────────────────────────────────────
// ● Actual (from records) · ○ Projection · ◇ Assumption. Used on every section.

export type Kind = 'actual' | 'projection' | 'assumption'

export function KindMark({ kind, size = 7 }: { kind: Kind; size?: number }) {
  const base: CSSProperties = { width: size, height: size, boxSizing: 'border-box', flex: 'none', display: 'inline-block' }
  if (kind === 'actual') return <span style={{ ...base, borderRadius: '50%', background: 'currentColor' }} />
  if (kind === 'projection') return <span style={{ ...base, borderRadius: '50%', border: '1.5px solid currentColor' }} />
  return <span style={{ ...base, transform: 'rotate(45deg)', border: '1.5px solid currentColor' }} />
}

const KIND_LABEL: Record<Kind, string> = { actual: 'Actual', projection: 'Projection', assumption: 'Assumption' }

export function KindTag({ kind, color = 'var(--text-2)' }: { kind: Kind; color?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, font: `600 10px/1 ${MONO}`, letterSpacing: '.06em', textTransform: 'uppercase', color, whiteSpace: 'nowrap' }}>
      <KindMark kind={kind} />{KIND_LABEL[kind]}
    </span>
  )
}

/** Today's ₹ is a filled chip; future ₹ is dashed, like the rising dashed target line. */
export function MoneyTag({ future, text, onDark }: { future?: boolean; text?: string; onDark?: boolean }) {
  const label = text ?? (future ? 'Future ₹' : 'Today’s ₹')
  const style: CSSProperties = {
    font: `600 10px/1 ${MONO}`, letterSpacing: '.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', borderRadius: 6,
    color: onDark ? '#fff' : 'var(--text-2)',
  }
  return future
    ? <span style={{ ...style, border: `1px dashed ${onDark ? 'rgba(255,255,255,.7)' : 'var(--border-strong)'}`, padding: '3px 6px' }}>{label}</span>
    : <span style={{ ...style, background: onDark ? 'rgba(255,255,255,.2)' : 'var(--surface-2)', padding: '4px 6px' }}>{label}</span>
}

// ── Where a value came from ───────────────────────────────────────────────────

const SOURCE_META: Record<ValueSource, { label: string; bg: string; ink: string; dashed?: boolean }> = {
  calculated: { label: 'Calculated', bg: 'var(--brand-soft)', ink: 'var(--brand-ink)' },
  records:    { label: 'From your records', bg: 'var(--surface-2)', ink: 'var(--text-2)' },
  manual:     { label: 'Entered by you', bg: 'var(--info-soft)', ink: 'var(--info-ink)' },
  assumed:    { label: 'Assumed', bg: 'var(--surface-2)', ink: 'var(--text-3)' },
  missing:    { label: 'No data yet', bg: 'transparent', ink: 'var(--text-2)', dashed: true },
}

export function SourceBadge({ source }: { source: ValueSource }) {
  const m = SOURCE_META[source]
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: m.bg, color: m.ink, whiteSpace: 'nowrap',
      border: `1px dashed ${m.dashed ? 'var(--border-strong)' : 'transparent'}`,
    }}>
      {m.label}
    </span>
  )
}

// ── Layout bits ───────────────────────────────────────────────────────────────

export const CARD: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16 }

export function SectionHead({ title, kind, tip, right }: { title: string; kind?: Kind; tip?: TipText; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px 12px', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: '-0.015em', color: 'var(--text)' }}>{title}</h2>
        {tip && <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}><Tip tip={tip} /></span>}
        {kind && <KindTag kind={kind} />}
      </div>
      {right}
    </div>
  )
}

export function Collapsible({ title, sub, tag, open, onToggle, children, id }: {
  title: string; sub?: ReactNode; tag?: ReactNode; open: boolean; onToggle: () => void; children: ReactNode; id?: string
}) {
  return (
    <section id={id} className="card fire-anchor" style={{ padding: '4px 20px' }}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        style={{ width: '100%', minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: 0, background: 'none', cursor: 'pointer', color: 'var(--text)', padding: 0, textAlign: 'left', fontFamily: 'inherit' }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, letterSpacing: '-0.015em', flexWrap: 'wrap' }}>{title}{tag}</span>
          {sub && <span style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.35 }}>{sub}</span>}
        </span>
        <ChevronDown size={18} color="var(--text-2)" style={{ flex: 'none', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }} />
      </button>
      {open && <div style={{ borderTop: '1px solid var(--border)', padding: '16px 0 20px' }}>{children}</div>}
    </section>
  )
}

export function Switch({ on, onClick, label, disabled }: { on: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} disabled={disabled}
      style={{ width: 52, height: 40, border: 0, background: 'none', padding: 0, cursor: disabled ? 'default' : 'pointer', display: 'grid', placeItems: 'center', flex: 'none', opacity: disabled ? 0.5 : 1 }}>
      <span style={{ width: 38, height: 22, borderRadius: 999, background: on ? 'var(--brand)' : 'var(--border-strong)', display: 'flex', alignItems: 'center', padding: 2, boxSizing: 'border-box', transition: 'background .15s ease' }}>
        <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)', transform: on ? 'translateX(16px)' : 'none', transition: 'transform .15s ease' }} />
      </span>
    </button>
  )
}

/** Field box: an input with a unit on the right, 44px tall, 16px text so phones don't zoom. */
export const BOX: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4, height: 44, padding: '0 12px', borderRadius: 12,
  border: '1px solid var(--border-strong)', background: 'var(--surface)', boxSizing: 'border-box', minWidth: 0,
}
export const BOX_INPUT: CSSProperties = {
  flex: 1, width: '100%', minWidth: 0, border: 0, outline: 0, background: 'transparent', padding: 0,
  fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums',
}

/** Numeric field for percentages and ages. Keeps its own text while typing; blank → null. */
export function NumField({ value, onChange, min, max, unit, ariaLabel, placeholder, height = 44 }: {
  value: number | null | undefined
  onChange: (v: number | null) => void
  min?: number; max?: number
  unit?: string; ariaLabel: string; placeholder?: string; height?: number
}) {
  const [text, setText] = useState(value == null ? '' : String(value))
  const focused = useRef(false)
  useEffect(() => { if (!focused.current) setText(value == null ? '' : String(value)) }, [value])
  return (
    <span style={{ ...BOX, height, padding: height < 44 ? '0 8px' : BOX.padding, borderRadius: height < 44 ? 10 : 12 }}>
      <input
        type="text" inputMode="decimal" aria-label={ariaLabel} value={text} placeholder={placeholder}
        onFocus={() => { focused.current = true }}
        onBlur={() => { focused.current = false; setText(value == null ? '' : String(value)) }}
        onChange={e => {
          const t = e.target.value.replace(/[^\d.]/g, '').slice(0, 6)
          setText(t)
          if (t.trim() === '') { onChange(null); return }
          const n = Number(t)
          if (!Number.isFinite(n)) return
          onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)))
        }}
        style={BOX_INPUT}
      />
      {unit && <span style={{ color: 'var(--text-3)', fontSize: 12.5, whiteSpace: 'nowrap' }}>{unit}</span>}
    </span>
  )
}

// ── Tooltip text ──────────────────────────────────────────────────────────────

export const TIPS = {
  corpus: { title: 'FI corpus', body: 'The amount that lets you live off your investments: a year of retirement spending (plus any healthcare you add), grossed up for tax on withdrawals, divided by the withdrawal rate. At 3.5% that’s about 28.6× a year’s spending.' },
  withdrawalRate: { title: 'Withdrawal rate', body: 'The share of your corpus you take out in the first year of retirement, then raise with inflation every year. A lower rate needs a bigger corpus but is far more likely to last. The US “4% rule” was tested on 30-year US retirements; Indian early retirements can run 40–50 years, so 3–3.5% is a more cautious start.' },
  inflation: { title: 'Inflation', body: 'How fast prices rise each year. Your spending grows at this rate, which is why the FI target in future rupees keeps moving up. It’s applied once, to spending — never to returns as well.' },
  real: { title: 'Nominal vs real return', body: 'Nominal is what your statement shows. Real is what’s left after inflation — 10% nominal with 6% inflation is about 3.8% real. These are planning assumptions, not guaranteed returns.' },
  stepUp: { title: 'SIP step-up', body: 'How much you raise your monthly investment each year, usually alongside your salary hike. A 10% step-up turns ₹50,000 into ₹55,000 next year and ₹60,500 the year after. It’s applied every 12 months from now.' },
  money: { title: 'Future ₹ vs today’s ₹', body: 'Future rupees are the amounts your statements will actually show later. Today’s ₹ take inflation out, so you can compare with what things cost now. At 6% inflation, ₹1 crore in 20 years buys about what ₹31 lakh buys today.' },
  progress: { title: 'Progress', body: 'Your investable portfolio compared with the corpus you’d need if you stopped today. Both are in today’s money, so the percentage compares like with like.' },
  coast: { title: 'Coast FI', body: 'The amount you’d need invested today so that, with no new money at all, it grows into your FI corpus by your chosen retirement age. Once you’re past it, investing more only brings the date closer.' },
  tax: { title: 'Tax on withdrawals', body: 'Tax on money you take out in retirement. Only the gains part of an equity fund withdrawal is taxed (12.5% on long-term gains above ₹1.25 lakh a year under current rules), so the effective rate is usually much lower. Set what you expect; the corpus is grossed up to cover it.' },
  healthcare: { title: 'Retirement healthcare', body: 'Extra monthly cost for health cover once there’s no employer policy — for example a family floater. Premiums rise steeply with age, so it’s worth budgeting for separately from today’s spending.' },
  healthInflation: { title: 'Healthcare inflation', body: 'Medical costs in India have often risen faster than general prices. Leave it blank to use general inflation.' },
  sipNeed: { title: 'SIP needed', body: 'The starting monthly investment, raised each year by your step-up, that reaches the FI target by your chosen age in this scenario.' },
  lifestyle: { title: 'Lean, Regular and Fat FIRE', body: 'Lean FIRE plans for a smaller budget than today, Fat FIRE for a more comfortable one. Each needs a different corpus and arrives at a different age — type a monthly budget in today’s rupees to see.' },
  savings: { title: 'Savings rate', body: 'Monthly investment as a share of your income. Rates above about 60–70% are hard to keep up for many years.' },
  portfolio: { title: 'Investable portfolio', body: 'Holdings you could sell or withdraw — mutual funds, stocks, EPF, PPF, NPS and deposits — plus anything you switch on under What counts toward FI, less loans if that switch is on.' },
} satisfies Record<string, TipText>
