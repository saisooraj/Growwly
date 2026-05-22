'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, formatCurrency, CATEGORY_COLORS } from '@/lib/utils'

export default function CategoryPieChart() {
  const { transactions, selectedMonth } = useAppStore()
  const summary = buildMonthlySummary(transactions, selectedMonth)

  const data = Object.entries(summary.byCategory)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, val]) => ({
      name: cat,
      value: val,
      color: CATEGORY_COLORS[cat] ?? '#94a3b8',
    }))

  if (data.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center h-[280px]">
        <p className="text-slate-400 text-sm">No expense data for this month</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Expense Breakdown</h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number) => formatCurrency(v)}
            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: 13 }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
