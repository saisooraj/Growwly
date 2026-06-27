'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useAppStore } from '@/store/appStore'
import { getLast6Months, buildMonthlySummary, formatCurrency } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

const GRID    = 'var(--border)'
const TICK    = 'var(--text-3)'
const INFLOW  = 'var(--good)'
const OUTFLOW = 'var(--bad)'

export default function CashFlowChart() {
  const transactions = useAppStore((s) => s.transactions)
  const months = getLast6Months()

  const data = months.map((m) => {
    const s = buildMonthlySummary(transactions, m)
    return {
      name: format(parseISO(`${m}-01`), 'MMM'),
      Inflow: s.totalIncome,
      Outflow: s.totalExpenses,
    }
  })

  return (
    <div className="card">
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', margin: '0 0 16px' }}>
        Cash Flow (Inflow vs Outflow)
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={INFLOW}  stopOpacity={0.28} />
              <stop offset="95%" stopColor={INFLOW}  stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={OUTFLOW} stopOpacity={0.28} />
              <stop offset="95%" stopColor={OUTFLOW} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: TICK }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: TICK }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCurrency(v)} />
          <Tooltip
            formatter={(v: number) => formatCurrency(v)}
            contentStyle={{
              borderRadius: 14, border: '1px solid var(--border)',
              background: 'var(--surface)', fontSize: 13, color: 'var(--text)',
              boxShadow: 'var(--elev)',
            }}
          />
          <Area type="monotone" dataKey="Inflow"  stroke={INFLOW}  strokeWidth={2} fill="url(#inflowGrad)"  />
          <Area type="monotone" dataKey="Outflow" stroke={OUTFLOW} strokeWidth={2} fill="url(#outflowGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
