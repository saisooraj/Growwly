'use client'

import { useMemo, useState } from 'react'
import { legacyGoldPurchases } from '@/lib/gold'
import type { AssetWithValue } from '@/lib/assetValuation'
import type { AssetKind } from '@/types'
import { BRAND_BTN, CARD, Chevron, EYEBROW, KIND_LABEL, KIND_ORDER, PILL_BTN, Tap, kindColor, kindTint, maskWith, monogram, pc, rs } from './nwUi'

// ── Per-holding helpers (also used by the holding sheet) ──────────────────────

// What a holding cost: the basis its gain is measured against, or the invested amount on file.
export function investedOf(a: AssetWithValue): number | null {
  if (a.gainPct !== null) return a.currentValue - a.gain
  return a.investedAmount && a.investedAmount > 0 ? a.investedAmount : null
}

function goldKarat(a: AssetWithValue): string {
  const karats = Array.from(new Set(legacyGoldPurchases(a).map(p => p.karat)))
  return karats.length === 1 ? `${karats[0]}K` : karats.length > 1 ? 'Au' : `${a.karat ?? 22}K`
}

export const holdingMono = (a: AssetWithValue) => a.kind === 'gold_grams' ? goldKarat(a) : monogram(a.name || KIND_LABEL[a.kind])
export const holdingName = (a: AssetWithValue) => a.name || (a.kind === 'gold_grams' ? `${goldKarat(a)} Gold` : a.ticker ?? a.schemeCode ?? KIND_LABEL[a.kind])

/** "8,412.306 units · invested ₹5,20,000" */
export function holdingDetail(a: AssetWithValue): string {
  const deposits = a.ppfDeposits?.filter(d => !d.interest).length ?? 0
  const lots = a.kind === 'gold_grams' ? legacyGoldPurchases(a).length : 0
  const main =
    a.kind === 'mutual_fund' && a.units ? `${a.units.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} units` :
    a.kind === 'stocks' && a.quantity ? `${a.quantity} shares · avg ₹${(a.avgBuyPrice ?? 0).toLocaleString('en-IN')}` :
    a.kind === 'gold_grams' ? `${a.value.toFixed(2)}g · ${lots} purchase${lots === 1 ? '' : 's'}` :
    a.kind === 'epf' ? `est. from ${a.balanceAsOf ?? 'snapshot'}${a.monthlyContribution ? ` · +₹${a.monthlyContribution.toLocaleString('en-IN')}/mo` : ''}` :
    a.kind === 'ppf' ? `${deposits} deposit${deposits === 1 ? '' : 's'} · ${a.annualRate ?? 7.1}%` :
    a.kind === 'nps' ? (a.npsHoldings?.length ? `${a.npsHoldings.length} scheme${a.npsHoldings.length === 1 ? '' : 's'} · live NAV` : 'manual corpus') :
    a.kind === 'post_office' ? a.postOfficeScheme ?? '' : ''
  const invested = a.investedAmount && ['mutual_fund', 'fd_rd', 'post_office', 'epf_ppf'].includes(a.kind) ? `invested ₹${a.investedAmount.toLocaleString('en-IN')}` : ''
  return [main, invested].filter(Boolean).join(' · ') || KIND_LABEL[a.kind]
}

const gainColor = (g: number | null) => g == null || g === 0 ? 'var(--text-3)' : g > 0 ? 'var(--good-ink)' : 'var(--bad-ink)'

// ── Card ──────────────────────────────────────────────────────────────────────

interface Props {
  assets: AssetWithValue[]   // already valued by the page, so this list and the net worth total agree
  masked: boolean
  lifetime: { invested: number; returns: number; pct: number | null }
  updating: boolean          // prices are being fetched again
  openKind: AssetKind | null
  onOpenKind: (k: AssetKind | null) => void
  onAdd: () => void
  onLog: () => void          // log a savings transaction
  onOpen: (a: AssetWithValue) => void
  onAddUnits: (a: AssetWithValue) => void  // a holding still waiting on its units
}

