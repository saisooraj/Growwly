'use client'

import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import { setEmergencyFund } from '@/lib/firestore'
import { buildMonthlySummary, getLast6Months, EMERGENCY_FUND_VEHICLE, formatCurrencyFull } from '@/lib/utils'
import AddTransactionModal from '@/components/transactions/AddTransactionModal'
import { Amt, inr, useMask } from './ui'

export interface EmergencyHandle { setup: () => void }

const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--ink2)' }
const pillBtn = (primary: boolean): React.CSSProperties => ({
  flex: 1, padding: '10px 14px', borderRadius: 999, fontSize: 13, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  background: primary ? 'var(--ink)' : 'var(--surface2)', color: primary ? 'var(--bg)' : 'var(--ink)',
})

const EmergencyCard = forwardRef<EmergencyHandle>(function EmergencyCard(_, ref) {
  const { user } = useAuth()
  const fund = useAppStore(s => s.emergencyFund)
  const transactions = useAppStore(s => s.transactions)
  const settings = useAppStore(s => s.settings)
  const borrowings = useAppStore(s => s.borrowings)
  const month = useAppStore(s => s.selectedMonth)
  const refresh = useRefreshData()
  const router = useRouter()
  const { M } = useMask()
  const [topUp, setTopUp] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [balance, setBalance] = useState('') // first-time setup only; afterwards balance moves through transactions
  const [target, setTarget] = useState('')

  function startEdit() {
    setBalance(String(fund?.currentBalance ?? ''))
    setTarget(fund?.targetAmount ? String(fund.targetAmount) : '')
    setConfirm(false)
    setEditing(true)
  }
  useImperativeHandle(ref, () => ({ setup: startEdit }))

  // Runway: months of average spending (last 3 cycles) the balance covers
  const runway = useMemo(() => {
    if (!fund) return null
    const months = getLast6Months()
    const idx = months.indexOf(month)
    const spend = months.slice(Math.max(0, idx - 3), idx).map(m => buildMonthlySummary(transactions, m, settings, borrowings).totalExpenses).filter(v => v > 0)
    if (!spend.length) return null
    return fund.currentBalance / (spend.reduce((a, b) => a + b, 0) / spend.length)
  }, [fund, transactions, settings, borrowings, month])

  async function save() {
    if (!user) return
    try {
      await setEmergencyFund(user.uid, {
        currentBalance: fund ? fund.currentBalance : (Number(balance) || 0),
        targetAmount: Number(target) || fund?.targetAmount || 0,
        usedAmount: fund?.usedAmount ?? 0,   // derived from withdrawal transactions, never edited here
        lastUpdated: new Date().toISOString(),
      })
      await refresh()
      setEditing(false)
      setConfirm(false)
      toast.success(fund ? 'Goal updated' : 'Emergency fund set up')
    } catch {
      toast.error('Failed to save')
    }
  }

  const header = (sub: string, edit: boolean) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--info-soft)', color: 'var(--info)', display: 'grid', placeItems: 'center', flex: 'none' }}>
        <ShieldCheck size={17} strokeWidth={2.2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800 }}>Emergency fund</div>
        <div style={{ fontSize: 12, color: 'var(--ink2)' }}>{sub}</div>
      </div>
      {edit && (
        <button onClick={e => { e.stopPropagation(); startEdit() }} className="ov-btn" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink2)', padding: '6px 8px', background: 'none' }}>Edit</button>
      )}
    </div>
  )

  if (editing) {
    const isSetup = !fund
    return (
      <div className="ov-card" style={{ gap: 14 }}>
        {header(isSetup ? 'Set up your safety net' : confirm ? 'Confirm the new goal' : 'Edit goal', false)}
        {confirm ? (
          <>
            <div style={{ borderRadius: 14, background: 'var(--surface2)', padding: '4px 14px' }}>
              {isSetup && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
                  <span style={{ color: 'var(--ink2)' }}>Starting balance</span><span className="ov-mono" style={{ fontWeight: 600 }}>{formatCurrencyFull(Number(balance) || 0)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 13 }}>
                <span style={{ color: 'var(--ink2)' }}>Target</span><span className="ov-mono" style={{ fontWeight: 600 }}>{formatCurrencyFull(Number(target) || 0)}</span>
              </div>
            </div>
            {!isSetup && <div style={{ fontSize: 12, color: 'var(--ink3)' }}>Only the target is changing. The balance moves with Top up and withdrawal transactions.</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={save} style={pillBtn(true)}>Confirm</button>
              <button onClick={() => setConfirm(false)} style={pillBtn(false)}>Back</button>
            </div>
          </>
        ) : (
          <>
            {isSetup ? (
              <div style={field}>
                <span style={label}>Starting balance (₹)</span>
                <input className="input" type="number" inputMode="decimal" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0" />
                <span style={{ fontSize: 11.5, color: 'var(--ink3)' }}>What your emergency fund holds today, before you start tracking top-ups.</span>
              </div>
            ) : (
              <div style={{ padding: '10px 14px', borderRadius: 14, background: 'var(--surface2)' }}>
                <div style={{ fontSize: 11.5, color: 'var(--ink2)' }}>Current balance</div>
                <div className="ov-mono" style={{ fontSize: 15, fontWeight: 600 }}>{formatCurrencyFull(fund.currentBalance)}</div>
              </div>
            )}
            <div style={field}>
              <span style={label}>Target (₹)</span>
              <input className="input" type="number" inputMode="decimal" value={target} onChange={e => setTarget(e.target.value)} placeholder="6 months of expenses" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirm(true)} disabled={!(Number(target) > 0)} style={{ ...pillBtn(true), opacity: Number(target) > 0 ? 1 : 0.4, cursor: Number(target) > 0 ? 'pointer' : 'not-allowed' }}>Save</button>
              <button onClick={() => setEditing(false)} style={pillBtn(false)}>Cancel</button>
            </div>
          </>
        )}
      </div>
    )
  }

  if (!fund) {
    return (
      <div className="ov-card" style={{ gap: 12 }}>
        {header('No target set', false)}
        <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.45 }}>Aim for 6 months of expenses. Growwly tracks your runway and warns you when you draw on it.</div>
        <button onClick={startEdit} className="ov-btn" style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 800, padding: '9px 14px', borderRadius: 999, background: 'var(--ink)', color: 'var(--bg)' }}>Set a target</button>
      </div>
    )
  }

  const hasTarget = fund.targetAmount > 0
  const efPct = hasTarget ? Math.max(0, Math.min(100, Math.round((fund.currentBalance / fund.targetAmount) * 100))) : 0
  const color = efPct >= 75 ? 'var(--good)' : efPct >= 40 ? 'var(--warn)' : 'var(--bad)'
  const runwayText = runway === null ? '' : ` · ${runway < 10 ? runway.toFixed(1) : Math.round(runway)} mo runway`

  return (
    <>
      <div className="ov-card" onClick={() => router.push('/networth#emergency-fund')} role="link" style={{ gap: 12, cursor: 'pointer' }}>
        {header(hasTarget ? `Target ${M(inr(fund.targetAmount))}${runwayText}` : `No target set${runwayText}`, true)}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <Amt value={fund.currentBalance} countUp className="ov-mono" style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }} />
          <button onClick={e => { e.stopPropagation(); setTopUp(true) }} className="ov-btn" style={{ fontSize: 12.5, fontWeight: 800, padding: '7px 12px', borderRadius: 999, background: 'var(--brand-soft)', color: 'var(--brand-ink)' }}>+ Top up</button>
        </div>
        {hasTarget && (
          <div style={{ height: 8, borderRadius: 8, background: 'var(--surface2)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${efPct}%`, background: color, borderRadius: 8, transition: 'width 600ms var(--ease-out)' }} />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--ink2)', flexWrap: 'wrap' }}>
          {hasTarget && <span><b style={{ color }}>{efPct}%</b> of target</span>}
          {fund.usedAmount > 0 && <span>Used this year: <Amt value={fund.usedAmount} /></span>}
        </div>
      </div>
      <AddTransactionModal open={topUp} onClose={() => setTopUp(false)} initialTab="savings" initialSavingsVehicle={EMERGENCY_FUND_VEHICLE} />
    </>
  )
})

export default EmergencyCard
