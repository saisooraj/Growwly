'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { AssetKind } from '@/types'
import { useMediaQuery } from '@/components/overview/ui'
import { usePrivacy } from '@/store/privacyStore'

// Shared pieces of the Net Worth page: one asset palette, ₹ formatting, cards, sheets.

// ── One asset palette ─────────────────────────────────────────────────────────
// Every class shares oklch(0.70 0.12 hue) and differs by hue only, the same in light and dark.

export const KIND_ORDER: AssetKind[] = ['mutual_fund', 'stocks', 'gold_grams', 'epf', 'ppf', 'nps', 'epf_ppf', 'fd_rd', 'post_office', 'cash', 'real_estate', 'vehicle', 'other']

export const KIND_LABEL: Record<AssetKind, string> = {
  mutual_fund: 'Mutual Funds', stocks: 'Stocks & ETFs', gold_grams: 'Gold', epf: 'EPF', ppf: 'PPF', nps: 'NPS',
  epf_ppf: 'EPF/PPF (legacy)', fd_rd: 'FD/RD', post_office: 'Post Office', cash: 'Cash & Savings',
  real_estate: 'Real Estate', vehicle: 'Vehicle', other: 'Other',
}

const KIND_HUE: Record<AssetKind, number | null> = {
  mutual_fund: 262, stocks: 305, gold_grams: 80, epf: 182, ppf: 140, nps: 228, epf_ppf: 205,
  fd_rd: 28, post_office: 352, cash: 112, real_estate: 52, vehicle: 245, other: null,
}

export const kindColor = (k: AssetKind) => KIND_HUE[k] == null ? 'oklch(0.7 0.012 90)' : `oklch(0.7 0.12 ${KIND_HUE[k]})`
// Monogram tiles: 26% of the class colour mixed into the surface
export const kindTint = (k: AssetKind) => `color-mix(in oklch, ${kindColor(k)} 26%, var(--surface))`

// ── ₹ formatting ──────────────────────────────────────────────────────────────

const INR = (n: number) => Math.round(Math.abs(n)).toLocaleString('en-IN')
/** ₹1,24,500; `signed` adds + to positive amounts. Negative always shows −. */
export const rs = (n: number, signed = false) => (n < 0 ? '−' : signed && n > 0 ? '+' : '') + '₹' + INR(n)
/** +3.1% / −0.9% */
export const pc = (n: number, signed = true) => (n < 0 ? '−' : signed && n > 0 ? '+' : '') + Math.abs(n).toFixed(1) + '%'
/** ₹45.3L / ₹1.2Cr */
export function cpt(n: number): string {
  const a = Math.abs(n), s = n < 0 ? '−' : ''
  if (a >= 1e7) return s + '₹' + (a / 1e7).toFixed(2).replace(/\.?0+$/, '') + 'Cr'
  if (a >= 1e5) return s + '₹' + (a / 1e5).toFixed(1).replace(/\.0$/, '') + 'L'
  return s + '₹' + INR(a)
}
/** Masks a ₹ string when amounts are hidden; `short` for the compact mask. */
export const maskWith = (masked: boolean) => (str: string, short = true) => masked ? (short ? '₹ •••' : '₹ ••••••') : str

/** Two-letter tile: initials of the first two words, or the first two letters. */
export function monogram(name: string): string {
  const words = name.split(/[\s\-–—·/&,.()]+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return (words[0] ?? '?').slice(0, 2).toUpperCase()
}

// ── Building blocks ───────────────────────────────────────────────────────────

export const CARD: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 22, boxShadow: 'var(--elev)',
}
export const EYEBROW: CSSProperties = {
  fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 10.5, letterSpacing: '.12em', color: 'var(--text-3)',
}
export const PILL_BTN: CSSProperties = {
  height: 34, padding: '0 13px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface-2)',
  color: 'var(--text)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flex: 'none',
}
export const BRAND_BTN: CSSProperties = {
  height: 34, padding: '0 14px', borderRadius: 999, border: 'none', background: 'var(--brand)',
  color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flex: 'none',
}

/** A tappable row that may hold its own buttons (so it can't be a <button>). */
export function Tap({ onClick, style, children, label }: { onClick: () => void; style?: CSSProperties; children: ReactNode; label?: string }) {
  return (
    <div
      role="button" tabIndex={0} aria-label={label} onClick={onClick}
      onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick() } }}
      style={{ cursor: 'pointer', ...style }}
    >
      {children}
    </div>
  )
}

