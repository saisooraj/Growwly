'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Pencil, Plus, Trash2, CheckCircle2, X } from 'lucide-react'
import { addDays, format, startOfWeek } from 'date-fns'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, computeCarryForward, formatCurrencyFull, getTransactionsForWeek, getLast6Months, getMonthLabel } from '@/lib/utils'
import { useCountUp } from '@/hooks/useCountUp'
import { getCycleRange } from '@/lib/cycle'
import { parseISO, differenceInCalendarDays } from 'date-fns'
import { setUserSettings } from '@/lib/firestore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import toast from 'react-hot-toast'

// ── Hero week bars (white/translucent — used inside gradient card) ────────────

const HERO_DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
function getMondayFirstIdx(dow: number) { return dow === 0 ? 6 : dow - 1 }

function HeroWeekBars({
  data,
  weekTotal,
  weeklyBudget,
  todayIdx,
}: {
  data: number[]
  weekTotal: number
  weeklyBudget: number
  todayIdx: number
}) {
  const max = Math.max(...data, weeklyBudget > 0 ? weeklyBudget / 7 * 1.4 : 1)
  const [grown, setGrown] = useState(false)
  useEffect(() => { const t = setTimeout(() => setGrown(true), 120); return () => clearTimeout(t) }, [])

  return (
    <div>
      {/* Label row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          This week
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
          {formatCurrencyFull(weekTotal)}
          {weeklyBudget > 0 && (
            <span style={{ fontWeight: 500, opacity: 0.65 }}> / {formatCurrencyFull(weeklyBudget)}</span>
          )}
        </span>
      </div>
      {/* Bars */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 60 }}>
        {data.map((v, i) => {
          const barH = grown ? Math.max(4, (v / max) * 44) : 4
          const isToday = i === todayIdx
          const isEmpty = v === 0
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 44 }}>
                <div style={{
                  height: barH, borderRadius: 5,
                  background: isEmpty
                    ? 'rgba(255,255,255,0.12)'
                    : isToday
                      ? 'rgba(255,255,255,0.90)'
                      : 'rgba(255,255,255,0.45)',
                  transition: `height .65s cubic-bezier(.22,1,.36,1) ${i * 45}ms`,
                }} />
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: isToday ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)',
              }}>
                {HERO_DAY_LABELS[i]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Types ────────────────────────────────────────────────────────────────────

type Item     = { label: string; amount: number }
type Schedule = { days: number[]; items: Item[]; total: number }
type Draft    = { days: number[]; items: Item[] }

const DAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

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
            style={{ width: 80, padding: '6px 8px', border: 'none', background: 'transparent', fontSize: 12, color: 'var(--text)', outline: 'none' }}
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

  const { cashNet, carryForward, prevMonth, daysLeft, todayNeed, todayScheduleLabel, todaySpent, totalEssentials, buffer } = useMemo(() => {
    const summary  = buildMonthlySummary(transactions, selectedMonth, settings, borrowings)
    const today    = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    const { end }  = getCycleRange(selectedMonth, settings)
    const daysLeft = Math.max(1, differenceInCalendarDays(parseISO(end), today) + 1)

    // Carry forward: unspent balance from the previous salary cycle (chained)
    const months      = getLast6Months()
    const curIdx      = months.indexOf(selectedMonth)
    const prevMonth   = curIdx > 0 ? months[curIdx - 1] : null
    const carryForward = curIdx > 0
      ? computeCarryForward(months.slice(0, curIdx), transactions, settings, borrowings)
      : 0

    const cashNet  = Math.max(summary.cashNet, 0) + carryForward

    // Today's actual expense spend (from transactions)
    const todaySpent = transactions
      .filter(t => t.date === todayStr && t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)

    function needForDay(date: Date): number {
      const dow = date.getDay()
      const s   = schedules.find(sch => sch.days.includes(dow))
      return s?.total ?? 0
    }

    const todayNeed          = needForDay(today)
    const todayDow           = today.getDay()
    const todaySched         = schedules.find(s => s.days.includes(todayDow))
    const todayScheduleLabel = todaySched
      ? todaySched.days.length === 7 ? 'Every day'
        : todaySched.days.includes(6) || todaySched.days.includes(0) ? 'Weekend' : 'Weekday'
      : ''

    let totalEssentials = 0
    for (let d = 0; d < daysLeft; d++) {
      totalEssentials += needForDay(addDays(today, d))
    }

    const buffer = cashNet - totalEssentials

    return { cashNet, carryForward, prevMonth, daysLeft, todayNeed, todayScheduleLabel, todaySpent, totalEssentials, buffer }
  }, [transactions, selectedMonth, settings, borrowings, schedules])

  const isCovered   = buffer >= 0
  const todayOver   = todayNeed > 0 && todaySpent > todayNeed
  const todayPct    = todayNeed > 0 ? Math.min(100, (todaySpent / todayNeed) * 100) : 0
  const todayTone   = todayOver ? 'bad' : todayPct >= 80 ? 'warn' : 'good'
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

  // ── Week data for hero bars ──────────────────────────────────────────────────
  // Reference date = today capped at the cycle end, so past cycles show their last week.

  const weeklyBudget = settings?.weeklyBudget ?? 0
  const now = new Date()
  const { start: cycleStart, end: cycleEnd } = getCycleRange(selectedMonth, settings)
  const weekRef = parseISO(cycleEnd) < now ? parseISO(cycleEnd) : now
  const todayMondayIdx = getMondayFirstIdx(weekRef.getDay())
  const weekStart = startOfWeek(weekRef, { weekStartsOn: 1 })
  const weekTxs = getTransactionsForWeek(transactions, weekRef)
    .filter(t => t.type === 'expense' && t.date >= cycleStart && t.date <= cycleEnd)
  const weekTotal = weekTxs.reduce((s, t) => s + t.amount, 0)
  const dailySpend = Array.from({ length: 7 }, (_, i) => {
    const dateStr = format(addDays(weekStart, i), 'yyyy-MM-dd')
    return weekTxs.filter(t => t.date === dateStr).reduce((s, t) => s + t.amount, 0)
  })

  // ── Derived display values ───────────────────────────────────────────────────

  const dailySafe = daysLeft > 0 ? Math.max(0, Math.round(cashNet / daysLeft)) : 0
  const statusOk  = cashNet > 0 && (!isConfigured || !todayOver)

  const heroAmount = isConfigured
    ? Math.max(0, todayNeed > 0 ? todayNeed - todaySpent : dailySafe)
    : dailySafe
  const animatedHero = useCountUp(heroAmount, 950)
  const statusLabel = !statusOk
    ? (cashNet <= 0 ? 'Off track' : 'Over today')
    : (todayPct >= 80 ? 'Near limit' : 'On track')

  // ── Render ──────────────────────────────────────────────────────────────────

  /* Edit mode uses a regular card so form controls remain on light bg */
  if (editing) {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="h-eyebrow">Configure daily baseline</span>
          <button type="button" onClick={() => setEditing(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 2 }}
            title="Cancel">
            <X size={14} />
          </button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
          Set a daily spend baseline. Add multiple schedules for different days.
        </p>

        {drafts.map((draft, i) => {
          const takenDays = drafts.filter((_, idx) => idx !== i).flatMap(d => d.days)
          return (
            <ScheduleEditor
              key={i} draft={draft} takenDays={takenDays}
              onChange={updated => setDrafts(prev => prev.map((d, idx) => idx === i ? updated : d))}
              onRemove={() => setDrafts(prev => prev.filter((_, idx) => idx !== i))}
            />
          )
        })}

        {drafts.flatMap(d => d.days).length < 7 && (
          <button type="button" onClick={addSchedule}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontSize: 12 }}>
            <Plus size={13} /> Add schedule for other days
          </button>
        )}

        <button type="button" onClick={save} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 9, background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
          <CheckCircle2 size={14} /> {saving ? 'Saving…' : 'Save baseline'}
        </button>
      </div>
    )
  }

  /* ── Hero gradient display card ── */
  return (
    <div style={{
      background: 'linear-gradient(150deg, var(--brand-deep) 0%, var(--brand) 55%, var(--brand-2) 100%)',
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--pad)',
      boxShadow: '0 8px 32px -8px var(--brand)',
      display: 'flex', flexDirection: 'column', gap: 14,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle noise overlay for depth */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 60% at 110% -10%, rgba(255,255,255,0.12) 0%, transparent 60%)',
      }} />

      {/* ── Top row: eyebrow + status + edit ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, position: 'relative' }}>
        <span style={{
          fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em',
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)',
        }}>
          Safe to spend today
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
            background: 'rgba(255,255,255,0.18)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.28)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusOk ? '#fff' : 'rgba(255,180,100,1)', flexShrink: 0, display: 'inline-block' }} />
            {statusLabel}
          </span>
          <button type="button" onClick={openEdit}
            style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)', borderRadius: 8, cursor: 'pointer', color: '#fff', display: 'flex', padding: '4px 6px' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.28)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
            title="Configure daily baseline">
            <Pencil size={12} />
          </button>
        </div>
      </div>

      {/* ── Primary number ── */}
      <div style={{ position: 'relative' }}>
        <div style={{
          fontSize: 'clamp(36px, 7vw, 52px)',
          fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1,
          color: '#fff',
          fontFamily: "'Geist Mono', monospace",
        }}>
          {formatCurrencyFull(animatedHero)}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 6, fontWeight: 500 }}>
          {isConfigured && todayNeed > 0
            ? `${todayOver ? 'over' : 'left'} today · ₹${todaySpent.toLocaleString('en-IN')} spent`
            : `for the next ${daysLeft} day${daysLeft !== 1 ? 's' : ''} · ₹${todaySpent.toLocaleString('en-IN')} spent today`
          }
        </div>
        {carryForward > 0 && prevMonth && (
          <div style={{
            marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11.5, fontWeight: 600,
            color: 'rgba(255,255,255,0.8)',
            background: 'rgba(255,255,255,0.14)',
            border: '1px solid rgba(255,255,255,0.22)',
            borderRadius: 7, padding: '3px 9px',
          }}>
            ↩ {formatCurrencyFull(carryForward)} carried from {getMonthLabel(prevMonth)}
          </div>
        )}
        {!isConfigured && (
          <button type="button" onClick={openEdit}
            style={{
              marginTop: 10, padding: '5px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.18)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.28)', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
            }}>
            Set daily baseline →
          </button>
        )}
      </div>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.18)' }} />

      {/* ── Week bars ── */}
      <HeroWeekBars
        data={dailySpend}
        weekTotal={weekTotal}
        weeklyBudget={weeklyBudget}
        todayIdx={todayMondayIdx}
      />
    </div>
  )
}
