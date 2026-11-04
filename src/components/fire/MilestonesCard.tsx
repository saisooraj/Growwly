'use client'

import { fiTargetAt, type FireAssumptions, type FireResult, type PlanInput, type ScenarioKey } from '@/lib/fire'
import { CARD, fmtShort, fmtYears, SCENARIO_META, SectionHead } from './shared'

interface Props {
  res: FireResult
  input: PlanInput
  assumptions: FireAssumptions
  scenario: ScenarioKey
  masked: boolean
}

export default function MilestonesCard({ res, input, assumptions: a, scenario, masked }: Props) {
  const hasAge = input.age != null
  const wr = a.withdrawalRates[scenario]
  return (
    <section id="fire-milestones" className="card fire-anchor" style={{ ...CARD, gap: 14 }}>
      <SectionHead title="Milestones" kind="projection"
        right={<span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Share of your FI target · {SCENARIO_META[scenario].label}</span>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {res.milestones.map(ms => {
          const p = `${ms.fraction * 100}%`
          const reached = ms.months === 0
          const when = reached ? 'Reached'
            : ms.months == null ? 'Not reached'
            : [hasAge && ms.age != null ? `Age ${Math.floor(ms.age)}` : null, ms.year].filter(Boolean).join(' · ')
          const sub = reached
            ? `${fmtShort(ms.fraction * res.targetToday, masked)} in today’s ₹`
            : ms.months == null ? `Not reached ${hasAge ? 'by age 100' : 'within 70 years'} at this pace`
            : `in ${fmtYears(ms.months / 12)} · ${fmtShort(ms.fraction * fiTargetAt(input.spend, a, wr, ms.months), masked)}`
          return (
            <div key={ms.fraction} style={{ borderRadius: 18, padding: 14, background: reached ? 'var(--surface-2)' : 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 }}>
                <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{p}</span>
                {reached && <span aria-label="Reached" style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--good-ink)', color: 'var(--surface)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800 }}>✓</span>}
              </div>
              <div style={{ height: 4, borderRadius: 999, background: 'var(--surface-3)' }}>
                <div style={{ width: p, height: '100%', borderRadius: 999, background: 'var(--brand)' }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{when}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.4 }}>{sub}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
