'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { setUserSettings } from '@/lib/firestore'
import { computeValue } from '@/lib/assetValuation'
import { useLivePrices } from '@/hooks/useLivePrices'
import { useFirePlan } from '@/hooks/useFirePlan'
import { cleanFireSettings, DEFAULT_ASSUMPTIONS_PCT } from '@/lib/fireDefaults'
import { computeFire, fiTargetAt, reversePlan, scenarioOf, SCENARIO_KEYS, yearAt, type FireResult, type ScenarioKey } from '@/lib/fire'
import type { FireSettings } from '@/types'
import WealthTabs from '@/components/networth/WealthTabs'
import { fmtShort, KindMark, SCENARIO_META } from './shared'
import { FireHero, KeyNumbers } from './FireHero'
import ScenarioCards from './ScenarioCards'
import ProjectionChart from './ProjectionChart'
import ReverseCalculator from './ReverseCalculator'
import LifestyleCard from './LifestyleCard'
import MilestonesCard from './MilestonesCard'
import AllocationCard from './AllocationCard'
import InputsPanel, { type OverrideKey } from './InputsPanel'
import AssumptionsPanel from './AssumptionsPanel'
import LearnCard from './LearnCard'
import MobileSheet from './MobileSheet'

const SAVE_DELAY_MS = 900
const DESKTOP_QUERY = '(min-width: 1024px)'

