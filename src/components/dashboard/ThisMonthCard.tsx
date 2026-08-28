'use client'

import { useMemo, useState, useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, computeCarryForward, formatCurrencyFull, getLast6Months } from '@/lib/utils'
import { useCountUp } from '@/hooks/useCountUp'

const MASK = '₹ •••'

// ── Animated ring ──────────────────────────────────────────────────────────────

function SavingsRing({ pct, size = 72 }: { pct: number; size?: number }) {
  const stroke = 7
  const r      = (size - stroke) / 2
  const circ   = 2 * Math.PI * r
  const target = (Math.max(0, Math.min(100, pct)) / 100) * circ

  const [dash, setDash] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setDash(target), 60)
    return () => clearTimeout(t)
  }, [target])

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0, overflow: 'visible' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--brand)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: 'stroke-dasharray 1s cubic-bezier(.22,1,.36,1)' }}
      />
    </svg>
  )
}

// ── Card ───────────────────────────────────────────────────────────────────────

export default function ThisMonthCard() {
  const { transactions, selectedMonth, settings, borrowings } = useAppStore()
  const [shown, setShown] = useState(false)

  const summary = useMemo(
    () => buildMonthlySummary(transactions, selectedMonth, settings, borrowings),
    [transactions, selectedMonth, settings, borrowings],
  )

  const carryForward = useMemo(() => {
    const months = getLast6Months()
    const curIdx = months.indexOf(selectedMonth)
    if (curIdx <= 0) return 0
    return computeCarryForward(months.slice(0, curIdx), transactions, settings, borrowings)
  }, [transactions, selectedMonth, settings, borrowings])

  const totalIn     = summary.totalIncome + carryForward
  const netSaved    = summary.cashNet + carryForward
  const totalOut    = totalIn - netSaved
  const isPositive  = netSaved >= 0
  const savingsRate = totalIn > 0
    ? Math.max(0, Math.min(100, (netSaved / totalIn) * 100))
    : 0

  const animatedNet  = useCountUp(Math.abs(netSaved), 950)
  const animatedRate = useCountUp(Math.round(savingsRate), 800)
  const animatedIn   = useCountUp(totalIn, 950)
  const animatedOut  = useCountUp(Math.abs(totalOut), 950)

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="h-eyebrow">This month</span>
        <button
          onClick={() => setShown(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', display: 'flex', padding: 2 }}
        >
          {shown ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>

      {/* Net saved + ring */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 'clamp(20px, 3.5vw, 28px)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            color: isPositive ? 'var(--good-ink)' : 'var(--bad-ink)',
          }}>
            {shown ? `${isPositive ? '+' : '−'}${formatCurrencyFull(animatedNet)}` : MASK}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 5 }}>surplus</div>
        </div>

        {/* Donut ring */}
        <div style={{ position: 'relative', flexShrink: 0, width: 72, height: 72 }}>
          <SavingsRing pct={savingsRate} size={72} />
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: 'var(--text)',
          }}>
            {shown ? `${animatedRate}%` : '—'}
          </div>
        </div>
      </div>

      {/* In / Out rows */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 7,
        paddingTop: 10, borderTop: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-2)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--good)', flexShrink: 0, display: 'inline-block' }} />
            In
          </span>
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>
            {shown ? formatCurrencyFull(animatedIn) : MASK}
          </span>
        </div>
        {shown && carryForward > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, paddingLeft: 14 }}>
            <span style={{ color: 'var(--text-4)' }}>↩ carried forward</span>
            <span style={{ fontWeight: 600, color: 'var(--brand-ink)' }}>+{formatCurrencyFull(carryForward)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-2)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--surface-3)', flexShrink: 0, display: 'inline-block' }} />
            Out
          </span>
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>
            {shown ? formatCurrencyFull(animatedOut) : MASK}
          </span>
        </div>
        {shown && summary.savingsContributed > 0 && (<>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, paddingLeft: 14 }}>
            <span style={{ color: 'var(--text-4)' }}>spent</span>
            <span style={{ fontWeight: 600, color: 'var(--text-3)' }}>{formatCurrencyFull(summary.totalExpenses)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, paddingLeft: 14 }}>
            <span style={{ color: 'var(--text-4)' }}>
              → savings
              {summary.savingsWithdrawn > 0 && (
                <span style={{ marginLeft: 4 }}>
                  ({formatCurrencyFull(summary.savingsContributed)} in − {formatCurrencyFull(summary.savingsWithdrawn)} out)
                </span>
              )}
            </span>
            <span style={{ fontWeight: 600, color: 'var(--brand-ink)' }}>{formatCurrencyFull(summary.savingsContributed - summary.savingsWithdrawn)}</span>
          </div>
        </>)}
      </div>
    </div>
  )
}
