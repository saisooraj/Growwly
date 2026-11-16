'use client'

import type { CSSProperties, ReactNode } from 'react'
import {
  ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, ChevronsDownUp, Eye, EyeOff,
  FilterX, Flame, Globe, PencilLine, Plus, Scale, ScanLine, SearchX, Sprout, X,
} from 'lucide-react'
import { MASK, MONO, R, avatarStyle, mask } from './txnView'
import { EYEBROW, Popover } from './TxnFilters'
import type { MonthSummary, Note } from './TxnParts'

// ── Page header ───────────────────────────────────────────────────────────────

export function DesktopHeader({ headRef, monthLabel, canPrev, canNext, onPrev, onNext, streak, addOpen, onAddToggle, onAddClose, onManual, onScan }: {
  headRef: (el: HTMLElement | null) => void; monthLabel: string; canPrev: boolean; canNext: boolean; onPrev: () => void; onNext: () => void; streak: number
  addOpen: boolean; onAddToggle: () => void; onAddClose: () => void; onManual: () => void; onScan: () => void
}) {
  const navBtn = (on: boolean): CSSProperties => ({ width: 36, height: 38, border: 0, background: 'transparent', display: 'grid', placeItems: 'center', color: 'var(--t1)', opacity: on ? 1 : 0.35 })
  const menuRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: 40, padding: '0 10px', border: 0, borderRadius: 9, background: 'transparent', fontSize: 14, fontWeight: 500, color: 'var(--t1)' }
  return (
    <header ref={headRef} style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: 14, padding: '18px 32px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>Transactions</h1>
        <div style={{ fontSize: 13, color: 'var(--t2)', marginTop: 2 }}>Every movement, searchable</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', height: 40, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
        <button onClick={onPrev} disabled={!canPrev} aria-label="Previous month" style={navBtn(canPrev)}><ChevronLeft size={16} /></button>
        <div style={{ minWidth: 84, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{monthLabel}</div>
        <button onClick={onNext} disabled={!canNext} aria-label="Next month" style={navBtn(canNext)}><ChevronRight size={16} /></button>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 999, fontSize: 13, fontWeight: 600,
        background: streak > 0 ? 'var(--warn-soft)' : 'var(--s2)', color: streak > 0 ? 'var(--warn-ink)' : 'var(--t3)',
      }}>
        <Flame size={14} />{streak}-day streak
      </div>
      <Popover open={addOpen} onClose={onAddClose} align="right" width={240} top={48} padding={6} radius={14} anchor={
        <button onClick={onAddToggle} aria-expanded={addOpen} title="Add transaction (N)" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 10px 0 14px', border: 0, borderRadius: 12, background: 'var(--t1)', color: 'var(--bg)', fontSize: 14, fontWeight: 600 }}>
          <Plus size={16} />Add<ChevronDown size={16} style={{ opacity: 0.7 }} />
        </button>
      }>
        <button className="txn-hover" onClick={onManual} style={menuRow}>
          <PencilLine size={16} /><span style={{ flex: 1, textAlign: 'left' }}>Add manually</span>
          <kbd style={{ fontFamily: MONO, fontSize: 11, padding: '2px 6px', borderRadius: 5, border: '1px solid var(--border)', color: 'var(--t2)' }}>N</kbd>
        </button>
        <button className="txn-hover" onClick={onScan} style={menuRow}>
          <ScanLine size={16} /><span style={{ flex: 1, textAlign: 'left' }}>Scan a bill</span>
        </button>
      </Popover>
    </header>
  )
}

// ── Chip with a leading icon and a clear / caret on the right ─────────────────

export const filterChipStyle = (active: boolean): CSSProperties => ({
  height: 36, padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none', borderRadius: 999,
  border: `1px solid ${active ? 'var(--t1)' : 'var(--border)'}`, background: active ? 'var(--t1)' : 'var(--surface)',
  color: active ? 'var(--bg)' : 'var(--t1)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
  transition: 'background .18s cubic-bezier(0.23,1,0.32,1), color .18s',
})

export function ChipInner({ icon, label, active, onClear, clearLabel }: { icon: ReactNode; label: string; active: boolean; onClear: () => void; clearLabel: string }) {
  return (
    <>
      {icon}{label}
      {active ? (
        <span role="button" aria-label={clearLabel} onClick={e => { e.stopPropagation(); onClear() }} style={{ width: 18, height: 18, marginRight: -4, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'rgba(127,127,127,.25)' }}>
          <X size={11} />
        </span>
      ) : (
        <ChevronDown size={14} style={{ opacity: 0.6 }} />
      )}
    </>
  )
}

// ── Scope line ────────────────────────────────────────────────────────────────

