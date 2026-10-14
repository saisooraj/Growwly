'use client'

import { memo, useEffect, useState } from 'react'
import Link from 'next/link'
import { parseISO, getDay, format } from 'date-fns'
import { ArrowRight, X } from 'lucide-react'
import { formatCurrency, formatCurrencyFull } from '@/lib/utils'
import { CategoryIcon, getCategoryDisplayName } from '@/lib/categoryIcons'
import type { DailySpendPoint } from '@/lib/spendingAnalytics'

const MASK = '₹ ••••'
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_CATS_SHOWN = 5

interface Props {
  days: DailySpendPoint[]   // oldest → newest, full cycle
  masked: boolean
}

// The panel total is spending (expenses net of refunds), while the cell's hover
// shows cash in/out — when those differ, spell out why in one line.
function describeFlow(day: DailySpendPoint, masked: boolean): string | null {
  const { moneyIn, moneyOut, lent, repaid, refunded } = day.flow
  const expenses = Math.max(0, day.amount) + refunded
  if (moneyIn <= 0 && refunded <= 0 && moneyOut <= expenses) return null
  const fmt = (v: number) => (masked ? MASK : formatCurrencyFull(v))
  const extras = [lent > 0 && `${fmt(lent)} lent`, repaid > 0 && `${fmt(repaid)} repaid`].filter(Boolean)
  const parts = [
    moneyIn > 0 && `In ${fmt(moneyIn)}`,
    moneyOut > 0 && `Out ${fmt(moneyOut)}${extras.length ? ` (incl. ${extras.join(', ')})` : ''}`,
    refunded > 0 && `${fmt(refunded)} refunded`,
  ].filter(Boolean)
  return parts.join(' · ')
}

