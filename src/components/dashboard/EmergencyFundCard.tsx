'use client'

import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { formatCurrencyFull } from '@/lib/utils'
import { setEmergencyFund } from '@/lib/firestore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import toast from 'react-hot-toast'

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
  const { emergencyFund } = useAppStore()
  const refresh = useRefreshData()
  const [editing, setEditing] = useState(false)
  const [balance, setBalance] = useState('')
  const [target, setTarget] = useState('')
  const [used, setUsed] = useState('')

  const pct = emergencyFund
    ? Math.min((emergencyFund.currentBalance / emergencyFund.targetAmount) * 100, 100)
    : 0
  const efTone = pct >= 75 ? 'good' : pct >= 40 ? 'warn' : 'bad'

  async function save() {
    if (!user) return
    try {
      await setEmergencyFund(user.uid, {
        currentBalance: Number(balance) || emergencyFund?.currentBalance || 0,
        targetAmount:   Number(target)  || emergencyFund?.targetAmount  || 0,
        usedAmount:     Number(used)    || emergencyFund?.usedAmount    || 0,
        lastUpdated: new Date().toISOString(),
      })
      await refresh()
      setEditing(false)
      toast.success('Emergency fund updated')
    } catch {
      toast.error('Failed to update')
    }
  }

  function startEdit() {
    setBalance(String(emergencyFund?.currentBalance ?? ''))
    setTarget(String(emergencyFund?.targetAmount ?? ''))
    setUsed(String(emergencyFund?.usedAmount ?? ''))
    setEditing(true)
  }

  if (editing) {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="h-eyebrow">Edit emergency fund</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label className="label">Current Balance (₹)</label>
            <input className="input" type="number" value={balance} onChange={e => setBalance(e.target.value)} />
          </div>
          <div>
            <label className="label">Target Amount (₹)</label>
            <input className="input" type="number" value={target} onChange={e => setTarget(e.target.value)} />
          </div>
          <div>
            <label className="label">Used Amount (₹)</label>
            <input className="input" type="number" value={used} onChange={e => setUsed(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Save</button>
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
                Target {formatCurrencyFull(emergencyFund.targetAmount)} · 6 mo runway
              </div>
            )}
          </div>
        </div>
        <button
          onClick={startEdit}
          className="btn btn-sm"
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          {emergencyFund ? 'Top up' : 'Set up'}
        </button>
      </div>

      {emergencyFund ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'space-between' }}>
            <div>
              <div className="display-num" style={{ fontSize: 30, color: 'var(--text)' }}>
                {formatCurrencyFull(emergencyFund.currentBalance)}
              </div>
              {emergencyFund.usedAmount > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                  Used this year: {formatCurrencyFull(emergencyFund.usedAmount)}
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
        </>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
          Click &quot;Set up&quot; to configure your emergency fund tracker.
        </p>
      )}
    </div>
  )
}
