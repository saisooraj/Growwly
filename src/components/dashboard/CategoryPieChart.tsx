'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, ArrowUpRight } from 'lucide-react'
import { PieChart, Pie, Cell, Sector, ResponsiveContainer, Label } from 'recharts'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, formatCurrency, formatCurrencyFull, CATEGORY_COLORS, getLast6Months, getMonthLabel } from '@/lib/utils'

const MAX_SLICES = 6

interface ShapeProps {
  cx: number; cy: number
  innerRadius: number; outerRadius: number
  startAngle: number; endAngle: number
  fill: string
}

function ActiveShape(props: ShapeProps) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
  return (
    <Sector
      cx={cx} cy={cy}
      innerRadius={innerRadius - 3}
      outerRadius={outerRadius + 6}
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

  // Aggregate by category — either for a specific month or all time
  const byCategory: Record<string, number> = chartMonth === 'all'
    ? transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => { acc[t.category] = (acc[t.category] ?? 0) + t.amount; return acc }, {} as Record<string, number>)
    : buildMonthlySummary(transactions, chartMonth, settings, borrowings).byCategory

  const sorted = Object.entries(byCategory)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)

  if (sorted.length === 0) {
    return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No expense data this month</p>
      </div>
    )
  }

  const top = sorted.slice(0, MAX_SLICES)
  const rest = sorted.slice(MAX_SLICES)
  const otherTotal = rest.reduce((s, [, v]) => s + v, 0)
  const hasOther = otherTotal > 0

  const data = [
    ...top.map(([cat, val]) => ({ name: cat, value: val, color: CATEGORY_COLORS[cat] ?? '#94a3b8', isOther: false })),
    ...(hasOther ? [{ name: 'Other', value: otherTotal, color: '#94a3b8', isOther: true }] : []),
  ]

  const total = data.reduce((s, d) => s + d.value, 0)
  const active = activeIdx !== null ? data[activeIdx] : null

  function navigate(cat: string) {
    const params = new URLSearchParams({ cat })
    router.push(`/transactions?${params}`)
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="h-eyebrow">Expense Breakdown</span>
        <select
          value={chartMonth}
          onChange={e => { setChartMonth(e.target.value); setOtherExpanded(false); setActiveIdx(null) }}
          style={{
            fontSize: 11, padding: '3px 8px',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 7, color: 'var(--text-2)', outline: 'none', cursor: 'pointer',
          }}
        >
          {months.map(m => (
            <option key={m} value={m}>{getMonthLabel(m)}</option>
          ))}
          <option value="all">All time</option>
        </select>
      </div>

      {/* Donut */}
      <ResponsiveContainer width="100%" height={196}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={84}
            paddingAngle={2}
            dataKey="value"
            activeIndex={activeIdx ?? undefined}
            activeShape={ActiveShape as unknown as object}
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
                return (
                  <g>
                    <text
                      x={cx} y={active ? cy - 10 : cy - 8}
                      textAnchor="middle"
                      style={{ fontSize: active ? 15 : 18, fontWeight: 600, fill: 'var(--text)', fontFamily: 'Geist, sans-serif' }}
                    >
                      {active ? formatCurrency(active.value) : formatCurrency(total)}
                    </text>
                    <text
                      x={cx} y={active ? cy + 8 : cy + 10}
                      textAnchor="middle"
                      style={{ fontSize: 10.5, fill: 'var(--text-3)', fontFamily: 'Geist, sans-serif' }}
                    >
                      {active ? active.name : 'total spend'}
                    </text>
                    {active && (
                      <text
                        x={cx} y={cy + 24}
                        textAnchor="middle"
                        style={{ fontSize: 10, fill: 'var(--text-4)', fontFamily: 'Geist, sans-serif' }}
                      >
                        {((active.value / total) * 100).toFixed(1)}% of spend
                      </text>
                    )}
                  </g>
                )
              }}
              position="center"
            />
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', margin: '8px 0 10px' }} />

      {/* Category list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {data.map((item, i) => {
          const pct = (item.value / total) * 100
          const isActive = activeIdx === i
          return (
            <div key={i}>
              {/* Category row */}
              <button
                onMouseEnter={() => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(null)}
                onClick={() => item.isOther ? setOtherExpanded(v => !v) : navigate(item.name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 8px', borderRadius: 8, width: '100%',
                  background: isActive ? 'var(--surface-2)' : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  transition: 'background .12s',
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                  background: item.color,
                  opacity: activeIdx === null || isActive ? 1 : 0.4,
                  transition: 'opacity .15s',
                }} />
                <span style={{
                  flex: 1, fontSize: 12,
                  color: isActive ? 'var(--text)' : 'var(--text-2)',
                  fontWeight: isActive ? 500 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  transition: 'color .12s',
                }}>
                  {item.name}
                </span>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', flexShrink: 0 }}>
                  {formatCurrency(item.value)}
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--text-4)', flexShrink: 0, minWidth: 28, textAlign: 'right' }}>
                  {pct.toFixed(0)}%
                </span>
                <span style={{ color: 'var(--text-4)', flexShrink: 0, display: 'flex' }}>
                  {item.isOther
                    ? (otherExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
                    : <ArrowUpRight size={12} />
                  }
                </span>
              </button>

              {/* "Other" expanded: show sub-categories */}
              {item.isOther && otherExpanded && (
                <div style={{
                  marginLeft: 16, marginTop: 2, marginBottom: 4,
                  borderLeft: '2px solid var(--border)',
                  paddingLeft: 10,
                  display: 'flex', flexDirection: 'column', gap: 1,
                }}>
                  {rest.map(([cat, val]) => (
                    <button
                      key={cat}
                      onClick={() => navigate(cat)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '4px 8px', borderRadius: 6, width: '100%',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        textAlign: 'left', transition: 'background .12s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{
                        width: 6, height: 6, borderRadius: 1, flexShrink: 0,
                        background: CATEGORY_COLORS[cat] ?? '#94a3b8',
                      }} />
                      <span style={{ flex: 1, fontSize: 11.5, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cat}
                      </span>
                      <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text)', flexShrink: 0 }}>
                        {formatCurrency(val)}
                      </span>
                      <ArrowUpRight size={11} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}
