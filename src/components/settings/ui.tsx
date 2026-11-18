'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// Building blocks for the Settings page. Colours come from the scoped tokens on `.set`
// in globals.css (--sf, --sf2, --ink, --mut, --line, --acc…).

/** Material Symbols Rounded glyph by ligature name (add new names to the subset in globals.css) */
export function Sym({ name, size = 20, fill = false, style }: { name: string; size?: number; fill?: boolean; style?: CSSProperties }) {
  return (
    <span aria-hidden className="ms" style={{ fontSize: size, fontVariationSettings: fill ? "'FILL' 1" : "'FILL' 0", ...style }}>
      {name}
    </span>
  )
}

/** Two-pane desktop layout from 1024px, the same breakpoint as the app shell */
export function useIsDesktop() {
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const on = () => setDesktop(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return desktop
}
// The AI hub exists only from `next dev` with the local AI on. Written out (as in AppShell) so a
// production build sees a constant `false` and drops every branch guarded by it.
export const LOCAL_AI = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_AI_LOCAL === '1'

export const MONO = "'Geist Mono', ui-monospace, monospace"
export const SERIF = "'Instrument Serif', serif"

export const inr = (v: number) => `₹${Number(v).toLocaleString('en-IN')}`
export const digits = (v: string) => v.replace(/\D/g, '')

/** A quiet "Saved" chip after a change lands: `flash('budget')`, then `saved === 'budget'` for 1.8s */
export function useSavedFlash(): [string | null, (key: string) => void] {
  const [saved, setSaved] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])
  const flash = useCallback((key: string) => {
    setSaved(key)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setSaved(s => (s === key ? null : s)), 1800)
  }, [])
  return [saved, flash]
}

export function SavedChip({ label = 'Saved', small }: { label?: string; small?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, height: small ? 22 : 24, padding: small ? '0 8px' : '0 9px',
      borderRadius: 999, background: 'var(--good-bg)', color: 'var(--good)', fontSize: small ? 11.5 : 12, fontWeight: 500,
    }}>
      <Sym name="check" size={small ? 14 : 15} />{label}
    </span>
  )
}

export const card: CSSProperties = {
  background: 'var(--sf)', border: '1px solid var(--line)', borderRadius: 24, boxShadow: 'var(--shadow)', overflow: 'hidden',
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ ...card, ...style }}>{children}</div>
}

/** Card title row: title, Saved chip, then whatever sits on the right */
export function CardHead({ title, saved, right, pad = '22px 24px 0' }: { title: string; saved?: boolean; right?: ReactNode; pad?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: pad }}>
      <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>{title}</div>
      {saved && <SavedChip />}
      <div style={{ flex: 1 }} />
      {right}
    </div>
  )
}

export const hint: CSSProperties = { fontSize: 13, color: 'var(--mut)' }
export const sub: CSSProperties = { fontSize: 13.5, lineHeight: 1.45, color: 'var(--mut)', marginTop: 2 }
export const rowTitle: CSSProperties = { fontSize: 15, fontWeight: 500, lineHeight: 1.3 }

export function SectionHead({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', padding: '0 4px' }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.015em' }}>{title}</h2>
      <span style={{ fontSize: 14, lineHeight: 1.4, color: 'var(--mut)' }}>{desc}</span>
    </div>
  )
}

/** 40px icon tile: accent-tinted, or plain on the second surface */
export function IconTile({ name, accent, size = 40, glyph = 22, radius = 12 }: { name: string; accent?: boolean; size?: number; glyph?: number; radius?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flex: 'none', display: 'grid', placeItems: 'center',
      ...(accent ? { background: 'var(--acc-soft)', color: 'var(--acc-txt)' } : { background: 'var(--sf2)', border: '1px solid var(--line)' }),
    }}>
      <Sym name={name} size={glyph} />
    </div>
  )
}

// ── Buttons ─────────────────────────────────────────────────────────────────

const btnBase: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none' }

/** Hairline button on the surface (Edit, Cancel, Change password…) */
export const btnOutline = (h = 34, r = 10, fs = 13.5): CSSProperties => ({
  ...btnBase, height: h, padding: '0 12px', border: '1px solid var(--line2)', borderRadius: r, background: 'var(--sf)', color: 'var(--ink)', fontSize: fs,
})
/** Accent fill; greys out when disabled, as the design's Add / Save layout / Send do */
export const btnPrimary = (on = true, h = 38): CSSProperties => ({
  ...btnBase, height: h, padding: '0 16px', border: 0, borderRadius: 12, fontSize: 14,
  background: on ? 'var(--acc)' : 'var(--line)', color: on ? 'var(--on-acc)' : 'var(--mut)',
})
/** Red text, no box (Remove, Delete account…) */
export const btnGhostBad = (h = 34, fs = 13.5): CSSProperties => ({
  ...btnBase, height: h, padding: '0 10px', border: 0, borderRadius: 10, background: 'transparent', color: 'var(--bad)', fontSize: fs,
})
/** Red text on the surface with a tinted hairline (Sign out, Revoke) */
export const btnBad = (h = 38, r = 12, fs = 14): CSSProperties => ({
  ...btnBase, height: h, padding: '0 14px', border: '1px solid color-mix(in oklch, var(--bad) 35%, transparent)', borderRadius: r, background: 'var(--sf)', color: 'var(--bad)', fontSize: fs,
})
/** Small square icon button (rename, delete, edit cycle) */
export const btnIcon = (s = 34, r = 10): CSSProperties => ({
  width: s, height: s, borderRadius: r, border: '1px solid var(--line)', background: 'var(--sf)', color: 'var(--mut)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none',
})

