'use client'

import { memo } from 'react'
import { Repeat, Zap } from 'lucide-react'
import { formatCurrencyFull } from '@/lib/utils'

const MASK = '₹ ••••'

interface Props {
  recurringTotal: number
  oneOffTotal: number
  masked: boolean
}

function RecurringSplitCard({ recurringTotal, oneOffTotal, masked }: Props) {
  const total = recurringTotal + oneOffTotal
  const recurringPct = total > 0 ? (recurringTotal / total) * 100 : 0
  const oneOffPct = total > 0 ? 100 - recurringPct : 0

  return (
    <div className="card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>Fixed vs Flexible</div>

      <div style={{ display: 'flex', height: 14, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
        <div style={{ flex: recurringPct, background: 'var(--info)', minWidth: recurringPct > 0 ? 5 : 0, transition: 'flex .6s cubic-bezier(.22,1,.36,1)' }} />
        <div style={{ flex: oneOffPct, background: 'var(--brand)', minWidth: oneOffPct > 0 ? 5 : 0, transition: 'flex .6s cubic-bezier(.22,1,.36,1)' }} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Repeat size={11} style={{ color: 'var(--info)', flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)' }}>{recurringPct.toFixed(0)}%</span>
          <span style={{ fontSize: 10.5, color: 'var(--text-4)' }}>
            Fixed · {masked ? MASK : formatCurrencyFull(recurringTotal)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={11} style={{ color: 'var(--brand)', flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)' }}>{oneOffPct.toFixed(0)}%</span>
          <span style={{ fontSize: 10.5, color: 'var(--text-4)' }}>
            Flexible · {masked ? MASK : formatCurrencyFull(oneOffTotal)}
          </span>
        </div>
      </div>
    </div>
  )
}

export default memo(RecurringSplitCard)
