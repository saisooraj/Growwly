'use client'

import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatCurrencyFull } from '@/lib/utils'
import { legacyGoldPurchases } from '@/lib/gold'
import type { AssetWithValue } from '@/lib/assetValuation'
import type { Asset, AssetKind } from '@/types'
import MaskToggle from './MaskToggle'

// ── Kind metadata ─────────────────────────────────────────────────────────────

const KIND_META: Record<AssetKind, { label: string; color: string }> = {
  mutual_fund:  { label: 'Mutual Funds',      color: '#6366f1' },
  stocks:       { label: 'Stocks & ETFs',     color: '#8b5cf6' },
  gold_grams:   { label: 'Gold',              color: '#f59e0b' },
  epf:          { label: 'EPF',               color: '#0ea5e9' },
  ppf:          { label: 'PPF',               color: '#0284c7' },
  nps:          { label: 'NPS',               color: '#0891b2' },
  epf_ppf:      { label: 'EPF / PPF (legacy)', color: '#0ea5e9' },
  fd_rd:        { label: 'FD / RD',           color: '#10b981' },
  cash:         { label: 'Cash & Savings',    color: '#22c55e' },
  real_estate:  { label: 'Real Estate',       color: '#f97316' },
  vehicle:      { label: 'Vehicle',           color: '#94a3b8' },
  other:        { label: 'Other',             color: '#94a3b8' },
}

const KIND_ORDER: AssetKind[] = ['mutual_fund','stocks','gold_grams','epf','ppf','nps','epf_ppf','fd_rd','cash','real_estate','vehicle','other']

// ── Sub-components ─────────────────────────────────────────────────────────────

function GainBadge({ gain, gainPct }: { gain: number; gainPct: number | null }) {
  if (gainPct === null) return null
  const up = gain >= 0
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 600, color: up ? 'var(--good-ink)' : 'var(--bad-ink)' }}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? '+' : ''}{gainPct.toFixed(1)}%
    </span>
  )
}

// What a holding cost: the basis its gain is measured against, or the invested amount on file.
function investedOf(a: AssetWithValue): number | null {
  if (a.gainPct !== null) return a.currentValue - a.gain
  return a.investedAmount && a.investedAmount > 0 ? a.investedAmount : null
}

// Totals for a set of holdings. `invested` is only given when every holding has one, so it
// always describes the same money as `value`.
function summarize(items: AssetWithValue[]) {
  const value = items.reduce((s, a) => s + a.currentValue, 0)
  const tracked = items.filter(a => a.gainPct !== null)
  const gain = tracked.reduce((s, a) => s + a.gain, 0)
  const basis = tracked.reduce((s, a) => s + (a.currentValue - a.gain), 0)
  const costs = items.map(investedOf)
  const invested = items.length > 0 && costs.every(c => c !== null) ? costs.reduce((s: number, c) => s + (c ?? 0), 0) : null
  return { value, gain, gainPct: basis > 0 ? (gain / basis) * 100 : null, invested }
}

function GainLine({ gain, gainPct, masked }: { gain: number; gainPct: number | null; masked: boolean }) {
  if (gainPct === null) return null
  const up = gain >= 0
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 600, color: up ? 'var(--good-ink)' : 'var(--bad-ink)', whiteSpace: 'nowrap' }}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {masked
        ? `${up ? '+' : '−'}${Math.abs(gainPct).toFixed(1)}%`
        : `${up ? '+' : '−'}${formatCurrencyFull(Math.abs(gain))} (${Math.abs(gainPct).toFixed(1)}%)`}
    </span>
  )
}

interface CategoryCardProps {
  kind: AssetKind
  assets: AssetWithValue[]
  totalValue: number
  totalGain: number
  totalGainPct: number | null
  invested: number | null
  allTotal: number
  masked: boolean
  onEdit: (a: Asset) => void
  onDelete: (id: string) => void
}

