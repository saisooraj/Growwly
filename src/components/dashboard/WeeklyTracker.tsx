'use client'

import { useState, useEffect } from 'react'
import { addDays, addWeeks, format, isSameWeek, startOfWeek, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { getTransactionsForWeek, formatCurrencyFull } from '@/lib/utils'
import { getCycleRange } from '@/lib/cycle'
import Link from 'next/link'

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const BAR_GAP = 3
// Day of week index in Mon-first order (0=Mon … 6=Sun)
function getMondayFirstIdx(dow: number) { return dow === 0 ? 6 : dow - 1 }

function WeekBars({
  expenseData,
  incomeData,
  showIncome,
  budget,
  height = 88,
  todayIdx,
  weekStart,
}: {
  expenseData: number[]
  incomeData: number[]
  showIncome: boolean
  budget: number
  height?: number
  todayIdx: number
  weekStart: Date
}) {
  const dailyBudget = budget > 0 ? budget / 7 : 0
  const max = Math.max(...expenseData, ...(showIncome ? incomeData : []), dailyBudget * 1.4, 1)
  const [grown, setGrown] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  useEffect(() => {
    setGrown(false)
    const t = setTimeout(() => setGrown(true), 80)
    return () => clearTimeout(t)
  }, [expenseData, incomeData])

  const barsAreaH = height - 22

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height, position: 'relative' }}>
      {expenseData.map((v, i) => {
        const income = incomeData[i] ?? 0
        const expH = grown ? Math.max(4, (v / max) * barsAreaH) : 4
        const incH = grown ? Math.max(4, (income / max) * barsAreaH) : 4
        const isToday = i === todayIdx
        const isEmpty = v === 0 && (!showIncome || income === 0)
        const isHovered = hoveredIdx === i
        const dayDate = addDays(weekStart, i)

        return (
          <div
            key={i}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative' }}
          >
            {/* Tooltip */}
            {isHovered && (
              <div style={{
                position: 'absolute', bottom: barsAreaH + 22, zIndex: 10, pointerEvents: 'none',
                ...(i >= expenseData.length - 2
                  ? { right: 0 }
                  : i <= 1
                    ? { left: 0 }
                    : { left: '50%', transform: 'translateX(-50%)' }),
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                padding: '8px 11px', boxShadow: 'var(--elev-lg)', whiteSpace: 'nowrap',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                  {format(dayDate, 'EEE, MMM d')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--chip-strong)', flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ color: 'var(--text-3)' }}>Spent</span>
                  <span style={{ fontWeight: 700, color: 'var(--text)', marginLeft: 'auto', paddingLeft: 12 }}>
                    {formatCurrencyFull(v)}
                  </span>
                </div>
                {showIncome && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--good)', flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ color: 'var(--text-3)' }}>Income</span>
                    <span style={{ fontWeight: 700, color: 'var(--good-ink)', marginLeft: 'auto', paddingLeft: 12 }}>
                      {formatCurrencyFull(income)}
                    </span>
                  </div>
                )}
                <div style={{
                  position: 'absolute', bottom: -5,
                  ...(i >= expenseData.length - 2 ? { right: 12 } : i <= 1 ? { left: 12 } : { left: 'calc(50% - 4px)' }),
                  width: 8, height: 8, background: 'var(--surface)',
                  border: '1px solid var(--border)', borderTop: 'none', borderLeft: 'none',
                  transform: 'rotate(45deg)',
                }} />
              </div>
            )}

            <div style={{
              width: '100%', display: 'flex', justifyContent: 'flex-end', gap: BAR_GAP,
              height: barsAreaH, borderRadius: 6,
              background: isHovered ? 'var(--surface-2)' : 'transparent',
              transition: 'background .12s',
            }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{
                  height: expH, borderRadius: 6,
                  background: isEmpty
                    ? 'var(--surface-2)'
                    : isToday
                      ? 'linear-gradient(180deg, var(--brand-2), var(--brand))'
                      : 'var(--chip-strong)',
                  boxShadow: isToday && !isEmpty ? '0 4px 14px -4px var(--brand)' : 'none',
                  transition: `height .7s cubic-bezier(.22,1,.36,1) ${i * 0.05}s`,
                }} />
              </div>
              {showIncome && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <div style={{
                    height: incH, borderRadius: 6,
                    background: income === 0 ? 'var(--surface-2)' : 'var(--good)',
                    opacity: income === 0 ? 1 : 0.85,
                    transition: `height .7s cubic-bezier(.22,1,.36,1) ${i * 0.05 + 0.03}s`,
                  }} />
                </div>
              )}
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
  const { transactions, settings, selectedMonth } = useAppStore()
  const weeklyBudget = settings?.weeklyBudget ?? 0

  const [weekOffset, setWeekOffset] = useState(0)
  const [showIncome, setShowIncome] = useState(false)

  const now = new Date()
  const { end: cycleEnd } = getCycleRange(selectedMonth, settings)
  const baseWeekRef = parseISO(cycleEnd) < now ? parseISO(cycleEnd) : now
  const weekRef = addWeeks(baseWeekRef, weekOffset)

  const isCurrentWeek = weekOffset === 0 && isSameWeek(weekRef, now, { weekStartsOn: 1 })
  const todayMondayIdx = isCurrentWeek ? getMondayFirstIdx(now.getDay()) : -1

  const weekStart = startOfWeek(weekRef, { weekStartsOn: 1 })
  const weekEnd = addDays(weekStart, 6)

  const weekTxs = getTransactionsForWeek(transactions, weekRef)
  const expenseTxs = weekTxs.filter(t => t.type === 'expense')
  const incomeTxs = weekTxs.filter(t => t.type === 'income')
  const totalSpent = expenseTxs.reduce((s, t) => s + t.amount, 0)
  const totalIncome = incomeTxs.reduce((s, t) => s + t.amount, 0)

  // Build per-day arrays (Mon–Sun)
  const dailySpend = Array.from({ length: 7 }, (_, i) => {
    const dateStr = format(addDays(weekStart, i), 'yyyy-MM-dd')
    return expenseTxs.filter(t => t.date === dateStr).reduce((s, t) => s + t.amount, 0)
  })
  const dailyIncome = Array.from({ length: 7 }, (_, i) => {
    const dateStr = format(addDays(weekStart, i), 'yyyy-MM-dd')
    return incomeTxs.filter(t => t.date === dateStr).reduce((s, t) => s + t.amount, 0)
  })

  const over = totalSpent - weeklyBudget
  const isOver = weeklyBudget > 0 && over > 0

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div className="h-eyebrow">Weekly spend</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <button
              onClick={() => setWeekOffset(o => o - 1)}
              aria-label="Previous week"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: 'var(--text-3)' }}
            >
              <ChevronLeft size={14} strokeWidth={2.5} />
            </button>
            <span style={{ fontSize: 12.5, color: 'var(--text-3)', minWidth: 92, textAlign: 'center' }}>
              {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')}
            </span>
            <button
              onClick={() => setWeekOffset(o => o + 1)}
              aria-label="Next week"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: 'var(--text-3)' }}
            >
              <ChevronRight size={14} strokeWidth={2.5} />
            </button>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 6px', fontSize: 10.5, fontWeight: 700, color: 'var(--brand-ink)' }}
              >
                Today
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          {weeklyBudget > 0 && (
            <span className={`pill ${isOver ? 'bad' : 'good'}`}>
              <span className="pill-dot" />
              {isOver ? `${formatCurrencyFull(over)} over` : 'On track'}
            </span>
          )}
          <button
            onClick={() => setShowIncome(s => !s)}
            aria-pressed={showIncome}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer',
              background: 'transparent', padding: 0,
            }}
          >
            <span style={{ fontSize: 10.5, fontWeight: 600, color: showIncome ? 'var(--good-ink)' : 'var(--text-4)' }}>
              Income
            </span>
            <span style={{
              width: 26, height: 15, borderRadius: 999, position: 'relative', flexShrink: 0,
              background: showIncome ? 'var(--good)' : 'var(--surface-2)',
              border: '1px solid var(--border)',
              transition: 'background .15s',
            }}>
              <span style={{
                position: 'absolute', top: 1, left: showIncome ? 12 : 1,
                width: 11, height: 11, borderRadius: 999, background: 'var(--surface)',
                boxShadow: 'var(--elev)', transition: 'left .15s',
              }} />
            </span>
          </button>
        </div>
      </div>

      {/* Amount */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>
            {formatCurrencyFull(totalSpent)}
          </div>
          {showIncome && totalIncome > 0 && (
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--good-ink)' }}>
              +{formatCurrencyFull(totalIncome)}
            </div>
          )}
        </div>
        {weeklyBudget > 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
            of {formatCurrencyFull(weeklyBudget)}
          </div>
        )}
      </div>

      {/* Animated bars */}
      <WeekBars
        expenseData={dailySpend}
        incomeData={dailyIncome}
        showIncome={showIncome}
        budget={weeklyBudget}
        todayIdx={todayMondayIdx}
        weekStart={weekStart}
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
