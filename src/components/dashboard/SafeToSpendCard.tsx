'use client'

import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { addDays, addWeeks, differenceInCalendarDays, format, isSameWeek, parseISO, startOfWeek } from 'date-fns'
import { useAppStore } from '@/store/appStore'
import { formatCurrencyFull, getTransactionsForWeek } from '@/lib/utils'
import { useCountUp } from '@/hooks/useCountUp'
import { getCycleRange } from '@/lib/cycle'
import { CategoryIcon, getCategoryDisplayName } from '@/lib/categoryIcons'
import Link from 'next/link'
import type { Transaction } from '@/types'

// ── Hero week bars (white/translucent — used inside gradient card) ────────────

const HERO_DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
function getMondayFirstIdx(dow: number) { return dow === 0 ? 6 : dow - 1 }

function HeroWeekBars({
  expenseData,
  incomeData,
  showIncome,
  weeklyBudget,
  todayIdx,
  weekStart,
}: {
  expenseData: number[]
  incomeData: number[]
  showIncome: boolean
  weeklyBudget: number
  todayIdx: number
  weekStart: Date
}) {
  const dailyBudget = weeklyBudget > 0 ? weeklyBudget / 7 : 0
  const max = Math.max(...expenseData, ...(showIncome ? incomeData : []), dailyBudget * 1.4, 1)
  const [grown, setGrown] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  useEffect(() => {
    setGrown(false)
    const t = setTimeout(() => setGrown(true), 120)
    return () => clearTimeout(t)
  }, [expenseData, incomeData])

  const barsAreaH = 44

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 60, position: 'relative' }}>
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
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, position: 'relative' }}
          >
            {/* Tooltip */}
            {isHovered && (
              <div style={{
                position: 'absolute', bottom: barsAreaH + 18, zIndex: 10, pointerEvents: 'none',
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
              </div>
            )}

            <div style={{
              width: '100%', display: 'flex', justifyContent: 'flex-end', gap: 3,
              height: barsAreaH, borderRadius: 5,
              background: isHovered ? 'rgba(255,255,255,0.10)' : 'transparent',
              transition: 'background .12s',
            }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{
                  height: expH, borderRadius: 5,
                  background: isEmpty
                    ? 'rgba(255,255,255,0.12)'
                    : isToday
                      ? 'rgba(255,255,255,0.90)'
                      : 'rgba(255,255,255,0.45)',
                  transition: `height .65s cubic-bezier(.22,1,.36,1) ${i * 45}ms`,
                }} />
              </div>
              {showIncome && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <div style={{
                    height: incH, borderRadius: 5,
                    background: income === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(120,255,190,0.85)',
                    transition: `height .65s cubic-bezier(.22,1,.36,1) ${i * 45 + 30}ms`,
                  }} />
                </div>
              )}
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: isToday ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)',
            }}>
              {HERO_DAY_LABELS[i]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Spend range ──────────────────────────────────────────────────────────────

type Range = 'today' | '3d' | '7d' | 'custom'
const RANGE_LABELS: Record<Range, string> = {
  today: 'Today',
  '3d': 'Last 3 days',
  '7d': 'Last 7 days',
  custom: 'Custom range',
}

const heroInput: React.CSSProperties = {
  padding: '4px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600,
  background: 'rgba(255,255,255,0.18)', color: '#fff',
  border: '1px solid rgba(255,255,255,0.28)', outline: 'none',
  colorScheme: 'dark',
}

// Expense rows for the chosen range; scrolls once it outgrows the hero
function SpendList({ txs, showDate }: { txs: Transaction[]; showDate: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 172, overflowY: 'auto', marginRight: -4, paddingRight: 4 }}>
      {txs.map(t => {
        const name = getCategoryDisplayName(t.category)
        const sub = [t.notes ? name : '', showDate ? format(parseISO(t.date), 'EEE, MMM d') : ''].filter(Boolean).join(' · ')
        return (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: 'rgba(255,255,255,0.16)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CategoryIcon category={t.category} size={14} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {t.notes || name}
              </div>
              {sub && (
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {sub}
                </div>
              )}
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', flexShrink: 0, fontFamily: "'Geist Mono', monospace" }}>
              {formatCurrencyFull(t.amount)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main card ─────────────────────────────────────────────────────────────────

export default function SafeToSpendCard() {
  const { transactions, selectedMonth, settings } = useAppStore()

  // ── Spend for the chosen range ─────────────────────────────────────────────

  const today = format(new Date(), 'yyyy-MM-dd')
  const [range, setRange] = useState<Range>('today')
  const [customFrom, setCustomFrom] = useState(format(addDays(new Date(), -6), 'yyyy-MM-dd'))
  const [customTo, setCustomTo] = useState(today)

  const [from, to] = range === 'today' ? [today, today]
    : range === '3d' ? [format(addDays(parseISO(today), -2), 'yyyy-MM-dd'), today]
    : range === '7d' ? [format(addDays(parseISO(today), -6), 'yyyy-MM-dd'), today]
    : customFrom <= customTo ? [customFrom, customTo] : [customTo, customFrom]
  const rangeDays = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1

  // Gross expenses, newest first — refunds (often for older purchases) aren't netted off
  const rangeTxs = useMemo(() =>
    transactions
      .filter(t => t.type === 'expense' && t.date >= from && t.date <= to)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  , [transactions, from, to])
  const rangeTotal = rangeTxs.reduce((s, t) => s + t.amount, 0)
  const animatedTotal = useCountUp(rangeTotal, 950)

  const eyebrow = range === 'today' ? 'Spent today'
    : range === 'custom' ? `Spent · ${format(parseISO(from), 'MMM d')} – ${format(parseISO(to), 'MMM d')}`
    : `Spent · ${RANGE_LABELS[range].toLowerCase()}`

  // ── Week data for the weekly section ─────────────────────────────────────────
  // Reference date = today capped at the cycle end, so past cycles show their last week;
  // weekOffset lets the user browse other weeks from there.

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

  const weekTxsAll = getTransactionsForWeek(transactions, weekRef)
  const weekTxs = weekTxsAll.filter(t => t.type === 'expense')
  const weekIncomeTxs = weekTxsAll.filter(t => t.type === 'income')
  const weekTotal = weekTxs.reduce((s, t) => s + t.amount, 0)
  const weekIncomeTotal = weekIncomeTxs.reduce((s, t) => s + t.amount, 0)
  const weekOver = weeklyBudget > 0 && weekTotal - weeklyBudget > 0
  const dailyIncome = Array.from({ length: 7 }, (_, i) => {
    const dateStr = format(addDays(weekStart, i), 'yyyy-MM-dd')
    return weekIncomeTxs.filter(t => t.date === dateStr).reduce((s, t) => s + t.amount, 0)
  })
  const dailySpend = Array.from({ length: 7 }, (_, i) => {
    const dateStr = format(addDays(weekStart, i), 'yyyy-MM-dd')
    return weekTxs.filter(t => t.date === dateStr).reduce((s, t) => s + t.amount, 0)
  })

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      background: 'linear-gradient(150deg, var(--brand-deep) 0%, var(--brand) 55%, var(--brand-2) 100%)',
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--pad)',
      boxShadow: '0 8px 32px -8px var(--brand)',
      display: 'flex', flexDirection: 'column', gap: 14,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle noise overlay for depth */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 60% at 110% -10%, rgba(255,255,255,0.12) 0%, transparent 60%)',
      }} />

      {/* ── Top row: eyebrow + range picker ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, position: 'relative', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em',
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)',
        }}>
          {eyebrow}
        </span>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <select
            value={range}
            onChange={e => setRange(e.target.value as Range)}
            aria-label="Spend range"
            style={{ ...heroInput, appearance: 'none', WebkitAppearance: 'none', padding: '4px 26px 4px 10px', borderRadius: 999, cursor: 'pointer' }}
          >
            {(Object.keys(RANGE_LABELS) as Range[]).map(r => (
              <option key={r} value={r}>{RANGE_LABELS[r]}</option>
            ))}
          </select>
          <ChevronDown size={13} style={{ position: 'absolute', right: 9, color: '#fff', pointerEvents: 'none' }} />
        </div>
      </div>

      {range === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', position: 'relative', marginTop: -4 }}>
          <input type="date" value={customFrom} max={today} onChange={e => e.target.value && setCustomFrom(e.target.value)} style={heroInput} aria-label="From" />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>to</span>
          <input type="date" value={customTo} max={today} onChange={e => e.target.value && setCustomTo(e.target.value)} style={heroInput} aria-label="To" />
        </div>
      )}

      {/* ── Total (left) + that range's transactions (right) ──
          flexGrow takes up any extra height when the hero side column is taller */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', position: 'relative', flexGrow: 1, alignContent: 'flex-start' }}>
        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <div style={{
            fontSize: 'clamp(36px, 7vw, 52px)',
            fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1,
            color: '#fff',
            fontFamily: "'Geist Mono', monospace",
          }}>
            {formatCurrencyFull(animatedTotal)}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 6, fontWeight: 500 }}>
            {rangeTxs.length} transaction{rangeTxs.length !== 1 ? 's' : ''}
            {rangeDays > 1 && rangeTotal > 0 && ` · ${formatCurrencyFull(Math.round(rangeTotal / rangeDays))}/day`}
          </div>
        </div>

        <div style={{ flex: '1.4 1 220px', minWidth: 0 }}>
          {rangeTxs.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', padding: '6px 0' }}>
              {range === 'today' ? 'Nothing spent yet today' : 'Nothing spent in this range'}
            </div>
          ) : (
            <SpendList txs={rangeTxs} showDate={rangeDays > 1} />
          )}
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.18)' }} />

      {/* ── Weekly section ── */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Header: label + week nav (left), on-track pill + income toggle (right) */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <span style={{
              fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)',
            }}>
              This week
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <button
                onClick={() => setWeekOffset(o => o - 1)}
                aria-label="Previous week"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.7)' }}
              >
                <ChevronLeft size={14} strokeWidth={2.5} />
              </button>
              <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', minWidth: 92, textAlign: 'center' }}>
                {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')}
              </span>
              <button
                onClick={() => setWeekOffset(o => o + 1)}
                aria-label="Next week"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.7)' }}
              >
                <ChevronRight size={14} strokeWidth={2.5} />
              </button>
              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 6px', fontSize: 10.5, fontWeight: 700, color: '#fff' }}
                >
                  Today
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            {weeklyBudget > 0 && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                background: 'rgba(255,255,255,0.18)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.28)',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: weekOver ? 'rgba(255,180,100,1)' : '#fff', flexShrink: 0, display: 'inline-block' }} />
                {weekOver ? `${formatCurrencyFull(weekTotal - weeklyBudget)} over` : 'On track'}
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
              <span style={{ fontSize: 10.5, fontWeight: 600, color: showIncome ? '#fff' : 'rgba(255,255,255,0.55)' }}>
                Income
              </span>
              <span style={{
                width: 26, height: 15, borderRadius: 999, position: 'relative', flexShrink: 0,
                background: showIncome ? 'rgba(120,255,190,0.55)' : 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.28)',
                transition: 'background .15s',
              }}>
                <span style={{
                  position: 'absolute', top: 1, left: showIncome ? 12 : 1,
                  width: 11, height: 11, borderRadius: 999, background: '#fff',
                  transition: 'left .15s',
                }} />
              </span>
            </button>
          </div>
        </div>

        {/* Amount row */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff', fontFamily: "'Geist Mono', monospace" }}>
              {formatCurrencyFull(weekTotal)}
            </div>
            {showIncome && weekIncomeTotal > 0 && (
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(120,255,190,0.9)' }}>
                +{formatCurrencyFull(weekIncomeTotal)}
              </div>
            )}
          </div>
          {weeklyBudget > 0 && (
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)' }}>
              of {formatCurrencyFull(weeklyBudget)}
            </div>
          )}
        </div>

        {/* Bars */}
        <HeroWeekBars
          expenseData={dailySpend}
          incomeData={dailyIncome}
          showIncome={showIncome}
          weeklyBudget={weeklyBudget}
          todayIdx={todayMondayIdx}
          weekStart={weekStart}
        />

        {/* Budget progress strip / set-budget CTA */}
        {weeklyBudget > 0 ? (
          <div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.18)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 999,
                width: `${Math.min((weekTotal / weeklyBudget) * 100, 100)}%`,
                background: weekOver ? 'rgba(255,140,120,0.9)' : 'rgba(255,255,255,0.85)',
                transition: 'width .5s cubic-bezier(.22,1,.36,1)',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
              <span>{formatCurrencyFull(weekTotal)} spent</span>
              <Link href="/transactions" style={{ color: '#fff', fontWeight: 600, textDecoration: 'none', fontSize: 11 }}>
                View all →
              </Link>
              <span>{formatCurrencyFull(weeklyBudget)} budget</span>
            </div>
          </div>
        ) : (
          <Link href="/settings" style={{ fontSize: 12.5, color: '#fff', textDecoration: 'none', fontWeight: 600 }}>
            Set a weekly budget in Settings →
          </Link>
        )}
      </div>
    </div>
  )
}
