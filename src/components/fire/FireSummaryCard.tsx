'use client'

import Link from 'next/link'
import MaskToggle from '@/components/networth/MaskToggle'
import { DEFAULT_ASSUMPTIONS_PCT } from '@/lib/fireDefaults'
import { fiTargetAt, reversePlan, yearAt, type ScenarioKey } from '@/lib/fire'
import type { FirePlan } from '@/hooks/useFirePlan'
import { fmtShort, KindTag, MONO, MoneyTag, pct, SCENARIO_META } from './shared'

interface Props {
  plan: FirePlan
  scenario: ScenarioKey
  targetRetirementAge?: number
  targetYears?: number
  masked: boolean
  onToggleMask: () => void
}

/** "Financially independent at 44 · 2043" — the one-line answer for the Net Worth hero. */
export function fireStripText(plan: FirePlan, scenario: ScenarioKey): string {
  const r = plan.results[scenario]
  if (r.status === 'reached') {
    return plan.input.age != null && r.retirementAge != null
      ? `Financially independent at ${Math.floor(r.retirementAge)} · ${r.retirementYear}`
      : `Financially independent by ${r.retirementYear}`
  }
  if (r.status === 'already') return 'You’re financially independent'
  if (r.status === 'unreachable') return 'See what it would take to stop working'
  return 'Find out when you can stop working'
}

/** Compact FIRE summary for the Net Worth page; the full planner lives at /networth/fire. */
export default function FireSummaryCard({ plan, scenario, targetRetirementAge, targetYears, masked, onToggleMask }: Props) {
  const { results, input, assumptions: a } = plan
  const r = results[scenario]
  const hasAge = input.age != null
  const progress = Math.max(0, r.progressToday * 100)

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

  const shortTitle = r.status === 'already' ? 'You’re financially independent'
    : r.status === 'unreachable' ? 'Not reachable with these numbers'
    : 'Add spending to see your FI date'

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>FIRE planner</h2>
          <KindTag kind="projection" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ font: `500 12px/1 ${MONO}`, color: 'var(--text-2)' }}>
            {SCENARIO_META[scenario].label} · {pct(a.returns[scenario])} / {pct(a.withdrawalRates[scenario])}
          </span>
          <MaskToggle masked={masked} onToggle={onToggleMask} />
        </div>
      </div>

      {r.status === 'reached' ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Financial independence in</div>
            <div className="display-num" style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.1, color: 'var(--text)' }}>{r.years!.toFixed(1)} years</div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 2 }}>
              {hasAge && r.retirementAge != null ? `at age ${Math.floor(r.retirementAge)} · in ${r.retirementYear}` : `in ${r.retirementYear}`}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Projected corpus</div>
            <div className="display-num" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>{fmtShort(r.projectedPortfolio, masked)}</div>
            <MoneyTag future text={`In ${r.retirementYear} ₹`} />
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>{shortTitle}</div>
      )}

      {r.status !== 'no-expenses' && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(1.5, Math.min(100, progress))}%`, background: 'var(--brand)', borderRadius: 999, transition: 'width .6s ease' }} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
              {fmtShort(Math.max(0, input.portfolio), masked)} of {fmtShort(r.targetToday, masked)} needed today · {progress.toFixed(1)}%
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: good ? 'var(--good-soft)' : 'var(--warn-soft)', color: good ? 'var(--good-ink)' : 'var(--warn-ink)', fontSize: 13.5, fontWeight: 600 }}>
            <span style={{ fontWeight: 800 }}>{good ? '✓' : '!'}</span>
            {good ? `On track — ${fmtShort(rv.gap, masked)} surplus by ${byLabel}` : `Short — ${fmtShort(-rv.gap, masked)} shortfall by ${byLabel}`}
          </div>
        </>
      )}

      <Link href="/networth/fire" className="pressable"
        style={{ minHeight: 48, borderRadius: 14, background: 'var(--brand)', color: '#fff', fontSize: 14.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }}>
        Open FIRE planner →
      </Link>
    </div>
  )
}
