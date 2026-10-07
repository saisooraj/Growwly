'use client'

import { useState } from 'react'
import { Pencil, X, Check, Tags } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import { EXPENSE_CATEGORIES, formatCurrencyFull } from '@/lib/utils'
import { CategoryIcon, getCategoryDisplayName } from '@/lib/categoryIcons'
import { setUserSettings } from '@/lib/firestore'
import { BUCKETS, DEFAULT_NEEDS, DEFAULT_SAVINGS, type Bucket, type BudgetPlan } from '@/lib/budgetPlan'
import { BUCKET_META, MASK, money } from './bucketMeta'
import { useCountUp } from '@/hooks/useCountUp'
import toast from 'react-hot-toast'

const INCOME_LABEL: Record<BudgetPlan['income']['source'], string> = {
  actual: 'Income this cycle',
  target: 'Income target',
  last: 'Last cycle’s income',
  none: 'Income',
}

// White-on-gradient styling shared with the Safe to spend and Net worth hero cards
const heroEyebrow: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)',
}
const glass: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: '#fff',
  background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)',
}
const glassButton: React.CSSProperties = {
  ...glass, borderRadius: 8, padding: '4px 9px', cursor: 'pointer', fontFamily: 'inherit',
}
const HERO_MINT  = 'rgba(160,255,205,0.95)'
const HERO_AMBER = 'rgba(255,200,120,1)'
const HERO_RED   = 'rgba(255,150,130,1)'

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

  const shownAmount = useCountUp(Math.abs(unplanned), 950)

  /* Editing uses a regular card so form controls stay on a light background */
  if (editingRule || editingCats) {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          {editingRule ? 'Allocation targets' : 'Category buckets'}
        </div>
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

  const status = income <= 0 ? null
    : unplanned < 0 ? { label: 'Over-allotted', dot: HERO_RED }
    : unplanned >= tolerance ? { label: 'Not fully allotted', dot: HERO_AMBER }
    : { label: 'Fully allotted', dot: '#fff' }

  /* ── Hero gradient card, same family as Safe to spend and Net worth ── */
  return (
    <div style={{
      background: 'linear-gradient(155deg, var(--brand-deep) 0%, var(--brand) 55%, var(--brand-2) 100%)',
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--pad)',
      boxShadow: '0 16px 40px -16px var(--brand)',
      display: 'flex', flexDirection: 'column', gap: 16,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Glow orb */}
      <div style={{
        position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,.2), transparent 70%)', pointerEvents: 'none',
      }} />

      {/* ── Top row: eyebrow + status + tools ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', position: 'relative' }}>
        <span style={heroEyebrow}>How your income is allocated</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {status && (
            <span style={{ ...glass, borderRadius: 999, padding: '3px 10px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.dot, flexShrink: 0 }} />
              {status.label}
            </span>
          )}
          <button onClick={openCatEdit} style={glassButton} title="Assign categories to buckets">
            <Tags size={12} /> Categories
          </button>
          <button onClick={() => { setRuleDraft(rule); setEditingRule(true) }} style={glassButton} title="Edit target percentages">
            <Pencil size={12} /> Targets
          </button>
        </div>
      </div>

      {income <= 0 ? (
        <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.8)', margin: 0, position: 'relative', lineHeight: 1.5 }}>
          No income recorded for this cycle yet. Log your salary, or set a monthly income target in Settings, to compare your plan against the rule.
        </p>
      ) : (
        <>
          {/* ── Primary number: what's left to allot ── */}
          <div style={{ position: 'relative' }}>
            <div style={{
              fontSize: 'clamp(34px, 7vw, 48px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1,
              color: '#fff', fontFamily: "'Geist Mono', monospace",
            }}>
              {masked ? MASK : `${unplanned < 0 ? '−' : ''}${formatCurrencyFull(Math.round(shownAmount))}`}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 6, fontWeight: 500 }}>
              {unplanned < 0 ? 'planned beyond' : unplanned >= tolerance ? 'not allotted yet, of' : 'left over, of'}{' '}
              {money(income, masked)} · {INCOME_LABEL[plan.income.source].toLowerCase()}
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.18)', position: 'relative' }} />

          {/* ── Split against the rule ── */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={heroEyebrow}>Against your {rule.needs}/{rule.wants}/{rule.savings} rule</span>

            {/* Stacked bar: each bucket's planned share of income, then what's left unallotted.
                A bucket past its target glows: mint for savings, red otherwise. */}
            <div style={{ display: 'flex', height: 12, borderRadius: 999, gap: 3, background: 'rgba(255,255,255,0.18)' }}>
              {[
                ...plan.groups.filter(g => g.planned > 0).map(g => ({
                  key: g.bucket as string,
                  width: g.planned / scale,
                  color: BUCKET_META[g.bucket].color,
                  flare: g.planned - g.target >= tolerance ? (g.bucket === 'savings' ? 'flare-seg flare-good' : 'flare-seg flare-bad') : undefined,
                })),
                ...(unplanned > 0 ? [{
                  key: 'unallotted',
                  width: unplanned / scale,
                  color: unplanned >= tolerance ? 'var(--warn-2)' : 'rgba(255,255,255,0.35)',
                  flare: undefined,
                }] : []),
              ].map((seg, i, all) => (
                <div key={seg.key} className={seg.flare} title={seg.key === 'unallotted' ? 'Not allotted' : BUCKET_META[seg.key as Bucket].label} style={{
                  width: `${seg.width * 100}%`, background: seg.color,
                  // White ring keeps bucket colours readable on any brand gradient
                  boxShadow: '0 0 0 1.5px rgba(255,255,255,0.75)',
                  borderRadius: `${i === 0 ? 999 : 2}px ${i === all.length - 1 ? 999 : 2}px ${i === all.length - 1 ? 999 : 2}px ${i === 0 ? 999 : 2}px`,
                  transition: 'width .6s cubic-bezier(.22,1,.36,1)',
                  ...(seg.flare?.includes('flare-good') ? { '--flare': HERO_MINT } as React.CSSProperties : {}),
                }} />
              ))}
            </div>

            {/* Bucket tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              {plan.groups.map(g => {
                const meta = BUCKET_META[g.bucket]
                const pct = Math.round((g.planned / income) * 100)
                const diff = g.target - g.planned
                const onTarget = Math.abs(diff) < tolerance
                const line = onTarget ? 'On target'
                  : diff > 0 ? `${money(diff, masked)} unallocated`
                  : g.bucket === 'savings' ? `${money(-diff, masked)} above target`
                  : `${money(-diff, masked)} over target`
                const dot = onTarget || (diff < 0 && g.bucket === 'savings') ? HERO_MINT
                  : diff < 0 ? HERO_RED
                  : HERO_AMBER
                return (
                  <div key={g.bucket} style={{ background: 'rgba(255,255,255,.16)', borderRadius: 14, padding: '12px 14px', backdropFilter: 'blur(6px)', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: meta.color, boxShadow: '0 0 0 1.5px rgba(255,255,255,0.75)', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{meta.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>{pct}%</span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap' }}>of {g.targetPct}% target</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: '#fff', fontWeight: 600 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
