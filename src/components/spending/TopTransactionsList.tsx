'use client'

import { memo } from 'react'
import { format, parseISO } from 'date-fns'
import { formatCurrencyFull } from '@/lib/utils'
import { CategoryIcon, getCategoryDisplayName } from '@/lib/categoryIcons'
import type { TopTransaction } from '@/lib/spendingAnalytics'

const MASK = '₹ ••••'

interface Props {
  transactions: TopTransaction[]
  masked: boolean
  onCategoryClick: (category: string) => void
}

function TopTransactionsList({ transactions, masked, onCategoryClick }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '32px 0' }}>
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No expenses in this range yet.</p>
      </div>
    )
  }

  const maxAmount = transactions[0].amount || 1

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 10 }}>
        Biggest Expenses
      </div>
      {transactions.map((t, i) => {
        const barPct = Math.max(6, (t.amount / maxAmount) * 100)
        return (
          <button
            key={t.id}
            onClick={() => onCategoryClick(t.category)}
            className="pressable"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 6px', borderRadius: 10, width: '100%',
              background: 'transparent', border: 'none', cursor: 'pointer',
              textAlign: 'left', fontFamily: 'inherit',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text-4)',
              width: 16, flexShrink: 0, textAlign: 'right',
            }}>
              {i + 1}
            </span>
            <span style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CategoryIcon category={t.category} size={15} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.notes || getCategoryDisplayName(t.category)}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flexShrink: 0, fontFamily: "'Geist Mono', monospace" }}>
                  {masked ? MASK : formatCurrencyFull(t.amount)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 10.5, color: 'var(--text-4)', flexShrink: 0 }}>
                  {getCategoryDisplayName(t.category)} · {format(parseISO(t.date), 'MMM d')}
                </span>
                <div style={{ flex: 1, height: 3, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${barPct}%`, background: 'var(--warn)', borderRadius: 999, transition: 'width .4s ease' }} />
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default memo(TopTransactionsList)
