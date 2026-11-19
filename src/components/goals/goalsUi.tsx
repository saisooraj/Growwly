'use client'

import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconX } from '@tabler/icons-react'
import { GoalIcon } from '@/lib/categoryIcons'
import { GOAL_GLYPHS, labelOf, type TablerIcon } from './goalsModel'

export const MONO = "'Geist Mono', ui-monospace, monospace"
export const SERIF = "'Instrument Serif', Georgia, serif"
export const POP_SHADOW = '0 16px 40px rgba(0,0,0,.2)'
export const SEL_SHADOW = '0 1px 3px rgba(0,0,0,.12)'

// ── Shared page context: masked amounts, press-and-hold reveal, layout ──────────

export interface LongPress {
  onPointerDown?: () => void
  onPointerUp?: () => void
  onPointerLeave?: () => void
  onPointerCancel?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
}

export interface GoalsCtx {
  desktop: boolean
  mounted: boolean
  /** A ₹ figure, or "₹ ••••" while privacy is on and `id` isn't being held */
  m: (v: number, id: string) => string
  /** Press and hold for 500 ms shows that card's amounts for 3 s (only while masked) */
  lp: (id: string) => LongPress
  /** True once if a long press just fired, so the click that ends it doesn't open the card */
  consumeLongPress: () => boolean
}

export const Ctx = createContext<GoalsCtx | null>(null)
export function useGoals(): GoalsCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useGoals outside the Goals page')
  return c
}

/** False on the first frame, then true: lets bars, rings and confetti grow in */
export function useEntered(delay = 30): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => { const t = setTimeout(() => setOn(true), delay); return () => clearTimeout(t) }, [delay])
  return on
}

// ── Icons ───────────────────────────────────────────────────────────────────────

export function GoalGlyph({ emoji, size }: { emoji: string; size: number }) {
  const label = labelOf(emoji)
  const Icon = label ? GOAL_GLYPHS[label] : null
  if (Icon) return <Icon size={size} stroke={2} />
  return <GoalIcon emoji={emoji} size={size} stroke={2} />
}

export function Tile({ size, radius, bg, fg, children }: { size: number; radius: number; bg: string; fg: string; children: ReactNode }) {
  return <div style={{ width: size, height: size, flex: 'none', borderRadius: radius, display: 'grid', placeItems: 'center', background: bg, color: fg }}>{children}</div>
}

// ── Segmented control ───────────────────────────────────────────────────────────

export function Seg<K extends string>({ items, value, onChange, height, font, style, pad }: {
  items: { k: K; label: string; count?: number }[]; value: K; onChange: (k: K) => void
  height: number; font: string; style?: CSSProperties; pad?: string
}) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--surface2)', borderRadius: 999, ...style }}>
      {items.map(it => {
        const on = it.k === value
        return (
          <button
            key={it.k} role="tab" aria-selected={on} onClick={() => onChange(it.k)}
            style={{
              flex: 1, height, padding: pad ?? 0, border: 0, borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
              background: on ? 'var(--surface)' : 'transparent', boxShadow: on ? SEL_SHADOW : 'none',
              color: on ? 'var(--ink)' : 'var(--ink2)', font, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            {it.label}
            {it.count !== undefined && <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 12, color: 'var(--ink3)' }}>{it.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ── Menus ───────────────────────────────────────────────────────────────────────

export interface MenuItem { icon: TablerIcon; label: string; danger?: boolean; onClick: () => void }

/** Desktop popover under a card's ⋮ */
export function MenuPopover({ items, top, width = 210 }: { items: MenuItem[]; top: number; width?: number }) {
  return (
    <div role="menu" onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 12, top, zIndex: 16, width, background: 'var(--surface)', borderRadius: 16, boxShadow: POP_SHADOW, padding: 6, cursor: 'default' }}>
      {items.map(mi => (
        <button
          key={mi.label} role="menuitem" className="gl-hov" onClick={mi.onClick}
          style={{ width: '100%', height: 44, border: 0, borderRadius: 10, background: 'transparent', color: mi.danger ? 'var(--bad-ink)' : 'var(--ink)', font: "500 14px 'Plus Jakarta Sans',sans-serif", display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', cursor: 'pointer' }}
        >
          <mi.icon size={18} stroke={2} />{mi.label}
        </button>
      ))}
    </div>
  )
}

/** The ⋮ button on cards and rows */
export function DotsButton({ onClick, margin, Icon }: { onClick: (e: React.MouseEvent) => void; margin?: string; Icon: TablerIcon }) {
  return (
    <button
      onClick={onClick} aria-label="More options"
      style={{ width: 44, height: 44, margin, border: 0, borderRadius: 12, background: 'transparent', color: 'var(--ink3)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}
    >
      <Icon size={20} stroke={2} />
    </button>
  )
}

// ── Dialog on desktop, bottom sheet on phones ───────────────────────────────────

export function Overlay({ desktop, maxW, label, onClose, children }: {
  desktop: boolean; maxW: number; label: string; onClose: () => void; children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  return createPortal(
    <div className="gl" style={{ position: 'fixed', inset: 0, zIndex: 70 }}>
      <div
        className="gl-scrim" onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', display: 'flex', alignItems: desktop ? 'center' : 'flex-end', justifyContent: 'center', padding: desktop ? 40 : 0, boxSizing: 'border-box' }}
      >
        <div
          role="dialog" aria-modal="true" aria-label={label} onClick={e => e.stopPropagation()}
          className={desktop ? 'gl-dialog' : 'gl-sheet'}
          style={{
            position: 'relative', background: 'var(--surface)', width: '100%', maxWidth: desktop ? maxW : '100%',
            maxHeight: desktop ? '100%' : '92%', overflowY: 'auto', overscrollBehavior: 'contain',
            borderRadius: desktop ? 24 : '24px 24px 0 0', boxShadow: '0 30px 80px rgba(0,0,0,.28)',
            display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
            paddingBottom: desktop ? 0 : 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {!desktop && <div style={{ width: 40, height: 4, flex: 'none', borderRadius: 99, background: 'var(--ink3)', opacity: 0.45, margin: '10px auto 0' }} />}
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Close" style={{ width: 44, height: 44, border: 0, borderRadius: 999, background: 'var(--surface2)', color: 'var(--ink2)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}>
      <IconX size={20} stroke={2} />
    </button>
  )
}

// ── Buttons ─────────────────────────────────────────────────────────────────────

export const btn = (kind: 'brand' | 'soft' | 'bad', h: number, radius: number, font: string, extra?: CSSProperties): CSSProperties => ({
  height: h, border: 0, borderRadius: radius, cursor: 'pointer', font,
  background: kind === 'brand' ? 'var(--brand)' : kind === 'bad' ? 'var(--bad)' : 'var(--surface2)',
  color: kind === 'soft' ? 'var(--ink)' : '#fff',
  ...extra,
})

export const FIELD_LABEL: CSSProperties = { fontSize: 12.5, fontWeight: 600, color: 'var(--ink2)' }
export const FIELD: CSSProperties = { height: 48, border: 0, borderRadius: 14, background: 'var(--surface2)', color: 'var(--ink)', padding: '0 14px', outline: 'none', boxSizing: 'border-box', width: '100%' }
