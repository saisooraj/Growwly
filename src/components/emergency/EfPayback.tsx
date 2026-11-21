'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO } from 'date-fns'
import { ShieldAlert, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import { useEfPayback, type EfPaybackInfo } from '@/hooks/useEfPayback'
import { addTransaction, setEmergencyFund, updateSavingsGoal, updateTransaction } from '@/lib/firestore'
import { latestMoneyIn } from '@/lib/efPayback'
import { EMERGENCY_FUND_VEHICLE } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'
import { usePrivacy } from '@/store/privacyStore'
import { Amt, inr, useMask } from '@/components/overview/ui'
import type { Transaction } from '@/types'

const SEEN_KEY = 'gw-ef-payback-seen'

function readSeen(): string | null {
  try { return localStorage.getItem(SEEN_KEY) } catch { return null }
}
function writeSeen(id: string) {
  try { localStorage.setItem(SEEN_KEY, id) } catch { /* the prompt may simply show again */ }
}

const ago = (days: number) => (days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`)
const nameOf = (t: Transaction) => t.notes?.trim() || 'Withdrawal'

function Progress({ repaid, taken }: { repaid: number; taken: number }) {
  const width = taken > 0 ? Math.min(100, (repaid / taken) * 100) : 0
  return (
    <div style={{ height: 7, borderRadius: 7, background: 'color-mix(in oklch, var(--bad) 18%, transparent)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${width}%`, borderRadius: 7, background: 'var(--good)', transition: 'width 500ms var(--ease-out)' }} />
    </div>
  )
}

