'use client'

import { useMemo, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { format, subDays } from 'date-fns'
import type { Transaction } from '@/types'
import { useCountUp } from '@/hooks/useCountUp'
import { useAuth } from '@/context/AuthContext'
import { setUserSettings } from '@/lib/firestore'
import { useRefreshData } from '@/hooks/useData'
import toast from 'react-hot-toast'

// ── Streak logic ──────────────────────────────────────────────────────────────

type DayStatus = 'tx' | 'nospend' | 'empty'

function computeStreak(transactions: Transaction[], noSpendSet: Set<string>): number {
  const txDates = new Set(transactions.map(t => t.date))
  let streak = 0
  for (let i = 1; i <= 365; i++) {
    const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
    if (txDates.has(d) || noSpendSet.has(d)) streak++
    else break
  }
  return streak
}

function computeWeekStatus(transactions: Transaction[], noSpendSet: Set<string>): DayStatus[] {
  const txDates = new Set(transactions.map(t => t.date))
  return Array.from({ length: 7 }, (_, i) => {
    const d = format(subDays(new Date(), i + 1), 'yyyy-MM-dd')
    if (txDates.has(d)) return 'tx'
    if (noSpendSet.has(d)) return 'nospend'
    return 'empty'
  })
}

// Find the contiguous block of empty days immediately after the current streak ends.
// These are the days the user can mark as no-spend to restore/extend the streak.
function findRestorableDays(
  transactions: Transaction[],
  noSpendSet: Set<string>,
  currentStreak: number,
): { date: string; label: string }[] {
  const txDates = new Set(transactions.map(t => t.date))
  const result: { date: string; label: string }[] = []
  for (let i = currentStreak + 1; i <= currentStreak + 30; i++) {
    const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
    if (!txDates.has(d) && !noSpendSet.has(d)) {
      result.push({ date: d, label: format(subDays(new Date(), i), 'EEE, d MMM') })
    } else {
      break // hit a day with real data — can't skip over it
    }
  }
  return result
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MoneyStreakCard() {
  const { transactions, settings } = useAppStore()
  const { user } = useAuth()
  const refresh = useRefreshData()

  const [restoring, setRestoring] = useState(false)
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [saving, setSaving]       = useState(false)

  const noSpendSet = useMemo(
    () => new Set(settings?.noSpendDays ?? []),
    [settings],
  )

  const streak        = useMemo(() => computeStreak(transactions, noSpendSet), [transactions, noSpendSet])
  const weekStatus    = useMemo(() => computeWeekStatus(transactions, noSpendSet), [transactions, noSpendSet])
  const emptyDays     = useMemo(() => findRestorableDays(transactions, noSpendSet, streak), [transactions, noSpendSet, streak])
  const onTrackCount  = weekStatus.filter(s => s !== 'empty').length
  const animatedStreak = useCountUp(streak, 750)

  function toggleDay(date: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  async function saveRestore() {
    if (!user || selected.size === 0) return
    setSaving(true)
    try {
      const existing = settings?.noSpendDays ?? []
      await setUserSettings(user.uid, {
        noSpendDays: Array.from(new Set([...existing, ...Array.from(selected)])),
      })
      await refresh()
      setRestoring(false)
      setSelected(new Set())
      toast.success('Streak restored!')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function cancelRestore() {
    setRestoring(false)
    setSelected(new Set())
  }

  return (
    <div style={{
      background: 'linear-gradient(150deg, var(--warn-soft) 0%, color-mix(in oklch, var(--warn) 14%, var(--surface)) 100%)',
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--pad)',
      border: '1px solid color-mix(in oklch, var(--warn) 22%, transparent)',
      boxShadow: 'var(--elev)',
      display: 'flex', flexDirection: 'column', gap: 14,
      height: '100%', minHeight: 0,
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="h-eyebrow" style={{ color: 'var(--warn-ink)', opacity: 0.75 }}>
          Money Streak
        </span>
        {emptyDays.length > 0 && !restoring && (
          <button
            onClick={() => setRestoring(true)}
            style={{
              fontSize: 11, fontWeight: 700,
              color: 'var(--warn-ink)',
              background: 'color-mix(in oklch, var(--warn) 18%, transparent)',
              border: '1px solid color-mix(in oklch, var(--warn) 30%, transparent)',
              borderRadius: 7, padding: '3px 8px',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Restore?
          </button>
        )}
      </div>

      {!restoring ? (
        <>
          {/* Flame + streak count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>🔥</span>
            <div>
              <div style={{
                fontSize: 'clamp(28px, 4vw, 40px)',
                fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1,
                color: 'var(--warn-ink)',
              }}>
                {animatedStreak}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--warn-ink)', opacity: 0.75 }}>
                day streak
              </div>
            </div>
          </div>

          {/* 7-day dots */}
          <div style={{ display: 'flex', gap: 5 }}>
            {weekStatus.map((status, i) => (
              <div
                key={i}
                style={{
                  height: 6, flex: 1, borderRadius: 999,
                  background:
                    status === 'tx'      ? 'var(--warn)' :
                    status === 'nospend' ? 'color-mix(in oklch, var(--warn) 52%, transparent)' :
                                          'color-mix(in oklch, var(--warn) 20%, transparent)',
                  transition: `background .3s ease ${i * 40}ms`,
                }}
              />
            ))}
          </div>

          <div style={{ fontSize: 12, color: 'var(--warn-ink)', opacity: 0.7, fontWeight: 500 }}>
            {onTrackCount}/7 days on track this week
          </div>
        </>
      ) : (
        /* ── Restore panel ── */
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warn-ink)', lineHeight: 1.3 }}>
            No-spend days
          </div>
          <div style={{ fontSize: 12, color: 'var(--warn-ink)', opacity: 0.7, lineHeight: 1.5 }}>
            Tap any day you had zero spending to restore your streak.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {emptyDays.map(({ date, label }) => {
              const on = selected.has(date)
              return (
                <button
                  key={date}
                  onClick={() => toggleDay(date)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                    background: on
                      ? 'color-mix(in oklch, var(--warn) 26%, transparent)'
                      : 'color-mix(in oklch, var(--warn) 10%, transparent)',
                    border: `1.5px solid ${on
                      ? 'color-mix(in oklch, var(--warn) 60%, transparent)'
                      : 'color-mix(in oklch, var(--warn) 22%, transparent)'}`,
                    fontFamily: 'inherit',
                    transition: 'all .15s',
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--warn-ink)' }}>
                    {label}
                  </span>
                  <span style={{
                    fontSize: 11.5, fontWeight: 700,
                    color: on ? 'var(--warn-ink)' : 'color-mix(in oklch, var(--warn-ink) 50%, transparent)',
                  }}>
                    {on ? '✓ No spend' : 'No spend?'}
                  </span>
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            <button
              onClick={cancelRestore}
              style={{
                flex: 1, padding: '8px', borderRadius: 9,
                background: 'color-mix(in oklch, var(--warn) 14%, transparent)',
                border: '1px solid color-mix(in oklch, var(--warn) 22%, transparent)',
                color: 'var(--warn-ink)', fontSize: 12.5, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              onClick={saveRestore}
              disabled={selected.size === 0 || saving}
              style={{
                flex: 1, padding: '8px', borderRadius: 9, border: 'none',
                background: selected.size > 0 ? 'var(--warn)' : 'color-mix(in oklch, var(--warn) 30%, transparent)',
                color: selected.size > 0 ? '#fff' : 'color-mix(in oklch, var(--warn-ink) 50%, transparent)',
                fontSize: 12.5, fontWeight: 700,
                cursor: selected.size > 0 && !saving ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', opacity: saving ? 0.7 : 1,
                transition: 'all .15s',
              }}
            >
              {saving ? 'Saving…' : `Restore${selected.size > 0 ? ` (${selected.size})` : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
