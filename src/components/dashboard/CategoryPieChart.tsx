'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, Sector, ResponsiveContainer, Label } from 'recharts'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, formatCurrency, formatCurrencyFull, CATEGORY_COLORS } from '@/lib/utils'

const MAX_SLICES = 6

function ActiveShape(props: Record<string, number>) {
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
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const { transactions, selectedMonth, settings, borrowings } = useAppStore()
  const summary = buildMonthlySummary(transactions, selectedMonth, settings, borrowings)

  const sorted = Object.entries(summary.byCategory)
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

  const data = [
    ...top.map(([cat, val]) => ({ name: cat, value: val, color: CATEGORY_COLORS[cat] ?? '#94a3b8' })),
    ...(otherTotal > 0 ? [{ name: 'Other', value: otherTotal, color: '#94a3b8' }] : []),
  ]

  const total = data.reduce((s, d) => s + d.value, 0)
  const active = activeIdx !== null ? data[activeIdx] : null

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="h-eyebrow">Expense Breakdown</span>
        <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
          {formatCurrencyFull(total)} total
        </span>
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
            activeShape={ActiveShape as any}
            onMouseEnter={(_, i) => setActiveIdx(i)}
            onMouseLeave={() => setActiveIdx(null)}
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
            <div
              key={i}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseLeave={() => setActiveIdx(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 8px', borderRadius: 8,
                background: isActive ? 'var(--surface-2)' : 'transparent',
                transition: 'background .12s', cursor: 'default',
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
              <span style={{
                fontSize: 10.5, color: 'var(--text-4)',
                flexShrink: 0, minWidth: 30, textAlign: 'right',
              }}>
                {pct.toFixed(0)}%
              </span>
            </div>
          )
        })}
      </div>

    </div>
  )
}
