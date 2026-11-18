'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { useAppStore } from '@/store/appStore'
import { setUserSettings } from '@/lib/firestore'
import type { PushState } from '@/hooks/usePushNotifications'
import { MONO, card, IconTile, SavedChip, Segmented, Switch, Note, rowTitle, sub, useSavedFlash } from './ui'

export const REMINDER_TIMES = [
  { hour: 8,  label: 'Morning', time: '8:30 AM' },
  { hour: 19, label: 'Evening', time: '7:30 PM' },
]

export default function NotificationsSection({ push }: {
  push: { state: PushState; subscribe: () => Promise<boolean>; unsubscribe: () => Promise<void> }
}) {
  const { user } = useAuth()
  const settings = useAppStore(s => s.settings)
  const [hour, setHour] = useState(19)
  const [saved, flash] = useSavedFlash()
  useEffect(() => { if (settings) setHour(settings.pushReminderHour ?? 19) }, [settings])

  const { state } = push
  const on = state === 'subscribed'
  const busy = state === 'loading'
  const locked = state === 'unsupported' || state === 'denied'

  async function toggle() {
    if (!user) return
    try {
      if (on) {
        await push.unsubscribe()
        await setUserSettings(user.uid, { pushReminderEnabled: false })
        flash('reminders')
      } else {
        const ok = await push.subscribe()
        if (ok) {
          await setUserSettings(user.uid, { pushReminderEnabled: true })
          flash('reminders')
        }
      }
    } catch {
      toast.error('Failed to update reminders')
    }
  }

  async function pickHour(h: number) {
    if (!user || h === hour) return
    setHour(h)
    try {
      await setUserSettings(user.uid, { pushReminderHour: h })
      flash('reminders')
    } catch { toast.error('Failed to save reminder time') }
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 24px' }}>
        <IconTile name="notifications" accent />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={rowTitle}>Daily reminder</span>
            {saved === 'reminders' && <SavedChip small />}
          </div>
          <div style={sub}>A push nudge to log the day&apos;s spending, on this browser.</div>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 500, color: 'var(--mut)' }}>{on ? 'On' : busy ? 'Working…' : 'Off'}</span>
        <div style={{ opacity: locked ? 0.45 : 1, display: 'flex' }}>
          <Switch on={on} busy={busy} onClick={toggle} disabled={locked || busy} label="Daily reminder" />
        </div>
      </div>

      {on && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '14px 24px 18px 78px', borderTop: '1px solid var(--line)' }}>
          <span style={{ fontSize: 13.5, color: 'var(--mut)' }}>Remind me</span>
          <Segmented
            label="Reminder time" value={String(hour)} onPick={id => pickHour(Number(id))}
            options={REMINDER_TIMES.map(t => ({ id: String(t.hour), label: t.label, trail: t.time }))}
          />
          <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, color: 'var(--mut)' }}>IST</span>
        </div>
      )}

      {state === 'denied' && (
        <Note tone="bad" icon="notifications_off" style={{ margin: '0 24px 20px' }}>
          <b style={{ fontWeight: 600 }}>Notifications are blocked for Growwly.</b> Allow them in your browser&apos;s site settings, or in your phone&apos;s Settings → Notifications, then come back here.
        </Note>
      )}
      {state === 'unsupported' && (
        <Note tone="info" icon="info" style={{ margin: '0 24px 20px' }}>
          This browser can&apos;t send push reminders. On iPhone, add Growwly to your Home Screen first; on desktop, try Chrome, Edge or Safari.
        </Note>
      )}
    </div>
  )
}
