'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Pencil, Plus, Trash2, CheckCircle2, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, addWeeks, format, isSameWeek, startOfWeek } from 'date-fns'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, computeCarryForward, formatCurrencyFull, getTransactionsForWeek, getLast6Months } from '@/lib/utils'
import { useCountUp } from '@/hooks/useCountUp'
import { getCycleRange } from '@/lib/cycle'
import { parseISO, differenceInCalendarDays } from 'date-fns'
import { setUserSettings } from '@/lib/firestore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import Link from 'next/link'
import toast from 'react-hot-toast'

// ── Hero week bars (white/translucent — used inside gradient card) ────────────

const HERO_DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
function getMondayFirstIdx(dow: number) { return dow === 0 ? 6 : dow - 1 }

function HeroWeekBars({
  expenseData,
  incomeData,
  showIncome,
  weeklyBudget,
  todayIdx,
  weekStart,
}: {
  expenseData: number[]
  incomeData: number[]
  showIncome: boolean
  weeklyBudget: number
  todayIdx: number
  weekStart: Date
}) {
  const dailyBudget = weeklyBudget > 0 ? weeklyBudget / 7 : 0
  const max = Math.max(...expenseData, ...(showIncome ? incomeData : []), dailyBudget * 1.4, 1)
  const [grown, setGrown] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  useEffect(() => {
    setGrown(false)
    const t = setTimeout(() => setGrown(true), 120)
    return () => clearTimeout(t)
  }, [expenseData, incomeData])

  const barsAreaH = 44

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 60, position: 'relative' }}>
      {expenseData.map((v, i) => {
        const income = incomeData[i] ?? 0
        const expH = grown ? Math.max(4, (v / max) * barsAreaH) : 4
        const incH = grown ? Math.max(4, (income / max) * barsAreaH) : 4
        const isToday = i === todayIdx
        const isEmpty = v === 0 && (!showIncome || income === 0)
        const isHovered = hoveredIdx === i
        const dayDate = addDays(weekStart, i)

        return (
          <div
            key={i}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, position: 'relative' }}
          >
            {/* Tooltip */}
            {isHovered && (
              <div style={{
                position: 'absolute', bottom: barsAreaH + 18, zIndex: 10, pointerEvents: 'none',
                ...(i >= expenseData.length - 2
                  ? { right: 0 }
                  : i <= 1
                    ? { left: 0 }
                    : { left: '50%', transform: 'translateX(-50%)' }),
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                padding: '8px 11px', boxShadow: 'var(--elev-lg)', whiteSpace: 'nowrap',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                  {format(dayDate, 'EEE, MMM d')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--chip-strong)', flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ color: 'var(--text-3)' }}>Spent</span>
                  <span style={{ fontWeight: 700, color: 'var(--text)', marginLeft: 'auto', paddingLeft: 12 }}>
                    {formatCurrencyFull(v)}
                  </span>
                </div>
                {showIncome && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--good)', flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ color: 'var(--text-3)' }}>Income</span>
                    <span style={{ fontWeight: 700, color: 'var(--good-ink)', marginLeft: 'auto', paddingLeft: 12 }}>
                      {formatCurrencyFull(income)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div style={{
              width: '100%', display: 'flex', justifyContent: 'flex-end', gap: 3,
              height: barsAreaH, borderRadius: 5,
              background: isHovered ? 'rgba(255,255,255,0.10)' : 'transparent',
              transition: 'background .12s',
            }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{
                  height: expH, borderRadius: 5,
                  background: isEmpty
                    ? 'rgba(255,255,255,0.12)'
                    : isToday
                      ? 'rgba(255,255,255,0.90)'
                      : 'rgba(255,255,255,0.45)',
                  transition: `height .65s cubic-bezier(.22,1,.36,1) ${i * 45}ms`,
                }} />
              </div>
              {showIncome && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <div style={{
                    height: incH, borderRadius: 5,
                    background: income === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(120,255,190,0.85)',
                    transition: `height .65s cubic-bezier(.22,1,.36,1) ${i * 45 + 30}ms`,
                  }} />
                </div>
              )}
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

  const { cashNet, daysLeft, todayNeed, todayScheduleLabel, todaySpent, totalEssentials, buffer } = useMemo(() => {
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

    return { cashNet, daysLeft, todayNeed, todayScheduleLabel, todaySpent, totalEssentials, buffer }
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

  // ── Week data for the weekly section ─────────────────────────────────────────
  // Reference date = today capped at the cycle end, so past cycles show their last week;
  // weekOffset lets the user browse other weeks from there.

  const weeklyBudget = settings?.weeklyBudget ?? 0
  const [weekOffset, setWeekOffset] = useState(0)
  const [showIncome, setShowIncome] = useState(false)

  const now = new Date()
  const { end: cycleEnd } = getCycleRange(selectedMonth, settings)
  const baseWeekRef = parseISO(cycleEnd) < now ? parseISO(cycleEnd) : now
  const weekRef = addWeeks(baseWeekRef, weekOffset)

  const isCurrentWeek = weekOffset === 0 && isSameWeek(weekRef, now, { weekStartsOn: 1 })
  const todayMondayIdx = isCurrentWeek ? getMondayFirstIdx(now.getDay()) : -1

  const weekStart = startOfWeek(weekRef, { weekStartsOn: 1 })
  const weekEnd = addDays(weekStart, 6)

  const weekTxsAll = getTransactionsForWeek(transactions, weekRef)
  const weekTxs = weekTxsAll.filter(t => t.type === 'expense')
  const weekIncomeTxs = weekTxsAll.filter(t => t.type === 'income')
  const weekTotal = weekTxs.reduce((s, t) => s + t.amount, 0)
  const weekIncomeTotal = weekIncomeTxs.reduce((s, t) => s + t.amount, 0)
  const weekOver = weeklyBudget > 0 && weekTotal - weeklyBudget > 0
  const dailyIncome = Array.from({ length: 7 }, (_, i) => {
    const dateStr = format(addDays(weekStart, i), 'yyyy-MM-dd')
    return weekIncomeTxs.filter(t => t.date === dateStr).reduce((s, t) => s + t.amount, 0)
  })
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

      {/* ── Weekly section ── */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Header: label + week nav (left), on-track pill + income toggle (right) */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <span style={{
              fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)',
            }}>
              This week
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <button
                onClick={() => setWeekOffset(o => o - 1)}
                aria-label="Previous week"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.7)' }}
              >
                <ChevronLeft size={14} strokeWidth={2.5} />
              </button>
              <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', minWidth: 92, textAlign: 'center' }}>
                {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')}
              </span>
              <button
                onClick={() => setWeekOffset(o => o + 1)}
                aria-label="Next week"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.7)' }}
              >
                <ChevronRight size={14} strokeWidth={2.5} />
              </button>
              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 6px', fontSize: 10.5, fontWeight: 700, color: '#fff' }}
                >
                  Today
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            {weeklyBudget > 0 && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                background: 'rgba(255,255,255,0.18)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.28)',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: weekOver ? 'rgba(255,180,100,1)' : '#fff', flexShrink: 0, display: 'inline-block' }} />
                {weekOver ? `${formatCurrencyFull(weekTotal - weeklyBudget)} over` : 'On track'}
              </span>
            )}
            <button
              onClick={() => setShowIncome(s => !s)}
              aria-pressed={showIncome}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer',
                background: 'transparent', padding: 0,
              }}
            >
              <span style={{ fontSize: 10.5, fontWeight: 600, color: showIncome ? '#fff' : 'rgba(255,255,255,0.55)' }}>
                Income
              </span>
              <span style={{
                width: 26, height: 15, borderRadius: 999, position: 'relative', flexShrink: 0,
                background: showIncome ? 'rgba(120,255,190,0.55)' : 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.28)',
                transition: 'background .15s',
              }}>
                <span style={{
                  position: 'absolute', top: 1, left: showIncome ? 12 : 1,
                  width: 11, height: 11, borderRadius: 999, background: '#fff',
                  transition: 'left .15s',
                }} />
              </span>
            </button>
          </div>
        </div>

        {/* Amount row */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff', fontFamily: "'Geist Mono', monospace" }}>
              {formatCurrencyFull(weekTotal)}
            </div>
            {showIncome && weekIncomeTotal > 0 && (
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(120,255,190,0.9)' }}>
                +{formatCurrencyFull(weekIncomeTotal)}
              </div>
            )}
          </div>
          {weeklyBudget > 0 && (
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)' }}>
              of {formatCurrencyFull(weeklyBudget)}
            </div>
          )}
        </div>

        {/* Bars */}
        <HeroWeekBars
          expenseData={dailySpend}
          incomeData={dailyIncome}
          showIncome={showIncome}
          weeklyBudget={weeklyBudget}
          todayIdx={todayMondayIdx}
          weekStart={weekStart}
        />

        {/* Budget progress strip / set-budget CTA */}
        {weeklyBudget > 0 ? (
          <div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.18)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 999,
                width: `${Math.min((weekTotal / weeklyBudget) * 100, 100)}%`,
                background: weekOver ? 'rgba(255,140,120,0.9)' : 'rgba(255,255,255,0.85)',
                transition: 'width .5s cubic-bezier(.22,1,.36,1)',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
              <span>{formatCurrencyFull(weekTotal)} spent</span>
              <Link href="/transactions" style={{ color: '#fff', fontWeight: 600, textDecoration: 'none', fontSize: 11 }}>
                View all →
              </Link>
              <span>{formatCurrencyFull(weeklyBudget)} budget</span>
            </div>
          </div>
        ) : (
          <Link href="/settings" style={{ fontSize: 12.5, color: '#fff', textDecoration: 'none', fontWeight: 600 }}>
            Set a weekly budget in Settings →
          </Link>
        )}
      </div>
    </div>
  )
}
