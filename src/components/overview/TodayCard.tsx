'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns'
import { useAppStore } from '@/store/appStore'
import { CategoryIcon, getCategoryDisplayName } from '@/lib/categoryIcons'
import { Amt, Pill, Seg, inr, useIsDesk, useMask, useOverviewActions } from './ui'

type Range = 'today' | '3d' | '7d' | 'custom'
const RANGES: { id: Range; label: string }[] = [
  { id: 'today', label: 'Today' }, { id: '3d', label: '3d' }, { id: '7d', label: '7d' }, { id: 'custom', label: 'Custom' },
]
const ymd = (d: Date) => format(d, 'yyyy-MM-dd')

const dateInput: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
  background: 'var(--surface2)', color: 'var(--ink)', border: 'none', outline: 'none', minWidth: 0,
}

export default function TodayCard() {
  const transactions = useAppStore(s => s.transactions)
  const settings = useAppStore(s => s.settings)
  const desk = useIsDesk()
  const { masked } = useMask()
  const { openAdd } = useOverviewActions()

  const today = ymd(new Date())
  const [range, setRange] = useState<Range>('today')
  const [from0, setFrom0] = useState(ymd(addDays(new Date(), -6)))
  const [to0, setTo0] = useState(today)
  const [from, to] = range === 'today' ? [today, today]
    : range === '3d' ? [ymd(addDays(new Date(), -2)), today]
    : range === '7d' ? [ymd(addDays(new Date(), -6)), today]
    : from0 <= to0 ? [from0, to0] : [to0, from0]
  const days = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1

  // Gross expenses, newest first — refunds (often for older purchases) aren't netted off
  const txs = useMemo(() => transactions
    .filter(t => t.type === 'expense' && t.date >= from && t.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  , [transactions, from, to])
  const total = txs.reduce((s, t) => s + t.amount, 0)

  // This week (Mon–Sun) vs the weekly budget
  const budget = settings?.weeklyBudget ?? 0
  const weekStart = ymd(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const weekEnd = ymd(addDays(parseISO(weekStart), 6))
  const weekTotal = useMemo(() => transactions
    .filter(t => t.type === 'expense' && t.date >= weekStart && t.date <= weekEnd)
    .reduce((s, t) => s + t.amount, 0), [transactions, weekStart, weekEnd])
  const over = weekTotal - budget

  const eyebrow = range === 'today' ? 'Spent today'
    : range === 'custom' ? `Spent · ${format(parseISO(from), 'MMM d')} – ${format(parseISO(to), 'MMM d')}`
    : `Spent · last ${days} days`
  const totalStr = inr(total)
  const fs = masked ? 40 : totalStr.length > 10 ? (desk ? 34 : 32) : (desk ? 44 : 42)
  const shown = txs.slice(0, desk ? 4 : 2)
  const rangeHref = `/transactions?type=expense&from=${from}&to=${to}`

  return (
    <div className="ov-card" style={{ gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div className="ov-eyebrow">{eyebrow}</div>
        <Seg label="Spend range" value={range} options={RANGES} onChange={setRange} />
      </div>
      {range === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <input type="date" value={from0} max={today} onChange={e => e.target.value && setFrom0(e.target.value)} style={dateInput} aria-label="From" />
          <span style={{ fontSize: 12.5, color: 'var(--ink2)' }}>to</span>
          <input type="date" value={to0} max={today} onChange={e => e.target.value && setTo0(e.target.value)} style={dateInput} aria-label="To" />
        </div>
      )}

      <div>
        <Amt value={total} countUp className="ov-mono" style={{ display: 'block', fontSize: fs, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.05, whiteSpace: 'nowrap' }} />
        <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginTop: 4 }}>
          {transactions.length === 0 ? 'No transactions yet' : <>{txs.length} transaction{txs.length === 1 ? '' : 's'} · <Amt value={total / days} />/day</>}
        </div>
      </div>

      {txs.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14, borderRadius: 16, border: '1.5px dashed var(--line)' }}>
          <span style={{ fontSize: 13, color: 'var(--ink2)' }}>{range === 'today' ? 'Nothing spent yet today' : 'Nothing spent in this range'}</span>
          <button onClick={openAdd} className="ov-btn" style={{ fontSize: 13, fontWeight: 800, padding: '8px 14px', borderRadius: 999, background: 'var(--brand)', color: '#fff', whiteSpace: 'nowrap' }}>+ Add expense</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {shown.map(t => {
            const cat = getCategoryDisplayName(t.category)
            const notes = t.notes?.trim()
            const sub = [notes ? cat : '', days > 1 ? format(parseISO(t.date), 'EEE, MMM d') : ''].filter(Boolean).join(' · ') || cat
            return (
              <Link key={t.id} href={`/transactions?from=${t.date}&to=${t.date}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', color: 'inherit', textDecoration: 'none' }}>
                <div style={{ width: 34, height: 34, borderRadius: 11, background: 'var(--surface2)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                  <CategoryIcon category={t.category} size={16} color="var(--ink2)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div dir="auto" style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>{notes || cat}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink2)' }}>{sub}</div>
                </div>
                <Amt value={-t.amount} className="ov-mono" style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap' }} />
              </Link>
            )
          })}
        </div>
      )}
      {txs.length > shown.length && (
        <Link href={rangeHref} className="ov-link" style={{ marginTop: -4 }}>+{txs.length - shown.length} more{range === 'today' ? ' today' : ''} →</Link>
      )}

      <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {budget > 0 ? (
          <Link href={`/transactions?type=expense&from=${weekStart}&to=${weekEnd}`} style={{ display: 'flex', flexDirection: 'column', gap: 8, color: 'inherit', textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink2)' }}>
                This week <Amt value={weekTotal} className="ov-mono" style={{ color: 'var(--ink)', fontWeight: 600 }} /> of <Amt value={budget} className="ov-mono" />
              </div>
              {over > 0 ? <Pill t="bad"><Amt value={over} /> over</Pill> : <Pill t="good">On track</Pill>}
            </div>
            <div style={{ height: 8, borderRadius: 8, background: 'var(--surface2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, (weekTotal / budget) * 100)}%`, background: over > 0 ? 'var(--bad)' : 'var(--brand)', borderRadius: 8, transition: 'width 450ms var(--ease-out)' }} />
            </div>
          </Link>
        ) : (
          <Link href="/settings" className="ov-link" style={{ fontSize: 13 }}>Set a weekly budget in Settings →</Link>
        )}
      </div>
    </div>
  )
}
