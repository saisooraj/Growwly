'use client'

import { useState, useMemo } from 'react'
import { Pencil, X, Check, ChevronDown, Tags } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import { buildMonthlySummary, formatCurrencyFull, EXPENSE_CATEGORIES } from '@/lib/utils'
import { CategoryIcon, getCategoryDisplayName } from '@/lib/categoryIcons'
import { setUserSettings } from '@/lib/firestore'
import toast from 'react-hot-toast'

// ── Defaults ───────────────────────────────────────────────────────────────────

const DEFAULT_RULE = { needs: 50, wants: 30, savings: 20 }

const DEFAULT_NEEDS = [
  'Food & Dining', 'Groceries', 'Transport', 'Fuel', 'Healthcare',
  'Utilities', 'Insurance', 'Rent / Deposit', 'Living Expenses',
  'Home & Maintenance', 'Education', 'Family',
]
const DEFAULT_SAVINGS = [
  'Gold', 'Construction',
]

// Pseudo-category representing real savings transactions (contributions to
// vehicles) so they land in the Savings bucket of the 50/30/20 rule.
const SAVINGS_TXN_LABEL = 'Savings & Investments'

type Bucket = 'needs' | 'wants' | 'savings'

const BUCKET_META: Record<Bucket, { label: string; color: string; ink: string; soft: string }> = {
  needs:   { label: 'Needs',    color: 'var(--info)',  ink: 'var(--info-ink)',  soft: 'var(--info-soft)' },
  wants:   { label: 'Wants',    color: 'var(--warn)',  ink: 'var(--warn-ink)',  soft: 'var(--warn-soft)' },
  savings: { label: 'Savings',  color: 'var(--good)',  ink: 'var(--good-ink)',  soft: 'var(--good-soft)' },
}

// ── Helpers ────────────────────────────────────────────────────────────────────


// ── Sub-components ─────────────────────────────────────────────────────────────

