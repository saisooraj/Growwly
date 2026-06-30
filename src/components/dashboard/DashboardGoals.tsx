'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAppStore } from '@/store/appStore'
import { formatCurrencyFull } from '@/lib/utils'
import { GoalIcon } from '@/lib/categoryIcons'

function GoalRing({
  pct,
  size = 68,
  stroke = 5,
}: {
  pct: number
  size?: number
  stroke?: number
}) {
  const r      = (size - stroke) / 2
  const circ   = 2 * Math.PI * r
  const target = (Math.max(0, Math.min(100, pct)) / 100) * circ

  // Animate from 0 → target on mount / pct change
  const [dash, setDash] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setDash(target), 80)
    return () => clearTimeout(t)
  }, [target])

  return (
    <svg
      width={size}
      height={size}
      style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0, overflow: 'visible' }}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--brand)" strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s cubic-bezier(.22,1,.36,1)' }}
      />
    </svg>
  )
}

export default function DashboardGoals() {
  const { savingsGoals } = useAppStore()

  if (savingsGoals.length === 0) return null

  const active = savingsGoals.slice(0, 4)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Section header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
          Goals
        </span>
        <Link
          href="/goals"
          style={{
            fontSize: 13, color: 'var(--brand-ink)', fontWeight: 600,
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3,
          }}
        >
          All goals →
        </Link>
      </div>

      {/* Goal cards — 2-col on mobile, 4-col on desktop */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        gap: 12,
      }}>
        {active.map(goal => {
          const pct = goal.targetAmount > 0
            ? (goal.currentAmount / goal.targetAmount) * 100
            : 0

          return (
            <Link key={goal.id} href="/goals" style={{ textDecoration: 'none' }}>
              <div
                className="card"
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 10, padding: '18px 12px', cursor: 'pointer',
                  transition: 'transform .12s ease, box-shadow .12s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = 'var(--elev-lg)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = 'var(--elev)'
                }}
              >
                {/* Ring + icon */}
                <div style={{ position: 'relative', width: 68, height: 68, flexShrink: 0 }}>
                  <GoalRing pct={pct} size={68} />
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <GoalIcon emoji={goal.emoji} size={26} color="var(--text-2)" stroke={1.5} />
                  </div>
                </div>

                {/* Name + stats */}
                <div style={{ textAlign: 'center', minWidth: 0, width: '100%' }}>
                  <div style={{
                    fontSize: 12.5, fontWeight: 700, color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    lineHeight: 1.3,
                  }}>
                    {goal.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>
                    {formatCurrencyFull(goal.currentAmount)} · {Math.round(pct)}%
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
