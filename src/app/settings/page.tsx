'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useAuth } from '@/context/AuthContext'
import { useAppStore } from '@/store/appStore'
import { setUserSettings, exportAllUserData, importAllUserData } from '@/lib/firestore'
import { useRefreshData } from '@/hooks/useData'
import { downloadJSON } from '@/lib/utils'
import { Download, Upload, Flame, Shield, Wallet, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'
import type { FinancialMode } from '@/types'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const { settings } = useAppStore()
  const refresh = useRefreshData()
  const fileRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<FinancialMode>('normal')
  const [weeklyBudget, setWeeklyBudget] = useState('')
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [efTarget, setEfTarget] = useState('')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (settings) {
      setMode(settings.financialMode ?? 'normal')
      setWeeklyBudget(String(settings.weeklyBudget ?? ''))
      setMonthlyIncome(String(settings.monthlyIncomeTarget ?? ''))
      setEfTarget(String(settings.emergencyFundTarget ?? ''))
    }
  }, [settings])

  async function saveSettings() {
    if (!user) return
    setSaving(true)
    try {
      await setUserSettings(user.uid, {
        financialMode: mode,
        weeklyBudget: Number(weeklyBudget) || 0,
        monthlyIncomeTarget: Number(monthlyIncome) || 0,
        emergencyFundTarget: Number(efTarget) || 0,
      })
      await refresh()
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  async function handleExport() {
    if (!user) return
    setExporting(true)
    try {
      const data = await exportAllUserData(user.uid)
      downloadJSON(data, `spendwise-backup-${new Date().toISOString().split('T')[0]}.json`)
      toast.success('Data exported successfully')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user || !e.target.files?.[0]) return
    const file = e.target.files[0]
    setImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data.transactions || !data.userId) { toast.error('Invalid backup file'); return }
      if (!confirm('This will overwrite your existing data. Continue?')) return
      await importAllUserData(user.uid, data)
      await refresh()
      toast.success('Data imported successfully')
    } catch {
      toast.error('Import failed — invalid file')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <AppShell title="Settings">
      <div className="max-w-xl space-y-5">

        {/* Account */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-slate-800">Account</h2>
          {user && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName ?? ''} className="w-10 h-10 rounded-full" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white font-semibold">
                  {user.displayName?.[0] ?? 'U'}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-slate-800">{user.displayName}</p>
                <p className="text-xs text-slate-400">{user.email}</p>
              </div>
            </div>
          )}
          <button onClick={logout} className="btn-danger">
            <LogOut size={15} /> Sign Out
          </button>
        </div>

        {/* Financial Mode */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <Flame size={16} className="text-orange-500" />
            <h2 className="font-semibold text-slate-800">Financial Mode</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'normal' as const,       label: 'Normal Mode',       desc: 'Standard budget tracking',              icon: '🧘' },
              { value: 'high-expense' as const, label: 'High Expense Mode', desc: 'Cash pressure alerts, borrow tracking', icon: '🔥' },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={`text-left p-3 rounded-xl border-2 transition-all ${
                  mode === opt.value ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="text-xl mb-1 block">{opt.icon}</span>
                <p className="text-sm font-medium text-slate-800">{opt.label}</p>
                <p className="text-xs text-slate-500">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Budget Targets */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-brand-500" />
            <h2 className="font-semibold text-slate-800">Budget Targets</h2>
          </div>
          <div>
            <label className="label">Monthly Income Target (₹)</label>
            <input type="number" className="input" placeholder="e.g. 80000" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} />
          </div>
          <div>
            <label className="label">Weekly Spending Budget (₹)</label>
            <input type="number" className="input" placeholder="e.g. 3000" value={weeklyBudget} onChange={(e) => setWeeklyBudget(e.target.value)} />
          </div>
          <div>
            <label className="label">Emergency Fund Target (₹)</label>
            <input type="number" className="input" placeholder="e.g. 200000" value={efTarget} onChange={(e) => setEfTarget(e.target.value)} />
          </div>
          <button onClick={saveSettings} disabled={saving} className="btn-primary disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* Backup & Restore */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-teal-500" />
            <h2 className="font-semibold text-slate-800">Backup & Restore</h2>
          </div>
          <p className="text-sm text-slate-500">Export all your data as JSON. Re-import anytime to restore on any device.</p>
          <div className="flex gap-3 flex-wrap">
            <button onClick={handleExport} disabled={exporting} className="btn-primary disabled:opacity-60">
              <Download size={15} /> {exporting ? 'Exporting...' : 'Export Backup'}
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn-secondary disabled:opacity-60">
              <Upload size={15} /> {importing ? 'Importing...' : 'Import Backup'}
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-1">
            <p>• Exports all transactions, budgets, projects, borrowings & emergency fund</p>
            <p>• Import overwrites existing data — export first as a precaution</p>
            <p>• Recommended: export monthly for data safety</p>
          </div>
        </div>

      </div>
    </AppShell>
  )
}
