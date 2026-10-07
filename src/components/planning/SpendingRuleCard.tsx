'use client'

import { useState } from 'react'
import { Pencil, X, Check, Tags } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import { EXPENSE_CATEGORIES } from '@/lib/utils'
import { CategoryIcon, getCategoryDisplayName } from '@/lib/categoryIcons'
import { setUserSettings } from '@/lib/firestore'
import { BUCKETS, DEFAULT_NEEDS, DEFAULT_SAVINGS, type Bucket, type BudgetPlan } from '@/lib/budgetPlan'
import { BUCKET_META, money } from './bucketMeta'
import toast from 'react-hot-toast'

const INCOME_LABEL: Record<BudgetPlan['income']['source'], string> = {
  actual: 'Income this cycle',
  target: 'Income target',
  last: 'Last cycle’s income',
  none: 'Income',
}

const toolButton: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)',
  cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5,
  fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
}

// How planned budgets split the month's income across Needs / Wants / Savings,
// against the user's rule. Also hosts the rule and bucket-assignment editors.
export default function SpendingRuleCard({ plan, masked }: { plan: BudgetPlan; masked: boolean }) {
  const { user } = useAuth()
  const { settings } = useAppStore()
  const refresh = useRefreshData()

  const rule = plan.rule
  const needsCats   = settings?.categoryBuckets?.needs   ?? DEFAULT_NEEDS
  const savingsCats = settings?.categoryBuckets?.savings ?? DEFAULT_SAVINGS

  const [editingRule, setEditingRule] = useState(false)
  const [editingCats, setEditingCats] = useState(false)
  const [ruleDraft, setRuleDraft]     = useState(rule)
  const [bucketDraft, setBucketDraft] = useState<{ needs: Set<string>; savings: Set<string> }>({
    needs: new Set(needsCats), savings: new Set(savingsCats),
  })
  const [saving, setSaving] = useState(false)

  const ruleTotal = ruleDraft.needs + ruleDraft.wants + ruleDraft.savings
  const ruleValid = ruleTotal === 100

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

  // ── Allocation ──
  const income = plan.income.amount
  const totalPlanned = plan.groups.reduce((s, g) => s + g.planned, 0)
  const scale = Math.max(income, totalPlanned, 1)
  const unplanned = income - totalPlanned
  // Treat anything within 1% of income as on target, so a few rupees don't flip the status.
  const tolerance = Math.max(500, income * 0.01)

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18, overflow: 'visible' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>How your income is allocated</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3 }}>
            Planned budgets against your {rule.needs}/{rule.wants}/{rule.savings} rule
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div className="h-eyebrow">{INCOME_LABEL[plan.income.source]}</div>
            <div className="display-num" style={{ fontSize: 18, color: 'var(--text)', marginTop: 2 }}>
              {income > 0 ? money(income, masked) : '—'}
            </div>
          </div>
          {income > 0 && (
            // Unallotted income is the number to act on, so it sits up here, highlighted.
            <div style={{
              textAlign: 'right', padding: '6px 12px', borderRadius: 10,
              background: unplanned < 0 ? 'var(--bad-soft)' : unplanned >= tolerance ? 'var(--warn-soft)' : 'var(--good-soft)',
            }}>
              <div className="h-eyebrow" style={{ color: unplanned < 0 ? 'var(--bad-ink)' : unplanned >= tolerance ? 'var(--warn-ink)' : 'var(--good-ink)' }}>
                {unplanned < 0 ? 'Over-allotted' : 'Not allotted'}
              </div>
              <div className="display-num" style={{ fontSize: 18, marginTop: 2, color: unplanned < 0 ? 'var(--bad-ink)' : unplanned >= tolerance ? 'var(--warn-ink)' : 'var(--good-ink)' }}>
                {money(Math.abs(unplanned), masked)}
              </div>
            </div>
          )}
          {!editingRule && !editingCats && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={openCatEdit} style={toolButton}>
                <Tags size={12} /> Categories
              </button>
              <button onClick={() => { setRuleDraft(rule); setEditingRule(true) }} style={toolButton}>
                <Pencil size={12} /> Targets
              </button>
            </div>
          )}
        </div>
      </div>

      {income <= 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
          No income recorded for this cycle yet. Log your salary, or set a monthly income target in Settings, to compare your plan against the rule.
        </p>
      ) : (
        <>
          {/* Stacked bar: each bucket's planned amount as a share of income, then what's
              left unallotted. A bucket past its target glows: green for savings, red otherwise. */}
          <div style={{ display: 'flex', height: 14, borderRadius: 8, gap: 2, background: 'var(--surface-3)' }}>
            {[
              ...plan.groups.filter(g => g.planned > 0).map(g => ({
                key: g.bucket,
                width: g.planned / scale,
                color: BUCKET_META[g.bucket].color,
                flare: g.planned - g.target >= tolerance ? (g.bucket === 'savings' ? 'flare-seg flare-good' : 'flare-seg flare-bad') : undefined,
              })),
              ...(unplanned > 0 ? [{
                key: 'unallotted',
                width: unplanned / scale,
                color: unplanned >= tolerance ? 'var(--warn-2)' : 'var(--good-soft)',
                flare: undefined,
              }] : []),
            ].map((seg, i, all) => (
              <div key={seg.key} className={seg.flare} title={seg.key === 'unallotted' ? 'Not allotted' : undefined} style={{
                width: `${seg.width * 100}%`, background: seg.color,
                borderRadius: `${i === 0 ? 8 : 0}px ${i === all.length - 1 ? 8 : 0}px ${i === all.length - 1 ? 8 : 0}px ${i === 0 ? 8 : 0}px`,
                transition: 'width .6s cubic-bezier(.22,1,.36,1)',
              }} />
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
            {plan.groups.map(g => {
              const meta = BUCKET_META[g.bucket]
              const pct = Math.round((g.planned / income) * 100)
              const diff = g.target - g.planned
              const onTarget = Math.abs(diff) < tolerance
              const status = onTarget ? 'On target'
                : diff > 0 ? `${money(diff, masked)} unallocated`
                : g.bucket === 'savings' ? `${money(-diff, masked)} above target`
                : `${money(-diff, masked)} over target`
              const statusColor = onTarget || (diff < 0 && g.bucket === 'savings') ? 'var(--good-ink)'
                : diff < 0 ? 'var(--warn-ink)'
                : 'var(--text-3)'
              return (
                <div key={g.bucket} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: meta.color, marginTop: 5, flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
                      {meta.label}{' '}
                      <span style={{ color: 'var(--text-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>· {pct}% / {g.targetPct}% target</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: statusColor }}>{status}</div>
                  </div>
                </div>
              )
            })}
          </div>

        </>
      )}

      {/* Targets edit */}
      {editingRule && (
        <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', margin: 0 }}>Target percentages — must add up to 100%</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {BUCKETS.map(key => (
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
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', margin: 0 }}>
            Assign each category to a bucket. Savings vehicles (SIP, Emergency Fund…) always count as Savings.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 340, overflowY: 'auto' }}>
            {allExpCats.map(cat => {
              const current = getBucket(cat, bucketDraft.needs, bucketDraft.savings)
              return (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 8, background: 'var(--surface)' }}>
                  <span style={{ flexShrink: 0, color: 'var(--text-3)' }}><CategoryIcon category={cat} size={14} /></span>
                  <span style={{ fontSize: 12, color: 'var(--text-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getCategoryDisplayName(cat)}</span>
                  <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
                    {BUCKETS.map(b => {
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
    </div>
  )
}
