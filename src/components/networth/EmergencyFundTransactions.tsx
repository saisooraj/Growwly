'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { formatCurrencyFull, EMERGENCY_FUND_VEHICLE } from '@/lib/utils'
import type { Transaction } from '@/types'

function isEfWithdrawal(t: Transaction) {
  return t.transferKind === 'ef_withdrawal' ||
    (t.transferKind === 'savings_withdrawal' && t.savingsVehicle === EMERGENCY_FUND_VEHICLE)
}

// Contributions and withdrawals that moved the emergency fund balance, newest first
export function useEfTransactions(transactions: Transaction[]) {
  return useMemo(() => {
    return transactions
      .filter(t =>
        t.type === 'transfer' && (
          isEfWithdrawal(t) ||
          ((t.transferKind === 'savings_contribution' || t.transferKind === 'savings_transfer') &&
            t.savingsVehicle === EMERGENCY_FUND_VEHICLE)
        )
      )
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [transactions])
}

export default function EmergencyFundTransactions({
  transactions, open, onToggle, masked,
}: {
  transactions: Transaction[]
  open: boolean
  onToggle: () => void
  masked: boolean
}) {
  if (transactions.length === 0) return null

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '10px 0 4px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-3)',
        }}
      >
        <span style={{ fontSize: 11.5, fontWeight: 500 }}>
          {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {transactions.map(t => {
            const isWithdrawal = isEfWithdrawal(t)
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                  background: isWithdrawal ? 'var(--bad-soft)' : 'var(--good-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isWithdrawal
                    ? <ArrowDownLeft size={13} style={{ color: 'var(--bad-ink)' }} />
                    : <ArrowUpRight size={13} style={{ color: 'var(--good-ink)' }} />
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.notes || (isWithdrawal ? 'Withdrawal' : 'Contribution')}
                  </p>
                  <p style={{ fontSize: 10.5, color: 'var(--text-4)', margin: 0 }}>
                    {format(parseISO(t.date), 'MMM d, yyyy')}
                  </p>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: isWithdrawal ? 'var(--bad-ink)' : 'var(--good-ink)', flexShrink: 0 }}>
                  {masked ? '₹ ••••' : `${isWithdrawal ? '−' : '+'}${formatCurrencyFull(t.amount)}`}
                </span>
              </div>
            )
          })}

          <Link
            href={`/transactions?type=savings&vehicle=${encodeURIComponent(EMERGENCY_FUND_VEHICLE)}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '8px 0', marginTop: 4,
              borderTop: '1px solid var(--border)',
              fontSize: 12, fontWeight: 500,
              color: 'var(--brand-ink)', textDecoration: 'none',
            }}
          >
            See all <ArrowRight size={13} />
          </Link>
        </div>
      )}
    </div>
  )
}
