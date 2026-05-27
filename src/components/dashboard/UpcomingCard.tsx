'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { format, parseISO, addMonths } from 'date-fns'
import { CalendarClock, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { formatCurrencyFull, CATEGORY_COLORS } from '@/lib/utils'

export default function UpcomingCard() {
  const { upcomingExpenses, upcomingPayments } = useAppStore()

  const now       = new Date()
  const nextMonth = format(addMonths(now, 1), 'yyyy-MM')
  const thisMonth = format(now, 'yyyy-MM')

  const paidByItem = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of upcomingPayments) {
      map.set(p.upcomingId, (map.get(p.upcomingId) ?? 0) + p.amount)
    }
    return map
  }, [upcomingPayments])

  // All items in this+next month (for correct totals)
  const relevantAll = upcomingExpenses
    .filter(i => i.dueDate.slice(0, 7) === thisMonth || i.dueDate.slice(0, 7) === nextMonth)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  // Only first 5 for display
  const relevant = relevantAll.slice(0, 5)

  const totalOut    = relevantAll.filter(i => (i.flowType ?? 'expense') === 'expense').reduce((s, i) => s + i.amount, 0)
  const totalIn     = relevantAll.filter(i => i.flowType === 'income').reduce((s, i) => s + i.amount, 0)
  const totalPaid   = relevantAll.reduce((s, i) => s + (paidByItem.get(i.id) ?? 0), 0)
  const netPosition = totalIn - totalOut

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
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Upcoming</span>
            <div style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 1 }}>this & next month</div>
          </div>
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
          {/* Summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="display-num" style={{ fontSize: 26, color: netPosition >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)', lineHeight: 1 }}>
                {netPosition >= 0 ? '+' : ''}{formatCurrencyFull(netPosition)}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>net</span>
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
              {totalOut > 0 && <span style={{ color: 'var(--bad-ink)' }}>↓ {formatCurrencyFull(totalOut)} out</span>}
              {totalIn > 0  && <span style={{ color: 'var(--good-ink)' }}>↑ {formatCurrencyFull(totalIn)} in</span>}
              {totalPaid > 0 && <span style={{ color: 'var(--text-3)' }}>· {formatCurrencyFull(totalPaid)} logged</span>}
            </div>
          </div>

          {/* List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {relevant.map(item => {
              const isIncome  = item.flowType === 'income'
              const color     = isIncome ? 'var(--good)' : (CATEGORY_COLORS[item.category ?? ''] ?? '#94a3b8')
              const paid      = paidByItem.get(item.id) ?? 0
              const remaining = Math.max(0, item.amount - paid)
              const pct       = item.amount > 0 ? Math.min(100, (paid / item.amount) * 100) : 0
              const fulfilled = pct >= 100
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: fulfilled ? 0.6 : 1 }}>
                  <div style={{ width: 3, alignSelf: 'stretch', minHeight: 28, borderRadius: 2, background: fulfilled ? 'var(--good)' : color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.label}
                      </span>
                      {fulfilled && <CheckCircle2 size={11} style={{ color: 'var(--good)', flexShrink: 0 }} />}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {format(parseISO(item.dueDate), 'dd MMM')}
                    </div>
                    {paid > 0 && !fulfilled && (
                      <div style={{ marginTop: 4, height: 3, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden', width: '100%' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--brand)', borderRadius: 999, transition: 'width .3s ease' }} />
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="display-num" style={{ fontSize: 12, fontWeight: 600, color: fulfilled ? 'var(--good-ink)' : 'var(--text-2)' }}>
                      {fulfilled ? formatCurrencyFull(item.amount) : formatCurrencyFull(remaining)}
                    </div>
                    {paid > 0 && !fulfilled && (
                      <div style={{ fontSize: 10, color: 'var(--text-3)' }}>left</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {relevantAll.length > 5 && (
            <Link href="/upcoming" style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none', textAlign: 'center' }}>
              +{relevantAll.length - 5} more this period
            </Link>
          )}
        </>
      )}
    </div>
  )
}
