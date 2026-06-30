'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { getLast6Months, buildMonthlySummary, formatCurrency } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

const BAR_H = 100   // max bar height in px
const BAR_GAP = 5   // gap between Income/Spent within a pair

export default function MonthlyBarChart() {
  const transactions = useAppStore(s => s.transactions)
  const settings     = useAppStore(s => s.settings)
  const borrowings   = useAppStore(s => s.borrowings)
  const months       = getLast6Months()

  const [grown, setGrown] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 80)
    return () => clearTimeout(t)
  }, [])

  const data = months.map(m => {
    const s = buildMonthlySummary(transactions, m, settings, borrowings)
    return {
      label: format(parseISO(`${m}-01`), 'MMM'),
      income:  s.totalIncome,
      expense: s.totalExpenses,
    }
  })

  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expense]), 1)

  // Comparison: last month vs second-to-last
  const last = data[data.length - 1]
  const prev = data[data.length - 2]
  const hasPrev = prev && prev.expense > 0
  const diffPct = hasPrev ? ((last.expense - prev.expense) / prev.expense) * 100 : null
  const prevLabel = prev ? format(parseISO(`${months[months.length - 2]}-01`), 'MMM') : ''

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, overflow: 'visible' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
          6-month flow
        </div>

        {diffPct !== null && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: diffPct <= 0 ? 'var(--good-soft)' : 'var(--bad-soft)',
            color:      diffPct <= 0 ? 'var(--good-ink)' : 'var(--bad-ink)',
          }}>
            {diffPct <= 0 ? '↓' : '↑'}{Math.abs(diffPct).toFixed(0)}% vs {prevLabel}
          </span>
        )}
      </div>

      {/* ── Legend ── */}
      <div style={{ display: 'flex', gap: 14 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--good)', display: 'inline-block' }} />
          Income
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--surface-3)', display: 'inline-block' }} />
          Spent
        </span>
      </div>

      {/* ── Bars ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, position: 'relative' }}>
        {data.map((d, i) => {
          const incH  = grown ? Math.max(4, (d.income  / maxVal) * BAR_H) : 4
          const expH  = grown ? Math.max(4, (d.expense / maxVal) * BAR_H) : 4
          const delay = i * 55
          const isHovered = hoveredIdx === i

          return (
            <div
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                position: 'relative',
              }}
            >
              {/* Tooltip */}
              {isHovered && (
                <div style={{
                  position: 'absolute', bottom: BAR_H + 22,
                  ...(i >= data.length - 2
                    ? { right: 0 }
                    : i <= 1
                      ? { left: 0 }
                      : { left: '50%', transform: 'translateX(-50%)' }),
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '8px 11px',
                  boxShadow: 'var(--elev-lg)',
                  whiteSpace: 'nowrap',
                  zIndex: 10,
                  pointerEvents: 'none',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                    {d.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--good)', flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ color: 'var(--text-3)' }}>Income</span>
                    <span style={{ fontWeight: 700, color: 'var(--good-ink)', marginLeft: 'auto', paddingLeft: 12 }}>
                      {formatCurrency(d.income)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--surface-3)', flexShrink: 0, display: 'inline-block', border: '1px solid var(--border)' }} />
                    <span style={{ color: 'var(--text-3)' }}>Spent</span>
                    <span style={{ fontWeight: 700, color: 'var(--text)', marginLeft: 'auto', paddingLeft: 12 }}>
                      {formatCurrency(d.expense)}
                    </span>
                  </div>
                  {/* Caret */}
                  <div style={{
                    position: 'absolute', bottom: -5,
                    ...(i >= data.length - 2
                      ? { right: 12 }
                      : i <= 1
                        ? { left: 12 }
                        : { left: 'calc(50% - 4px)' }),
                    width: 8, height: 8, background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderTop: 'none', borderLeft: 'none',
                    transform: 'rotate(45deg)',
                  }} />
                </div>
              )}

              {/* Bar pair */}
              <div style={{
                width: '100%', height: BAR_H,
                display: 'flex', alignItems: 'flex-end', gap: BAR_GAP,
                borderRadius: 6,
                background: isHovered ? 'var(--surface-2)' : 'transparent',
                transition: 'background .12s',
                padding: '0 1px',
              }}>
                <div style={{
                  flex: 1, height: incH, borderRadius: '4px 4px 2px 2px',
                  background: 'var(--good)', opacity: isHovered ? 1 : 0.82,
                  transition: `height .65s cubic-bezier(.22,1,.36,1) ${delay}ms, opacity .12s`,
                }} />
                <div style={{
                  flex: 1, height: expH, borderRadius: '4px 4px 2px 2px',
                  background: 'var(--surface-3)',
                  transition: `height .65s cubic-bezier(.22,1,.36,1) ${delay + 30}ms`,
                }} />
              </div>

              {/* Month label */}
              <span style={{
                fontSize: 11, fontWeight: isHovered ? 700 : 600,
                color: isHovered ? 'var(--text)' : i === data.length - 1 ? 'var(--brand)' : 'var(--text-4)',
                transition: 'color .12s',
              }}>
                {d.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
