'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, TrendingDown, TrendingUp, Minus, Calendar, AlertCircle, Zap, ChevronDown, Pencil } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { FinancialPulse } from '@/types'
import { formatCurrency, formatCurrencyFull } from '@/lib/utils'
import { CategoryIcon, getCategoryDisplayName, GoalIcon } from '@/lib/categoryIcons'

// ── Color maps ───────────────────────────────────────────────────────────────

const HEALTH_COLOR = {
  excellent: { bg: 'var(--good-soft)',  ink: 'var(--good-ink)',  bar: 'var(--good)'  },
  good:      { bg: 'var(--brand-soft)', ink: 'var(--brand-ink)', bar: 'var(--brand)' },
  caution:   { bg: 'var(--warn-soft)',  ink: 'var(--warn-ink)',  bar: 'var(--warn)'  },
  critical:  { bg: 'var(--bad-soft)',   ink: 'var(--bad-ink)',   bar: 'var(--bad)'   },
}

const ALLOC_COLOR: Record<string, string> = {
  ef:            'var(--info)',
  project:       'var(--brand)',
  sip:           'oklch(0.62 0.17 285)',
  buffer:        'var(--warn)',
  discretionary: 'var(--good)',
  repayment:     'var(--bad)',
}

// ── Tiny sub-components ──────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 12 }}>
      {children}
    </div>
  )
}

function MiniBar({ pct, color = 'var(--brand)', max = 100 }: { pct: number; color?: string; max?: number }) {
  const fill = Math.min((pct / max) * 100, 100)
  return (
    <div style={{ height: 4, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ height: '100%', width: `${fill}%`, background: color, borderRadius: 99, transition: 'width .4s ease' }} />
    </div>
  )
}

// ── Section: Health Score ────────────────────────────────────────────────────

