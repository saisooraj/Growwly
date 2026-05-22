'use client'

import { ShieldCheck, Edit2 } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { formatCurrencyFull } from '@/lib/utils'
import { useState } from 'react'
import { setEmergencyFund } from '@/lib/firestore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import toast from 'react-hot-toast'

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

  const barColor = pct < 30 ? 'bg-red-500' : pct < 70 ? 'bg-yellow-400' : 'bg-green-500'

  async function save() {
    if (!user) return
    try {
      await setEmergencyFund(user.uid, {
        currentBalance: Number(balance) || emergencyFund?.currentBalance || 0,
        targetAmount: Number(target) || emergencyFund?.targetAmount || 0,
        usedAmount: Number(used) || emergencyFund?.usedAmount || 0,
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

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-teal-500" />
          <h3 className="text-sm font-semibold text-slate-700">Emergency Fund</h3>
        </div>
        <button onClick={startEdit} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
          <Edit2 size={14} />
        </button>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="label">Current Balance (₹)</label>
            <input className="input" type="number" value={balance} onChange={(e) => setBalance(e.target.value)} />
          </div>
          <div>
            <label className="label">Target Amount (₹)</label>
            <input className="input" type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
          <div>
            <label className="label">Used Amount (₹)</label>
            <input className="input" type="number" value={used} onChange={(e) => setUsed(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="btn-primary flex-1 justify-center">Save</button>
            <button onClick={() => setEditing(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
          </div>
        </div>
      ) : emergencyFund ? (
        <>
          <div className="flex justify-between mb-2">
            <span className="text-2xl font-bold text-slate-800">
              {formatCurrencyFull(emergencyFund.currentBalance)}
            </span>
            <span className="text-sm text-slate-400 self-end">
              of {formatCurrencyFull(emergencyFund.targetAmount)}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2">
            <div
              className={`h-2.5 rounded-full transition-all duration-700 ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>{pct.toFixed(0)}% funded</span>
            {emergencyFund.usedAmount > 0 && (
              <span className="text-orange-500">Used: {formatCurrencyFull(emergencyFund.usedAmount)}</span>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-400">Click edit to set up your emergency fund tracker.</p>
      )}
    </div>
  )
}
