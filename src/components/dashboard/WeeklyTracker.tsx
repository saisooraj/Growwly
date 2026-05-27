'use client'

import { useAppStore } from '@/store/appStore'
import { getTransactionsForWeek, formatCurrencyFull } from '@/lib/utils'
import { format, startOfWeek, endOfWeek } from 'date-fns'

function Bar({ value, max = 100, height = 8 }: { value: number; max?: number; height?: number }) {
  const pct = Math.min(200, Math.max(0, (value / max) * 100))
  const over = value > max
  return (
    <div style={{ height, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
      {over && (
        <div style={{
          position: 'absolute', top: -3, bottom: -3,
          left: '50%', width: 2, background: 'var(--text-3)', zIndex: 1,
        }} />
      )}
      <div style={{
        width: `${Math.min(100, pct)}%`, height: '100%',
        background: 'linear-gradient(90deg, var(--good) 0%, var(--warn) 60%, var(--bad) 100%)',
        borderRadius: 999, transition: 'width .4s ease',
      }} />
    </div>
  )
}

export default function WeeklyTracker() {
  const { transactions, settings } = useAppStore()
  const weeklyBudget = settings?.weeklyBudget ?? 0

  const weekTxs = getTransactionsForWeek(transactions).filter(t => t.type === 'expense')
  const spent = weekTxs.reduce((s, t) => s + t.amount, 0)
  const over = spent - weeklyBudget
  const tone = over > 0 ? 'bad' : 'good'

  const now = new Date()
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'MMM d')
  const weekEnd   = format(endOfWeek(now,   { weekStartsOn: 1 }), 'MMM d')

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="h-eyebrow">Weekly spend</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>{weekStart} – {weekEnd}</div>
        </div>
        {weeklyBudget > 0 && (
          <span className={`pill ${tone}`}>
            <span className="pill-dot" />
            {over > 0 ? `${formatCurrencyFull(over)} over` : 'On track'}
          </span>
        )}
      </div>

      {weeklyBudget > 0 ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'space-between' }}>
            <div className="display-num" style={{ fontSize: 30, color: 'var(--text)' }}>
              {formatCurrencyFull(spent)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              of {formatCurrencyFull(weeklyBudget)}
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <Bar value={spent} max={weeklyBudget} height={8} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-3)' }}>
              <span>₹0</span>
              <span className="num">{formatCurrencyFull(weeklyBudget)} budget</span>
            </div>
          </div>
        </>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Set a weekly budget in Settings.</p>
      )}
    </div>
  )
}
