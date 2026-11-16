'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import { setUserSettings } from '@/lib/firestore'
import { useCountUp } from '@/hooks/useCountUp'
import { computeStreak, lastSevenDays, restorableDays } from './streak'

export const RESTORE_EVENT = 'ov:restore-streak'

export default function StreakCard({ isNew }: { isNew: boolean }) {
  const transactions = useAppStore(s => s.transactions)
  const settings = useAppStore(s => s.settings)
  const { user } = useAuth()
  const refresh = useRefreshData()
  const [restoring, setRestoring] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const noSpend = useMemo(() => new Set(settings?.noSpendDays ?? []), [settings])
  const streak = useMemo(() => computeStreak(transactions, noSpend), [transactions, noSpend])
  const week = useMemo(() => lastSevenDays(transactions, noSpend), [transactions, noSpend])
  const gap = useMemo(() => restorableDays(transactions, noSpend, streak), [transactions, noSpend, streak])
  const onTrack = week.filter(d => d.status !== 'empty').length
  const count = useCountUp(streak, 600)

  // "Restore" in Needs attention opens this panel
  useEffect(() => {
    const open = () => { if (gap.length) setRestoring(true) }
    window.addEventListener(RESTORE_EVENT, open)
    return () => window.removeEventListener(RESTORE_EVENT, open)
  }, [gap.length])

  async function save() {
    if (!user || picked.size === 0) return
    setSaving(true)
    try {
      await setUserSettings(user.uid, { noSpendDays: Array.from(new Set([...(settings?.noSpendDays ?? []), ...Array.from(picked)])) })
      await refresh()
      setRestoring(false)
      setPicked(new Set())
      toast.success('Streak restored!')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const btn: React.CSSProperties = { flex: 1, padding: 9, borderRadius: 12, fontSize: 12.5, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <div className="ov-card" style={{ background: 'var(--warn-soft)', color: 'var(--warn-ink)', gap: 12 }}>
      {!restoring ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 26, lineHeight: 1 }}>🔥</div>
            <div className="ov-mono" style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1 }}>{isNew ? 0 : count}</div>
            <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{isNew ? 'Log today to start a streak' : 'day streak'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 4 }}>
            {week.map(d => (
              <div key={d.date} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                <div style={{
                  width: '100%', height: 8, borderRadius: 4, boxSizing: 'border-box',
                  background: d.status === 'logged' ? 'var(--warn)' : d.status === 'nospend' ? 'var(--surface)' : 'transparent',
                  border: d.status === 'nospend' ? '1.5px solid var(--warn)' : d.status === 'empty' ? '1.5px dashed var(--warn)' : 'none',
                }} />
                <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.7 }}>{d.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>
            {isNew ? 'Any log counts, including "no spend today"' : `${onTrack}/7 days on track this week`}
          </div>
          {gap.length > 0 && !isNew && (
            <button onClick={() => setRestoring(true)} className="ov-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', borderRadius: 14, background: 'var(--surface)', color: 'var(--warn-ink)', textAlign: 'left' }}>
              <span style={{ fontSize: 12.5, color: 'var(--ink)' }}>{gap.length} empty day{gap.length === 1 ? '' : 's'} broke it</span>
              <span style={{ fontSize: 12.5, fontWeight: 800 }}>Restore?</span>
            </button>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, fontWeight: 800 }}>No-spend days</div>
          <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.5 }}>Tap any day you had zero spending to restore your streak.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {gap.map(({ date, label }) => {
              const on = picked.has(date)
              return (
                <button
                  key={date}
                  onClick={() => setPicked(p => { const n = new Set(p); if (n.has(date)) n.delete(date); else n.add(date); return n })}
                  className="ov-btn"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 12,
                    background: on ? 'var(--surface)' : 'transparent', color: 'var(--warn-ink)',
                    border: `1.5px ${on ? 'solid' : 'dashed'} var(--warn)`, transition: 'background .15s',
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 800, opacity: on ? 1 : 0.6 }}>{on ? '✓ No spend' : 'No spend?'}</span>
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setRestoring(false); setPicked(new Set()) }} style={{ ...btn, background: 'var(--surface)', color: 'var(--warn-ink)' }}>Cancel</button>
            <button onClick={save} disabled={picked.size === 0 || saving} style={{ ...btn, background: 'var(--warn)', color: '#fff', opacity: picked.size === 0 || saving ? 0.5 : 1, cursor: picked.size === 0 || saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : `Restore${picked.size ? ` (${picked.size})` : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
