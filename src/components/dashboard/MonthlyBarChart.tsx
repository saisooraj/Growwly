'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useAppStore } from '@/store/appStore'
import { getLast6Months, buildMonthlySummary, formatCurrency } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

export default function MonthlyBarChart() {
  const transactions = useAppStore((s) => s.transactions)
  const borrowings   = useAppStore((s) => s.borrowings)
  const months = getLast6Months()

  const data = months.map((m) => {
    const s = buildMonthlySummary(transactions, m, null, borrowings)
    return {
      name: format(parseISO(`${m}-01`), 'MMM'),
      Income: s.totalIncome + s.totalBorrowed,
      Expenses: s.totalExpenses,
    }
  })

  const formatter = (v: number) => formatCurrency(v)

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Income vs Expenses (6 months)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={formatter} />
          <Tooltip
            formatter={(v: number) => formatCurrency(v)}
            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: 13 }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          <Bar dataKey="Income" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={32} />
          <Bar dataKey="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
