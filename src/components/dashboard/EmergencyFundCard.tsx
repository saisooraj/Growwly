'use client'

import { useState, useMemo } from 'react'
import { ShieldCheck, ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp, ArrowRight, Eye, EyeOff, Pencil } from 'lucide-react'
import Link from 'next/link'
import { useAppStore } from '@/store/appStore'
import { formatCurrencyFull, EMERGENCY_FUND_VEHICLE } from '@/lib/utils'
import { setEmergencyFund } from '@/lib/firestore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import AddTransactionModal from '@/components/transactions/AddTransactionModal'

function Bar({ value, tone = 'good', height = 6 }: { value: number; tone?: string; height?: number }) {
  const pct = Math.min(100, Math.max(0, value))
  const color =
    tone === 'bad'  ? 'var(--bad)'  :
    tone === 'warn' ? 'var(--warn)' :
    tone === 'brand'? 'var(--brand)':
    tone === 'info' ? 'var(--info)' :
    'var(--good)'
  return (
    <div style={{ height, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width .4s cubic-bezier(.4,0,.2,1)' }} />
    </div>
  )
}

export default function EmergencyFundCard() {
  const { user } = useAuth()
  const { emergencyFund, transactions } = useAppStore()
  const refresh = useRefreshData()

  const efTransactions = useMemo(() => {
    return transactions
      .filter(t =>
        t.type === 'transfer' && (
          t.transferKind === 'ef_withdrawal' ||
          (t.transferKind === 'savings_withdrawal' && t.savingsVehicle === EMERGENCY_FUND_VEHICLE) ||
          ((t.transferKind === 'savings_contribution' || t.transferKind === 'savings_transfer') &&
            t.savingsVehicle === EMERGENCY_FUND_VEHICLE)
        )
      )
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [transactions])

  const [masked, setMasked] = useState(true)
  const [txOpen, setTxOpen] = useState(false)
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmEdit, setConfirmEdit] = useState(false)
  const [balance, setBalance] = useState('') // only used during first-time setup
  const [target, setTarget] = useState('')

  const pct = emergencyFund
    ? Math.min((emergencyFund.currentBalance / emergencyFund.targetAmount) * 100, 100)
    : 0
  const efTone = pct >= 75 ? 'good' : pct >= 40 ? 'warn' : 'bad'

  async function save() {
    if (!user) return
    try {
      await setEmergencyFund(user.uid, {
        // balance only set on first-time setup; afterwards driven by transactions
        currentBalance: emergencyFund ? emergencyFund.currentBalance : (Number(balance) || 0),
        targetAmount:   Number(target) || emergencyFund?.targetAmount || 0,
        // usedAmount is derived from withdrawal transactions, never manually edited
        usedAmount:     emergencyFund?.usedAmount ?? 0,
        lastUpdated: new Date().toISOString(),
      })
      await refresh()
      setEditing(false)
      setConfirmEdit(false)
      toast.success(emergencyFund ? 'Goal updated' : 'Emergency fund set up')
    } catch {
      toast.error('Failed to save')
    }
  }

  function startEdit() {
    setBalance(String(emergencyFund?.currentBalance ?? ''))
    setTarget(String(emergencyFund?.targetAmount ?? ''))
    setConfirmEdit(false)
    setEditing(true)
  }

  if (editing) {
    const isSetup = !emergencyFund

    // ── Confirm step ──────────────────────────────────────────────────────────
    if (confirmEdit) {
      return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="h-eyebrow">Confirm {isSetup ? 'setup' : 'update'}</div>

          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {isSetup && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Starting balance</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{formatCurrencyFull(Number(balance) || 0)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Goal</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{formatCurrencyFull(Number(target) || 0)}</span>
            </div>
          </div>

          {!isSetup && (
            <p style={{ fontSize: 12, color: 'var(--text-4)', margin: 0 }}>
              Only the goal is changing. Balance updates happen through Top up or withdrawal transactions.
            </p>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Confirm</button>
            <button onClick={() => setConfirmEdit(false)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Back</button>
          </div>
        </div>
      )
    }

    // ── Edit step ─────────────────────────────────────────────────────────────
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="h-eyebrow">{isSetup ? 'Set up emergency fund' : 'Edit goal'}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isSetup ? (
            <div>
              <label className="label">Starting balance (₹)</label>
              <input className="input" type="number" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0" />
              <p style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 4 }}>
                Your current emergency fund balance before you start tracking contributions.
              </p>
            </div>
          ) : (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 2 }}>Current balance</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{formatCurrencyFull(emergencyFund.currentBalance)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>
                Use <strong>Top up</strong> to add money or log a <strong>withdrawal</strong> — balance updates through transactions.
              </div>
            </div>
          )}

          <div>
            <label className="label">Goal (₹)</label>
            <input className="input" type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="0" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { if (Number(target) > 0 || (!isSetup)) setConfirmEdit(true) }}
            className="btn-primary"
            style={{ flex: 1, justifyContent: 'center' }}
            disabled={!target || Number(target) <= 0}
          >
            Save
          </button>
          <button onClick={() => setEditing(false)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'var(--warn-soft)', color: 'var(--warn-ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldCheck size={16} />
          </div>
          <div>
            <div className="h-eyebrow">Emergency fund</div>
            {emergencyFund && (
              <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>
                Target {masked ? '₹ ••••' : formatCurrencyFull(emergencyFund.targetAmount)} · 6 mo runway
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => setMasked(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-3)', display: 'flex' }}
          >
            {masked ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          {emergencyFund ? (
            <>
              <button
                onClick={() => setTopUpOpen(true)}
                className="btn btn-sm"
                style={{ whiteSpace: 'nowrap' }}
              >
                Top up
              </button>
              <button
                onClick={startEdit}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-3)', display: 'flex', borderRadius: 6 }}
                title="Edit fund settings"
              >
                <Pencil size={13} />
              </button>
            </>
          ) : (
            <button
              onClick={startEdit}
              className="btn btn-sm"
              style={{ whiteSpace: 'nowrap' }}
            >
              Set up
            </button>
          )}
        </div>
      </div>

      {emergencyFund ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'space-between' }}>
            <div>
              <div className="display-num" style={{ fontSize: 30, color: 'var(--text)' }}>
                {masked ? '₹ ••••••' : formatCurrencyFull(emergencyFund.currentBalance)}
              </div>
              {emergencyFund.usedAmount > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                  Used this year: {masked ? '₹ ••••' : formatCurrencyFull(emergencyFund.usedAmount)}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="num" style={{ fontSize: 16, fontWeight: 500, color: 'var(--warn-ink)' }}>
                {Math.round(pct)}%
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>funded</div>
            </div>
          </div>
          <Bar value={pct} tone={efTone} height={6} />

          {efTransactions.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 4 }}>
              <button
                onClick={() => setTxOpen(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '10px 0 4px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--text-3)',
                }}
              >
                <span style={{ fontSize: 11.5, fontWeight: 500 }}>
                  {efTransactions.length} transaction{efTransactions.length !== 1 ? 's' : ''}
                </span>
                {txOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {txOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {efTransactions.map(t => {
                    const isWithdrawal =
                      t.transferKind === 'ef_withdrawal' ||
                      (t.transferKind === 'savings_withdrawal' && t.savingsVehicle === EMERGENCY_FUND_VEHICLE)
                    return (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                          background: isWithdrawal ? 'var(--bad-soft)' : 'var(--good-soft)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {isWithdrawal
                            ? <ArrowDownLeft size={13} style={{ color: 'var(--bad-ink)' }} />
                            : <ArrowUpRight size={13} style={{ color: 'var(--good-ink)' }} />
                          }
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t.notes || (isWithdrawal ? 'Withdrawal' : 'Contribution')}
                          </p>
                          <p style={{ fontSize: 10.5, color: 'var(--text-4)', margin: 0 }}>
                            {format(parseISO(t.date), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: isWithdrawal ? 'var(--bad-ink)' : 'var(--good-ink)', flexShrink: 0 }}>
                          {masked ? '₹ ••••' : `${isWithdrawal ? '−' : '+'}${formatCurrencyFull(t.amount)}`}
                        </span>
                      </div>
                    )
                  })}

                  <Link
                    href={`/transactions?type=savings&vehicle=${encodeURIComponent(EMERGENCY_FUND_VEHICLE)}`}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      padding: '8px 0', marginTop: 4,
                      borderTop: '1px solid var(--border)',
                      fontSize: 12, fontWeight: 500,
                      color: 'var(--brand-ink)', textDecoration: 'none',
                    }}
                  >
                    See all <ArrowRight size={13} />
                  </Link>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
          Click &quot;Set up&quot; to configure your emergency fund tracker.
        </p>
      )}

      <AddTransactionModal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        initialTab="savings"
        initialSavingsVehicle={EMERGENCY_FUND_VEHICLE}
      />
    </div>
  )
}
