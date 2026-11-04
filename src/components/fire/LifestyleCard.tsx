'use client'

import AmountInput from '@/components/ui/AmountInput'
import { coastNumber, type FireResult } from '@/lib/fire'
import { BOX, BOX_INPUT, CARD, fmtFull, fmtShort, fmtYears, SectionHead, Tip, TIPS } from './shared'

type LifestyleKey = 'lean' | 'regular' | 'fat'

interface Props {
  lifestyles: { key: LifestyleKey; monthly: number | null; result: FireResult | null }[]
  masked: boolean
  hasAge: boolean
  onBudget: (key: 'lean' | 'fat', v: number | null) => void
  coast: { months: number; label: string; year: number; portfolio: number; target: number; annualReturn: number }
}

const META: Record<LifestyleKey, { label: string; hint: string; placeholder?: string }> = {
  lean:    { label: 'Lean FIRE',    hint: 'A simpler life than today', placeholder: 'e.g. 40,000' },
  regular: { label: 'Regular FIRE', hint: 'Keep spending what you do now' },
  fat:     { label: 'Fat FIRE',     hint: 'More travel, more comfort', placeholder: 'e.g. 1,00,000' },
}

export default function LifestyleCard({ lifestyles, masked, hasAge, onBudget, coast }: Props) {
  const coastNeeded = coast.target > 0 ? coastNumber(coast.target, coast.annualReturn, coast.months) : 0
  const coastReached = coast.target > 0 && coast.portfolio >= coastNeeded

  return (
    <section id="fire-lifestyle" className="card fire-anchor" style={{ ...CARD, gap: 6 }}>
      <div style={{ marginBottom: 6 }}><SectionHead title="Retirement lifestyle" kind="projection" tip={TIPS.lifestyle} /></div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {lifestyles.map(l => {
          const m = META[l.key], r = l.result
          return (
            <div key={l.key} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 20px', padding: '14px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>{m.label}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{m.hint}</div>
              </div>
              <div style={{ flex: '0 0 150px' }}>
                {l.key === 'regular' ? (
                  <div style={{ padding: '0 2px' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtFull(l.monthly, masked)}<span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}> /mo</span></div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Your spending now</div>
                  </div>
                ) : (
                  <div style={BOX}>
                    <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>₹</span>
                    {masked
                      ? <input readOnly value="•••••" aria-label={`${m.label} monthly budget`} style={BOX_INPUT} />
                      : <AmountInput aria-label={`${m.label} monthly budget`} placeholder={m.placeholder}
                          value={l.monthly != null ? String(l.monthly) : ''}
                          onValueChange={raw => onBudget(l.key as 'lean' | 'fat', raw === '' ? null : Math.max(0, Math.round(Number(raw) || 0)))}
                          style={BOX_INPUT} />}
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>/mo</span>
                  </div>
                )}
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Corpus · today’s ₹</div>
                <div style={{ fontSize: 15.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r ? fmtShort(r.targetToday, masked) : '—'}</div>
              </div>
              <div style={{ flex: '1 1 110px' }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Time to FI</div>
                <div style={{ fontSize: 15.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {!r ? '—' : r.status === 'already' ? 'Already FI' : r.status === 'reached' ? fmtYears(r.years) : 'Not reachable'}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
                  {!r ? (l.key === 'regular' ? 'Add your spending' : 'Type a budget')
                    : r.status === 'reached' ? [hasAge && r.retirementAge != null ? `age ${Math.floor(r.retirementAge)}` : null, r.retirementYear].filter(Boolean).join(' · ')
                    : r.status === 'already' ? 'today' : hasAge ? 'by age 100' : 'within 70 years'}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ background: 'var(--surface-2)', borderRadius: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14.5, fontWeight: 700 }}>Coast FIRE by {coast.label}</span>
          <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}><Tip tip={TIPS.coast} /></span>
        </div>
        {coast.target > 0 ? (
          <>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-2)' }}>
              Invested today to coast: <strong style={{ color: 'var(--text)' }}>{fmtShort(coastNeeded, masked)}</strong> → grows to{' '}
              <strong style={{ color: 'var(--text)' }}>{fmtShort(coast.target, masked)}</strong> by {coast.year} with no new money.
            </div>
            <span style={{
              alignSelf: 'flex-start', padding: '6px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700,
              background: coastReached ? 'var(--good-soft)' : 'var(--surface)', color: coastReached ? 'var(--good-ink)' : 'var(--text)',
            }}>
              {coastReached ? '✓ You’ve reached Coast FI' : `${fmtShort(coastNeeded - Math.max(0, coast.portfolio), masked)} more needed today`}
            </span>
          </>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Add your spending to calculate.</div>
        )}
        <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>The date follows your choice in Retire by a date. Lifestyle budgets include any retirement healthcare you’ve set in Assumptions.</div>
      </div>
    </section>
  )
}
