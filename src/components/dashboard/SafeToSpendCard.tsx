'use client'

import { useMemo } from 'react'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, formatCurrencyFull } from '@/lib/utils'
import { endOfMonth, parseISO, differenceInCalendarDays } from 'date-fns'

export default function SafeToSpendCard() {
  const { transactions, selectedMonth } = useAppStore()

  const { dailySafe, daysLeft, cushion, tone } = useMemo(() => {
    const summary = buildMonthlySummary(transactions, selectedMonth)
    const today = new Date()
    const monthEnd = endOfMonth(parseISO(`${selectedMonth}-01`))
    const daysLeft = Math.max(1, differenceInCalendarDays(monthEnd, today) + 1)
    const cushion = summary.net
    const dailySafe = Math.max(0, cushion / daysLeft)
    const tone = cushion < 0 ? 'bad' : cushion < 5000 ? 'warn' : 'good'
    return { dailySafe, daysLeft, cushion, tone }
  }, [transactions, selectedMonth])

  const accent =
    tone === 'bad'  ? 'var(--bad)'  :
    tone === 'warn' ? 'var(--warn)' :
    'var(--good)'

  const gradientColor =
    tone === 'bad'  ? 'oklch(0.95 0.04 25 / .8)' :
    tone === 'warn' ? 'oklch(0.96 0.06 75 / .8)'  :
    'oklch(0.95 0.05 152 / .8)'

  const ctxLabel =
    tone === 'bad'  ? "You're in deficit" :
    tone === 'warn' ? 'Tight budget' :
    'On track'

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', overflow: 'hidden' }}>
      {/* Radial gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(120% 80% at 90% 0%, ${gradientColor} 0%, transparent 55%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative' }}>
        <div className="h-eyebrow">Safe to spend / day</div>
      </div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span
          className="display-num"
          style={{ fontSize: 34, lineHeight: 1, color: tone === 'bad' ? 'var(--bad-ink)' : 'var(--text)' }}
        >
          {cushion < 0 ? '₹0' : formatCurrencyFull(Math.round(dailySafe))}
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>· {daysLeft} days left</span>
      </div>

      <div style={{
        position: 'relative',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 8, marginTop: 'auto',
      }}>
        <span className={`pill ${tone}`}>
          <span className="pill-dot" />
          {ctxLabel}
        </span>
        <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
          Cushion{' '}
          <span
            className="num"
            style={{ color: cushion < 0 ? 'var(--bad-ink)' : 'var(--text)', fontWeight: 500 }}
          >
            {formatCurrencyFull(cushion)}
          </span>
        </span>
      </div>
    </div>
  )
}
