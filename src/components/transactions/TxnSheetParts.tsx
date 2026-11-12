'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { CATEGORY_SHEET_META, hueOf } from '@/lib/txnSheetMeta'
import { CategoryIcon, getCategoryDisplayName } from '@/lib/categoryIcons'

// Building blocks for the add-transaction sheet. Colours come from the scoped tokens on
// `.txn-sheet` in globals.css (--sheet, --card, --sunk, --line, --t1…, plus brand/semantic).

export const MONO = "'Geist Mono', ui-monospace, monospace"

/** Material Symbols Rounded glyph by ligature name */
export function Sym({ name, size = 20, fill = false, style }: { name: string; size?: number; fill?: boolean; style?: CSSProperties }) {
  return (
    <span aria-hidden className="ms" style={{ fontSize: size, fontVariationSettings: fill ? "'FILL' 1" : "'FILL' 0", ...style }}>
      {name}
    </span>
  )
}

/** Soft background + ink for a hue, light/dark aware through --ts-* / --ti-* */
export function tone(h: number) {
  return { soft: `oklch(var(--ts-l) var(--ts-c) ${h})`, ink: `oklch(var(--ti-l) var(--ti-c) ${h})` }
}

type Tone = 'brand' | 'good' | 'bad' | 'warn' | 'info'

export function chip(sel: boolean, t: Tone = 'brand', extra?: CSSProperties): CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, padding: '0 13px',
    borderRadius: 999, border: sel ? '1px solid transparent' : '1px solid var(--line)',
    background: sel ? `var(--${t}-soft)` : 'var(--card)', color: sel ? `var(--${t}-ink)` : 'var(--t2)',
    fontSize: 13.5, fontWeight: sel ? 700 : 600, cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none', ...extra,
  }
}

export function seg(sel: boolean, extra?: CSSProperties): CSSProperties {
  return {
    height: 36, border: 0, borderRadius: 10, background: sel ? 'var(--card)' : 'transparent',
    color: sel ? 'var(--t1)' : 'var(--t2)', boxShadow: sel ? '0 1px 2px rgba(0,0,0,.08)' : 'none',
    fontSize: 13, fontWeight: sel ? 700 : 600, cursor: 'pointer', ...extra,
  }
}

export function field(extra?: CSSProperties): CSSProperties {
  return {
    height: 44, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--sheet)', padding: '0 12px',
    fontFamily: MONO, fontSize: 16, color: 'var(--t1)', outline: 'none', minWidth: 0, width: '100%', ...extra,
  }
}

export function radio(sel: boolean): CSSProperties {
  return {
    width: 20, height: 20, borderRadius: '50%', flex: 'none', background: 'var(--card)',
    border: sel ? '6px solid var(--brand)' : '2px solid var(--line2)',
  }
}

export function avatar(name: string, size = 32): CSSProperties {
  const t = tone(hueOf(name))
  return {
    width: size, height: size, borderRadius: '50%', background: t.soft, color: t.ink, display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, fontWeight: 800, flex: 'none',
  }
}

export const labelStyle: CSSProperties = { fontSize: 12.5, fontWeight: 700, color: 'var(--t2)' }
export const subLabelStyle: CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--t2)' }

export const closeBtn: CSSProperties = {
  width: 34, height: 34, borderRadius: '50%', border: 0, background: 'var(--sunk)', color: 'var(--t2)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none',
}

export const darkBtn: CSSProperties = {
  height: 44, padding: '0 14px', borderRadius: 12, border: 0, background: 'var(--t1)', color: 'var(--sheet)',
  fontSize: 14, fontWeight: 700, cursor: 'pointer', flex: 'none',
}

export const textInput: CSSProperties = {
  flex: 1, height: 44, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--sheet)',
  padding: '0 12px', fontSize: 16, color: 'var(--t1)', outline: 'none', minWidth: 0,
}

