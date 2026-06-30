'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { PieChart, Pie, Cell, Sector, ResponsiveContainer, Label } from 'recharts'
import { useAppStore } from '@/store/appStore'
import {
  buildMonthlySummary, formatCurrency, formatCurrencyFull,
  CATEGORY_COLORS, getLast6Months, getMonthLabel,
} from '@/lib/utils'
import { getCategoryDisplayName } from '@/lib/categoryIcons'
import { format, parseISO } from 'date-fns'

const MAX_SLICES = 6

interface ShapeProps {
  cx: number; cy: number
  innerRadius: number; outerRadius: number
  startAngle: number; endAngle: number
  fill: string
}

function ActiveShape({ cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill }: ShapeProps) {
  return (
    <Sector
      cx={cx} cy={cy}
      innerRadius={innerRadius - 2}
      outerRadius={outerRadius + 5}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  )
}

export default function CategoryPieChart() {
  const router = useRouter()
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [otherExpanded, setOtherExpanded] = useState(false)
  const { transactions, selectedMonth, settings, borrowings } = useAppStore()

  const months = getLast6Months()
  const [chartMonth, setChartMonth] = useState<string>(selectedMonth)

  // Sync with header month switcher
  useEffect(() => { setChartMonth(selectedMonth) }, [selectedMonth])

  const monthLabel = chartMonth === 'all'
    ? 'All time'
    : format(parseISO(`${chartMonth}-01`), 'MMM yyyy')

  // Aggregate by category
  const byCategory: Record<string, number> = chartMonth === 'all'
    ? transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => { acc[t.category] = (acc[t.category] ?? 0) + t.amount; return acc }, {} as Record<string, number>)
    : buildMonthlySummary(transactions, chartMonth, settings, borrowings).byCategory

  const sorted = Object.entries(byCategory)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)

  const top  = sorted.slice(0, MAX_SLICES)
  const rest = sorted.slice(MAX_SLICES)
  const otherTotal = rest.reduce((s, [, v]) => s + v, 0)

  const data = [
    ...top.map(([cat, val]) => ({
      name: cat, value: val,
      color: CATEGORY_COLORS[cat] ?? '#94a3b8',
      isOther: false,
    })),
    ...(otherTotal > 0 ? [{ name: 'Other', value: otherTotal, color: '#94a3b8', isOther: true }] : []),
  ]

  const total = data.reduce((s, d) => s + d.value, 0)

  if (total === 0) {
    return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No expense data this month</p>
      </div>
    )
  }

  function navigate(cat: string) {
    router.push(`/transactions?cat=${encodeURIComponent(cat)}`)
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            Where it goes
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {monthLabel} spending by category
          </div>
        </div>

        {/* Month dropdown */}
        <select
          value={chartMonth}
          onChange={e => { setChartMonth(e.target.value); setOtherExpanded(false); setActiveIdx(null) }}
          style={{
            fontSize: 11.5, padding: '4px 8px',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text-2)', outline: 'none',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          {months.map(m => (
            <option key={m} value={m}>{getMonthLabel(m)}</option>
          ))}
          <option value="all">All time</option>
        </select>
      </div>

      {/* ── Body: donut LEFT + legend RIGHT ── */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>

        {/* Donut */}
        <div style={{ flexShrink: 0, width: 152, height: 152 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={47}
                outerRadius={72}
                paddingAngle={2}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                activeIndex={activeIdx ?? undefined}
                activeShape={ActiveShape as unknown as object}
                isAnimationActive={true}
                animationBegin={0}
                animationDuration={900}
                animationEasing="ease-out"
                onMouseEnter={(_, i) => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(null)}
                onClick={(_, i) => {
                  const item = data[i]
                  if (item.isOther) setOtherExpanded(v => !v)
                  else navigate(item.name)
                }}
                strokeWidth={0}
              >
                {data.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.color}
                    opacity={activeIdx === null || activeIdx === i ? 1 : 0.25}
                    style={{ cursor: 'pointer', transition: 'opacity .15s' }}
                  />
                ))}
                <Label
                  content={({ viewBox }) => {
                    const { cx, cy } = viewBox as { cx: number; cy: number }
                    const display = activeIdx !== null ? data[activeIdx] : null
                    return (
                      <g>
                        <text x={cx} y={cy - 11} textAnchor="middle"
                          style={{ fontSize: 8, fontWeight: 800, fill: 'var(--text-4)', letterSpacing: '.09em', textTransform: 'uppercase', fontFamily: 'inherit' }}
                        >
                          {display ? getCategoryDisplayName(display.name) : 'SPENT'}
                        </text>
                        <text x={cx} y={cy + 6} textAnchor="middle"
                          style={{ fontSize: display ? 12 : 15, fontWeight: 800, fill: 'var(--text)', fontFamily: 'inherit' }}
                        >
                          {formatCurrency(display ? display.value : total)}
                        </text>
                        <text x={cx} y={cy + 20} textAnchor="middle"
                          style={{ fontSize: 9, fill: 'var(--text-4)', fontFamily: 'inherit' }}
                        >
                          {display
                            ? `${((display.value / total) * 100).toFixed(0)}%`
                            : monthLabel}
                        </text>
                      </g>
                    )
                  }}
                  position="center"
                />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* ── Legend ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {data.map((item, i) => {
            const isActive = activeIdx === i
            return (
              <div key={i}>
                <button
                  onMouseEnter={() => setActiveIdx(i)}
                  onMouseLeave={() => setActiveIdx(null)}
                  onClick={() => item.isOther ? setOtherExpanded(v => !v) : navigate(item.name)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '5px 6px', borderRadius: 8, width: '100%',
                    background: isActive ? 'var(--surface-2)' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    textAlign: 'left', transition: 'background .12s', fontFamily: 'inherit',
                  }}
                >
                  {/* Color dot */}
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: item.color,
                    opacity: activeIdx === null || isActive ? 1 : 0.3,
                    transition: 'opacity .15s',
                  }} />

                  {/* Name */}
                  <span style={{
                    flex: 1, fontSize: 11.5,
                    color: isActive ? 'var(--text)' : 'var(--text-2)',
                    fontWeight: isActive ? 600 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    transition: 'color .12s',
                  }}>
                    {item.isOther ? 'Other' : getCategoryDisplayName(item.name)}
                  </span>

                  {/* Amount */}
                  <span style={{
                    fontSize: 11.5, fontWeight: 600, color: 'var(--text)',
                    flexShrink: 0, fontFamily: "'Geist Mono', monospace",
                  }}>
                    {formatCurrencyFull(item.value)}
                  </span>

                  {/* Expand chevron for Other */}
                  {item.isOther && (
                    <span style={{ color: 'var(--text-4)', flexShrink: 0, display: 'flex' }}>
                      {otherExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </span>
                  )}
                </button>

                {/* Other → expanded sub-categories */}
                {item.isOther && otherExpanded && (
                  <div style={{
                    marginLeft: 14,
                    borderLeft: '2px solid var(--border)',
                    paddingLeft: 8,
                    display: 'flex', flexDirection: 'column', gap: 1,
                    marginTop: 2, marginBottom: 2,
                  }}>
                    {rest.map(([cat, val]) => (
                      <button
                        key={cat}
                        onClick={() => navigate(cat)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7,
                          padding: '4px 6px', borderRadius: 7, width: '100%',
                          background: 'transparent', border: 'none',
                          cursor: 'pointer', textAlign: 'left',
                          fontFamily: 'inherit',
                          transition: 'background .12s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                          background: CATEGORY_COLORS[cat] ?? '#94a3b8',
                        }} />
                        <span style={{
                          flex: 1, fontSize: 11, color: 'var(--text-2)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {getCategoryDisplayName(cat)}
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 500, color: 'var(--text)',
                          flexShrink: 0, fontFamily: "'Geist Mono', monospace",
                        }}>
                          {formatCurrencyFull(val)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
