'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Pencil, X, Check, Tags } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import { EXPENSE_CATEGORIES } from '@/lib/utils'
import { CategoryIcon, getCategoryDisplayName } from '@/lib/categoryIcons'
import { setUserSettings } from '@/lib/firestore'
import { BUCKETS, DEFAULT_NEEDS, DEFAULT_SAVINGS, groupAllocation, type Bucket, type BudgetPlan, type GroupAllocation } from '@/lib/budgetPlan'
import { BUCKET_META, MASK, money } from './bucketMeta'
import { useCountUp } from '@/hooks/useCountUp'
import toast from 'react-hot-toast'

const INCOME_LABEL: Record<BudgetPlan['income']['source'], string> = {
  actual: 'Income',
  target: 'Income target',
  last: 'Last cycle’s income',
  none: 'Income',
}

const PHASE_LABEL: Record<BudgetPlan['cycle']['phase'], string> = {
  live: 'This cycle',
  past: 'Cycle ended',
  future: 'Next cycle',
}

// The card is always dark, whatever the app theme, so it uses a fixed palette
const INK = '#f2f1ef'
const ink = (a: number) => `rgba(242,241,239,${a})`
const tone = (l: number, c: number, h: number) => (a = 1) => `oklch(${l} ${c} ${h} / ${a})`
const red = tone(0.72, 0.16, 30)
const amber = tone(0.8, 0.13, 75)
const mint = tone(0.74, 0.13, 160)
const RED_INK = 'oklch(0.82 0.11 30)'
const AMBER_INK = 'oklch(0.87 0.1 75)'
const MINT_INK = 'oklch(0.84 0.1 160)'

type Tone = 'red' | 'amber' | 'mint' | 'neutral'
const TONES: Record<Tone, { bg: string; border: string; text: string; dot: string }> = {
  red:     { bg: red(0.14),  border: red(0.35),  text: RED_INK,   dot: red() },
  amber:   { bg: amber(0.14), border: amber(0.35), text: AMBER_INK, dot: amber() },
  mint:    { bg: mint(0.14), border: mint(0.35), text: MINT_INK,  dot: mint() },
  neutral: { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', text: ink(0.8), dot: ink(0.8) },
}

const BUCKET_TONE: Record<Bucket, (a?: number) => string> = {
  needs: tone(0.7, 0.13, 245),
  wants: tone(0.72, 0.13, 305),
  savings: tone(0.74, 0.13, 160),
}

// Bar fills: solid = spent, diagonal stripes = planned but not spent yet,
// pinstripes = spent with no budget, red stripes = over budget or beyond what you have.
const plannedFill = (b: Bucket) => `repeating-linear-gradient(135deg, ${BUCKET_TONE[b](0.55)} 0 3px, ${BUCKET_TONE[b](0.22)} 3px 6px)`
const noBudgetFill = (b: Bucket) => `repeating-linear-gradient(90deg, ${BUCKET_TONE[b]()} 0 2px, ${BUCKET_TONE[b](0.55)} 2px 4px)`
const OVER_FILL = `repeating-linear-gradient(135deg, ${red()} 0 3px, ${red(0.4)} 3px 6px)`

function barSegments(bucket: Bucket, a: GroupAllocation) {
  // Saving past the plan is good, so savings is never split out as over budget.
  const segs = bucket === 'savings'
    ? [{ key: 'spent', w: a.spent, bg: BUCKET_TONE[bucket]() }]
    : [
        { key: 'spent', w: a.inPlan, bg: BUCKET_TONE[bucket]() },
        { key: 'unbudgeted', w: a.unbudgeted, bg: noBudgetFill(bucket) },
        { key: 'over', w: a.over, bg: OVER_FILL },
      ]
  segs.push({ key: 'left', w: a.remaining, bg: plannedFill(bucket) })
  return segs.filter(s => s.w > 0)
}

const eyebrow: CSSProperties = {
  fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: ink(0.55), whiteSpace: 'nowrap',
}
const smallEyebrow: CSSProperties = { ...eyebrow, fontSize: 11, color: ink(0.45) }
const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12 }
const legendSwatch: CSSProperties = { width: 14, height: 8, borderRadius: 2, flexShrink: 0 }

