'use client'

import Link from 'next/link'
import { format, parseISO, addMonths } from 'date-fns'
import { CalendarClock, ArrowRight } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { formatCurrencyFull, CATEGORY_COLORS } from '@/lib/utils'

export default function UpcomingCard() {
  const { upcomingExpenses } = useAppStore()

  const now       = new Date()
  const nextMonth = format(addMonths(now, 1), 'yyyy-MM')
  const thisMonth = format(now, 'yyyy-MM')

  // Show this month's remaining + all of next month
  const relevant = upcomingExpenses
    .filter(i => i.dueDate.slice(0, 7) === thisMonth || i.dueDate.slice(0, 7) === nextMonth)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5)

  const total = relevant.reduce((s, i) => s + i.amount, 0)

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'var(--warn-soft)',
            color: 'var(--warn-ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CalendarClock size={14} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Upcoming</span>
        </div>
        <Link href="/upcoming" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--brand)', textDecoration: 'none', fontWeight: 500 }}>
          All <ArrowRight size={12} />
        </Link>
      </div>

      {relevant.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Nothing planned yet</p>
          <Link href="/upcoming" style={{ fontSize: 12, color: 'var(--brand)', textDecoration: 'none', fontWeight: 500 }}>
            + Add upcoming expense
          </Link>
        </div>
      ) : (
        <>
          {/* Total */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="display-num" style={{ fontSize: 26, color: 'var(--text)', lineHeight: 1 }}>
              {formatCurrencyFull(total)}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>committed</span>
          </div>

          {/* List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {relevant.map(item => {
              const color = CATEGORY_COLORS[item.category ?? ''] ?? '#94a3b8'
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 3, height: 28, borderRadius: 2, background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {format(parseISO(item.dueDate), 'dd MMM')}
                    </div>
                  </div>
                  <span className="display-num" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', flexShrink: 0 }}>
                    {formatCurrencyFull(item.amount)}
                  </span>
                </div>
              )
            })}
          </div>

          {upcomingExpenses.length > 5 && (
            <Link href="/upcoming" style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none', textAlign: 'center' }}>
              +{upcomingExpenses.length - 5} more
            </Link>
          )}
        </>
      )}
    </div>
  )
}
