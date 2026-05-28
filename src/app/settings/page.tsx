'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useAuth } from '@/context/AuthContext'
import { useAppStore } from '@/store/appStore'
import { setUserSettings, exportAllUserData, importAllUserData } from '@/lib/firestore'
import { useRefreshData } from '@/hooks/useData'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { downloadJSON } from '@/lib/utils'
import { Download, Upload, Flame, Shield, Wallet, LogOut, Bell, BellOff, BellRing } from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import type { FinancialMode } from '@/types'


export default function SettingsPage() {
  const { user, logout } = useAuth()
  const { settings } = useAppStore()
  const refresh = useRefreshData()
  const fileRef = useRef<HTMLInputElement>(null)
  const { state: pushState, subscribe, unsubscribe } = usePushNotifications()

  const [mode, setMode] = useState<FinancialMode>('normal')
  const [weeklyBudget, setWeeklyBudget] = useState('')
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [efTarget, setEfTarget] = useState('')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pendingImport, setPendingImport] = useState<any | null>(null)

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
        pushReminderEnabled: pushState === 'subscribed',
      })
      await refresh()
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  async function handleTogglePush() {
    if (pushState === 'subscribed') {
      await unsubscribe()
      await setUserSettings(user!.uid, { pushReminderEnabled: false })
      toast.success('Reminders turned off')
    } else {
      const ok = await subscribe()
      if (ok) {
        await setUserSettings(user!.uid, {
          pushReminderEnabled: true,
        })
        toast.success('Reminders enabled!')
      } else if (pushState === 'denied') {
        toast.error('Notifications blocked — enable them in browser settings')
      }
    }
  }

  async function handleExport() {
    if (!user) return
    setExporting(true)
    try {
      const data = await exportAllUserData(user.uid)
      downloadJSON(data, `growwly-backup-${new Date().toISOString().split('T')[0]}.json`)
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
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data.transactions || !data.userId) { toast.error('Invalid backup file'); return }
      setPendingImport(data)
    } catch {
      toast.error('Import failed — invalid file')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function doImport() {
    if (!user || !pendingImport) return
    setImporting(true)
    try {
      await importAllUserData(user.uid, pendingImport)
      await refresh()
      toast.success('Data imported successfully')
    } catch {
      toast.error('Import failed')
    } finally {
      setImporting(false)
      setPendingImport(null)
    }
  }

  const pushUnavailable = pushState === 'unsupported' || pushState === 'denied'
  const pushLoading     = pushState === 'loading'
  const isSubscribed    = pushState === 'subscribed'

  return (
    <AppShell title="Settings">
      <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>

        {/* Account */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Account</h2>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--surface-2)', borderRadius: 12 }}>
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName ?? ''} style={{ width: 40, height: 40, borderRadius: '50%' }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600 }}>
                  {user.displayName?.[0] ?? 'U'}
                </div>
              )}
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0 }}>{user.displayName}</p>
                <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>{user.email}</p>
              </div>
            </div>
          )}
          <button onClick={logout} className="btn-danger" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6 }}>
            <LogOut size={15} /> Sign Out
          </button>
        </div>

        {/* Push Notifications */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: isSubscribed ? 'var(--brand-soft)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isSubscribed ? 'var(--brand)' : 'var(--text-3)' }}>
              <BellRing size={14} />
            </div>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Daily Reminders</h2>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0, lineHeight: 1.5 }}>
            Get a push notification each day to remind you to log your transactions.
          </p>

          {pushState === 'unsupported' && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--surface-2)', fontSize: 12, color: 'var(--text-3)' }}>
              Push notifications are not supported in this browser.
            </div>
          )}

          {pushState === 'denied' && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'color-mix(in oklch, var(--bad) 12%, transparent)', fontSize: 12, color: 'var(--bad-ink)' }}>
              Notifications are blocked. Allow them in your browser / OS settings, then reload.
            </div>
          )}

          {/* Fixed reminder time */}
          {!pushUnavailable && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--surface-2)' }}>
              <span style={{ fontSize: 18 }}>🕖</span>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Fires daily at 7:30 PM IST</p>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>Reminder arrives within an hour of that time.</p>
              </div>
            </div>
          )}

          {!pushUnavailable && (
            <button
              onClick={handleTogglePush}
              disabled={pushLoading}
              className={isSubscribed ? 'btn' : 'btn-primary'}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, opacity: pushLoading ? 0.6 : 1 }}
            >
              {isSubscribed ? <BellOff size={14} /> : <Bell size={14} />}
              {pushLoading ? 'Working…' : isSubscribed ? 'Turn off reminders' : 'Enable reminders'}
            </button>
          )}
        </div>

        {/* Financial Mode */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Flame size={14} style={{ color: 'var(--warn-ink)' }} />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Financial Mode</h2>
          </div>
          <div className="grid grid-cols-2" style={{ gap: 10 }}>
            {([
              { value: 'normal' as const,       label: 'Normal',       desc: 'Standard budget tracking',              emoji: '🧘' },
              { value: 'high-expense' as const, label: 'High Expense', desc: 'Cash pressure alerts, borrow tracking', emoji: '🔥' },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                style={{
                  textAlign: 'left', padding: 12, borderRadius: 12,
                  border: `2px solid ${mode === opt.value ? 'var(--brand)' : 'var(--border)'}`,
                  background: mode === opt.value ? 'var(--brand-soft)' : 'var(--surface)',
                  cursor: 'pointer', transition: 'all .15s',
                }}
              >
                <span style={{ fontSize: 20, display: 'block', marginBottom: 4 }}>{opt.emoji}</span>
                <p style={{ fontSize: 13, fontWeight: 500, color: mode === opt.value ? 'var(--brand-ink)' : 'var(--text)', margin: 0 }}>{opt.label}</p>
                <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: 0, marginTop: 2 }}>{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Budget Targets */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wallet size={14} style={{ color: 'var(--brand)' }} />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Budget Targets</h2>
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
          <button onClick={saveSettings} disabled={saving} className="btn-primary" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>

        {/* Backup & Restore */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={14} style={{ color: 'var(--info-ink)' }} />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Backup & Restore</h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Export all your data as JSON. Re-import anytime to restore on any device.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={handleExport} disabled={exporting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: exporting ? 0.6 : 1 }}>
              <Download size={14} /> {exporting ? 'Exporting…' : 'Export Backup'}
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: importing ? 0.6 : 1 }}>
              <Upload size={14} /> {importing ? 'Importing…' : 'Import Backup'}
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--surface-2)', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7 }}>
            <p style={{ margin: 0 }}>• Exports all transactions, budgets, projects, borrowings & emergency fund</p>
            <p style={{ margin: 0 }}>• Import overwrites existing data — export first as a precaution</p>
          </div>
        </div>

      </div>

      <ConfirmDialog
        open={!!pendingImport}
        message="This will overwrite your existing data with the backup file. Continue?"
        confirmLabel="Import"
        onConfirm={doImport}
        onClose={() => setPendingImport(null)}
      />
    </AppShell>
  )
}