export function Chevron({ open }: { open: boolean }) {
  return <span aria-hidden style={{ fontSize: 20, color: 'var(--text-4)', transform: `rotate(${open ? 90 : 0}deg)`, transition: 'transform .25s', width: 12, textAlign: 'center', flex: 'none', lineHeight: 1 }}>›</span>
}

/** "What I own" with an optional figure on the right. */
export function ZoneHead({ title, right, order, deskOnly }: { title: string; right?: string; order: number; deskOnly?: boolean }) {
  return (
    <div className={deskOnly ? 'nw-desk' : undefined} style={{ order, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, padding: '8px 4px 0' }}>
      <h2 className="nw-serif" style={{ margin: 0, fontSize: 28, fontWeight: 400, letterSpacing: '-.01em', lineHeight: 1 }}>{title}</h2>
      {right && <span className="nw-num" style={{ fontSize: 13, color: 'var(--text-3)' }}>{right}</span>}
    </div>
  )
}

/** Radio dot: a thick brand ring when chosen. */
export function Ring({ on }: { on: boolean }) {
  return <span aria-hidden style={{ width: 18, height: 18, flex: 'none', borderRadius: '50%', border: on ? '5.5px solid var(--brand)' : '1.8px solid var(--text-4)', boxSizing: 'border-box' }} />
}

export function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick}
      style={{ width: 40, height: 24, flex: 'none', borderRadius: 12, border: 'none', padding: 0, background: on ? 'var(--brand)' : 'var(--surface-3)', position: 'relative', cursor: 'pointer', transition: 'background .2s' }}
    >
      <span style={{ position: 'absolute', top: 3, left: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transform: `translateX(${on ? 16 : 0}px)`, transition: 'transform .22s' }} />
    </button>
  )
}

export function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--surface-2)', minWidth: 0 }}>
      <div className="nw-mono" style={{ fontSize: 9.5, letterSpacing: '.1em', color: 'var(--text-3)', textTransform: 'uppercase' }}>{k}</div>
      <div className="nw-num" style={{ fontSize: 14, fontWeight: 600, marginTop: 3, overflowWrap: 'anywhere' }}>{v}</div>
    </div>
  )
}

