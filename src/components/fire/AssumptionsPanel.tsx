'use client'

import type { ReactNode } from 'react'
import AmountInput from '@/components/ui/AmountInput'
import { DEFAULT_ASSUMPTIONS_PCT as D } from '@/lib/fireDefaults'
import { corpusMultiple, SCENARIO_KEYS, type ScenarioKey } from '@/lib/fire'
import type { FireSettings } from '@/types'
import { BOX, BOX_INPUT, Collapsible, KindTag, MONO, NumField, SCENARIO_META, Tip, TIPS, type TipText } from './shared'

interface Props {
  draft: FireSettings
  update: (patch: Partial<FireSettings>) => void
  masked: boolean
  open: boolean
  onToggle: () => void
}

const KEYS = ['inflation', 'stepUp', 'withdrawalTax', 'healthcareMonthly', 'healthcareInflation', 'returns', 'withdrawalRates'] as const

export default function AssumptionsPanel({ draft, update, masked, open, onToggle }: Props) {
  const returns = draft.returns ?? D.returns
  const wrs = draft.withdrawalRates ?? D.withdrawalRates
  const inflation = draft.inflation ?? D.inflation
  const stepUp = draft.stepUp ?? D.stepUp
  const tax = draft.withdrawalTax ?? D.withdrawalTax
  const isDefault = KEYS.every(k => draft[k] === undefined)

  const setReturn = (k: ScenarioKey, v: number | null) => update({ returns: { ...returns, [k]: v ?? D.returns[k] } })
  const setWr = (k: ScenarioKey, v: number | null) => update({ withdrawalRates: { ...wrs, [k]: v ?? D.withdrawalRates[k] } })

  return (
    <Collapsible
      open={open} onToggle={onToggle} title="Assumptions" tag={<KindTag kind="assumption" />}
      sub={<span style={{ font: `500 11.5px/1.3 ${MONO}` }}>{inflation}% inflation · {stepUp}% step-up · {tax}% tax</span>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Inflation" tip={TIPS.inflation}>
            <NumField ariaLabel="Inflation" value={inflation} min={0} max={20} unit="%/yr" onChange={v => update({ inflation: v ?? undefined })} />
          </Field>
          <Field label="SIP step-up" tip={TIPS.stepUp}>
            <NumField ariaLabel="SIP step-up" value={stepUp} min={0} max={50} unit="%/yr" onChange={v => update({ stepUp: v ?? undefined })} />
          </Field>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) 72px 72px', gap: 8, padding: '8px 12px', background: 'var(--surface-2)', fontSize: 11.5, color: 'var(--text-2)', fontWeight: 600, alignItems: 'center' }}>
            <span>Scenario</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: 'var(--text-2)' }}>Return<span style={{ color: 'var(--text-3)', display: 'inline-flex' }}><Tip tip={TIPS.real} size={13} /></span></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: 'var(--text-2)' }}>Withdr.<span style={{ color: 'var(--text-3)', display: 'inline-flex' }}><Tip tip={TIPS.withdrawalRate} size={13} /></span></span>
          </div>
          {SCENARIO_KEYS.map(k => (
            <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) 72px 72px', gap: 8, padding: '8px 12px', borderTop: '1px solid var(--border)', alignItems: 'center' }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
                  <span style={{ width: 10, height: 3, borderRadius: 2, background: SCENARIO_META[k].color }} />{SCENARIO_META[k].label}
                </span>
                <span style={{ font: `500 10.5px/1.2 ${MONO}`, color: 'var(--text-3)' }}>
                  {corpusMultiple(wrs[k] / 100, tax / 100).toFixed(1)}× · ≈{((1 + returns[k] / 100) / (1 + inflation / 100) * 100 - 100).toFixed(1)}% real
                </span>
              </span>
              <NumField ariaLabel={`${SCENARIO_META[k].label} return`} value={returns[k]} min={0} max={30} unit="%" height={40} onChange={v => setReturn(k, v)} />
              <NumField ariaLabel={`${SCENARIO_META[k].label} withdrawal rate`} value={wrs[k]} min={0.5} max={10} unit="%" height={40} onChange={v => setWr(k, v)} />
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Tax on withdrawals" tip={TIPS.tax}>
            <NumField ariaLabel="Tax on withdrawals" value={tax} min={0} max={50} unit="%" onChange={v => update({ withdrawalTax: v ?? undefined })} />
          </Field>
          <Field label="Healthcare inflation" tip={TIPS.healthInflation}>
            <NumField ariaLabel="Healthcare inflation" value={draft.healthcareInflation ?? null} placeholder="Same" min={0} max={25} unit="%/yr"
              onChange={v => update({ healthcareInflation: v })} />
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Extra retirement healthcare" tip={TIPS.healthcare}>
              <span style={BOX}>
                {masked
                  ? <input readOnly value="•••••" aria-label="Extra healthcare per month" style={BOX_INPUT} />
                  : <AmountInput aria-label="Extra healthcare per month" placeholder="0"
                      value={draft.healthcareMonthly ? String(draft.healthcareMonthly) : ''}
                      onValueChange={raw => update({ healthcareMonthly: raw === '' ? undefined : Math.max(0, Math.round(Number(raw) || 0)) })}
                      style={BOX_INPUT} />}
                <span style={{ color: 'var(--text-3)', fontSize: 12.5, whiteSpace: 'nowrap' }}>₹/month</span>
              </span>
            </Field>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.45 }}>
          <span>
            Returns are nominal, before inflation. Defaults: {D.inflation}% inflation, {D.stepUp}% step-up, {D.returns.conservative}/{D.returns.moderate}/{D.returns.optimistic}% returns,
            {' '}{D.withdrawalRates.conservative}/{D.withdrawalRates.moderate}/{D.withdrawalRates.optimistic}% withdrawal, {D.withdrawalTax}% tax.
          </span>
          <button type="button" disabled={isDefault}
            onClick={() => update({ inflation: undefined, stepUp: undefined, withdrawalTax: undefined, healthcareMonthly: undefined, healthcareInflation: undefined, returns: undefined, withdrawalRates: undefined })}
            style={{ flex: 'none', minHeight: 36, padding: '0 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5, fontWeight: 700, cursor: isDefault ? 'default' : 'pointer', opacity: isDefault ? 0.5 : 1, fontFamily: 'inherit' }}>
            Reset to defaults
          </button>
        </div>
      </div>
    </Collapsible>
  )
}

function Field({ label, tip, children }: { label: string; tip?: TipText; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600, minHeight: 18 }}>
        {label}{tip && <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}><Tip tip={tip} /></span>}
      </span>
      {children}
    </div>
  )
}
