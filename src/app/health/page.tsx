'use client'

import { useState, useMemo, useEffect } from 'react'
import { format, subDays, parseISO } from 'date-fns'
import { Plus, Settings2, Pencil, Trash2, Flame, Check, Leaf, Diamond, Trophy } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import RoutineModal from '@/components/health/RoutineModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import {
  addHealthRoutine, updateHealthRoutine, deleteHealthRoutine, upsertHealthLog,
} from '@/lib/firestore'
import type { HealthRoutine, HealthLog } from '@/types'
import toast from 'react-hot-toast'

const DAY_SHORT = ['sun','mon','tue','wed','thu','fri','sat']
const TODAY = format(new Date(), 'yyyy-MM-dd')
const TODAY_DOW = DAY_SHORT[new Date().getDay()]

// ── Default seed data ─────────────────────────────────────────────────────────

const DEFAULT_ROUTINES: Omit<HealthRoutine, 'id' | 'userId' | 'createdAt'>[] = [
  { name: 'Morning walk',          subtitle: '1.8km · legs',               category: 'legs',      scheduleType: 'daily',         reminderTime: '07:00', order: 0, active: true },
  { name: 'Morning activation',    subtitle: 'Squats, bridges, chin tucks', category: 'full-body', scheduleType: 'daily',         reminderTime: '07:30', order: 1, active: true },
  { name: 'Hourly movement breaks',subtitle: '9am-6pm · legs, back',        category: 'back',      scheduleType: 'hourly-window', targetCount: 8,         order: 2, active: true },
  { name: 'Mid-morning routine',   subtitle: 'Squats, calf raises · legs',  category: 'legs',      scheduleType: 'daily',         reminderTime: '11:00', order: 3, active: true },
  { name: 'Lunch walk',            subtitle: '5-10 min · legs',             category: 'legs',      scheduleType: 'daily',         reminderTime: '13:00', order: 4, active: true },
  { name: 'Mid-afternoon reset',   subtitle: 'Neck, shoulders, posture',    category: 'neck',      scheduleType: 'daily',         reminderTime: '15:30', order: 5, active: true },
  { name: 'Evening walk',          subtitle: '1.8km · legs',               category: 'legs',      scheduleType: 'daily',         reminderTime: '18:30', order: 6, active: true },
  { name: 'Evening mobility',      subtitle: '5 min stretching · back',    category: 'back',      scheduleType: 'daily',         reminderTime: '19:00', order: 7, active: true },
  { name: 'Strength training',     subtitle: undefined,                      category: 'strength',  scheduleType: 'weekly',        daysOfWeek: ['mon','tue','thu'], order: 8, active: true },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function isScheduledToday(r: HealthRoutine): boolean {
  if (!r.active) return false
  if (r.scheduleType === 'daily' || r.scheduleType === 'hourly-window') return true
  if (r.scheduleType === 'weekly') return (r.daysOfWeek ?? []).includes(TODAY_DOW)
  return false
}

function getLog(logs: HealthLog[], routineId: string): HealthLog | undefined {
  return logs.find(l => l.routineId === routineId && l.date === TODAY)
}

function computeMoneyStreak(txDates: Set<string>, noSpendSet: Set<string>): number {
  let streak = 0
  for (let i = 1; i <= 365; i++) {
    const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
    if (txDates.has(d) || noSpendSet.has(d)) streak++
    else break
  }
  return streak
}

function computeLongestMoneyStreak(txDates: Set<string>, noSpendSet: Set<string>): number {
  const allDates = [...new Set([...txDates, ...noSpendSet])].sort()
  let longest = 0, current = 0
  for (let i = 0; i < allDates.length; i++) {
    if (i === 0) { current = 1; longest = 1; continue }
    const prev = parseISO(allDates[i - 1])
    const cur  = parseISO(allDates[i])
    const diff = Math.round((cur.getTime() - prev.getTime()) / 86400000)
    current = diff === 1 ? current + 1 : 1
    longest = Math.max(longest, current)
  }
  return longest
}

function computeLongestStreak(routines: HealthRoutine[], logs: HealthLog[]): number {
  const dailyIds = routines.filter(r => r.active && r.scheduleType === 'daily').map(r => r.id)
  if (dailyIds.length === 0 || logs.length === 0) return 0
  const dates = [...new Set(logs.map(l => l.date))].sort()
  let longest = 0, current = 0, prev: string | null = null
  for (const dateStr of dates) {
    const allDone = dailyIds.every(id => logs.some(l => l.routineId === id && l.date === dateStr && l.count > 0))
    if (allDone) {
      if (prev) {
        const diff = Math.round((new Date(dateStr).getTime() - new Date(prev).getTime()) / 86400000)
        current = diff === 1 ? current + 1 : 1
      } else {
        current = 1
      }
      longest = Math.max(longest, current)
    } else {
      current = 0
    }
    prev = dateStr
  }
  return longest
}

function computeStreak(routines: HealthRoutine[], logs: HealthLog[]): number {
  const dailyIds = routines.filter(r => r.active && r.scheduleType === 'daily').map(r => r.id)
  if (dailyIds.length === 0) return 0
  let streak = 0
  for (let i = 1; i <= 60; i++) {
    const date = format(subDays(new Date(), i), 'yyyy-MM-dd')
    const allDone = dailyIds.every(id => {
      const log = logs.find(l => l.routineId === id && l.date === date)
      return log && log.count > 0
    })
    if (allDone) streak++
    else break
  }
  return streak
}

// ── Category colours ──────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  legs: '#22c55e', back: '#3b82f6', neck: '#a855f7',
  strength: '#f97316', 'full-body': '#14b8a6',
}

