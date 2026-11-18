'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import type { AssetWithValue, LivePrices } from '@/lib/assetValuation'
import type { Liability } from '@/types'
import { legacyGoldPurchases } from '@/lib/gold'
import { holdingDetail, holdingMono, holdingName, investedOf } from './MyAssetsSection'
import { ActionRow, EYEBROW, Fact, KIND_LABEL, Sheet, SheetActions, SheetHead, kindColor, kindTint, maskWith, pc, rs } from './nwUi'

const maskFact = (masked: boolean) => ([k, v]: [string, string]) => ({ k, v: masked && v.startsWith('₹') ? '₹ ••••' : v })
const day = (iso?: string) => { try { return iso ? format(parseISO(iso), 'd MMM yyyy') : '—' } catch { return '—' } }
const monthYear = (iso?: string) => { try { return iso ? format(parseISO(iso), 'MMM yyyy') : '—' } catch { return '—' } }

// ── Holding ───────────────────────────────────────────────────────────────────

function holdingFacts(a: AssetWithValue, prices: LivePrices): [string, string][] {
  const inv = investedOf(a)
  const invS = inv != null ? rs(inv) : '—'
  switch (a.kind) {
    case 'mutual_fund': {
      const nav = a.schemeCode ? prices.mf?.[a.schemeCode]?.nav : undefined
      return [['Units', (a.units ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })], ['NAV today', nav ? `₹${nav.toFixed(2)}` : '—'], ['Invested', invS], ['Gain', inv != null ? rs(a.currentValue - inv, true) : '—']]
    }
    case 'stocks': {
      const px = a.ticker ? prices.stocks?.[a.ticker]?.price : undefined
      return [['Shares', String(a.quantity ?? 0)], ['Avg price', `₹${(a.avgBuyPrice ?? 0).toLocaleString('en-IN')}`], ['Price today', px ? `₹${px.toLocaleString('en-IN')}` : '—'], ['Invested', invS]]
    }
    case 'gold_grams': {
      const lots = legacyGoldPurchases(a)
      return [['Weight', `${a.value.toFixed(2)}g`], ['Purchases', String(lots.length)], ['Invested', invS], ['22K today', prices.gold ? `₹${Math.round(prices.gold.price22k).toLocaleString('en-IN')}/g` : '—']]
    }
    case 'epf':
      return [['Balance as of', day(a.balanceAsOf)], ['Monthly credit', a.monthlyContribution ? `₹${a.monthlyContribution.toLocaleString('en-IN')}` : '—'], ['Rate', `${a.annualRate ?? '—'}% p.a.`], ['Contributed', invS]]
    case 'ppf':
      return [['Deposits', String(a.ppfDeposits?.filter(d => !d.interest).length ?? 0)], ['Rate', `${a.annualRate ?? 7.1}% p.a.`], ['Invested', invS], ['Opened', monthYear(a.ppfStartDate)]]
    case 'nps':
      return [['Schemes', String(a.npsHoldings?.length ?? 0)], ['Valued by', a.npsHoldings?.length ? 'Live NAV' : 'Your entry'], ['Contributed', invS], ['Updated', day(a.updatedAt)]]
    default:
      return [['Invested', invS], ['Detail', holdingDetail(a).split(' · ')[0]], ['Class', KIND_LABEL[a.kind]], ['Updated', day(a.updatedAt)]]
  }
}

