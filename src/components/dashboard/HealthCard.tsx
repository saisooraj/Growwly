'use client'

import { useMemo } from 'react'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, getLast6Months } from '@/lib/utils'
import { endOfMonth, parseISO, differenceInCalendarDays, format } from 'date-fns'

function useHealthScore() {
  const { transactions, budgets, emergencyFund, selectedMonth } = useAppStore()

  return useMemo(() => {
    const summary = buildMonthlySummary(transactions, selectedMonth)

    // 1. Cash flow (weight 35)
    let cashFlowScore = 100
    if (summary.totalIncome > 0) {
      const savingsRate = (summary.net / summary.totalIncome) * 100
      if (savingsRate < 0)        cashFlowScore = Math.max(0, 40 + savingsRate)
      else if (savingsRate < 10)  cashFlowScore = 60 + savingsRate * 4
      else if (savingsRate < 20)  cashFlowScore = 80 + (savingsRate - 10) * 2
      else                        cashFlowScore = 100
    } else {
      cashFlowScore = summary.totalExpenses === 0 ? 50 : 30
    }

    // 2. Budget (weight 30)
    const monthBudgets = budgets.filter(b => b.month === selectedMonth)
    let budgetScore = 75
    if (monthBudgets.length > 0) {
      const totalPlanned = monthBudgets.reduce((s, b) => s + b.planned, 0)
      if (totalPlanned > 0) {
        const ratio = summary.totalExpenses / totalPlanned
        if (ratio <= 0.80)      budgetScore = 100
        else if (ratio <= 0.90) budgetScore = 85
        else if (ratio <= 1.00) budgetScore = 70
        else if (ratio <= 1.20) budgetScore = 45
        else                    budgetScore = 20
      }
    }

    // 3. Emergency fund (weight 20)
    let efScore = 50
    if (emergencyFund) {
      efScore = Math.min(100, (emergencyFund.currentBalance / emergencyFund.targetAmount) * 100)
    }

    // 4. Spending velocity (weight 15)
    let velocityScore = 75
    if (summary.totalIncome > 0) {
      const today = new Date()
      const monthStart = parseISO(`${selectedMonth}-01`)
      const monthEnd = endOfMonth(monthStart)
      const daysInMonth = differenceInCalendarDays(monthEnd, monthStart) + 1
      const daysPassed = Math.max(1, differenceInCalendarDays(today, monthStart) + 1)
      const dailyBurnRate = summary.totalExpenses / daysPassed
      const projectedRatio = (dailyBurnRate * daysInMonth) / summary.totalIncome
      if (projectedRatio <= 0.70)      velocityScore = 100
      else if (projectedRatio <= 0.85) velocityScore = 85
      else if (projectedRatio <= 1.00) velocityScore = 70
      else if (projectedRatio <= 1.15) velocityScore = 45
      else                             velocityScore = 25
    }

    const parts = [
      { k: 'Cash Flow', v: Math.round(cashFlowScore) },
      { k: 'Budget',    v: Math.round(budgetScore) },
      { k: 'EF',        v: Math.round(efScore) },
      { k: 'Pace',      v: Math.round(velocityScore) },
    ]

    const score = Math.round(
      (cashFlowScore * 35 + budgetScore * 30 + efScore * 20 + velocityScore * 15) / 100
    )

    const description =
      score >= 80 ? 'Looking great — keep up the momentum.' :
      score >= 60 ? 'Doing okay. Watch your cash flow and budget.' :
                    'Under pressure. Cash flow is the biggest drag.'

    return { score, parts, description }
  }, [transactions, budgets, emergencyFund, selectedMonth])
}

function HealthRing({ score, size = 150, thickness = 12 }: { score: number; size?: number; thickness?: number }) {
  const r = size / 2 - thickness / 2 - 2
  const cx = size / 2
  const cy = size / 2
  const dash = 2 * Math.PI * r
  const frac = Math.max(0, Math.min(100, score)) / 100
  const color = score >= 75 ? 'var(--good)' : score >= 50 ? 'var(--warn)' : 'var(--bad)'

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeDasharray={`${dash * frac} ${dash}`}
          strokeDashoffset={dash * 0.25}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray .6s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div className="display-num" style={{ fontSize: size * 0.32, lineHeight: 1, color: 'var(--text)' }}>
          {score}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 4 }}>
          Health
        </div>
      </div>
    </div>
  )
}

