'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, TrendingDown, TrendingUp, Minus, Calendar, AlertCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { FinancialPulse } from '@/types'
import { formatCurrency, formatCurrencyFull, CATEGORY_EMOJI } from '@/lib/utils'

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
  buffer:        'var(--warn)',
  discretionary: 'var(--good)',
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

function CashSection({ cash }: { cash: FinancialPulse['cashPosition'] }) {
  const rows = [
    { label: 'Income received',  amount: cash.monthIncome,   sign: '+', color: 'var(--good)' },
    { label: 'Spent so far',     amount: -cash.monthExpenses, sign: '−', color: 'var(--bad)' },
    { label: 'Reserved ahead',   amount: -cash.upcomingTotal, sign: '−', color: 'var(--warn)', hide: cash.upcomingTotal === 0 },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {rows.filter(r => !r.hide).map((r, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '9px 0',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{r.label}</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: r.color }}>
            {r.sign} {formatCurrencyFull(Math.abs(r.amount))}
          </span>
        </div>
      ))}

      {/* Free cash total */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Free cash</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: cash.freeCash > 0 ? 'var(--good)' : 'var(--bad)' }}>
          {formatCurrencyFull(cash.freeCash)}
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
            {' '}for the next {cash.daysLeft} days
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
        const urgent = item.daysUntil <= 5
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 10,
            background: urgent ? 'color-mix(in oklch, var(--warn) 8%, transparent)' : 'var(--surface-2)',
            border: urgent ? '1px solid color-mix(in oklch, var(--warn) 25%, transparent)' : '1px solid transparent',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.label}
              </div>
              <div style={{ fontSize: 11.5, color: urgent ? 'var(--warn-ink)' : 'var(--text-3)', marginTop: 2 }}>
                {item.daysUntil === 0 ? 'Due today' : item.daysUntil === 1 ? 'Due tomorrow' : `in ${item.daysUntil} days`}
                {' · '}{format(parseISO(item.dueDate), 'MMM d')}
              </div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>
              {formatCurrency(item.amount)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Section: Allocations ─────────────────────────────────────────────────────

function AllocationsSection({ allocations, freeCash }: { allocations: FinancialPulse['allocations']; freeCash: number }) {
  if (allocations.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
        Suggested split of {formatCurrencyFull(freeCash)}
      </div>
      {allocations.map((a, i) => {
        const pct = Math.round((a.amount / freeCash) * 100)
        const color = ALLOC_COLOR[a.type] ?? 'var(--brand)'
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{a.label}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{a.reason}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{pct}%</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{formatCurrencyFull(a.amount)}</span>
              </div>
            </div>
            <MiniBar pct={pct} color={color} />
          </div>
        )
      })}
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
        const emoji = CATEGORY_EMOJI[item.category] ?? '📦'
        const isUp   = item.changePct !== null && item.changePct > 5
        const isDown = item.changePct !== null && item.changePct < -5
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 0',
            borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{item.category}</div>
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
              <span style={{ fontSize: 16 }}>{g.emoji}</span>
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

// ── Section: Borrowing Alerts ────────────────────────────────────────────────

function BorrowingsSection({ alerts }: { alerts: FinancialPulse['borrowingAlerts'] }) {
  if (alerts.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {alerts.map((a, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 10,
          background: a.isOverdue ? 'var(--bad-soft)' : 'var(--surface-2)',
          border: `1px solid ${a.isOverdue ? 'color-mix(in oklch, var(--bad) 25%, transparent)' : 'transparent'}`,
        }}>
          {a.isOverdue && <AlertCircle size={14} style={{ color: 'var(--bad-ink)', flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
              {a.type === 'borrowed' ? `Owe ${a.person}` : `${a.person} owes you`}
            </div>
            <div style={{ fontSize: 11.5, color: a.isOverdue ? 'var(--bad-ink)' : 'var(--text-3)', marginTop: 2 }}>
              {a.isOverdue
                ? `Overdue by ${a.daysOverdue} day${a.daysOverdue !== 1 ? 's' : ''}`
                : a.dueDate
                  ? `Due ${format(parseISO(a.dueDate), 'MMM d')}`
                  : 'No due date'}
            </div>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: a.isOverdue ? 'var(--bad-ink)' : 'var(--text)', flexShrink: 0 }}>
            {formatCurrencyFull(a.outstanding)}
          </span>
        </div>
      ))}
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

  const monthLabel   = format(parseISO(`${pulse.month}-01`), 'MMMM yyyy')
  const colors       = HEALTH_COLOR[pulse.health.label]
  const genTime      = format(new Date(pulse.generatedAt), 'h:mm a')
  const hasBorrowings = pulse.borrowingAlerts.length > 0

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
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>⚡ {monthLabel} Pulse</span>
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
                <AllocationsSection allocations={pulse.allocations} freeCash={pulse.cashPosition.freeCash} />
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

            {hasBorrowings && (
              <div>
                <SectionTitle>Borrowings to Settle</SectionTitle>
                <BorrowingsSection alerts={pulse.borrowingAlerts} />
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(sheet, document.body)
}