export function StatusLine({ allTime, scopeLabel, scopeText, homeMonth, onBack, monthLabel, rangeText, countLabel, hasRows, collapseLabel, onToggleAll }: {
  allTime: boolean; scopeLabel: string; scopeText: string; homeMonth: string; onBack: () => void
  monthLabel: string; rangeText: string; countLabel: string; hasRows: boolean; collapseLabel: string; onToggleAll: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 20, minHeight: 30 }}>
      {allTime ? (
        <>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px', borderRadius: 999, background: 'var(--info-soft)', color: 'var(--info-ink)', fontSize: 12, fontWeight: 700 }}>
            <Globe size={13} />{scopeLabel}
          </span>
          <span style={{ fontSize: 13, color: 'var(--t2)' }}>{scopeText}</span>
          <button onClick={onBack} style={{ border: 0, background: 'transparent', padding: '0 4px', fontSize: 13, fontWeight: 600, color: 'var(--good-ink)' }}>Back to {homeMonth}</button>
        </>
      ) : (
        <span style={{ fontSize: 13, color: 'var(--t2)' }}><strong style={{ color: 'var(--t1)', fontWeight: 700 }}>{monthLabel}</strong> · {rangeText} · {countLabel}</span>
      )}
      <div style={{ flex: 1 }} />
      {hasRows && (
        <button className="txn-hover" onClick={onToggleAll} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, background: 'transparent', padding: '6px 8px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
          <ChevronsDownUp size={14} />{collapseLabel}
        </button>
      )}
    </div>
  )
}

// ── Filtered / savings summaries ──────────────────────────────────────────────

