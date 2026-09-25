'use client'

import { memo, useEffect, useState } from 'react'
import { ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatCurrencyFull, getBudgetStatus, STATUS_COLORS } from '@/lib/utils'
import { CategoryIcon, getCategoryDisplayName } from '@/lib/categoryIcons'

const MASK = '₹ ••••'
const VISIBLE_STEP = 4

export interface GridRow {
  category: string
  actual: number
  prevActual: number
  planned: number
}

interface Props {
  rows: GridRow[]
  masked: boolean
  onRowClick: (category: string) => void
}

function CategoryGrid({ rows, masked, onRowClick }: Props) {
  const [visibleCount, setVisibleCount] = useState(VISIBLE_STEP)

  // Reset back to the collapsed view whenever the underlying filtered set changes
  // (checklist toggle, month/range change) — same pattern as Transactions' "show more".
  useEffect(() => { setVisibleCount(VISIBLE_STEP) }, [rows])

  if (rows.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '32px 0' }}>
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No categories match the current filters.</p>
      </div>
    )
  }

  const visibleRows = rows.slice(0, visibleCount)
  const remaining = rows.length - visibleRows.length

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
        All categories
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
        {visibleRows.map(row => {
          const { category, actual, prevActual, planned } = row
          const status = planned > 0 ? getBudgetStatus(actual, planned) : null
          const sc = status ? STATUS_COLORS[status] : null
          const pct = planned > 0 ? Math.min((actual / planned) * 100, 100) : 0

          const diff = actual - prevActual
          const isUp = diff > 0
          const isDown = diff < 0
          const momPct = prevActual > 0 ? Math.round((diff / prevActual) * 100) : null

          return (
            <button
              key={category}
              onClick={() => onRowClick(category)}
              className="card-sm card-press"
              style={{
                textAlign: 'left', border: '1px solid var(--border)', cursor: 'pointer',
                padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8,
                fontFamily: 'inherit', background: 'var(--surface)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 9, flexShrink: 0,
                  background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CategoryIcon category={category} size={15} />
                </span>
                <span style={{
                  flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {getCategoryDisplayName(category)}
                </span>
                {sc && (
                  <span className={`pill ${sc.pill}`} style={{ fontSize: 9.5, padding: '1px 6px', flexShrink: 0 }}>
                    {sc.label}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                  {masked ? MASK : formatCurrencyFull(actual)}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: isUp ? 'var(--warn-ink)' : isDown ? 'var(--good-ink)' : 'var(--text-3)' }}>
                  {isUp && <TrendingUp size={11} />}
                  {isDown && <TrendingDown size={11} />}
                  {!isUp && !isDown && <Minus size={11} />}
                  {momPct !== null ? `${isUp ? '+' : ''}${momPct}%` : prevActual === 0 && actual > 0 ? 'New' : '—'}
                </span>
              </div>

              {planned > 0 && (
                <div>
                  <div style={{ width: '100%', background: 'var(--surface-2)', borderRadius: 999, height: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: sc?.bar, borderRadius: 999, transition: 'width .4s ease' }} />
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 4 }}>
                    of {masked ? MASK : formatCurrencyFull(planned)} budget
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {remaining > 0 && (
        <button
          onClick={() => setVisibleCount(c => c + VISIBLE_STEP)}
          className="btn btn-sm btn-ghost pressable"
          style={{ alignSelf: 'center', marginTop: 10, gap: 5 }}
        >
          Show {Math.min(VISIBLE_STEP, remaining)} more
          <ChevronDown size={13} />
        </button>
      )}
    </div>
  )
}

export default memo(CategoryGrid)