function Bar({ value, tone = 'good', height = 4 }: { value: number; tone?: string; height?: number }) {
  const pct = Math.min(100, Math.max(0, value))
  const color =
    tone === 'bad' ? 'var(--bad)' :
    tone === 'warn' ? 'var(--warn)' :
    tone === 'brand' ? 'var(--brand)' :
    tone === 'info' ? 'var(--info)' :
    'var(--good)'
  return (
    <div style={{ height, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width .4s cubic-bezier(.4,0,.2,1)' }} />
    </div>
  )
}

function SavingsSparkline() {
  const { transactions, settings } = useAppStore()

  const months = useMemo(() => {
    return getLast6Months().map(m => {
      const summary = buildMonthlySummary(transactions, m, settings)
      const rate = summary.totalIncome > 0 ? (summary.net / summary.totalIncome) * 100 : 0
      return { month: m, rate, label: format(parseISO(`${m}-01`), 'MMM') }
    })
  }, [transactions, settings])

  const max = Math.max(...months.map(m => m.rate), 30)
  const min = Math.min(...months.map(m => m.rate), 0)
  const range = max - min || 1
  const W = 120, H = 36, PAD = 4

  const points = months.map((m, i) => {
    const x = PAD + (i / (months.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((m.rate - min) / range) * (H - PAD * 2)
    return `${x},${y}`
  }).join(' ')

  const latest = months[months.length - 1]?.rate ?? 0
  const rateColor = latest >= 20 ? 'var(--good-ink)' : latest >= 10 ? 'var(--warn-ink)' : 'var(--bad-ink)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 8, marginTop: 4 }}>
      <div>
        <p style={{ fontSize: 10, color: 'var(--text-4)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Savings Rate</p>
        <p style={{ fontSize: 16, fontWeight: 700, color: rateColor, margin: 0 }}>{latest.toFixed(1)}%</p>
        <p style={{ fontSize: 10, color: 'var(--text-4)', margin: '1px 0 0' }}>this month</p>
      </div>
      <svg width={W} height={H} style={{ flex: 1 }}>
        <polyline
          points={points}
          fill="none"
          stroke={latest >= 20 ? 'var(--good)' : latest >= 10 ? 'var(--warn)' : 'var(--bad)'}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Zero line */}
        {min < 0 && (
          <line
            x1={PAD} y1={H - PAD - ((0 - min) / range) * (H - PAD * 2)}
            x2={W - PAD} y2={H - PAD - ((0 - min) / range) * (H - PAD * 2)}
            stroke="var(--bad)" strokeWidth={0.5} strokeDasharray="2 2" opacity={0.4}
          />
        )}
        {/* Month labels */}
        {months.map((m, i) => (
          <text key={m.month}
            x={PAD + (i / (months.length - 1)) * (W - PAD * 2)}
            y={H}
            textAnchor="middle" fontSize={8} fill="var(--text-4)"
          >{m.label}</text>
        ))}
      </svg>
    </div>
  )
}

export default function HealthCard() {
  const { score, parts, description } = useHealthScore()

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
        <div style={{ flexShrink: 0 }}>
          <HealthRing score={score} size={120} thickness={10} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div className="h-eyebrow">Financial health</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4, lineHeight: 1.45 }}>
              {description}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {parts.map(p => (
              <div key={p.k} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 28px', gap: 10, alignItems: 'center' }}>
                <span style={{ color: 'var(--text-3)', fontSize: 11.5 }}>{p.k}</span>
                <Bar value={p.v} tone={p.v >= 75 ? 'good' : p.v >= 50 ? 'warn' : 'bad'} height={4} />
                <span className="num" style={{ fontWeight: 600, color: 'var(--text-2)', fontSize: 11.5, textAlign: 'right' }}>{p.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <SavingsSparkline />
    </div>
  )
}
