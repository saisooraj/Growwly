'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'
import { Check, RefreshCw, X } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, computeCarryForward, getCycleMonth, getLast6Months } from '@/lib/utils'
import { getCycleRange } from '@/lib/cycle'
import { isSavingsPlan } from '@/lib/budgetPlan'
import { getCategoryDisplayName } from '@/lib/categoryIcons'
import { getDueRecurring, isRecurringSkipped } from '@/components/dashboard/RecurringPromptModal'
import { isRecapPending } from '@/components/dashboard/MonthlyRecap'
import { Pill, inr, pct, scrollToBlock, tone, useIsDesk, useMask, useOverviewActions, type Tone } from './ui'
import { computeStreak, restorableDays } from './streak'
import { spotSubscriptions } from '@/lib/subscriptions'

// Claude mode, supplied on the laptop only by a wrapper (the same shape as Smart Insights' AI mode)
export interface AttentionAi {
  on: boolean
  toggle: () => void
  loading: boolean
  alerts: { id: string; sev: 'bad' | 'warn' | 'info'; title: string; detail: string; cta: string; href: string }[] | null
  busy: boolean
  steps: string[]
  error: string | null
  stale: boolean
  meta: string | null
  generate: () => void
}

// What Claude is doing while it reads the month: earlier steps ticked, the current one spinning
function Steps({ steps }: { steps: string[] }) {
  const shown = (steps.length ? steps : ['Starting Claude']).slice(-4)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }} aria-live="polite">
      {shown.map((step, i) => {
        const current = i === shown.length - 1
        return (
          <div key={step + i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: current ? 'var(--ink)' : 'var(--ink3)', fontWeight: current ? 600 : 400 }}>
            {current
              ? <span style={{ width: 12, height: 12, border: '1.75px solid var(--brand)', borderTopColor: 'transparent', borderRadius: '50%', flex: 'none', animation: 'gw-spin .8s linear infinite' }} />
              : <Check size={12} style={{ color: 'var(--good)', flex: 'none' }} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step}{current ? '…' : ''}</span>
          </div>
        )
      })}
    </div>
  )
}

type Sev = 'bad' | 'warn' | 'info' | 'good'
interface Item {
  id: string
  sev: Sev
  icon: string
  title: string
  detail: string
  cta: string
  href?: string
  action?: () => void
}
const ORDER: Record<Sev, number> = { bad: 0, warn: 1, info: 2, good: 3 }

