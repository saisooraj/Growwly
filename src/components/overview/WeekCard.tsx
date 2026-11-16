'use client'

import { useMemo, useState } from 'react'
import { addDays, addWeeks, differenceInCalendarDays, format, isSameMonth, startOfWeek } from 'date-fns'
import { useAppStore } from '@/store/appStore'
import { Amt, Pill, inr, useMask } from './ui'

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const BAR = 108   // tallest bar in px, inside a 120 px area

export default function WeekCard({ isNew }: { isNew: boolean }) {
  const transactions = useAppStore(s => s.transactions)
  const settings = useAppStore(s => s.settings)
  const { M } = useMask()
  const [offset, setOffset] = useState(0)
  const [showIncome, setShowIncome] = useState(false)
  const [hover, setHover] = useState<number | null>(null)

  const budget = settings?.weeklyBudget ?? 0
  const daily = budget > 0 ? budget / 7 : 0
  const now = new Date()
  const start = startOfWeek(addWeeks(now, offset), { weekStartsOn: 1 })
  const end = addDays(start, 6)
  const todayIdx = offset === 0 ? differenceInCalendarDays(now, start) : offset < 0 ? 7 : -1

  const { spend, income } = useMemo(() => {
    const spend = Array(7).fill(0), income = Array(7).fill(0)
    const s = format(start, 'yyyy-MM-dd'), e = format(end, 'yyyy-MM-dd')
    for (const t of transactions) {
      if (t.date < s || t.date > e) continue
      const i = differenceInCalendarDays(new Date(t.date + 'T00:00:00'), start)
      if (t.type === 'expense') spend[i] += t.amount
      else if (t.type === 'income') income[i] += t.amount
    }
    return { spend, income }
  }, [transactions, start.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = spend.reduce((a, b) => a + b, 0)
  const incTotal = income.reduce((a, b) => a + b, 0)
  const daysIn = offset === 0 ? todayIdx + 1 : 7
  const over = total - budget
  const max = Math.max(...spend, ...(showIncome ? income : []), daily * 1.35, 1)
  const h = (v: number, i: number) => (i > todayIdx || !v ? 4 : Math.max(6, Math.round((v / max) * BAR)))
  const label = isSameMonth(start, end) ? `${format(start, 'MMM d')} – ${format(end, 'd')}` : `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`

  return (
    <div className="ov-card" style={{ gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div className="ov-title">This week</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12.5, color: 'var(--ink2)', marginRight: 'auto' }}>
          <button onClick={() => setOffset(o => o - 1)} aria-label="Previous week" className="ov-btn" style={{ padding: '2px 6px', background: 'none', color: 'var(--ink2)', fontSize: 'inherit' }}>‹</button>
          <span style={{ fontWeight: 600 }}>{label}</span>
          <button onClick={() => setOffset(o => Math.min(0, o + 1))} disabled={offset === 0} aria-label="Next week" className="ov-btn" style={{ padding: '2px 6px', background: 'none', color: offset === 0 ? 'var(--ink3)' : 'var(--ink2)', fontSize: 'inherit', cursor: offset === 0 ? 'default' : 'pointer' }}>›</button>
          {offset !== 0 && <button onClick={() => setOffset(0)} className="ov-btn" style={{ marginLeft: 4, fontSize: 11.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'var(--surface2)', color: 'var(--ink)' }}>Today</button>}
        </div>
        {isNew || budget <= 0 ? <Pill t="neutral">No budget</Pill>
          : over > 0 ? <Pill t="bad">{M(inr(over))} over</Pill> : <Pill t="good">On track</Pill>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 12.5, color: 'var(--ink2)' }}>
          {isNew ? 'Your week fills in as you log'
            : offset !== 0 ? <><Amt value={total} className="ov-mono" style={{ color: 'var(--ink)', fontWeight: 600 }} />{budget > 0 && <> of <Amt value={budget} className="ov-mono" /></>} · Avg <Amt value={total / 7} />/day</>
            : <>Avg <Amt value={total / Math.max(1, daysIn)} />/day{showIncome && incTotal > 0 && <span style={{ color: 'var(--good-ink)', fontWeight: 700 }}> · +<Amt value={incTotal} /> in</span>}</>}
        </div>
        <button onClick={() => setShowIncome(v => !v)} role="switch" aria-checked={showIncome} className="ov-btn" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--ink2)', background: 'none', padding: 0 }}>
          Income
          <span style={{ width: 32, height: 18, borderRadius: 999, background: showIncome ? 'var(--brand)' : 'var(--surface2)', position: 'relative', transition: 'background .2s' }}>
            <span style={{ position: 'absolute', left: showIncome ? 16 : 2, top: 2, width: 14, height: 14, borderRadius: '50%', background: showIncome ? '#fff' : 'var(--ink3)', transition: 'left .2s var(--ease-out)' }} />
          </span>
        </button>
      </div>

      <div style={{ position: 'relative', height: 120, display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 8, alignItems: 'end', borderBottom: '1px solid var(--line)' }}>
        {daily > 0 && !isNew && (
          <>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: Math.round((daily / max) * BAR), borderTop: '1.5px dashed var(--ink3)', opacity: 0.6, pointerEvents: 'none' }} />
            <div className="ov-mono" style={{ position: 'absolute', right: 0, bottom: Math.round((daily / max) * BAR), transform: 'translateY(-4px)', fontSize: 10, color: 'var(--ink3)', background: 'var(--surface)', padding: '0 0 0 4px', pointerEvents: 'none' }}>{M(inr(daily))}/day</div>
          </>
        )}
        {spend.map((v, i) => {
          const empty = i > todayIdx || !v
          const bg = empty ? 'var(--surface2)' : daily && v > daily ? 'var(--bad)' : i === todayIdx ? 'var(--brand)' : 'var(--bar)'
          return (
            <div
              key={i} style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'flex-end', gap: 3 }}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onPointerDown={() => setHover(i)}
            >
              <div className="ov-grow" style={{ flex: 1, height: h(v, i), borderRadius: '7px 7px 3px 3px', background: bg, animationDelay: `${i * 40}ms` }} />
              {showIncome && <div className="ov-grow" style={{ flex: 1, height: h(income[i], i), borderRadius: '7px 7px 3px 3px', background: income[i] && i <= todayIdx ? 'var(--good)' : 'var(--surface2)', animationDelay: `${i * 40 + 20}ms` }} />}
              {hover === i && i <= todayIdx && (
                <div style={{
                  position: 'absolute', bottom: '100%', marginBottom: 6, zIndex: 2, whiteSpace: 'nowrap',
                  ...(i >= 5 ? { right: 0 } : i <= 1 ? { left: 0 } : { left: '50%', transform: 'translateX(-50%)' }),
                  padding: '7px 10px', borderRadius: 10, background: 'var(--surface)', boxShadow: 'var(--shadow), 0 0 0 1px var(--line)', fontSize: 11.5,
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{format(addDays(start, i), 'EEE, MMM d')}</div>
                  <div style={{ color: 'var(--ink2)' }}>Spent <Amt value={v} className="ov-mono" style={{ color: 'var(--ink)', fontWeight: 600 }} /></div>
                  {showIncome && income[i] > 0 && <div style={{ color: 'var(--ink2)' }}>Income <Amt value={income[i]} className="ov-mono" style={{ color: 'var(--good-ink)', fontWeight: 600 }} /></div>}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 8, marginTop: -6 }}>
        {DAYS.map((d, i) => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: i === todayIdx ? 800 : 600, color: i === todayIdx ? 'var(--ink)' : 'var(--ink3)' }}>{d}</div>)}
      </div>
    </div>
  )
}
