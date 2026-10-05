'use client'

import { format, parseISO } from 'date-fns'
import type { BudgetPlan } from '@/lib/budgetPlan'
import { money } from './bucketMeta'

interface Tile {
  label: string
  value: string
  sub: string
  color?: string
}

export default function PlanKpiRow({ plan, masked }: { plan: BudgetPlan; masked: boolean }) {
  const { cycle, totals } = plan
  const hasSpendPlan = totals.spendPlanned > 0
  const hasSavePlan = totals.savePlanned > 0
  const unbudgeted = totals.spendUnbudgeted > 0 ? ` · +${money(totals.spendUnbudgeted, masked)} unbudgeted` : ''

  let left: Tile
  if (!hasSpendPlan) {
    left = { label: 'Left to spend', value: '—', sub: 'Set budgets below to see this' }
  } else if (cycle.phase === 'future') {
    left = { label: 'Left to spend', value: money(totals.left, masked), sub: `Cycle starts ${format(parseISO(cycle.start), 'MMM d')}` }
  } else if (totals.left < 0) {
    left = { label: 'Left to spend', value: money(totals.left, masked), sub: `Over plan by ${money(-totals.left, masked)}`, color: 'var(--bad-ink)' }
  } else if (cycle.phase === 'past') {
    left = { label: 'Left to spend', value: money(totals.left, masked), sub: 'Unspent when the cycle ended' }
  } else {
    left = {
      label: 'Left to spend',
      value: money(totals.left, masked),
      sub: `${money(totals.left / Math.max(1, cycle.daysLeft), masked)}/day for ${cycle.daysLeft} day${cycle.daysLeft === 1 ? '' : 's'}`,
    }
  }

  const spent: Tile = hasSpendPlan
    ? { label: 'Spent so far', value: money(totals.spendBudgeted, masked), sub: `of ${money(totals.spendPlanned, masked)} planned${unbudgeted}` }
    : { label: 'Spent so far', value: money(totals.spendUnbudgeted, masked), sub: 'Nothing budgeted yet' }

  const saved: Tile = hasSavePlan
    ? {
        label: 'Saved',
        value: money(totals.saved, masked),
        sub: totals.saved >= totals.savePlanned
          ? `Plan of ${money(totals.savePlanned, masked)} met`
          : `of ${money(totals.savePlanned, masked)} planned · ${money(totals.savePlanned - totals.saved, masked)} to go`,
        color: totals.saved >= totals.savePlanned ? 'var(--good-ink)' : undefined,
      }
    : { label: 'Saved', value: '—', sub: 'No savings plan yet' }

  let forecast: Tile
  if (!hasSpendPlan || cycle.phase === 'future') {
    forecast = { label: 'Month-end forecast', value: '—', sub: cycle.phase === 'future' ? 'Cycle hasn’t started' : 'Needs a plan to compare against' }
  } else if (totals.forecast === null) {
    forecast = { label: 'Month-end forecast', value: '—', sub: 'Shows from day 5 of the cycle' }
  } else {
    const diff = totals.spendPlanned - totals.forecast
    forecast = {
      label: cycle.phase === 'past' ? 'Cycle result' : 'Month-end forecast',
      value: `${money(Math.abs(diff), masked)} ${diff >= 0 ? 'under' : 'over'}`,
      sub: cycle.phase === 'past' ? 'against your plan' : 'at your current pace',
      color: diff >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)',
    }
  }

  return (
    <div className="gw-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
      {[left, spent, saved, forecast].map(t => (
        <div key={t.label} className="card-sm" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="h-eyebrow">{t.label}</span>
          <span className="display-num" style={{ fontSize: 'clamp(20px, 4vw, 26px)', color: t.color ?? 'var(--text)', lineHeight: 1.15 }}>
            {t.value}
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.4 }}>{t.sub}</span>
        </div>
      ))}
    </div>
  )
}