function useRuleItems(M: (s: string) => string): Item[] {
  const transactions = useAppStore(s => s.transactions)
  const budgets = useAppStore(s => s.budgets)
  const month = useAppStore(s => s.selectedMonth)
  const emergencyFund = useAppStore(s => s.emergencyFund)
  const settings = useAppStore(s => s.settings)
  const borrowings = useAppStore(s => s.borrowings)
  const upcoming = useAppStore(s => s.upcomingExpenses)
  const payments = useAppStore(s => s.upcomingPayments)
  const actions = useOverviewActions()

  return useMemo(() => {
    const items: Item[] = []
    const months = getLast6Months()
    const idx = months.indexOf(month)
    const prevMonth = idx > 0 ? months[idx - 1] : null
    const cur = buildMonthlySummary(transactions, month, settings, borrowings)
    const prev = prevMonth ? buildMonthlySummary(transactions, prevMonth, settings, borrowings) : null
    const carry = idx > 0 ? computeCarryForward(months.slice(0, idx), transactions, settings, borrowings) : 0
    const prevCarry = idx > 1 ? computeCarryForward(months.slice(0, idx - 1), transactions, settings, borrowings) : 0
    // Same surplus and rate as the Month card
    const moneyIn = cur.totalIncome + cur.totalBorrowed + cur.repaymentIn + carry
    const surplus = cur.cashNet + carry

    if (surplus < 0) {
      items.push({ id: 'deficit', sev: 'bad', icon: '−', title: 'Cash deficit this month', detail: `Out is ${M(inr(-surplus))} more than in`, cta: 'Review', href: '/transactions' })
    }

    for (const b of budgets.filter(b => b.month === month && !isSavingsPlan(b) && b.planned > 0)) {
      const actual = cur.byCategory[b.category as keyof typeof cur.byCategory] ?? 0
      if (actual > b.planned) {
        items.push({
          id: `over-${b.category}`, sev: 'bad', icon: '↑',
          title: `${getCategoryDisplayName(b.category)} over budget`,
          detail: `${M(inr(actual))} of ${M(inr(b.planned))} · +${Math.round(((actual - b.planned) / b.planned) * 100)}%`,
          cta: 'See', href: `/transactions?cat=${encodeURIComponent(b.category)}`,
        })
      }
    }

    if (emergencyFund && emergencyFund.targetAmount > 0) {
      const efPct = (emergencyFund.currentBalance / emergencyFund.targetAmount) * 100
      if (efPct < 30) {
        const recent = months.slice(Math.max(0, idx - 3), idx).map(m => buildMonthlySummary(transactions, m, settings, borrowings).totalExpenses).filter(v => v > 0)
        const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0
        items.push({
          id: 'ef-low', sev: 'warn', icon: '◆', title: 'Emergency fund is low',
          detail: avg > 0 ? `${(emergencyFund.currentBalance / avg).toFixed(1)} months of runway left` : `At ${Math.round(efPct)}% of target`,
          cta: 'Top up', action: () => scrollToBlock('emergency'),
        })
      }
    }

    if (moneyIn > 0) {
      const sr = (surplus / moneyIn) * 100
      const prevIn = prev ? prev.totalIncome + prev.totalBorrowed + prev.repaymentIn + prevCarry : 0
      const prevSr = prev && prevIn > 0 ? ((prev.cashNet + prevCarry) / prevIn) * 100 : null
      if (sr >= 20) {
        items.push({
          id: 'savings-good', sev: 'good', icon: '↑', title: `Strong savings rate: ${pct(sr, 1)}`,
          detail: prevSr === null ? 'Keep the momentum going' : `${sr >= prevSr ? 'Up' : 'Down'} from ${pct(prevSr, 1)} last cycle`,
          cta: 'View', action: () => scrollToBlock('savings'),
        })
      } else if (sr >= 0 && sr < 10) {
        items.push({ id: 'savings-low', sev: 'warn', icon: '!', title: `Low savings rate (${pct(sr, 1)})`, detail: 'Aim for at least 20% of income', cta: 'Plan', href: '/planning' })
      }
    }

    if (prev && prevMonth && prev.totalExpenses > 0) {
      const range = getCycleRange(month, settings)
      const today = format(new Date(), 'yyyy-MM-dd')
      const end = today < range.end ? today : range.end
      const elapsed = Math.max(1, differenceInCalendarDays(parseISO(end), parseISO(range.start)) + 1)
      const pr = getCycleRange(prevMonth, settings)
      const prevDays = Math.max(1, differenceInCalendarDays(parseISO(pr.end), parseISO(pr.start)) + 1)
      const dCur = cur.totalExpenses / elapsed
      const dPrev = prev.totalExpenses / prevDays
      const change = dPrev > 0 ? ((dCur - dPrev) / dPrev) * 100 : 0
      const detail = `${M(inr(dCur))}/day now vs ${M(inr(dPrev))}/day last cycle`
      if (change > 15) items.push({ id: 'mom-spike', sev: 'warn', icon: '↑', title: `Daily spend up ${change.toFixed(0)}% vs last cycle`, detail, cta: 'Review', href: '/transactions' })
      else if (change < -10) items.push({ id: 'mom-drop', sev: 'good', icon: '↓', title: `Daily spend down ${Math.abs(change).toFixed(0)}% vs last cycle`, detail, cta: 'Review', href: '/transactions' })
    }

    // Bills due within 2 days (and overdue ones)
    const paid = new Map<string, number>()
    for (const p of payments) paid.set(p.upcomingId, (paid.get(p.upcomingId) ?? 0) + p.amount)
    const today0 = startOfDay(new Date())
    for (const u of upcoming) {
      if ((u.flowType ?? 'expense') !== 'expense') continue
      const left = u.amount - (paid.get(u.id) ?? 0)
      if (left <= 0) continue
      const days = differenceInCalendarDays(parseISO(u.dueDate), today0)
      // A free trial gets a 3-day heads-up, worded around the trial rather than a bill
      if (u.isTrial && u.isSubscription) {
        if (days > 3) continue
        const ended = days < 0
        items.push({
          id: `trial-${u.id}`, sev: days <= 1 ? 'bad' : 'warn', icon: '!',
          title: ended ? `${u.label} trial ended` : `${u.label} trial ends ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}`,
          detail: ended ? `${M(inr(left))} is charged from ${format(parseISO(u.dueDate), 'MMM d')} · keep or cancel` : `Then ${M(inr(left))} is charged · cancel before ${format(parseISO(u.dueDate), 'EEE, MMM d')} if you don’t want it`,
          cta: 'Review', href: `/upcoming?tab=subscriptions&sub=${u.id}`,
        })
        continue
      }
      if (days > 2) continue
      const when = days < 0 ? 'is overdue' : days === 0 ? 'due today' : days === 1 ? 'due tomorrow' : 'due in 2 days'
      items.push({
        id: `due-${u.id}`, sev: days <= 1 ? 'bad' : 'warn', icon: '!',
        title: `${u.label} ${when}`, detail: `${M(inr(left))} · ${format(parseISO(u.dueDate), 'EEE, MMM d')}`,
        cta: 'Pay', action: () => actions.openPay(u.id),
      })
    }

    // Subscriptions found in recent spending that aren't tracked yet
    const spotted = spotSubscriptions(transactions, upcoming, settings?.dismissedSubscriptions, format(today0, 'yyyy-MM-dd'))
    if (spotted.length > 0) {
      const one = spotted[0]
      items.push({
        id: 'subs-spotted', sev: 'info', icon: '↻',
        title: spotted.length === 1 ? `New subscription spotted: ${one.label}` : `${spotted.length} new subscriptions spotted`,
        detail: spotted.length === 1
          ? `${M(inr(one.amount))} on ${format(parseISO(one.lastDate), 'MMM d')} · track its renewals`
          : `${spotted.slice(0, 3).map(s => s.label).join(', ')}${spotted.length > 3 ? ` and ${spotted.length - 3} more` : ''}`,
        cta: 'Review', href: '/upcoming?tab=subscriptions',
      })
    }

    const due = isRecurringSkipped() ? [] : getDueRecurring(transactions)
    if (due.length > 0) {
      const names = due.map(t => t.notes?.trim() || getCategoryDisplayName(t.category))
      items.push({
        id: 'recurring', sev: 'info', icon: '↻',
        title: `${due.length} recurring item${due.length === 1 ? '' : 's'} to log`,
        detail: names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', '),
        cta: due.length === 1 ? 'Log it' : 'Log all', action: actions.openRecurring,
      })
    }

    const noSpend = new Set(settings?.noSpendDays ?? [])
    const gap = restorableDays(transactions, noSpend, computeStreak(transactions, noSpend))
    if (gap.length > 0 && gap.length <= 3) {
      items.push({
        id: 'streak', sev: 'info', icon: '↺', title: 'Restore your streak',
        detail: `${gap.length} empty day${gap.length === 1 ? '' : 's'} broke it`, cta: 'Restore', action: actions.restoreStreak,
      })
    }

    // Last cycle's recap, offered on the first 3 days of a cycle
    const cycleNow = getCycleMonth(settings)
    const r = getCycleRange(cycleNow, settings)
    const day = differenceInCalendarDays(today0, parseISO(r.start)) + 1
    if (day >= 1 && day <= 3 && isRecapPending(transactions, settings, borrowings)) {
      const prevName = format(parseISO(`${months[months.indexOf(cycleNow) - 1] ?? cycleNow}-01`), 'MMMM')
      items.push({ id: 'recap', sev: 'info', icon: '★', title: `Your ${prevName} recap is ready`, detail: 'Spent, saved and your biggest category', cta: 'Open', action: actions.openRecap })
    }

    return items.sort((a, b) => ORDER[a.sev] - ORDER[b.sev])
  }, [transactions, budgets, month, emergencyFund, settings, borrowings, upcoming, payments, actions, M]) // actions.tick re-reads skip/seen flags
}

