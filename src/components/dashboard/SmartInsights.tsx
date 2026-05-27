'use client'

import { useMemo, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, formatCurrency, getLast6Months } from '@/lib/utils'
import {
  TrendingDown, TrendingUp, Zap, Sparkles, ArrowDownRight,
  ShieldCheck, Wallet,
} from 'lucide-react'

interface Alert {
  id: string
  sev: 'bad' | 'warn' | 'info'
  title: string
  detail: string
  cta: string
}

function InsightCard({ a }: { a: Alert }) {
  const accent =
    a.sev === 'bad'  ? 'var(--bad)'  :
    a.sev === 'warn' ? 'var(--warn)' :
    'var(--info)'
  const iconBg =
    a.sev === 'bad'  ? 'var(--bad-soft)'  :
    a.sev === 'warn' ? 'var(--warn-soft)' :
    'var(--info-soft)'
  const Icon =
    a.sev === 'bad'  ? ArrowDownRight :
    a.sev === 'warn' ? Zap :
    Sparkles

  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'center',
      padding: '12px 14px', borderRadius: 12,
      background: 'var(--surface)', border: '1px solid var(--border)',
      transition: 'all .15s',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: iconBg, color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={14} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.35 }}>{a.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.35 }}>{a.detail}</div>
      </div>
      <button className="btn btn-sm btn-ghost" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
        {a.cta} →
      </button>
    </div>
  )
}

export default function SmartInsights() {
  const { transactions, budgets, selectedMonth, emergencyFund } = useAppStore()
  const [showAll, setShowAll] = useState(false)

  const alerts: Alert[] = useMemo(() => {
    const months = getLast6Months()
    const curIdx = months.indexOf(selectedMonth)
    const prevMonth = curIdx > 0 ? months[curIdx - 1] : null
    const cur = buildMonthlySummary(transactions, selectedMonth)
    const prev = prevMonth ? buildMonthlySummary(transactions, prevMonth) : null
    const result: Alert[] = []

    // Deficit
    if (cur.net < 0) {
      result.push({
        id: 'deficit',
        sev: 'bad',
        title: 'Cash deficit this month',
        detail: `Spending exceeds income by ${formatCurrency(Math.abs(cur.net))}`,
        cta: 'Review',
      })
    }

    // Over-budget categories
    const monthBudgets = budgets.filter(b => b.month === selectedMonth)
    for (const b of monthBudgets) {
      const actual = cur.byCategory[b.category as keyof typeof cur.byCategory] ?? 0
      if (actual > b.planned && b.planned > 0) {
        result.push({
          id: `over-${b.category}`,
          sev: 'warn',
          title: `${b.category} over budget`,
          detail: `Exceeded plan by ${formatCurrency(actual - b.planned)}`,
          cta: 'Budget',
        })
      }
    }

    // Emergency fund low
    if (emergencyFund) {
      const pct = (emergencyFund.currentBalance / emergencyFund.targetAmount) * 100
      if (pct < 30) {
        result.push({
          id: 'ef-low',
          sev: 'bad',
          title: 'Emergency fund is low',
          detail: `At ${pct.toFixed(0)}% — consider rebuilding`,
          cta: 'Top up',
        })
      }
    }

    // Savings rate info
    if (cur.totalIncome > 0) {
      const sr = (cur.net / cur.totalIncome) * 100
      const prevSr = prev && prev.totalIncome > 0 ? (prev.net / prev.totalIncome) * 100 : null
      if (sr >= 20) {
        result.push({
          id: 'savings-good',
          sev: 'info',
          title: `Savings rate ${sr.toFixed(1)}%`,
          detail: prevSr !== null ? `${sr > prevSr ? '+' : ''}${(sr - prevSr).toFixed(1)}% vs last month` : 'Strong discipline',
          cta: 'Goals',
        })
      } else if (sr < 10 && sr >= 0) {
        result.push({
          id: 'savings-low',
          sev: 'warn',
          title: `Low savings rate (${sr.toFixed(1)}%)`,
          detail: 'Aim for at least 20% of income',
          cta: 'Plan',
        })
      }
    }

    // Month-over-month spend
    if (prev && prev.totalExpenses > 0) {
      const diff = cur.totalExpenses - prev.totalExpenses
      const pct = (diff / prev.totalExpenses) * 100
      if (pct > 15) {
        result.push({
          id: 'mom-spike',
          sev: 'warn',
          title: `Spending up ${pct.toFixed(0)}% vs last month`,
          detail: `${formatCurrency(diff)} more than previous month`,
          cta: 'Txns',
        })
      } else if (pct < -10) {
        result.push({
          id: 'mom-drop',
          sev: 'info',
          title: `Spending down ${Math.abs(pct).toFixed(0)}% vs last month`,
          detail: `Saved ${formatCurrency(Math.abs(diff))} compared to last month`,
          cta: 'Review',
        })
      }
    }

    return result
  }, [transactions, budgets, selectedMonth, emergencyFund])

  const visible = showAll ? alerts : alerts.slice(0, 4)

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
            background: 'var(--brand-soft)', color: 'var(--brand-ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={14} />
          </span>
          <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', color: 'var(--text)' }}>
            Smart insights
          </div>
          {alerts.filter(a => a.sev === 'bad').length > 0 && (
            <span className="pill bad" style={{ marginLeft: 4 }}>
              {alerts.filter(a => a.sev === 'bad').length} urgent
            </span>
          )}
          {alerts.filter(a => a.sev === 'warn').length > 0 && (
            <span className="pill warn">
              {alerts.filter(a => a.sev === 'warn').length} watch
            </span>
          )}
        </div>
        {alerts.length > 4 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAll(s => !s)}>
            {showAll ? 'Show less ↑' : `Show ${alerts.length - 4} more ↓`}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: 'var(--surface-2)' }}>
          <ShieldCheck size={16} style={{ color: 'var(--good)' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>All clear</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>No issues detected this month</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 10 }}>
          {visible.map((a, i) => <InsightCard key={a.id || i} a={a} />)}
        </div>
      )}
    </div>
  )
}
