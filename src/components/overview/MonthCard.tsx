'use client'

import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { useAppStore } from '@/store/appStore'
import { usePulse } from '@/hooks/usePulse'
import { buildMonthlySummary, computeCarryForward, getLast6Months } from '@/lib/utils'
import { buildBudgetPlan } from '@/lib/budgetPlan'
import { Amt, Ring, inr, pct, useIsDesk, useMask, useOverviewActions } from './ui'
import type { PulseHealthScore } from '@/types'

const LABEL: Record<PulseHealthScore['label'], string> = { excellent: 'Excellent', good: 'Healthy', caution: 'Watch', critical: 'At risk' }
const RING: Record<PulseHealthScore['label'], string> = { excellent: 'var(--ring-good)', good: 'var(--ring-good)', caution: 'var(--ring-warn)', critical: 'var(--ring-bad)' }

const white = (a: number) => `rgba(255,255,255,${a})`

export default function MonthCard({ isNew }: { isNew: boolean }) {
  const transactions = useAppStore(s => s.transactions)
  const settings     = useAppStore(s => s.settings)
  const budgets      = useAppStore(s => s.budgets)
  const borrowings   = useAppStore(s => s.borrowings)
  const month        = useAppStore(s => s.selectedMonth)
  const emergencyFund = useAppStore(s => s.emergencyFund)
  const pulse = usePulse()
  const desk = useIsDesk()
  const { masked, M } = useMask()
  const { openDetails, openAdd, setupEmergency } = useOverviewActions()

  const d = useMemo(() => {
    const months = getLast6Months()
    const idx = months.indexOf(month)
    const summary = buildMonthlySummary(transactions, month, settings, borrowings)
    const carry = idx > 0 ? computeCarryForward(months.slice(0, idx), transactions, settings, borrowings) : 0
    const prev = idx > 0 ? buildMonthlySummary(transactions, months[idx - 1], settings, borrowings) : null
    const plan = buildBudgetPlan(transactions, budgets, settings, month, borrowings)
    const moneyIn = summary.totalIncome + summary.totalBorrowed + summary.repaymentIn + carry
    const surplus = summary.cashNet + carry
    return {
      summary, plan, moneyIn, surplus, out: moneyIn - surplus,
      rate: moneyIn > 0 ? (surplus / moneyIn) * 100 : 0,
      prevSpent: prev?.totalExpenses ?? 0,
    }
  }, [transactions, settings, budgets, borrowings, month])

  const monthName = format(parseISO(`${month}-01`), 'MMMM')
  const { cycle } = d.plan
  const eyebrow = cycle.phase === 'future'
    ? `${monthName} · Starts ${format(parseISO(cycle.start), 'MMM d')}`
    : `${monthName} · Day ${cycle.elapsed} of ${cycle.days}`

  const header = (cta: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: white(0.62) }}>{eyebrow}</div>
      {cta}
    </div>
  )
  const shell: React.CSSProperties = {
    background: 'var(--hero)', color: '#fff', borderRadius: 24, padding: 20, boxShadow: 'var(--shadow)',
    display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, height: '100%', boxSizing: 'border-box',
  }

  // ── Brand-new user: a 3-step setup that ticks off as steps complete ──
  if (isNew) {
    const steps = [
      { t: 'Add your first transaction', d: 'Spent something today? Start there.', cta: '+ Add', done: transactions.length > 0, go: openAdd },
      { t: 'Set a monthly budget', d: 'Lets us check your pace each day', cta: 'Set', done: budgets.some(b => b.month === month && b.planned > 0), href: '/planning' },
      { t: 'Set up an emergency fund', d: 'Your safety net, tracked in months', cta: 'Set', done: !!emergencyFund, go: setupEmergency },
    ]
    const next = steps.findIndex(s => !s.done)
    return (
      <div style={shell}>
        {header(<div style={{ fontSize: 12.5, fontWeight: 700, padding: '6px 12px', borderRadius: 999, background: white(0.1) }}>{steps.filter(s => s.done).length} of 3</div>)}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div className="ov-serif" style={{ fontSize: 34, lineHeight: 1.02 }}>Let&apos;s set up your month</div>
            <div style={{ fontSize: 13.5, color: white(0.72), marginTop: 6, lineHeight: 1.45 }}>After these three steps, Growwly can tell you whether you&apos;re on track.</div>
          </div>
          {steps.map((s, i) => {
            const primary = i === next
            const ctaStyle: React.CSSProperties = {
              fontSize: 12.5, fontWeight: 800, padding: '8px 12px', borderRadius: 999, whiteSpace: 'nowrap',
              background: primary ? '#fff' : white(0.12), color: primary ? 'oklch(0.3 0.06 158)' : '#fff',
            }
            return (
              <div key={s.t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, background: white(0.07), opacity: s.done ? 0.6 : 1 }}>
                <div className="ov-mono" style={{ width: 28, height: 28, borderRadius: '50%', border: `1.5px solid ${white(0.35)}`, display: 'grid', placeItems: 'center', fontSize: 12, flex: 'none' }}>
                  {s.done ? '✓' : i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{s.t}</div>
                  <div style={{ fontSize: 12, color: white(0.62) }}>{s.d}</div>
                </div>
                {!s.done && (s.href
                  ? <a href={s.href} className="ov-btn" style={ctaStyle}>{s.cta}</a>
                  : <button onClick={s.go} className="ov-btn" style={ctaStyle}>{s.cta}</button>)}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Verdict ──
  const { health, cashPosition: cash } = pulse
  const ring = RING[health.label]
  const planned = d.plan.totals.spendPlanned
  const spent = d.summary.totalExpenses
  const live = cycle.phase === 'live'
  const pace = cycle.pace
  // How far budgeted spending runs ahead of the day of the cycle
  const ahead = planned > 0 && pace > 0 ? Math.round((spent / (planned * pace) - 1) * 100) : 0
  const short = d.surplus < 0

  const verdict = short ? `You're ${M(inr(-d.surplus))} short this cycle`
    : health.label === 'critical' ? 'This month needs attention'
    : live && ahead > 10 ? 'Spending is running ahead of plan'
    : health.label === 'caution' ? 'On track, with a few things to watch'
    : health.label === 'excellent' ? "You're in great shape"
    : "You're on track"

  let sub: string
  if (masked) sub = 'Tap the eye to reveal amounts'
  else if (!live) sub = `${inr(d.surplus, true)} ${short ? 'for' : 'surplus for'} the cycle`
  else if (short) {
    const lead = ahead > 0 ? `Spending is ${ahead}% ahead of plan. ` : ''
    sub = planned > spent && cycle.daysLeft > 0
      ? `${lead}Keep to ${inr((planned - spent) / cycle.daysLeft)}/day for ${cycle.daysLeft} days to recover.`
      : `${lead}Out is ${inr(-d.surplus)} more than in so far.`
  } else sub = `${inr(cash.freeCash)} left to spend · ${inr(cash.dailyBudget)}/day for ${cash.daysLeft} days`

  const vfs = desk ? 40 : verdict.length > 24 ? 26 : 30

  // Pace bar: spent vs plan, or vs last month without a budget
  const base = planned > 0 ? planned : d.prevSpent
  const spentPct = base > 0 ? Math.min(100, (spent / base) * 100) : 0
  const dayPct = cycle.days > 0 ? (cycle.elapsed / cycle.days) * 100 : 0

  const figures = [inr(d.moneyIn), inr(d.out), inr(d.surplus, true)]
  const stacked = !desk && !masked && Math.max(...figures.map(f => f.length)) > 9
  const mfs = desk ? 20 : Math.max(...figures.map(f => f.length)) > 11 ? 16 : 17
  const cell = (label: React.ReactNode, value: number, opts: { sign?: boolean; strong?: boolean; color?: string } = {}) => (
    <button
      onClick={() => openDetails('cash')} className="ov-btn"
      style={{ background: 'var(--hero)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, textAlign: 'left', color: '#fff' }}
    >
      <span style={{ fontSize: 11, color: white(0.6), fontWeight: 600 }}>{label}</span>
      <Amt
        value={value} sign={opts.sign} countUp className="ov-mono"
        style={{ fontSize: mfs, fontWeight: opts.strong ? 600 : 500, letterSpacing: '-0.02em', color: opts.color, whiteSpace: 'nowrap' }}
      />
    </button>
  )

  return (
    <div style={shell}>
      {header(
        <button onClick={() => openDetails()} className="ov-btn" style={{ fontSize: 12.5, fontWeight: 700, padding: '6px 12px', borderRadius: 999, background: white(0.1), color: '#fff' }}>
          Details →
        </button>,
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Ring size={76} r={32} stroke={7} pct={health.score} color={ring} track={white(0.12)}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div className="ov-mono" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1 }}>{health.score}</div>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: ring, marginTop: 3 }}>{LABEL[health.label]}</div>
            </div>
          </Ring>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="ov-serif" style={{ fontSize: vfs, lineHeight: 1.02, textWrap: 'balance' } as React.CSSProperties}>{verdict}</div>
            <div style={{ fontSize: 13, lineHeight: 1.45, color: white(0.74), marginTop: 6, textWrap: 'pretty' } as React.CSSProperties}>{sub}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: white(0.68), flexWrap: 'wrap' }}>
            <span>
              Spent <Amt value={spent} className="ov-mono" style={{ color: '#fff' }} />
              {base > 0 && <> {planned > 0 ? 'of' : 'vs'} <Amt value={base} className="ov-mono" /> {planned > 0 ? 'plan' : 'last month'}</>}
            </span>
            {cycle.phase !== 'future' && <span>Day {cycle.elapsed}/{cycle.days}</span>}
          </div>
          {base > 0 && (
            <div style={{ position: 'relative', height: 8, borderRadius: 8, background: white(0.12) }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${spentPct}%`, borderRadius: 8, background: ring, transition: 'width 600ms var(--ease-out)' }} />
              {live && <div style={{ position: 'absolute', top: -4, bottom: -4, left: `${dayPct}%`, width: 2, borderRadius: 2, background: '#fff' }} />}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: stacked ? 'minmax(0,1fr)' : 'repeat(3,minmax(0,1fr))', gap: 1, background: white(0.1), borderRadius: 16, overflow: 'hidden' }}>
          {cell('Money in', d.moneyIn)}
          {cell('Out', d.out)}
          {cell(<>Surplus · <span style={{ color: ring }}>{pct(d.rate, 1)}</span></>, d.surplus, { sign: true, strong: true, color: ring })}
        </div>
      </div>
    </div>
  )
}