function HealthSection({ health }: { health: FinancialPulse['health'] }) {
  const c = HEALTH_COLOR[health.label]
  const dims = [
    { key: 'spendingControl',  label: 'Spending',    max: 30 },
    { key: 'efProgress',       label: 'Emrg. Fund',  max: 20 },
    { key: 'savingsMomentum',  label: 'Savings',     max: 20 },
    { key: 'goalsProgress',    label: 'Goals',       max: 15 },
    { key: 'borrowingHealth',  label: 'Debt',        max: 15 },
  ] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Score + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18, flexShrink: 0,
          background: c.bg, color: c.ink,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{health.score}</span>
          <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.8 }}>/ 100</span>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', lineHeight: 1 }}>
            {health.label.charAt(0).toUpperCase() + health.label.slice(1)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
            Financial health this month
          </div>
          {/* Overall bar */}
          <div style={{ marginTop: 8, width: 200 }}>
            <MiniBar pct={health.score} color={c.bar} />
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {dims.map(d => {
          const val = health.breakdown[d.key]
          return (
            <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-2)', width: 80, flexShrink: 0 }}>{d.label}</span>
              <div style={{ flex: 1 }}>
                <MiniBar pct={val} color={c.bar} max={d.max} />
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--text-3)', width: 36, textAlign: 'right', flexShrink: 0 }}>
                {val}/{d.max}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Section: Cash Position ───────────────────────────────────────────────────

function Row({ label, sub, value, color, indent = false }: {
  label: string; sub?: string; value: string; color: string; indent?: boolean
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
      padding: indent ? '5px 0 5px 14px' : '9px 0',
      borderBottom: indent ? 'none' : '1px solid var(--border)',
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: indent ? 12 : 13, color: indent ? 'var(--text-4)' : 'var(--text-2)' }}>{label}</span>
        {sub && <div style={{ fontSize: 11, color: 'var(--info-ink)', fontStyle: 'italic', marginTop: 1 }}>{sub}</div>}
      </div>
      <span style={{ fontSize: indent ? 12 : 13, fontWeight: indent ? 500 : 600, color, flexShrink: 0 }}>{value}</span>
    </div>
  )
}

function CashSection({ cash }: { cash: FinancialPulse['cashPosition'] }) {
  const positive  = cash.surplusNet >= 0
  const totalIn   = cash.monthIncome + cash.carryForward
  const totalOut  = cash.monthExpenses + cash.savingsContributed + cash.totalLent + cash.upcomingTotal

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── IN ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--good)', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>In</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{formatCurrencyFull(totalIn)}</span>
      </div>
      {/* In sub-rows */}
      <Row label="↑ income" value={`+ ${formatCurrencyFull(cash.monthIncome)}`} color="var(--text-3)"
        sub={cash.borrowedIncome > 0 ? `incl. ${formatCurrencyFull(cash.borrowedIncome)} borrowed` : undefined} indent />
      {cash.carryForward > 0 && (
        <Row label="↩ carried forward" value={`+ ${formatCurrencyFull(cash.carryForward)}`} color="var(--brand-ink)" indent />
      )}

      {/* ── OUT ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--surface-3)', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Out</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{formatCurrencyFull(totalOut)}</span>
      </div>
      {/* Out sub-rows */}
      <Row label="spent" value={`− ${formatCurrencyFull(cash.monthExpenses)}`} color="var(--text-3)" indent />
      {cash.savingsContributed > 0 && (
        <Row label="→ savings" value={`− ${formatCurrencyFull(cash.savingsContributed)}`} color="var(--brand-ink)" indent />
      )}
      {cash.totalLent > 0 && (
        <Row label="→ lent out" value={`− ${formatCurrencyFull(cash.totalLent)}`} color="var(--warn-ink)" indent />
      )}
      {cash.upcomingTotal > 0 && (
        <Row label="reserved ahead" value={`− ${formatCurrencyFull(cash.upcomingTotal)}`} color="var(--warn-ink)" indent />
      )}

      {/* ── SURPLUS ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Surplus</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: positive ? 'var(--good-ink)' : 'var(--bad-ink)' }}>
          {positive ? '+' : '−'}{formatCurrencyFull(Math.abs(cash.surplusNet))}
        </span>
      </div>

      {cash.daysLeft > 0 && cash.freeCash > 0 && (
        <div style={{
          padding: '10px 14px', borderRadius: 10,
          background: 'var(--surface-2)',
          fontSize: 12, color: 'var(--text-3)',
          display: 'flex', gap: 6, alignItems: 'center',
        }}>
          <Calendar size={13} />
          <span>
            <strong style={{ color: 'var(--text-2)' }}>{formatCurrencyFull(cash.dailyBudget)}/day</strong>
            {' '}to spend freely for the next {cash.daysLeft} days
          </span>
        </div>
      )}
    </div>
  )
}

// ── Section: Upcoming ────────────────────────────────────────────────────────

function UpcomingSection({ items }: { items: FinancialPulse['upcoming'] }) {
  if (items.length === 0) {
    return (
      <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '8px 0' }}>
        Nothing due in the next 30 days.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => {
        const overdue = item.isOverdue
        const urgent = !overdue && item.daysUntil <= 5
        const accent = overdue ? 'var(--bad)' : 'var(--warn)'
        const accentInk = overdue ? 'var(--bad-ink)' : 'var(--warn-ink)'
        const daysOverdue = Math.abs(item.daysUntil)
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 10,
            background: (overdue || urgent) ? `color-mix(in oklch, ${accent} 8%, transparent)` : 'var(--surface-2)',
            border: (overdue || urgent) ? `1px solid color-mix(in oklch, ${accent} 25%, transparent)` : '1px solid transparent',
          }}>
            {overdue && <AlertCircle size={15} style={{ color: accentInk, flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.label}
              </div>
              <div style={{ fontSize: 11.5, color: (overdue || urgent) ? accentInk : 'var(--text-3)', marginTop: 2, fontWeight: overdue ? 600 : 400 }}>
                {overdue
                  ? `Overdue by ${daysOverdue} ${daysOverdue === 1 ? 'day' : 'days'}`
                  : item.daysUntil === 0 ? 'Due today' : item.daysUntil === 1 ? 'Due tomorrow' : `in ${item.daysUntil} days`}
                {' · '}{format(parseISO(item.dueDate), 'MMM d')}
              </div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: overdue ? accentInk : 'var(--text)', flexShrink: 0 }}>
              {formatCurrency(item.amount)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Allocation row ────────────────────────────────────────────────────────────

interface AllocRowProps {
  label: string; reason: string; amount: number; type: string; freeCash: number;
  isEditing?: boolean; editVal?: string;
  onEditStart?: () => void;
  onEditChange?: (v: string) => void;
  onEditConfirm?: () => void;
  onEditCancel?: () => void;
  onSkip?: () => void;
}

function AllocRow({ label, reason, amount, type, freeCash, isEditing, editVal, onEditStart, onEditChange, onEditConfirm, onEditCancel, onSkip }: AllocRowProps) {
  const pct   = Math.round((amount / freeCash) * 100)
  const color = ALLOC_COLOR[type] ?? 'var(--brand)'
  const ib: React.CSSProperties = {
    width: 20, height: 20, borderRadius: 6, border: 'none',
    background: 'var(--surface-3)', color: 'var(--text-3)',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 14, lineHeight: '1', flexShrink: 0,
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
          <span style={{ fontSize: 11.5, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reason}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, marginLeft: 8 }}>
          {!isEditing && <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{pct}%</span>}
          {isEditing ? (
            <>
              <input
                autoFocus
                value={editVal ?? ''}
                onChange={e => onEditChange?.(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onEditConfirm?.(); if (e.key === 'Escape') onEditCancel?.() }}
                type="number" min={500}
                style={{
                  width: 86, background: 'var(--surface-2)', border: '1px solid var(--brand)',
                  borderRadius: 6, padding: '2px 6px', outline: 'none',
                  fontSize: 13, fontWeight: 600, color: 'var(--text)', textAlign: 'right',
                }}
              />
              <button onClick={onEditConfirm} title="Confirm" style={{ ...ib, background: 'var(--brand)', color: '#fff', width: 22, height: 22 }}>✓</button>
              <button onClick={onEditCancel}  title="Cancel"  style={ib}>✕</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{formatCurrencyFull(amount)}</span>
              {onEditStart && (
                <button onClick={onEditStart} title="Edit amount" style={ib}>
                  <Pencil size={11} />
                </button>
              )}
              {onSkip && (
                <button onClick={onSkip} title="Skip suggestion" style={ib}>×</button>
              )}
            </>
          )}
        </div>
      </div>
      <MiniBar pct={pct} color={color} />
    </div>
  )
}

// ── Section: Allocations ─────────────────────────────────────────────────────

type EditTarget = { type: 'orig'; idx: number; val: string } | { type: 'custom'; idx: number; val: string }

function AllocationsSection({ allocations, freeCash, savingsContributed, upcomingIncome }: {
  allocations: FinancialPulse['allocations']
  freeCash: number
  savingsContributed: number
  upcomingIncome: number
}) {
  const [skipped, setSkipped]           = useState<Set<number>>(new Set())
  const [overrides, setOverrides]       = useState<Record<number, number>>({})
  const [custom, setCustom]             = useState<Array<{ label: string; amount: number }>>([])
  const [editing, setEditing]           = useState<EditTarget | null>(null)
  const [addingNew, setAddingNew]       = useState(false)
  const [newLabel, setNewLabel]         = useState('')
  const [newAmountStr, setNewAmountStr] = useState('')

  if (allocations.length === 0) return null

  // Effective amount for an item (live during editing)
  function origAmt(a: FinancialPulse['allocations'][0], idx: number): number {
    if (editing?.type === 'orig' && editing.idx === idx) return Math.max(0, parseInt(editing.val) || 0)
    return overrides[idx] ?? a.amount
  }
  function custAmt(i: number): number {
    if (editing?.type === 'custom' && editing.idx === i) return Math.max(0, parseInt(editing.val) || 0)
    return custom[i].amount
  }

  const activeOriginal = allocations
    .map((a, i) => ({ ...a, origIdx: i }))
    .filter(a => !skipped.has(a.origIdx) && a.type !== 'discretionary')

  const nonDiscTotal     = activeOriginal.reduce((s, a) => s + origAmt(a, a.origIdx), 0)
  const customTotal      = custom.reduce((s, _, i) => s + custAmt(i), 0)
  const discretionaryAmt = Math.max(0, freeCash - nonDiscTotal - customTotal)

  const skippedList = Array.from(skipped).map(i => ({ ...allocations[i], origIdx: i }))

  function confirmEdit() {
    if (!editing) return
    const val = parseInt(editing.val)
    if (isNaN(val) || val < 500) { setEditing(null); return }
    if (editing.type === 'orig') {
      setOverrides(prev => ({ ...prev, [editing.idx]: val }))
    } else {
      setCustom(prev => prev.map((c, i) => i === editing.idx ? { ...c, amount: val } : c))
    }
    setEditing(null)
  }

  const parsedNewAmt = Math.round(parseFloat(newAmountStr))
  const newAmtValid  = !isNaN(parsedNewAmt) && parsedNewAmt >= 500 && parsedNewAmt <= discretionaryAmt - 500
  const canAdd       = !addingNew && !editing && discretionaryAmt >= 1500

  function handleAdd() {
    if (!newLabel.trim() || !newAmtValid) return
    setCustom(prev => [...prev, { label: newLabel.trim(), amount: parsedNewAmt }])
    setNewLabel(''); setNewAmountStr(''); setAddingNew(false)
  }

  const ib: React.CSSProperties = {
    width: 20, height: 20, borderRadius: 6, border: 'none',
    background: 'var(--surface-3)', color: 'var(--text-3)',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 14, lineHeight: '1', flexShrink: 0,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 4 }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          Suggested split of {formatCurrencyFull(freeCash)}
        </div>
        {savingsContributed > 0 && (
          <div style={{ fontSize: 11, color: 'var(--brand-ink)' }}>
            ✓ {formatCurrencyFull(savingsContributed)} already saved this month · add more anytime
          </div>
        )}
      </div>

      {/* Upcoming income banner */}
      {upcomingIncome > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 10,
          background: 'color-mix(in oklch, var(--good) 12%, var(--surface))',
          border: '1px solid color-mix(in oklch, var(--good) 25%, transparent)',
          marginBottom: 4,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: 'color-mix(in oklch, var(--good) 20%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14,
          }}>↑</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--good-ink)' }}>
              +{formatCurrencyFull(upcomingIncome)} incoming
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
              pending receipt · your allocation room grows once received
            </div>
          </div>
        </div>
      )}

      {activeOriginal.map(a => {
        const isEdit = editing?.type === 'orig' && editing.idx === a.origIdx
        return (
          <AllocRow
            key={a.origIdx}
            label={a.label} reason={a.reason} amount={origAmt(a, a.origIdx)} type={a.type} freeCash={freeCash}
            isEditing={isEdit} editVal={isEdit ? editing!.val : undefined}
            onEditStart={() => setEditing({ type: 'orig', idx: a.origIdx, val: String(origAmt(a, a.origIdx)) })}
            onEditChange={v => setEditing(prev => prev ? { ...prev, val: v } : prev)}
            onEditConfirm={confirmEdit}
            onEditCancel={() => setEditing(null)}
            onSkip={() => { setEditing(null); setSkipped(prev => new Set(Array.from(prev).concat(a.origIdx))) }}
          />
        )
      })}

      {custom.map((c, i) => {
        const isEdit = editing?.type === 'custom' && editing.idx === i
        return (
          <AllocRow
            key={`custom-${i}`}
            label={c.label} reason="Custom allocation" amount={custAmt(i)} type="project" freeCash={freeCash}
            isEditing={isEdit} editVal={isEdit ? editing!.val : undefined}
            onEditStart={() => setEditing({ type: 'custom', idx: i, val: String(custAmt(i)) })}
            onEditChange={v => setEditing(prev => prev ? { ...prev, val: v } : prev)}
            onEditConfirm={confirmEdit}
            onEditCancel={() => setEditing(null)}
            onSkip={() => { setEditing(null); setCustom(prev => prev.filter((_, j) => j !== i)) }}
          />
        )
      })}

      {discretionaryAmt > 0 && (
        <AllocRow
          label="Discretionary"
          reason={skippedList.length > 0 ? 'Includes freed-up amounts' : 'Truly yours to spend freely'}
          amount={discretionaryAmt} type="discretionary" freeCash={freeCash}
        />
      )}

      {skippedList.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: 2 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', width: '100%', marginBottom: 2 }}>Skipped — tap to restore</span>
          {skippedList.map(a => (
            <button
              key={a.origIdx}
              onClick={() => setSkipped(prev => { const n = new Set(Array.from(prev)); n.delete(a.origIdx); return n })}
              style={{
                padding: '3px 10px', borderRadius: 99, fontSize: 11.5,
                background: 'var(--surface-2)', border: '1px dashed var(--border)',
                color: 'var(--text-3)', cursor: 'pointer',
              }}
            >↩ {a.label}</button>
          ))}
        </div>
      )}

      {canAdd && (
        <button
          onClick={() => setAddingNew(true)}
          style={{
            alignSelf: 'flex-start', marginTop: 4, padding: '4px 12px', borderRadius: 99, fontSize: 12,
            background: 'transparent', border: '1px dashed var(--border-strong)',
            color: 'var(--text-3)', cursor: 'pointer',
          }}
        >+ Add allocation</button>
      )}

      {addingNew && (
        <div style={{
          display: 'flex', gap: 6, alignItems: 'center', marginTop: 4,
          padding: '8px 10px', borderRadius: 10,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
        }}>
          <input
            autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && (setAddingNew(false), setNewLabel(''), setNewAmountStr(''))}
            placeholder="Label (e.g. Vacation fund)"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', minWidth: 0 }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>₹</span>
          <input
            value={newAmountStr} onChange={e => setNewAmountStr(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAddingNew(false); setNewLabel(''); setNewAmountStr('') } }}
            placeholder={`max ${formatCurrency(discretionaryAmt)}`}
            type="number" min={500} max={discretionaryAmt - 500}
            style={{ width: 100, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', textAlign: 'right', flexShrink: 0 }}
          />
          <button
            onClick={handleAdd} disabled={!newLabel.trim() || !newAmtValid}
            style={{
              padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500, border: 'none', flexShrink: 0,
              background: newLabel.trim() && newAmtValid ? 'var(--brand)' : 'var(--surface-3)',
              color: newLabel.trim() && newAmtValid ? '#fff' : 'var(--text-3)',
              cursor: newLabel.trim() && newAmtValid ? 'pointer' : 'default',
            }}
          >Add</button>
          <button onClick={() => { setAddingNew(false); setNewLabel(''); setNewAmountStr('') }} style={ib}>×</button>
        </div>
      )}
    </div>
  )
}

