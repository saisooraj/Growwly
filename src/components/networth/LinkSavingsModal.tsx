'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { getUserAssets, updateAsset, setUserSettings } from '@/lib/firestore'
import { formatCurrencyFull, getTransferDisplay } from '@/lib/utils'
import {
  addOpeningBalance, canTakeOpeningBalance, isLinkable, linkedTransactionIds, linkSummary,
  planBulkLink, vehicleKinds, type BulkLinkTx, type LinkMode,
} from '@/lib/holdingLinks'
import type { Asset, Transaction } from '@/types'
import { KINDS } from './AssetModal'
import { KIND_LABEL, Ring, Sheet, SheetActions, SheetTitle, kindTint, monogram } from './nwUi'

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
  const [step, setStep] = useState<1 | 2 | 3>(initialHoldingId ? (askMode ? 2 : 3) : 1)
  const [creating, setCreating] = useState(false)
  const amountOf = (ids: string[]) => txs.filter(t => ids.includes(t.id)).reduce((s, t) => s + (t.direction === 'in' ? t.amount : -t.amount), 0)

  function next() {
    if (step === 1) {
      if (creating) { onCreateNew(); return }
      if (!holding) return
      setStep(askMode ? 2 : 3)
    } else if (step === 2) {
      if (mode) setStep(3)
    } else {
      handleLink()
    }
  }
  function back() {
    if (step === 1) onClose()
    else setStep(step === 3 && askMode ? 2 : 1)
  }

  const moved = chosen ? amountOf(chosen.plan.linked) + (chosen.withOpening ? opening : 0) : 0
  const summary = holding && chosen && before ? [
    { k: 'Moving', v: [n > 0 ? `${formatCurrencyFull(Math.abs(amountOf(chosen.plan.linked)))} · ${chosen.plan.linked.length} transaction${chosen.plan.linked.length === 1 ? '' : 's'}` : '', chosen.withOpening ? `${formatCurrencyFull(opening)} prior` : ''].filter(Boolean).join(' + ') },
    { k: 'Into', v: holding.name },
    { k: 'Holding balance', v: mode === 'included' ? `${fmtTotal(chosen.after.total, chosen.after.unit)} (unchanged)` : `${fmtTotal(before.total, before.unit)} → ${fmtTotal(chosen.after.total, chosen.after.unit)}` },
    { k: 'Net worth', v: mode === 'included' ? `−${formatCurrencyFull(Math.abs(moved))} (no double count)` : 'Unchanged' },
  ] : []

  const nextLabel = saving ? 'Linking…'
    : step === 1 ? (creating ? 'Create holding' : 'Continue')
    : step === 2 ? 'Continue'
    : 'Link savings'
  const nextDisabled = saving || (step === 1 ? !creating && !holding : step === 2 ? !mode : !canLink)

  return (
    <Sheet onClose={onClose} label={`Link ${vehicle} savings`}>
      <SheetTitle
        title={`Link ${vehicle} savings`}
        sub={[n > 0 ? `${formatCurrencyFull(total)} across ${n} transaction${n === 1 ? '' : 's'}` : '', opening > 0 ? `${formatCurrencyFull(opening)} prior balance` : ''].filter(Boolean).join(' · ')}
        onClose={onClose}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
        {['PICK HOLDING', 'CHECK BALANCE', 'CONFIRM'].map((l, i) => (
          <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ height: 4, borderRadius: 2, background: i < step ? 'var(--brand)' : 'var(--surface-3)' }} />
            <span className="nw-mono" style={{ fontSize: 9.5, letterSpacing: '.08em', color: i < step ? 'var(--text-2)' : 'var(--text-4)' }}>{l}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div role="radiogroup" aria-label="Move into" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {candidates.map(a => {
            const s = linkSummary(a)
            const on = !creating && a.id === holdingId
            return (
              <button key={a.id} type="button" role="radio" aria-checked={on} onClick={() => { setCreating(false); setHoldingId(a.id); setPickedMode(null) }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 14, border: `1.5px solid ${on ? 'var(--brand)' : 'var(--border)'}`, background: on ? 'var(--brand-soft)' : 'var(--surface)', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <span className="nw-mono" style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, background: kindTint(a.kind), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{monogram(a.name || kindLabel(a))}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.kind === 'post_office' && a.postOfficeScheme ? a.postOfficeScheme : KIND_LABEL[a.kind]} · {fmtTotal(s.total, s.unit)}
                  </span>
                </span>
                <Ring on={on} />
              </button>
            )
          })}
          <button type="button" role="radio" aria-checked={creating} onClick={() => setCreating(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 14, border: `1.5px dashed ${creating ? 'var(--brand)' : 'var(--border)'}`, background: creating ? 'var(--brand-soft)' : 'var(--surface)', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
            <span className="nw-mono" style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>+</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>Create new holding</span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)' }}>
                {candidates.length === 0 ? `You don’t have a ${vehicle} holding yet` : 'Start a new holding from this money'}
              </span>
            </span>
            <Ring on={creating} />
          </button>
        </div>
      )}

      {step === 2 && holding && (
        <>
          <div className="nw-serif" style={{ fontSize: 26, lineHeight: 1.1, textWrap: 'balance' } as React.CSSProperties}>Is this money already in {holding.name}’s balance?</div>
          <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['included', 'add'] as const).map(m => {
              const p = previews[m]
              const on = pickedMode === m
              const blocked = !!p && p.plan.linked.length === 0 && !p.withOpening
              const delta = p ? amountOf(p.plan.linked) + (p.withOpening ? opening : 0) : 0
              return (
                <button key={m} type="button" role="radio" aria-checked={on} disabled={blocked} onClick={() => setPickedMode(m)}
                  style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 16, border: `1.5px solid ${on ? 'var(--brand)' : 'var(--border)'}`, background: on ? 'var(--brand-soft)' : 'var(--surface)', color: 'inherit', textAlign: 'left', cursor: blocked ? 'not-allowed' : 'pointer', opacity: blocked ? 0.55 : 1 }}>
                  <span style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ marginTop: 1 }}><Ring on={on} /></span>
                    <span>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{m === 'included' ? 'Yes, it’s already included' : 'No, add it to the balance'}</span>
                      <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.4 }}>
                        {blocked && p
                          ? (m === 'included' && before?.unit === '₹' ? `Can’t be: its balance is only ${fmtTotal(before.total, '₹')}` : p.plan.skipped[0]?.reason)
                          : m === 'included' ? 'The balance stays as is. We stop counting this money twice.' : 'We add this money to the holding. Net worth doesn’t change.'}
                      </span>
                    </span>
                  </span>
                  {p && before && !blocked && (
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 28 }}>
                      <span className="nw-num" style={{ fontSize: 11.5, fontWeight: 600, padding: '4px 9px', borderRadius: 999, background: 'var(--surface-2)' }}>
                        Balance {fmtTotal(before.total, before.unit)} → {fmtTotal(p.after.total, p.after.unit)}
                      </span>
                      <span className="nw-num" style={{ fontSize: 11.5, fontWeight: 600, padding: '4px 9px', borderRadius: 999, background: 'var(--surface-2)' }}>
                        {m === 'included' ? `Net worth −${formatCurrencyFull(Math.abs(delta))}` : 'Net worth unchanged'}
                      </span>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {step === 3 && holding && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 16, background: 'var(--surface-2)', padding: '4px 14px' }}>
            {summary.map((r, i) => (
              <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderBottom: i < summary.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                <span style={{ color: 'var(--text-3)' }}>{r.k}</span>
                <span className="nw-num" style={{ fontWeight: 600, textAlign: 'right' }}>{r.v}</span>
              </div>
            ))}
          </div>
          {opening > 0 && !openingStays && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={moveOpening} onChange={e => setMoveOpening(e.target.checked)} style={{ accentColor: 'var(--brand)' }} />
              Also move the {formatCurrencyFull(opening)} prior balance
            </label>
          )}
          {openingStays && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.45 }}>
              The {formatCurrencyFull(opening)} prior balance stays under unlinked savings: a {kindLabel(holding)} holding needs it entered on the holding itself.
            </div>
          )}
          {chosen && chosen.plan.skipped.length > 0 && chosen.plan.linked.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--warn-ink)', lineHeight: 1.45 }}>
              {chosen.plan.skipped.length} of {n} can’t be linked here ({chosen.plan.skipped[0].reason.replace(/\.$/, '')}). They stay unlinked; open them from Transactions to link one by one.
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>You can unlink later from the holding’s transactions.</div>
        </>
      )}

      <SheetActions onCancel={back} cancel={step === 1 ? 'Cancel' : 'Back'} primary={nextLabel} onPrimary={next} disabled={nextDisabled} />
    </Sheet>
  )
}
