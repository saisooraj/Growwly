'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { getCategoryDisplayName } from '@/lib/categoryIcons'
import { DEFAULT_ASSUMPTIONS_PCT } from '@/lib/fireDefaults'
import type { FireData, PortfolioLine, SourcedValue } from '@/lib/fireInputs'
import type { FireSettings } from '@/types'
import { BOX, BOX_INPUT, fmtFull, fmtShort, KindTag, MONO, SourceBadge, Switch } from './shared'

export type OverrideKey = keyof NonNullable<FireSettings['overrides']>
type IncludeKey = keyof NonNullable<FireSettings['include']>

interface Props {
  data: FireData
  draft: FireSettings
  update: (patch: Partial<FireSettings>) => void
  masked: boolean
  dob: string | undefined
  onDob: (dob: string | null) => void
  /** Which value is being edited (lifted so the hero's "Enter monthly spending" can open it) */
  editKey: OverrideKey | null
  setEditKey: (k: OverrideKey | null) => void
}

const GROUPS: { key: IncludeKey; label: string; note?: string }[] = [
  { key: 'cash', label: 'Cash & savings', note: 'Includes day-to-day money' },
  { key: 'gold', label: 'Gold' },
  { key: 'realEstate', label: 'Real estate', note: 'Only if you plan to sell it or live off rent' },
  { key: 'otherAssets', label: 'Other assets' },
]

const names = (ls: PortfolioLine[]) => ls.length <= 3 ? ls.map(l => l.name).join(', ') : `${ls.slice(0, 2).map(l => l.name).join(', ')} +${ls.length - 2} more`

