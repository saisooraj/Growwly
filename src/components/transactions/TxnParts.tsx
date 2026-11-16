'use client'

import type { CSSProperties, ReactNode } from 'react'
import { Eye, EyeOff, FilterX, Globe, SearchX, Sprout, X } from 'lucide-react'
import { MASK, MONO, R, avatarStyle, mask } from './txnView'
import { EYEBROW } from './TxnFilters'

export type Note = [text: string, color: string]

export interface MonthSummary {
  in: number
  out: number
  net: number
  inNotes: Note[]
  outNotes: Note[]
  rangeText: string
}

const skel = (style: CSSProperties) => <span className="txn-skel" style={{ display: 'block', ...style }} />

function MaskToggle({ reveal, onToggle }: { reveal: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} aria-pressed={reveal} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 44, padding: '0 12px', border: 0, background: 'transparent', fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>
      {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
      {reveal ? 'Hide' : 'Show'}
    </button>
  )
}

const netText = (n: number) => `${n >= 0 ? '+' : '−'}${R(n)}`
const netColor = (n: number, reveal: boolean) => (reveal ? (n >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)') : 'var(--t1)')

// ── Phone: "This month" strip ─────────────────────────────────────────────────

export function SummaryPhone({ s, reveal, onToggle, loading, year }: { s: MonthSummary; reveal: boolean; onToggle: () => void; loading: boolean; year: string }) {
  const lastIn = s.inNotes.length ? s.inNotes[s.inNotes.length - 1][0].replace(` ${year}`, '') : '—'
  const firstOut = s.outNotes.length ? s.outNotes[0][0] : 'Nothing yet'
  const cell = (label: string, value: string, note: string, first: boolean, valueStyle?: CSSProperties) => (
    <div style={{ padding: first ? '0 12px 0 16px' : '0 12px', borderLeft: first ? 0 : '1px solid var(--border)', minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)' }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 500, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...valueStyle }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note}</div>
    </div>
  )
  return (
    <div style={{ margin: '0 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: 'var(--shadow)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 0 16px' }}>
        <span style={EYEBROW}>This month · {s.rangeText}</span>
        <MaskToggle reveal={reveal} onToggle={onToggle} />
      </div>
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, padding: '4px 16px 18px' }}>
          {['85%', '80%', '70%'].map(w => (
            <div key={w} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {skel({ height: 10, width: '40%', borderRadius: 4 })}
              {skel({ height: 16, width: w, borderRadius: 5 })}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', padding: '0 0 14px' }}>
          {cell('↓ In', reveal ? R(s.in) : MASK, mask(lastIn, reveal), true)}
          {cell('↑ Out', reveal ? R(s.out) : MASK, mask(firstOut, reveal), false)}
          <div style={{ padding: '0 12px', borderLeft: '1px solid var(--border)', minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)' }}>Net</div>
            <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 500, letterSpacing: '-0.02em', marginTop: 3, color: netColor(s.net, reveal), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{reveal ? netText(s.net) : MASK}</div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{s.net >= 0 ? 'Surplus' : 'Deficit'}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Scope / count line ────────────────────────────────────────────────────────

export function StatusRow({ allTime, scopeLabel, scopeText, countLabel, hasRows, collapseLabel, onToggleAll, backLabel, onBack, pad }: {
  allTime: boolean; scopeLabel: string; scopeText: string; countLabel: string; hasRows: boolean
  collapseLabel: string; onToggleAll: () => void; backLabel?: string; onBack?: () => void; pad: string
}) {
  return (
    <div style={{ padding: pad, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minHeight: 28 }}>
      {allTime ? (
        <>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px', borderRadius: 999, background: 'var(--info-soft)', color: 'var(--info-ink)', fontSize: 12, fontWeight: 700 }}>
            <Globe size={13} />{scopeLabel}
          </span>
          <span style={{ fontSize: 13, color: 'var(--t2)' }}>{scopeText}</span>
          {backLabel && onBack && (
            <button onClick={onBack} style={{ height: 32, border: 0, background: 'transparent', padding: '0 2px', fontSize: 13, fontWeight: 600, color: 'var(--info-ink)' }}>{backLabel}</button>
          )}
        </>
      ) : (
        <span style={{ fontSize: 13, color: 'var(--t2)' }}>{countLabel}</span>
      )}
      <span style={{ flex: 1 }} />
      {hasRows && (
        <button onClick={onToggleAll} style={{ height: 32, border: 0, background: 'transparent', padding: '0 2px', fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>{collapseLabel}</button>
      )}
    </div>
  )
}

// ── Filtered summary ──────────────────────────────────────────────────────────

export function FilterSummary({ badges, count, spent, income, phone }: {
  badges: { label: string; onRemove: () => void }[]; count: number; spent: number; income: number; phone: boolean
}) {
  const net = income - spent
  const fig = phone ? 17 : 22
  const stat = (label: string, value: ReactNode) => (
    <div>
      <div style={EYEBROW}>{label}</div>
      {value}
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {badges.map(b => (
          <span key={b.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: phone ? 36 : 32, padding: '0 2px 0 12px', borderRadius: 999, background: 'var(--s2)', fontSize: phone ? 14 : 13, fontWeight: 600 }}>
            {b.label}
            <button onClick={b.onRemove} aria-label={`Remove ${b.label}`} style={{ width: phone ? 32 : 28, height: phone ? 32 : 28, border: 0, borderRadius: 999, background: 'transparent', display: 'grid', placeItems: 'center', color: 'var(--t2)' }}>
              <X size={13} />
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
        {stat('Count', <div style={{ fontFamily: MONO, fontSize: fig, marginTop: 2 }}>{count}</div>)}
        {stat('Spent', <div style={{ fontFamily: MONO, fontSize: fig, marginTop: 2 }}>{R(spent)}</div>)}
        {income > 0 && stat('Net', <div style={{ fontFamily: MONO, fontSize: fig, fontWeight: 500, marginTop: 2, color: net >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)' }}>{netText(net)}</div>)}
      </div>
    </div>
  )
}

// ── Savings summary ───────────────────────────────────────────────────────────

export function SavingsSummary({ title, total, color, icon, inAmt, outAmt, phone }: {
  title: string; total: number; color: string; icon: ReactNode; inAmt: number; outAmt: number; phone: boolean
}) {
  const net = inAmt - outAmt
  const stat = (label: string, value: string, c: string) => (
    <div>
      <div style={EYEBROW}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: phone ? 16 : 17, fontWeight: 500, marginTop: 2, color: c, whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px 24px', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: phone ? 'var(--shadow)' : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 200px', minWidth: 0 }}>
        <span style={avatarStyle(color, 44, 13)}>{icon}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: 'var(--t2)' }}>{title}</div>
          <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em' }}>{R(total)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        {stat('In', `+${R(inAmt)}`, 'var(--good-ink)')}
        {stat('Out', `−${R(outAmt)}`, 'var(--bad-ink)')}
        {stat('Net', netText(net), net >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)')}
      </div>
    </div>
  )
}

// ── Empty states ──────────────────────────────────────────────────────────────

const bigBtn = (primary: boolean): CSSProperties => ({
  width: '100%', height: 50, borderRadius: 14, fontSize: 16, fontWeight: 600,
  border: primary ? 0 : '1px solid var(--border)', background: primary ? 'var(--t1)' : 'var(--surface)', color: primary ? 'var(--bg)' : 'var(--t1)',
})

function Empty({ icon, tint, title, size, body, children, top }: { icon: ReactNode; tint: boolean; title: string; size: number; body: string; children: ReactNode; top: number }) {
  return (
    <div style={{ padding: `${top}px 28px 0`, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10, maxWidth: 440, margin: '0 auto' }}>
      <div style={{ width: 64, height: 64, borderRadius: 999, background: tint ? 'var(--good-soft)' : 'var(--s2)', display: 'grid', placeItems: 'center' }}>{icon}</div>
      <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: size, lineHeight: 1.1, marginTop: 4, overflowWrap: 'anywhere' }}>{title}</div>
      <div style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.5 }}>{body}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 10 }}>{children}</div>
    </div>
  )
}

export function EmptyMonth({ rangeText, onAdd, onScan }: { rangeText: string; onAdd: () => void; onScan: () => void }) {
  return (
    <Empty top={48} tint icon={<Sprout size={28} color="var(--good-ink)" />} title="A fresh month." size={32}
      body={`Your cycle started ${rangeText}. Nothing logged yet — your carry-forward is already counted.`}>
      <button onClick={onAdd} style={bigBtn(true)}>Add a transaction</button>
      <button onClick={onScan} style={bigBtn(false)}>Scan a bill</button>
    </Empty>
  )
}

export function EmptySearch({ q, onClear }: { q: string; onClear: () => void }) {
  return (
    <Empty top={48} tint={false} icon={<SearchX size={28} color="var(--t2)" />} title={`Nothing matches “${q}”`} size={30}
      body="We looked through all time — notes, categories, amounts, people and tags. Try fewer words.">
      <button onClick={onClear} style={bigBtn(false)}>Clear search</button>
    </Empty>
  )
}

export function EmptyFilter({ onClear }: { onClear: () => void }) {
  return (
    <Empty top={36} tint={false} icon={<FilterX size={28} color="var(--t2)" />} title="No transactions fit these filters" size={30}
      body="Remove one above, or start over.">
      <button onClick={onClear} style={bigBtn(true)}>Clear filters</button>
    </Empty>
  )
}

// ── Loading ───────────────────────────────────────────────────────────────────

export function ListSkeleton() {
  const head = (a: number, b: number, mt = 0) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: mt }}>
      {skel({ height: 12, width: a, borderRadius: 4 })}{skel({ height: 12, width: b, borderRadius: 4 })}
    </div>
  )
  const row = (w1: string, w2?: string) => (
    <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 64px', gap: 12, alignItems: 'center' }}>
      {skel({ height: 44, borderRadius: 13 })}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {skel({ height: 13, width: w1, borderRadius: 4 })}
        {w2 && skel({ height: 10, width: w2, borderRadius: 4 })}
      </span>
      {skel({ height: 13, borderRadius: 4 })}
    </div>
  )
  return (
    <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {head(110, 80)}
      {row('60%', '85%')}{row('45%', '70%')}{row('55%')}
      {head(90, 120, 6)}
      {row('50%', '90%')}{row('65%')}
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────

export function PageToast({ text, onUndo, desktop }: { text: string; onUndo?: () => void; desktop: boolean }) {
  if (desktop) {
    return (
      <div role="status" style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 60 }}>
        <div className="txn-anim-in" style={{ display: 'flex', alignItems: 'center', gap: 14, height: 44, padding: '0 8px 0 16px', borderRadius: 999, background: 'var(--t1)', color: 'var(--bg)', fontSize: 14, fontWeight: 600, boxShadow: 'var(--shadow-lg)', whiteSpace: 'nowrap' }}>
          <span style={{ paddingRight: onUndo ? 0 : 8 }}>{text}</span>
          {onUndo && <button onClick={onUndo} style={{ height: 32, padding: '0 12px', border: 0, borderRadius: 999, background: 'rgba(127,127,127,.3)', fontSize: 13, fontWeight: 700, color: 'inherit' }}>Undo</button>}
        </div>
      </div>
    )
  }
  return (
    <div role="status" className="txn-anim-in" style={{
      position: 'fixed', zIndex: 60, display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, padding: '0 6px 0 16px',
      borderRadius: 14, background: 'var(--t1)', color: 'var(--bg)', fontSize: 14, fontWeight: 600, boxShadow: 'var(--shadow-lg)',
      left: 16, right: 16, bottom: 'calc(max(20px, env(safe-area-inset-bottom, 0px)) + 78px)',
    }}>
      <span style={{ flex: 1, padding: '12px 0' }}>{text}</span>
      {onUndo && (
        <button onClick={onUndo} style={{ height: 36, padding: '0 14px', border: 0, borderRadius: 10, background: 'rgba(127,127,127,.3)', fontSize: 14, fontWeight: 700, color: 'inherit' }}>Undo</button>
      )}
    </div>
  )
}