/** Footer strip on the second surface with right-aligned actions */
export function CardFoot({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '14px 24px', borderTop: '1px solid var(--line)', background: 'var(--sf2)', ...style }}>
      {children}
    </div>
  )
}

// ── Controls ────────────────────────────────────────────────────────────────

export function Switch({ on, onClick, disabled, busy, label }: { on: boolean; onClick: () => void; disabled?: boolean; busy?: boolean; label: string }) {
  const track = on ? 'var(--acc)' : busy ? 'color-mix(in oklch, var(--acc) 45%, transparent)' : 'var(--line2)'
  return (
    <button
      role="switch" aria-checked={on} aria-label={label} onClick={onClick} disabled={disabled}
      style={{ width: 46, height: 28, borderRadius: 14, border: 0, padding: 3, background: track, cursor: disabled ? 'default' : 'pointer', flex: 'none', transition: 'background .2s' }}
    >
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transform: `translateX(${on || busy ? 18 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )
}

export function Segmented<T extends string>({ options, value, onPick, label }: {
  options: { id: T; label: string; icon?: string; trail?: string }[]; value: T; onPick: (id: T) => void; label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 12, background: 'color-mix(in oklch, var(--ink) 6%, transparent)' }}>
      {options.map(o => {
        const sel = o.id === value
        return (
          <button
            key={o.id} role="radio" aria-checked={sel} onClick={() => onPick(o.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', border: 0, borderRadius: 9,
              background: sel ? 'var(--sf)' : 'transparent', color: sel ? 'var(--ink)' : 'var(--mut)',
              boxShadow: sel ? '0 1px 3px rgba(20,21,26,.14)' : 'none', fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
            }}
          >
            {o.icon && <Sym name={o.icon} size={17} />}{o.label}
            {o.trail && <span style={{ fontFamily: MONO, fontSize: 12.5 }}>{o.trail}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Tinted inline note: blocked push, unsupported browser, a blocked delete, a bad import */
export function Note({ tone, icon, children, style }: { tone: 'bad' | 'info' | 'warn'; icon: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 14, background: `var(--${tone}-bg)`, color: `var(--${tone})`, fontSize: 13.5, lineHeight: 1.5, ...style }}>
      <Sym name={icon} size={18} style={{ marginTop: 1 }} /><div>{children}</div>
    </div>
  )
}

/** Accent-ringed text input */
export const field = (h = 46): CSSProperties => ({
  height: h, padding: '0 12px', borderRadius: 12, background: 'var(--sf)', color: 'var(--ink)', fontSize: 14, outline: 0, boxSizing: 'border-box',
})

// ── Dialog: centred on desktop, a bottom sheet on phones ────────────────────

export function Modal({ open, onClose, label, width = 420, children, closable = true }: {
  open: boolean; onClose: () => void; label: string; width?: number; children: ReactNode; closable?: boolean
}) {
  const desktop = useIsDesktop()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && closable) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, closable])
  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div className="set" style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: desktop ? 'center' : 'flex-end', justifyContent: 'center', padding: desktop ? 20 : 0 }}>
      <div className="txn-anim-fade" onClick={() => closable && onClose()} style={{ position: 'absolute', inset: 0, background: 'rgba(5,6,8,.5)' }} />
      <div
        role="dialog" aria-modal="true" aria-label={label} className={desktop ? 'txn-anim-pop' : 'txn-anim-sheet'}
        style={{
          position: 'relative', width: '100%', maxWidth: desktop ? width : 'none', maxHeight: '92dvh', overflowY: 'auto', boxSizing: 'border-box',
          background: 'var(--sf)', color: 'var(--ink)', borderRadius: desktop ? 28 : '28px 28px 0 0',
          padding: desktop ? '18px 22px 26px' : '10px 22px calc(34px + env(safe-area-inset-bottom, 0px))',
          boxShadow: desktop ? '0 30px 80px -30px rgba(0,0,0,.5)' : '0 -20px 40px -20px rgba(0,0,0,.5)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        }}
      >
        {!desktop && <div style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--line2)', flex: 'none' }} />}
        <button
          onClick={onClose} disabled={!closable} aria-label="Close"
          style={{ alignSelf: 'flex-end', width: 32, height: 32, borderRadius: '50%', border: 0, background: 'var(--sf2)', color: 'var(--mut)', display: 'grid', placeItems: 'center', cursor: 'pointer', marginTop: desktop ? 0 : -6, opacity: closable ? 1 : 0.4, flex: 'none' }}
        >
          <Sym name="close" size={18} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  )
}