const stat = (label: string, value: ReactNode, size: number, style?: CSSProperties) => (
  <div>
    <div style={EYEBROW}>{label}</div>
    <div style={{ fontFamily: MONO, fontSize: size, fontWeight: 500, marginTop: 4, ...style }}>{value}</div>
  </div>
)
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${R(n)}`

export function FilteredBy({ badges, count, spent, income }: { badges: { label: string; onRemove: () => void }[]; count: number; spent: number; income: number }) {
  const net = income - spent
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 32, flexWrap: 'wrap', padding: '14px 4px 2px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 200 }}>
        <div style={EYEBROW}>Filtered by</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {badges.map(b => (
            <span key={b.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 4px 0 10px', borderRadius: 999, background: 'var(--s2)', fontSize: 13, fontWeight: 600 }}>
              {b.label}
              <button onClick={b.onRemove} aria-label={`Remove ${b.label}`} style={{ width: 20, height: 20, border: 0, borderRadius: 999, background: 'var(--s3)', display: 'grid', placeItems: 'center', color: 'var(--t2)' }}><X size={11} /></button>
            </span>
          ))}
        </div>
      </div>
      {stat('Transactions', count, 22)}
      {stat('Spent', R(spent), 22)}
      {income > 0 && stat('Income', `+${R(income)}`, 22, { color: 'var(--good-ink)' })}
      {income > 0 && stat('Net', signed(net), 22, { color: net >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)' })}
    </div>
  )
}

export function SavingsLine({ title, total, color, icon, homeMonth, inAmt, outAmt }: { title: string; total: number; color: string; icon: ReactNode; homeMonth: string; inAmt: number; outAmt: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', padding: '14px 4px 2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 240 }}>
        <div style={avatarStyle(color, 44, 13)}>{icon}</div>
        <div>
          <div style={EYEBROW}>{title}</div>
          <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', marginTop: 2 }}>{R(total)}</div>
        </div>
      </div>
      {stat(`In · ${homeMonth}`, `+${R(inAmt)}`, 18, { fontWeight: 400, color: 'var(--good-ink)' })}
      {stat('Out', `−${R(outAmt)}`, 18, { fontWeight: 400 })}
      {stat('Net', signed(inAmt - outAmt), 18, { fontWeight: 400 })}
    </div>
  )
}

// ── Right column ──────────────────────────────────────────────────────────────

export function MonthCard({ s, homeMonth, reveal, onToggle, loading }: { s: MonthSummary; homeMonth: string; reveal: boolean; onToggle: () => void; loading: boolean }) {
  const notes = (list: Note[]) => list.map(([t, c]) => <div key={t} style={{ fontSize: 12, lineHeight: '17px', color: reveal ? c : 'var(--t3)' }}>{mask(t, reveal)}</div>)
  const label = (tileBg: string, icon: ReactNode, text: string, extra?: ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
      <span style={{ width: 20, height: 20, borderRadius: 6, background: tileBg, display: 'grid', placeItems: 'center' }}>{icon}</span>{text}{extra}
    </div>
  )
  const value = (v: string, color = 'var(--t1)') => loading
    ? <span className="txn-skel" style={{ display: 'block', height: 26, width: '70%', borderRadius: 6, margin: '4px 0' }} />
    : <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</div>
  const netColor = reveal ? (s.net >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)') : 'var(--t1)'
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 20, boxShadow: 'var(--shadow)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={EYEBROW}>This month</div>
          <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>{homeMonth} · {s.rangeText}</div>
        </div>
        <button className="txn-hover" onClick={onToggle} aria-pressed={reveal} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 999, background: 'transparent', fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>
          {reveal ? <EyeOff size={14} /> : <Eye size={14} />}{reveal ? 'Hide' : 'Show'}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 16 }}>
        {label('var(--good-soft)', <ArrowDownLeft size={12} color="var(--good-ink)" />, 'Money in')}
        {value(reveal ? R(s.in) : MASK)}
        {!loading && notes(s.inNotes)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '16px 0', borderTop: '1px solid var(--border)' }}>
        {label('var(--bad-soft)', <ArrowUpRight size={12} color="var(--bad-ink)" />, 'Money out')}
        {value(reveal ? R(s.out) : MASK)}
        {!loading && notes(s.outNotes)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        {label('var(--s2)', <Scale size={12} color="var(--t2)" />, 'Net cashflow',
          <><span style={{ flex: 1 }} /><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)' }}>{s.net >= 0 ? 'Surplus' : 'Deficit'}</span></>)}
        {value(reveal ? signed(s.net) : MASK, netColor)}
      </div>
    </div>
  )
}

export interface TopRow { key: string; name: string; amount: number; color: string; icon?: ReactNode; active: boolean; onClick: () => void }

export function TopCard({ cats, tags, reveal }: { cats: TopRow[]; tags: TopRow[]; reveal: boolean }) {
  const row = (r: TopRow, max: number, tag: boolean) => (
    <button key={r.key} className="txn-hover" onClick={r.onClick} aria-pressed={r.active} style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%', padding: '9px 10px', border: 0, borderRadius: 10, background: r.active ? 'var(--s2)' : 'transparent', color: 'var(--t1)', textAlign: 'left' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        {r.icon}
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: tag ? 'var(--wants-ink)' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
        <span style={{ fontFamily: MONO, fontSize: 13, whiteSpace: 'nowrap' }}>{reveal ? R(r.amount) : MASK}</span>
      </span>
      <span style={{ display: 'block', width: '100%', height: 4, borderRadius: 2, background: 'var(--s2)' }}>
        <span style={{ display: 'block', width: `${Math.max(4, (r.amount / max) * 100)}%`, height: 4, borderRadius: 2, background: r.color, transition: 'width .4s cubic-bezier(0.23,1,0.32,1)' }} />
      </span>
    </button>
  )
  const maxC = cats.length ? Math.max(...cats.map(c => c.amount)) : 1
  const maxT = tags.length ? Math.max(...tags.map(c => c.amount)) : 1
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px 10px 10px', boxShadow: 'var(--shadow)' }}>
      {cats.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 10px 6px' }}>
            <span style={EYEBROW}>Top categories</span>
            <span style={{ fontSize: 11, color: 'var(--t3)' }}>Tap to filter</span>
          </div>
          {cats.map(c => row(c, maxC, false))}
        </>
      )}
      {tags.length > 0 && (
        <>
          <div style={cats.length ? { padding: '16px 10px 6px', marginTop: 6, borderTop: '1px solid var(--border)' } : { padding: '0 10px 6px' }}>
            <span style={EYEBROW}>Top tags</span>
          </div>
          {tags.map(t => row(t, maxT, true))}
        </>
      )}
    </div>
  )
}

// ── Empty states ──────────────────────────────────────────────────────────────

const btn = (primary: boolean): CSSProperties => ({
  height: 40, padding: '0 16px', borderRadius: 12, fontSize: 14, fontWeight: 600,
  border: primary ? 0 : '1px solid var(--border)', background: primary ? 'var(--t1)' : 'var(--surface)', color: primary ? 'var(--bg)' : 'var(--t1)',
})

function Empty({ icon, tint, title, size, body, children }: { icon: ReactNode; tint: boolean; title: string; size: number; body: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 16, padding: '64px 24px', border: '1px dashed var(--border)', borderRadius: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
      <div style={{ width: 56, height: 56, borderRadius: 999, background: tint ? 'var(--good-soft)' : 'var(--s2)', display: 'grid', placeItems: 'center' }}>{icon}</div>
      <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: size, lineHeight: 1.1, overflowWrap: 'anywhere' }}>{title}</div>
      <div style={{ fontSize: 14, color: 'var(--t2)', maxWidth: 380, lineHeight: 1.5 }}>{body}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>{children}</div>
    </div>
  )
}

export const EmptyMonthD = ({ rangeText, onAdd, onScan }: { rangeText: string; onAdd: () => void; onScan: () => void }) => (
  <Empty tint icon={<Sprout size={24} color="var(--good-ink)" />} title="A fresh month." size={30} body={`Nothing logged since ${rangeText}. Add your first one or scan a bill.`}>
    <button onClick={onAdd} style={btn(true)}>Add manually</button>
    <button onClick={onScan} style={btn(false)}>Scan a bill</button>
  </Empty>
)

export const EmptySearchD = ({ q, onClear }: { q: string; onClear: () => void }) => (
  <Empty tint={false} icon={<SearchX size={24} color="var(--t2)" />} title={`Nothing matches “${q}”`} size={28} body="We searched all time — notes, categories, amounts, people, savings and tags.">
    <button onClick={onClear} style={btn(false)}>Clear search</button>
  </Empty>
)

export const EmptyFilterD = ({ onClear }: { onClear: () => void }) => (
  <Empty tint={false} icon={<FilterX size={24} color="var(--t2)" />} title="No transactions fit these filters" size={28} body="Try removing one, or clear them all to see the whole month.">
    <button onClick={onClear} style={btn(true)}>Clear filters</button>
  </Empty>
)
