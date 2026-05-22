'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { useAppStore } from '@/store/appStore'
import { getLast6Months, buildMonthlySummary, formatCurrency } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

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
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Spending Trend</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCurrency(v)} />
          <Tooltip
            formatter={(v: number) => formatCurrency(v)}
            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: 13 }}
          />
          <ReferenceLine y={avgSpending} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Avg', fontSize: 11, fill: '#94a3b8' }} />
          <Line type="monotone" dataKey="Spending" stroke="#f43f5e" strokeWidth={2} dot={{ r: 4, fill: '#f43f5e' }} />
          <Line type="monotone" dataKey="Net" stroke="#22c55e" strokeWidth={2} dot={{ r: 4, fill: '#22c55e' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
