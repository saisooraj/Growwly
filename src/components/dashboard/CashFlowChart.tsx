'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useAppStore } from '@/store/appStore'
import { getLast6Months, buildMonthlySummary, formatCurrency } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

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
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Cash Flow (Inflow vs Outflow)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCurrency(v)} />
          <Tooltip
            formatter={(v: number) => formatCurrency(v)}
            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: 13 }}
          />
          <Area type="monotone" dataKey="Inflow" stroke="#22c55e" strokeWidth={2} fill="url(#inflowGrad)" />
          <Area type="monotone" dataKey="Outflow" stroke="#f43f5e" strokeWidth={2} fill="url(#outflowGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
