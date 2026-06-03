'use client'

import { useState } from 'react'
import { setBudget } from '@/lib/firestore'
import { useAuth } from '@/context/AuthContext'
import { useAppStore } from '@/store/appStore'
import { useRefreshData } from '@/hooks/useData'
import { EXPENSE_CATEGORIES, formatCurrencyFull, buildMonthlySummary, getBudgetStatus, STATUS_COLORS } from '@/lib/utils'
import type { Category } from '@/types'
import toast from 'react-hot-toast'
import { Check, Edit2 } from 'lucide-react'

export default function BudgetPlanner() {
  const { user } = useAuth()
  const { budgets, transactions, selectedMonth, settings } = useAppStore()
  const refresh = useRefreshData()
  const [editing, setEditing] = useState<Category | null>(null)
  const [inputVal, setInputVal] = useState('')

  const summary = buildMonthlySummary(transactions, selectedMonth, settings)
  const monthBudgets = budgets.filter((b) => b.month === selectedMonth)
  const budgetMap = Object.fromEntries(monthBudgets.map((b) => [b.category, b.planned]))

  async function save(cat: Category) {
    if (!user) return
    try {
      await setBudget(user.uid, selectedMonth, cat, Number(inputVal) || 0)
      await refresh()
      setEditing(null)
      toast.success('Budget saved')
    } catch {
      toast.error('Failed to save')
    }
  }

  const totalPlanned = Object.values(budgetMap).reduce((s, v) => s + v, 0)
  const totalActual = summary.totalExpenses
  const variance = totalPlanned - totalActual

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 4 }}>
        {[
          { label: 'Planned', value: totalPlanned, color: 'var(--text)' },
          { label: 'Actual',  value: totalActual,  color: 'var(--text)' },
          { label: 'Variance', value: Math.abs(variance), color: variance >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)', prefix: variance >= 0 ? '+' : '−' },
        ].map(({ label, value, color, prefix }) => (
          <div key={label} className="card-sm" style={{
            background: label === 'Variance' ? (variance >= 0 ? 'var(--good-soft)' : 'var(--bad-soft)') : 'var(--surface)',
            padding: '10px 12px',
          }}>
            <p style={{ fontSize: 10.5, color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>{label}</p>
            <p className="display-num" style={{ fontSize: 'clamp(12px, 3.5vw, 17px)', color, fontWeight: 600, lineHeight: 1.2 }}>
              {prefix ?? ''}{formatCurrencyFull(value)}
            </p>
          </div>
        ))}
      </div>

      {/* Category rows */}
      {EXPENSE_CATEGORIES.map((cat) => {
        const planned = budgetMap[cat] ?? 0
        const actual = summary.byCategory[cat] ?? 0
        const status = getBudgetStatus(actual, planned)
        const sc = STATUS_COLORS[status]
        const pct = planned > 0 ? Math.min((actual / planned) * 100, 100) : 0

        return (
          <div key={cat} className="card-sm" style={{ padding: '12px 14px' }}>
            {/* Row 1: category name + status pill + edit button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: planned > 0 || actual > 0 ? 8 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cat}
                </span>
                {planned > 0 && (
                  <span className={`pill ${sc.pill}`} style={{ fontSize: 10, padding: '1px 6px', flexShrink: 0 }}>
                    {sc.label}
                  </span>
                )}
              </div>

              {editing === cat ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>₹</span>
                  <input
                    type="number"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && save(cat)}
                    className="input"
                    style={{ width: 80, padding: '4px 8px', fontSize: 13 }}
                    autoFocus
                  />
                  <button
                    onClick={() => save(cat)}
                    style={{ padding: 6, borderRadius: 8, background: 'var(--brand-soft)', color: 'var(--brand-ink)', border: 'none', cursor: 'pointer', display: 'flex' }}
                  >
                    <Check size={13} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditing(cat); setInputVal(String(planned || '')) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-2)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
                >
                  <Edit2 size={11} />
                  {planned > 0 ? formatCurrencyFull(planned) : 'Set budget'}
                </button>
              )}
            </div>

            {/* Progress bar + spent/remaining */}
            {planned > 0 && (
              <>
                <div style={{ width: '100%', background: 'var(--surface-2)', borderRadius: 999, height: 5, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: sc.bar, borderRadius: 999, transition: 'width .4s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', gap: 4 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1 }}>
                    Spent: <span className="num">{formatCurrencyFull(actual)}</span>
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1, textAlign: 'right' }}>
                    Left: <span className="num">{formatCurrencyFull(Math.max(planned - actual, 0))}</span>
                  </span>
                </div>
              </>
            )}

            {planned === 0 && actual > 0 && (
              <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                Spent: <span className="num">{formatCurrencyFull(actual)}</span> · no budget set
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
