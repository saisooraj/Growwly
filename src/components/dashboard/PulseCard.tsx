'use client'

import { useState } from 'react'
import { Zap, ChevronRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { usePulse } from '@/hooks/usePulse'
import { formatCurrency, formatCurrencyFull } from '@/lib/utils'
import PulseSheet from '@/components/pulse/PulseSheet'

const HEALTH_COLOR = {
  excellent: { bg: 'var(--good-soft)',  ink: 'var(--good-ink)',  bar: 'var(--good)'  },
  good:      { bg: 'var(--brand-soft)', ink: 'var(--brand-ink)', bar: 'var(--brand)' },
  caution:   { bg: 'var(--warn-soft)',  ink: 'var(--warn-ink)',  bar: 'var(--warn)'  },
  critical:  { bg: 'var(--bad-soft)',   ink: 'var(--bad-ink)',   bar: 'var(--bad)'   },
}

export default function PulseCard() {
  const pulse = usePulse()
  const [open, setOpen] = useState(false)

  const c = HEALTH_COLOR[pulse.health.label]
  const monthLabel = format(parseISO(`${pulse.month}-01`), 'MMMM')

  return (
    <>
      <div
        className="card"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={e => e.key === 'Enter' && setOpen(true)}
        style={{ display: 'flex', flexDirection: 'column', gap: 14, cursor: 'pointer' }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7, flexShrink: 0,
              background: c.bg, color: c.ink,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={13} />
            </div>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
              {monthLabel} Pulse
            </span>
            <span style={{
              fontSize: 11.5, fontWeight: 600, padding: '2px 9px', borderRadius: 999,
              background: c.bg, color: c.ink,
            }}>
              {pulse.health.score} / 100 · {pulse.health.label.charAt(0).toUpperCase() + pulse.health.label.slice(1)}
            </span>
          </div>
          <ChevronRight size={15} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
        </div>

        {/* Headline */}
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.45 }}>
          {pulse.headline}
        </p>

        {/* 3 key metrics */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'Income',   value: formatCurrencyFull(pulse.cashPosition.monthIncome),  color: 'var(--good)' },
            { label: 'Spent',    value: formatCurrencyFull(pulse.cashPosition.monthExpenses), color: 'var(--text)' },
            { label: 'Surplus',  value: formatCurrencyFull(pulse.cashPosition.surplusNet),    color: c.bar },
          ].map(m => (
            <div
              key={m.label}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 10,
                background: 'var(--surface-2)',
                display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
              }}
            >
              <span style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                {m.label}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: m.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.value}
              </span>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {pulse.upcoming.length > 0
              ? `${pulse.upcoming.length} obligation${pulse.upcoming.length !== 1 ? 's' : ''} ahead · ${formatCurrency(pulse.cashPosition.upcomingTotal)} reserved`
              : `${pulse.cashPosition.daysLeft} days left this month`
            }
            {pulse.cashPosition.daysLeft > 0 && pulse.cashPosition.dailyBudget > 0 && (
              <> · {formatCurrency(pulse.cashPosition.dailyBudget)}/day</>
            )}
          </div>
          <span style={{ fontSize: 12, color: c.ink, fontWeight: 500 }}>View full →</span>
        </div>
      </div>

      <PulseSheet open={open} onClose={() => setOpen(false)} pulse={pulse} />
    </>
  )
}
