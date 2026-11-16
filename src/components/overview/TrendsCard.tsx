'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, getLast6Months, getMonthLabel } from '@/lib/utils'
import { getCategoryDisplayName } from '@/lib/categoryIcons'
import { Amt, Pill, Seg, inr, sixMonthsTo, useIsDesk } from './ui'

const COLORS = ['var(--brand)', 'var(--info)', 'var(--warn)', 'var(--wants)', 'var(--ink3)']
const R = 54
const C = 2 * Math.PI * R

function InVsOut() {
  const transactions = useAppStore(s => s.transactions)
  const settings = useAppStore(s => s.settings)
  const borrowings = useAppStore(s => s.borrowings)
  const selected = useAppStore(s => s.selectedMonth)
  const [hover, setHover] = useState<number | null>(null)
  const data = useMemo(() => sixMonthsTo(selected).map(m => {
    const s = buildMonthlySummary(transactions, m, settings, borrowings)
    return { m: format(parseISO(`${m}-01`), 'MMM'), full: format(parseISO(`${m}-01`), 'MMMM'), i: s.totalIncome, o: s.totalExpenses }
  }), [transactions, settings, borrowings, selected])
  const max = Math.max(...data.flatMap(d => [d.i, d.o]), 1)
  const last = data[data.length - 1], prev = data[data.length - 2]
  const diff = prev && prev.o > 0 ? ((last.o - prev.o) / prev.o) * 100 : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>In vs out · 6 months</span>
        {diff !== null && <Pill t={diff <= 0 ? 'good' : 'bad'}>{diff <= 0 ? '↓' : '↑'}{Math.abs(diff).toFixed(0)}% vs {prev.m}</Pill>}
      </div>
      <div style={{ height: 120, display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 12, alignItems: 'end' }}>
        {data.map((d, k) => (
          <div key={d.m} style={{ position: 'relative', display: 'flex', gap: 3, alignItems: 'flex-end', height: '100%' }}
            onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)} onPointerDown={() => setHover(k)}>
            <div className="ov-grow" style={{ flex: 1, height: Math.max(3, Math.round((d.i / max) * 116)), borderRadius: '4px 4px 2px 2px', background: 'var(--bar)', animationDelay: `${k * 40}ms` }} />
            <div className="ov-grow" style={{ flex: 1, height: Math.max(3, Math.round((d.o / max) * 116)), borderRadius: '4px 4px 2px 2px', background: k === data.length - 1 ? 'var(--brand)' : 'var(--ink3)', animationDelay: `${k * 40 + 20}ms` }} />
            {hover === k && (
              <div style={{
                position: 'absolute', bottom: '100%', marginBottom: 6, zIndex: 3, whiteSpace: 'nowrap',
                ...(k >= 4 ? { right: 0 } : k <= 1 ? { left: 0 } : { left: '50%', transform: 'translateX(-50%)' }),
                padding: '8px 10px', borderRadius: 10, background: 'var(--surface)', boxShadow: 'var(--shadow), 0 0 0 1px var(--line)', fontSize: 11.5,
                display: 'grid', gridTemplateColumns: 'auto auto', gap: '2px 14px',
              }}>
                <div style={{ gridColumn: 'span 2', fontWeight: 700, marginBottom: 2 }}>{d.full}</div>
                <span style={{ color: 'var(--ink2)' }}>Income</span><Amt value={d.i} className="ov-mono" style={{ textAlign: 'right', color: 'var(--good-ink)', fontWeight: 600 }} />
                <span style={{ color: 'var(--ink2)' }}>Spent</span><Amt value={d.o} className="ov-mono" style={{ textAlign: 'right', fontWeight: 600 }} />
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 12, fontSize: 11, color: 'var(--ink3)', textAlign: 'center' }}>
        {data.map(d => <span key={d.m}>{d.m}</span>)}
      </div>
    </div>
  )
}

