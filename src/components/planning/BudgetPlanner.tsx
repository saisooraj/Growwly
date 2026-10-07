'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Plus, Sparkles } from 'lucide-react'
import { setBudget, setBudgetsBatch, type BudgetEntry } from '@/lib/firestore'
import { useAuth } from '@/context/AuthContext'
import { useAppStore } from '@/store/appStore'
import { useRefreshData } from '@/hooks/useData'
import { CategoryIcon, SavingsIcon, getCategoryDisplayName } from '@/lib/categoryIcons'
import type { BudgetPlan, PlanGroup, PlanRow } from '@/lib/budgetPlan'
import { BUCKET_META, money } from './bucketMeta'
import toast from 'react-hot-toast'

function rowName(r: PlanRow): string {
  return r.isVehicle && r.kind === 'savings' ? r.name : getCategoryDisplayName(r.name)
}

function toEntry(r: PlanRow, planned: number): BudgetEntry {
  return { category: r.name, planned, ...(r.kind === 'savings' ? { kind: 'savings' as const } : {}) }
}

const linkButton: React.CSSProperties = {
  height: 34, padding: '0 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)',
  color: 'var(--text)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
}
const ghostButton: React.CSSProperties = {
  height: 34, padding: '0 10px', borderRadius: 10, border: 'none', background: 'transparent',
  color: 'var(--text-3)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
}

