'use client'

import Link from 'next/link'
import { memo } from 'react'
import { formatCurrencyFull } from '@/lib/utils'

const MASK = '₹ ••••'

interface Props {
  amounts: { needs: number; wants: number; savings: number }
  pcts: { needs: number; wants: number; savings: number }
  target: { needs: number; wants: number; savings: number }
  masked: boolean
}

function NeedsWantsSavingsSummary({ amounts, pcts, target, masked }: Props) {
  const unallocated = Math.max(0, 100 - pcts.needs - pcts.wants - pcts.savings)
  const segments = [
    { key: 'needs', label: 'Needs', pct: pcts.needs, amt: amounts.needs, color: 'var(--info)' },
    { key: 'wants', label: 'Wants', pct: pcts.wants, amt: amounts.wants, color: 'var(--warn)' },
    { key: 'savings', label: 'Savings', pct: pcts.savings, amt: amounts.savings, color: 'var(--good)' },
  ] as const

  return (
    <div className="card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>Needs / Wants / Savings</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
            Target {target.needs}/{target.wants}/{target.savings}
          </div>
        </div>
        <Link href="/planning" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--brand-ink)', whiteSpace: 'nowrap', flexShrink: 0, textDecoration: 'none' }}>
          Edit →
        </Link>
      </div>

      <div style={{ display: 'flex', height: 14, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
        {segments.map(s => (
          <div key={s.key} style={{
            flex: s.pct, background: s.color,
            minWidth: s.pct > 0 ? 5 : 0,
            transition: 'flex .6s cubic-bezier(.22,1,.36,1)',
          }} />
        ))}
        <div style={{ flex: unallocated, background: 'var(--surface-3)', minWidth: unallocated > 0 ? 5 : 0, transition: 'flex .6s cubic-bezier(.22,1,.36,1)' }} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {segments.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)' }}>{s.pct.toFixed(0)}%</span>
            <span style={{ fontSize: 10.5, color: 'var(--text-4)' }}>
              {s.label} · {masked ? MASK : formatCurrencyFull(s.amt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default memo(NeedsWantsSavingsSummary)
