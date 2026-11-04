'use client'

import { useEffect, useMemo, useState } from 'react'
import { fiTargetAt, MAX_STEP_UP, reversePlan, toTodaysMoney, yearAt, type FireAssumptions, type PlanInput, type ScenarioKey } from '@/lib/fire'
import { BOX, BOX_INPUT, CARD, fmtFull, fmtShort, MONO, SectionHead, Tip, TIPS } from './shared'

interface Props {
  input: PlanInput
  assumptions: FireAssumptions
  scenario: ScenarioKey
  masked: boolean
  income: number
  targetAge: number
  targetYears: number
  targetMonths: number
  onTargetAge: (v: number) => void
  onTargetYears: (v: number) => void
}

const AGE_PRESETS = [40, 45, 50, 55]
const YEAR_PRESETS = [10, 15, 20, 25]
const NUDGES = [-5000, 5000, 10000, 25000]

export default function ReverseCalculator({ input, assumptions: a, scenario, masked, income, targetAge, targetYears, targetMonths, onTargetAge, onTargetYears }: Props) {
  const hasAge = input.age != null
  // What-if SIP and step-up: start from your numbers, never saved
  const [sip, setSip] = useState(Math.round(input.monthlySip))
  const [stepUpPct, setStepUpPct] = useState(+(a.stepUp * 100).toFixed(2))
  useEffect(() => { setSip(Math.round(input.monthlySip)) }, [input.monthlySip])
  useEffect(() => { setStepUpPct(+(a.stepUp * 100).toFixed(2)) }, [a.stepUp])
  const dirty = sip !== Math.round(input.monthlySip) || Math.abs(stepUpPct - a.stepUp * 100) > 1e-9

  const presets = hasAge ? AGE_PRESETS.filter(p => p > input.age!) : YEAR_PRESETS
  const current = hasAge ? targetAge : targetYears
  const isPreset = presets.includes(current)
  const [custom, setCustom] = useState(isPreset ? '' : String(current))
  useEffect(() => { if (presets.includes(current)) setCustom('') }, [current]) // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (v: number) => (hasAge ? onTargetAge : onTargetYears)(v)
  const onCustom = (text: string) => {
    const t = text.replace(/\D/g, '').slice(0, 2)
    setCustom(t)
    const n = Number(t)
    if (!t) return
    if (hasAge ? n > input.age! && n <= 90 : n >= 1 && n <= 60) pick(n)
  }

  const ret = a.returns[scenario], wr = a.withdrawalRates[scenario]
  const target = fiTargetAt(input.spend, a, wr, targetMonths)
  const rv = useMemo(() => reversePlan({
    portfolio: input.portfolio, monthlySip: sip, stepUp: stepUpPct / 100, annualReturn: ret, months: targetMonths, target,
  }), [input.portfolio, sip, stepUpPct, ret, targetMonths, target])

  const year = yearAt(input.startYear, input.startMonthIndex, targetMonths)
  const byLabel = hasAge ? `age ${targetAge}` : String(year)
  const good = rv.gap >= 0
  const reqRate = rv.requiredSip != null && income > 0 ? (rv.requiredSip / income) * 100 : null
  const mx = Math.max(rv.projected, target, 1)
  const f = (v: number | null) => fmtShort(v, masked)
  const ff = (v: number | null) => fmtFull(v, masked)
  const stepLabel = `${+stepUpPct.toFixed(1)}%`

  const banner = targetMonths <= 0
    ? (good ? 'On track — your portfolio covers the corpus today' : `Short — ${f(-rv.gap)} more needed today`)
    : good ? `On track — ${f(rv.gap)} surplus by ${byLabel}` : `Short — ${f(-rv.gap)} shortfall by ${byLabel}`

  const results = [
    { label: 'Corpus needed', val: f(target), sub: `${f(toTodaysMoney(target, a.inflation, targetMonths))} in today’s money` },
    { label: 'Projected portfolio', val: f(rv.projected), sub: `${ff(sip)}/mo + ${stepLabel}/yr` },
    { label: 'Starting SIP needed', val: rv.requiredSip == null ? 'Out of reach' : rv.requiredSip === 0 ? 'Already enough' : `${ff(rv.requiredSip)}/mo`, sub: `with ${stepLabel} step-up`, tip: TIPS.sipNeed },
    { label: 'Step-up needed', val: rv.requiredStepUp == null ? (sip > 0 ? `Over ${MAX_STEP_UP * 100}%/yr` : 'Needs a SIP') : rv.requiredStepUp === 0 ? 'None' : `${(rv.requiredStepUp * 100).toFixed(1)}%/yr`, sub: `on ${ff(sip)}/mo` },
    { label: 'Savings rate needed', val: reqRate == null ? '—' : `${Math.round(reqRate)}%`, sub: income > 0 ? `of ${ff(income)} income` : 'No income recorded' },
  ]

  return (
    <section id="fire-retire" className="card fire-anchor" style={{ ...CARD, gap: 18 }}>
      <SectionHead title="Retire by a date" kind="projection"
        right={<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 999 }}>What-if · not saved</span>} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{hasAge ? 'Retire by age' : 'Retire in'}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {presets.map(p => {
            const on = p === current && !custom
            return (
              <button key={p} type="button" onClick={() => { setCustom(''); pick(p) }} aria-pressed={on}
                style={{
                  minWidth: 56, minHeight: 44, padding: '0 14px', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums',
                  border: `1.5px solid ${on ? 'var(--brand)' : 'var(--border-strong)'}`, background: on ? 'var(--brand)' : 'var(--surface)', color: on ? '#fff' : 'var(--text)',
                }}>
                {hasAge ? p : `${p} yrs`}
              </button>
            )
          })}
          <label style={{ ...BOX, gap: 6, border: `1.5px solid ${!isPreset ? 'var(--brand)' : 'var(--border-strong)'}` }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Custom</span>
            <input value={custom} onChange={e => onCustom(e.target.value)} inputMode="numeric"
              placeholder={hasAge ? 'Age' : 'Yrs'} aria-label={hasAge ? 'Custom retirement age' : 'Custom years until retirement'}
              style={{ ...BOX_INPUT, width: 44, flex: 'none' }} />
          </label>
        </div>
        {!hasAge && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Add your date of birth under Your numbers to plan by age.</div>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' }}>
        {/* What-if inputs */}
        <div style={{ flex: '1 1 260px', minWidth: 0, background: 'var(--surface-2)', borderRadius: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, minHeight: 28 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Try different numbers</span>
            {dirty && (
              <button type="button" onClick={() => { setSip(Math.round(input.monthlySip)); setStepUpPct(+(a.stepUp * 100).toFixed(2)) }}
                style={{ border: 0, background: 'none', color: 'var(--brand-ink)', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: '6px 0', fontFamily: 'inherit' }}>
                ↺ Back to my numbers
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }}>Starting monthly SIP</span>
            <div style={{ ...BOX, height: 50, padding: '0 14px', gap: 6 }}>
              <span style={{ fontSize: 17, color: 'var(--text-2)', fontWeight: 600 }}>₹</span>
              <input
                value={masked ? '•••••' : Math.round(sip).toLocaleString('en-IN')} readOnly={masked} inputMode="numeric" aria-label="Starting monthly SIP"
                onChange={e => { if (masked) return; const v = e.target.value.replace(/\D/g, ''); setSip(v === '' ? 0 : Math.min(99999999, Number(v))) }}
                style={{ ...BOX_INPUT, fontSize: 19 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {NUDGES.map(d => (
                <button key={d} type="button" onClick={() => setSip(s => Math.max(0, s + d))}
                  style={{ minHeight: 36, padding: '0 10px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' }}>
                  {d > 0 ? '+' : '−'}₹{Math.abs(d) / 1000}k
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }}>
                Annual step-up<span style={{ color: 'var(--text-3)', display: 'inline-flex' }}><Tip tip={TIPS.stepUp} /></span>
              </span>
              <span style={{ fontSize: 19, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{stepLabel}</span>
            </div>
            <input type="range" min={0} max={25} step={0.5} value={Math.min(25, stepUpPct)} onChange={e => setStepUpPct(Number(e.target.value))}
              aria-label="Annual step-up" style={{ width: '100%', accentColor: 'var(--brand)', height: 28, margin: 0 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', font: `500 11px/1 ${MONO}`, color: 'var(--text-3)' }}><span>0%</span><span>25%</span></div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
            Your numbers: {ff(input.monthlySip)} a month, {+(a.stepUp * 100).toFixed(2)}% step-up. Changes here aren’t saved.
          </div>
        </div>

        {/* Results */}
        <div style={{ flex: '1.3 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 14, background: good ? 'var(--good-soft)' : 'var(--warn-soft)', color: good ? 'var(--good-ink)' : 'var(--warn-ink)' }}>
            <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', border: '1.5px solid currentColor', fontSize: 12, fontWeight: 800, flex: 'none' }}>{good ? '✓' : '!'}</span>
            <span style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.35 }}>{banner}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Projected', w: rv.projected, val: f(rv.projected), bg: 'var(--brand)' },
              { label: 'Needed', w: target, val: f(target), bg: 'repeating-linear-gradient(135deg, var(--text-2) 0 2px, transparent 2px 5px)' },
            ].map(b => (
              <div key={b.label} style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr) auto', gap: 10, alignItems: 'center', fontSize: 12.5, color: 'var(--text-2)' }}>
                <span>{b.label}</span>
                <div style={{ height: 10, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(Math.max(0, b.w) / mx) * 100}%`, borderRadius: 999, background: b.bg, transition: 'width .3s ease' }} />
                </div>
                <span style={{ color: 'var(--text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{b.val}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            {results.map(r => (
              <div key={r.label} style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>
                  {r.label}{r.tip && <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}><Tip tip={r.tip} size={13} /></span>}
                </span>
                <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.015em', fontVariantNumeric: 'tabular-nums' }}>{r.val}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{r.sub}</span>
              </div>
            ))}
          </div>
          {reqRate != null && reqRate > 70 && (
            <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 14, background: 'var(--warn-soft)', color: 'var(--warn-ink)', fontSize: 13, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 800 }}>!</span>
              <span>That’s {Math.round(reqRate)}% of your income — very hard to keep up. A later age, a bigger yearly step-up or a leaner retirement budget closes the gap more gently.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