function useIsDesktop() {
  const [desk, setDesk] = useState(() => typeof window === 'undefined' || window.matchMedia(DESKTOP_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY)
    const on = () => setDesk(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return desk
}

/** Short live answer for the sticky bars: "FI in 16.8 yrs · age 44". */
export function miniAnswer(r: FireResult, hasAge: boolean): string {
  if (r.status === 'reached') return `FI in ${r.years!.toFixed(1)} yrs · ${hasAge && r.retirementAge != null ? `age ${Math.floor(r.retirementAge)}` : r.retirementYear}`
  if (r.status === 'already') return 'Financially independent'
  if (r.status === 'unreachable') return 'Not reachable yet'
  return 'Add spending to start'
}

const ANCHORS: { id: string; label: string; needsData?: boolean }[] = [
  { id: 'fire-answer', label: 'Answer' },
  { id: 'fire-compare', label: 'Compare', needsData: true },
  { id: 'fire-projection', label: 'Projection', needsData: true },
  { id: 'fire-retire', label: 'Retire by', needsData: true },
  { id: 'fire-milestones', label: 'Milestones', needsData: true },
  { id: 'fire-lifestyle', label: 'Lifestyle', needsData: true },
  { id: 'fire-allocation', label: 'Allocation', needsData: true },
  { id: 'fire-method', label: 'How it works' },
]

export default function FirePlanner() {
  const { user } = useAuth()
  const { assets, settings } = useAppStore()
  const prices = useLivePrices(assets)
  const valuedAssets = useMemo(() => assets.map(a => computeValue(a, prices)), [assets, prices])
  const isDesk = useIsDesktop()

  const [masked, setMasked] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editKey, setEditKey] = useState<OverrideKey | null>(null)
  const [assumpOpen, setAssumpOpen] = useState(false)

  // Draft of the saved FIRE settings: edits show up at once and are saved shortly after.
  const [draft, setDraft] = useState<FireSettings>({})
  const hydrated = useRef(false)
  useEffect(() => {
    if (hydrated.current || !settings) return
    hydrated.current = true
    setDraft(settings.fire ?? {})
  }, [settings])
  const update = useCallback((patch: Partial<FireSettings>) => setDraft(d => ({ ...d, ...patch })), [])

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const pending = useRef<FireSettings | null>(null)
  const firstDraft = useRef(true)
  useEffect(() => {
    if (!hydrated.current) return
    if (firstDraft.current) { firstDraft.current = false; return }
    if (!user) return
    pending.current = draft
    const t = setTimeout(async () => {
      const toSave = pending.current
      if (!toSave) return
      pending.current = null
      setSaveState('saving')
      try {
        const clean = cleanFireSettings(toSave)
        await setUserSettings(user.uid, { fire: clean })
        const s = useAppStore.getState().settings
        if (s) useAppStore.getState().setSettings({ ...s, fire: clean })
        setSaveState('saved')
      } catch {
        setSaveState('idle')
        toast.error('Couldn’t save your FIRE settings')
      }
    }, SAVE_DELAY_MS)
    return () => clearTimeout(t)
  }, [draft, user])
  // "✓ Saved" shows for about two seconds, then disappears
  useEffect(() => {
    if (saveState !== 'saved') return
    const t = setTimeout(() => setSaveState('idle'), 2000)
    return () => clearTimeout(t)
  }, [saveState])
  // Leaving the page mid-edit still saves the last change
  useEffect(() => () => {
    const toSave = pending.current
    if (toSave && user) void setUserSettings(user.uid, { fire: cleanFireSettings(toSave) }).catch(() => {})
  }, [user])

  async function saveDob(dob: string | null) {
    if (!user) return
    setSaveState('saving')
    try {
      await setUserSettings(user.uid, { dateOfBirth: dob ?? '' })
      const s = useAppStore.getState().settings
      if (s) useAppStore.getState().setSettings({ ...s, dateOfBirth: dob ?? '' })
      setSaveState('saved')
    } catch {
      setSaveState('idle')
      toast.error('Couldn’t save your date of birth')
    }
  }

  const plan = useFirePlan(valuedAssets, prices, hydrated.current ? draft : settings?.fire)
  const { data, assumptions: a, input, results } = plan
  const scenario: ScenarioKey = draft.scenario ?? 'moderate'
  const setScenario = (k: ScenarioKey) => update({ scenario: k })
  const res = results[scenario]
  const sc = scenarioOf(a, scenario)
  const hasAge = input.age != null
  const hasData = res.status !== 'no-expenses'

  // Target retirement date for "Retire by", the "SIP needed" figures and Coast FI.
  // Default: 50, or five years from now for anyone already 50 or older.
  const targetAge = draft.targetRetirementAge
    ?? (hasAge && input.age! >= DEFAULT_ASSUMPTIONS_PCT.targetRetirementAge ? Math.ceil(input.age!) + 5 : DEFAULT_ASSUMPTIONS_PCT.targetRetirementAge)
  const targetYears = draft.targetYears ?? DEFAULT_ASSUMPTIONS_PCT.targetYears
  const targetMonths = hasAge ? Math.max(0, Math.round((targetAge - input.age!) * 12)) : targetYears * 12
  const targetYear = yearAt(input.startYear, input.startMonthIndex, targetMonths)
  const targetLabel = hasAge ? `age ${targetAge}` : String(targetYear)

  const requiredByScenario = useMemo(() => Object.fromEntries(SCENARIO_KEYS.map(k => {
    const target = fiTargetAt(input.spend, a, a.withdrawalRates[k], targetMonths)
    return [k, reversePlan({ portfolio: input.portfolio, monthlySip: input.monthlySip, stepUp: a.stepUp, annualReturn: a.returns[k], months: targetMonths, target })]
  })) as Record<ScenarioKey, ReturnType<typeof reversePlan>>, [input, a, targetMonths])

  const lifestyles = useMemo(() => {
    const budgets = { lean: draft.lifestyles?.lean ?? null, regular: input.spend.monthly > 0 ? input.spend.monthly : null, fat: draft.lifestyles?.fat ?? null }
    return (Object.entries(budgets) as [keyof typeof budgets, number | null][]).map(([key, monthly]) => ({
      key, monthly,
      result: monthly != null && monthly > 0 ? computeFire({ ...input, spend: { monthly } }, a, sc) : null,
    }))
  }, [draft.lifestyles, input, a, sc])

  const mini = miniAnswer(res, hasAge)
  const anchors = ANCHORS.filter(x => hasData || !x.needsData)
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const openInputs = (then?: () => void) => {
    if (isDesk) { then?.(); return }
    setSheetOpen(true)
    if (then) setTimeout(then, 60)
  }
  const onEnterSpend = () => { setMasked(false); openInputs(); setEditKey('monthlyExpenses') }
  const onAddDob = () => openInputs(() => {
    const el = document.getElementById('fire-dob')
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.focus()
  })

  const side = (
    <>
      <InputsPanel data={data} draft={draft} update={update} masked={masked} dob={settings?.dateOfBirth} onDob={saveDob} editKey={editKey} setEditKey={setEditKey} />
      <AssumptionsPanel draft={draft} update={update} masked={masked} open={assumpOpen} onToggle={() => setAssumpOpen(v => !v)} />
    </>
  )

  return (
    <div className="anim-page" style={{ maxWidth: 1280, display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>
      {/* Top: sub-tabs, what the marks mean, save state, mask */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <WealthTabs active="fire" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span aria-live="polite" style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, color: saveState === 'saved' ? 'var(--good-ink)' : 'var(--text-3)', fontWeight: saveState === 'saved' ? 600 : 500 }}>
            {saveState === 'saving' && <><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-3)' }} />Saving…</>}
            {saveState === 'saved' && '✓ Saved'}
          </span>
          <button type="button" onClick={() => setMasked(v => !v)} aria-pressed={!masked}
            style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {masked ? <Eye size={16} /> : <EyeOff size={16} />}{masked ? 'Show amounts' : 'Hide amounts'}
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px 14px', flexWrap: 'wrap', fontSize: 13, color: 'var(--text-2)', marginTop: -4 }}>
        <span>Live from your records. Planning assumptions, not guarantees.</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><KindMark kind="actual" />Actual</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><KindMark kind="projection" />Projection</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><KindMark kind="assumption" />Assumption</span>
        </span>
      </div>

      {/* Sticky bar: jump to a section, with the live answer always in view */}
      <div className="fire-sticky">
        <div className="fire-desk" style={{ alignItems: 'center', gap: 16 }}>
          <nav aria-label="Sections" style={{ display: 'flex', gap: 2, flexWrap: 'wrap', flex: 1 }}>
            {anchors.map(x => <button key={x.id} type="button" className="fire-navbtn" onClick={() => go(x.id)}>{x.label}</button>)}
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand)' }} />
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{mini}</span>
            <span>· {SCENARIO_META[scenario].label}</span>
          </div>
        </div>
        <div className="fire-mob" style={{ flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand)', flex: 'none' }} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mini}</span>
            </div>
            {hasData && (
              <div role="radiogroup" aria-label="Scenario" style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--surface-2)', borderRadius: 10, flex: 'none' }}>
                {SCENARIO_KEYS.map(k => (
                  <button key={k} type="button" role="radio" aria-checked={k === scenario} aria-label={SCENARIO_META[k].label} onClick={() => setScenario(k)}
                    style={{
                      border: 0, cursor: 'pointer', minHeight: 34, padding: '0 9px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                      background: k === scenario ? 'var(--surface)' : 'transparent', color: k === scenario ? 'var(--text)' : 'var(--text-2)',
                    }}>
                    {SCENARIO_META[k].short}
                  </button>
                ))}
              </div>
            )}
          </div>
          <nav aria-label="Sections" className="fire-chips">
            {anchors.map(x => (
              <button key={x.id} type="button" onClick={() => go(x.id)}
                style={{ flex: 'none', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 12.5, fontWeight: 600, minHeight: 32, padding: '0 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit' }}>
                {x.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="fire-layout">
        <div className="fire-main">
          <FireHero
            res={res} input={input} assumptions={a} scenario={scenario} onScenario={setScenario} masked={masked}
            onEnterSpend={onEnterSpend} onAddDob={onAddDob} onSeeRetire={() => go(hasData ? 'fire-retire' : 'fire-answer')}
          />
          {hasData && (
            <>
              <KeyNumbers res={res} input={input} netWorth={data.netWorth} income={data.monthlyIncome.value} masked={masked} />
              <ScenarioCards results={results} assumptions={a} required={requiredByScenario} targetLabel={targetLabel}
                annualSpend={input.spend.monthly * 12} hasAge={hasAge} masked={masked} selected={scenario} onSelect={setScenario} />
              <ProjectionChart input={input} assumptions={a} results={results} scenario={scenario} masked={masked} />
              <ReverseCalculator
                input={input} assumptions={a} scenario={scenario} masked={masked} income={data.monthlyIncome.value}
                targetAge={targetAge} targetYears={targetYears} targetMonths={targetMonths}
                onTargetAge={v => update({ targetRetirementAge: v })} onTargetYears={v => update({ targetYears: v })}
              />
              <MilestonesCard res={res} input={input} assumptions={a} scenario={scenario} masked={masked} />
              <LifestyleCard
                lifestyles={lifestyles} masked={masked} hasAge={hasAge}
                onBudget={(key, v) => update({ lifestyles: { ...(draft.lifestyles ?? {}), [key]: v ?? undefined } })}
                coast={{ months: targetMonths, label: targetLabel, year: targetYear, portfolio: input.portfolio, target: fiTargetAt(input.spend, a, sc.withdrawalRate, targetMonths), annualReturn: sc.annualReturn }}
              />
              <AllocationCard allocation={data.allocation} ef={data.allocationEf} efCounted={data.efCounted}
                target={draft.targetAllocation ?? DEFAULT_ASSUMPTIONS_PCT.targetAllocation} onTarget={t => update({ targetAllocation: t })} masked={masked} />
            </>
          )}
          <LearnCard />
        </div>
        {isDesk && <aside className="fire-side" aria-label="Your numbers and assumptions">{side}</aside>}
      </div>

      {!isDesk && (
        <>
          {/* Room for the floating bar */}
          <div style={{ height: 56 }} />
          <MobileSheet open={sheetOpen} onOpen={() => setSheetOpen(true)} onClose={() => { setSheetOpen(false); setEditKey(null) }}
            mini={mini} barNote={masked ? 'Edit' : `${fmtShort(input.monthlySip)}/mo`} saveState={saveState}>
            {side}
          </MobileSheet>
        </>
      )}
    </div>
  )
}
