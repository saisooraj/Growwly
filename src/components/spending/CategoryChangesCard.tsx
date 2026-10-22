'use client'

import { memo, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { formatCurrency, getMonthLabel } from '@/lib/utils'
import { CategoryIcon, getCategoryDisplayName } from '@/lib/categoryIcons'
import type { CategoryChange } from '@/lib/spendingAnalytics'

const MASK = '₹ ••••'
const PER_SIDE = 5
// Changes smaller than this are noise (a refund of a few rupees) — left out.
const MIN_DELTA = 1

type Basis = 'pace' | 'full'
type Kind = 'up' | 'new' | 'down' | 'stopped'

interface Props {
  rows: CategoryChange[]   // already filtered by the checklist
  live: boolean
  elapsedDays: number
  prevMonth: string
  month: string
  masked: boolean
  onCategoryClick: (category: string) => void
}

interface Change {
  category: string
  current: number
  prev: number
  delta: number
  kind: Kind
}

const money = (v: number) => formatCurrency(Math.abs(Math.round(v)))

function CategoryChangesCard({ rows, live, elapsedDays, prevMonth, month, masked, onCategoryClick }: Props) {
  // Like-for-like by default while the cycle is running; a finished cycle only has "full".
  const [basis, setBasis] = useState<Basis>('pace')
  const [expanded, setExpanded] = useState(false)
  const useBasis: Basis = live ? basis : 'full'

  const { ups, downs, upTotal, downTotal, newCount, newTotal, stoppedCount, maxAbs } = useMemo(() => {
    const changes: Change[] = []
    for (const r of rows) {
      const prev = Math.max(0, useBasis === 'pace' ? r.prevToDate : r.prevFull)
      const current = Math.max(0, r.current)
      const delta = current - prev
      if (Math.abs(delta) < MIN_DELTA) continue
      const kind: Kind = prev === 0 ? 'new' : current === 0 ? 'stopped' : delta > 0 ? 'up' : 'down'
      changes.push({ category: r.category, current, prev, delta, kind })
    }
    const ups = changes.filter(c => c.delta > 0).sort((a, b) => b.delta - a.delta)
    const downs = changes.filter(c => c.delta < 0).sort((a, b) => a.delta - b.delta)
    return {
      ups,
      downs,
      upTotal: ups.reduce((s, c) => s + c.delta, 0),
      downTotal: downs.reduce((s, c) => s + c.delta, 0),
      newCount: ups.filter(c => c.kind === 'new').length,
      newTotal: ups.filter(c => c.kind === 'new').reduce((s, c) => s + c.delta, 0),
      stoppedCount: downs.filter(c => c.kind === 'stopped').length,
      maxAbs: Math.max(1, ...changes.map(c => Math.abs(c.delta))),
    }
  }, [rows, useBasis])

  const net = upTotal + downTotal
  const hiddenCount = Math.max(0, ups.length - PER_SIDE) + Math.max(0, downs.length - PER_SIDE)
  const shownUps = expanded ? ups : ups.slice(0, PER_SIDE)
  const shownDowns = expanded ? downs : downs.slice(0, PER_SIDE)

  const prevLabel = getMonthLabel(prevMonth).split(' ')[0]
  const curLabel = getMonthLabel(month).split(' ')[0]
  const subtitle = useBasis === 'pace'
    ? `First ${elapsedDays} day${elapsedDays === 1 ? '' : 's'} of ${curLabel} vs the same ${elapsedDays} of ${prevLabel}`
    : `${curLabel}${live ? ' so far' : ''} vs all of ${prevLabel}`

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', margin: 0 }}>What changed</h3>
          <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 3 }}>{subtitle}</div>
        </div>
        {live && (
          <div style={{ display: 'flex', gap: 4 }}>
            {([['pace', 'Same point'], ['full', 'Full month']] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setBasis(id)}
                className="pressable"
                style={{
                  padding: '4px 11px', borderRadius: 999, flexShrink: 0,
                  fontSize: 11.5, fontWeight: 600, border: 'none',
                  background: basis === id ? 'var(--text)' : 'var(--surface-2)',
                  color: basis === id ? 'var(--bg)' : 'var(--text-2)',
                  cursor: 'pointer', transition: 'background .15s, color .15s',
                  fontFamily: 'inherit',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {ups.length === 0 && downs.length === 0 ? (
        <p style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '28px 0 16px', margin: 0 }}>
          No category changed against {prevLabel}
        </p>
      ) : (
        <>
          <div className="changes-summary">
            <SummaryTile
              icon={<ArrowUp size={12} />} tone="warn" label="Went up"
              value={masked ? MASK : `+${money(upTotal)}`}
              note={`${ups.length - newCount} up${newCount ? ` · ${newCount} new` : ''}`}
            />
            <SummaryTile
              icon={<Sparkles size={12} />} tone="info" label="New"
              value={String(newCount)}
              note={newCount === 0 || masked ? `not in ${prevLabel}` : `${money(newTotal)} · not in ${prevLabel}`}
            />
            <SummaryTile
              icon={<ArrowDown size={12} />} tone="good" label="Went down"
              value={masked ? MASK : `−${money(downTotal)}`}
              note={`${downs.length - stoppedCount} down${stoppedCount ? ` · ${stoppedCount} stopped` : ''}`}
            />
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '2px 0 12px' }}>
            Net {net >= 0 ? 'more' : 'less'} spent:{' '}
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>
              {masked ? MASK : `${net >= 0 ? '+' : '−'}${money(net)}`}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {shownUps.map(c => (
              <ChangeRow key={c.category} c={c} maxAbs={maxAbs} masked={masked} onClick={onCategoryClick} />
            ))}
            {shownUps.length > 0 && shownDowns.length > 0 && (
              <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
            )}
            {shownDowns.map(c => (
              <ChangeRow key={c.category} c={c} maxAbs={maxAbs} masked={masked} onClick={onCategoryClick} />
            ))}
          </div>

          {hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="btn btn-sm btn-ghost pressable"
              style={{ display: 'flex', margin: '10px auto 0', gap: 5 }}
            >
              {expanded ? 'Show fewer' : `Show ${hiddenCount} more`}
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function SummaryTile({ icon, tone, label, value, note }: {
  icon: React.ReactNode
  tone: 'warn' | 'good' | 'info'
  label: string
  value: string
  note: string
}) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '10px 12px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>
        <span style={{
          width: 18, height: 18, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `var(--${tone}-soft)`, color: `var(--${tone}-ink)`, flexShrink: 0,
        }}>
          {icon}
        </span>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {note}
      </div>
    </div>
  )
}

// One diverging bar: increases grow right from the centre line, decreases grow left.
function ChangeRow({ c, maxAbs, masked, onClick }: {
  c: Change
  maxAbs: number
  masked: boolean
  onClick: (category: string) => void
}) {
  const isUp = c.delta > 0
  const widthPct = (Math.abs(c.delta) / maxAbs) * 50
  const pct = c.prev > 0 ? Math.round((c.delta / c.prev) * 100) : null
  const deltaText = masked
    ? (pct !== null ? `${isUp ? '+' : ''}${pct}%` : MASK)
    : `${isUp ? '+' : '−'}${money(c.delta)}`
  const fromTo = masked ? null : `${money(c.prev)} → ${money(c.current)}`
  const name = getCategoryDisplayName(c.category)

  return (
    <button
      onClick={() => onClick(c.category)}
      className="change-row"
      title={masked ? name : `${name}: ${fromTo}${pct !== null ? ` (${isUp ? '+' : ''}${pct}%)` : ''}`}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CategoryIcon category={c.category} size={14} />
        </span>
        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </span>
            {c.kind === 'new' && <Tag tone="info">New</Tag>}
            {c.kind === 'stopped' && <Tag tone="good">Stopped</Tag>}
          </span>
          {fromTo && (
            <span style={{ fontSize: 10.5, color: 'var(--text-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {fromTo}
            </span>
          )}
        </span>
      </span>

      <span className="change-track" aria-hidden>
        <span style={{
          position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: 'var(--border-strong)',
        }} />
        <span style={{
          position: 'absolute', top: '50%', height: 10, marginTop: -5,
          width: `max(${widthPct}%, 3px)`,
          ...(isUp
            ? { left: 'calc(50% + 1px)', borderRadius: '0 4px 4px 0', background: 'var(--warn)' }
            : { right: 'calc(50% + 1px)', borderRadius: '4px 0 0 4px', background: 'var(--good)' }),
          transition: 'width .5s cubic-bezier(.22,1,.36,1)',
        }} />
      </span>

      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, fontSize: 12, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
        {isUp
          ? <ArrowUp size={11} style={{ color: 'var(--warn-ink)' }} />
          : <ArrowDown size={11} style={{ color: 'var(--good-ink)' }} />}
        {deltaText}
      </span>
    </button>
  )
}

function Tag({ tone, children }: { tone: 'info' | 'good'; children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 999, flexShrink: 0,
      background: `var(--${tone}-soft)`, color: `var(--${tone}-ink)`,
    }}>
      {children}
    </span>
  )
}

export default memo(CategoryChangesCard)
