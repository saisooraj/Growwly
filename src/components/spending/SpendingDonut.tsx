'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { PieChart, Pie, Cell, Sector, ResponsiveContainer, Label } from 'recharts'
import { formatCurrency, formatCurrencyFull } from '@/lib/utils'
import { getCategoryDisplayName } from '@/lib/categoryIcons'

const MASK = '₹ ••••'

export interface DonutSlice {
  name: string
  value: number
  color: string
  isOther: boolean
}

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
      innerRadius={innerRadius - 3}
      outerRadius={outerRadius + 7}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  )
}

interface Props {
  data: DonutSlice[]
  rest: [string, number][]
  total: number
  monthLabel: string
  masked: boolean
  onSliceClick: (category: string) => void
}

export default function SpendingDonut({ data, rest, total, monthLabel, masked, onSliceClick }: Props) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [otherExpanded, setOtherExpanded] = useState(false)

  if (total === 0) {
    return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 260 }}>
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No expense data for this range</p>
      </div>
    )
  }

  function handleClick(item: DonutSlice, i: number) {
    if (item.isOther) { setOtherExpanded(v => !v); return }
    setActiveIdx(i)
    onSliceClick(item.name)
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
          All categories
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
          {monthLabel} spending breakdown
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flexShrink: 0, width: 208, height: 208, margin: '0 auto' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={66}
                outerRadius={100}
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
                onClick={(_, i) => handleClick(data[i], i)}
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
                        <text x={cx} y={cy - 12} textAnchor="middle"
                          style={{ fontSize: 9, fontWeight: 800, fill: 'var(--text-4)', letterSpacing: '.09em', textTransform: 'uppercase', fontFamily: 'inherit' }}
                        >
                          {display ? getCategoryDisplayName(display.name) : 'TOTAL SPENT'}
                        </text>
                        <text x={cx} y={cy + 8} textAnchor="middle"
                          style={{ fontSize: display ? 15 : 18, fontWeight: 800, fill: 'var(--text)', fontFamily: 'inherit' }}
                        >
                          {masked ? MASK : formatCurrency(display ? display.value : total)}
                        </text>
                        <text x={cx} y={cy + 24} textAnchor="middle"
                          style={{ fontSize: 10, fill: 'var(--text-4)', fontFamily: 'inherit' }}
                        >
                          {display ? `${((display.value / total) * 100).toFixed(0)}% of total` : monthLabel}
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

        <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {data.map((item, i) => {
            const isActive = activeIdx === i
            return (
              <div key={i}>
                <button
                  onMouseEnter={() => setActiveIdx(i)}
                  onMouseLeave={() => setActiveIdx(null)}
                  onClick={() => handleClick(item, i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 7px', borderRadius: 9, width: '100%',
                    background: isActive ? 'var(--surface-2)' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    textAlign: 'left', transition: 'background .12s', fontFamily: 'inherit',
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: item.color,
                    opacity: activeIdx === null || isActive ? 1 : 0.3,
                    transition: 'opacity .15s',
                  }} />
                  <span style={{
                    flex: 1, fontSize: 12.5,
                    color: isActive ? 'var(--text)' : 'var(--text-2)',
                    fontWeight: isActive ? 600 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    transition: 'color .12s',
                  }}>
                    {item.isOther ? 'Other' : getCategoryDisplayName(item.name)}
                  </span>
                  <span style={{
                    fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
                    flexShrink: 0, fontFamily: "'Geist Mono', monospace",
                  }}>
                    {masked ? MASK : formatCurrencyFull(item.value)}
                  </span>
                  {item.isOther && (
                    <span style={{ color: 'var(--text-4)', flexShrink: 0, display: 'flex' }}>
                      {otherExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </span>
                  )}
                </button>

                {item.isOther && otherExpanded && (
                  <div style={{
                    marginLeft: 16, borderLeft: '2px solid var(--border)', paddingLeft: 9,
                    display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2, marginBottom: 2,
                  }}>
                    {rest.map(([cat, val]) => (
                      <button
                        key={cat}
                        onClick={() => onSliceClick(cat)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7,
                          padding: '4px 6px', borderRadius: 7, width: '100%',
                          background: 'transparent', border: 'none',
                          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                          transition: 'background .12s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: 'var(--text-4)' }} />
                        <span style={{ flex: 1, fontSize: 11.5, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {getCategoryDisplayName(cat)}
                        </span>
                        <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text)', flexShrink: 0, fontFamily: "'Geist Mono', monospace" }}>
                          {masked ? MASK : formatCurrencyFull(val)}
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
