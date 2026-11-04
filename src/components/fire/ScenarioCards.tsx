'use client'

import { SCENARIO_KEYS, type FireAssumptions, type FireResult, type ReverseResult, type ScenarioKey } from '@/lib/fire'
import { CARD, fmtFull, fmtShort, KindMark, pct, SCENARIO_META, SectionHead } from './shared'

interface Props {
  results: Record<ScenarioKey, FireResult>
  required: Record<ScenarioKey, ReverseResult>
  assumptions: FireAssumptions
  /** e.g. "age 45" or "2041" */
  targetLabel: string
  annualSpend: number
  hasAge: boolean
  masked: boolean
  selected: ScenarioKey
  onSelect: (k: ScenarioKey) => void
}

export default function ScenarioCards({ results, required, assumptions: a, targetLabel, annualSpend, hasAge, masked, selected, onSelect }: Props) {
  const f = (v: number | null) => fmtShort(v, masked)
  const ff = (v: number | null) => fmtFull(v, masked)

  const cards = SCENARIO_KEYS.map(k => {
    const r = results[k], req = required[k], m = SCENARIO_META[k]
    const ok = r.status === 'reached'
    const mult = annualSpend > 0 ? `${(r.targetToday / annualSpend).toFixed(1)}×` : '—'
    const when = ok
      ? [hasAge && r.retirementAge != null ? `age ${Math.floor(r.retirementAge)}` : null, r.retirementYear].filter(Boolean).join(' · ')
      : r.status === 'already' ? 'Portfolio covers the corpus' : `${hasAge ? 'by age 100' : 'within 70 years'} at this pace`
    return {
      k, m, r, sel: k === selected,
      assume: `${pct(a.returns[k])} return · ${pct(a.withdrawalRates[k])} withdrawal`,
      assumeShort: `${+(a.returns[k] * 100).toFixed(2)} / ${pct(a.withdrawalRates[k])}`,
      years: r.status === 'already' ? 'Already FI' : ok ? `${r.years!.toFixed(1)} yrs` : 'Not reachable',
      yearsShort: r.status === 'already' ? 'Now' : ok ? r.years!.toFixed(1) : '—',
      when,
      whenShort: ok ? (hasAge && r.retirementAge != null ? `age ${Math.floor(r.retirementAge)}` : String(r.retirementYear)) : r.status === 'already' ? 'today' : 'not reached',
      rows: [
        { label: 'Corpus needed · today’s ₹', short: 'Corpus today', val: `${f(r.targetToday)} · ${mult}`, valShort: f(r.targetToday) },
        { label: 'Corpus at FI', short: 'Corpus at FI', val: ok ? f(r.futureCorpus) : '—' },
        { label: 'Portfolio at FI', short: 'Portfolio at FI', val: ok ? f(r.projectedPortfolio) : '—' },
        { label: 'Monthly SIP at FI', short: 'SIP at FI', val: ok ? ff(r.sipAtRetirement) : '—' },
        { label: 'Total invested', short: 'Total invested', val: ok ? f(r.totalInvested) : '—' },
        { label: 'Growth from returns', short: 'Growth', val: ok ? f(r.gains) : '—' },
      ],
      need: req.requiredSip == null ? 'Out of reach' : req.requiredSip === 0 ? 'Already enough' : `${ff(req.requiredSip)}/mo`,
      needShort: req.requiredSip == null ? '—' : req.requiredSip === 0 ? 'Enough' : ff(req.requiredSip),
    }
  })
  const stepUp = pct(a.stepUp)

  return (
    <section id="fire-compare" className="card fire-anchor" style={CARD}>
      <SectionHead title="Compare scenarios" kind="projection" right={<span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Tap a scenario to make it your headline</span>} />

      {/* Desktop: three cards */}
      <div className="fire-desk" style={{ flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          {cards.map(c => (
            <button key={c.k} type="button" onClick={() => onSelect(c.k)} aria-pressed={c.sel}
              style={{
                textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)', minWidth: 0,
                background: c.sel ? 'var(--brand-soft)' : 'var(--surface)', border: `1.5px solid ${c.sel ? 'var(--brand)' : 'var(--border)'}`,
                borderRadius: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 14, transition: 'background .15s ease, border-color .15s ease',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, width: '100%', minHeight: 24 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 18, height: c.sel ? 4 : 3, borderRadius: 2, background: c.m.color }} />
                  <span style={{ fontSize: 14.5, fontWeight: 700 }}>{c.m.label}</span>
                </span>
                {c.sel && <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--brand-ink)', background: 'var(--surface)', padding: '4px 8px', borderRadius: 999 }}>✓ Selected</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: "500 12px/1 'Geist Mono', monospace", color: 'var(--text-2)' }}>
                <KindMark kind="assumption" size={6} />{c.assume}
              </div>
              <div>
                <div className="display-num" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.1 }}>{c.years}</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>{c.when}</div>
              </div>
              <div style={{ height: 1, background: 'var(--border)', width: '100%' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                {c.rows.map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{r.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{r.val}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: c.sel ? 'var(--surface)' : 'var(--surface-2)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 4, width: '100%', boxSizing: 'border-box' }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>SIP to retire by {targetLabel}</span>
                <span className="display-num" style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>{c.need}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>starting now, +{stepUp} a year</span>
              </div>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          Corpus needed is in today’s ₹. Everything at the FI date is in future ₹ for that scenario’s year. Total invested is today’s portfolio plus every SIP until FI.
        </div>
      </div>

      {/* Phone: a compact table */}
      <div className="fire-mob" style={{ flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) repeat(3, minmax(0, 1fr))', columnGap: 4, fontSize: 12.5 }}>
          <div />
          {cards.map(c => (
            <button key={c.k} type="button" onClick={() => onSelect(c.k)} aria-pressed={c.sel}
              style={{
                cursor: 'pointer', minHeight: 56, border: `1.5px solid ${c.sel ? 'var(--brand)' : 'var(--border)'}`, background: c.sel ? 'var(--brand-soft)' : 'var(--surface)',
                borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 2px', color: 'var(--text)', fontFamily: 'inherit',
              }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 700 }}>
                <span style={{ width: 10, height: c.sel ? 4 : 3, borderRadius: 2, background: c.m.color }} />{c.m.short}
              </span>
              <span style={{ font: "500 10.5px/1 'Geist Mono', monospace", color: 'var(--text-2)' }}>{c.assumeShort}</span>
            </button>
          ))}
          <div style={{ padding: '12px 0 10px', color: 'var(--text-2)', fontWeight: 600 }}>Years to FI</div>
          {cards.map(c => (
            <div key={c.k} style={{ padding: '12px 0 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{c.yearsShort}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.whenShort}</div>
            </div>
          ))}
          {cards[0].rows.map((row, ri) => (
            <Row key={row.short} label={row.short} vals={cards.map(c => ({ text: ri === 0 ? c.rows[0].valShort! : c.rows[ri].val, sel: c.sel }))} />
          ))}
          <Row bold label={`SIP to retire by ${targetLabel.replace(/^age /, '')}`} vals={cards.map(c => ({ text: c.needShort, sel: c.sel }))} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Corpus in today’s ₹; values at FI in future ₹.</div>
      </div>
    </section>
  )
}

function Row({ label, vals, bold }: { label: string; vals: { text: string; sel: boolean }[]; bold?: boolean }) {
  const fw = bold ? 700 : 500
  return (
    <>
      <div style={{ padding: '10px 0', borderTop: '1px solid var(--border)', color: 'var(--text-2)', fontWeight: fw }}>{label}</div>
      {vals.map((v, i) => (
        <div key={i} style={{ padding: '10px 2px', borderTop: '1px solid var(--border)', textAlign: 'center', fontWeight: fw, fontVariantNumeric: 'tabular-nums', background: v.sel ? 'var(--brand-soft)' : 'transparent', overflowWrap: 'anywhere' }}>
          {v.text}
        </div>
      ))}
    </>
  )
}
