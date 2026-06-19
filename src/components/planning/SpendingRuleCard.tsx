'use client'

import { useState, useMemo } from 'react'
import { Pencil, X, Check } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { buildMonthlySummary, formatCurrencyFull } from '@/lib/utils'
import { setUserSettings } from '@/lib/firestore'
import toast from 'react-hot-toast'

const NEEDS_CATS = new Set([
  'Food & Dining', 'Groceries', 'Transport', 'Fuel', 'Healthcare',
  'Utilities', 'Insurance', 'Rent / Deposit', 'Living Expenses',
  'Home & Maintenance', 'Education', 'Family',
])

const SAVINGS_CATS = new Set([
  'SIP / Investments', 'Emergency Fund', 'Gold', 'Construction',
])

const DEFAULTS = { needs: 50, wants: 30, savings: 20 }

function Segment({ label, pct, target, amount, color }: {
  label: string; pct: number; target: number; amount: number; color: string
}) {
  const diff = pct - target
  const status = Math.abs(diff) <= 3 ? 'on-track' : diff > 3 ? 'over' : 'under'
  const statusColor = status === 'on-track' ? 'var(--good-ink)' : status === 'over' ? 'var(--bad-ink)' : 'var(--warn-ink)'
  const statusLabel = status === 'on-track' ? 'On track' : status === 'over' ? `+${diff.toFixed(0)}% over` : `${Math.abs(diff).toFixed(0)}% under`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
          <span style={{ fontSize: 11, color: 'var(--text-4)', marginLeft: 6 }}>target {target}%</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{pct.toFixed(1)}%</span>
          <span style={{ fontSize: 11, marginLeft: 8, color: statusColor, fontWeight: 500 }}>{statusLabel}</span>
        </div>
      </div>
      <div style={{ position: 'relative', height: 8, background: 'var(--surface-2)', borderRadius: 999, overflow: 'visible' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 999, transition: 'width .4s ease' }} />
        <div style={{
          position: 'absolute', top: -3, bottom: -3, width: 2,
          left: `${Math.min(target, 99)}%`, background: 'var(--text-3)',
          borderRadius: 999, transform: 'translateX(-50%)',
        }} />
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{formatCurrencyFull(amount)} of income</p>
    </div>
  )
}

export default function SpendingRuleCard() {
  const { user } = useAuth()
  const { transactions, selectedMonth, settings } = useAppStore()

  const rule = settings?.spendingRule ?? DEFAULTS
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ needs: rule.needs, wants: rule.wants, savings: rule.savings })
  const [saving, setSaving] = useState(false)

  const total = draft.needs + draft.wants + draft.savings
  const valid = total === 100

  function openEdit() {
    setDraft({ needs: rule.needs, wants: rule.wants, savings: rule.savings })
    setEditing(true)
  }

  async function handleSave() {
    if (!valid || !user) return
    setSaving(true)
    try {
      await setUserSettings(user.uid, { spendingRule: draft })
      toast.success('Spending rule updated')
      setEditing(false)
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const { needsPct, wantsPct, savingsPct, needsAmt, wantsAmt, savingsAmt } = useMemo(() => {
    const summary = buildMonthlySummary(transactions, selectedMonth, settings)
    const income = summary.totalIncome || 1

    let needs = 0, savings = 0, wants = 0
    for (const [cat, amt] of Object.entries(summary.byCategory)) {
      if (NEEDS_CATS.has(cat)) needs += amt
      else if (SAVINGS_CATS.has(cat)) savings += amt
      else wants += amt
    }

    return {
      needsPct: (needs / income) * 100,
      wantsPct: (wants / income) * 100,
      savingsPct: (savings / income) * 100,
      needsAmt: needs,
      wantsAmt: wants,
      savingsAmt: savings,
    }
  }, [transactions, selectedMonth, settings])

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>
            {rule.needs}/{rule.wants}/{rule.savings} Rule
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            Needs ≤ {rule.needs}% · Wants ≤ {rule.wants}% · Savings ≥ {rule.savings}% of income
          </p>
        </div>
        {!editing && (
          <button
            onClick={openEdit}
            style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, flexShrink: 0 }}
          >
            <Pencil size={12} /> Edit
          </button>
        )}
      </div>

      {/* Inline edit form */}
      {editing && (
        <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', margin: 0 }}>Set your target percentages (must add up to 100%)</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {(['needs', 'wants', 'savings'] as const).map((key) => (
              <div key={key}>
                <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4, textTransform: 'capitalize' }}>{key} %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft[key]}
                  onChange={e => setDraft(d => ({ ...d, [key]: Number(e.target.value) }))}
                  className="input"
                  style={{ textAlign: 'center', fontWeight: 600, fontSize: 16 }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: valid ? 'var(--good-ink)' : 'var(--bad-ink)' }}>
              Total: {total}% {valid ? '✓' : `(need ${100 - total > 0 ? '+' : ''}${100 - total} more)`}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditing(false)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-2)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <X size={12} /> Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!valid || saving}
                style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: valid ? 'var(--brand)' : 'var(--surface-3)', cursor: valid ? 'pointer' : 'not-allowed', color: valid ? 'white' : 'var(--text-4)', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Check size={12} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visual stacked bar */}
      <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', gap: 2 }}>
        <div style={{ flex: needsPct, background: 'var(--info)', minWidth: needsPct > 0 ? 4 : 0 }} />
        <div style={{ flex: wantsPct, background: 'var(--warn)', minWidth: wantsPct > 0 ? 4 : 0 }} />
        <div style={{ flex: savingsPct, background: 'var(--good)', minWidth: savingsPct > 0 ? 4 : 0 }} />
        <div style={{ flex: Math.max(0, 100 - needsPct - wantsPct - savingsPct), background: 'var(--surface-2)' }} />
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 11, marginTop: -8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--info-ink)' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--info)', display: 'inline-block' }} />Needs</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--warn-ink)' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--warn)', display: 'inline-block' }} />Wants</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--good-ink)' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--good)', display: 'inline-block' }} />Savings</span>
      </div>

      {/* Segments */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Segment label="Needs" pct={needsPct} target={rule.needs} amount={needsAmt} color="var(--info)" />
        <Segment label="Wants" pct={wantsPct} target={rule.wants} amount={wantsAmt} color="var(--warn)" />
        <Segment label="Savings & Investments" pct={savingsPct} target={rule.savings} amount={savingsAmt} color="var(--good)" />
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0, lineHeight: 1.5 }}>
        Needs = rent, food, transport, healthcare, utilities, insurance, education. Savings = SIP, gold, emergency fund. Everything else = Wants.
      </p>
    </div>
  )
}
