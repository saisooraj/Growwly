'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { addMonths, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'
import { useAppStore } from '@/store/appStore'
import { CATEGORY_COLORS } from '@/lib/utils'
import type { UpcomingExpense, UpcomingPayment } from '@/types'
import { Amt, inr, useMask, useOverviewActions } from './ui'

// Upcoming entries for this and next month, soonest first
export function relevantUpcoming(items: UpcomingExpense[]): UpcomingExpense[] {
  const now = new Date()
  const months = [format(now, 'yyyy-MM'), format(addMonths(now, 1), 'yyyy-MM')]
  return items.filter(i => months.includes(i.dueDate.slice(0, 7))).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

function paidMap(payments: UpcomingPayment[]) {
  const m = new Map<string, number>()
  const last = new Map<string, string>()
  for (const p of payments) {
    m.set(p.upcomingId, (m.get(p.upcomingId) ?? 0) + p.amount)
    if (p.date > (last.get(p.upcomingId) ?? '')) last.set(p.upcomingId, p.date)
  }
  return { m, last }
}

function dueText(due: string, pctPaid: number, paidOn?: string): string {
  const d = parseISO(due)
  if (pctPaid >= 100) return paidOn ? `Paid ${format(parseISO(paidOn), 'MMM d')}` : 'Paid'

  const days = differenceInCalendarDays(d, startOfDay(new Date()))
  const when = days < 0 ? `Overdue · ${format(d, 'MMM d')}`
    : days === 0 ? 'Due today'
    : days === 1 ? 'Due tomorrow'
    : days <= 6 ? `Due ${format(d, 'EEE, MMM d')}`
    : `Due ${format(d, 'MMM d')}`
  return pctPaid > 0 ? `${when} · ${Math.round(pctPaid)}% paid` : when
}

export default function UpcomingCard() {
  const upcoming = useAppStore(s => s.upcomingExpenses)
  const payments = useAppStore(s => s.upcomingPayments)
  const { M } = useMask()
  const { openPay } = useOverviewActions()

  const { all, paid, paidOn } = useMemo(() => {
    const { m, last } = paidMap(payments)
    return { all: relevantUpcoming(upcoming), paid: m, paidOn: last }
  }, [upcoming, payments])
  const left = (i: UpcomingExpense) => Math.max(0, i.amount - (paid.get(i.id) ?? 0))
  const dueOut = all.filter(i => (i.flowType ?? 'expense') === 'expense').reduce((s, i) => s + left(i), 0)
  const dueIn = all.filter(i => i.flowType === 'income').reduce((s, i) => s + left(i), 0)
  const logged = all.reduce((s, i) => s + (paid.get(i.id) ?? 0), 0)
  const net = dueIn - dueOut
  const shown = all.slice(0, 5)
  const summary = [dueOut > 0 && `↓ ${M(inr(dueOut))} due`, dueIn > 0 && `↑ ${M(inr(dueIn))} in`, logged > 0 && `${M(inr(logged))} logged`].filter(Boolean).join(' · ')

  return (
    <div className="ov-card" style={{ gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div className="ov-title">Upcoming</div>
        <div style={{ fontSize: 12, color: 'var(--ink2)' }}>This &amp; next month</div>
      </div>
      <div>
        <div className="ov-mono" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', color: net < 0 ? 'var(--bad-ink)' : 'var(--ink)' }}>
          <Amt value={net} sign />{' '}
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: 'var(--ink2)', letterSpacing: 0 }}>net</span>
        </div>
        {summary && <div className="ov-mono" style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 2 }}>{summary}</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {shown.map(item => {
          const income = item.flowType === 'income'
          const p = paid.get(item.id) ?? 0
          const pctPaid = item.amount > 0 ? Math.min(100, (p / item.amount) * 100) : 0
          const done = pctPaid >= 100
          const urgent = !done && differenceInCalendarDays(parseISO(item.dueDate), startOfDay(new Date())) <= 1
          const bar = done ? 'var(--ink3)' : income ? 'var(--good)' : (CATEGORY_COLORS[item.category ?? ''] ?? 'var(--ink3)')
          return (
            <button
              key={item.id} onClick={() => openPay(item.id)} className="ov-btn ov-row"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', opacity: done ? 0.45 : 1, background: 'none', color: 'inherit', textAlign: 'left', borderRadius: 8 }}
            >
              <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: bar, flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>{done ? '✓ ' : ''}{item.label}</div>
                <div style={{ fontSize: 12, fontWeight: urgent ? 800 : 500, color: urgent ? 'var(--bad-ink)' : 'var(--ink2)' }}>{dueText(item.dueDate, pctPaid, paidOn.get(item.id))}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flex: 'none' }}>
                <Amt value={done ? item.amount : left(item)} sign={income} className="ov-mono" style={{ fontSize: 13.5, whiteSpace: 'nowrap', color: income ? 'var(--good-ink)' : undefined }} />
                <div style={{ width: 56, height: 4, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pctPaid}%`, background: 'var(--brand)' }} />
                </div>
              </div>
            </button>
          )
        })}
      </div>
      {all.length > shown.length && <Link href="/upcoming" className="ov-link">+{all.length - shown.length} more this period →</Link>}
    </div>
  )
}