function CategoryCard({ kind, assets, totalValue, totalGain, totalGainPct, invested, allTotal, masked, onEdit, onDelete }: CategoryCardProps) {
  const [open, setOpen] = useState(false)
  const meta = KIND_META[kind]
  const alloc = allTotal > 0 ? (totalValue / allTotal) * 100 : 0
  const fmt = (v: number) => masked ? '₹ •••' : formatCurrencyFull(v)

  return (
    <div style={{ borderRadius: 12, background: 'var(--surface-2)', overflow: 'hidden' }}>
      {/* Category header row */}
      <button
        type="button" onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{meta.label}</span>
            <span style={{ fontSize: 11, color: 'var(--text-4)', background: 'var(--surface-3)', borderRadius: 999, padding: '1px 7px' }}>{alloc.toFixed(1)}%</span>
          </div>
          {invested !== null && (
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap' }}>Invested {fmt(invested)}</div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{fmt(totalValue)}</div>
          <GainLine gain={totalGain} gainPct={totalGainPct} masked={masked} />
        </div>
        {open ? <ChevronDown size={14} style={{ color: 'var(--text-4)', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: 'var(--text-4)', flexShrink: 0 }} />}
      </button>

      {/* Holdings list */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {assets.map(a => {
            const goldLots = a.kind === 'gold_grams' ? legacyGoldPurchases(a) : []
            const goldKarats = Array.from(new Set(goldLots.map(p => p.karat)))
            const goldKaratLabel = goldKarats.length === 1 ? `${goldKarats[0]}K` : goldKarats.length > 1 ? 'Au' : `${a.karat ?? 22}K`
            return (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: meta.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>
                  {a.kind === 'gold_grams' ? goldKaratLabel : a.name.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.name || (a.kind === 'gold_grams' ? `${goldKaratLabel} Gold` : a.ticker ?? a.schemeCode)}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, marginTop: 1 }}>
                  {a.kind === 'mutual_fund' && a.units ? `${a.units.toFixed(3)} units` :
                   a.kind === 'stocks' && a.quantity ? `${a.quantity} shares · avg ₹${(a.avgBuyPrice ?? 0).toLocaleString('en-IN')}` :
                   a.kind === 'gold_grams' ? `${a.value.toFixed(2)}g · ${goldLots.length} purchase${goldLots.length === 1 ? '' : 's'}` :
                   a.kind === 'epf' ? `est. from ${a.balanceAsOf ?? 'snapshot'}${a.monthlyContribution ? ` · +₹${a.monthlyContribution.toLocaleString('en-IN')}/mo` : ''}` :
                   a.kind === 'ppf' ? `${a.ppfDeposits?.filter(d => !d.interest).length ?? 0} deposit${(a.ppfDeposits?.filter(d => !d.interest).length ?? 0) === 1 ? '' : 's'} · ${a.annualRate ?? 7.1}%` :
                   a.kind === 'nps' ? (a.npsHoldings?.length ? `${a.npsHoldings.length} scheme${a.npsHoldings.length === 1 ? '' : 's'} · live NAV` : 'manual corpus') : ''}
                  {a.investedAmount ? ` · invested ${masked ? '•••' : `₹${a.investedAmount.toLocaleString('en-IN')}`}` : ''}
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{fmt(a.currentValue)}</p>
                <GainBadge gain={a.gain} gainPct={a.gainPct} />
              </div>
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                <button onClick={() => onEdit(a)} style={{ padding: 5, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-4)' }}><Pencil size={12} /></button>
                <button onClick={() => onDelete(a.id)} style={{ padding: 5, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-4)' }}><Trash2 size={12} /></button>
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  assets: AssetWithValue[]   // already valued by the page, so this list and the net worth total agree
  masked: boolean
  onToggleMask: () => void
  onAdd: () => void
  onLog: () => void          // log a savings transaction
  onEdit: (a: Asset) => void
  onDelete: (id: string) => void
}

export default function MyAssetsSection({ assets, masked, onToggleMask, onAdd, onLog, onEdit, onDelete }: Props) {
  const enriched = assets

  // Group by kind, sorted by KIND_ORDER
  const groups = useMemo(() => {
    const map = new Map<AssetKind, AssetWithValue[]>()
    for (const a of enriched) {
      if (!map.has(a.kind)) map.set(a.kind, [])
      map.get(a.kind)!.push(a)
    }
    return KIND_ORDER.filter(k => map.has(k)).map(k => ({ kind: k, items: map.get(k)! }))
  }, [enriched])

  const total = useMemo(() => summarize(enriched), [enriched])
  const totalValue = total.value

  const fmt = (v: number) => masked ? '₹ •••' : formatCurrencyFull(v)

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Savings &amp; Investments</h2>
          {total.gainPct !== null && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0 6px', marginTop: 3 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{fmt(totalValue)}</span>
              <GainLine gain={total.gain} gainPct={total.gainPct} masked={masked} />
            </div>
          )}
          {total.invested !== null && (
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>Invested {fmt(total.invested)}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <MaskToggle masked={masked} onToggle={onToggleMask} />
          <button
            onClick={onLog} title="Log a savings transaction"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
          >
            <Plus size={13} /> Log
          </button>
          <button
            onClick={onAdd} title="Add a holding"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
          >
            <Plus size={13} /> Add
          </button>
        </div>
      </div>

      {/* Allocation bar */}
      {groups.length > 0 && !masked && (
        <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', gap: 1 }}>
          {groups.map(g => {
            const gTotal = g.items.reduce((s, a) => s + a.currentValue, 0)
            const pct = totalValue > 0 ? (gTotal / totalValue) * 100 : 0
            return (
              <div key={g.kind} style={{ width: `${pct}%`, background: KIND_META[g.kind].color, minWidth: pct > 0 ? 2 : 0 }} title={`${KIND_META[g.kind].label}: ${pct.toFixed(1)}%`} />
            )
          })}
        </div>
      )}

      {/* Category cards */}
      {groups.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-4)', textAlign: 'center', padding: '24px 0' }}>No holdings yet. Add your first one.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {groups.map(g => {
            const sum = summarize(g.items)
            return (
              <CategoryCard
                key={g.kind}
                kind={g.kind}
                assets={g.items}
                totalValue={sum.value}
                totalGain={sum.gain}
                totalGainPct={sum.gainPct}
                invested={sum.invested}
                allTotal={totalValue}
                masked={masked}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            )
          })}
        </div>
      )}

      {/* Allocation legend */}
      {groups.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
          {groups.map(g => {
            const gTotal = g.items.reduce((s, a) => s + a.currentValue, 0)
            const pct = totalValue > 0 ? (gTotal / totalValue) * 100 : 0
            return (
              <div key={g.kind} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: KIND_META[g.kind].color, flexShrink: 0 }} />
                <span style={{ color: 'var(--text-3)' }}>{KIND_META[g.kind].label}</span>
                <span style={{ color: 'var(--text-4)' }}>{pct.toFixed(0)}%</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
