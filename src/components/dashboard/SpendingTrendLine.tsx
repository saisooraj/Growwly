'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useAppStore } from '@/store/appStore'
import { getLast6Months, buildMonthlySummary, formatCurrency } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

const GRID    = 'var(--border)'
const TICK    = 'var(--text-3)'
const SPEND   = 'var(--bad)'
const NET     = 'var(--good)'
const AVG     = 'var(--text-4)'

export default function SpendingTrendLine() {
  const transactions = useAppStore((s) => s.transactions)
  const months = getLast6Months()

  const data = months.map((m) => {
    const s = buildMonthlySummary(transactions, m)
    return {
      name: format(parseISO(`${m}-01`), 'MMM'),
      Spending: s.totalExpenses,
      Net: s.net,
    }
  })

  const avgSpending = data.reduce((s, d) => s + d.Spending, 0) / (data.length || 1)

  return (
    <div className="card">
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', margin: '0 0 16px' }}>
        Spending Trend
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
          <ReferenceLine y={avgSpending} stroke={AVG} strokeDasharray="4 4" label={{ value: 'Avg', fontSize: 11, fill: AVG }} />
          <Line type="monotone" dataKey="Spending" stroke={SPEND} strokeWidth={2} dot={{ r: 4, fill: SPEND }} />
          <Line type="monotone" dataKey="Net"      stroke={NET}   strokeWidth={2} dot={{ r: 4, fill: NET   }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