export default function BudgetPlanner({ plan, masked }: { plan: BudgetPlan; masked: boolean }) {
  const { user } = useAuth()
  const { selectedMonth } = useAppStore()
  const refresh = useRefreshData()

  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [shown, setShown] = useState<Set<string>>(new Set())   // hidden rows the user opened via "Add"
  const [addOpen, setAddOpen] = useState<string | null>(null)

  const { cycle, suggestions } = plan
  const live = cycle.phase === 'live'

  function startEdit(r: PlanRow) {
    setEditing(r.key)
    setDraft(String(r.planned || r.avg3 || ''))
  }

  function cancelEdit() {
    setShown(prev => {
      if (!editing || !prev.has(editing)) return prev
      const next = new Set(prev); next.delete(editing); return next
    })
    setEditing(null)
  }

  async function saveRow(r: PlanRow, amount: number) {
    if (!user || saving) return
    setSaving(true)
    try {
      await setBudget(user.uid, selectedMonth, r.name, amount, r.kind === 'savings' ? 'savings' : undefined)
      await refresh()
      setEditing(null)
      toast.success(amount > 0 ? 'Budget saved' : 'Budget removed')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function fillMany(entries: BudgetEntry[], label: string) {
    if (!user || saving || entries.length === 0) return
    setSaving(true)
    try {
      await setBudgetsBatch(user.uid, selectedMonth, entries)
      await refresh()
      toast.success(label)
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const unsetCount = new Set([...suggestions.avgRows.map(r => r.key), ...suggestions.prevRows.map(p => p.row.key)]).size
  const prevLabel = format(parseISO(`${suggestions.prevMonth}-01`), 'MMMM')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* ── Setup banner ── */}
      {unsetCount > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '14px 18px', borderRadius: 16, background: 'var(--surface)', border: '1px dashed var(--border-strong)',
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0, flex: '1 1 260px' }}>
            <Sparkles size={16} style={{ color: 'var(--brand)', marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                {unsetCount} {unsetCount === 1 ? 'category has' : 'categories have'} no budget yet
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>
                Fill them in one go — you can adjust any one after.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {suggestions.prevRows.length > 0 && (
              <button
                className="btn-primary btn-sm"
                disabled={saving}
                onClick={() => fillMany(suggestions.prevRows.map(p => toEntry(p.row, p.planned)), `Copied ${prevLabel}’s plan`)}
              >
                Copy {prevLabel}’s plan · {money(suggestions.prevTotal, masked)}
              </button>
            )}
            {suggestions.avgRows.length > 0 && (
              <button
                className={suggestions.prevRows.length > 0 ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}
                disabled={saving}
                onClick={() => fillMany(suggestions.avgRows.map(r => toEntry(r, r.avg3)), 'Filled from your 3-month average')}
              >
                Use 3-month average · {money(suggestions.avgTotal, masked)}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Bucket groups ── */}
      {plan.groups.map(g => (
        <GroupSection
          key={g.bucket}
          group={g}
          plan={plan}
          masked={masked}
          shown={shown}
          addOpen={addOpen === g.bucket}
          onToggleAdd={() => setAddOpen(prev => prev === g.bucket ? null : g.bucket)}
          onAdd={r => { setShown(prev => new Set(prev).add(r.key)); setAddOpen(null); startEdit(r) }}
          editing={editing}
          draft={draft}
          saving={saving}
          onDraft={v => setDraft(v.replace(/[^\d]/g, ''))}
          onStartEdit={startEdit}
          onCancel={cancelEdit}
          onSave={(r, amount) => saveRow(r, amount)}
        />
      ))}

      {live && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-3)', padding: '0 4px' }}>
          <span style={{ width: 2, height: 12, borderRadius: 1, background: 'var(--text-3)', flexShrink: 0 }} />
          Safe line: stay under it and what you usually spend in the rest of the month still fits the budget. Based on your last 3 months. Click any amount to edit.
        </div>
      )}
    </div>
  )
}

// ── Group ──────────────────────────────────────────────────────────────────────

interface GroupProps {
  group: PlanGroup
  plan: BudgetPlan
  masked: boolean
  shown: Set<string>
  addOpen: boolean
  onToggleAdd: () => void
  onAdd: (r: PlanRow) => void
  editing: string | null
  draft: string
  saving: boolean
  onDraft: (v: string) => void
  onStartEdit: (r: PlanRow) => void
  onCancel: () => void
  onSave: (r: PlanRow, amount: number) => void
}

function GroupSection({ group: g, plan, masked, shown, addOpen, onToggleAdd, onAdd, ...rowProps }: GroupProps) {
  const meta = BUCKET_META[g.bucket]
  const isSavings = g.bucket === 'savings'
  const rows = [...g.rows, ...g.hidden.filter(r => shown.has(r.key))]
  const addable = g.hidden.filter(r => !shown.has(r.key))

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '4px 12px', padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: meta.color, alignSelf: 'center' }} />
          <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>{meta.label}</span>
          <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{meta.desc}</span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
          {isSavings ? 'Saved' : 'Spent'} <b style={{ color: 'var(--text)', fontWeight: 700 }}>{money(g.actual, masked)}</b>
          {' · '}planned <b style={{ color: 'var(--text)', fontWeight: 700 }}>{money(g.planned, masked)}</b>
          {g.target > 0 && <> / {money(g.target, masked)} target</>}
        </div>
      </div>

      <div className="card-flat" style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--elev)' }}>
        {rows.length === 0 && (
          <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--text-3)' }}>
            {isSavings ? 'No savings plans yet.' : 'No activity in this bucket yet.'}
          </div>
        )}
        {rows.map((r, i) => (
          <PlanRowView key={r.key} row={r} first={i === 0} plan={plan} masked={masked} {...rowProps} />
        ))}

        {addable.length > 0 && (
          <div style={{ borderTop: rows.length ? '1px solid var(--border)' : 'none', padding: '8px 12px' }}>
            <button onClick={onToggleAdd} style={{ ...ghostButton, display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-2)' }}>
              <Plus size={13} /> {isSavings ? 'Add a savings plan' : 'Add a category'}
            </button>
            {addOpen && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '6px 4px 6px' }}>
                {addable.map(r => (
                  <button
                    key={r.key}
                    onClick={() => onAdd(r)}
                    style={{ ...linkButton, height: 30, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <RowIcon row={r} size={13} /> {rowName(r)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

// ── Row ────────────────────────────────────────────────────────────────────────

function RowIcon({ row, size }: { row: PlanRow; size: number }) {
  return row.isVehicle
    ? <SavingsIcon vehicle={row.name} size={size} />
    : <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}><CategoryIcon category={row.name} size={size} /></span>
}

interface RowProps {
  row: PlanRow
  first: boolean
  plan: BudgetPlan
  masked: boolean
  editing: string | null
  draft: string
  saving: boolean
  onDraft: (v: string) => void
  onStartEdit: (r: PlanRow) => void
  onCancel: () => void
  onSave: (r: PlanRow, amount: number) => void
}

function PlanRowView({ row: r, first, plan, masked, editing, draft, saving, onDraft, onStartEdit, onCancel, onSave }: RowProps) {
  const { cycle } = plan
  const isEditing = editing === r.key
  const isSavings = r.bucket === 'savings'
  const meta = BUCKET_META[r.bucket]
  const remaining = r.planned - r.actual

  let sub: string
  let subColor = 'var(--text-3)'
  let barColor = meta.color
  switch (r.status) {
    case 'none':
      sub = r.actual > 0 ? `${isSavings ? 'Saved' : 'Spent'} ${money(r.actual, masked)} · no ${isSavings ? 'plan' : 'budget'}`
        : r.lastMonth > 0 ? `${money(r.lastMonth, masked)} last month · no ${isSavings ? 'plan' : 'budget'}`
        : `No ${isSavings ? 'plan' : 'budget'} yet`
      break
    case 'over':
      sub = `Over by ${money(-remaining, masked)}`; subColor = 'var(--bad-ink)'; barColor = 'var(--bad)'
      break
    case 'met':
      sub = 'Limit met · stop here'; subColor = 'var(--good-ink)'; barColor = 'var(--good)'
      break
    case 'ahead':
      sub = remaining <= r.planned * 0.05
        ? `Limit nearly reached · ~${money(r.rest, masked)} more usually comes`
        : `${money(remaining, masked)} left · heading ${money(r.forecast - r.planned, masked)} over`
      subColor = 'var(--warn-ink)'; barColor = 'var(--warn)'
      break
    case 'saved':
      sub = r.actual > r.planned ? `${money(r.actual - r.planned, masked)} above plan` : 'Plan met'
      subColor = 'var(--good-ink)'
      break
    case 'short':
      sub = cycle.phase === 'past' ? `Fell ${money(remaining, masked)} short` : `${money(remaining, masked)} to go`
      break
    default: {
      const spare = r.planned - r.forecast
      sub = cycle.phase === 'live'
        ? spare >= Math.max(100, r.planned * 0.05)
          ? `${money(remaining, masked)} left · ~${money(spare, masked)} to spare`
          : `${money(remaining, masked)} left · on track`
        : cycle.phase === 'past' ? `${money(remaining, masked)} unspent` : `${money(r.planned, masked)} planned`
    }
  }

  // Something major happened: savings beaten (green), or a limit broken / savings
  // plan missed near or after the end of the cycle (red).
  const missedSaving = r.status === 'short' && (cycle.phase === 'past' || (cycle.phase === 'live' && cycle.daysLeft <= 5))
  const flare = r.status === 'saved' && r.actual > r.planned ? 'flare-seg flare-good'
    : r.status === 'over' || missedSaving ? 'flare-seg flare-bad'
    : undefined

  const pct = r.planned > 0 ? Math.min(100, (r.actual / r.planned) * 100) : 0
  const showMarker = cycle.phase === 'live' && r.safeMark !== null && r.safeMark < 1 && !isSavings

  function commit() {
    onSave(r, Number(draft) || 0)
  }

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 24px',
      padding: '14px 18px', borderTop: first ? 'none' : '1px solid var(--border)',
      background: isEditing ? 'var(--surface-2)' : 'transparent', transition: 'background .12s',
    }}>
      {/* Name + status */}
      <div style={{ flex: '1 1 210px', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--surface-2)',
        }}>
          <RowIcon row={r} size={16} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rowName(r)}
          </div>
          <div style={{ fontSize: 12, color: subColor, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sub}
          </div>
        </div>
      </div>

      {/* Editing */}
      {isEditing ? (
        <div style={{ flex: '2 1 300px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
          {r.lastMonth > 0 && (
            <button style={{ ...ghostButton, height: 30, border: '1px solid var(--border)' }} onClick={() => onDraft(String(Math.round(r.lastMonth)))}>
              Last month {money(r.lastMonth, masked)}
            </button>
          )}
          {r.avg3 > 0 && (
            <button style={{ ...ghostButton, height: 30, border: '1px solid var(--border)' }} onClick={() => onDraft(String(r.avg3))}>
              3-mo avg {money(r.avg3, masked)}
            </button>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 10px', borderRadius: 10,
            border: '1px solid var(--brand)', background: 'var(--surface)',
            boxShadow: '0 0 0 3px color-mix(in oklch, var(--brand) 15%, transparent)',
          }}>
            <span style={{ color: 'var(--text-3)', fontSize: 13 }}>₹</span>
            <input
              autoFocus
              inputMode="numeric"
              value={draft}
              placeholder="Amount"
              onChange={e => onDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel() }}
              style={{ width: 90, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}
            />
          </div>
          <button className="btn-primary btn-sm" style={{ height: 34 }} disabled={saving} onClick={commit}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {r.planned > 0 && (
            <button style={{ ...ghostButton, color: 'var(--bad-ink)' }} disabled={saving} onClick={() => onSave(r, 0)}>
              Remove
            </button>
          )}
          <button style={ghostButton} onClick={onCancel}>Cancel</button>
        </div>
      ) : r.planned > 0 ? (
        /* Progress */
        <div style={{ flex: '2 1 300px', display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <div style={{ position: 'relative', flex: 1, height: 8, borderRadius: 4, background: 'var(--surface-3)', minWidth: 80 }}>
            {showMarker && (
              // Beyond the safe line: budget the rest of the month usually needs.
              <div style={{
                position: 'absolute', top: 0, bottom: 0, right: 0, borderRadius: '0 4px 4px 0',
                left: `${(r.safeMark ?? 0) * 100}%`,
                background: 'repeating-linear-gradient(135deg, transparent 0 3px, color-mix(in oklch, var(--text-3) 22%, transparent) 3px 5px)',
              }} />
            )}
            <div className={flare} style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4,
              width: `${pct}%`, background: barColor, transition: 'width .5s cubic-bezier(.22,1,.36,1)',
            }} />
            {showMarker && (
              <div
                title={`Safe line · stay under ${money(r.planned * (r.safeMark ?? 0), masked)} and the usual ${money(r.rest, masked)} for the rest of the month still fits`}
                style={{
                  position: 'absolute', top: -4, bottom: -4, width: 2, borderRadius: 1,
                  background: 'var(--text-3)', left: `calc(${(r.safeMark ?? 0) * 100}% - 1px)`,
                }}
              />
            )}
          </div>
          <button
            onClick={() => onStartEdit(r)}
            title="Edit budget"
            style={{
              minWidth: 150, textAlign: 'right', border: 'none', background: 'transparent', cursor: 'pointer',
              padding: '6px 8px', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: 'var(--text)',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {money(r.actual, masked)} <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>/ {money(r.planned, masked)}</span>
          </button>
        </div>
      ) : (
        /* No budget */
        <div style={{ flex: '2 1 300px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
          {r.avg3 > 0 && (
            <button style={linkButton} disabled={saving} onClick={() => onSave(r, r.avg3)}>
              Use {money(r.avg3, masked)} <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>· 3-mo avg</span>
            </button>
          )}
          <button style={r.avg3 > 0 ? ghostButton : linkButton} onClick={() => onStartEdit(r)}>
            {r.avg3 > 0 ? 'Custom' : isSavings ? 'Set plan' : 'Set budget'}
          </button>
        </div>
      )}
    </div>
  )
}