function Row({ a, first, onAct }: { a: Item; first: boolean; onAct?: () => void }) {
  const t = tone(a.sev === 'good' ? 'good' : (a.sev as Tone))
  const chip: React.CSSProperties = { fontSize: 12.5, fontWeight: 800, padding: '7px 11px', borderRadius: 999, whiteSpace: 'nowrap', ...t }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: `1px solid ${first ? 'transparent' : 'var(--line)'}` }}>
      <div style={{ width: 36, height: 36, borderRadius: 12, ...t, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 15, flex: 'none' }}>{a.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{a.title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.35 }}>{a.detail}</div>
      </div>
      {a.cta && (a.action
        ? <button onClick={() => { onAct?.(); a.action?.() }} className="ov-btn" style={chip}>{a.cta}</button>
        : a.href ? <Link href={a.href} className="ov-btn" style={chip}>{a.cta}</Link> : null)}
    </div>
  )
}

function AllSheet({ items, onClose }: { items: Item[]; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div
        onClick={e => e.stopPropagation()} className="ov pulse-sheet-enter"
        style={{ width: '100%', maxWidth: 560, maxHeight: '85dvh', overflowY: 'auto', background: 'var(--surface)', borderRadius: '24px 24px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <div className="ov-title" style={{ flex: 1 }}>Needs attention</div>
          <button onClick={onClose} aria-label="Close" className="ov-btn" style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--surface2)', color: 'var(--ink2)', display: 'grid', placeItems: 'center' }}><X size={15} /></button>
        </div>
        {/* Close first: this sheet sits above the popups its buttons open */}
        {items.map((a, i) => <Row key={a.id} a={a} first={i === 0} onAct={onClose} />)}
      </div>
    </div>,
    document.body,
  )
}

export default function AttentionCard({ ai }: { ai?: AttentionAi }) {
  const desk = useIsDesk()
  const { M } = useMask()
  const rules = useRuleItems(M)
  const [all, setAll] = useState(false)
  const aiMode = !!ai?.on

  const aiItems: Item[] = (ai?.alerts ?? []).map(a => ({
    id: a.id, sev: a.sev === 'info' ? 'good' : a.sev, icon: a.sev === 'info' ? '↑' : '!',
    title: a.title, detail: a.detail, cta: a.href ? a.cta : '', href: a.href,
  }))
  const items = aiMode ? aiItems.sort((a, b) => ORDER[a.sev] - ORDER[b.sev]) : rules
  const aiPanel = aiMode && (ai!.loading || ai!.busy || ai!.alerts === null)
  const shown = items.slice(0, desk ? 4 : 2)
  const urgent = items.filter(i => i.sev === 'bad').length
  const watch = items.filter(i => i.sev === 'warn').length

  function askClaude() {
    if (!ai) return
    if (!ai.on) ai.toggle()
    if (ai.alerts === null && !ai.loading && !ai.busy) ai.generate()
  }

  return (
    <div className="ov-card" style={{ gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div className="ov-title" style={{ marginRight: 'auto' }}>Needs attention</div>
        {!aiPanel && urgent > 0 && <Pill t="bad" style={{ fontWeight: 700, padding: '4px 9px' }}>{urgent} urgent</Pill>}
        {!aiPanel && watch > 0 && <Pill t="warn" style={{ fontWeight: 700, padding: '4px 9px' }}>{watch} watch</Pill>}
        {aiMode && ai!.alerts && !ai!.busy && (
          <button onClick={ai!.generate} aria-label="Refresh Claude's insights" title={ai!.stale ? 'Your data changed since — refresh' : 'Refresh'} className="ov-btn" style={{ width: 26, height: 26, borderRadius: 8, background: 'transparent', color: ai!.stale ? 'var(--warn-ink)' : 'var(--ink2)', display: 'grid', placeItems: 'center' }}>
            <RefreshCw size={13} />
          </button>
        )}
        {ai && desk && (
          <div role="tablist" aria-label="Insight source" style={{ display: 'flex', padding: 3, borderRadius: 10, background: 'var(--surface2)', fontSize: 12, fontWeight: 700 }}>
            {([['rules', 'Rules'], ['claude', '✦ Claude']] as const).map(([id, label]) => {
              const on = (id === 'claude') === aiMode
              return (
                <button key={id} role="tab" aria-selected={on} onClick={() => { if (!on) ai.toggle() }} className="ov-btn"
                  style={{ padding: '4px 10px', borderRadius: 8, fontSize: 'inherit', fontWeight: 'inherit', background: on ? 'var(--surface)' : 'transparent', boxShadow: on ? 'var(--shadow)' : 'none', color: on ? 'var(--ink)' : 'var(--ink2)' }}>
                  {label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {aiPanel ? (
        <div style={{ padding: 14, borderRadius: 16, background: 'var(--surface2)' }}>
          {ai!.busy ? <Steps steps={ai!.steps} />
            : ai!.loading ? <div style={{ fontSize: 13, color: 'var(--ink2)' }}>Loading Claude&apos;s insights…</div>
            : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Let Claude read your month</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginTop: 3, lineHeight: 1.45 }}>Up to six things worth knowing: budgets at risk, bills before payday, unusual spends and wins.</div>
                </div>
                <button onClick={ai!.generate} className="ov-btn" style={{ fontSize: 12.5, fontWeight: 800, padding: '8px 12px', borderRadius: 999, background: 'var(--ink)', color: 'var(--bg)', whiteSpace: 'nowrap' }}>Get insights</button>
              </div>
            )}
        </div>
      ) : items.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, ...tone('good'), display: 'grid', placeItems: 'center', fontWeight: 800 }}>✓</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>All clear</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink2)' }}>No issues detected this month</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {shown.map((a, i) => <Row key={a.id} a={a} first={i === 0} />)}
        </div>
      )}

      {!aiPanel && items.length > shown.length && (
        <button onClick={() => setAll(true)} className="ov-link" style={{ fontSize: 13 }}>+{items.length - shown.length} more →</button>
      )}

      {aiMode && (ai!.error || (ai!.meta && !aiPanel)) && (
        <div style={{ fontSize: 11.5, lineHeight: 1.45, color: ai!.error ? 'var(--bad-ink)' : 'var(--ink3)' }}>
          {ai!.error ?? <>Claude · {ai!.meta}{ai!.stale && <span style={{ color: 'var(--warn-ink)' }}> · your data changed since</span>}</>}
        </div>
      )}

      {ai && desk && !aiMode && (
        <button onClick={askClaude} className="ov-btn" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, background: 'var(--surface2)', fontSize: 12.5, color: 'var(--ink2)', textAlign: 'left' }}>
          <span style={{ color: 'var(--wants)', fontWeight: 800 }}>✦</span>
          <span style={{ flex: 1 }}>Let Claude read your month</span>
          <span style={{ fontWeight: 800, color: 'var(--ink)' }}>Get insights</span>
        </button>
      )}

      {all && <AllSheet items={items} onClose={() => setAll(false)} />}
    </div>
  )
}
