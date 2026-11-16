'use client'

import Link from 'next/link'
import { useAppStore } from '@/store/appStore'
import { Amt, tone } from './ui'

// Outstanding money lent and borrowed; each tile shows only when non-zero
export function useLoans() {
  const borrowings = useAppStore(s => s.borrowings)
  const open = borrowings.filter(b => b.status !== 'repaid')
  const left = (type: 'lent' | 'borrowed') => open.filter(b => b.type === type).reduce((s, b) => s + Math.max(0, b.amount - b.repaidAmount), 0)
  return { owed: left('lent'), owe: left('borrowed'), owedCount: open.filter(b => b.type === 'lent' && b.amount - b.repaidAmount > 0).length }
}

export default function LoansCard() {
  const { owed, owe, owedCount } = useLoans()
  const tiles = [
    owed > 0 && { label: 'Owed to you', amt: owed, sub: `${owedCount} record${owedCount === 1 ? '' : 's'} pending`, t: 'good' as const },
    owe > 0 && { label: 'Borrowed by me', amt: owe, sub: 'Pending repayment', t: 'warn' as const },
  ].filter(Boolean) as { label: string; amt: number; sub: string; t: 'good' | 'warn' }[]

  return (
    <div className="ov-card" style={{ gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div className="ov-title">Loans</div>
        <Link href="/borrowings" className="ov-link">Borrowings →</Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
        {tiles.map(h => (
          <Link key={h.label} href="/borrowings" style={{ padding: 14, borderRadius: 16, background: tone(h.t).background, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, textDecoration: 'none' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: tone(h.t).color }}>{h.label}</div>
            <Amt value={h.amt} className="ov-mono" style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--ink)', whiteSpace: 'nowrap' }} />
            <div style={{ fontSize: 11.5, color: 'var(--ink2)' }}>{h.sub}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
