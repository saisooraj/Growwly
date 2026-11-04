'use client'

import { ALLOC_CLASSES, type AllocClass } from '@/lib/fireInputs'
import { CARD, fmtShort, KindMark, NumField, SectionHead } from './shared'

type Target = { equity: number; debt: number; cash: number; other: number }

interface Props {
  allocation: Record<AllocClass, number>
  /** Emergency fund included in allocation.cash */
  ef: number
  /** Whether the emergency fund also counts toward the FI portfolio */
  efCounted: boolean
  target: Target
  onTarget: (t: Target) => void
  masked: boolean
}

const CLASS_META: Record<AllocClass, { label: string; color: string; note: string }> = {
  equity: { label: 'Equity', color: 'var(--fire-c2)', note: 'Funds, stocks, NPS equity' },
  debt:   { label: 'Debt',   color: 'var(--fire-c1)', note: 'EPF, PPF, deposits, debt funds' },
  cash:   { label: 'Cash',   color: 'var(--fire-c0)', note: 'Savings accounts' },
  gold:   { label: 'Gold',   color: 'var(--text-3)', note: 'Gold and gold funds' },
  other:  { label: 'Other',  color: 'var(--border-strong)', note: 'Property, other assets' },
}

const MIX: { key: keyof Target; label: string }[] = [
  { key: 'equity', label: 'Equity' }, { key: 'debt', label: 'Debt' }, { key: 'cash', label: 'Cash' }, { key: 'other', label: 'Gold & other' },
]

export default function AllocationCard({ allocation, ef, efCounted, target, onTarget, masked }: Props) {
  const total = ALLOC_CLASSES.reduce((s, k) => s + allocation[k], 0)
  const share = (k: AllocClass) => (total > 0 ? (allocation[k] / total) * 100 : 0)
  const nowPct: Target = { equity: share('equity'), debt: share('debt'), cash: share('cash'), other: share('gold') + share('other') }
  const sum = Math.round((target.equity + target.debt + target.cash + target.other) * 10) / 10
  const sumOk = Math.abs(sum - 100) < 0.01

  return (
    <section id="fire-allocation" className="card fire-anchor" style={CARD}>
      <SectionHead title="Asset allocation" kind="actual"
        right={<span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{fmtShort(total, masked)} in holdings and cash</span>} />

      {total > 0 ? (
        <>
          <div role="img" aria-label={ALLOC_CLASSES.filter(k => allocation[k] > 0).map(k => `${CLASS_META[k].label} ${share(k).toFixed(0)}%`).join(', ')}
            style={{ display: 'flex', height: 14, gap: 2, borderRadius: 8, overflow: 'hidden' }}>
            {ALLOC_CLASSES.filter(k => allocation[k] > 0).map(k => (
              <div key={k} style={{ flexGrow: allocation[k], flexBasis: 0, background: CLASS_META[k].color }} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(108px, 1fr))', gap: 8 }}>
            {ALLOC_CLASSES.map(k => (
              <div key={k} style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-2)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: CLASS_META[k].color, flex: 'none' }} />{CLASS_META[k].label}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{Math.round(share(k))}%</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>{fmtShort(allocation[k], masked)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.35 }}>
                  {k === 'cash' && ef > 0
                    ? `incl. ${fmtShort(ef, masked)} emergency fund${efCounted ? '' : ' (not counted toward FI)'}`
                    : CLASS_META[k].note}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Add holdings on the Net Worth page to see your allocation.</p>
      )}

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14.5, fontWeight: 700 }}>Target mix</span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Optional</span>
          <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, color: sumOk ? 'var(--good-ink)' : 'var(--warn-ink)' }}>
            {sumOk ? '✓ Adds to 100%' : `Adds to ${sum}% — must add to 100%`}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 10 }}>
          {MIX.map(m => {
            const d = Math.round(target[m.key] - nowPct[m.key])
            return (
              <div key={m.key} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{m.label}</span>
                <NumField ariaLabel={`${m.label} target`} value={target[m.key]} min={0} max={100} unit="%"
                  onChange={v => onTarget({ ...target, [m.key]: v ?? 0 })} />
                {total > 0 && (
                  <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                    Now {Math.round(nowPct[m.key])}% · {d === 0 ? 'on target' : `${d > 0 ? '+' : '−'}${Math.abs(d)} pts`}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', background: 'var(--surface-2)', borderRadius: 18, padding: 16 }}>
        <div style={{ flex: '2 1 280px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Moving toward retirement</span>
          <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>
            A big market fall just before or after you stop working hurts most, because you’d be selling low to live. Many people slowly shift new money into
            debt and cash over the last 5–10 years before FI, until 1–3 years of spending sit outside equity to draw on while markets recover.
            How much depends on your other income and how flexible your spending is.
          </span>
        </div>
        <div style={{ flex: '1 1 180px', display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text)', lineHeight: 1.5, fontWeight: 600 }}>
          <span style={{ color: 'var(--text-2)', marginTop: 6, display: 'inline-flex' }}><KindMark kind="assumption" /></span>
          The planner never moves money. It’s a guide for your own rebalancing, not advice.
        </div>
      </div>
    </section>
  )
}