/** Page-level privacy switch: the same setting as the Overview, remembered per device. */
export function PrivacySwitch() {
  const masked = usePrivacy(s => s.masked)
  const toggle = usePrivacy(s => s.toggle)
  return (
    <button
      onClick={toggle} role="switch" aria-checked={!masked} aria-label={masked ? 'Show amounts' : 'Hide amounts'}
      style={{ display: 'flex', alignItems: 'center', gap: 9, height: 36, padding: '0 5px 0 13px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flex: 'none' }}
    >
      <span aria-hidden style={{ position: 'relative', width: 15, height: 10, border: '1.6px solid currentColor', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />
        {masked && <span style={{ position: 'absolute', width: 21, height: 1.6, background: 'currentColor', transform: 'rotate(-35deg)' }} />}
      </span>
      <span>{masked ? 'Hidden' : 'Shown'}</span>
      <span aria-hidden style={{ width: 36, height: 24, borderRadius: 12, background: masked ? 'var(--surface-3)' : 'var(--brand)', position: 'relative', transition: 'background .2s' }}>
        <span style={{ position: 'absolute', top: 3, left: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transform: `translateX(${masked ? 0 : 12}px)`, transition: 'transform .22s cubic-bezier(.3,.7,.2,1)' }} />
      </span>
    </button>
  )
}

// ── Sheet: bottom sheet on phones, centred dialog from 1024 ───────────────────

export function Sheet({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  const desktop = useMediaQuery('(min-width: 1024px)')
  const close = useRef(onClose)
  close.current = onClose
  const [drag, setDrag] = useState(0)
  const start = useRef<number | null>(null)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  // Swipe down on the handle to close
  const handle = {
    onPointerDown: (e: React.PointerEvent) => { start.current = e.clientY; (e.target as Element).setPointerCapture?.(e.pointerId) },
    onPointerMove: (e: React.PointerEvent) => { if (start.current != null) setDrag(Math.max(0, e.clientY - start.current)) },
    onPointerUp: () => { if (drag > 90) close.current(); start.current = null; setDrag(0) },
    onPointerCancel: () => { start.current = null; setDrag(0) },
  }

  // Rendered on <body> so the page's entrance animation can't pin it to the page column
  return createPortal(
    <div
      className="nw-scope nw-fade" role="dialog" aria-modal="true" aria-label={label}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200, background: 'var(--scrim)', display: 'flex', justifyContent: 'center', boxSizing: 'border-box',
        alignItems: desktop ? 'center' : 'flex-end', padding: desktop ? 40 : 0,
      }}
    >
      <div
        className={desktop ? 'nw-sheet-pop' : 'nw-sheet-up'}
        style={{
          width: '100%', maxWidth: desktop ? 540 : '100%', maxHeight: desktop ? '100%' : '90%', overflowY: 'auto', overscrollBehavior: 'contain',
          background: 'var(--surface)', color: 'var(--text)', borderRadius: desktop ? 24 : '28px 28px 0 0', boxShadow: 'var(--elev-lg)',
          padding: desktop ? '10px 20px 24px' : '10px 20px max(24px, calc(env(safe-area-inset-bottom, 0px) + 16px))',
          boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16,
          transform: drag ? `translateY(${drag}px)` : undefined, transition: drag ? 'none' : 'transform .2s',
        }}
      >
        {!desktop && (
          <div {...handle} style={{ display: 'flex', justifyContent: 'center', padding: '0 0 2px', margin: '-10px -20px 0', paddingTop: 10, touchAction: 'none', cursor: 'grab' }}>
            <span style={{ width: 38, height: 5, borderRadius: 3, background: 'var(--surface-3)' }} />
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Close"
      style={{ width: 34, height: 34, flex: 'none', borderRadius: '50%', border: 'none', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'var(--text-2)', cursor: 'pointer', padding: 0 }}>
      ×
    </button>
  )
}

/** "Add a holding" + subtitle + close. */
export function SheetTitle({ title, sub, onClose }: { title: string; sub?: ReactNode; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, paddingTop: 6 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.02em' }}>{title}</div>
        {sub && <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{sub}</div>}
      </div>
      <CloseBtn onClick={onClose} />
    </div>
  )
}

/** Big tile + name + subline + close, for the detail sheets. */
export function SheetHead({ mono, tint, ink, name, sub, onClose }: { mono: string; tint: string; ink?: string; name: string; sub: ReactNode; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 6 }}>
      <span className="nw-mono" style={{ width: 46, height: 46, flex: 'none', borderRadius: 14, background: tint, color: ink ?? 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{mono}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.3, textWrap: 'pretty' } as CSSProperties}>{name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>{sub}</div>
      </div>
      <CloseBtn onClick={onClose} />
    </div>
  )
}

/** Cancel + primary, 1:2. */
export function SheetActions({ onCancel, cancel = 'Cancel', primary, onPrimary, disabled, danger, submit, ratio = 2 }: {
  onCancel: () => void; cancel?: string; primary: string; onPrimary?: () => void; disabled?: boolean; danger?: boolean; submit?: boolean; ratio?: number
}) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button type="button" onClick={onCancel} style={{ flex: 1, height: 46, borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{cancel}</button>
      <button
        type={submit ? 'submit' : 'button'} onClick={onPrimary} disabled={disabled}
        style={{ flex: ratio, height: 46, borderRadius: 999, border: 'none', background: danger ? 'var(--bad)' : 'var(--brand)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }}
      >{primary}</button>
    </div>
  )
}

/** A row in a sheet's action list. */
export function ActionRow({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: 50, padding: 0, border: 'none', borderTop: '1px solid var(--border)', background: 'transparent', fontSize: 14, fontWeight: 600, color: danger ? 'var(--bad-ink)' : 'var(--text)', cursor: 'pointer', textAlign: 'left' }}>
      <span>{label}</span><span aria-hidden style={{ color: 'var(--text-4)', fontSize: 18 }}>›</span>
    </button>
  )
}

/** Mono label above a field. */
export function Field({ label, children, style }: { label: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, ...style }}>
      <span className="nw-label">{label}</span>
      {children}
    </label>
  )
}

/** Choice chip (kind / type pickers). */
export function Chip({ on, label, dot, onClick }: { on: boolean; label: string; dot?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      style={{ height: 37, padding: dot ? '0 12px' : '0 13px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${on ? 'var(--brand)' : 'var(--border)'}`, background: on ? 'var(--brand-soft)' : 'var(--surface)', color: on ? 'var(--brand-ink)' : 'var(--text-2)' }}>
      {dot && <span style={{ width: 8, height: 8, borderRadius: 2, background: dot }} />}
      {label}
    </button>
  )
}