function PaybackSheet({ info, moneyIn, onClose }: { info: EfPaybackInfo; moneyIn?: Transaction | null; onClose: () => void }) {
  const { user } = useAuth()
  const { M } = useMask()
  const refresh = useRefreshData()
  const fund = useAppStore(s => s.emergencyFund)
  const settings = useAppStore(s => s.settings)
  const goals = useAppStore(s => s.savingsGoals)
  const setGoals = useAppStore(s => s.setSavingsGoals)
  const [amount, setAmount] = useState(info.suggested > 0 ? String(info.suggested) : '')
  const [busy, setBusy] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const value = Number(amount)
  const owedWhole = Math.ceil(info.owed)
  const valid = Number.isFinite(value) && value > 0 && value <= owedWhole
  const overFree = valid && value > info.freeCash

  async function save() {
    if (!user || !valid || busy) return
    const paid = Math.min(value, info.owed)
    setBusy(true)
    try {
      await addTransaction(user.uid, {
        type: 'transfer',
        transferKind: 'savings_contribution',
        savingsVehicle: EMERGENCY_FUND_VEHICLE,
        efPayback: true,
        amount: paid,
        category: 'Other',
        date: format(new Date(), 'yyyy-MM-dd'),
        notes: 'Paid back to emergency fund',
        isRecurring: false,
      })
      await setEmergencyFund(user.uid, {
        targetAmount: fund?.targetAmount ?? settings?.emergencyFundTarget ?? 0,
        currentBalance: (fund?.currentBalance ?? 0) + paid,
        usedAmount: fund?.usedAmount ?? 0,
        lastUpdated: new Date().toISOString(),
      })
      // Same sync the Add form does for a goal named after the vehicle
      const goal = goals.find(g => g.name.trim().toLowerCase() === EMERGENCY_FUND_VEHICLE.toLowerCase())
      if (goal) {
        const currentAmount = goal.currentAmount + paid
        await updateSavingsGoal(goal.id, { currentAmount })
        setGoals(goals.map(g => (g.id === goal.id ? { ...g, currentAmount } : g)))
      }
      await refresh()
      const left = info.owed - paid
      toast.success(left < 1 ? 'Emergency fund repaid in full' : `${inr(paid)} put back. ${inr(left)} to go`)
      onClose()
    } catch {
      toast.error('Could not save the payback')
      setBusy(false)
    }
  }

  async function setCounted(tx: Transaction, notCounted: boolean) {
    try {
      await updateTransaction(tx.id, { efNoPayback: notCounted })
      await refresh()
      setConfirmId(null)
    } catch {
      toast.error('Could not update this withdrawal')
    }
  }

  const chips: { label: string; value: number }[] = [{ label: 'All', value: owedWhole }]
  if (info.suggested > 0 && info.suggested < owedWhole) chips.push({ label: 'All free cash', value: info.suggested })
  if (owedWhole >= 2) chips.push({ label: 'Half', value: Math.ceil(owedWhole / 2) })

  const textBtn: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--ink2)', background: 'none', padding: '6px 4px', whiteSpace: 'nowrap' }

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div
        role="dialog" aria-modal="true" aria-label="Put money back into your emergency fund"
        onClick={e => e.stopPropagation()} className="ov pulse-sheet-enter"
        style={{ width: '100%', maxWidth: 520, maxHeight: '88dvh', overflowY: 'auto', background: 'var(--surface)', borderRadius: '24px 24px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.25 }}>
              {moneyIn ? `${M(inr(moneyIn.amount))} just came in` : 'Put it back'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.45, marginTop: 3 }}>
              {moneyIn ? 'Before it gets spent, repay your emergency fund first.' : 'This money was only meant for emergencies.'}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="ov-btn" style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--surface2)', color: 'var(--ink2)', display: 'grid', placeItems: 'center', flex: 'none' }}><X size={15} /></button>
        </div>

        <div style={{ padding: 14, borderRadius: 16, background: 'var(--bad-soft)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--bad-ink)' }}>Still to put back</div>
          <Amt value={info.owed} className="ov-mono" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--bad-ink)' }} />
          {info.repaid > 0 && (
            <>
              <Progress repaid={info.repaid} taken={info.taken} />
              <div style={{ fontSize: 12, color: 'var(--ink2)' }}>{M(inr(info.repaid))} of {M(inr(info.taken))} put back</div>
            </>
          )}
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink2)', marginBottom: 2 }}>What you took</div>
          {info.open.map(({ tx, left }, i) => (
            <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameOf(tx)}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>
                  {format(parseISO(tx.date), 'd MMM yyyy')}{left < tx.amount ? ` · ${M(inr(tx.amount - left))} repaid` : ''}
                </div>
              </div>
              <span className="ov-mono" style={{ fontSize: 13, fontWeight: 700 }}>{M(inr(left))}</span>
              {confirmId === tx.id ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <button onClick={() => setCounted(tx, true)} className="ov-btn" style={{ ...textBtn, color: 'var(--bad-ink)' }}>Remove</button>
                  <button onClick={() => setConfirmId(null)} className="ov-btn" style={textBtn}>Keep</button>
                </span>
              ) : (
                <button onClick={() => setConfirmId(tx.id)} className="ov-btn" style={textBtn}>Don&apos;t count</button>
              )}
            </div>
          ))}
          {info.notCounted.map(tx => (
            <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid var(--line)', color: 'var(--ink3)' }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Not counted: {nameOf(tx)}</div>
              <span className="ov-mono" style={{ fontSize: 12 }}>{M(inr(tx.amount))}</span>
              <button onClick={() => setCounted(tx, false)} className="ov-btn" style={textBtn}>Count again</button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="ef-payback-amount" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink2)' }}>Amount to put back (₹)</label>
          <input id="ef-payback-amount" className="input" type="number" inputMode="decimal" min="1" max={owedWhole} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={{ fontSize: 16 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {chips.map(c => (
              <button key={c.label} onClick={() => setAmount(String(c.value))} className="ov-btn" style={{ fontSize: 12, fontWeight: 700, padding: '6px 11px', borderRadius: 999, background: 'var(--surface2)', color: 'var(--ink)' }}>
                {c.label} · {M(inr(c.value))}
              </button>
            ))}
          </div>
          {value > owedWhole && <div style={{ fontSize: 12, color: 'var(--bad-ink)' }}>You only need to put back {M(inr(owedWhole))}.</div>}
          {overFree && <div style={{ fontSize: 12, color: 'var(--warn-ink)' }}>This is more than the {M(inr(info.freeCash))} free after upcoming bills.</div>}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} disabled={!valid || busy} className="ov-btn" style={{ flex: 2, minHeight: 46, borderRadius: 999, fontSize: 14, fontWeight: 800, background: 'var(--ink)', color: 'var(--bg)', opacity: valid && !busy ? 1 : 0.4, cursor: valid && !busy ? 'pointer' : 'not-allowed' }}>
            {busy ? 'Saving…' : valid ? `Put back ${M(inr(value))}` : 'Put back'}
          </button>
          <button onClick={onClose} className="ov-btn" style={{ flex: 1, minHeight: 46, borderRadius: 999, fontSize: 14, fontWeight: 800, background: 'var(--surface2)', color: 'var(--ink)' }}>Later</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Stays on screen until the money is back. There is deliberately no dismiss. */
export default function EfPaybackBanner({ compact = false }: { compact?: boolean }) {
  const info = useEfPayback()
  const { M } = useMask()
  const [open, setOpen] = useState(false)
  if (info.owed < 1) return null

  const oldest = info.open[0]?.tx
  return (
    <>
      <div className="ov-card" style={{ background: 'var(--bad-soft)', gap: 12, ...(compact ? { padding: 14, boxShadow: 'none', border: 'none' } : {}) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--bad)', color: '#fff', display: 'grid', placeItems: 'center', flex: 'none' }}>
              <ShieldAlert size={19} strokeWidth={2.2} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--bad-ink)' }}>You owe your emergency fund</div>
              <Amt value={info.owed} countUp className="ov-mono" style={{ display: 'block', fontSize: compact ? 22 : 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--bad-ink)', lineHeight: 1.2 }} />
              {!compact && (
                <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.45, marginTop: 4 }}>
                  This was your safety net, not spare cash. Put it back before you spend on anything else.
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.45, marginTop: 3 }}>
                {oldest ? `Oldest: ${nameOf(oldest)}, ${ago(info.oldestDays)}. ` : ''}
                {info.freeCash >= 1 ? `You have ${M(inr(info.freeCash))} free right now.` : 'No free cash right now, so the next money in goes here first.'}
              </div>
            </div>
          </div>
          <button onClick={() => setOpen(true)} className="ov-btn" style={{ minHeight: 44, padding: '0 18px', borderRadius: 999, fontSize: 13.5, fontWeight: 800, background: 'var(--bad)', color: '#fff', whiteSpace: 'nowrap' }}>
            {info.suggested > 0 ? `Put back ${M(inr(info.suggested))}` : 'Put it back'}
          </button>
        </div>
        {info.repaid > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <Progress repaid={info.repaid} taken={info.taken} />
            <div style={{ fontSize: 12, color: 'var(--ink2)' }}>{M(inr(info.repaid))} of {M(inr(info.taken))} put back</div>
          </div>
        )}
      </div>
      {open && <PaybackSheet info={info} onClose={() => setOpen(false)} />}
    </>
  )
}

/** Opens once for each new amount of money that arrives while the fund is still owed. */
export function EfPaybackPrompt() {
  const initialized = useAppStore(s => s.initialized)
  const transactions = useAppStore(s => s.transactions)
  const masked = usePrivacy(s => s.masked)
  const hydratePrivacy = usePrivacy(s => s.hydrate)
  const info = useEfPayback()
  const [moneyIn, setMoneyIn] = useState<Transaction | null>(null)
  useEffect(() => { hydratePrivacy() }, [hydratePrivacy])

  const owing = info.owed >= 1
  const pending = useMemo(
    () => (initialized && owing ? latestMoneyIn(transactions) : null),
    [initialized, owing, transactions],
  )

  useEffect(() => {
    if (!pending || moneyIn || masked || readSeen() === pending.id) return
    // Waits for the Add form or any other dialog to close first
    const timer = setInterval(() => {
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return
      clearInterval(timer)
      setMoneyIn(pending)
    }, 1200)
    return () => clearInterval(timer)
  }, [pending, moneyIn, masked])

  if (!moneyIn || !owing) return null
  return (
    <PaybackSheet
      info={info} moneyIn={moneyIn}
      onClose={() => { writeSeen(moneyIn.id); setMoneyIn(null) }}
    />
  )
}
