'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { EMERGENCY_FUND_VEHICLE } from '@/lib/utils'
import type { Transaction } from '@/types'
import { Chevron, maskWith, rs } from './nwUi'

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

const SHOWN = 5

export default function EmergencyFundTransactions({
  transactions, open, onToggle, masked,
}: {
  transactions: Transaction[]
  open: boolean
  onToggle: () => void
  masked: boolean
}) {
  if (transactions.length === 0) return null
  const M = maskWith(masked)

  return (
    <>
      <button
        type="button" onClick={onToggle} aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '2px 2px 0', border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>Recent activity <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>· {transactions.length}</span></span>
        <Chevron open={open} />
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: -6 }}>
          {transactions.slice(0, SHOWN).map(t => {
            const out = isEfWithdrawal(t)
            const color = out ? 'var(--bad-ink)' : 'var(--good-ink)'
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 2px', borderTop: '1px solid var(--border)' }}>
                <span aria-hidden style={{ width: 26, height: 26, borderRadius: 8, flex: 'none', background: out ? 'var(--bad-soft)' : 'var(--good-soft)', color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{out ? '−' : '+'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.notes || (out ? 'Withdrawal' : 'Contribution')}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{format(parseISO(t.date), 'd MMM yyyy')}</div>
                </div>
                <span className="nw-num" style={{ fontSize: 13, fontWeight: 700, color }}>{out ? '−' : '+'}{M(rs(t.amount))}</span>
              </div>
            )
          })}
          <Link
            href={`/transactions?type=savings&vehicle=${encodeURIComponent(EMERGENCY_FUND_VEHICLE)}`}
            style={{ borderTop: '1px solid var(--border)', paddingTop: 10, fontSize: 12.5, fontWeight: 700, color: 'var(--brand-ink)', textDecoration: 'none' }}
          >
            See all in Transactions →
          </Link>
        </div>
      )}
    </>
  )
}
