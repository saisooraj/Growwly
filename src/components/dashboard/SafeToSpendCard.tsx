'use client'

import { useState, useMemo, useRef } from 'react'
import { Pencil, Plus, Trash2, CheckCircle2, X } from 'lucide-react'
import { addDays } from 'date-fns'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, formatCurrencyFull } from '@/lib/utils'
import { getCycleRange } from '@/lib/cycle'
import { parseISO, differenceInCalendarDays } from 'date-fns'
import { setUserSettings } from '@/lib/firestore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import toast from 'react-hot-toast'

// ── Types ────────────────────────────────────────────────────────────────────

type Item     = { label: string; amount: number }
type Schedule = { days: number[]; items: Item[]; total: number }
type Draft    = { days: number[]; items: Item[] }

const DAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const DAY_LABEL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// ── Schedule editor sub-component ────────────────────────────────────────────

function ScheduleEditor({
  draft, takenDays, onChange, onRemove,
}: {
  draft: Draft
  takenDays: number[]
  onChange: (d: Draft) => void
  onRemove: () => void
}) {
  const [label, setLabel]   = useState('')
  const [amount, setAmount] = useState('')
  const labelRef  = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  const total = draft.items.reduce((s, i) => s + i.amount, 0)

  function toggleDay(d: number) {
    const next = draft.days.includes(d) ? draft.days.filter(x => x !== d) : [...draft.days, d]
    onChange({ ...draft, days: next })
  }

  function addItem() {
    const amt = Number(amount)
    if (!label.trim() || !amt || amt <= 0) return
    onChange({ ...draft, items: [...draft.items, { label: label.trim(), amount: amt }] })
    setLabel('')
    setAmount('')
    setTimeout(() => labelRef.current?.focus(), 0)
  }

  function removeItem(i: number) {
    onChange({ ...draft, items: draft.items.filter((_, idx) => idx !== i) })
  }

  // Quick-select helpers
  function selectAll()      { onChange({ ...draft, days: [0,1,2,3,4,5,6].filter(d => !takenDays.includes(d)) }) }
  function selectWeekdays() { onChange({ ...draft, days: [1,2,3,4,5].filter(d => !takenDays.includes(d)) }) }
  function selectWeekends() { onChange({ ...draft, days: [0,6].filter(d => !takenDays.includes(d)) }) }

  const dayLabel = draft.days.length === 0
    ? 'No days selected'
    : draft.days.length === 7
    ? 'Every day'
    : draft.days.sort((a,b)=>a-b).map(d => DAY_SHORT[d]).join(', ')

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
          {dayLabel}{total > 0 ? ` · ₹${total.toLocaleString('en-IN')}/day` : ''}
        </span>
        <button type="button" onClick={onRemove}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', display: 'flex', padding: 2 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--bad)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-4)')}>
          <X size={13} />
        </button>
      </div>

      {/* Quick-select row */}
      <div style={{ display: 'flex', gap: 5 }}>
        {[
          { label: 'All week', fn: selectAll,     eligible: [0,1,2,3,4,5,6].some(d => !takenDays.includes(d)) },
          { label: 'Weekdays', fn: selectWeekdays, eligible: [1,2,3,4,5].some(d => !takenDays.includes(d)) },
          { label: 'Weekends', fn: selectWeekends, eligible: [0,6].some(d => !takenDays.includes(d)) },
        ].map(opt => (
          <button key={opt.label} type="button" onClick={opt.fn} disabled={!opt.eligible}
            style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: opt.eligible ? 'var(--text-2)' : 'var(--text-4)', cursor: opt.eligible ? 'pointer' : 'not-allowed' }}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Day pills */}
      <div style={{ display: 'flex', gap: 4 }}>
        {DAY_SHORT.map((name, d) => {
          const selected = draft.days.includes(d)
          const taken    = takenDays.includes(d)
          return (
            <button key={d} type="button" disabled={taken} onClick={() => toggleDay(d)}
              style={{
                flex: 1, padding: '5px 0', borderRadius: 7, border: 'none',
                cursor: taken ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600,
                background: selected ? 'var(--brand)' : taken ? 'var(--surface-3)' : 'var(--surface-2)',
                color: selected ? '#fff' : taken ? 'var(--text-4)' : 'var(--text-3)',
                transition: 'all .12s',
              }}>
              {name}
            </button>
          )
        })}
      </div>

      {/* Expense items */}
      {draft.items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {draft.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 7, background: 'var(--surface-2)' }}>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{item.label}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>₹{item.amount.toLocaleString('en-IN')}</span>
              <button type="button" onClick={() => removeItem(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', display: 'flex', padding: 2 }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--bad)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-4)')}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add item row */}
      <div style={{ display: 'flex', gap: 5 }}>
        <input ref={labelRef} type="text" placeholder="e.g. Breakfast"
          value={label} onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); amountRef.current?.focus(); amountRef.current?.select() } }}
          style={{ flex: 1, padding: '6px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 12, color: 'var(--text)', outline: 'none' }}
        />
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden', background: 'var(--surface)' }}>
          <span style={{ padding: '6px 7px', background: 'var(--surface-2)', color: 'var(--text-3)', fontSize: 12, borderRight: '1px solid var(--border)', userSelect: 'none' }}>₹</span>
          <input ref={amountRef} type="number" placeholder="0" min="0"
            value={amount} onChange={e => setAmount(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
            style={{ width: 58, padding: '6px 6px', border: 'none', background: 'transparent', fontSize: 12, color: 'var(--text)', outline: 'none' }}
          />
        </div>
        <button type="button" onClick={addItem}
          style={{ padding: '6px 9px', borderRadius: 7, background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-2)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-2)')}>
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}

// ── Main card ─────────────────────────────────────────────────────────────────

export default function SafeToSpendCard() {
  const { user }  = useAuth()
  const refresh   = useRefreshData()
  const { transactions, selectedMonth, settings, borrowings } = useAppStore()

  const [editing, setEditing]         = useState(false)
  const [drafts, setDrafts]           = useState<Draft[]>([])
  const [saving, setSaving]           = useState(false)

  // ── Calculations ────────────────────────────────────────────────────────────

  const schedules: Schedule[] = settings?.dailyLivingSchedules ?? []
  const isConfigured = schedules.length > 0 && schedules.some(s => s.days.length > 0 && s.total > 0)

  const { cashNet, daysLeft, todayNeed, todayScheduleLabel, totalEssentials, buffer, extraPerDay } = useMemo(() => {
    const summary  = buildMonthlySummary(transactions, selectedMonth, settings, borrowings)
    const today    = new Date()
    const { end }  = getCycleRange(selectedMonth, settings)
    const daysLeft = Math.max(1, differenceInCalendarDays(parseISO(end), today) + 1)
    const cashNet  = Math.max(summary.cashNet, 0)

    function needForDay(date: Date): number {
      const dow = date.getDay()
      const s   = schedules.find(sch => sch.days.includes(dow))
      return s?.total ?? 0
    }

    const todayNeed           = needForDay(today)
    const todayDow            = today.getDay()
    const todaySched          = schedules.find(s => s.days.includes(todayDow))
    const todayScheduleLabel  = todaySched
      ? todaySched.days.length === 7 ? 'Every day'
        : todaySched.days.length <= 2 ? todaySched.days.sort((a,b)=>a-b).map(d => DAY_LABEL[d]).join(' & ')
        : todaySched.days.includes(6) || todaySched.days.includes(0) ? 'Weekend' : 'Weekday'
      : ''

    let totalEssentials = 0
    for (let d = 0; d < daysLeft; d++) {
      totalEssentials += needForDay(addDays(today, d))
    }

    const buffer     = cashNet - totalEssentials
    const extraPerDay = daysLeft > 0 ? buffer / daysLeft : 0

    return { cashNet, daysLeft, todayNeed, todayScheduleLabel, totalEssentials, buffer, extraPerDay }
  }, [transactions, selectedMonth, settings, borrowings, schedules])

  const isCovered = buffer >= 0
  const tone      = !isConfigured ? 'neutral' : isCovered ? (extraPerDay > 200 ? 'good' : 'warn') : 'bad'
  const gradientColor = tone === 'good' ? 'oklch(0.95 0.05 152 / .7)' : tone === 'warn' ? 'oklch(0.96 0.06 75 / .7)' : tone === 'bad' ? 'oklch(0.95 0.04 25 / .7)' : 'transparent'

  const insightText = (() => {
    if (!isConfigured) return 'Set your daily baseline to get smarter advice'
    if (!isCovered) {
      const shortPerDay = Math.abs(buffer / daysLeft)
      return `Short by ${formatCurrencyFull(Math.ceil(shortPerDay))}/day on avg — need to cut spending to last the cycle`
    }
    if (extraPerDay < 100) return `Barely covered — stick close to your baseline each day`
    return `${formatCurrencyFull(Math.floor(extraPerDay))} extra per day after essentials`
  })()

  // ── Edit helpers ────────────────────────────────────────────────────────────

  function openEdit() {
    setDrafts(
      schedules.length > 0
        ? schedules.map(s => ({ days: [...s.days], items: [...s.items] }))
        : [{ days: [0,1,2,3,4,5,6], items: [] }]
    )
    setEditing(true)
  }

  function addSchedule() {
    const taken = drafts.flatMap(d => d.days)
    const free  = [0,1,2,3,4,5,6].filter(d => !taken.includes(d))
    setDrafts(prev => [...prev, { days: free, items: [] }])
  }

  async function save() {
    const valid = drafts.filter(d => d.days.length > 0 && d.items.length > 0)
    if (valid.length === 0) { toast.error('Add at least one schedule with items'); return }
    setSaving(true)
    try {
      const built: Schedule[] = valid.map(d => ({
        days: d.days,
        items: d.items,
        total: d.items.reduce((s, i) => s + i.amount, 0),
      }))
      await setUserSettings(user!.uid, { dailyLivingSchedules: built })
      await refresh()
      setEditing(false)
      toast.success('Daily baseline saved')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', overflow: 'hidden' }}>

      {/* Gradient bg */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 80% at 90% 0%, ${gradientColor} 0%, transparent 55%)`, pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="h-eyebrow">Safe to spend / day</span>
        <button type="button"
          onClick={editing ? () => setEditing(false) : openEdit}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 2 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
          title={editing ? 'Cancel' : 'Configure daily baseline'}>
          {editing ? <X size={14} /> : <Pencil size={13} />}
        </button>
      </div>

      {/* ── Edit mode ── */}
      {editing ? (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            Set a daily spend baseline. Add multiple schedules for different days.
          </p>

          {drafts.map((draft, i) => {
            const takenDays = drafts.filter((_, idx) => idx !== i).flatMap(d => d.days)
            return (
              <ScheduleEditor
                key={i}
                draft={draft}
                takenDays={takenDays}
                onChange={updated => setDrafts(prev => prev.map((d, idx) => idx === i ? updated : d))}
                onRemove={() => setDrafts(prev => prev.filter((_, idx) => idx !== i))}
              />
            )
          })}

          {/* Add schedule — only if unclaimed days remain */}
          {drafts.flatMap(d => d.days).length < 7 && (
            <button type="button" onClick={addSchedule}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontSize: 12 }}>
              <Plus size={13} /> Add schedule for other days
            </button>
          )}

          {/* Save */}
          <button type="button" onClick={save} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 9, background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
            <CheckCircle2 size={14} /> {saving ? 'Saving…' : 'Save baseline'}
          </button>
        </div>

      ) : !isConfigured ? (
        /* ── Not configured ── */
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div className="display-num" style={{ fontSize: 28, color: 'var(--text-3)', lineHeight: 1 }}>
              {formatCurrencyFull(Math.round(cashNet / daysLeft))}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 4 }}>available / day · {daysLeft} days left</div>
          </div>
          <button type="button" onClick={openEdit}
            style={{ alignSelf: 'flex-start', padding: '5px 12px', borderRadius: 8, background: 'var(--brand-soft)', color: 'var(--brand-ink)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
            + Set daily baseline →
          </button>
          <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0 }}>
            Tell us your daily needs (food, fuel, commute) to get smarter advice.
          </p>
        </div>

      ) : (
        /* ── Configured view ── */
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Primary number */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span className="display-num" style={{ fontSize: 32, lineHeight: 1, color: isCovered ? 'var(--text)' : 'var(--bad-ink)' }}>
              {isCovered
                ? `+${formatCurrencyFull(Math.floor(extraPerDay))}`
                : `−${formatCurrencyFull(Math.ceil(Math.abs(extraPerDay)))}`}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{isCovered ? 'extra / day' : 'short / day'}</span>
          </div>

          {/* Today vs available */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {todayNeed > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-3)' }}>Today's need{todayScheduleLabel ? ` (${todayScheduleLabel})` : ''}</span>
                <span style={{ color: 'var(--text)', fontWeight: 500 }}>{formatCurrencyFull(todayNeed)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-3)' }}>Total essentials left</span>
              <span style={{ color: isCovered ? 'var(--good-ink)' : 'var(--bad-ink)', fontWeight: 500 }}>{formatCurrencyFull(Math.round(totalEssentials))}</span>
            </div>
          </div>

          {/* Schedule chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {schedules.map((s, i) => (
              <span key={i} style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                {s.days.sort((a,b)=>a-b).map(d => DAY_SHORT[d]).join('/')} · ₹{s.total.toLocaleString('en-IN')}
              </span>
            ))}
          </div>

          {/* Status + insight */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`pill ${tone === 'good' ? 'good' : tone === 'warn' ? 'warn' : 'bad'}`}>
              <span className="pill-dot" />
              {isCovered ? (extraPerDay > 200 ? 'Comfortable' : 'Just covered') : 'Tight'}
            </span>
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, lineHeight: 1.5 }}>{insightText}</p>
        </div>
      )}
    </div>
  )
}
