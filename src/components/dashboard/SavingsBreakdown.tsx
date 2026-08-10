'use client'

import { useMemo, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import {
  buildMonthlySummary, formatCurrency, formatCurrencyFull, getMonthLabel,
  getTransactionsForMonth, isSavingsTransfer, getTransferDisplay,
} from '@/lib/utils'
import Link from 'next/link'
import { Wallet, ArrowRight, Eye, EyeOff } from 'lucide-react'

const MASK = '₹ •••'

export default function SavingsBreakdown() {
  const transactions  = useAppStore(s => s.transactions)
  const settings       = useAppStore(s => s.settings)
  const borrowings     = useAppStore(s => s.borrowings)
  const selectedMonth  = useAppStore(s => s.selectedMonth)
  const [masked, setMasked] = useState(true)

  const summary = buildMonthlySummary(transactions, selectedMonth, settings, borrowings)
  const netSaved = summary.savingsContributed - summary.savingsWithdrawn
  const rate = summary.totalIncome > 0 ? (netSaved / summary.totalIncome) * 100 : 0
  const fmt = (v: number) => (masked ? MASK : formatCurrency(v))

  const rateColor =
    rate >= 20 ? 'good' :
    rate >= 10 ? 'brand' :
    rate >= 0  ? 'warn'  : 'bad'

  const byVehicle = useMemo(() => {
    const monthTxs = getTransactionsForMonth(transactions, selectedMonth, settings)
    const out: Record<string, number> = {}
    for (const t of monthTxs) {
      if (!isSavingsTransfer(t)) continue
      const { label, dir } = getTransferDisplay(t)
      if (dir !== 'out') continue
      out[label] = (out[label] ?? 0) + t.amount
    }
    return Object.entries(out).sort((a, b) => b[1] - a[1])
  }, [transactions, selectedMonth, settings])

  const maxVehicle = Math.max(...byVehicle.map(([, v]) => v), 1)
  const spentPct = summary.totalIncome > 0
    ? Math.min(100, (summary.totalExpenses / summary.totalIncome) * 100)
    : 0
  const savedPct = summary.totalIncome > 0
    ? Math.min(100 - spentPct, (Math.max(0, netSaved) / summary.totalIncome) * 100)
    : 0

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div className="h-eyebrow">{getMonthLabel(selectedMonth)}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginTop: 2, letterSpacing: '-0.01em' }}>
            What you saved
          </div>
        </div>
        <button
          onClick={() => setMasked(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', display: 'flex', padding: 2, flexShrink: 0 }}
          aria-label={masked ? 'Show amounts' : 'Hide amounts'}
        >
          {masked ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>

      {/* Big number */}
      <div>
        <div className="display-num" style={{
          fontSize: 30, lineHeight: 1,
          color: netSaved >= 0 ? 'var(--text)' : 'var(--bad-ink)',
        }}>
          {masked ? MASK : `${netSaved >= 0 ? '' : '−'}${formatCurrencyFull(Math.abs(netSaved))}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
            background: `var(--${rateColor}-soft)`, color: `var(--${rateColor}-ink)`,
          }}>
            {masked ? '—' : `${rate.toFixed(1)}%`} of income
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            of {fmt(summary.totalIncome)} earned
          </span>
        </div>
        {summary.savingsWithdrawn > 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>
            {fmt(summary.savingsContributed)} contributed, {fmt(summary.savingsWithdrawn)} withdrawn
          </div>
        )}
      </div>

      {/* Spent vs saved bar */}
      <div>
        <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-2)' }}>
          <div style={{ width: `${spentPct}%`, background: 'var(--surface-3)', transition: 'width .5s' }} />
          <div style={{ width: `${savedPct}%`, background: 'var(--good)', transition: 'width .5s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11.5, color: 'var(--text-3)' }}>
          <span>Spent {fmt(summary.totalExpenses)}</span>
          <span>Saved {fmt(Math.max(0, netSaved))}</span>
        </div>
      </div>

      {/* Where it went */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Where it went</div>

        {byVehicle.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 12,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
          }}>
            <Wallet size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>
              No savings transfers logged this cycle.
            </div>
            <Link href="/goals" style={{ flexShrink: 0, color: 'var(--brand)' }}>
              <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          byVehicle.map(([vehicle, amount]) => (
            <div key={vehicle} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{vehicle}</span>
                <span style={{ color: 'var(--text)', fontWeight: 700 }}>{fmt(amount)}</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{
                  width: `${(amount / maxVehicle) * 100}%`, height: '100%',
                  background: 'var(--brand)', borderRadius: 999,
                }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
