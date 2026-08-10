'use client'

import { useMemo, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { useAppStore } from '@/store/appStore'
import { getLast6Months, buildMonthlySummary, formatCurrency, formatCurrencyFull } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { PiggyBank, TrendingUp, Award, Eye, EyeOff } from 'lucide-react'

const GOOD  = 'var(--good)'
const BAD   = 'var(--bad)'
const BRAND = 'var(--brand)'
const MASK  = '₹ •••'

interface Point {
  month: string
  label: string
  saved: number
  cumulative: number
  contributed: number
  withdrawn: number
  income: number
}

function ChartTooltip({ active, payload, masked }: { active?: boolean; payload?: { payload: Point }[]; masked: boolean }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  if (masked) {
    return (
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '10px 12px', boxShadow: 'var(--elev)', fontSize: 12.5,
      }}>
        <div style={{ fontWeight: 700, color: 'var(--text)' }}>{d.label}</div>
        <div style={{ color: 'var(--text-3)', marginTop: 4 }}>{MASK}</div>
      </div>
    )
  }
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
      padding: '10px 12px', boxShadow: 'var(--elev)', fontSize: 12.5, minWidth: 170,
    }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{d.label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: 'var(--text-3)' }}>
        <span>Contributed</span><span style={{ fontWeight: 600, color: 'var(--text)' }}>{formatCurrency(d.contributed)}</span>
      </div>
      {d.withdrawn > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: 'var(--text-3)' }}>
          <span>Withdrawn</span><span style={{ fontWeight: 600, color: 'var(--text)' }}>{formatCurrency(d.withdrawn)}</span>
        </div>
      )}
      <div style={{
        display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 6, paddingTop: 6,
        borderTop: '1px dashed var(--border)',
      }}>
        <span style={{ color: 'var(--text-3)' }}>Net saved</span>
        <span style={{ fontWeight: 700, color: d.saved >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)' }}>
          {d.saved >= 0 ? '+' : ''}{formatCurrency(d.saved)}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: 'var(--text-3)' }}>
        <span>Running total</span><span style={{ fontWeight: 600, color: 'var(--text)' }}>{formatCurrency(d.cumulative)}</span>
      </div>
    </div>
  )
}

export default function SavingsTrendChart() {
  const transactions = useAppStore(s => s.transactions)
  const settings      = useAppStore(s => s.settings)
  const borrowings    = useAppStore(s => s.borrowings)
  const [masked, setMasked] = useState(true)

  const data: Point[] = useMemo(() => {
    let cumulative = 0
    return getLast6Months().map(m => {
      const s = buildMonthlySummary(transactions, m, settings, borrowings)
      const saved = s.savingsContributed - s.savingsWithdrawn
      cumulative += saved
      return {
        month: m,
        label: format(parseISO(`${m}-01`), 'MMM'),
        saved,
        cumulative,
        contributed: s.savingsContributed,
        withdrawn: s.savingsWithdrawn,
        income: s.totalIncome,
      }
    })
  }, [transactions, settings, borrowings])

  const totalSaved  = data.reduce((sum, d) => sum + d.saved, 0)
  const totalIncome = data.reduce((sum, d) => sum + d.income, 0)
  const avgRate      = totalIncome > 0 ? (totalSaved / totalIncome) * 100 : 0
  const best          = data.reduce((a, b) => (b.saved > a.saved ? b : a), data[0])

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            Savings trend
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>
            Money moved into savings, per month
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: totalSaved >= 0 ? 'var(--good-soft)' : 'var(--bad-soft)',
            color:      totalSaved >= 0 ? 'var(--good-ink)'  : 'var(--bad-ink)',
            whiteSpace: 'nowrap',
          }}>
            {masked ? MASK : `${totalSaved >= 0 ? '+' : ''}${formatCurrency(totalSaved)}`} total
          </span>
          <button
            onClick={() => setMasked(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', display: 'flex', padding: 2, flexShrink: 0 }}
            aria-label={masked ? 'Show amounts' : 'Hide amounts'}
          >
            {masked ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false}
            tickFormatter={(v: number) => (masked ? '•••' : formatCurrency(v))}
          />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Tooltip content={<ChartTooltip masked={masked} />} cursor={{ fill: 'var(--surface-2)' }} />
          <Bar dataKey="saved" radius={[5, 5, 5, 5]} maxBarSize={34}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.saved >= 0 ? GOOD : BAD} fillOpacity={0.82} />
            ))}
          </Bar>
          <Line type="monotone" dataKey="cumulative" stroke={BRAND} strokeWidth={2} dot={{ r: 3, fill: BRAND, strokeWidth: 0 }} activeDot={{ r: 5 }} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginTop: -8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: GOOD, display: 'inline-block' }} />
          Saved this month
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)' }}>
          <span style={{ width: 10, height: 2, borderRadius: 2, background: BRAND, display: 'inline-block' }} />
          Running total
        </span>
      </div>

      {/* Stat row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
        paddingTop: 12, borderTop: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-3)', fontSize: 11.5 }}>
            <PiggyBank size={13} /> Total saved
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: totalSaved >= 0 ? 'var(--text)' : 'var(--bad-ink)' }}>
            {masked ? MASK : formatCurrencyFull(totalSaved)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-3)', fontSize: 11.5 }}>
            <TrendingUp size={13} /> Avg savings rate
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
            {masked ? '—' : `${avgRate.toFixed(1)}%`}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-3)', fontSize: 11.5 }}>
            <Award size={13} /> Best month
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
            {best.label} · {masked ? MASK : formatCurrency(best.saved)}
          </div>
        </div>
      </div>
    </div>
  )
}
