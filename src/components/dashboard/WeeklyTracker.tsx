'use client'

import { useState, useEffect } from 'react'
import { addDays, format, startOfWeek } from 'date-fns'
import { useAppStore } from '@/store/appStore'
import { getTransactionsForWeek, formatCurrencyFull } from '@/lib/utils'
import Link from 'next/link'

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
// Day of week index in Mon-first order (0=Mon … 6=Sun)
function getMondayFirstIdx(dow: number) { return dow === 0 ? 6 : dow - 1 }

function WeekBars({
  data,
  budget,
  height = 88,
  todayIdx,
}: {
  data: number[]
  budget: number
  height?: number
  todayIdx: number
}) {
  const dailyBudget = budget > 0 ? budget / 7 : 0
  const max = Math.max(...data, dailyBudget * 1.4, 1)
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height }}>
      {data.map((v, i) => {
        const barH = grown ? Math.max(4, (v / max) * (height - 22)) : 4
        const isToday = i === todayIdx
        const isEmpty = v === 0
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: height - 22 }}>
              <div style={{
                height: barH, borderRadius: 6,
                background: isEmpty
                  ? 'var(--surface-2)'
                  : isToday
                    ? 'linear-gradient(180deg, var(--brand-2), var(--brand))'
                    : 'var(--chip-strong)',
                boxShadow: isToday && !isEmpty ? '0 4px 14px -4px var(--brand)' : 'none',
                transition: `height .7s cubic-bezier(.22,1,.36,1) ${i * 0.05}s`,
              }} />
            </div>
            <span style={{
              fontSize: 10.5, fontWeight: 700,
              color: isToday ? 'var(--brand)' : 'var(--text-4)',
            }}>
              {DAY_LABELS[i]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function WeeklyTracker() {
  const { transactions, settings } = useAppStore()
  const weeklyBudget = settings?.weeklyBudget ?? 0

  const now = new Date()
  const todayMondayIdx = getMondayFirstIdx(now.getDay())
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = addDays(weekStart, 6)

  const weekTxs = getTransactionsForWeek(transactions).filter(t => t.type === 'expense')
  const totalSpent = weekTxs.reduce((s, t) => s + t.amount, 0)

  // Build per-day spend array (Mon–Sun)
  const dailySpend = Array.from({ length: 7 }, (_, i) => {
    const dateStr = format(addDays(weekStart, i), 'yyyy-MM-dd')
    return weekTxs.filter(t => t.date === dateStr).reduce((s, t) => s + t.amount, 0)
  })

  const over = totalSpent - weeklyBudget
  const isOver = weeklyBudget > 0 && over > 0

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="h-eyebrow">Weekly spend</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3 }}>
            {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')}
          </div>
        </div>
        {weeklyBudget > 0 && (
          <span className={`pill ${isOver ? 'bad' : 'good'}`}>
            <span className="pill-dot" />
            {isOver ? `${formatCurrencyFull(over)} over` : 'On track'}
          </span>
        )}
      </div>

      {/* Amount */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'space-between' }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>
          {formatCurrencyFull(totalSpent)}
        </div>
        {weeklyBudget > 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
            of {formatCurrencyFull(weeklyBudget)}
          </div>
        )}
      </div>

      {/* Animated bars */}
      <WeekBars
        data={dailySpend}
        budget={weeklyBudget}
        todayIdx={todayMondayIdx}
        height={88}
      />

      {/* Budget progress strip (only when budget set) */}
      {weeklyBudget > 0 && (
        <div>
          <div style={{ height: 5, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 999,
              width: `${Math.min((totalSpent / weeklyBudget) * 100, 100)}%`,
              background: isOver ? 'var(--bad)' : `linear-gradient(90deg, var(--good), var(--brand))`,
              transition: 'width .5s cubic-bezier(.22,1,.36,1)',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11, color: 'var(--text-4)' }}>
            <span>₹0</span>
            <Link href="/transactions" style={{ color: 'var(--brand-ink)', fontWeight: 600, textDecoration: 'none', fontSize: 11 }}>
              View all →
            </Link>
            <span>{formatCurrencyFull(weeklyBudget)} budget</span>
          </div>
        </div>
      )}

      {!weeklyBudget && (
        <Link href="/settings" style={{ fontSize: 12.5, color: 'var(--brand-ink)', textDecoration: 'none', fontWeight: 600 }}>
          Set a weekly budget in Settings →
        </Link>
      )}
    </div>
  )
}
