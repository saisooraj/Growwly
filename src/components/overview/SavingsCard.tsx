'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { useAppStore } from '@/store/appStore'
import {
  buildMonthlySummary, getTransactionsForMonth, isSavingsTransfer, getTransferDisplay, EMERGENCY_FUND_VEHICLE,
} from '@/lib/utils'
import { Amt, inr, pct, sixMonthsTo, useMask } from './ui'

const ROW_COLORS = ['var(--brand)', 'var(--wants)', 'var(--warn)', 'var(--info)']

// Monthly net saved for the last 6 cycles (also decides whether the card shows at all)
export function useSavingsHistory() {
  const transactions = useAppStore(s => s.transactions)
  const settings = useAppStore(s => s.settings)
  const borrowings = useAppStore(s => s.borrowings)
  const selected = useAppStore(s => s.selectedMonth)
  return useMemo(() => sixMonthsTo(selected).map(m => {
    const s = buildMonthlySummary(transactions, m, settings, borrowings)
    return { month: m, saved: s.savingsContributed - s.savingsWithdrawn, contributed: s.savingsContributed, withdrawn: s.savingsWithdrawn, income: s.totalIncome }
  }), [transactions, settings, borrowings, selected])
}

export default function SavingsCard() {
  const transactions = useAppStore(s => s.transactions)
  const settings = useAppStore(s => s.settings)
  const borrowings = useAppStore(s => s.borrowings)
  const month = useAppStore(s => s.selectedMonth)
  const { masked, M } = useMask()
  const hist = useSavingsHistory()
  const [hover, setHover] = useState<number | null>(null)

  const summary = useMemo(() => buildMonthlySummary(transactions, month, settings, borrowings), [transactions, month, settings, borrowings])
  const net = summary.savingsContributed - summary.savingsWithdrawn
  const spentPct = summary.totalIncome > 0 ? Math.min(98, (summary.totalExpenses / summary.totalIncome) * 100) : 98

  const rows = useMemo(() => {
    const by: Record<string, { i: number; o: number }> = {}
    for (const t of getTransactionsForMonth(transactions, month, settings)) {
      if (!isSavingsTransfer(t)) continue
      const { label, dir } = getTransferDisplay(t)
      const r = by[label] ?? (by[label] = { i: 0, o: 0 })
      if (dir === 'out') r.i += t.amount
      else r.o += t.amount
    }
    return Object.entries(by)
      .map(([name, v]) => ({ name, i: v.i, o: v.o, net: v.i - v.o }))
      .filter(r => r.i > 0 || r.o > 0)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
  }, [transactions, month, settings])
  const maxRow = Math.max(...rows.map(r => Math.abs(r.net)), 1)

  // Chart geometry, as in the design: bars up to 66 px, running-total line across a 600×120 box
  const hMax = Math.max(...hist.map(h => Math.abs(h.saved)), 1)
  let run = 0
  const cums = hist.map(h => (run += h.saved))
  const cMax = Math.max(...cums, 1)
  const line = cums.map((c, i) => `${(((i + 0.5) / 6) * 588 + 6).toFixed(1)},${(116 - (Math.max(c, 0) / cMax) * 108).toFixed(1)}`).join(' ')
  const totalSaved = run
  const totalIncome = hist.reduce((s, h) => s + h.income, 0)
  const avgRate = totalIncome > 0 ? (totalSaved / totalIncome) * 100 : 0
  const best = hist.reduce((b, h, i) => (h.saved > hist[b].saved ? i : b), 0)
  const label = (m: string) => format(parseISO(`${m}-01`), 'MMM')
  const last = hist.length - 1

  const eyebrow = (t: string, extra?: React.CSSProperties) => <div className="ov-eyebrow" style={extra}>{t}</div>

  return (
    <div className="ov-card" style={{ gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div className="ov-title" style={{ marginRight: 'auto' }}>Savings</div>
        <div className="ov-mono" style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: 'var(--good-soft)', color: 'var(--good-ink)', whiteSpace: 'nowrap' }}>
          {M(inr(totalSaved, true))} total
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px 32px' }}>
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          {eyebrow('This cycle')}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <Amt value={net} sign countUp className="ov-mono" style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', color: net < 0 ? 'var(--bad)' : 'var(--brand)', whiteSpace: 'nowrap' }} />
            <div style={{ fontSize: 12.5, color: 'var(--ink2)' }}>of <Amt value={summary.totalIncome} className="ov-mono" /> earned</div>
          </div>
          <div style={{ display: 'flex', height: 8, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
            <div style={{ width: `${spentPct}%`, background: 'var(--surface2)' }} />
            <div style={{ flex: 1, background: net < 0 ? 'var(--bad)' : 'var(--brand)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink2)' }}><span>Spent</span><span>Saved</span></div>

          {eyebrow('Last 6 months', { marginTop: 8 })}
          <div style={{ position: 'relative', height: 120, borderBottom: '1px solid var(--line)' }}>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 14, alignItems: 'end', padding: '0 6px' }}>
              {hist.map((h, i) => (
                <div key={h.month} style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'flex-end' }}
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onPointerDown={() => setHover(i)}>
                  <div className="ov-grow" style={{
                    width: '100%', height: Math.max(4, Math.round((Math.abs(h.saved) / hMax) * 66)), borderRadius: '6px 6px 2px 2px',
                    background: h.saved < 0 ? 'var(--bad)' : i === last ? 'var(--brand)' : 'var(--bar)', animationDelay: `${i * 40}ms`,
                  }} />
                  {hover === i && (
                    <div style={{
                      position: 'absolute', bottom: '100%', zIndex: 3, marginBottom: 4, whiteSpace: 'nowrap',
                      ...(i >= 4 ? { right: 0 } : i <= 1 ? { left: 0 } : { left: '50%', transform: 'translateX(-50%)' }),
                      padding: '8px 10px', borderRadius: 10, background: 'var(--surface)', boxShadow: 'var(--shadow), 0 0 0 1px var(--line)', fontSize: 11.5, display: 'grid', gridTemplateColumns: 'auto auto', gap: '2px 14px',
                    }}>
                      <div style={{ gridColumn: 'span 2', fontWeight: 700, marginBottom: 2 }}>{format(parseISO(`${h.month}-01`), 'MMMM')}</div>
                      <span style={{ color: 'var(--ink2)' }}>Contributed</span><Amt value={h.contributed} className="ov-mono" style={{ textAlign: 'right' }} />
                      {h.withdrawn > 0 && <><span style={{ color: 'var(--ink2)' }}>Withdrawn</span><Amt value={h.withdrawn} className="ov-mono" style={{ textAlign: 'right' }} /></>}
                      <span style={{ color: 'var(--ink2)' }}>Net</span><Amt value={h.saved} sign className="ov-mono" style={{ textAlign: 'right', fontWeight: 700, color: h.saved < 0 ? 'var(--bad-ink)' : 'var(--good-ink)' }} />
                      <span style={{ color: 'var(--ink2)' }}>Running total</span><Amt value={cums[i]} className="ov-mono" style={{ textAlign: 'right' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <svg viewBox="0 0 600 120" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
              <polyline points={line} fill="none" stroke="var(--ink2)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 14, padding: '0 6px', fontSize: 11, color: 'var(--ink3)', textAlign: 'center' }}>
            {hist.map((h, i) => <span key={h.month} style={{ fontWeight: i === last ? 800 : 500, color: i === last ? 'var(--ink)' : 'var(--ink3)' }}>{label(h.month)}</span>)}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 11.5, color: 'var(--ink2)', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--brand)' }} />Saved that month</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 2, background: 'var(--ink2)' }} />Running total</span>
          </div>
        </div>

        <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          {eyebrow('Where it went')}
          {rows.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.45 }}>
              Nothing moved into savings this cycle. <Link href="/goals" className="ov-link">Pick a goal →</Link>
            </div>
          ) : rows.map((r, i) => {
            const color = r.net < 0 ? 'var(--bad)' : r.name === EMERGENCY_FUND_VEHICLE ? 'var(--info)' : ROW_COLORS[i % ROW_COLORS.length]
            return (
              <Link key={r.name} href="/networth" style={{ display: 'flex', flexDirection: 'column', gap: 5, color: 'inherit', textDecoration: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, minWidth: 0 }}>{r.name}</span>
                  <Amt value={r.net} sign className="ov-mono" style={{ whiteSpace: 'nowrap' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 4, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round((Math.abs(r.net) / maxRow) * 100)}%`, background: color }} />
                  </div>
                  <span className="ov-mono" style={{ fontSize: 10.5, color: 'var(--ink3)', whiteSpace: 'nowrap' }}>
                    {masked ? 'in •• · out ••' : `in ${inr(r.i)}${r.o ? ` · out ${inr(r.o)}` : ''}`}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 12, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
        {[
          { l: 'Total saved', v: <Amt value={totalSaved} /> },
          { l: 'Avg rate', v: pct(avgRate, 1) },
          { l: 'Best month', v: <>{label(hist[best].month)}{!masked && ` · ${inr(hist[best].saved)}`}</> },
        ].map(s => (
          <div key={s.l} style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 11.5, color: 'var(--ink2)' }}>{s.l}</span>
            <span className="ov-mono" style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{s.v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
