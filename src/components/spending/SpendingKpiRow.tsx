'use client'

import { Eye, EyeOff } from 'lucide-react'
import { formatCurrencyFull } from '@/lib/utils'
import { getCategoryDisplayName } from '@/lib/categoryIcons'

const MASK = '₹ ••••'

interface Props {
  totalSpent: number
  avgPerDay: number
  momPct: number | null
  topCategory: string | null
  masked: boolean
  onToggleMasked: () => void
  // Pace forecast — only meaningful (and only passed) when viewing the live, in-progress cycle.
  projectedTotal?: number | null
  plannedTotal?: number
}

export default function SpendingKpiRow({ totalSpent, avgPerDay, momPct, topCategory, masked, onToggleMasked, projectedTotal, plannedTotal }: Props) {
  const overBudget = projectedTotal != null && plannedTotal != null && plannedTotal > 0 && projectedTotal > plannedTotal

  const tiles = [
    { label: 'Total Spent', value: masked ? MASK : formatCurrencyFull(totalSpent), color: 'var(--text)' },
    { label: 'Avg / Day', value: masked ? MASK : formatCurrencyFull(Math.round(avgPerDay)), color: 'var(--text)' },
    {
      label: 'vs Last Month',
      value: momPct === null ? '—' : `${momPct >= 0 ? '+' : ''}${momPct}%`,
      color: momPct === null ? 'var(--text)' : momPct > 0 ? 'var(--warn-ink)' : momPct < 0 ? 'var(--good-ink)' : 'var(--text)',
    },
    {
      label: 'Top Category',
      value: topCategory ? getCategoryDisplayName(topCategory) : '—',
      color: 'var(--text)',
    },
    ...(projectedTotal != null ? [{
      label: 'Projected (month end)',
      value: masked ? MASK : formatCurrencyFull(Math.round(projectedTotal)),
      color: overBudget ? 'var(--bad-ink)' : 'var(--text)',
    }] : []),
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
          Overview
        </span>
        <button
          onClick={onToggleMasked}
          className="pressable"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'inherit' }}
        >
          {masked ? <Eye size={12} /> : <EyeOff size={12} />}
          {masked ? 'Show' : 'Hide'}
        </button>
      </div>
      <div className="gw-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {tiles.map(t => (
          <div key={t.label} className="card-sm" style={{ padding: '12px 14px' }}>
            <p style={{ fontSize: 10.5, color: 'var(--text-3)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>
              {t.label}
            </p>
            <p className="display-num" style={{ fontSize: 'clamp(13px, 3.2vw, 18px)', color: t.color, fontWeight: 700, lineHeight: 1.2, margin: 0 }}>
              {t.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