export default function MyAssetsSection({ assets, masked, lifetime, updating, openKind, onOpenKind, onAdd, onLog, onOpen, onAddUnits }: Props) {
  const M = maskWith(masked)
  const [activeSeg, setActiveSeg] = useState<AssetKind | null>(null)

  const classes = useMemo(() => KIND_ORDER.flatMap(k => {
    const items = assets.filter(a => a.kind === k)
    if (!items.length) return []
    const value = items.reduce((s, a) => s + a.currentValue, 0)
    const withCost = items.map(a => ({ a, inv: investedOf(a) })).filter(x => x.inv != null) as { a: AssetWithValue; inv: number }[]
    const inv = withCost.length ? withCost.reduce((s, x) => s + x.inv, 0) : null
    const iv = withCost.reduce((s, x) => s + x.a.currentValue, 0)
    return [{ k, items, value, inv, gain: inv != null ? iv - inv : null, gp: inv ? ((iv - inv) / inv) * 100 : null }]
  }), [assets])

  const total = classes.reduce((s, c) => s + c.value, 0)
  const largest = classes.slice().sort((a, b) => b.value - a.value)[0]
  const act = classes.find(c => c.k === activeSeg) ?? largest
  const hasLife = lifetime.invested > 0

  return (
    <div style={{ ...CARD, padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={EYEBROW}>SAVINGS &amp; INVESTMENTS</div>
          <div className="nw-num" style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.03em', marginTop: 6 }}>{M(rs(total), false)}</div>
          {hasLife && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 10px', marginTop: 8 }}>
              <span className="nw-num" style={{ padding: '3px 9px', borderRadius: 999, background: lifetime.returns >= 0 ? 'var(--good-soft)' : 'var(--bad-soft)', color: lifetime.returns >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)', fontSize: 12, fontWeight: 700 }}>
                {lifetime.pct == null ? M(rs(lifetime.returns, true))
                  : masked ? pc(lifetime.pct) : `${rs(lifetime.returns, true)} · ${pc(lifetime.pct, false)}`}
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Invested {M(rs(lifetime.invested))}</span>
              {updating && <span style={{ fontSize: 12, color: 'var(--text-4)' }}>updating…</span>}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
          <button onClick={onLog} title="Log a savings transaction" style={PILL_BTN}>Log</button>
          <button onClick={onAdd} title="Add a holding" style={BRAND_BTN}>+ Add</button>
        </div>
      </div>

      {classes.length > 0 ? (<>
        {/* Allocation: hover a block to read it, tap to open its class */}
        <div onMouseLeave={() => setActiveSeg(null)} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 12.5 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: kindColor(act.k), flex: 'none' }} />
              <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{KIND_LABEL[act.k]}</span>
              {!activeSeg && <span style={{ color: 'var(--text-3)', whiteSpace: 'nowrap' }}>· largest</span>}
            </span>
            <span className="nw-num" style={{ color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
              {(total ? (act.value / total) * 100 : 0).toFixed(1)}% · {M(rs(act.value))}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 3, height: 46 }}>
            {classes.map(c => {
              const pct = total ? (c.value / total) * 100 : 0
              return (
                <button
                  key={c.k} type="button" aria-label={`${KIND_LABEL[c.k]}: ${pct.toFixed(1)}%`}
                  onMouseEnter={() => setActiveSeg(c.k)}
                  onClick={() => { setActiveSeg(c.k); onOpenKind(c.k) }}
                  className="nw-mono"
                  style={{
                    flex: `${Math.max(c.value, 0)} 1 0px`, minWidth: 7, background: kindColor(c.k), border: 'none', borderRadius: 9,
                    opacity: activeSeg && activeSeg !== c.k ? 0.32 : 1, transform: `scaleY(${activeSeg === c.k ? 1 : 0.92})`,
                    transition: 'opacity .2s, transform .2s', display: 'flex', alignItems: 'flex-end', padding: '0 0 6px 7px',
                    boxSizing: 'border-box', fontSize: 10, fontWeight: 600, color: '#16171a', overflow: 'hidden', cursor: 'pointer',
                  }}
                >
                  {pct >= 9 ? `${Math.round(pct)}%` : ''}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: -6 }}>
          {classes.map(c => {
            const open = openKind === c.k
            const pct = total ? (c.value / total) * 100 : 0
            return (
              <div key={c.k} style={{ borderTop: '1px solid var(--border)' }}>
                <button
                  type="button" onClick={() => onOpenKind(open ? null : c.k)} aria-expanded={open}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 2px', border: 'none', background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}
                >
                  <span style={{ width: 10, height: 28, borderRadius: 4, background: kindColor(c.k), flex: 'none' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{KIND_LABEL[c.k]}</span>
                      <span className="nw-mono" style={{ fontSize: 10.5, color: 'var(--text-3)', padding: '2px 6px', borderRadius: 6, background: 'var(--surface-2)' }}>{pct.toFixed(1)}%</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                      {c.inv != null ? `Invested ${M(rs(c.inv))}` : `${c.items.length} holding${c.items.length > 1 ? 's' : ''} · no cost price`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flex: 'none' }}>
                    <div className="nw-num" style={{ fontSize: 14.5, fontWeight: 600 }}>{M(rs(c.value))}</div>
                    <div className="nw-num" style={{ fontSize: 12, fontWeight: 600, color: gainColor(c.gain) }}>
                      {c.gain == null || c.gp == null ? '—' : masked ? pc(c.gp) : `${rs(c.gain, true)} · ${pc(c.gp)}`}
                    </div>
                  </div>
                  <Chevron open={open} />
                </button>

                {open && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 0 14px 22px' }}>
                    {c.items.map(a => {
                      const inv = investedOf(a)
                      const g = inv != null ? a.currentValue - inv : null
                      const detail = holdingDetail(a)
                      return (
                        <Tap key={a.id} onClick={() => onOpen(a)} label={holdingName(a)}
                          style={{ display: 'flex', gap: 11, alignItems: 'center', padding: '10px 12px 10px 10px', borderRadius: 14, background: 'var(--surface-2)' }}>
                          <span className="nw-mono" style={{ width: 36, height: 36, flex: 'none', borderRadius: 11, background: kindTint(a.kind), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700, color: 'var(--text)' }}>{holdingMono(a)}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, textWrap: 'pretty', overflowWrap: 'anywhere' } as React.CSSProperties}>{holdingName(a)}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{masked ? detail.replace(/₹[\d,]+/g, '₹ ••••') : detail}</div>
                            {a.pendingTransactionIds.length > 0 && (
                              <button
                                type="button" onClick={e => { e.stopPropagation(); onAddUnits(a) }}
                                title="Counted at cost until the allotted units are added"
                                style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 999, border: 'none', background: 'var(--warn-soft)', color: 'var(--warn-ink)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                              >
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warn)' }} />
                                {M(rs(Math.abs(a.pendingAmount)))} awaiting units · Add units
                              </button>
                            )}
                          </div>
                          <div style={{ textAlign: 'right', flex: 'none' }}>
                            <div className="nw-num" style={{ fontSize: 13.5, fontWeight: 600 }}>{M(rs(a.currentValue))}</div>
                            <div style={{ fontSize: 11.5, fontWeight: 600, color: gainColor(g) }}>{inv ? pc((g! / inv) * 100) : ''}</div>
                          </div>
                        </Tap>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </>) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 18, borderRadius: 16, border: '1.5px dashed var(--border)', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['mutual_fund', 'gold_grams', 'epf'] as const).map(k => <span key={k} style={{ width: 22, height: 22, borderRadius: 6, background: kindColor(k) }} />)}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>No holdings yet. Add your first one.</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.45 }}>Mutual funds, stocks, gold, EPF, PPF, FDs, your savings account — anything you own.</div>
          <button onClick={onAdd} style={{ ...BRAND_BTN, height: 38, padding: '0 16px', fontSize: 13 }}>Add a holding</button>
        </div>
      )}
    </div>
  )
}
