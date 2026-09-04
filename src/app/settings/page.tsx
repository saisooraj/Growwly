'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import AppShell from '@/components/layout/AppShell'
import { DEFAULT_CARD_ORDER } from '@/lib/dashboardConstants'
import { useAuth } from '@/context/AuthContext'
import { useAppStore } from '@/store/appStore'
import { setUserSettings, exportAllUserData, importAllUserData, deleteAllUserData } from '@/lib/firestore'
import { useRefreshData } from '@/hooks/useData'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { downloadJSON, getLast6Months, computeLongestMoneyStreak } from '@/lib/utils'
import { getCycleRange, getLastWorkingDay, formatCycleRange } from '@/lib/cycle'
import { Download, Upload, Flame, Shield, Wallet, LogOut, Bell, BellOff, BellRing, Link2, CalendarClock, Pencil, X, Clock, LayoutGrid, Activity, CheckSquare, Palette, Check, ChevronUp, ChevronDown, Trash2, AlertTriangle, Leaf, Bug, Lightbulb, MessageCircle, Send } from 'lucide-react'
import { BADGES, getBadgeEarnedDate, type BadgeDef } from '@/lib/badges'
import { IconLeaf, IconFlame } from '@tabler/icons-react'
import LinkedAccounts from '@/components/auth/LinkedAccounts'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import type { FinancialMode, FeedbackType } from '@/types'
import { submitFeedback } from '@/lib/feedback'