function SpendingHeatmap({ days, masked }: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // A new cycle means the selected day may no longer be on the grid
  const rangeKey = days.length ? `${days[0].date}_${days[days.length - 1].date}` : ''
  useEffect(() => { setSelectedDate(null) }, [rangeKey])

  useEffect(() => {
    if (!selectedDate) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedDate(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedDate])

  if (days.length === 0) return null

  const today = format(new Date(), 'yyyy-MM-dd')
  const maxAmount = Math.max(...days.map(d => Math.max(0, d.amount)), 1)
  const shown = selectedDate ? days.find(d => d.date === selectedDate) ?? null : null
  const flowNote = shown ? describeFlow(shown, masked) : null

  // Leading blanks so the first day lines up under its Mon-Sun weekday column.
  const firstWeekday = (getDay(parseISO(days[0].date)) + 6) % 7 // 0=Mon … 6=Sun
  const cells: (DailySpendPoint | null)[] = [...Array(firstWeekday).fill(null), ...days]

  return (
    <div className="card">
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 4 }}>
        Daily Spend
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginBottom: 14 }}>
        {format(parseISO(days[0].date), 'MMM d')} – {format(parseISO(days[days.length - 1].date), 'MMM d')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
        {WEEKDAY_LABELS.map(w => (
          <div key={w} style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-4)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            {w}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={`blank-${i}`} />
          const amount = Math.max(0, cell.amount)
          const pct = amount > 0 ? amount / maxAmount : 0
          const isToday = cell.date === today
          const isFuture = cell.date > today
          const isSelected = selectedDate === cell.date
          const dayNum = format(parseISO(cell.date), 'd')
          const isFirstOfMonth = dayNum === '1'
          const labelColor = pct > 0.55 ? 'var(--warn-ink)' : isSelected ? 'var(--text)' : 'var(--text-4)'
          return (
            <button
              key={cell.date}
              className="heat-day"
              type="button"
              disabled={isFuture}
              aria-pressed={isSelected}
              aria-label={format(parseISO(cell.date), 'EEEE, MMM d')}
              onClick={() => setSelectedDate(prev => (prev === cell.date ? null : cell.date))}
              style={{
                aspectRatio: '1', borderRadius: 8, minHeight: 30, padding: 0, font: 'inherit',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: amount > 0
                  ? `color-mix(in oklch, var(--warn) ${Math.max(20, Math.round(pct * 100))}%, var(--surface-2))`
                  : 'var(--surface-2)',
                border: isToday ? '1.5px solid var(--brand)' : '1px solid transparent',
                outline: isSelected ? '2px solid var(--text)' : 'none',
                outlineOffset: -2,
                opacity: isFuture ? 0.45 : 1,
                transition: 'background .3s ease',
                cursor: isFuture ? 'default' : 'pointer',
              }}
            >
              {/* Revealed on hover (CSS): money in slides down from above, money out rises from below */}
              {cell.flow.moneyIn > 0 && (
                <span className="heat-day__in" style={{ color: pct > 0.55 ? labelColor : 'var(--good-ink)' }}>
                  +{masked ? '••' : formatCurrency(cell.flow.moneyIn)}
                </span>
              )}
              <span style={{
                fontSize: 9.5, fontWeight: isFirstOfMonth || isSelected ? 700 : 500,
                color: labelColor,
              }}>
                {isFirstOfMonth ? format(parseISO(cell.date), 'MMM d') : dayNum}
              </span>
              {cell.flow.moneyOut > 0 && (
                <span className="heat-day__out" style={{ color: pct > 0.55 ? labelColor : 'var(--text-2)' }}>
                  −{masked ? '••' : formatCurrency(cell.flow.moneyOut)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected day detail — fixed min height so the card doesn't jump between days */}
      <div style={{
        marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)',
        minHeight: 76, display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {shown ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
                  {format(parseISO(shown.date), 'EEEE, MMM d')}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  title="Clear selection (Esc)"
                  aria-label="Clear selected day"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2, color: 'var(--text-3)', flexShrink: 0 }}
                >
                  <X size={12} />
                </button>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: "'Geist Mono', monospace" }}>
                {masked ? MASK : formatCurrencyFull(Math.max(0, shown.amount))}
              </span>
            </div>
            {flowNote && (
              <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0 }}>{flowNote}</p>
            )}
            {shown.byCategory.length === 0 ? (
              <p style={{ fontSize: 11.5, color: 'var(--text-4)', margin: 0 }}>No spending this day.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {shown.byCategory.slice(0, MAX_CATS_SHOWN).map(([cat, amt]) => (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <CategoryIcon category={cat} size={12} color="var(--text-3)" />
                    <span style={{ fontSize: 11.5, color: 'var(--text-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getCategoryDisplayName(cat)}
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', fontFamily: "'Geist Mono', monospace", flexShrink: 0 }}>
                      {masked ? MASK : formatCurrencyFull(amt)}
                    </span>
                  </div>
                ))}
                {shown.byCategory.length > MAX_CATS_SHOWN && (
                  <span style={{ fontSize: 10.5, color: 'var(--text-4)' }}>
                    +{shown.byCategory.length - MAX_CATS_SHOWN} more categories
                  </span>
                )}
              </div>
            )}
            <Link
              href={`/transactions?from=${shown.date}&to=${shown.date}`}
              style={{
                alignSelf: 'flex-start', marginTop: 2,
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11.5, fontWeight: 600, color: 'var(--brand-ink)', textDecoration: 'none',
              }}
            >
              View transactions <ArrowRight size={12} />
            </Link>
          </>
        ) : (
          <p style={{ fontSize: 11.5, color: 'var(--text-4)', margin: 0 }}>Select a day to see where it went.</p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 10.5, color: 'var(--text-4)' }}>
        <span>Less</span>
        {[20, 40, 60, 80, 100].map(p => (
          <span key={p} style={{
            width: 12, height: 12, borderRadius: 3.5,
            background: `color-mix(in oklch, var(--warn) ${p}%, var(--surface-2))`,
          }} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}

export default memo(SpendingHeatmap)
