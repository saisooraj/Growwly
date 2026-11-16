'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePrivacy } from '@/store/privacyStore'
import { useCountUp } from '@/hooks/useCountUp'
import { getLast6Months } from '@/lib/utils'

export const MASK = '₹ ••••'

// Whole rupees with Indian grouping and a real minus sign: −₹1,23,456 (+₹ when `sign`)
export function inr(n: number, sign = false): string {
  if (!Number.isFinite(n)) n = 0
  const r = Math.round(n)
  const body = '₹' + Math.abs(r).toLocaleString('en-IN')
  return r < 0 ? '−' + body : sign && r > 0 ? '+' + body : body
}

export function pct(n: number, dp = 0): string {
  if (!Number.isFinite(n)) n = 0
  const s = Math.abs(n).toFixed(dp)
  return (n < 0 && Number(s) !== 0 ? '−' : '') + s + '%'
}

// Masks ₹ text when privacy is on. Scores, percentages and shapes are never masked.
export function useMask() {
  const masked = usePrivacy(s => s.masked)
  const M = useCallback((s: string) => (masked ? MASK : s), [masked])
  return { masked, M }
}

// A ₹ figure. While masked, a long press peeks at it for 3 s.
export function Amt({ value, sign, countUp, style, className }: {
  value: number; sign?: boolean; countUp?: boolean; style?: React.CSSProperties; className?: string
}) {
  const masked = usePrivacy(s => s.masked)
  const [peek, setPeek] = useState(false)
  const press = useRef<ReturnType<typeof setTimeout>>()
  const hide = useRef<ReturnType<typeof setTimeout>>()
  const animated = useCountUp(Math.round(Math.abs(value)), 600)
  useEffect(() => () => { clearTimeout(press.current); clearTimeout(hide.current) }, [])

  const shown = !masked || peek
  const n = countUp && shown ? Math.sign(value) * animated : value
  function down() {
    if (!masked) return
    press.current = setTimeout(() => {
      setPeek(true)
      clearTimeout(hide.current)
      hide.current = setTimeout(() => setPeek(false), 3000)
    }, 450)
  }
  const up = () => clearTimeout(press.current)
  return (
    <span
      className={className}
      style={{ ...style, ...(masked ? { WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } : {}) }}
      onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up}
      onContextMenu={masked ? e => e.preventDefault() : undefined}
    >
      {shown ? inr(n, sign) : MASK}
    </span>
  )
}

// The 6 months ending at the selected one. getLast6Months() also holds next month (so the
// switcher can step into the coming cycle), which charts shouldn't show as an empty bar.
export function sixMonthsTo(selected: string): string[] {
  const all = getLast6Months()
  const i = all.indexOf(selected)
  return i < 0 ? all.slice(-6) : all.slice(Math.max(0, i - 5), i + 1)
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatch(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

// Phone vs desktop behaviour (row counts, Claude toggle, side-by-side charts)
export const useIsDesk = () => useMediaQuery('(min-width: 1024px)')

export type Tone = 'good' | 'warn' | 'bad' | 'info'
export const tone = (t: Tone) => ({ background: `var(--${t}-soft)`, color: `var(--${t}-ink)` })

export function Pill({ t, children, style }: { t: Tone | 'neutral'; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
      ...(t === 'neutral' ? { background: 'var(--surface2)', color: 'var(--ink2)' } : tone(t)),
      ...style,
    }}>{children}</span>
  )
}

// Progress ring; grows from 0 on mount
export function Ring({ size, r, stroke, pct: p, color, track, children }: {
  size: number; r: number; stroke: number; pct: number; color: string; track: string; children?: React.ReactNode
}) {
  const c = 2 * Math.PI * r
  const target = (c * Math.max(0, Math.min(p, 100))) / 100
  const [len, setLen] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setLen(target), 60)
    return () => clearTimeout(t)
  }, [target])
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${len.toFixed(1)} ${c.toFixed(1)}`}
          style={{ transition: 'stroke-dasharray 600ms var(--ease-out)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
    </div>
  )
}

// Segmented control used by Today, Needs attention and Trends
export function Seg<T extends string>({ value, options, onChange, size = 'sm', label }: {
  value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; size?: 'sm' | 'md'; label: string
}) {
  const md = size === 'md'
  return (
    <div role="tablist" aria-label={label} style={{
      display: 'flex', padding: 3, borderRadius: md ? 12 : 10, background: 'var(--surface2)',
      fontSize: md ? 12.5 : 11.5, fontWeight: 700, flex: 'none',
    }}>
      {options.map(o => {
        const on = o.id === value
        return (
          <button
            key={o.id} role="tab" aria-selected={on} onClick={() => onChange(o.id)} className="ov-btn"
            style={{
              padding: md ? '6px 12px' : on ? '4px 9px' : '4px 8px',
              borderRadius: md ? 9 : 8, fontSize: 'inherit', fontWeight: 'inherit',
              background: on ? 'var(--surface)' : 'transparent',
              boxShadow: on ? 'var(--shadow)' : 'none',
              color: on ? 'var(--ink)' : 'var(--ink2)',
              transition: 'background .15s, color .15s',
            }}
          >{o.label}</button>
        )
      })}
    </div>
  )
}

// Actions cards trigger on things the page owns (sheets, modals, other cards)
export interface OverviewActions {
  openAdd: () => void
  openDetails: (focus?: 'cash') => void
  openRecap: () => void
  openRecurring: () => void
  openPay: (upcomingId: string) => void
  restoreStreak: () => void
  setupEmergency: () => void
  /** Bumps when a modal closes, so rows that read its outcome (skip, seen) refresh */
  tick: number
}
export const OverviewCtx = createContext<OverviewActions | null>(null)
export function useOverviewActions(): OverviewActions {
  const a = useContext(OverviewCtx)
  if (!a) throw new Error('useOverviewActions outside the Overview')
  return a
}

export function scrollToBlock(id: string) {
  document.getElementById(`ov-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
