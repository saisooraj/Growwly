'use client'

import { memo, useState } from 'react'
import { parseISO, getDay, format } from 'date-fns'
import { formatCurrencyFull } from '@/lib/utils'
import { CategoryIcon, getCategoryDisplayName } from '@/lib/categoryIcons'
import type { DailySpendPoint } from '@/lib/spendingAnalytics'

const MASK = '₹ ••••'
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_CATS_SHOWN = 5

interface Props {
  days: DailySpendPoint[]   // oldest → newest, full cycle
  masked: boolean
}

function SpendingHeatmap({ days, masked }: Props) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)

  if (days.length === 0) return null

  const today = format(new Date(), 'yyyy-MM-dd')
  const maxAmount = Math.max(...days.map(d => Math.max(0, d.amount)), 1)
  const hovered = hoveredDate ? days.find(d => d.date === hoveredDate) ?? null : null

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

      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}
        onMouseLeave={() => setHoveredDate(null)}
      >
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
          const isHovered = hoveredDate === cell.date
          const dayNum = format(parseISO(cell.date), 'd')
          const isFirstOfMonth = dayNum === '1'
          return (
            <div
              key={cell.date}
              onMouseEnter={() => setHoveredDate(cell.date)}
              style={{
                aspectRatio: '1', borderRadius: 8, minHeight: 30,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: amount > 0
                  ? `color-mix(in oklch, var(--warn) ${Math.max(20, Math.round(pct * 100))}%, var(--surface-2))`
                  : 'var(--surface-2)',
                border: isToday ? '1.5px solid var(--brand)' : '1px solid transparent',
                outline: isHovered ? '2px solid var(--text-3)' : 'none',
                outlineOffset: -2,
                transform: isHovered ? 'scale(1.06)' : 'scale(1)',
                transition: 'background .3s ease, transform .12s ease',
                cursor: 'default',
              }}
            >
              <span style={{
                fontSize: 9.5, fontWeight: isFirstOfMonth ? 700 : 500,
                color: pct > 0.55 ? 'var(--warn-ink)' : 'var(--text-4)',
              }}>
                {isFirstOfMonth ? format(parseISO(cell.date), 'MMM d') : dayNum}
              </span>
            </div>
          )
        })}
      </div>

      {/* Hover detail — fixed height so the card doesn't jump as you scan across days */}
      <div style={{
        marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)',
        minHeight: 76, display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {hovered ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
                {format(parseISO(hovered.date), 'EEEE, MMM d')}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: "'Geist Mono', monospace" }}>
                {masked ? MASK : formatCurrencyFull(Math.max(0, hovered.amount))}
              </span>
            </div>
            {hovered.byCategory.length === 0 ? (
              <p style={{ fontSize: 11.5, color: 'var(--text-4)', margin: 0 }}>No spending this day.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {hovered.byCategory.slice(0, MAX_CATS_SHOWN).map(([cat, amt]) => (
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
                {hovered.byCategory.length > MAX_CATS_SHOWN && (
                  <span style={{ fontSize: 10.5, color: 'var(--text-4)' }}>
                    +{hovered.byCategory.length - MAX_CATS_SHOWN} more categories
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: 11.5, color: 'var(--text-4)', margin: 0 }}>Hover a day to see where it went.</p>
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
