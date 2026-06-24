'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { HealthRoutine, HealthCategory, HealthScheduleType } from '@/types'

const CATEGORIES: { value: HealthCategory; label: string }[] = [
  { value: 'legs',       label: 'Legs' },
  { value: 'back',       label: 'Back' },
  { value: 'neck',       label: 'Neck / Shoulders' },
  { value: 'strength',   label: 'Strength' },
  { value: 'full-body',  label: 'Full Body' },
]

const SCHEDULE_TYPES: { value: HealthScheduleType; label: string; hint: string }[] = [
  { value: 'daily',         label: 'Daily',          hint: 'Once per day at a set time' },
  { value: 'hourly-window', label: 'Hourly counter', hint: 'Count target during a time window' },
  { value: 'weekly',        label: 'Weekly',         hint: 'On specific days of the week' },
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_VALS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

interface Props {
  item?: HealthRoutine
  nextOrder: number
  onSave: (data: Omit<HealthRoutine, 'id' | 'userId' | 'createdAt'>, id?: string) => Promise<void>
  onClose: () => void
}

export default function RoutineModal({ item, nextOrder, onSave, onClose }: Props) {
  const [name, setName]           = useState(item?.name ?? '')
  const [subtitle, setSubtitle]   = useState(item?.subtitle ?? '')
  const [category, setCategory]   = useState<HealthCategory>(item?.category ?? 'legs')
  const [scheduleType, setScheduleType] = useState<HealthScheduleType>(item?.scheduleType ?? 'daily')
  const [reminderTime, setReminderTime] = useState(item?.reminderTime ?? '')
  const [daysOfWeek, setDaysOfWeek]     = useState<string[]>(item?.daysOfWeek ?? [])
  const [targetCount, setTargetCount]   = useState(item?.targetCount ? String(item.targetCount) : '8')
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    if (item) {
      setName(item.name); setSubtitle(item.subtitle ?? ''); setCategory(item.category)
      setScheduleType(item.scheduleType); setReminderTime(item.reminderTime ?? '')
      setDaysOfWeek(item.daysOfWeek ?? []); setTargetCount(item.targetCount ? String(item.targetCount) : '8')
    }
  }, [item])

  function toggleDay(d: string) {
    setDaysOfWeek(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        subtitle: subtitle.trim() || undefined,
        category,
        scheduleType,
        reminderTime: reminderTime || undefined,
        daysOfWeek: scheduleType === 'weekly' ? daysOfWeek : undefined,
        targetCount: scheduleType === 'hourly-window' ? Number(targetCount) || 8 : undefined,
        order: item?.order ?? nextOrder,
        active: item?.active ?? true,
      }, item?.id)
    } finally { setSaving(false) }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 24, paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{item ? 'Edit Block' : 'New Block'}</h2>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, border: 'none', background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--text-2)', display: 'flex' }}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Name</label>
            <input className="input" placeholder="e.g. Morning walk" value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>

          <div>
            <label className="label">Subtitle (optional)</label>
            <input className="input" placeholder="e.g. 1.8km · legs" value={subtitle} onChange={e => setSubtitle(e.target.value)} />
          </div>

          <div>
            <label className="label">Category</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CATEGORIES.map(c => (
                <button key={c.value} type="button" onClick={() => setCategory(c.value)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                    border: `1.5px solid ${category === c.value ? 'var(--brand)' : 'var(--border)'}`,
                    background: category === c.value ? 'var(--brand-soft)' : 'var(--surface-2)',
                    color: category === c.value ? 'var(--brand-ink)' : 'var(--text-2)',
                  }}
                >{c.label}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Schedule</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SCHEDULE_TYPES.map(s => (
                <button key={s.value} type="button" onClick={() => setScheduleType(s.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, textAlign: 'left',
                    border: `1px solid ${scheduleType === s.value ? 'var(--brand)' : 'var(--border)'}`,
                    background: scheduleType === s.value ? 'var(--brand-soft)' : 'var(--surface)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: scheduleType === s.value ? 'var(--brand)' : 'var(--border-strong)' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: scheduleType === s.value ? 'var(--brand-ink)' : 'var(--text)' }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.hint}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {scheduleType === 'daily' && (
            <div>
              <label className="label">Reminder time (optional)</label>
              <input className="input" type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} />
            </div>
          )}

          {scheduleType === 'hourly-window' && (
            <div>
              <label className="label">Target count per day</label>
              <input className="input" type="number" min="1" max="24" value={targetCount} onChange={e => setTargetCount(e.target.value)} />
            </div>
          )}

          {scheduleType === 'weekly' && (
            <div>
              <label className="label">Days</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {DAYS.map((d, i) => {
                  const val = DAY_VALS[i]
                  const active = daysOfWeek.includes(val)
                  return (
                    <button key={val} type="button" onClick={() => toggleDay(val)}
                      style={{
                        flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
                        border: `1.5px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
                        background: active ? 'var(--brand-soft)' : 'var(--surface-2)',
                        color: active ? 'var(--brand-ink)' : 'var(--text-3)',
                      }}
                    >{d}</button>
                  )
                })}
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary btn" disabled={saving || !name.trim()} style={{ marginTop: 4 }}>
            {saving ? 'Saving…' : item ? 'Update' : 'Add Block'}
          </button>
        </form>
      </div>
    </div>
  )
}
