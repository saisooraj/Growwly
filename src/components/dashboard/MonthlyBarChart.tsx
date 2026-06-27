'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useAppStore } from '@/store/appStore'
import { getLast6Months, buildMonthlySummary, formatCurrency } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

const GRID   = 'var(--border)'
const TICK   = 'var(--text-3)'
const INCOME = 'var(--good)'
const EXPENSE= 'var(--bad)'

export default function MonthlyBarChart() {
  const transactions = useAppStore((s) => s.transactions)
  const settings     = useAppStore((s) => s.settings)
  const borrowings   = useAppStore((s) => s.borrowings)
  const months = getLast6Months()

  const data = months.map((m) => {
    const s = buildMonthlySummary(transactions, m, settings, borrowings)
    return {
      name: format(parseISO(`${m}-01`), 'MMM'),
      Income: s.totalIncome + s.totalBorrowed,
      Expenses: s.totalExpenses,
    }
  })

  return (
    <div className="card">
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', margin: '0 0 16px' }}>
        Income vs Expenses (6 months)
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="Income"   fill={INCOME}  radius={[6, 6, 0, 0]} maxBarSize={32} />
          <Bar dataKey="Expenses" fill={EXPENSE} radius={[6, 6, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
