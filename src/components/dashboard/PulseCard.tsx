'use client'

import { useMemo, useState } from 'react'
import { Zap, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { usePulse } from '@/hooks/usePulse'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, getLast6Months, formatCurrency, formatCurrencyFull } from '@/lib/utils'
import PulseSheet from '@/components/pulse/PulseSheet'

const HEALTH_COLOR = {
  excellent: { bg: 'var(--good-soft)',  ink: 'var(--good-ink)',  bar: 'var(--good)'  },
  good:      { bg: 'var(--brand-soft)', ink: 'var(--brand-ink)', bar: 'var(--brand)' },
  caution:   { bg: 'var(--warn-soft)',  ink: 'var(--warn-ink)',  bar: 'var(--warn)'  },
  critical:  { bg: 'var(--bad-soft)',   ink: 'var(--bad-ink)',   bar: 'var(--bad)'   },
}

function HealthRing({ score, label, size = 64, thickness = 7 }: { score: number; label: keyof typeof HEALTH_COLOR; size?: number; thickness?: number }) {
  const r = size / 2 - thickness / 2 - 2
  const cx = size / 2
  const cy = size / 2
  const dash = 2 * Math.PI * r
  const frac = Math.max(0, Math.min(100, score)) / 100
  const color = HEALTH_COLOR[label].bar

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeDasharray={`${dash * frac} ${dash}`}
          strokeDashoffset={dash * 0.25}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray .6s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div className="display-num" style={{ fontSize: size * 0.32, lineHeight: 1, color: 'var(--text)' }}>
          {score}
        </div>
      </div>
    </div>
  )
}

function SavingsSparkline() {
  const { transactions, settings } = useAppStore()

  // Rate = cash actually moved into savings vehicles (EF, SIP, etc.), net of
  // anything withdrawn back to cash, as a % of income — the standard "savings
  // rate" definition. cashNet-based calcs treat a savings contribution as an
  // outflow just like an expense, which makes the number go DOWN when you save
  // more; savingsContributed/Withdrawn are the fields that exist specifically to
  // track this, so use them directly.
  const months = useMemo(() => {
    return getLast6Months().map(m => {
      const summary = buildMonthlySummary(transactions, m, settings)
      const netSaved = summary.savingsContributed - summary.savingsWithdrawn
      const rate = summary.totalIncome > 0 ? Math.max(0, netSaved / summary.totalIncome) * 100 : 0
      return { month: m, rate, label: format(parseISO(`${m}-01`), 'MMM') }
    })
  }, [transactions, settings])

  const max = Math.max(...months.map(m => m.rate), 30)
  const min = Math.min(...months.map(m => m.rate), 0)
  const range = max - min || 1
  const W = 120, H = 36, PAD = 4

  const points = months.map((m, i) => {
    const x = PAD + (i / (months.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((m.rate - min) / range) * (H - PAD * 2)
    return `${x},${y}`
  }).join(' ')

  // months[] runs 5-back..current..next (for the upcoming-cycle preview), so the
  // last entry is next month, not "this month" — look up the actual current one.
  const currentMonthKey = format(new Date(), 'yyyy-MM')
  const currentIdx = months.findIndex(m => m.month === currentMonthKey)
  const latest = (currentIdx >= 0 ? months[currentIdx] : months[months.length - 1])?.rate ?? 0
  const rateColor = latest >= 20 ? 'var(--good-ink)' : latest >= 10 ? 'var(--warn-ink)' : 'var(--bad-ink)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 8 }}>
      <div>
        <p style={{ fontSize: 10, color: 'var(--text-4)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Savings Rate</p>
        <p style={{ fontSize: 16, fontWeight: 700, color: rateColor, margin: 0 }}>{latest.toFixed(1)}%</p>
        <p style={{ fontSize: 10, color: 'var(--text-4)', margin: '1px 0 0' }}>this month</p>
      </div>
      <svg width={W} height={H} style={{ flex: 1 }}>
        <polyline
          points={points}
          fill="none"
          stroke={latest >= 20 ? 'var(--good)' : latest >= 10 ? 'var(--warn)' : 'var(--bad)'}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Zero line */}
        {min < 0 && (
          <line
            x1={PAD} y1={H - PAD - ((0 - min) / range) * (H - PAD * 2)}
            x2={W - PAD} y2={H - PAD - ((0 - min) / range) * (H - PAD * 2)}
            stroke="var(--bad)" strokeWidth={0.5} strokeDasharray="2 2" opacity={0.4}
          />
        )}
        {/* Month labels */}
        {months.map((m, i) => (
          <text key={m.month}
            x={PAD + (i / (months.length - 1)) * (W - PAD * 2)}
            y={H}
            textAnchor="middle" fontSize={8} fill="var(--text-4)"
          >{m.label}</text>
        ))}
      </svg>
    </div>
  )
}

export default function PulseCard() {
  const pulse = usePulse()
  const [open, setOpen]     = useState(false)
  const [masked, setMasked] = useState(true)

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              onClick={e => { e.stopPropagation(); setMasked(v => !v) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-3)', display: 'flex' }}
            >
              {masked ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
            <ChevronRight size={15} style={{ color: 'var(--text-3)' }} />
          </div>
        </div>

        {/* Score + headline */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <HealthRing score={pulse.health.score} label={pulse.health.label} size={60} thickness={6} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              fontSize: 11.5, fontWeight: 600, padding: '2px 9px', borderRadius: 999,
              background: c.bg, color: c.ink,
            }}>
              {pulse.health.label.charAt(0).toUpperCase() + pulse.health.label.slice(1)}
            </span>
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '6px 0 0', lineHeight: 1.45 }}>
              {masked ? 'Tap the eye to reveal your financial pulse' : pulse.headline}
            </p>
          </div>
        </div>

        {/* 3 key metrics */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'Income',  value: formatCurrencyFull(pulse.cashPosition.monthIncome),  color: 'var(--good)' },
            { label: 'Spent',   value: formatCurrencyFull(pulse.cashPosition.monthExpenses), color: 'var(--text)' },
            { label: 'Surplus', value: formatCurrencyFull(pulse.cashPosition.surplusNet),    color: c.bar },
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
                {masked ? '₹ ••••' : m.value}
              </span>
            </div>
          ))}
        </div>

        <SavingsSparkline />

        {/* Footer hint */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {pulse.upcoming.length > 0
              ? `${pulse.upcoming.length} obligation${pulse.upcoming.length !== 1 ? 's' : ''} ahead`
              : `${pulse.cashPosition.daysLeft} days left this month`
            }
            {!masked && pulse.cashPosition.daysLeft > 0 && pulse.cashPosition.dailyBudget > 0 && (
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
