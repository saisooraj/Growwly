'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { TrendingUp, TrendingDown, ArrowLeftRight } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { formatCurrencyFull, CATEGORY_COLORS, getTransactionsForMonth, TRANSFER_KINDS } from '@/lib/utils'
import type { Transaction } from '@/types'
import TransactionDetailModal from './TransactionDetailModal'

interface Props {
  filterMonth?: boolean
  limit?: number
  transactions?: Transaction[]  // optional override (for filtered views)
}

function transferLabel(tx: Transaction): string {
  return TRANSFER_KINDS.find(k => k.id === tx.transferKind)?.label ?? 'Transfer'
}

function transferDir(tx: Transaction): 'in' | 'out' {
  return TRANSFER_KINDS.find(k => k.id === tx.transferKind)?.dir ?? 'out'
}

export default function TransactionList({ filterMonth = false, limit, transactions: txOverride }: Props) {
  const { transactions: storeTxs, selectedMonth } = useAppStore()
  const [selected, setSelected] = useState<Transaction | null>(null)

  const base = txOverride ?? (filterMonth
    ? getTransactionsForMonth(storeTxs, selectedMonth)
    : storeTxs)

  const list = [...base].sort((a, b) => b.date.localeCompare(a.date))
  const shown = limit ? list.slice(0, limit) : list

  if (shown.length === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No transactions found.</p>
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {shown.map((tx) => {
          const isTransfer = tx.type === 'transfer'
          const isIncome   = tx.type === 'income'
          const color      = isTransfer ? 'var(--info)' : (CATEGORY_COLORS[tx.category] ?? '#94a3b8')
          const dir        = isTransfer ? transferDir(tx) : (isIncome ? 'in' : 'out')
          const label      = isTransfer ? transferLabel(tx) : tx.category

          const amountColor = isTransfer
            ? dir === 'in' ? 'var(--good-ink)' : 'var(--text-2)'
            : isIncome ? 'var(--good-ink)' : 'var(--text)'

          const prefix = (isTransfer ? dir === 'in' : isIncome) ? '+' : '−'

          return (
            <button
              key={tx.id}
              onClick={() => setSelected(tx)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 12,
                background: 'transparent', border: 'none',
                cursor: 'pointer', textAlign: 'left', width: '100%',
                transition: 'background .12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Icon */}
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: color + '20',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isTransfer
                  ? <ArrowLeftRight size={15} style={{ color }} />
                  : isIncome
                    ? <TrendingUp size={15} style={{ color }} />
                    : <TrendingDown size={15} style={{ color }} />
                }
              </div>

              {/* Label + date */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                  {isTransfer && (
                    <span className="pill info" style={{ fontSize: 10.5, padding: '1px 7px', flexShrink: 0 }}>transfer</span>
                  )}
                  {tx.isRecurring && (
                    <span className="pill" style={{ fontSize: 10.5, padding: '1px 7px', flexShrink: 0 }}>recurring</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                    {format(parseISO(tx.date), 'dd MMM yyyy')}
                  </span>
                  {tx.notes && (
                    <span style={{ fontSize: 11.5, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          className="hidden sm:inline">
                      · {tx.notes}
                    </span>
                  )}
                </div>
              </div>

              {/* Amount */}
              <span className="num" style={{ fontSize: 13, fontWeight: 600, color: amountColor, flexShrink: 0 }}>
                {prefix}{formatCurrencyFull(tx.amount)}
              </span>
            </button>
          )
        })}
      </div>

      <TransactionDetailModal tx={selected} onClose={() => setSelected(null)} />
    </>
  )
}
