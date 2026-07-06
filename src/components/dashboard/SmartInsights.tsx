'use client'

import { useMemo, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, formatCurrency, getLast6Months } from '@/lib/utils'
import Link from 'next/link'
import {
  Sparkles, ArrowDownRight, Zap, TrendingDown, TrendingUp,
  ShieldCheck, ChevronLeft, ChevronRight,
} from 'lucide-react'

interface Alert {
  id: string
  sev: 'bad' | 'warn' | 'info'
  title: string
  detail: string
  cta: string
  href: string
}

export default function SmartInsights() {
  const { transactions, budgets, selectedMonth, emergencyFund, settings, borrowings } = useAppStore()
  const [idx, setIdx] = useState(0)

  const alerts: Alert[] = useMemo(() => {
    const months = getLast6Months()
    const curIdx = months.indexOf(selectedMonth)
    const prevMonth = curIdx > 0 ? months[curIdx - 1] : null
    const cur  = buildMonthlySummary(transactions, selectedMonth, settings, borrowings)
    const prev = prevMonth ? buildMonthlySummary(transactions, prevMonth, settings, borrowings) : null
    const result: Alert[] = []

    if (cur.net < 0) {
      result.push({
        id: 'deficit', sev: 'bad',
        title: 'Cash deficit this month',
        detail: `Spending exceeds income by ${formatCurrency(Math.abs(cur.net))}`,
        cta: 'Review', href: '/transactions',
      })
    }

    for (const b of budgets.filter(b => b.month === selectedMonth)) {
      const actual = cur.byCategory[b.category as keyof typeof cur.byCategory] ?? 0
      if (actual > b.planned && b.planned > 0) {
        result.push({
          id: `over-${b.category}`, sev: 'warn',
          title: `${b.category} over budget`,
          detail: `Exceeded plan by ${formatCurrency(actual - b.planned)}`,
          cta: 'Budget', href: '/planning',
        })
      }
    }

    if (emergencyFund) {
      const pct = (emergencyFund.currentBalance / emergencyFund.targetAmount) * 100
      if (pct < 30) {
        result.push({
          id: 'ef-low', sev: 'bad',
          title: 'Emergency fund is low',
          detail: `At ${pct.toFixed(0)}% — consider rebuilding`,
          cta: 'Top up', href: '/planning',
        })
      }
    }

    if (cur.totalIncome > 0) {
      const sr = (cur.net / cur.totalIncome) * 100
      const prevSr = prev && prev.totalIncome > 0 ? (prev.net / prev.totalIncome) * 100 : null
      if (sr >= 20) {
        result.push({
          id: 'savings-good', sev: 'info',
          title: `Strong savings rate — ${sr.toFixed(1)}%`,
          detail: prevSr !== null
            ? `${sr > prevSr ? '+' : ''}${(sr - prevSr).toFixed(1)}% vs last month`
            : 'Keep the momentum going',
          cta: 'Goals', href: '/goals',
        })
      } else if (sr < 10 && sr >= 0) {
        result.push({
          id: 'savings-low', sev: 'warn',
          title: `Low savings rate (${sr.toFixed(1)}%)`,
          detail: 'Aim for at least 20% of income',
          cta: 'Plan', href: '/planning',
        })
      }
    }

    if (prev && prev.totalExpenses > 0) {
      const diff = cur.totalExpenses - prev.totalExpenses
      const pct = (diff / prev.totalExpenses) * 100
      if (pct > 15) {
        result.push({
          id: 'mom-spike', sev: 'warn',
          title: `Spending up ${pct.toFixed(0)}% vs last month`,
          detail: `${formatCurrency(diff)} more than previous month`,
          cta: 'Txns', href: '/transactions',
        })
      } else if (pct < -10) {
        result.push({
          id: 'mom-drop', sev: 'info',
          title: `Spending down ${Math.abs(pct).toFixed(0)}% vs last month`,
          detail: `Saved ${formatCurrency(Math.abs(diff))} vs last month`,
          cta: 'Review', href: '/transactions',
        })
      }
    }

    return result
  }, [transactions, budgets, selectedMonth, emergencyFund, settings, borrowings])

  // Clamp index when alerts change
  const safeIdx   = alerts.length > 0 ? Math.min(idx, alerts.length - 1) : 0
  const alert     = alerts[safeIdx]
  const urgentCnt = alerts.filter(a => a.sev === 'bad').length
  const warnCnt   = alerts.filter(a => a.sev === 'warn').length

  function prev() { setIdx(i => (i - 1 + alerts.length) % alerts.length) }
  function next() { setIdx(i => (i + 1) % alerts.length) }

  const accent =
    !alert         ? 'var(--good)' :
    alert.sev === 'bad'  ? 'var(--bad)'  :
    alert.sev === 'warn' ? 'var(--warn)' :
    'var(--brand)'

  const accentSoft =
    !alert         ? 'var(--good-soft)' :
    alert.sev === 'bad'  ? 'var(--bad-soft)'  :
    alert.sev === 'warn' ? 'var(--warn-soft)' :
    'var(--brand-soft)'

  const accentInk =
    !alert         ? 'var(--good-ink)' :
    alert.sev === 'bad'  ? 'var(--bad-ink)'  :
    alert.sev === 'warn' ? 'var(--warn-ink)' :
    'var(--brand-ink)'

  const Icon =
    !alert         ? ShieldCheck :
    alert.sev === 'bad'  ? ArrowDownRight :
    alert.sev === 'warn' ? Zap :
    TrendingUp

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: 'var(--brand-soft)', color: 'var(--brand-ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={14} />
        </div>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
          Smart Insights
        </span>

        {/* Count pills */}
        {urgentCnt > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
            background: 'var(--bad-soft)', color: 'var(--bad-ink)',
          }}>
            {urgentCnt} urgent
          </span>
        )}
        {warnCnt > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
            background: 'var(--warn-soft)', color: 'var(--warn-ink)',
          }}>
            {warnCnt} watch
          </span>
        )}
      </div>

      {/* ── Main insight card ── */}
      {alerts.length === 0 ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 16px', borderRadius: 14,
          background: 'var(--good-soft)', border: '1px solid color-mix(in oklch, var(--good) 20%, transparent)',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: 'var(--good)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--good-ink)' }}>All clear</div>
            <div style={{ fontSize: 12.5, color: 'var(--good-ink)', opacity: 0.75, marginTop: 2 }}>
              No issues detected this month — great work!
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex', gap: 14, alignItems: 'flex-start',
          padding: '14px 16px', borderRadius: 14,
          background: accentSoft,
          border: `1px solid color-mix(in oklch, ${accent} 22%, transparent)`,
          minHeight: 88,
        }}>
          {/* Icon */}
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: accent, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: 2,
          }}>
            <Icon size={20} />
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: accentInk, lineHeight: 1.3 }}>
              {alert.title}
            </div>
            <div style={{ fontSize: 13, color: accentInk, opacity: 0.75, marginTop: 4, lineHeight: 1.45 }}>
              {alert.detail}
            </div>
          </div>

          {/* CTA */}
          <Link
            href={alert.href}
            style={{
              flexShrink: 0, padding: '6px 12px', borderRadius: 9,
              background: accent, color: '#fff',
              fontSize: 12.5, fontWeight: 700, textDecoration: 'none',
              whiteSpace: 'nowrap', alignSelf: 'flex-start',
            }}
          >
            {alert.cta} →
          </Link>
        </div>
      )}

      {/* ── Footer: dots + nav ── */}
      {alerts.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Dot indicators */}
          <div style={{ display: 'flex', gap: 5, flex: 1 }}>
            {alerts.map((a, i) => {
              const dotColor =
                a.sev === 'bad'  ? 'var(--bad)'  :
                a.sev === 'warn' ? 'var(--warn)' :
                'var(--brand)'
              return (
                <button
                  key={a.id}
                  onClick={() => setIdx(i)}
                  style={{
                    width: i === safeIdx ? 18 : 6, height: 6,
                    borderRadius: 999, border: 'none', cursor: 'pointer',
                    padding: 0,
                    background: i === safeIdx ? dotColor : 'var(--surface-3)',
                    transition: 'width .25s cubic-bezier(.22,1,.36,1), background .2s',
                  }}
                />
              )
            })}
          </div>

          {/* Prev / Next */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={prev}
              style={{
                width: 30, height: 30, borderRadius: 9, border: '1px solid var(--border)',
                background: 'var(--surface-2)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-3)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={next}
              style={{
                padding: '0 12px', height: 30, borderRadius: 9,
                border: '1px solid var(--border)',
                background: 'var(--surface-2)', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, color: 'var(--text-2)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