function BucketRow({
  bucket, pct, target, amount, items, totalIncome, expanded, onToggle,
}: {
  bucket: Bucket; pct: number; target: number; amount: number
  items: { cat: string; amt: number }[]; totalIncome: number
  expanded: boolean; onToggle: () => void
}) {
  const meta = BUCKET_META[bucket]
  const diff = pct - target
  const status = Math.abs(diff) <= 3 ? 'on-track' : diff > 3 ? 'over' : 'under'
  const statusColor = status === 'on-track' ? 'var(--good-ink)' : status === 'over' ? 'var(--bad-ink)' : 'var(--warn-ink)'
  const statusLabel = status === 'on-track' ? 'On track' : status === 'over' ? `+${diff.toFixed(0)}% over` : `${Math.abs(diff).toFixed(0)}% under`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header row — clickable to expand */}
      <button
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', textAlign: 'left', width: '100%' }}
      >
        <div style={{ width: 8, height: 8, borderRadius: 2, background: meta.color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1 }}>{meta.label}</span>
        <span style={{ fontSize: 11, color: 'var(--text-4)' }}>target {target}%</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginLeft: 8 }}>{pct.toFixed(1)}%</span>
        <span style={{ fontSize: 11, color: statusColor, fontWeight: 500, marginLeft: 6, minWidth: 70, textAlign: 'right' }}>{statusLabel}</span>
        <ChevronDown size={13} style={{ color: 'var(--text-4)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0, marginLeft: 4 }} />
      </button>

      {/* Progress bar */}
      <div style={{ position: 'relative', height: 6, background: 'var(--surface-2)', borderRadius: 999, overflow: 'visible', marginBottom: 2 }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: meta.color, borderRadius: 999, transition: 'width .4s ease' }} />
        <div style={{ position: 'absolute', top: -3, bottom: -3, width: 2, left: `${Math.min(target, 99)}%`, background: 'var(--text-3)', borderRadius: 999, transform: 'translateX(-50%)' }} />
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 0' }}>{formatCurrencyFull(amount)}</p>

      {/* Expanded category breakdown */}
      {expanded && (
        <div style={{ marginTop: 10, borderRadius: 10, background: 'var(--surface-2)', overflow: 'hidden' }}>
          {items.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-4)', padding: '10px 14px', margin: 0 }}>No spending in this bucket this month.</p>
          ) : (
            items.sort((a, b) => b.amt - a.amt).map(({ cat, amt }) => {
              const barPct = totalIncome > 0 ? Math.min((amt / totalIncome) * 100, 100) : 0
              return (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ flexShrink: 0, color: 'var(--text-3)' }}><CategoryIcon category={cat} size={14} /></span>
                  <span style={{ fontSize: 12, color: 'var(--text-2)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getCategoryDisplayName(cat)}</span>
                  <div style={{ width: 60, height: 4, background: 'var(--surface-3)', borderRadius: 999, flexShrink: 0 }}>
                    <div style={{ height: '100%', width: `${barPct}%`, background: meta.color, borderRadius: 999 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', minWidth: 60, textAlign: 'right' }}>{formatCurrencyFull(amt)}</span>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SpendingRuleCard() {
  const { user } = useAuth()
  const { transactions, selectedMonth, settings } = useAppStore()

  const refresh = useRefreshData()
  const rule = settings?.spendingRule ?? DEFAULT_RULE
  const needsCats   = settings?.categoryBuckets?.needs   ?? DEFAULT_NEEDS
  const savingsCats = settings?.categoryBuckets?.savings ?? DEFAULT_SAVINGS

  const [editingRule, setEditingRule]         = useState(false)
  const [editingCats, setEditingCats]         = useState(false)
  const [expandedBucket, setExpandedBucket]   = useState<Bucket | null>(null)
  const [ruleDraft, setRuleDraft]             = useState(rule)
  const [bucketDraft, setBucketDraft]         = useState<{ needs: Set<string>; savings: Set<string> }>({
    needs: new Set(needsCats), savings: new Set(savingsCats),
  })
  const [saving, setSaving] = useState(false)

  const ruleTotal = ruleDraft.needs + ruleDraft.wants + ruleDraft.savings
  const ruleValid = ruleTotal === 100

  // All expense categories including custom ones
  const customCats = settings?.customCategories ?? []
  const allExpCats = [
    ...EXPENSE_CATEGORIES.filter(c => c !== 'Other'),
    ...customCats.filter(c => !EXPENSE_CATEGORIES.includes(c)),
  ]

  function getBucket(cat: string, n: Set<string>, s: Set<string>): Bucket {
    if (n.has(cat)) return 'needs'
    if (s.has(cat)) return 'savings'
    return 'wants'
  }

  function assignBucket(cat: string, bucket: Bucket) {
    setBucketDraft(prev => {
      const needs   = new Set(prev.needs)
      const savings = new Set(prev.savings)
      needs.delete(cat); savings.delete(cat)
      if (bucket === 'needs')   needs.add(cat)
      if (bucket === 'savings') savings.add(cat)
      return { needs, savings }
    })
  }

  const { byBucket, byCategory, totalIncome } = useMemo(() => {
    const summary = buildMonthlySummary(transactions, selectedMonth, settings)
    const income = summary.totalIncome || 1
    const needsSet   = new Set(needsCats)
    const savingsSet = new Set(savingsCats)

    const byBucket = { needs: 0, wants: 0, savings: 0 }
    const byCategory: Record<string, { amt: number; bucket: Bucket }> = {}

    for (const [cat, amt] of Object.entries(summary.byCategory)) {
      const b: Bucket = needsSet.has(cat) ? 'needs' : savingsSet.has(cat) ? 'savings' : 'wants'
      byBucket[b] += amt
      byCategory[cat] = { amt, bucket: b }
    }

    // Real savings movements (contributions to vehicles) count toward the
    // Savings bucket — they're not expense categories anymore.
    if (summary.savingsContributed > 0) {
      byBucket.savings += summary.savingsContributed
      byCategory[SAVINGS_TXN_LABEL] = { amt: summary.savingsContributed, bucket: 'savings' }
    }

    return { byBucket, byCategory, totalIncome: income }
  }, [transactions, selectedMonth, settings, needsCats, savingsCats])

  const needsPct   = (byBucket.needs   / totalIncome) * 100
  const wantsPct   = (byBucket.wants   / totalIncome) * 100
  const savingsPct = (byBucket.savings / totalIncome) * 100

  function itemsForBucket(b: Bucket) {
    return Object.entries(byCategory)
      .filter(([, v]) => v.bucket === b)
      .map(([cat, v]) => ({ cat, amt: v.amt }))
  }

  async function saveRule() {
    if (!ruleValid || !user) return
    setSaving(true)
    try {
      await setUserSettings(user.uid, { spendingRule: ruleDraft })
      await refresh()
      toast.success('Rule updated')
      setEditingRule(false)
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  async function saveBuckets() {
    if (!user) return
    setSaving(true)
    try {
      await setUserSettings(user.uid, {
        categoryBuckets: {
          needs:   Array.from(bucketDraft.needs),
          savings: Array.from(bucketDraft.savings),
        },
      })
      await refresh()
      toast.success('Category buckets saved')
      setEditingCats(false)
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  function openCatEdit() {
    setBucketDraft({ needs: new Set(needsCats), savings: new Set(savingsCats) })
    setEditingCats(true)
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>
            {rule.needs}/{rule.wants}/{rule.savings} Rule
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            Needs ≤ {rule.needs}% · Wants ≤ {rule.wants}% · Savings ≥ {rule.savings}%
          </p>
        </div>
        {!editingRule && !editingCats && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={openCatEdit} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <Tags size={12} /> Categories
            </button>
            <button onClick={() => { setRuleDraft(rule); setEditingRule(true) }} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <Pencil size={12} /> Targets
            </button>
          </div>
        )}
      </div>

      {/* Targets edit */}
      {editingRule && (
        <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', margin: 0 }}>Target percentages — must add up to 100%</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {(['needs', 'wants', 'savings'] as const).map(key => (
              <div key={key}>
                <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4, textTransform: 'capitalize' }}>{key} %</label>
                <input type="number" min={0} max={100} value={ruleDraft[key]}
                  onChange={e => setRuleDraft(d => ({ ...d, [key]: Number(e.target.value) }))}
                  className="input" style={{ textAlign: 'center', fontWeight: 600, fontSize: 16 }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: ruleValid ? 'var(--good-ink)' : 'var(--bad-ink)' }}>
              Total: {ruleTotal}% {ruleValid ? '✓' : `(${100 - ruleTotal > 0 ? '+' : ''}${100 - ruleTotal} to go)`}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditingRule(false)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-2)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <X size={12} /> Cancel
              </button>
              <button onClick={saveRule} disabled={!ruleValid || saving}
                style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: ruleValid ? 'var(--brand)' : 'var(--surface-3)', cursor: ruleValid ? 'pointer' : 'not-allowed', color: ruleValid ? 'white' : 'var(--text-4)', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Check size={12} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category bucket editor */}
      {editingCats && (
        <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', margin: 0 }}>Assign each category to a bucket</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 340, overflowY: 'auto' }}>
            {allExpCats.map(cat => {
              const current = getBucket(cat, bucketDraft.needs, bucketDraft.savings)
              return (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 8, background: 'var(--surface)' }}>
                  <span style={{ flexShrink: 0, color: 'var(--text-3)' }}><CategoryIcon category={cat} size={14} /></span>
                  <span style={{ fontSize: 12, color: 'var(--text-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getCategoryDisplayName(cat)}</span>
                  <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
                    {(['needs', 'wants', 'savings'] as Bucket[]).map(b => {
                      const meta = BUCKET_META[b]
                      const active = current === b
                      return (
                        <button key={b} onClick={() => assignBucket(cat, b)}
                          style={{ padding: '3px 8px', fontSize: 11, fontWeight: active ? 600 : 400, border: 'none', cursor: 'pointer', background: active ? meta.color : 'transparent', color: active ? '#fff' : 'var(--text-3)', transition: 'all .12s' }}>
                          {meta.label[0]}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditingCats(false)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-2)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <X size={12} /> Cancel
            </button>
            <button onClick={saveBuckets} disabled={saving}
              style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--brand)', cursor: 'pointer', color: 'white', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Check size={12} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Stacked bar */}
      <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', gap: 2 }}>
        <div style={{ flex: needsPct,   background: 'var(--info)',      minWidth: needsPct   > 0 ? 4 : 0 }} />
        <div style={{ flex: wantsPct,   background: 'var(--warn)',      minWidth: wantsPct   > 0 ? 4 : 0 }} />
        <div style={{ flex: savingsPct, background: 'var(--good)',      minWidth: savingsPct > 0 ? 4 : 0 }} />
        <div style={{ flex: Math.max(0, 100 - needsPct - wantsPct - savingsPct), background: 'var(--surface-2)' }} />
      </div>

      {/* Bucket rows with expand */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {(['needs', 'wants', 'savings'] as Bucket[]).map(b => (
          <BucketRow
            key={b}
            bucket={b}
            pct={b === 'needs' ? needsPct : b === 'wants' ? wantsPct : savingsPct}
            target={rule[b]}
            amount={byBucket[b]}
            items={itemsForBucket(b)}
            totalIncome={totalIncome}
            expanded={expandedBucket === b}
            onToggle={() => setExpandedBucket(prev => prev === b ? null : b)}
          />
        ))}
      </div>
    </div>
  )
}
