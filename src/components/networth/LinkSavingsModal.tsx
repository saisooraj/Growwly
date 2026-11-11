'use client'

import { useMemo, useState } from 'react'
import { X, Plus, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import CenteredModal from '@/components/ui/CenteredModal'
import { useAuth } from '@/context/AuthContext'
import { getUserAssets, updateAsset, setUserSettings } from '@/lib/firestore'
import { formatCurrencyFull, getTransferDisplay } from '@/lib/utils'
import {
  addOpeningBalance, canTakeOpeningBalance, isLinkable, linkedTransactionIds, linkSummary,
  planBulkLink, vehicleKinds, type BulkLinkTx, type LinkMode,
} from '@/lib/holdingLinks'
import type { Asset, Transaction } from '@/types'
import { KINDS } from './AssetModal'

// Move a whole Unlinked savings row into a holding in one go: every unlinked transaction of
// that vehicle (and, where it fits, its prior balance) is linked to the holding picked here.

interface Props {
  vehicle: string
  transactions: Transaction[]       // this vehicle's unlinked savings transactions
  opening: number                    // prior balance set on the row (money with no transaction)
  openingBalances: Record<string, number>
  assets: Asset[]
  initialHoldingId?: string          // e.g. a holding just created from here
  onCreateNew: () => void
  onClose: () => void
}

const kindLabel = (a: Asset) => KINDS.find(k => k.value === a.kind)?.label ?? 'Holding'
const fmtTotal = (n: number, unit: '₹' | 'g') => unit === 'g' ? `${n}g` : formatCurrencyFull(Math.round(n * 100) / 100)

export function toBulkLinkTx(t: Transaction): BulkLinkTx {
  return {
    id: t.id,
    date: t.date,
    amount: t.amount,
    // Money leaving cash went into savings, so into the holding
    direction: getTransferDisplay(t).dir === 'out' ? 'in' : 'out',
    goldGrams: t.goldGrams,
    goldKarat: t.goldKarat,
    goldPricePerGram: t.goldPricePerGram,
  }
}

export default function LinkSavingsModal({
  vehicle, transactions, opening, openingBalances, assets, initialHoldingId, onCreateNew, onClose,
}: Props) {
  const { user } = useAuth()
  const kinds = vehicleKinds(vehicle)
  // Holdings of the kind this vehicle saves into; any linkable holding when the vehicle is generic
  const candidates = useMemo(
    () => assets.filter(a => isLinkable(a) && (!kinds.length || kinds.includes(a.kind) || a.id === initialHoldingId)),
    [assets, kinds, initialHoldingId],
  )
  const [holdingId, setHoldingId] = useState(initialHoldingId ?? (candidates.length === 1 ? candidates[0].id : ''))
  const [pickedMode, setPickedMode] = useState<LinkMode | null>(null)
  const [moveOpening, setMoveOpening] = useState(true)
  const [saving, setSaving] = useState(false)

  const txs = useMemo(() => transactions.map(toBulkLinkTx), [transactions])
  const total = txs.reduce((s, t) => s + (t.direction === 'in' ? t.amount : -t.amount), 0)
  const holding = candidates.find(a => a.id === holdingId)
  const before = holding ? linkSummary(holding) : null
  // An empty holding can only take the money as new; otherwise the user says which it is
  const askMode = !!before && before.total > 0
  const mode: LinkMode | null = holding ? (askMode ? pickedMode : 'add') : null

  // What each choice would do, for the previews and the button
  function preview(m: LinkMode) {
    if (!holding) return null
    const plan = planBulkLink(holding, txs, m)
    const withOpening = moveOpening && opening > 0 && (m === 'included' || canTakeOpeningBalance(holding))
    const patch = withOpening && m === 'add' ? addOpeningBalance(holding, plan.patch, opening) : plan.patch
    return { plan, patch, withOpening, after: linkSummary({ ...holding, ...patch }) }
  }
  const previews = { add: preview('add'), included: preview('included') }
  const chosen = mode ? previews[mode] : null
  const canLink = !!chosen && (chosen.plan.linked.length > 0 || chosen.withOpening)
  const openingStays = opening > 0 && holding && mode === 'add' && !canTakeOpeningBalance(holding)

  async function handleLink() {
    if (!user || !holding || !mode) return
    setSaving(true)
    try {
      // Plan again on a fresh read, so nothing linked meanwhile is linked twice
      const fresh = await getUserAssets(user.uid)
      const target = fresh.find(a => a.id === holding.id)
      if (!target) { toast.error('That holding no longer exists'); return }
      const alreadyLinked = linkedTransactionIds(fresh)
      const plan = planBulkLink(target, txs.filter(t => !alreadyLinked.has(t.id)), mode)
      const withOpening = moveOpening && opening > 0 && (mode === 'included' || canTakeOpeningBalance(target))
      const patch = withOpening && mode === 'add' ? addOpeningBalance(target, plan.patch, opening) : plan.patch
      if (!plan.linked.length && !withOpening) { toast.error('Nothing left to link'); return }

      await updateAsset(target.id, patch)
      if (withOpening) {
        try {
          await setUserSettings(user.uid, { savingsOpeningBalances: { ...openingBalances, [vehicle]: 0 } })
        } catch {
          toast.error(`Linked, but the ${vehicle} prior balance wasn’t cleared. Set it to 0 with the pencil, or it counts twice.`, { duration: 8000 })
        }
      }
      const n = plan.linked.length
      toast.success(n
        ? `Linked ${n} transaction${n === 1 ? '' : 's'} to ${target.name}`
        : `Moved the prior balance into ${target.name}`)
      if (plan.skipped.length) {
        toast(`${plan.skipped.length} couldn’t be linked here. Open ${plan.skipped.length === 1 ? 'it' : 'them'} from Transactions to link one by one.`, { duration: 7000 })
      }
      onClose()
    } catch {
      toast.error('Couldn’t link. Nothing was changed.')
    } finally {
      setSaving(false)
    }
  }

  const n = txs.length

  return (
    <CenteredModal onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Link {vehicle} savings</h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '4px 0 0' }}>
            {n > 0 && <>{n} transaction{n === 1 ? '' : 's'} · {formatCurrencyFull(total)}</>}
            {n > 0 && opening > 0 && ' · '}
            {opening > 0 && <>{formatCurrencyFull(opening)} prior balance</>}
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" style={{ padding: 6, borderRadius: 8, border: 'none', background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--text-2)', display: 'flex', flex: 'none' }}><X size={16} /></button>
      </div>

      {/* Which holding */}
      <p className="label" style={{ marginBottom: 8 }}>Move into</p>
      <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
        {candidates.map(a => {
          const s = linkSummary(a)
          const on = a.id === holdingId
          return (
            <button
              key={a.id} type="button" role="radio" aria-checked={on}
              onClick={() => { setHoldingId(a.id); setPickedMode(null) }}
              className="pressable"
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                border: `1.5px solid ${on ? 'var(--brand)' : 'var(--border)'}`,
                background: on ? 'var(--brand-soft)' : 'var(--surface-2)',
              }}
            >
              <span style={{
                width: 18, height: 18, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1.5px solid ${on ? 'var(--brand)' : 'var(--border-strong)'}`, background: on ? 'var(--brand)' : 'transparent', color: '#fff',
              }}>
                {on && <Check size={11} strokeWidth={3} />}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.kind === 'post_office' && a.postOfficeScheme ? a.postOfficeScheme : kindLabel(a)}
                </span>
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{fmtTotal(s.total, s.unit)}</span>
            </button>
          )
        })}
        <button
          type="button" onClick={onCreateNew} className="pressable"
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
            border: '1.5px dashed var(--border-strong)', background: 'transparent', color: 'var(--text-2)', fontSize: 13.5, fontWeight: 600,
          }}
        >
          <Plus size={16} /> New holding
          {candidates.length === 0 && <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-3)' }}>· you don’t have a {vehicle} holding yet</span>}
        </button>
      </div>

      {/* New money or already counted: only when the holding has a balance to be counted in */}
      {holding && askMode && (
        <>
          <p className="label" style={{ marginBottom: 8 }}>Is this money already in {holding.name}’s balance?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {(['add', 'included'] as const).map(m => {
              const p = previews[m]
              const on = pickedMode === m
              const blocked = !!p && p.plan.linked.length === 0 && !p.withOpening
              return (
                <button
                  key={m} type="button" role="radio" aria-checked={on} disabled={blocked}
                  onClick={() => setPickedMode(m)}
                  style={{
                    display: 'block', padding: '10px 12px', borderRadius: 12, textAlign: 'left',
                    cursor: blocked ? 'not-allowed' : 'pointer', opacity: blocked ? 0.55 : 1,
                    border: `1.5px solid ${on ? 'var(--brand)' : 'var(--border)'}`,
                    background: on ? 'var(--brand-soft)' : 'var(--surface-2)',
                  }}
                >
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                    {m === 'add' ? 'No, add it to the holding' : 'Yes, it’s already counted there'}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    {blocked && p
                      ? (m === 'included' && before?.unit === '₹'
                        ? `Can’t be: its balance is only ${fmtTotal(before.total, '₹')}`
                        : p.plan.skipped[0]?.reason)
                      : p && before && (m === 'add'
                        ? `${fmtTotal(before.total, before.unit)} → ${fmtTotal(p.after.total, p.after.unit)}`
                        : `Stays at ${fmtTotal(p.after.total, p.after.unit)}`)}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Result, when there was nothing to ask */}
      {holding && !askMode && chosen && before && (
        <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '0 0 14px' }}>
          {holding.name}: {fmtTotal(before.total, before.unit)} → <b style={{ color: 'var(--text)' }}>{fmtTotal(chosen.after.total, chosen.after.unit)}</b>
        </p>
      )}

      {/* Prior balance */}
      {opening > 0 && holding && !openingStays && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-2)', marginBottom: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={moveOpening} onChange={e => setMoveOpening(e.target.checked)} />
          Also move the {formatCurrencyFull(opening)} prior balance
        </label>
      )}
      {openingStays && (
        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 14px', lineHeight: 1.45 }}>
          The {formatCurrencyFull(opening)} prior balance stays under Unlinked savings: a {kindLabel(holding!)} holding needs it entered on the holding itself.
        </p>
      )}

      {/* Transactions that need opening one by one */}
      {chosen && chosen.plan.skipped.length > 0 && chosen.plan.linked.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--warn-ink)', margin: '0 0 14px', lineHeight: 1.45 }}>
          {chosen.plan.skipped.length} of {n} can’t be linked here ({chosen.plan.skipped[0].reason.replace(/\.$/, '')}). They stay unlinked; open them from Transactions to link one by one.
        </p>
      )}

      <button
        type="button" className="btn-primary btn" onClick={handleLink}
        disabled={saving || !canLink}
        style={{ width: '100%', justifyContent: 'center', opacity: !canLink ? 0.5 : 1 }}
      >
        {saving ? 'Linking…'
          : !holding ? 'Choose a holding'
          : !mode ? 'Choose an option above'
          : chosen && chosen.plan.linked.length > 0
            ? `Link ${chosen.plan.linked.length} transaction${chosen.plan.linked.length === 1 ? '' : 's'}`
            : 'Move prior balance'}
      </button>
    </CenteredModal>
  )
}