// ── Section: Spend Analysis ──────────────────────────────────────────────────

function SpendSection({ items }: { items: FinancialPulse['spendAnalysis'] }) {
  if (items.length === 0) {
    return <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '8px 0' }}>No expenses logged yet.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {items.map((item, i) => {
        const isUp   = item.changePct !== null && item.changePct > 5
        const isDown = item.changePct !== null && item.changePct < -5
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 0',
            borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={{ flexShrink: 0, color: 'var(--text-3)' }}><CategoryIcon category={item.category} size={18} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{getCategoryDisplayName(item.category)}</div>
              {item.changePct !== null && (
                <div style={{ fontSize: 11.5, color: isUp ? 'var(--bad-ink)' : isDown ? 'var(--good-ink)' : 'var(--text-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                  {isUp ? <TrendingUp size={10} /> : isDown ? <TrendingDown size={10} /> : <Minus size={10} />}
                  {item.changePct > 0 ? '+' : ''}{item.changePct.toFixed(0)}% vs last month
                </div>
              )}
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>
              {formatCurrencyFull(item.amount)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Section: Goals ───────────────────────────────────────────────────────────

function GoalsSection({ goals }: { goals: FinancialPulse['goals'] }) {
  if (goals.length === 0) {
    return <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '8px 0' }}>No goals set yet.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {goals.map((g, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <GoalIcon emoji={g.emoji} size={16} color="var(--text-3)" />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{g.label}</span>
              {g.dueDate && (
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  · {format(parseISO(g.dueDate), 'MMM d')}
                </span>
              )}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>
              {g.pct.toFixed(0)}% · {formatCurrency(g.current)} / {formatCurrency(g.target)}
            </span>
          </div>
          <MiniBar pct={g.pct} color={g.type === 'ef' ? 'var(--info)' : 'var(--brand)'} />
        </div>
      ))}
    </div>
  )
}

// ── Section: Borrowings to Settle (accordion) ───────────────────────────────

function BorrowingsToSettleSection({ alerts }: { alerts: FinancialPulse['borrowingAlerts'] }) {
  const [expanded, setExpanded] = useState(false)
  if (alerts.length === 0) return null

  const total = alerts.reduce((s, a) => s + a.outstanding, 0)
  const overdueCount = alerts.filter(a => a.isOverdue).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '10px 12px', borderRadius: 10,
          background: overdueCount > 0 ? 'var(--bad-soft)' : 'var(--surface-2)',
          border: `1px solid ${overdueCount > 0 ? 'color-mix(in oklch, var(--bad) 25%, transparent)' : 'transparent'}`,
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {overdueCount > 0 && <AlertCircle size={14} style={{ color: 'var(--bad-ink)', flexShrink: 0 }} />}
          <span style={{ fontSize: 13, fontWeight: 500, color: overdueCount > 0 ? 'var(--bad-ink)' : 'var(--text)' }}>
            {alerts.length} {alerts.length === 1 ? 'repayment' : 'repayments'} pending
            {overdueCount > 0 && ` · ${overdueCount} overdue`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: overdueCount > 0 ? 'var(--bad-ink)' : 'var(--text)' }}>
            {formatCurrencyFull(total)}
          </span>
          <ChevronDown
            size={15}
            style={{
              color: 'var(--text-3)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform .2s ease',
            }}
          />
        </div>
      </button>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          {alerts.map((a, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 10,
              background: a.isOverdue ? 'var(--bad-soft)' : 'var(--surface-2)',
              border: `1px solid ${a.isOverdue ? 'color-mix(in oklch, var(--bad) 25%, transparent)' : 'var(--border)'}`,
            }}>
              {a.isOverdue && <AlertCircle size={13} style={{ color: 'var(--bad-ink)', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Owe {a.person}</div>
                <div style={{ fontSize: 11.5, color: a.isOverdue ? 'var(--bad-ink)' : 'var(--text-3)', marginTop: 2 }}>
                  {a.isOverdue
                    ? `Overdue by ${a.daysOverdue} day${a.daysOverdue !== 1 ? 's' : ''}`
                    : a.dueDate ? `Due ${format(parseISO(a.dueDate), 'MMM d')}` : 'No due date'}
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: a.isOverdue ? 'var(--bad-ink)' : 'var(--text)', flexShrink: 0 }}>
                {formatCurrencyFull(a.outstanding)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Section: Lent to Others (accordion) ─────────────────────────────────────

function LentSection({ alerts }: { alerts: FinancialPulse['borrowingAlerts'] }) {
  const [expanded, setExpanded] = useState(false)
  if (alerts.length === 0) return null

  const total = alerts.reduce((s, a) => s + a.outstanding, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <SectionTitle>Lent to Others</SectionTitle>
      {/* Accordion header */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '10px 12px', borderRadius: 10,
          background: 'var(--surface-2)', border: '1px solid transparent',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
          {alerts.length} {alerts.length === 1 ? 'person owes' : 'people owe'} you
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--good-ink)' }}>
            {formatCurrencyFull(total)}
          </span>
          <ChevronDown
            size={15}
            style={{
              color: 'var(--text-3)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform .2s ease',
            }}
          />
        </div>
      </button>

      {/* Expanded rows */}
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          {alerts.map((a, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 10,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{a.person}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                  {a.dueDate
                    ? `Due ${format(parseISO(a.dueDate), 'MMM d')}`
                    : 'No due date'}
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>
                {formatCurrencyFull(a.outstanding)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main sheet component ─────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  pulse: FinancialPulse
}

export default function PulseSheet({ open, onClose, pulse }: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open || !mounted) return null

  const monthLabel        = format(parseISO(`${pulse.month}-01`), 'MMMM yyyy')
  const colors            = HEALTH_COLOR[pulse.health.label]
  const genTime           = format(new Date(pulse.generatedAt), 'h:mm a')
  const borrowingsToSettle = pulse.borrowingAlerts.filter(a => a.type === 'borrowed')
  const lentAlerts         = pulse.borrowingAlerts.filter(a => a.type === 'lent')

  const sheet = (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        className="pulse-sheet-enter"
        style={{
          width: '100%', maxWidth: 620,
          maxHeight: '92vh',
          background: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div style={{
          padding: '10px 20px 14px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}><Zap size={14} /> {monthLabel} Pulse</span>
              <span style={{
                fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                background: colors.bg, color: colors.ink,
              }}>
                {pulse.health.score} · {pulse.health.label.charAt(0).toUpperCase() + pulse.health.label.slice(1)}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>Generated at {genTime}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: 'var(--surface-2)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-3)',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{
            margin: 16, padding: '12px 16px', borderRadius: 12,
            background: colors.bg, color: colors.ink,
            fontSize: 13, fontWeight: 500, lineHeight: 1.4,
          }}>
            {pulse.headline}
          </div>

          <div style={{ padding: '0 20px 48px', display: 'flex', flexDirection: 'column', gap: 28 }}>

            <div>
              <SectionTitle>Financial Health</SectionTitle>
              <HealthSection health={pulse.health} />
            </div>

            <div>
              <SectionTitle>Cash This Month</SectionTitle>
              <CashSection cash={pulse.cashPosition} />
            </div>

            <div>
              <SectionTitle>Upcoming · Next 30 Days</SectionTitle>
              <UpcomingSection items={pulse.upcoming} />
            </div>

            {pulse.allocations.length > 0 && (
              <div>
                <SectionTitle>How to Allocate Free Cash</SectionTitle>
                <AllocationsSection
                  allocations={pulse.allocations}
                  freeCash={pulse.cashPosition.freeCash}
                  savingsContributed={pulse.cashPosition.savingsContributed}
                  upcomingIncome={pulse.cashPosition.upcomingIncome}
                />
              </div>
            )}

            {pulse.spendAnalysis.length > 0 && (
              <div>
                <SectionTitle>Where You Spent</SectionTitle>
                <SpendSection items={pulse.spendAnalysis} />
              </div>
            )}

            <div>
              <SectionTitle>Goals Progress</SectionTitle>
              <GoalsSection goals={pulse.goals} />
            </div>

            {borrowingsToSettle.length > 0 && (
              <div>
                <SectionTitle>Borrowings to Settle</SectionTitle>
                <BorrowingsToSettleSection alerts={borrowingsToSettle} />
              </div>
            )}

            {lentAlerts.length > 0 && (
              <LentSection alerts={lentAlerts} />
            )}

          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(sheet, document.body)
}