// Hover states live in a stylesheet: inline styles would beat a :hover rule
const CARD_CSS = `
  .alloc-tool { font: inherit; font-size: 13px; font-weight: 600; color: ${INK}; background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 8px 14px; cursor: pointer; white-space: nowrap;
    display: flex; align-items: center; gap: 6px; transition: background .15s, border-color .15s; }
  .alloc-tile { background: rgba(255,255,255,0.035); transition: opacity .2s, background .2s; }
  @media (hover: hover) {
    .alloc-tool:hover { background: color-mix(in oklch, var(--brand) 24%, transparent); border-color: color-mix(in oklch, var(--brand) 50%, transparent); }
    .alloc-tile:hover { background: rgba(255,255,255,0.06); }
  }
`

// How planned budgets split the cycle's money (income plus carried-in cash) across Needs / Wants / Savings,
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
  // Highlighted bucket: hovering (or tapping) a bar piece or tile dims the others
  const [focus, setFocus] = useState<Bucket | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // A tapped highlight clears on the next tap outside the card
  useEffect(() => {
    if (!focus) return
    const clear = (e: PointerEvent) => {
      if (!cardRef.current?.contains(e.target as Node)) setFocus(null)
    }
    document.addEventListener('pointerdown', clear)
    return () => document.removeEventListener('pointerdown', clear)
  }, [focus])
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

  // ── Allocation: each category holds the larger of its plan and its spend ──
  // Measured against all the money there is to plan, not just income
  const toPlan = plan.funds.total
  const live = plan.cycle.phase !== 'past'
  const allocs = plan.groups.map(g => ({ g, a: groupAllocation(g, plan.cycle.phase) }))
  const committed = allocs.reduce((s, x) => s + x.a.committed, 0)
  const spent = allocs.reduce((s, x) => s + x.a.spent, 0)
  const stillPlanned = allocs.reduce((s, x) => s + x.a.remaining, 0)
  const spendAllocs = allocs.filter(x => x.g.bucket !== 'savings')
  const overCount = spendAllocs.reduce((s, x) => s + x.a.overCount, 0)
  const scale = Math.max(toPlan, committed, 1)
  const free = toPlan - committed
  // Treat anything within 1% of the total as on target, so a few rupees don't flip the status.
  const tolerance = Math.max(500, toPlan * 0.01)
  const short = free <= -tolerance
  const surplus = free >= tolerance

  const shownAmount = useCountUp(Math.abs(free), 950)

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

  const dim = (b: Bucket) => (focus && focus !== b ? 0.4 : 1)
  // Mouse highlights on hover; touch and pen toggle on tap
  const focusHandlers = (b: Bucket) => ({
    onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') setFocus(b) },
    onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') setFocus(null) },
    onPointerUp: (e: React.PointerEvent) => { if (e.pointerType !== 'mouse') setFocus(f => f === b ? null : b) },
  })

  const status: { label: string; tone: Tone } | null = toPlan <= 0 ? null
    : short ? { label: live ? 'Over-planned' : 'Overspent', tone: 'red' }
    : overCount > 0 ? { label: `Over budget in ${overCount} categor${overCount === 1 ? 'y' : 'ies'}`, tone: 'red' }
    : !surplus ? { label: 'Fully planned', tone: 'neutral' }
    : live ? { label: 'Not fully planned', tone: 'amber' }
    : { label: 'Money left over', tone: 'mint' }

  // One line on what to do next. When over-planned, point at the plan with room to cut,
  // preferring Wants.
  let advice: ReactNode
  if (short) {
    const gap = -free
    const cuttable = spendAllocs.filter(x => x.a.remaining > 0).sort((x, y) => y.a.remaining - x.a.remaining)
    const pick = cuttable.find(x => x.g.bucket === 'wants' && x.a.remaining >= gap) ?? cuttable[0]
    if (!live) advice = <>You spent {money(gap, masked)} more than you had this cycle.</>
    else if (!pick) advice = <>You’ve already spent more than you have this cycle.</>
    else if (pick.a.remaining >= gap) {
      advice = <>You’ve planned more than you have. Trim <strong style={{ color: INK, fontWeight: 600 }}>{BUCKET_META[pick.g.bucket].label}</strong> by {money(gap, masked)} to balance this cycle.</>
    } else {
      advice = <>You’ve planned more than you have. Trim your plans by {money(gap, masked)}, starting with <strong style={{ color: INK, fontWeight: 600 }}>{BUCKET_META[pick.g.bucket].label}</strong>, to balance this cycle.</>
    }
  } else if (overCount > 0) {
    advice = <>Spending has gone past its budget in {overCount} categor{overCount === 1 ? 'y' : 'ies'}. The planner below shows which.</>
  } else if (surplus) {
    advice = live ? <>Not planned or spent yet. Give it a job in a budget or your savings.</> : <>Left over when the cycle ended.</>
  } else {
    advice = live ? <>Every rupee this cycle has a job.</> : <>You used what you had this cycle.</>
  }

  // Where the money to plan comes from: income always, the rest only when present
  const f = plan.funds
  const fundRows = [
    { label: INCOME_LABEL[plan.income.source], amount: f.income, sign: '' },
    { label: 'Carried forward', amount: f.carryForward, sign: '+ ' },
    { label: 'Repaid to you', amount: f.repaidToYou, sign: '+ ' },
    { label: 'Borrowed', amount: f.borrowed, sign: '+ ' },
    { label: 'Lent out', amount: f.lentOut, sign: '− ', muted: true },
    { label: 'Repaid by you', amount: f.repaidByYou, sign: '− ', muted: true },
  ].filter((r, i) => i === 0 || r.amount > 0)

  const balance = free < 0
    ? { label: 'Shortfall', value: `− ${money(-free, masked)}`, tone: (short ? 'red' : 'neutral') as Tone }
    : { label: live ? 'Free to plan' : 'Left over', value: money(free, masked), tone: (!surplus ? 'neutral' : live ? 'amber' : 'mint') as Tone }

  const barGroups = allocs.filter(x => x.a.committed > 0)
  const freeFill = live ? amber(0.22) : mint(0.35)

  // Target markers at the rule's split of the money to plan, as a share of the bar
  const at = (pct: number) => (pct / 100) * toPlan / scale
  const ticks = [
    { label: `${rule.needs}%`, pos: at(rule.needs) },
    { label: `${rule.needs + rule.wants}%`, pos: at(rule.needs + rule.wants) },
  ].filter(t => t.pos > 0.04 && t.pos < 0.96)
  const fullPos = toPlan / scale

  const legend = [
    { key: 'spent', label: 'Spent', bg: ink(0.85), show: spent > 0 },
    { key: 'left', label: 'Planned', bg: `repeating-linear-gradient(135deg, ${ink(0.5)} 0 2px, ${ink(0.15)} 2px 4px)`, show: stillPlanned > 0 },
    { key: 'unbudgeted', label: 'No budget', bg: `repeating-linear-gradient(90deg, ${ink(0.85)} 0 2px, ${ink(0.4)} 2px 4px)`, show: spendAllocs.some(x => x.a.unbudgeted > 0) },
    { key: 'over', label: 'Over budget', bg: OVER_FILL, show: spendAllocs.some(x => x.a.over > 0) || short },
  ].filter(l => l.show)

  return (
    <div ref={cardRef} style={{
      borderRadius: 28, padding: 'clamp(20px, 3.5vw, 32px)',
      // Dark base keeps bucket and status colours readable; the corner glow picks up the theme colour
      background: 'radial-gradient(120% 90% at 100% 0%, color-mix(in oklch, var(--brand) 30%, oklch(0.2 0.006 260)) 0%, oklch(0.195 0.006 260) 55%, oklch(0.17 0.005 260) 100%)',
      border: '1px solid rgba(255,255,255,0.07)',
      boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 30px 80px -30px rgba(0,0,0,0.7)',
      color: INK, display: 'flex', flexDirection: 'column', gap: 28, minWidth: 0,
    }}>
      <style>{CARD_CSS}</style>

      {/* ── Header: title + tools ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={eyebrow}>How your money is allocated</span>
          <span style={{ fontSize: 12, color: ink(0.35) }}>·</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: ink(0.55), whiteSpace: 'nowrap' }}>{PHASE_LABEL[plan.cycle.phase]}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="alloc-tool" onClick={openCatEdit} title="Assign categories to buckets">
            <Tags size={13} /> Categories
          </button>
          <button className="alloc-tool" onClick={() => { setRuleDraft(rule); setEditingRule(true) }} title="Edit target percentages">
            <Pencil size={13} /> Edit targets
          </button>
        </div>
      </div>

      {toPlan <= 0 ? (
        <p style={{ fontSize: 15, color: ink(0.75), margin: 0, lineHeight: 1.5 }}>
          No money to plan for this cycle yet. Log your salary, or set a monthly income target in Settings, to compare your plan against the rule.
        </p>
      ) : (
        <>
          {/* ── Headline + money to plan ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 32, alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 20, minWidth: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {status && (
                  <div style={{
                    display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 8,
                    padding: '6px 12px 6px 10px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                    background: TONES[status.tone].bg, border: `1px solid ${TONES[status.tone].border}`, color: TONES[status.tone].text,
                  }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', background: TONES[status.tone].dot,
                      boxShadow: `0 0 0 4px color-mix(in oklch, ${TONES[status.tone].dot} 20%, transparent)`,
                    }} />
                    {status.label}
                  </div>
                )}
                <div style={{
                  fontSize: 'clamp(44px, 8vw, 96px)', fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1,
                  whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
                  color: short ? 'oklch(0.78 0.13 30)' : !live && surplus ? MINT_INK : INK,
                }}>
                  {masked ? MASK : `${free < 0 ? '−' : ''}${money(Math.round(shownAmount), false)}`}
                </div>
                <div style={{ fontSize: 18, lineHeight: 1.45, color: ink(0.82), maxWidth: 440, textWrap: 'pretty' } as CSSProperties}>
                  {advice}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                <Stat label="Spent or saved" value={money(spent, masked)} />
                {live && (
                  <>
                    <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }} />
                    <Stat label="Still planned" value={money(stillPlanned, masked)} />
                  </>
                )}
              </div>
            </div>

            <div style={{
              borderRadius: 18, background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.06)',
              padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, fontVariantNumeric: 'tabular-nums',
            }}>
              <div style={{ ...smallEyebrow, marginBottom: 4 }}>Money to plan</div>
              {fundRows.map(r => (
                <div key={r.label} style={row}>
                  <span style={{ color: ink(0.7) }}>{r.label}</span>
                  <span style={{ fontWeight: 600, color: r.muted ? ink(0.7) : INK }}>{r.sign}{money(r.amount, masked)}</span>
                </div>
              ))}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
              <div style={row}>
                <span style={{ color: ink(0.9), fontWeight: 600 }}>Available</span>
                <span style={{ fontWeight: 700 }}>{money(toPlan, masked)}</span>
              </div>
              <div style={row}>
                <span style={{ color: ink(0.7) }}>Planned</span>
                <span style={{ fontWeight: 600 }}>{money(committed, masked)}</span>
              </div>
              <div style={{
                ...row, padding: '8px 10px', margin: '2px -10px -6px', borderRadius: 8,
                background: balance.tone === 'neutral' ? 'rgba(255,255,255,0.05)' : TONES[balance.tone].bg,
              }}>
                <span style={{ color: TONES[balance.tone].text, fontWeight: 600 }}>{balance.label}</span>
                <span style={{ fontWeight: 700, color: TONES[balance.tone].text }}>{balance.value}</span>
              </div>
            </div>
          </div>

          {/* ── Split against the rule ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={eyebrow}>Against your {rule.needs} / {rule.wants} / {rule.savings} rule</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', fontSize: 12, color: ink(0.6), whiteSpace: 'nowrap' }}>
                {legend.map(l => (
                  <span key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ ...legendSwatch, background: l.bg }} />{l.label}
                  </span>
                ))}
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 2, height: 12, background: INK }} />Target split
                </span>
              </div>
            </div>

            <div style={{ position: 'relative', paddingTop: 22 }}>
              {/* Scale: 0, the rule's split points, and 100% of the money to plan */}
              <span style={{ position: 'absolute', left: 0, top: 0, fontSize: 11, fontWeight: 600, color: ink(0.4) }}>0</span>
              {ticks.map(t => (
                <span key={t.label} style={{ position: 'absolute', left: `${t.pos * 100}%`, top: 0, transform: 'translateX(-50%)', fontSize: 11, fontWeight: 600, color: ink(0.6) }}>{t.label}</span>
              ))}
              <span style={{
                position: 'absolute', top: 0, fontSize: 11, fontWeight: 600, color: ink(0.4),
                ...(fullPos > 0.94 ? { right: 0 } : { left: `${fullPos * 100}%`, transform: 'translateX(-50%)' }),
              }}>100%</span>

              <div style={{ position: 'relative', display: 'flex', gap: 3, height: 20 }}>
                {barGroups.map(({ g, a }, i) => {
                  const first = i === 0
                  const last = i === barGroups.length - 1 && free <= 0
                  return (
                    <div key={g.bucket} {...focusHandlers(g.bucket)} title={BUCKET_META[g.bucket].label} style={{
                      flex: `0 0 calc(${(a.committed / scale) * 100}% - 2px)`, display: 'flex', overflow: 'hidden', cursor: 'pointer',
                      borderRadius: `${first ? 6 : 3}px ${last ? 6 : 3}px ${last ? 6 : 3}px ${first ? 6 : 3}px`,
                      opacity: dim(g.bucket), transition: 'opacity .2s, flex-basis .6s cubic-bezier(.22,1,.36,1)',
                    }}>
                      {barSegments(g.bucket, a).map(s => (
                        <div key={s.key} style={{ width: `${(s.w / a.committed) * 100}%`, background: s.bg }} />
                      ))}
                    </div>
                  )
                })}
                {free > 0 && (
                  <div style={{
                    flex: '1 1 0', background: freeFill,
                    borderRadius: `${barGroups.length === 0 ? 6 : 3}px 6px 6px ${barGroups.length === 0 ? 6 : 3}px`,
                    opacity: focus ? 0.4 : 1, transition: 'opacity .2s',
                  }} title={live ? 'Free to plan' : 'Left over'} />
                )}
                {/* Planned beyond what there is to plan */}
                {short && (
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, left: `${fullPos * 100}%`, right: 0,
                    background: OVER_FILL, borderRadius: '0 6px 6px 0', pointerEvents: 'none',
                  }} />
                )}
                {ticks.map(t => (
                  <div key={t.label} style={{
                    position: 'absolute', left: `${t.pos * 100}%`, top: -5, bottom: -5, width: 2, marginLeft: -1,
                    background: INK, borderRadius: 1, boxShadow: '0 0 0 2px oklch(0.19 0.006 260)', pointerEvents: 'none',
                  }} />
                ))}
              </div>
              {(short || surplus) && (
                <div style={{
                  display: 'flex', justifyContent: 'flex-end', marginTop: 8, fontSize: 11, fontWeight: 600,
                  color: short ? 'oklch(0.8 0.11 30)' : live ? AMBER_INK : MINT_INK,
                }}>
                  {short ? `↑ ${money(-free, masked)} beyond what you have`
                    : live ? `${money(free, masked)} free to plan` : `${money(free, masked)} left over`}
                </div>
              )}
            </div>

            {/* ── Bucket tiles ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 12, marginTop: 6 }}>
              {allocs.map(({ g, a }) => (
                <BucketTile key={g.bucket} bucket={g.bucket} a={a} planned={g.planned} targetPct={g.targetPct}
                  toPlan={toPlan} live={live} tolerance={tolerance} masked={masked}
                  opacity={dim(g.bucket)} handlers={focusHandlers(g.bucket)} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: ink(0.5), whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

function BucketTile({ bucket, a, planned, targetPct, toPlan, live, tolerance, masked, opacity, handlers }: {
  bucket: Bucket; a: GroupAllocation; planned: number; targetPct: number; toPlan: number
  live: boolean; tolerance: number; masked: boolean; opacity: number
  handlers: Record<string, (e: React.PointerEvent) => void>
}) {
  const isSavings = bucket === 'savings'
  const pct = Math.round((a.committed / toPlan) * 100)
  const diff = pct - targetPct

  // Points against the rule: over is bad for spending, good for savings
  const chip: { text: string; tone: Tone } = Math.abs(diff) < 1 ? { text: 'On target', tone: 'neutral' }
    : isSavings ? (diff > 0 ? { text: `${diff} pts ahead`, tone: 'mint' } : { text: `${-diff} pts behind`, tone: 'neutral' })
    : diff > 0 ? { text: `${diff} pts over`, tone: 'red' } : { text: `${-diff} pts under`, tone: 'neutral' }

  // The one thing to know about this bucket
  let foot: { label: string; value?: string; color?: string }
  if (isSavings) {
    const beyond = a.over + a.unbudgeted
    if (planned <= 0) foot = { label: 'No savings plan yet', color: AMBER_INK }
    else if (a.unspent > 0) foot = { label: live ? 'To go' : 'Short of plan', value: money(a.unspent, masked) }
    else if (beyond >= tolerance) foot = { label: 'Beyond plan', value: money(beyond, masked), color: MINT_INK }
    else foot = { label: 'Plan met', color: MINT_INK }
  } else if (a.over > 0) {
    foot = { label: `Over budget · ${a.overCount} categor${a.overCount === 1 ? 'y' : 'ies'}`, value: money(a.over, masked), color: RED_INK }
  } else if (a.unbudgeted >= tolerance) {
    foot = { label: 'Spent with no budget', value: money(a.unbudgeted, masked), color: AMBER_INK }
  } else if (a.unspent > 0) {
    foot = { label: live ? 'Left in plan' : 'Unspent', value: money(a.unspent, masked) }
  } else if (planned > 0) {
    foot = { label: 'Budget used up' }
  } else {
    foot = { label: 'Nothing spent yet' }
  }

  const progress = planned > 0 ? Math.min(100, (a.spent / planned) * 100) : 0
  const progressColor = !isSavings && a.over > 0 ? red() : BUCKET_TONE[bucket]()

  return (
    <div className="alloc-tile" {...handlers} style={{
      borderRadius: 18, padding: 20, border: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', flexDirection: 'column', gap: 16, opacity, minWidth: 0, cursor: 'default',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: BUCKET_TONE[bucket]() }} />
          {BUCKET_META[bucket].label}
        </span>
        <span style={{
          fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
          background: chip.tone === 'neutral' ? 'rgba(255,255,255,0.07)' : TONES[chip.tone].bg,
          color: chip.tone === 'neutral' ? ink(0.75) : TONES[chip.tone].text,
        }}>{chip.text}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: 14, color: ink(0.5), whiteSpace: 'nowrap' }}>of {targetPct}% target</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{
            width: `${progress}%`, minWidth: a.spent > 0 && planned > 0 ? 6 : 0, height: '100%', borderRadius: 3,
            background: progressColor, transition: 'width .6s cubic-bezier(.22,1,.36,1)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, color: ink(0.6), fontVariantNumeric: 'tabular-nums' }}>
          <span><span style={{ color: INK, fontWeight: 600 }}>{money(a.spent, masked)}</span> {isSavings ? 'saved' : 'spent'}</span>
          <span style={{ whiteSpace: 'nowrap' }}>{planned > 0 ? `of ${money(planned, masked)}` : a.spent > 0 ? 'no budget' : 'nothing planned'}</span>
        </div>
      </div>

      <div style={{ paddingTop: 14, borderTop: '1px dashed rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
        <span style={{ color: foot.value ? ink(0.6) : foot.color ?? ink(0.6), fontWeight: foot.value ? 400 : 600 }}>{foot.label}</span>
        {foot.value && <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: foot.color ?? INK }}>{foot.value}</span>}
      </div>
    </div>
  )
}