export function HoldingSheet({ asset, prices, masked, onClose, onEdit, onLog, onView, onDelete, onAddUnits }: {
  asset: AssetWithValue; prices: LivePrices; masked: boolean
  onClose: () => void; onEdit: () => void; onLog: () => void; onView: () => void; onDelete: () => void; onAddUnits: () => void
}) {
  const M = maskWith(masked)
  const inv = investedOf(asset)
  const g = inv != null ? asset.currentValue - inv : null
  const gp = inv ? (g! / inv) * 100 : null
  return (
    <Sheet onClose={onClose} label={holdingName(asset)}>
      <SheetHead mono={holdingMono(asset)} tint={kindTint(asset.kind)} name={holdingName(asset)} onClose={onClose}
        sub={<><span style={{ width: 8, height: 8, borderRadius: 2, background: kindColor(asset.kind) }} />{KIND_LABEL[asset.kind]}</>} />
      <div>
        <div className="nw-num" style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-.035em' }}>{M(rs(asset.currentValue), false)}</div>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, color: g == null || g === 0 ? 'var(--text-3)' : g > 0 ? 'var(--good-ink)' : 'var(--bad-ink)' }}>
          {g == null || gp == null ? 'No cost price — not counted in returns' : `${masked ? pc(gp) : `${rs(g, true)} · ${pc(gp)}`} all time`}
        </div>
      </div>
      {asset.pendingTransactionIds.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'var(--warn-soft)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{M(rs(Math.abs(asset.pendingAmount)))} awaiting units</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Counted at cost until you add units.</div>
          </div>
          <button onClick={onAddUnits} style={{ height: 34, padding: '0 14px', borderRadius: 999, border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Add units</button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 }}>
        {holdingFacts(asset, prices).map(maskFact(masked)).map(f => <Fact key={f.k} k={f.k} v={f.v} />)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <ActionRow label="Edit holding" onClick={onEdit} />
        <ActionRow label="Log a transaction" onClick={onLog} />
        <ActionRow label="View transactions" onClick={onView} />
        <ActionRow label="Delete holding" onClick={onDelete} danger />
      </div>
    </Sheet>
  )
}

// ── Unlinked savings ──────────────────────────────────────────────────────────

export function UnlinkedSheet({ vehicle, masked, onClose, onSavePrior, onLink }: {
  vehicle: { name: string; mono: string; opening: number; balance: number }
  masked: boolean
  onClose: () => void
  onSavePrior: (amount: number) => Promise<void>
  onLink: () => void
}) {
  const M = maskWith(masked)
  const [prior, setPrior] = useState(vehicle.opening > 0 ? String(vehicle.opening) : '')
  const [saving, setSaving] = useState(false)
  return (
    <Sheet onClose={onClose} label={vehicle.name}>
      <SheetHead mono={vehicle.mono} tint="var(--warn-soft)" name={vehicle.name} sub="Unlinked savings · counted in net worth" onClose={onClose} />
      <div className="nw-num" style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-.035em' }}>{M(rs(vehicle.balance), false)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 }}>
        <Fact k="Prior balance" v={M(rs(vehicle.opening))} />
        <Fact k="Logged since" v={M(rs(vehicle.balance - vehicle.opening))} />
      </div>
      <form
        onSubmit={async e => { e.preventDefault(); setSaving(true); try { await onSavePrior(Number(prior) || 0) } finally { setSaving(false) } }}
        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        <span className="nw-label">Set prior balance</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="nw-input" type="number" inputMode="decimal" min="0" placeholder="What you had before tracking" value={prior} onChange={e => setPrior(e.target.value)} aria-label="Prior balance" style={{ flex: 1 }} />
          <button type="submit" disabled={saving} style={{ height: 48, padding: '0 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
      <button onClick={onLink} style={{ height: 46, borderRadius: 999, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Link to a holding</button>
      <Link href={`/transactions?type=savings&vehicle=${encodeURIComponent(vehicle.name)}`} style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--brand-ink)', textDecoration: 'none' }}>View transactions</Link>
    </Sheet>
  )
}

// ── Liability ─────────────────────────────────────────────────────────────────

export interface LiabilityView {
  item: Liability
  mono: string
  label: string
  meta: string
  outstanding: number
  emi: number
  remaining: number | null
  paidPct: number | null
}

export function LiabilitySheet({ l, masked, onClose, onEdit, onDelete }: { l: LiabilityView; masked: boolean; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const M = maskWith(masked)
  const card = l.item.kind === 'credit_card' || !l.item.tenureMonths
  const facts: [string, string][] = card
    ? [['Type', l.label], ['Tracked as', 'Balance']]
    : [['EMI', l.emi > 0 ? `${rs(l.emi)}/mo` : '—'], ['Rate', `${l.item.interestRate}% p.a.`], ['EMIs left', String(l.remaining ?? '—')], ['Started', monthYear(l.item.startDate)]]
  return (
    <Sheet onClose={onClose} label={l.item.name}>
      <SheetHead mono={l.mono} tint="var(--bad-soft)" ink="var(--bad-ink)" name={l.item.name} sub={l.meta} onClose={onClose} />
      <div>
        <div style={{ ...EYEBROW, fontSize: 10, letterSpacing: '.1em' }}>OUTSTANDING</div>
        <div className="nw-num" style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-.035em', color: 'var(--bad-ink)', marginTop: 2 }}>{M(rs(l.outstanding), false)}</div>
      </div>
      {l.paidPct != null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-3)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${l.paidPct}%`, background: 'var(--good)', borderRadius: 4 }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{Math.round(l.paidPct)}% paid off</div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 }}>
        {facts.map(maskFact(masked)).map(f => <Fact key={f.k} k={f.k} v={f.v} />)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <ActionRow label="Edit liability" onClick={onEdit} />
        <ActionRow label="Delete liability" onClick={onDelete} danger />
      </div>
    </Sheet>
  )
}

// ── Delete ────────────────────────────────────────────────────────────────────

export function DeleteSheet({ title, body, onClose, onConfirm }: { title: string; body: string; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  return (
    <Sheet onClose={onClose} label={title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
        <span aria-hidden style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bad-soft)', color: 'var(--bad-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800 }}>!</span>
        <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.25, textWrap: 'balance' } as React.CSSProperties}>{title}</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.45 }}>{body}</div>
      </div>
      <SheetActions onCancel={onClose} primary={busy ? 'Deleting…' : 'Delete'} danger ratio={1} disabled={busy}
        onPrimary={async () => { setBusy(true); try { await onConfirm() } finally { setBusy(false) } }} />
    </Sheet>
  )
}