/** A details card: icon + title header with an optional close, then its body */
export function SheetCard({ icon, title, onClose, badge, action, gap = 10, card, children, closeLabel = 'Remove' }: {
  icon: string; title: string; onClose?: () => void; badge?: ReactNode; action?: ReactNode; gap?: number; card?: string; children: ReactNode; closeLabel?: string
}) {
  return (
    <div data-card={card} style={{ marginTop: 12, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Sym name={icon} style={{ color: 'var(--t2)' }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{title}</span>
        {badge}
        <span style={{ flex: 1 }} />
        {action}
        {onClose && (
          <button type="button" onClick={onClose} aria-label={closeLabel} style={closeBtn}><Sym name="close" size={18} /></button>
        )}
      </div>
      {children}
    </div>
  )
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del']

/** In-sheet amount keypad (phones), so the system keyboard never covers the form */
export function Keypad({ onPress }: { onPress: (k: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: '8px 10px 2px', background: 'var(--sunk)', flex: 'none' }}>
      {KEYS.map(k => {
        const plain = k === '.' || k === 'del'
        return (
          <button
            key={k} type="button" aria-label={k === 'del' ? 'Delete' : k}
            // pointerdown keeps focus where it is and feels instant
            onPointerDown={e => { e.preventDefault(); onPress(k) }}
            // Keyboard and screen-reader presses arrive as clicks with no pointer behind them
            onClick={e => { if (e.detail === 0) onPress(k) }}
            style={{
              height: 44, borderRadius: 12, border: 0, background: plain ? 'transparent' : 'var(--card)',
              boxShadow: plain ? 'none' : '0 1px 0 var(--line2)', fontFamily: MONO, fontSize: 22, fontWeight: 500,
              color: 'var(--t1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              touchAction: 'manipulation',
            }}
          >
            {k === 'del' ? <Sym name="backspace" size={22} /> : k === '.' ? '·' : k}
          </button>
        )
      })}
    </div>
  )
}

/** Icon + hue for any category, including custom ones (which keep their own icon) */
export function categoryLook(category: string) {
  const meta = CATEGORY_SHEET_META[category]
  return {
    label: getCategoryDisplayName(category),
    h: meta?.h ?? hueOf(getCategoryDisplayName(category) || 'x'),
    icon: meta?.icon,
  }
}

/** The category glyph, Material for built-in categories and the saved icon for custom ones */
export function CatGlyph({ category, size = 20, fill = false }: { category: string; size?: number; fill?: boolean }) {
  const meta = CATEGORY_SHEET_META[category]
  if (meta) return <Sym name={meta.icon} size={size} fill={fill} />
  return <CategoryIcon category={category} size={size - 2} stroke={1.8} />
}

export function CatTile({ category, selected, suggested, onClick }: { category: string; selected: boolean; suggested: boolean; onClick: () => void }) {
  const look = categoryLook(category)
  const t = tone(look.h)
  return (
    <button
      type="button" onClick={onClick} aria-pressed={selected}
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
        height: 70, padding: '6px 4px', borderRadius: 14, minWidth: 0, cursor: 'pointer', color: 'var(--t1)',
        border: selected ? `1.5px solid ${t.ink}` : suggested ? '1.5px dashed var(--brand)' : '1px solid var(--line)',
        background: selected ? t.soft : 'var(--card)',
      }}
    >
      <span style={{
        width: 34, height: 34, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: selected ? t.ink : t.soft, color: selected ? 'var(--card)' : t.ink, lineHeight: 1,
      }}>
        <CatGlyph category={category} fill={selected} />
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {look.label}
      </span>
      {suggested && !selected && (
        <span style={{ position: 'absolute', top: 5, right: 7, fontSize: 11, fontWeight: 800, color: 'var(--brand-ink)' }}>✦</span>
      )}
    </button>
  )
}

export function NeutralTile({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, height: 70,
        padding: '6px 4px', borderRadius: 14, border: '1px dashed var(--line2)', background: 'transparent',
        color: 'var(--t2)', cursor: 'pointer', minWidth: 0,
      }}
    >
      <span style={{ width: 34, height: 34, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sunk)', color: 'var(--t2)' }}>
        <Sym name={icon} />
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

/** iOS-style switch used by Repeat monthly */
export function Switch({ on }: { on: boolean }) {
  return (
    <span style={{ width: 46, height: 28, borderRadius: 14, background: on ? 'var(--brand)' : 'var(--sunk2)', padding: 3, display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', flex: 'none', transition: 'background .2s' }}>
      <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
    </span>
  )
}

/** Keyboard hint badge in the desktop footer */
export function Kbd({ children }: { children: ReactNode }) {
  return <span style={{ fontFamily: MONO, fontSize: 11, padding: '2px 6px', borderRadius: 6, border: '1px solid var(--line2)', color: 'var(--t2)' }}>{children}</span>
}

/** A number box that keeps what's typed ("12.", "0.5") while handing a plain number up */
export function NumInput({ value, onChange, style, ...rest }: {
  value: number; onChange: (n: number) => void; style?: CSSProperties; 'aria-label'?: string; placeholder?: string
}) {
  const [text, setText] = useState(value ? String(value) : '')
  useEffect(() => {
    // Follow outside changes (re-seeding), but leave a half-typed number alone
    if ((Number(text) || 0) !== value) setText(value ? String(value) : '')
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input
      {...rest}
      inputMode="decimal"
      value={text}
      onChange={e => {
        let v = e.target.value.replace(/[^0-9.]/g, '')
        const dot = v.indexOf('.')
        if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '').slice(0, 2)
        setText(v)
        onChange(Number(v) || 0)
      }}
      style={style}
    />
  )
}