export default function InputsPanel({ data, draft, update, masked, dob, onDob, editKey, setEditKey }: Props) {
  const overrides = draft.overrides ?? {}
  const include = { ...DEFAULT_ASSUMPTIONS_PCT.include, ...(draft.include ?? {}) }
  const excluded = new Set(draft.excludedCategories ?? DEFAULT_ASSUMPTIONS_PCT.excludedCategories)
  const [showCounts, setShowCounts] = useState(false)

  const setOverride = (k: OverrideKey, v: number | null) => {
    const next = { ...overrides }
    if (v == null) delete next[k]; else next[k] = v
    update({ overrides: next })
  }
  const setInclude = (k: IncludeKey, v: boolean) => update({ include: { ...include, [k]: v } })
  const toggleCategory = (c: string) => {
    const next = new Set(excluded)
    if (next.has(c)) next.delete(c); else next.add(c)
    update({ excludedCategories: Array.from(next) })
  }

  const always = data.lines.filter(l => !l.toggle && l.included)
  const never = data.lines.filter(l => !l.toggle && !l.included)
  const excludedSpend = data.categories.filter(c => excluded.has(c.name)).reduce((s, c) => s + c.monthly, 0)
  const inv = data.monthlyInvestment

  const fields: { key: OverrideKey; label: string; v: SourcedValue; note: string; short?: boolean }[] = [
    { key: 'monthlyExpenses', label: 'Monthly expenses', v: data.monthlyExpenses,
      note: data.monthlyExpenses.source === 'manual' ? 'Entered by you'
        : data.monthlyExpenses.source === 'missing' ? 'Log transactions or enter an estimate'
        : excludedSpend > 0 ? `${data.monthlyExpenses.note} · ${fmtFull(excludedSpend, masked)} left out below`
        : data.monthlyExpenses.note },
    { key: 'monthlyIncome', label: 'Monthly income', v: data.monthlyIncome, note: data.monthlyIncome.note },
    { key: 'monthlyInvestment', label: 'Monthly investment', v: inv,
      note: inv.source !== 'manual' && inv.epf > 0 ? `${fmtFull(inv.cashSavings, masked)} savings + ${fmtFull(inv.epf, masked)} EPF` : inv.note },
    { key: 'portfolio', label: 'Investable portfolio', v: data.portfolio, note: data.portfolio.note, short: true },
  ]

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: '-0.015em' }}>Your numbers</h2>
          <KindTag kind="actual" />
        </div>
        <span style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.45 }}>From your records. Edit anything — results update instantly.</span>
      </div>

      <DobField dob={dob} noAge={data.age == null} onDob={onDob} />

      {fields.map(x => (
        <ValueField key={x.key} label={x.label} v={x.v} note={x.note} short={x.short} masked={masked}
          editing={editKey === x.key} onEdit={() => setEditKey(x.key)} onCancel={() => setEditKey(null)}
          onCommit={n => { setOverride(x.key, n); setEditKey(null) }}
          onReset={() => setOverride(x.key, null)} />
      ))}

      {/* What counts toward FI */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
        <button type="button" onClick={() => setShowCounts(v => !v)} aria-expanded={showCounts}
          style={{ width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: 0, background: 'none', cursor: 'pointer', color: 'var(--text)', padding: 0, fontFamily: 'inherit' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>What counts toward FI</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtShort(data.portfolio.value, masked)}
            <ChevronDown size={16} style={{ transform: showCounts ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }} />
          </span>
        </button>
        {showCounts && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 6 }}>
            {always.length > 0 && (
              <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ font: `600 10px/1 ${MONO}`, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: 2 }}>Always counted</span>
                {always.map(l => (
                  <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                    <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtShort(l.value, masked)}</span>
                  </div>
                ))}
              </div>
            )}
            {GROUPS.map(g => {
              const ls = data.lines.filter(l => l.toggle === g.key)
              if (ls.length === 0) return null
              const on = !!include[g.key]
              return (
                <ToggleRow key={g.key} label={g.label} value={fmtShort(ls.reduce((s, l) => s + l.value, 0), masked)}
                  note={[names(ls), g.note].filter(Boolean).join(' · ')} on={on} onClick={() => setInclude(g.key, !on)} />
              )
            })}
            {data.emergencyFund > 0 && (
              <ToggleRow label="Emergency fund" value={fmtShort(data.emergencyFund, masked)}
                note={data.efCounted ? 'Counted — you’d keep a separate reserve in retirement' : 'Off by default — it’s for surprises, not retirement'}
                on={data.efCounted} onClick={() => setInclude('emergencyFund', !data.efCounted)} />
            )}
            {data.loans > 0 && (
              <ToggleRow label="Subtract loans" value={`−${fmtShort(data.loans, masked)}`}
                note="Takes outstanding loans off your portfolio. Turn off if they’ll be paid from salary before you retire — EMIs are already in your expenses."
                on={!!include.subtractLoans} onClick={() => setInclude('subtractLoans', !include.subtractLoans)} />
            )}
            {never.length > 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.45 }}>
                {names(never)} {fmtShort(never.reduce((s, l) => s + l.value, 0), masked)} — always left out. Vehicles lose value and aren’t sold to fund retirement.
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <span style={{ color: 'var(--text-2)' }}>Net worth, everything</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtShort(data.netWorth, masked)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Categories left out of retirement spending */}
      {data.categories.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Spending that won’t continue in retirement</span>
            <span style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.45 }}>Monthly averages. Tap to leave out of your FI target — e.g. one-off building costs or EMIs that end before you retire.</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.categories.map(c => {
              const off = excluded.has(c.name)
              return (
                <button key={c.name} type="button" onClick={() => toggleCategory(c.name)} aria-pressed={off}
                  aria-label={`${getCategoryDisplayName(c.name)}: ${off ? 'left out' : 'counted'}`}
                  style={{
                    minHeight: 40, padding: '0 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6,
                    border: `1px solid ${off ? 'var(--border)' : 'var(--border-strong)'}`,
                    background: off ? 'var(--surface-2)' : 'var(--surface)', color: off ? 'var(--text-3)' : 'var(--text)',
                    textDecoration: off ? 'line-through' : 'none',
                  }}>
                  {getCategoryDisplayName(c.name)}
                  <span style={{ fontWeight: 500, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>{fmtFull(c.monthly, masked)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ToggleRow({ label, value, note, on, onClick }: { label: string; value: string; note: string; on: boolean; onClick: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label} <span style={{ color: 'var(--text-3)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{value}</span></span>
        <span style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.4 }}>{note}</span>
      </div>
      <Switch on={on} onClick={onClick} label={label === 'Subtract loans' ? 'Subtract loans' : `Count ${label.toLowerCase()} toward FI`} />
    </div>
  )
}

function ValueField({ label, v, note, short, masked, editing, onEdit, onCancel, onCommit, onReset }: {
  label: string; v: SourcedValue; note: string; short?: boolean; masked: boolean
  editing: boolean; onEdit: () => void; onCancel: () => void; onCommit: (n: number) => void; onReset: () => void
}) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!editing) return
    setText(v.source === 'missing' ? '' : String(Math.round(v.value)))
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select() })
  }, [editing]) // eslint-disable-line react-hooks/exhaustive-deps
  const commit = () => {
    const n = Number(text)
    if (text !== '' && Number.isFinite(n)) onCommit(n); else onCancel()
  }
  const fmt = short ? fmtShort : fmtFull
  const manual = v.source === 'manual'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }}>{label}</span>
        <SourceBadge source={v.source} />
      </div>
      {editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ ...BOX, flex: 1, border: '1.5px solid var(--brand)' }}>
            <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>₹</span>
            <input ref={inputRef} value={text ? Number(text).toLocaleString('en-IN') : ''} inputMode="numeric" aria-label={label}
              onChange={e => setText(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 11))}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel() }}
              style={BOX_INPUT} />
          </div>
          <button type="button" onClick={commit}
            style={{ height: 44, padding: '0 14px', borderRadius: 12, border: 0, background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
            Done
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span className="display-num" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {v.source === 'missing' ? '—' : fmt(v.value, masked)}
          </span>
          <button type="button" onClick={onEdit} disabled={masked} aria-label={`Edit ${label.toLowerCase()}`} title={masked ? 'Show amounts to edit' : undefined}
            style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', cursor: masked ? 'default' : 'pointer', display: 'grid', placeItems: 'center', opacity: masked ? 0.45 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinejoin: 'round' }}><path d="M9.5 2l2.5 2.5L5 11.5H2.5V9z" /></svg>
          </button>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--text-3)' }}>
        <span style={{ lineHeight: 1.4 }}>{note}</span>
        {manual && !editing && (
          <button type="button" onClick={onReset}
            style={{ border: 0, background: 'none', color: 'var(--brand-ink)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: '6px 0', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
            Use {fmt(v.auto, masked)}
          </button>
        )}
      </div>
    </div>
  )
}

function DobField({ dob, noAge, onDob }: { dob: string | undefined; noAge: boolean; onDob: (d: string | null) => void }) {
  const [text, setText] = useState(dob ?? '')
  useEffect(() => { setText(dob ?? '') }, [dob])
  const today = new Date().toISOString().slice(0, 10)
  const save = (t: string) => { if (t !== (dob ?? '') && (t === '' || /^\d{4}-\d{2}-\d{2}$/.test(t))) onDob(t || null) }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label htmlFor="fire-dob" style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }}>Date of birth</label>
      <input id="fire-dob" className="input" type="date" value={text} max={today}
        onChange={e => setText(e.target.value)}
        onBlur={() => save(text)}
        style={{ height: 44, fontSize: 16, padding: '0 12px' }} />
      {noAge
        ? <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--warn-ink)', background: 'var(--warn-soft)', borderRadius: 10, padding: '8px 10px' }}>Add it to see ages. Until then we show years and calendar dates.</div>
        : <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Only used to show ages here.</div>}
    </div>
  )
}