type SalaryCycleRule = 'none' | 'last-working-day' | 'fixed-day'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const { settings, transactions } = useAppStore()

  // Admin easter egg — tap the account card 5× to open the admin console
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
  const isAdmin = !!adminEmail && user?.email === adminEmail
  const adminTapCount = useRef(0)
  const adminTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleAccountCardTap() {
    if (!isAdmin) return
    adminTapCount.current += 1
    if (adminTapTimer.current) clearTimeout(adminTapTimer.current)
    if (adminTapCount.current >= 5) {
      adminTapCount.current = 0
      toast.success('Opening admin console…')
      router.push('/admin')
      return
    }
    adminTapTimer.current = setTimeout(() => { adminTapCount.current = 0 }, 1500)
  }

  useEffect(() => () => { if (adminTapTimer.current) clearTimeout(adminTapTimer.current) }, [])
  const longestMoneyStreak = computeLongestMoneyStreak(transactions, settings?.noSpendDays ?? [])
  const refresh = useRefreshData()
  const fileRef = useRef<HTMLInputElement>(null)
  const { state: pushState, subscribe, unsubscribe } = usePushNotifications()

  const [reminderHour, setReminderHour] = useState(19)
  const [mode, setMode] = useState<FinancialMode>('normal')
  const [weeklyBudget, setWeeklyBudget] = useState('')
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [efTarget, setEfTarget] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingTargets, setEditingTargets] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pendingImport, setPendingImport] = useState<any | null>(null)

  // Delete account
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Account options (More menu) — step 'options' lists actions, 'danger' shows the Danger Zone
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [accountMenuStep, setAccountMenuStep] = useState<'options' | 'danger'>('options')

  // Feedback
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [sendingFeedback, setSendingFeedback] = useState(false)

  // Badge modal
  const [selectedBadge, setSelectedBadge] = useState<BadgeDef | null>(null)
  const txDates = transactions.map(t => t.date)
  const noSpendDays = settings?.noSpendDays ?? []

  // Accent color
  const [accentColor, setAccentColor] = useState<'green' | 'purple' | 'orange' | 'pink' | 'blue' | 'black'>('green')

  // Navigation tab toggles
  const [showHealthTab, setShowHealthTab] = useState(false)
  const [showTasksTab, setShowTasksTab]   = useState(false)
  const [savingTabs, setSavingTabs]       = useState(false)

  // Dashboard card order
  const [cardOrder, setCardOrder] = useState<string[]>(DEFAULT_CARD_ORDER)
  const [orderDirty, setOrderDirty] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)

  // Salary cycle
  const [cycleRule, setCycleRule]           = useState<SalaryCycleRule>('none')
  const [cycleFixedDay, setCycleFixedDay]   = useState('28')
  const [cycleOverrides, setCycleOverrides] = useState<Record<string, string>>({})
  const [savingCycle, setSavingCycle]       = useState(false)
  const [editingCycle, setEditingCycle]     = useState(false)
  const [editingMonth, setEditingMonth]     = useState<string | null>(null)
  const [editDate, setEditDate]             = useState('')

  useEffect(() => {
    if (settings) {
      setReminderHour(settings.pushReminderHour ?? 19)
      setMode(settings.financialMode ?? 'normal')
      setWeeklyBudget(String(settings.weeklyBudget ?? ''))
      setMonthlyIncome(String(settings.monthlyIncomeTarget ?? ''))
      setEfTarget(String(settings.emergencyFundTarget ?? ''))
      setCycleRule((settings.salaryCycleRule ?? 'none') as SalaryCycleRule)
      setCycleFixedDay(String(settings.salaryCycleFixedDay ?? 28))
      setCycleOverrides(settings.cycleOverrides ?? {})
      setShowHealthTab(settings.showHealthTab ?? false)
      setShowTasksTab(settings.showTasksTab ?? false)
      setAccentColor((settings.accentColor as typeof accentColor) ?? 'green')
      // A saved order predates newer blocks — append any default block missing
      // from it so it shows up here and can be reordered (mirrors src/app/page.tsx).
      const saved = settings.dashboardCardOrder
      setCardOrder(saved
        ? [...saved, ...DEFAULT_CARD_ORDER.filter(id => !saved.includes(id))]
        : DEFAULT_CARD_ORDER)
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
      toast.success('Saved')
      setEditingTargets(false)
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

  async function saveReminderHour(hour: number) {
    setReminderHour(hour)
    if (user) {
      await setUserSettings(user.uid, { pushReminderHour: hour })
      toast.success('Reminder time saved')
    }
  }

  async function saveCycleSettings() {
    if (!user) return
    setSavingCycle(true)
    try {
      await setUserSettings(user.uid, {
        salaryCycleRule: cycleRule,
        salaryCycleFixedDay: Number(cycleFixedDay) || 28,
        cycleOverrides,
      })
      await refresh()
      toast.success('Salary cycle saved')
      setEditingCycle(false)
    } catch {
      toast.error('Failed to save cycle')
    } finally {
      setSavingCycle(false)
    }
  }

  async function saveAccent(color: typeof accentColor) {
    if (!user) return
    setAccentColor(color)
    // Apply immediately via data-accent attribute (AppShell watches settings,
    // but we also set it here for instant feedback before refresh)
    if (color === 'green') document.documentElement.removeAttribute('data-accent')
    else document.documentElement.setAttribute('data-accent', color)
    try {
      await setUserSettings(user.uid, { accentColor: color })
      await refresh()
    } catch { toast.error('Failed to save accent') }
  }

  async function saveTabSettings(field: 'showHealthTab' | 'showTasksTab', value: boolean) {
    if (!user) return
    setSavingTabs(true)
    try {
      await setUserSettings(user.uid, { [field]: value })
      await refresh()
    } catch {
      toast.error('Failed to save')
    } finally {
      setSavingTabs(false)
    }
  }

  async function saveOverride(budgetMonth: string, date: string) {
    if (!user || !date) return
    const updated = { ...cycleOverrides, [budgetMonth]: date }
    setCycleOverrides(updated)
    setEditingMonth(null)
    await setUserSettings(user.uid, { cycleOverrides: updated })
    toast.success('Override saved')
  }

  async function clearOverride(budgetMonth: string) {
    if (!user) return
    const { [budgetMonth]: _, ...rest } = cycleOverrides
    setCycleOverrides(rest)
    await setUserSettings(user.uid, { cycleOverrides: rest })
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

  async function handleSendFeedback() {
    if (!user || !feedbackMessage.trim()) return
    setSendingFeedback(true)
    try {
      const idToken = await user.getIdToken()
      await submitFeedback(idToken, { type: feedbackType, message: feedbackMessage.trim(), context: 'settings' })
      setFeedbackMessage('')
      toast.success("Thanks — we'll take a look")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to send feedback')
    } finally {
      setSendingFeedback(false)
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

  async function doDeleteAccount() {
    if (!user || deleteConfirmText.toLowerCase() !== 'delete') return
    setDeleting(true)
    try {
      await deleteAllUserData(user.uid, user)
      // Auth account is now deleted — sign out cleans up local state
      await logout()
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'auth/requires-recent-login') {
        toast.error('Please sign out and sign back in, then try again.')
      } else {
        toast.error('Failed to delete account. Please try again.')
      }
    } finally {
      setDeleting(false)
      setDeleteModalOpen(false)
      setDeleteConfirmText('')
    }
  }

  const pushUnavailable = pushState === 'unsupported' || pushState === 'denied'
  const pushLoading     = pushState === 'loading'
  const isSubscribed    = pushState === 'subscribed'

  return (
    <AppShell title="Settings">
      <div className="anim-page" style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>

        {/* About Growwly */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 13, flexShrink: 0,
              background: 'linear-gradient(150deg, var(--brand-2) 0%, var(--brand) 100%)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 16px -5px var(--brand), inset 0 1px 0 rgba(255,255,255,.25)',
            }}>
              <Leaf size={20} strokeWidth={2} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>Growwly</h2>
              <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, letterSpacing: '.06em', textTransform: 'uppercase' }}>Your personal Money OS</p>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.65 }}>
            Growwly is more than a finance tracker — it&apos;s your complete money operating system. Track spending, manage savings goals, monitor net worth, stay on top of upcoming bills, and plan for financial independence, all in one place.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Smart budgeting', desc: 'Weekly & monthly spend control' },
              { label: 'Net worth tracking', desc: 'Assets, loans & savings in one view' },
              { label: 'Emergency fund', desc: 'Know your financial safety net' },
              { label: 'FI calculator', desc: 'Track your path to freedom' },
            ].map(({ label, desc }) => (
              <div key={label} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', margin: '0 0 2px' }}>{label}</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Account */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Account</h2>
            <button
              onClick={() => { setAccountMenuStep('options'); setAccountMenuOpen(true) }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 12.5, fontWeight: 600, color: 'var(--text-3)',
              }}
            >
              More, or wanna leave?
            </button>
          </div>
          {user && (
            <div
              onClick={handleAccountCardTap}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--surface-2)', borderRadius: 12, userSelect: 'none' }}
            >
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

          {/* Reminder time picker */}
          {isSubscribed && (() => {
            const TIMES = [
              { hour: 8,  label: 'Morning — 8:30 AM' },
              { hour: 19, label: 'Evening — 7:30 PM' },
            ]
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--surface-2)' }}>
                <Clock size={18} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>Reminder time (IST)</p>
                  <select
                    value={reminderHour}
                    onChange={e => saveReminderHour(Number(e.target.value))}
                    style={{
                      fontSize: 13, padding: '5px 10px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 8, color: 'var(--text)',
                      outline: 'none', cursor: 'pointer', width: '100%',
                    }}
                  >
                    {TIMES.map(t => (
                      <option key={t.hour} value={t.hour}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })()}

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
              { value: 'normal' as const,       label: 'Normal',       desc: 'Standard budget tracking',              Icon: IconLeaf,  color: 'var(--good-ink)' },
              { value: 'high-expense' as const, label: 'High Expense', desc: 'Cash pressure alerts, borrow tracking', Icon: IconFlame, color: 'var(--warn-ink)' },
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
                <opt.Icon size={22} style={{ color: opt.color, marginBottom: 4 }} />
                <p style={{ fontSize: 13, fontWeight: 500, color: mode === opt.value ? 'var(--brand-ink)' : 'var(--text)', margin: 0 }}>{opt.label}</p>
                <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: 0, marginTop: 2 }}>{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Budget Targets */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wallet size={14} style={{ color: 'var(--brand)' }} />
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Budget Targets</h2>
            </div>
            {!editingTargets && (
              <button
                onClick={() => setEditingTargets(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--text-3)', fontSize: 12 }}
              >
                <Pencil size={12} /> Edit
              </button>
            )}
          </div>

          {!editingTargets ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Monthly Income Target', value: settings?.monthlyIncomeTarget },
                { label: 'Weekly Spending Budget', value: settings?.weeklyBudget },
                { label: 'Emergency Fund Target', value: settings?.emergencyFundTarget },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: value ? 'var(--text)' : 'var(--text-4)' }}>
                    {value ? `₹${Number(value).toLocaleString('en-IN')}` : 'Not set'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div>
                <label className="label">Monthly Income Target (₹)</label>
                <input type="number" className="input" placeholder="e.g. 80000" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="label">Weekly Spending Budget (₹)</label>
                <input type="number" className="input" placeholder="e.g. 3000" value={weeklyBudget} onChange={(e) => setWeeklyBudget(e.target.value)} />
              </div>
              <div>
                <label className="label">Emergency Fund Target (₹)</label>
                <input type="number" className="input" placeholder="e.g. 200000" value={efTarget} onChange={(e) => setEfTarget(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setEditingTargets(false); setMonthlyIncome(String(settings?.monthlyIncomeTarget ?? '')); setWeeklyBudget(String(settings?.weeklyBudget ?? '')); setEfTarget(String(settings?.emergencyFundTarget ?? '')) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-2)', fontSize: 13 }}
                >
                  <X size={13} /> Cancel
                </button>
                <button onClick={saveSettings} disabled={saving} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Salary Cycle */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarClock size={14} style={{ color: 'var(--brand)' }} />
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Salary Cycle</h2>
            </div>
            {!editingCycle && (
              <button
                onClick={() => setEditingCycle(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--text-3)', fontSize: 12 }}
              >
                <Pencil size={12} /> Edit
              </button>
            )}
          </div>

          {/* Read-only summary */}
          {!editingCycle && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)', fontSize: 13, color: 'var(--text-2)' }}>
              {cycleRule === 'none' && 'Off — using calendar month'}
              {cycleRule === 'last-working-day' && 'Last working day of previous month (Mon–Fri)'}
              {cycleRule === 'fixed-day' && `Day ${cycleFixedDay} of previous month`}
            </div>
          )}

          {/* Edit form */}
          {editingCycle && (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0, lineHeight: 1.5 }}>
                Salary credited on the last day of a month is budgeted for the next month. Set your cycle so cashflow matches reality.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label className="label">Cycle starts on</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {([
                    { value: 'none',             label: 'Off — use calendar month' },
                    { value: 'last-working-day', label: 'Last working day of previous month (Mon–Fri)' },
                    { value: 'fixed-day',        label: 'Fixed day of previous month' },
                  ] as { value: SalaryCycleRule; label: string }[]).map(opt => (
                    <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text-2)' }}>
                      <input
                        type="radio"
                        name="cycleRule"
                        value={opt.value}
                        checked={cycleRule === opt.value}
                        onChange={() => setCycleRule(opt.value)}
                        style={{ accentColor: 'var(--brand)' }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
                {cycleRule === 'fixed-day' && (
                  <div style={{ marginTop: 4 }}>
                    <label className="label">Day of month (1–31)</label>
                    <input
                      type="number"
                      className="input"
                      min={1} max={31}
                      value={cycleFixedDay}
                      onChange={e => setCycleFixedDay(e.target.value)}
                      style={{ maxWidth: 100 }}
                    />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setEditingCycle(false); setCycleRule((settings?.salaryCycleRule ?? 'none') as SalaryCycleRule); setCycleFixedDay(String(settings?.salaryCycleFixedDay ?? 28)) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-2)', fontSize: 13 }}
                >
                  <X size={13} /> Cancel
                </button>
                <button
                  onClick={saveCycleSettings}
                  disabled={savingCycle}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: savingCycle ? 0.6 : 1 }}
                >
                  {savingCycle ? 'Saving…' : 'Save'}
                </button>
              </div>
            </>
          )}

          {/* Per-month override table — only in edit mode */}
          {editingCycle && cycleRule !== 'none' && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 }}>
                Cycle start dates <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>— edit if salary came on a different day</span>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {getLast6Months().reverse().map(bm => {
                  const override  = cycleOverrides[bm]
                  const autoStart = cycleRule === 'last-working-day'
                    ? (() => { const [y, m] = bm.split('-').map(Number); const py = m === 1 ? y-1 : y; const pm = m === 1 ? 12 : m-1; return getLastWorkingDay(py, pm) })()
                    : (() => { const [y, m] = bm.split('-').map(Number); const py = m === 1 ? y-1 : y; const pm = m === 1 ? 12 : m-1; const lastDay = new Date(py, pm, 0).getDate(); const day = Math.min(Number(cycleFixedDay)||28, lastDay); return format(new Date(py, pm-1, day), 'yyyy-MM-dd') })()
                  const activeStart = override ?? autoStart
                  const { end } = getCycleRange(bm, { ...settings, salaryCycleRule: cycleRule, salaryCycleFixedDay: Number(cycleFixedDay)||28, cycleOverrides } as Parameters<typeof getCycleRange>[1])
                  const isEditing = editingMonth === bm

                  return (
                    <div key={bm} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: isEditing ? 'var(--surface-2)' : 'transparent' }}>
                      <div style={{ minWidth: 80, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                        {format(parseISO(`${bm}-01`), 'MMM yyyy')}
                      </div>
                      <div style={{ flex: 1, fontSize: 12, color: 'var(--text-2)' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="date"
                              className="input"
                              style={{ fontSize: 12, padding: '4px 8px', maxWidth: 160 }}
                              value={editDate}
                              onChange={e => setEditDate(e.target.value)}
                            />
                            <button className="btn btn-sm btn-primary" onClick={() => saveOverride(bm, editDate)} disabled={!editDate}>Save</button>
                            <button className="btn btn-sm" onClick={() => setEditingMonth(null)}>Cancel</button>
                          </div>
                        ) : (
                          <span>
                            {format(parseISO(activeStart), 'MMM d, EEE')}
                            {' '}
                            <span style={{ fontSize: 11, color: 'var(--text-4)' }}>→ {format(parseISO(end), 'MMM d')}</span>
                            {' '}
                            {override
                              ? <span style={{ fontSize: 10.5, background: 'var(--warn-soft)', color: 'var(--warn-ink)', padding: '1px 6px', borderRadius: 999 }}>custom</span>
                              : <span style={{ fontSize: 10.5, color: 'var(--text-4)' }}>auto</span>
                            }
                          </span>
                        )}
                      </div>
                      {!isEditing && (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button
                            onClick={() => { setEditingMonth(bm); setEditDate(activeStart) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, display: 'flex' }}
                            title="Edit cycle start"
                          >
                            <Pencil size={12} />
                          </button>
                          {override && (
                            <button
                              onClick={() => clearOverride(bm)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bad-ink)', padding: 4, display: 'flex' }}
                              title="Reset to auto"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Linked Accounts */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link2 size={14} style={{ color: 'var(--brand-ink)' }} />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Linked Accounts</h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
            Link multiple sign-in methods. Your data stays the same regardless of which method you use.
          </p>
          <LinkedAccounts />
        </div>

        {/* Accent Color */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Palette size={14} style={{ color: 'var(--brand)' }} />
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Accent Color</h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0, lineHeight: 1.5 }}>
            Changes the brand color across the entire app. Saved to your account and syncs across devices.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {([
              { id: 'green'  as const, label: 'Forest',  swatch: 'oklch(0.62 0.15 158)',   soft: 'oklch(0.95 0.05 162)',  gradient: undefined },
              { id: 'purple' as const, label: 'Violet',  swatch: 'oklch(0.585 0.205 286)', soft: 'oklch(0.95 0.04 286)',  gradient: undefined },
              { id: 'orange' as const, label: 'Ember',   swatch: 'oklch(0.66 0.19 42)',    soft: 'oklch(0.95 0.05 50)',   gradient: undefined },
              { id: 'pink'   as const, label: 'Rose',    swatch: 'oklch(0.62 0.22 358)',   soft: 'oklch(0.95 0.05 360)',  gradient: undefined },
              { id: 'blue'   as const, label: 'Ocean',   swatch: 'oklch(0.54 0.22 261)',   soft: 'oklch(0.95 0.04 261)',  gradient: undefined },
              { id: 'black'  as const, label: 'Mono',    swatch: 'oklch(0.14 0 0)',         soft: 'oklch(0.96 0 0)',       gradient: 'conic-gradient(oklch(0.14 0 0) 0deg 180deg, oklch(0.97 0 0) 180deg 360deg)' },
            ]).map(({ id, label, swatch, soft, gradient }) => {
              const on = accentColor === id
              const circleBg = gradient ?? `linear-gradient(140deg, oklch(from ${swatch} calc(l + 0.1) c h), ${swatch})`
              const checkColor = id === 'black' ? (on ? 'var(--text)' : '#fff') : '#fff'
              return (
                <button
                  key={id}
                  onClick={() => saveAccent(id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    padding: '14px 8px', borderRadius: 16, border: `2px solid ${on ? swatch : 'var(--border)'}`,
                    background: on ? soft : 'var(--surface)', cursor: 'pointer',
                    transition: 'all .15s', fontFamily: 'inherit',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: circleBg,
                    backgroundColor: swatch,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: on ? `0 4px 12px -3px ${swatch}` : 'none',
                    border: id === 'black' ? '1.5px solid var(--border-strong)' : 'none',
                    transition: 'box-shadow .15s',
                  }}>
                    {on && <Check size={15} color={checkColor} strokeWidth={2.8} />}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: on ? swatch : 'var(--text-3)' }}>{label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayoutGrid size={14} style={{ color: 'var(--brand)' }} />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Navigation Tabs</h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0, lineHeight: 1.5 }}>
            Choose which optional tabs appear in the navigation bar. Health and Task tracking are available when you need them.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {([
              {
                field: 'showHealthTab' as const,
                label: 'Health',
                desc: 'Log workouts, sleep, water intake and daily wellness metrics',
                icon: Activity,
                value: showHealthTab,
                set: setShowHealthTab,
              },
              {
                field: 'showTasksTab' as const,
                label: 'Tasks',
                desc: 'A simple to-do list to track personal action items',
                icon: CheckSquare,
                value: showTasksTab,
                set: setShowTasksTab,
              },
            ]).map(({ field, label, desc, icon: Icon, value, set }) => (
              <div
                key={field}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 12,
                  background: value ? 'var(--brand-soft)' : 'var(--surface-2)',
                  border: `1px solid ${value ? 'var(--brand)' : 'var(--border)'}`,
                  transition: 'all .15s',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: value ? 'var(--brand)' : 'var(--surface-3)',
                  color: value ? '#fff' : 'var(--text-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all .15s',
                }}>
                  <Icon size={15} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: value ? 'var(--brand-ink)' : 'var(--text)', margin: 0 }}>{label}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: 0, marginTop: 1 }}>{desc}</p>
                </div>
                <button
                  onClick={async () => {
                    const next = !value
                    set(next)
                    await saveTabSettings(field, next)
                  }}
                  disabled={savingTabs}
                  style={{
                    padding: '6px 14px', borderRadius: 20, border: 'none',
                    background: value ? 'var(--brand)' : 'var(--surface-3)',
                    color: value ? '#fff' : 'var(--text-3)',
                    fontSize: 12, fontWeight: 600, cursor: savingTabs ? 'default' : 'pointer',
                    opacity: savingTabs ? 0.6 : 1, flexShrink: 0,
                    transition: 'all .15s',
                  }}
                >
                  {value ? 'On' : 'Off'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard card order */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayoutGrid size={14} style={{ color: 'var(--brand)' }} />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Dashboard Order</h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
            Reorder the sections on your home screen using the arrows, then save.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cardOrder.map((id, idx) => {
              const labels: Record<string, string> = {
                hero: 'Hero — Safe to Spend, This Month, Streak',
                insights: 'Smart Insights',
                charts: 'Charts — Category Pie + Monthly Bar',
                savings: 'Savings Trend + Breakdown',
                goals: 'Savings Goals',
                transactions: 'Recent Transactions',
                pulse: 'Monthly Pulse & Financial Health',
                summary: 'KPI Summary Cards',
                'health-ef': 'Emergency Fund',
                weekly: 'Quick Actions + Borrowed',
                upcoming: 'Upcoming Bills',
              }
              return (
                <div key={id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                }}>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>{labels[id] ?? id}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      disabled={idx === 0}
                      onClick={() => {
                        const next = [...cardOrder]
                        ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
                        setCardOrder(next)
                        setOrderDirty(true)
                      }}
                      style={{ padding: 4, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1, display: 'flex' }}
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      disabled={idx === cardOrder.length - 1}
                      onClick={() => {
                        const next = [...cardOrder]
                        ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
                        setCardOrder(next)
                        setOrderDirty(true)
                      }}
                      style={{ padding: 4, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: idx === cardOrder.length - 1 ? 'default' : 'pointer', opacity: idx === cardOrder.length - 1 ? 0.3 : 1, display: 'flex' }}
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => {
                setCardOrder(DEFAULT_CARD_ORDER)
                setOrderDirty(true)
              }}
              style={{ fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Reset to default
            </button>
            <button
              onClick={async () => {
                if (!user) return
                setSavingOrder(true)
                try {
                  await setUserSettings(user.uid, { dashboardCardOrder: cardOrder })
                  await refresh()
                  setOrderDirty(false)
                  toast.success('Dashboard order saved')
                } catch {
                  toast.error('Failed to save order')
                } finally {
                  setSavingOrder(false)
                }
              }}
              disabled={!orderDirty || savingOrder}
              className="btn-primary"
              style={{
                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', fontSize: 13,
                opacity: !orderDirty || savingOrder ? 0.5 : 1,
                cursor: !orderDirty || savingOrder ? 'default' : 'pointer',
              }}
            >
              {savingOrder ? 'Saving…' : 'Save order'}
            </button>
          </div>
        </div>

        {/* Streak Badges */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Flame size={14} style={{ color: '#f97316' }} />
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Streak Badges</h2>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Tap any badge to learn more. Longest streak: <span style={{ fontWeight: 600, color: 'var(--text)' }}>{longestMoneyStreak} days</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {BADGES.map((badge) => {
              const { name, Icon, threshold, iconColor } = badge
              const earned   = longestMoneyStreak >= threshold
              const daysAway = threshold - longestMoneyStreak
              return (
                <button
                  key={name}
                  onClick={() => setSelectedBadge(badge)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11, padding: '12px 13px',
                    borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'inherit',
                    background: earned ? 'var(--surface-2)' : 'transparent',
                    border: earned ? `1px solid color-mix(in oklch, ${iconColor} 35%, var(--border))` : '1.5px dashed var(--border)',
                    opacity: earned ? 1 : 0.6,
                    transition: 'opacity .15s, transform .1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.02)' }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = earned ? '1' : '0.6'; e.currentTarget.style.transform = 'scale(1)' }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: earned ? `color-mix(in oklch, ${iconColor} 18%, var(--surface))` : 'var(--surface-3)',
                  }}>
                    <Icon size={18} style={{ color: earned ? iconColor : 'var(--text-4)' }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2, color: earned ? 'var(--good-ink)' : 'var(--text-4)' }}>
                      {earned ? '✓ Earned' : daysAway === 1 ? '1 day away' : `${daysAway} days to go`}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
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

        {/* Feedback */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageCircle size={14} style={{ color: 'var(--brand)' }} />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Feedback</h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
            Found a bug or have an idea? Tell us — if we act on it, we&apos;ll let you know right here in the app.
          </p>

          <div style={{ display: 'flex', gap: 8 }}>
            {([
              { value: 'bug', label: 'Bug', icon: Bug },
              { value: 'feature_request', label: 'Feature request', icon: Lightbulb },
              { value: 'other', label: 'Other', icon: MessageCircle },
            ] as const).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setFeedbackType(value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10,
                  border: `1px solid ${feedbackType === value ? 'var(--brand)' : 'var(--border)'}`,
                  background: feedbackType === value ? 'var(--brand-soft)' : 'var(--surface-2)',
                  color: feedbackType === value ? 'var(--brand-ink)' : 'var(--text-2)',
                  fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          <textarea
            value={feedbackMessage}
            onChange={e => setFeedbackMessage(e.target.value)}
            rows={3}
            placeholder={feedbackType === 'bug' ? "What went wrong, and what were you doing when it happened?" : feedbackType === 'feature_request' ? "What should Growwly do that it doesn't today?" : "Anything on your mind…"}
            className="input"
            style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
          />

          <button
            onClick={handleSendFeedback}
            disabled={sendingFeedback || !feedbackMessage.trim()}
            className="btn-primary"
            style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, opacity: (sendingFeedback || !feedbackMessage.trim()) ? 0.6 : 1 }}
          >
            <Send size={14} /> {sendingFeedback ? 'Sending…' : 'Send Feedback'}
          </button>
        </div>

      </div>

      <ConfirmDialog
        open={!!pendingImport}
        message="This will overwrite your existing data with the backup file. Continue?"
        confirmLabel="Import"
        onConfirm={doImport}
        onClose={() => setPendingImport(null)}
      />

      {/* Account options modal — "More, or wanna leave?" → options list → Danger Zone */}
      {accountMenuOpen && createPortal((
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setAccountMenuOpen(false)}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: accountMenuStep === 'danger' ? '1px solid color-mix(in oklch, var(--bad) 35%, var(--border))' : '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)', padding: 24, maxWidth: 400, width: '100%',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex', flexDirection: 'column', gap: 16,
              position: 'relative',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setAccountMenuOpen(false)}
              style={{ position: 'absolute', top: 16, right: 16, padding: 6, borderRadius: 8, background: 'var(--surface-2)', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}
            >
              <X size={14} />
            </button>

            {accountMenuStep === 'options' ? (
              <>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>Account options</h2>
                <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <button
                    onClick={() => setAccountMenuStep('danger')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px',
                      background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bad-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bad-ink)', flexShrink: 0 }}>
                      <Trash2 size={14} />
                    </div>
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--bad-ink)' }}>Delete Account</span>
                    <ChevronDown size={14} style={{ color: 'var(--text-4)', transform: 'rotate(-90deg)' }} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => setAccountMenuStep('options')}
                    style={{ padding: 4, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}
                  >
                    <ChevronDown size={16} style={{ transform: 'rotate(90deg)' }} />
                  </button>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bad-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bad-ink)', flexShrink: 0 }}>
                    <AlertTriangle size={14} />
                  </div>
                  <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--bad-ink)', margin: 0 }}>Danger Zone</h2>
                </div>

                <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bad-soft)', border: '1px solid color-mix(in oklch, var(--bad) 25%, transparent)' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--bad-ink)', margin: '0 0 6px' }}>Before you go…</p>
                  <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: 0, lineHeight: 1.65 }}>
                    Growwly holds your entire financial history — years of transactions, savings goals, net worth milestones, and spending patterns that help you make smarter decisions every day. Once deleted, this data cannot be recovered.
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '8px 0 0', lineHeight: 1.5 }}>
                    If you&apos;re taking a break, you can simply log out and return anytime. Consider <button onClick={handleExport} style={{ color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, fontWeight: 600, textDecoration: 'underline' }}>exporting a backup</button> first.
                  </p>
                </div>

                <button
                  onClick={() => { setAccountMenuOpen(false); setDeleteConfirmText(''); setDeleteModalOpen(true) }}
                  className="btn-danger"
                  style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Trash2 size={14} /> Delete Account
                </button>
              </>
            )}
          </div>
        </div>
      ), document.body)}

      {/* Delete account confirmation modal */}
      {deleteModalOpen && createPortal((
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => { if (!deleting) { setDeleteModalOpen(false); setDeleteConfirmText('') } }}
        >
          <div
            style={{
              background: 'var(--surface)', border: '1px solid color-mix(in oklch, var(--bad) 35%, var(--border))',
              borderRadius: 'var(--radius-xl)', padding: 28, maxWidth: 400, width: '100%',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex', flexDirection: 'column', gap: 20,
              position: 'relative',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => { setDeleteModalOpen(false); setDeleteConfirmText('') }}
              disabled={deleting}
              style={{ position: 'absolute', top: 16, right: 16, padding: 6, borderRadius: 8, background: 'var(--surface-2)', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', opacity: deleting ? 0.4 : 1 }}
            >
              <X size={14} />
            </button>

            {/* Header */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingTop: 8 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bad-soft)', border: '2px solid color-mix(in oklch, var(--bad) 30%, transparent)',
              }}>
                <Trash2 size={24} style={{ color: 'var(--bad-ink)' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--bad-ink)', letterSpacing: '-0.02em' }}>Delete Account?</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.5 }}>
                  This will permanently delete all your data and cannot be undone.
                </div>
              </div>
            </div>

            {/* What gets deleted */}
            <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.75 }}>
              <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--text-2)', fontSize: 12.5 }}>Everything will be deleted:</p>
              <p style={{ margin: 0 }}>• All transactions and income records</p>
              <p style={{ margin: 0 }}>• Savings goals, projects & borrowings</p>
              <p style={{ margin: 0 }}>• Net worth assets & liabilities</p>
              <p style={{ margin: 0 }}>• Emergency fund, settings & badges</p>
            </div>

            {/* Type-to-confirm */}
            <div>
              <label style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500, display: 'block', marginBottom: 8 }}>
                Type <strong style={{ color: 'var(--bad-ink)' }}>delete</strong> to confirm
              </label>
              <input
                type="text"
                className="input"
                placeholder='type "delete"'
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                disabled={deleting}
                autoCapitalize="none"
                autoCorrect="off"
                style={{
                  borderColor: deleteConfirmText.toLowerCase() === 'delete' ? 'var(--bad)' : undefined,
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setDeleteModalOpen(false); setDeleteConfirmText('') }}
                disabled={deleting}
                className="btn"
                style={{ flex: 1, justifyContent: 'center', opacity: deleting ? 0.5 : 1 }}
              >
                Cancel
              </button>
              <button
                onClick={doDeleteAccount}
                disabled={deleting || deleteConfirmText.toLowerCase() !== 'delete'}
                className="btn-danger"
                style={{
                  flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6,
                  opacity: (deleting || deleteConfirmText.toLowerCase() !== 'delete') ? 0.45 : 1,
                  cursor: (deleting || deleteConfirmText.toLowerCase() !== 'delete') ? 'not-allowed' : 'pointer',
                }}
              >
                {deleting ? 'Deleting…' : <><Trash2 size={13} /> Delete Forever</>}
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* Badge detail modal — portalled to body so position:fixed escapes the pull-to-refresh transform */}
      {selectedBadge && createPortal((() => {
        const { name, Icon, iconColor, description, quote, threshold } = selectedBadge
        const earned     = longestMoneyStreak >= threshold
        const daysAway   = threshold - longestMoneyStreak
        const earnedDate = earned ? getBadgeEarnedDate(txDates, noSpendDays, threshold) : null
        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={() => setSelectedBadge(null)}
          >
            <div
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)', padding: 28, maxWidth: 360, width: '100%',
                boxShadow: 'var(--shadow-lg)',
                display: 'flex', flexDirection: 'column', gap: 20,
                position: 'relative',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Close */}
              <button
                onClick={() => setSelectedBadge(null)}
                style={{ position: 'absolute', top: 16, right: 16, padding: 6, borderRadius: 8, background: 'var(--surface-2)', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}
              >
                <X size={14} />
              </button>

              {/* Icon + name */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingTop: 8 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: earned
                    ? `color-mix(in oklch, ${iconColor} 20%, var(--surface-2))`
                    : 'var(--surface-3)',
                  border: earned ? `2px solid color-mix(in oklch, ${iconColor} 40%, transparent)` : '2px dashed var(--border)',
                  boxShadow: earned ? `0 4px 20px color-mix(in oklch, ${iconColor} 25%, transparent)` : 'none',
                }}>
                  <Icon size={32} style={{ color: earned ? iconColor : 'var(--text-4)' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>{name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>{threshold}-day streak badge</div>
                </div>
              </div>

              {/* Description */}
              <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6, textAlign: 'center' }}>
                {description}
              </div>

              {/* Earned / progress */}
              {earned ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                  borderRadius: 12,
                  background: `color-mix(in oklch, ${iconColor} 12%, var(--surface))`,
                  border: `1px solid color-mix(in oklch, ${iconColor} 28%, transparent)`,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: `color-mix(in oklch, ${iconColor} 22%, transparent)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16,
                  }}>🏅</div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--good-ink)' }}>Badge Earned!</div>
                    {earnedDate && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                        Achieved on {format(parseISO(earnedDate), 'dd MMM yyyy')}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 16px',
                  borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)' }}>
                    <span>Your best streak</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{longestMoneyStreak} / {threshold} days</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 999,
                      width: `${Math.min(100, (longestMoneyStreak / threshold) * 100)}%`,
                      background: iconColor, transition: 'width .4s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', textAlign: 'center' }}>
                    {daysAway === 1 ? '1 more day to unlock' : `${daysAway} more days to unlock`}
                  </div>
                </div>
              )}

              {/* Quote */}
              <div style={{
                padding: '14px 16px', borderRadius: 12,
                background: 'var(--surface-2)', borderLeft: `3px solid ${iconColor}`,
              }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)', fontStyle: 'italic', lineHeight: 1.6 }}>
                  {quote}
                </div>
              </div>
            </div>
          </div>
        )
      })(), document.body)}
    </AppShell>
  )
}
