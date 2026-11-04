'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { SCENARIO_KEYS, type FireAssumptions, type FireResult, type PlanInput, type ScenarioKey } from '@/lib/fire'
import { CARD, fmtFull, fmtShort, KindMark, KindTag, MoneyTag, pct, SCENARIO_META, Tip, TIPS, type TipText } from './shared'

interface HeroProps {
  res: FireResult
  input: PlanInput
  assumptions: FireAssumptions
  scenario: ScenarioKey
  onScenario: (k: ScenarioKey) => void
  masked: boolean
  onEnterSpend: () => void
  onAddDob: () => void
  onSeeRetire: () => void
}

const WHITE_BTN = { minHeight: 44, padding: '0 18px', borderRadius: 12, border: 0, background: '#fff', color: '#14151A', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' } as const

export function FireHero({ res, input, assumptions: a, scenario, onScenario, masked, onEnterSpend, onAddDob, onSeeRetire }: HeroProps) {
  const status = res.status
  const hasAge = input.age != null
  const has = status !== 'no-expenses'
  const progress = Math.max(0, res.progressToday * 100)
  const fiTag = res.retirementYear ? `In ${res.retirementYear} ₹` : 'Future ₹'
  const horizon = hasAge ? 'by age 100' : 'within 70 years'

  return (
    <section id="fire-answer" className="fire-anchor" style={{
      position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-xl)', padding: 'clamp(20px, 3vw, 28px)', color: '#fff',
      background: 'radial-gradient(70% 90% at 100% 0%, rgba(255,255,255,.22), rgba(255,255,255,0) 60%), linear-gradient(155deg, var(--brand-deep) 0%, var(--brand) 62%, var(--brand-2) 100%)',
      boxShadow: '0 16px 40px -16px var(--brand)', display: 'flex', flexDirection: 'column', gap: 22,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span className="serif" style={{ fontStyle: 'italic', fontSize: 22, lineHeight: 1.1 }}>
          {status === 'already' ? 'You can stop working.' : 'When can I stop working?'}
        </span>
        <KindTag kind="projection" color="#fff" />
      </div>

      {status === 'reached' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '20px 32px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Financial independence in</div>
            <div className="display-num" style={{ fontSize: 'clamp(48px, 8vw, 72px)', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1, marginTop: 8 }}>
              {res.years!.toFixed(1)} years
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              {[hasAge && res.retirementAge != null ? `Age ${Math.floor(res.retirementAge)}` : null, `In ${res.retirementYear}`].filter(Boolean).map(c => (
                <span key={c} style={{ padding: '7px 12px', borderRadius: 999, background: 'rgba(255,255,255,.18)', fontSize: 14, fontWeight: 600 }}>{c}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Projected corpus at FI</div>
            <div className="display-num" style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.1 }}>{fmtShort(res.projectedPortfolio, masked)}</div>
            <MoneyTag future text={fiTag} onDark />
          </div>
        </div>
      )}

      {status === 'already' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 620 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff', color: '#14151A', display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 800, flex: 'none' }}>✓</span>
            <div style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.1 }}>You’re financially independent</div>
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.55 }}>
            Your investable portfolio is {progress.toFixed(0)}% of the corpus you’d need today on {SCENARIO_META[scenario].label} assumptions.
            Keep 2–3 years of spending in debt and cash — market falls early in retirement matter most.
          </div>
        </div>
      )}

      {status === 'unreachable' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 620 }}>
          <div style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.1 }}>Not reachable with these numbers</div>
          <div style={{ fontSize: 15, lineHeight: 1.55 }}>
            At this pace your portfolio doesn’t catch up with the rising target {horizon}. That’s about the inputs, not you — a bigger SIP, a yearly step-up or a later date changes it.
          </div>
          <button type="button" onClick={onSeeRetire} style={{ ...WHITE_BTN, alignSelf: 'flex-start' }}>See what it would take →</button>
        </div>
      )}

      {status === 'no-expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 620 }}>
          <div style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.1 }}>Add your spending to see your FI date</div>
          <div style={{ fontSize: 15, lineHeight: 1.55 }}>
            We work out monthly spending from your transactions. Log about a month of them, or enter an estimate now — you can switch to the calculated figure later.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={onEnterSpend} style={WHITE_BTN}>Enter monthly spending</button>
            <Link href="/transactions" style={{ ...WHITE_BTN, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.6)', fontWeight: 600 }}>Add transactions</Link>
          </div>
        </div>
      )}

      {has && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div role="progressbar" aria-valuenow={Math.round(Math.min(100, progress))} aria-valuemin={0} aria-valuemax={100} aria-label="Share of today’s FI corpus"
            style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,.24)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.max(1.5, Math.min(100, progress))}%`, background: '#fff', borderRadius: 999, transition: 'width .5s ease' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 14, fontWeight: 500 }}>
            <span>{fmtShort(Math.max(0, input.portfolio), masked)} of {fmtShort(res.targetToday, masked)} needed today · {progress.toFixed(1)}%</span>
            <span style={{ display: 'inline-flex' }}><Tip tip={TIPS.progress} /></span>
            <MoneyTag onDark />
          </div>
        </div>
      )}

      {input.portfolio < 0 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 14, background: 'rgba(0,0,0,.18)', fontSize: 13.5, lineHeight: 1.5 }}>
          <span style={{ fontWeight: 800 }}>!</span>
          <span>Loans are larger than your investments by {fmtShort(-input.portfolio, masked)}. The projection starts from ₹0 — paying loans down counts as progress.</span>
        </div>
      )}
      {!hasAge && status === 'reached' && (
        <button type="button" onClick={onAddDob}
          style={{ alignSelf: 'flex-start', display: 'flex', gap: 8, alignItems: 'center', minHeight: 36, padding: '0 12px', borderRadius: 999, border: 0, background: 'rgba(0,0,0,.18)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Add date of birth to see ages →
        </button>
      )}

      {has && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div role="radiogroup" aria-label="Scenario" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 14, background: 'rgba(0,0,0,.18)' }}>
            {SCENARIO_KEYS.map(k => (
              <button key={k} type="button" role="radio" aria-checked={k === scenario} onClick={() => onScenario(k)}
                style={{
                  border: 0, cursor: 'pointer', minHeight: 40, padding: '0 clamp(10px, 2vw, 16px)', borderRadius: 10, fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
                  background: k === scenario ? '#fff' : 'transparent', color: k === scenario ? '#14151A' : '#fff',
                }}>
                {SCENARIO_META[k].label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: "500 12px/1.4 'Geist Mono', monospace" }}>
            <KindMark kind="assumption" />
            {pct(a.returns[scenario])} return · {pct(a.withdrawalRates[scenario])} withdrawal · {pct(a.inflation)} inflation
          </div>
        </div>
      )}
    </section>
  )
}

// ── Key numbers ───────────────────────────────────────────────────────────────

export function KeyNumbers({ res, input, netWorth, income, masked }: { res: FireResult; input: PlanInput; netWorth: number; income: number; masked: boolean }) {
  const annual = input.spend.monthly * 12
  const items: { label: string; tip: TipText; val: string; tag: ReactNode; sub: string }[] = [
    { label: 'FI corpus needed today', tip: TIPS.corpus, val: fmtShort(res.targetToday, masked), tag: <MoneyTag />,
      sub: annual > 0 ? `${(res.targetToday / annual).toFixed(1)}× a year’s spending` : '' },
    { label: 'FI target at FI date', tip: TIPS.money, val: res.status === 'reached' ? fmtShort(res.futureCorpus, masked) : '—',
      tag: <MoneyTag future text={res.retirementYear ? `In ${res.retirementYear} ₹` : undefined} />,
      sub: res.status === 'reached' ? `What ${fmtShort(res.targetToday, masked)} becomes by ${res.retirementYear}` : res.status === 'already' ? 'Already reached' : 'No FI date at this pace' },
    { label: 'Investable portfolio now', tip: TIPS.portfolio, val: fmtShort(input.portfolio, masked), tag: <KindTag kind="actual" />, sub: `Net worth ${fmtShort(netWorth, masked)}` },
    { label: 'Monthly investment', tip: TIPS.savings, val: fmtFull(input.monthlySip, masked), tag: <KindTag kind="actual" />,
      sub: income > 0 ? `${Math.round((input.monthlySip / income) * 100)}% of income` : 'No income recorded' },
  ]
  return (
    <section className="card" style={{ ...CARD, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 20 }}>
      {items.map(k => (
        <div key={k.label} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-2)', fontWeight: 500 }}>
            {k.label}<span style={{ color: 'var(--text-3)', display: 'inline-flex' }}><Tip tip={k.tip} /></span>
          </div>
          <div className="display-num" style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.025em' }}>{k.val}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{k.tag}</div>
          {k.sub && <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{k.sub}</div>}
        </div>
      ))}
    </section>
  )
}
