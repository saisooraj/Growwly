'use client'

import { useState, useMemo } from 'react'
import { Pencil, X, Check, ChevronDown, Tags, Home, Sparkles, Leaf, Eye, EyeOff } from 'lucide-react'
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

const MASK = '₹ ••••'

function BucketRow({
  bucket, pct, target, amount, items, totalIncome, expanded, onToggle, masked,
}: {
  bucket: Bucket; pct: number; target: number; amount: number
  items: { cat: string; amt: number }[]; totalIncome: number
  expanded: boolean; onToggle: () => void; masked: boolean
}) {
  const meta = BUCKET_META[bucket]
  const diff = pct - target
  const status = Math.abs(diff) <= 3 ? 'on-track' : diff > 3 ? 'over' : 'under'
  const statusColor = status === 'on-track' ? 'var(--good-ink)' : status === 'over' ? 'var(--bad-ink)' : 'var(--warn-ink)'
  const statusLabel = status === 'on-track' ? 'On track' : status === 'over' ? `+${diff.toFixed(0)}% over` : `${Math.abs(diff).toFixed(0)}% under`

  const BucketIcon = bucket === 'needs' ? Home : bucket === 'wants' ? Sparkles : Leaf

  return (
    <div style={{
      borderRadius: 16, background: 'var(--surface-2)',
      overflow: 'hidden', border: '1px solid var(--border)',
    }}>
      {/* Header row */}
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '14px 16px', textAlign: 'left', width: '100%',
          fontFamily: 'inherit',
        }}
      >
        <div style={{
          width: 42, height: 42, borderRadius: 13, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `color-mix(in oklch, ${meta.color} 16%, var(--surface))`,
        }}>
          <BucketIcon size={20} style={{ color: meta.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>{meta.label}</span>
            <span style={{
              fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
              background: status === 'on-track' ? 'var(--good-soft)' : status === 'over' ? 'var(--bad-soft)' : 'var(--warn-soft)',
              color: statusColor,
            }}>{statusLabel}</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>
            {masked ? MASK : formatCurrencyFull(amount)}{' '}
            <span style={{ color: 'var(--text-4)' }}>of {masked ? MASK : formatCurrencyFull(Math.round(target / 100 * totalIncome))} target</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>{pct.toFixed(0)}%</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-4)', fontWeight: 600 }}>of income</div>
        </div>
        <ChevronDown size={16} style={{ color: 'var(--text-4)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
      </button>

      {/* Progress bar */}
      <div style={{ height: 5, background: 'var(--surface-3)', position: 'relative' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: meta.color, transition: 'width .5s cubic-bezier(.22,1,.36,1)' }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, width: 2, left: `${Math.min(target, 99)}%`, background: 'var(--border-strong)', transform: 'translateX(-50%)' }} />
      </div>

      {/* Expanded category breakdown */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {items.length === 0 ? (
            <p style={{ fontSize: 12.5, color: 'var(--text-4)', padding: '14px 16px', margin: 0 }}>No spending in this bucket this month.</p>
          ) : (
            items.sort((a, b) => b.amt - a.amt).map(({ cat, amt }, idx) => {
              const barPct = totalIncome > 0 ? Math.min((amt / totalIncome) * 100, 100) : 0
              return (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ flexShrink: 0, color: 'var(--text-3)' }}><CategoryIcon category={cat} size={14} /></span>
                  <span style={{ fontSize: 13, color: 'var(--text-2)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{getCategoryDisplayName(cat)}</span>
                  <div style={{ width: 56, height: 4, background: 'var(--surface-3)', borderRadius: 999, flexShrink: 0 }}>
                    <div style={{ height: '100%', width: `${barPct}%`, background: meta.color, borderRadius: 999 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', minWidth: 70, textAlign: 'right' }}>{masked ? MASK : formatCurrencyFull(amt)}</span>
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

  const [masked, setMasked]                   = useState(true)
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

  const unallocatedPct = Math.max(0, 100 - needsPct - wantsPct - savingsPct)
  const isOver = needsPct + wantsPct + savingsPct > 100

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Income Hero ── */}
      <div style={{
        borderRadius: 16, padding: '20px',
        background: 'linear-gradient(135deg, var(--surface-2) 0%, var(--surface) 100%)',
        border: '1px solid var(--border)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: '50%',
          background: 'radial-gradient(circle, color-mix(in oklch, var(--brand) 12%, transparent), transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div className="h-eyebrow" style={{ marginBottom: 6 }}>Monthly income</div>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1 }}>
                {masked ? '₹ ••••••' : formatCurrencyFull(totalIncome === 1 ? 0 : totalIncome)}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setMasked(v => !v)}
                style={{ padding: '6px 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}
              >
                {masked ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
              {!editingRule && !editingCats && (
                <>
                  <button onClick={openCatEdit} style={{ padding: '6px 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                    <Tags size={12} /> Categories
                  </button>
                  <button onClick={() => { setRuleDraft(rule); setEditingRule(true) }} style={{ padding: '6px 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                    <Pencil size={12} /> Targets
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Unallocated pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
              background: isOver ? 'var(--bad-soft)' : 'var(--good-soft)',
              color: isOver ? 'var(--bad-ink)' : 'var(--good-ink)',
            }}>
              {isOver
                ? `${(needsPct + wantsPct + savingsPct - 100).toFixed(0)}% over budget`
                : `${unallocatedPct.toFixed(0)}% unallocated`}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 500 }}>
              {rule.needs}/{rule.wants}/{rule.savings} rule
            </span>
          </div>

          {/* Prominent stacked bar */}
          <div style={{ display: 'flex', height: 18, borderRadius: 10, overflow: 'hidden', gap: 2 }}>
            <div style={{ flex: needsPct,   background: 'var(--info)',    minWidth: needsPct   > 0 ? 6 : 0, borderRadius: '10px 0 0 10px', transition: 'flex .6s cubic-bezier(.22,1,.36,1)' }} />
            <div style={{ flex: wantsPct,   background: 'var(--warn)',    minWidth: wantsPct   > 0 ? 6 : 0, transition: 'flex .6s cubic-bezier(.22,1,.36,1)' }} />
            <div style={{ flex: savingsPct, background: 'var(--good)',    minWidth: savingsPct > 0 ? 6 : 0, transition: 'flex .6s cubic-bezier(.22,1,.36,1)' }} />
            <div style={{ flex: unallocatedPct, background: 'var(--surface-3)', minWidth: unallocatedPct > 0 ? 6 : 0, borderRadius: '0 10px 10px 0', transition: 'flex .6s cubic-bezier(.22,1,.36,1)' }} />
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
            {([
              { label: 'Needs',   pct: needsPct,   amt: byBucket.needs,   color: 'var(--info)' },
              { label: 'Wants',   pct: wantsPct,   amt: byBucket.wants,   color: 'var(--warn)' },
              { label: 'Savings', pct: savingsPct, amt: byBucket.savings, color: 'var(--good)' },
            ]).map(({ label, pct, amt, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>{pct.toFixed(0)}%</span>
                <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
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

      {/* Bucket rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
            masked={masked}
          />
        ))}
      </div>
    </div>
  )
}