export default function TrendsCard() {
  const transactions = useAppStore(s => s.transactions)
  const settings = useAppStore(s => s.settings)
  const borrowings = useAppStore(s => s.borrowings)
  const selectedMonth = useAppStore(s => s.selectedMonth)
  const router = useRouter()
  const desk = useIsDesk()
  const [tab, setTab] = useState<'cats' | 'flow'>('cats')
  const [chartMonth, setChartMonth] = useState(selectedMonth)
  const [active, setActive] = useState<number | null>(null)
  const [otherOpen, setOtherOpen] = useState(false)
  useEffect(() => { setChartMonth(selectedMonth) }, [selectedMonth])

  const sorted = useMemo(() => {
    const by: Record<string, number> = chartMonth === 'all'
      ? transactions.filter(t => t.type === 'expense' || t.type === 'refund').reduce((a, t) => {
          a[t.category] = (a[t.category] ?? 0) + (t.type === 'refund' ? -t.amount : t.amount)
          return a
        }, {} as Record<string, number>)
      : buildMonthlySummary(transactions, chartMonth, settings, borrowings).byCategory
    return Object.entries(by).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a)
  }, [transactions, chartMonth, settings, borrowings])

  // Top 4 categories, small ones rolled into "Other (N)"
  const top = sorted.slice(0, sorted.length > 5 ? 4 : 5)
  const rest = sorted.slice(top.length)
  const total = sorted.reduce((s, [, v]) => s + v, 0)
  const cats = [
    ...top.map(([name, amt]) => ({ name, label: getCategoryDisplayName(name), amt, other: false })),
    ...(rest.length ? [{ name: 'other', label: `Other (${rest.length})`, amt: rest.reduce((s, [, v]) => s + v, 0), other: true }] : []),
  ]
  let acc = 0
  const segs = cats.map(c => {
    const len = total > 0 ? (C * c.amt) / total : 0
    const seg = { dash: `${Math.max(len - 3, 0.5).toFixed(1)} ${(C - len + 3).toFixed(1)}`, off: (-acc).toFixed(1) }
    acc += len
    return seg
  })
  const share = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0)
  const shown = active !== null ? cats[active] : null
  const totalStr = inr(total)
  const months = getLast6Months()

  const donut = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px 32px', alignItems: 'center', flex: desk ? '1.3 1 420px' : undefined, minWidth: 0 }}>
      <div style={{ position: 'relative', width: 132, height: 132, flex: 'none' }}>
        <svg width={132} height={132} viewBox="0 0 132 132" style={{ transform: 'rotate(-90deg)', display: 'block' }}>
          {total === 0 && <circle cx={66} cy={66} r={R} fill="none" stroke="var(--surface2)" strokeWidth={14} />}
          {cats.map((c, i) => (
            <circle key={c.name} cx={66} cy={66} r={R} fill="none" stroke={COLORS[i]} strokeWidth={active === i ? 17 : 14}
              strokeDasharray={segs[i].dash} strokeDashoffset={segs[i].off}
              style={{ cursor: 'pointer', transition: 'stroke-width .15s', opacity: active === null || active === i ? 1 : 0.45 }}
              onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} />
          ))}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', padding: 22, textAlign: 'center' }}>
          {shown ? (
            <>
              <div style={{ fontSize: 10.5, color: 'var(--ink2)', fontWeight: 600, lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{shown.label}</div>
              <div className="ov-mono" style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.03em' }}>{share(shown.amt)}%</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 10.5, color: 'var(--ink2)', fontWeight: 600 }}>Spent</div>
              <Amt value={total} className="ov-mono" style={{ fontSize: totalStr.length > 10 ? 13 : 17, fontWeight: 600, letterSpacing: '-0.03em' }} />
            </>
          )}
        </div>
      </div>
      <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        {cats.length === 0 && <div style={{ fontSize: 13, color: 'var(--ink2)' }}>No spending in {chartMonth === 'all' ? 'any month' : getMonthLabel(chartMonth)}</div>}
        {cats.map((c, i) => (
          <div key={c.name}>
            <button
              onClick={() => c.other ? setOtherOpen(o => !o) : router.push(`/transactions?cat=${encodeURIComponent(c.name)}`)}
              onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
              className="ov-btn ov-row"
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 13, background: 'none', color: 'inherit', textAlign: 'left', borderRadius: 6 }}
            >
              <div style={{ width: 10, height: 10, borderRadius: 3, background: COLORS[i], flex: 'none' }} />
              <span style={{ flex: 1, minWidth: 0, fontWeight: 600, lineHeight: 1.3 }}>{c.label}{c.other && <span style={{ color: 'var(--ink3)', marginLeft: 4 }}>{otherOpen ? '▴' : '▾'}</span>}</span>
              <Amt value={c.amt} className="ov-mono" style={{ whiteSpace: 'nowrap' }} />
              <span className="ov-mono" style={{ color: 'var(--ink3)', width: 34, textAlign: 'right', flex: 'none' }}>{share(c.amt)}%</span>
            </button>
            {c.other && otherOpen && rest.map(([name, amt]) => (
              <button key={name} onClick={() => router.push(`/transactions?cat=${encodeURIComponent(name)}`)} className="ov-btn ov-row"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 4px 20px', fontSize: 12, background: 'none', color: 'var(--ink2)', textAlign: 'left', borderRadius: 6 }}>
                <span style={{ flex: 1, minWidth: 0 }}>{getCategoryDisplayName(name)}</span>
                <Amt value={amt} className="ov-mono" style={{ whiteSpace: 'nowrap' }} />
                <span className="ov-mono" style={{ color: 'var(--ink3)', width: 34, textAlign: 'right', flex: 'none' }}>{share(amt)}%</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="ov-card" style={{ gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div className="ov-title" style={{ marginRight: 'auto' }}>Trends</div>
        <select
          value={chartMonth} onChange={e => setChartMonth(e.target.value)} aria-label="Month"
          style={{ fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 10, background: 'var(--surface2)', color: 'var(--ink)', border: 'none', fontFamily: 'inherit', cursor: 'pointer' }}
        >
          {months.map(m => <option key={m} value={m}>{format(parseISO(`${m}-01`), 'MMM')}</option>)}
          <option value="all">All time</option>
        </select>
      </div>
      {/* Tabs avoid stacking two charts on a phone; desktop shows both side by side */}
      {!desk && <div style={{ alignSelf: 'flex-start' }}><Seg size="md" label="Trends view" value={tab} onChange={setTab} options={[{ id: 'cats', label: 'Where it goes' }, { id: 'flow', label: 'In vs out' }]} /></div>}
      {desk ? (
        <div className="ov-trends" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px 28px', alignItems: 'center' }}>
          {donut}
          <div className="ov-trends-flow" style={{ flex: '1 1 280px', minWidth: 0 }}><InVsOut /></div>
        </div>
      ) : tab === 'cats' ? donut : <InVsOut />}
      <Link href="/planning/spending" className="ov-link">Full spending breakdown →</Link>
    </div>
  )
}
