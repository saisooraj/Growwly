'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, EXPENSE_CATEGORIES, formatCurrencyFull } from '@/lib/utils'
import { getCategoryDisplayName } from '@/lib/categoryIcons'
import { format, subMonths, parseISO } from 'date-fns'

export default function CategoryInsights() {
  const { transactions, selectedMonth, settings } = useAppStore()

  const prevMonthDate = subMonths(parseISO(`${selectedMonth}-01`), 1)
  const prevMonth = format(prevMonthDate, 'yyyy-MM')

  const currSummary = buildMonthlySummary(transactions, selectedMonth, settings)
  const prevSummary = buildMonthlySummary(transactions, prevMonth, settings)

  const rows = EXPENSE_CATEGORIES
    .map(cat => {
      const curr = currSummary.byCategory[cat] ?? 0
      const prev = prevSummary.byCategory[cat] ?? 0
      const diff = curr - prev
      const pct = prev > 0 ? Math.round((diff / prev) * 100) : null
      return { cat, curr, prev, diff, pct }
    })
    .filter(r => r.curr > 0 || r.prev > 0)
    .sort((a, b) => b.curr - a.curr)

  if (rows.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '32px 0' }}>
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No spending data to compare yet.</p>
      </div>
    )
  }

  const prevLabel = format(prevMonthDate, 'MMM')
  const currLabel = format(parseISO(`${selectedMonth}-01`), 'MMM')

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Month-over-Month</span>
        <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{prevLabel} → {currLabel}</span>
      </div>

      {rows.map(({ cat, curr, prev, diff, pct }) => {
        const isUp   = diff > 0
        const isDown = diff < 0
        const isSame = diff === 0
        const isAnomaly = pct !== null && Math.abs(pct) >= 50 && curr > 1000

        const rowBg = isAnomaly && isUp ? 'var(--bad-soft)' : 'transparent'
        const changeColor = isUp
          ? (isAnomaly ? 'var(--bad-ink)' : 'var(--warn-ink)')
          : isDown ? 'var(--good-ink)' : 'var(--text-3)'
        const changeText = pct !== null
          ? `${isUp ? '+' : ''}${pct}%`
          : prev === 0 && curr > 0 ? 'New'
          : prev > 0 && curr === 0 ? '−100%'
          : '—'

        return (
          <div
            key={cat}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 10,
              background: rowBg,
              transition: 'background .12s',
            }}
            onMouseEnter={e => { if (!isAnomaly || !isUp) e.currentTarget.style.background = 'var(--surface-2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = rowBg }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getCategoryDisplayName(cat)}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                <span className="num">{prev > 0 ? formatCurrencyFull(prev) : '—'}</span>
                {' → '}
                <span className="num">{curr > 0 ? formatCurrencyFull(curr) : '—'}</span>
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              {isUp   && <TrendingUp  size={13} style={{ color: isAnomaly ? 'var(--bad)' : 'var(--warn)' }} />}
              {isDown && <TrendingDown size={13} style={{ color: 'var(--good)' }} />}
              {isSame && <Minus size={13} style={{ color: 'var(--text-3)' }} />}
              <span style={{ fontSize: 12, fontWeight: 600, color: changeColor }}>
                {changeText}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
