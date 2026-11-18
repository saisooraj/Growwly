'use client'

import Link from 'next/link'
import { DEFAULT_ASSUMPTIONS_PCT } from '@/lib/fireDefaults'
import { fiTargetAt, reversePlan, yearAt, type ScenarioKey } from '@/lib/fire'
import type { FirePlan } from '@/hooks/useFirePlan'
import { CARD, cpt } from '@/components/networth/nwUi'
import { pct, SCENARIO_META } from './shared'

interface Props {
  plan: FirePlan
  scenario: ScenarioKey
  targetRetirementAge?: number
  targetYears?: number
  masked: boolean
}

/** Compact FIRE card for the Net Worth page; the full planner lives at /networth/fire. */
export default function FireSummaryCard({ plan, scenario, targetRetirementAge, targetYears, masked }: Props) {
  const { results, input, assumptions: a } = plan
  const r = results[scenario]
  const hasAge = input.age != null
  const progress = Math.max(0, r.progressToday * 100)
  const M = (s: string) => masked ? '' : s

  // "Retire by" check, using the same target date the planner uses
  const tAge = targetRetirementAge ?? (hasAge && input.age! >= DEFAULT_ASSUMPTIONS_PCT.targetRetirementAge ? Math.ceil(input.age!) + 5 : DEFAULT_ASSUMPTIONS_PCT.targetRetirementAge)
  const tYears = targetYears ?? DEFAULT_ASSUMPTIONS_PCT.targetYears
  const months = hasAge ? Math.max(0, Math.round((tAge - input.age!) * 12)) : tYears * 12
  const byLabel = hasAge ? `age ${tAge}` : String(yearAt(input.startYear, input.startMonthIndex, months))
  const rv = reversePlan({
    portfolio: input.portfolio, monthlySip: input.monthlySip, stepUp: a.stepUp, annualReturn: a.returns[scenario], months,
    target: fiTargetAt(input.spend, a, a.withdrawalRates[scenario], months),
  })
  const good = rv.gap >= 0
  const scen = SCENARIO_META[scenario].label.toUpperCase()
  const wr = pct(a.withdrawalRates[scenario])
  const have = Math.max(0, input.portfolio)

  const v = r.status === 'reached' ? {
    rates: `${scen} · ${pct(a.returns[scenario])} RETURN · ${wr} WITHDRAWAL`,
    head: hasAge && r.retirementAge != null ? `Independent at ${Math.floor(r.retirementAge)}` : `Independent by ${r.retirementYear}`,
    sub: `In ${r.years!.toFixed(1)} years · ${r.retirementYear}`,
    cta: 'Open FIRE planner',
  } : r.status === 'already' ? {
    rates: `${scen} · ${wr} WITHDRAWAL`,
    head: 'You’re financially independent',
    sub: `What you have covers your yearly spending at a ${wr} withdrawal rate.`,
    cta: 'Open FIRE planner',
  } : r.status === 'unreachable' ? {
    rates: `${scen} · ${pct(a.returns[scenario])} RETURN · ${wr} WITHDRAWAL`,
    head: hasAge ? `Not reachable by ${Math.floor(input.age! + input.horizonMonths / 12)} yet` : 'Not reachable with these numbers',
    sub: 'See what it would take to stop working.',
    cta: 'See what it would take',
  } : {
    rates: 'NEEDS SPENDING DATA',
    head: 'When can you stop working?',
    sub: 'Log a month of spending and we can work it out.',
    cta: 'Find out when you can stop working',
  }

  const showProg = r.status !== 'no-expenses'
  const progS = masked
    ? `${progress.toFixed(1)}% of what you need${r.status === 'already' ? '' : ' today'}`
    : `${cpt(have)} of ${cpt(r.targetToday)} needed${r.status === 'already' ? '' : ' today'} · ${progress.toFixed(1)}%`
  const status = r.status === 'already'
    ? { ok: true, text: masked ? 'Covered with room to spare' : `Covered — ${cpt(have - r.targetToday)} above target` }
    : { ok: good, text: good ? `On track — ${M(`${cpt(rv.gap)} `)}surplus by ${byLabel}` : `Short — ${M(`${cpt(-rv.gap)} `)}shortfall by ${byLabel}` }

  return (
    <div style={{ ...CARD, position: 'relative', overflow: 'hidden', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span className="nw-mono" style={{ fontSize: 10.5, letterSpacing: '.12em', color: 'var(--brand-ink)' }}>FIRE PLAN</span>
        <span className="nw-mono" style={{ fontSize: 10, color: 'var(--text-3)', padding: '3px 8px', borderRadius: 999, background: 'var(--surface-2)', textAlign: 'right' }}>{v.rates}</span>
      </div>
      <div>
        <div className="nw-serif" style={{ fontSize: 34, lineHeight: 1.02, letterSpacing: '-.01em', textWrap: 'balance' } as React.CSSProperties}>{v.head}</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.4 }}>{v.sub}</div>
      </div>
      {showProg && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-3)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.max(1.5, Math.min(100, progress))}%`, borderRadius: 4, background: 'linear-gradient(90deg, var(--brand-deep), var(--brand-2))', transition: 'width .6s ease' }} />
          </div>
          <div className="nw-num" style={{ fontSize: 12, color: 'var(--text-3)' }}>{progS}</div>
        </div>
      )}
      {showProg && (
        <div style={{ padding: '10px 12px', borderRadius: 12, background: status.ok ? 'var(--good-soft)' : 'var(--bad-soft)', color: status.ok ? 'var(--good-ink)' : 'var(--bad-ink)', fontSize: 13, fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span aria-hidden style={{ width: 20, height: 20, borderRadius: '50%', flex: 'none', background: 'currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
            <span style={{ color: 'var(--surface)' }}>{status.ok ? '✓' : '!'}</span>
          </span>
          {status.text}
        </div>
      )}
      <Link href="/networth/fire"
        style={{ height: 42, borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
        {v.cta} →
      </Link>
    </div>
  )
}
