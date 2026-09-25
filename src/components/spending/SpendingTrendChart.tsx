'use client'

import { memo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency, getMonthLabel } from '@/lib/utils'
import { getCategoryDisplayName } from '@/lib/categoryIcons'

const GRID = 'var(--border)'
const TICK = 'var(--text-3)'

const RANGE_OPTS: { id: 3 | 6 | 12; label: string }[] = [
  { id: 3, label: '3M' },
  { id: 6, label: '6M' },
  { id: 12, label: '12M' },
]

export interface TrendLine {
  category: string
  color: string
  values: number[]
}

interface Props {
  months: string[]     // display months, oldest → newest
  lines: TrendLine[]   // already capped by the caller
  overflowCount: number
  masked: boolean
  rangeMonths: 3 | 6 | 12
  onRangeChange: (r: 3 | 6 | 12) => void
}

function SpendingTrendChart({ months, lines, overflowCount, masked, rangeMonths, onRangeChange }: Props) {
  const [hoverKey, setHoverKey] = useState<string | null>(null)

  const data = months.map((m, i) => {
    const row: Record<string, string | number> = { name: getMonthLabel(m).slice(0, 3) }
    for (const line of lines) row[line.category] = line.values[i] ?? 0
    return row
  })

  const hasData = lines.length > 0 && lines.some(l => l.values.some(v => v > 0))

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', margin: 0 }}>
          Category Trend
        </h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGE_OPTS.map(opt => (
            <button
              key={opt.id}
              onClick={() => onRangeChange(opt.id)}
              className="pressable"
              style={{
                padding: '4px 11px', borderRadius: 999, flexShrink: 0,
                fontSize: 11.5, fontWeight: 600, border: 'none',
                background: rangeMonths === opt.id ? 'var(--text)' : 'var(--surface-2)',
                color: rangeMonths === opt.id ? 'var(--bg)' : 'var(--text-2)',
                cursor: 'pointer', transition: 'background .15s, color .15s',
                fontFamily: 'inherit',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 12, minHeight: 15 }}>
        {overflowCount > 0 && `+${overflowCount} more — narrow your checklist to see them`}
      </div>

      {!hasData ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220 }}>
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No spending in the selected range</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: TICK }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: TICK }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => masked ? '•••' : formatCurrency(v)}
            />
            <Tooltip
              formatter={(v: number, name: string) => [masked ? '₹ ••••' : formatCurrency(v), getCategoryDisplayName(name)]}
              contentStyle={{
                borderRadius: 14, border: '1px solid var(--border)',
                background: 'var(--surface)', fontSize: 13, color: 'var(--text)',
                boxShadow: 'var(--elev)',
              }}
            />
            <Legend
              onMouseEnter={(e) => setHoverKey(e.dataKey as string)}
              onMouseLeave={() => setHoverKey(null)}
              formatter={(value: string) => (
                <span style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{getCategoryDisplayName(value)}</span>
              )}
              wrapperStyle={{ paddingTop: 10 }}
            />
            {lines.map((line, i) => (
              <Line
                key={line.category}
                type="monotone"
                dataKey={line.category}
                stroke={line.color}
                strokeWidth={2}
                strokeOpacity={hoverKey === null || hoverKey === line.category ? 1 : 0.2}
                dot={{ r: 3, fill: line.color }}
                activeDot={{ r: 5 }}
                isAnimationActive={true}
                animationBegin={i * 80}
                animationDuration={900}
                animationEasing="ease-out"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export default memo(SpendingTrendChart)