// ── Block row ─────────────────────────────────────────────────────────────────

function BlockRow({
  routine, count, onTap, onUndo, onEdit, onDelete, editing,
}: {
  routine: HealthRoutine; count: number
  onTap: () => void; onUndo: () => void; onEdit: () => void; onDelete: () => void; editing: boolean
}) {
  const isHourly = routine.scheduleType === 'hourly-window'
  const target   = routine.targetCount ?? 8
  const done     = isHourly ? count >= target : count > 0
  const color    = CAT_COLOR[routine.category] ?? 'var(--brand)'

  return (
    <div
      onClick={isHourly ? onTap : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        cursor: isHourly ? 'pointer' : 'default',
      }}
    >
      {/* Left: checkbox (daily) or nothing (hourly) */}
      {!isHourly && (
        <button
          onClick={e => { e.stopPropagation(); onTap() }}
          style={{
            width: 26, height: 26, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
            border: `2px solid ${done ? color : 'var(--border-strong)'}`,
            background: done ? color : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all .15s',
          }}
        >
          {done && <Check size={13} color="#fff" strokeWidth={3} />}
        </button>
      )}

      {/* Middle: name + subtitle */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 13.5, fontWeight: isHourly ? 600 : done ? 500 : 600,
          color: done && !isHourly ? 'var(--text-3)' : 'var(--text)',
          margin: 0, textDecoration: done && !isHourly ? 'line-through' : 'none',
        }}>
          {routine.name}
        </p>
        {routine.subtitle && (
          <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: 0, marginTop: 1 }}>{routine.subtitle}</p>
        )}
      </div>

      {/* Right: dots (hourly) | "Done"/time (daily) | edit buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {isHourly ? (
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {Array.from({ length: target }).map((_, i) => {
              const filled = i < count
              return (
                <div
                  key={i}
                  onClick={filled ? (e => { e.stopPropagation(); onUndo() }) : undefined}
                  style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: filled ? color : 'var(--surface-3)',
                    cursor: filled ? 'pointer' : 'default',
                    transition: 'background .15s',
                  }}
                />
              )
            })}
          </div>
        ) : (
          done
            ? <span style={{ fontSize: 12, fontWeight: 600, color }}>Done</span>
            : routine.reminderTime
              ? <span style={{ fontSize: 12, color: 'var(--text-4)' }}>{routine.reminderTime}</span>
              : null
        )}
        {editing && (
          <>
            <button onClick={e => { e.stopPropagation(); onEdit() }} style={{ padding: 4, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-4)' }}><Pencil size={13} /></button>
            <button onClick={e => { e.stopPropagation(); onDelete() }} style={{ padding: 4, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-4)' }}><Trash2 size={13} /></button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Weekly strength row ───────────────────────────────────────────────────────

function WeeklyStrengthRow({ routines, logs }: { routines: HealthRoutine[]; logs: HealthLog[] }) {
  const strengthRoutines = routines.filter(r => r.active && r.scheduleType === 'weekly')
  if (strengthRoutines.length === 0) return null

  const mon = new Date()
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7))
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i)
    return format(d, 'yyyy-MM-dd')
  })
  const weekLetters = ['M','T','W','T','F','S','S']

  const doneDays = new Set(
    logs.filter(l => weekDays.includes(l.date) && l.count > 0 && strengthRoutines.some(r => r.id === l.routineId)).map(l => l.date)
  )
  const doneCount = doneDays.size
  const totalTarget = Math.max(...strengthRoutines.map(r => (r.daysOfWeek ?? []).length), 0) || 3

  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>Strength training</span>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{doneCount} of {totalTarget} this week</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {weekDays.map((date, i) => {
          const isToday = date === TODAY
          const done = doneDays.has(date)
          return (
            <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 10.5, color: isToday ? 'var(--text)' : 'var(--text-4)', fontWeight: isToday ? 700 : 400 }}>
                {weekLetters[i]}
              </span>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: done ? CAT_COLOR.strength : 'var(--surface-3)',
                border: isToday ? `2px solid ${CAT_COLOR.strength}` : '2px solid transparent',
                transition: 'background .15s',
              }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HealthPage() {
  const { user } = useAuth()
  const { healthRoutines, healthLogs, transactions, settings } = useAppStore()
  const refresh = useRefreshData()

  const [editing, setEditing]   = useState(false)
  const [modal, setModal]       = useState<{ open: boolean; item?: HealthRoutine }>({ open: false })
  const [confirm, setConfirm]   = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [seeding, setSeeding]   = useState(false)

  // Optimistic local log counts — keyed by routineId
  const [localCounts, setLocalCounts] = useState<Record<string, number>>({})

  // Seed defaults
  const isEmpty = healthRoutines.length === 0

  async function seedDefaults() {
    if (!user || seeding) return
    setSeeding(true)
    try {
      await Promise.all(DEFAULT_ROUTINES.map(r => addHealthRoutine(user.uid, r)))
      await refresh()
      toast.success('Default plan loaded!')
    } catch { toast.error('Failed to load defaults') }
    finally { setSeeding(false) }
  }

  const todayRoutines  = useMemo(() => healthRoutines.filter(isScheduledToday), [healthRoutines])
  const dailyRoutines  = todayRoutines.filter(r => r.scheduleType !== 'weekly')
  const weeklyRoutines = healthRoutines.filter(r => r.active && r.scheduleType === 'weekly')
  const todayLogs      = useMemo(() => healthLogs.filter(l => l.date === TODAY), [healthLogs])

  // Merge server logs with optimistic local overrides
  function getCount(routineId: string): number {
    if (routineId in localCounts) return localCounts[routineId]
    return getLog(todayLogs, routineId)?.count ?? 0
  }

  const completedCount = dailyRoutines.filter(r => {
    const c = getCount(r.id)
    if (r.scheduleType === 'hourly-window') return c >= (r.targetCount ?? 8)
    return c > 0
  }).length
  const totalCount = dailyRoutines.length
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const streak        = useMemo(() => computeStreak(healthRoutines, healthLogs),        [healthRoutines, healthLogs])
  const longestStreak = useMemo(() => computeLongestStreak(healthRoutines, healthLogs), [healthRoutines, healthLogs])

  const txDates     = useMemo(() => new Set(transactions.map(t => t.date)), [transactions])
  const noSpendSet  = useMemo(() => new Set(settings?.noSpendDays ?? []),   [settings])
  const moneyStreak        = useMemo(() => computeMoneyStreak(txDates, noSpendSet),        [txDates, noSpendSet])
  const longestMoneyStreak = useMemo(() => computeLongestMoneyStreak(txDates, noSpendSet), [txDates, noSpendSet])

  async function handleTap(routine: HealthRoutine, delta = 1) {
    if (!user) return
    const current = getCount(routine.id)
    const next = routine.scheduleType === 'hourly-window'
      ? Math.max(0, current + delta)
      : (current > 0 ? 0 : 1)

    setLocalCounts(prev => ({ ...prev, [routine.id]: next }))

    try {
      await upsertHealthLog(user.uid, TODAY, routine.id, next)
      refresh().catch(() => {})
    } catch (err) {
      console.error('Health log error:', err)
      setLocalCounts(prev => ({ ...prev, [routine.id]: current }))
      toast.error('Failed to save — check Firestore rules')
    }
  }

  async function handleSaveRoutine(data: Omit<HealthRoutine, 'id' | 'userId' | 'createdAt'>, id?: string) {
    if (!user) return
    if (id) await updateHealthRoutine(id, data)
    else await addHealthRoutine(user.uid, data)
    await refresh()
    setModal({ open: false })
    toast.success(id ? 'Block updated' : 'Block added')
  }

  function handleDelete(r: HealthRoutine) {
    setConfirm({
      message: `Delete "${r.name}"?`,
      onConfirm: async () => {
        await deleteHealthRoutine(r.id)
        await refresh()
        toast.success('Deleted')
      },
    })
  }

  return (
    <AppShell title="Health">
      <div className="anim-page" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)', maxWidth: 600 }}>

        {/* Header card */}
        <div className="card" style={{ padding: '20px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>{format(new Date(), 'EEE, MMM d')}</p>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '2px 0 0' }}>Today&apos;s plan</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 20, fontSize: 14, fontWeight: 700,
                background: moneyStreak > 0 ? '#f9731622' : 'var(--surface-2)',
                color:      moneyStreak > 0 ? '#f97316'   : 'var(--text-4)',
              }}>
                <Flame size={16} />
                {moneyStreak}
              </div>
              {longestMoneyStreak > moneyStreak && (
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>
                  Best&nbsp;<span style={{ color: 'var(--text)', fontWeight: 700 }}>{longestMoneyStreak}d</span>
                </div>
              )}
              <button
                onClick={() => setEditing(v => !v)}
                style={{ padding: 8, borderRadius: 10, border: `1px solid ${editing ? 'var(--brand)' : 'var(--border)'}`, background: editing ? 'var(--brand-soft)' : 'var(--surface-2)', cursor: 'pointer', display: 'flex', color: editing ? 'var(--brand-ink)' : 'var(--text-3)' }}
              >
                <Settings2 size={15} />
              </button>
            </div>
          </div>

          {totalCount > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>
                <span>{completedCount} of {totalCount} blocks</span>
                <span>{pct}%</span>
              </div>
              <div style={{ height: 7, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--brand)', borderRadius: 999, transition: 'width .4s ease' }} />
              </div>
            </div>
          )}
        </div>

        {/* Blocks card */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {isEmpty ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>No blocks yet</p>
              <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Start with the default plan or add your own blocks.</p>
              <button
                onClick={seedDefaults}
                disabled={seeding}
                className="btn-primary"
                style={{ marginTop: 4 }}
              >
                {seeding ? 'Loading…' : 'Load default plan'}
              </button>
            </div>
          ) : (
            <>
              {dailyRoutines.map(r => (
                <BlockRow
                  key={r.id} routine={r} count={getCount(r.id)}
                  onTap={() => handleTap(r)} onUndo={() => handleTap(r, -1)}
                  onEdit={() => setModal({ open: true, item: r })}
                  onDelete={() => handleDelete(r)} editing={editing}
                />
              ))}

              {weeklyRoutines.length > 0 && (
                <div style={{ borderTop: dailyRoutines.length > 0 ? '1px solid var(--border)' : 'none' }}>
                  <WeeklyStrengthRow routines={weeklyRoutines} logs={healthLogs} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Add block button */}
        {!isEmpty && (
          <button
            onClick={() => setModal({ open: true })}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 12, border: '1.5px dashed var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-3)', fontSize: 13, fontWeight: 500, justifyContent: 'center' }}
          >
            <Plus size={15} /> Add block
          </button>
        )}

        {/* Badges */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span className="h-eyebrow">Badges</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {([
              { name: 'First Week',       Icon: Leaf,    threshold: 7  },
              { name: 'On Fire',          Icon: Flame,   threshold: 12 },
              { name: 'Frugal Fortnight', Icon: Diamond, threshold: 14 },
              { name: '30-Day Legend',    Icon: Trophy,  threshold: 30 },
            ] as const).map(({ name, Icon, threshold }) => {
              const earned = longestMoneyStreak >= threshold
              const daysAway = threshold - longestMoneyStreak
              return (
                <div
                  key={name}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11, padding: '12px 13px',
                    borderRadius: 14,
                    background: earned ? 'var(--surface-2)' : 'transparent',
                    border: earned ? '1px solid var(--border)' : '1.5px dashed var(--border)',
                    opacity: earned ? 1 : 0.65,
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: earned ? 'var(--brand-soft)' : 'var(--surface-3)',
                  }}>
                    <Icon size={18} style={{ color: earned ? 'var(--brand-ink)' : 'var(--text-4)' }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2, color: earned ? 'var(--good-ink)' : 'var(--text-4)' }}>
                      {earned ? 'Earned' : daysAway === 1 ? '1 day away' : `${daysAway} days away`}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {modal.open && (
        <RoutineModal
          item={modal.item}
          nextOrder={healthRoutines.length}
          onSave={handleSaveRoutine}
          onClose={() => setModal({ open: false })}
        />
      )}
      {confirm && (
        <ConfirmDialog open message={confirm.message} onConfirm={confirm.onConfirm} onClose={() => setConfirm(null)} />
      )}
    </AppShell>
  )
}
