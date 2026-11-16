'use client'

import { Fragment, useMemo } from 'react'
import { ChevronDown, ChevronsDown, Repeat } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { MONO, avatarStyle, dayLabel, dayTotals, initialStyle, rowModel, type ViewTx } from './txnView'

// ── Single transaction row ───────────────────────────────────────────────────

export function TxnRow({ tx, onOpen }: { tx: ViewTx; onOpen: (t: ViewTx) => void }) {
  const assets = useAppStore(s => s.assets)
  const transactions = useAppStore(s => s.transactions)
  const settings = useAppStore(s => s.settings)
  const m = useMemo(() => rowModel(tx, { assets, transactions, settings }), [tx, assets, transactions, settings])

  return (
    <button className="txr" onClick={() => onOpen(tx)} style={{ color: 'var(--t1)' }}>
      <div style={avatarStyle(m.look.color)}>
        {m.look.initial
          ? <span style={initialStyle(m.look.color)}>{m.look.initial}</span>
          : m.look.icon?.(20)}
      </div>

      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 4, minHeight: 22 }}>
          <span style={{ fontSize: 15, fontWeight: 600, lineHeight: '22px', letterSpacing: '-0.005em', overflowWrap: 'anywhere' }}>{m.title}</span>
          {m.badges.map(b => (
            <span key={b.label} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, height: 20, padding: '0 7px', borderRadius: 999,
              fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', lineHeight: 1,
              background: `var(--${b.tone === 'neutral' ? 's2' : b.tone + '-soft'})`,
              color: b.tone === 'neutral' ? 'var(--t2)' : `var(--${b.tone}-ink)`,
            }}>
              {b.repeat && <Repeat size={11} />}
              {b.label}
            </span>
          ))}
        </div>

        {m.lines.map((ln, i) => (
          <div key={i} dir="auto" style={{
            fontSize: 13, lineHeight: '18px', color: 'var(--t2)', overflowWrap: 'anywhere', minWidth: 0,
            ...(ln.clamp ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}),
          }}>
            {ln.segs.map((sg, j) => <span key={j} style={sg.style}>{sg.text}</span>)}
          </div>
        ))}

        {m.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
            {m.tags.map(tg => (
              <span key={tg} style={{ height: 20, display: 'inline-flex', alignItems: 'center', padding: '0 7px', borderRadius: 6, background: 'var(--s2)', color: 'var(--t2)', fontSize: 12, fontWeight: 500, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tg}</span>
            ))}
            {m.more && (
              <span style={{ height: 20, display: 'inline-flex', alignItems: 'center', padding: '0 6px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--t2)', fontSize: 12, fontWeight: 600 }}>{m.more}</span>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
        <span style={{
          fontFamily: MONO, fontSize: 15, fontWeight: 500, lineHeight: '22px', color: m.amountColor, whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums', textDecoration: m.fullyRefunded ? 'line-through' : 'none',
        }}>{m.amount}</span>
        {m.net && <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--t2)', whiteSpace: 'nowrap' }}>{m.net}</span>}
      </div>
    </button>
  )
}

// ── Day-grouped list ─────────────────────────────────────────────────────────

export interface DayGroup { key: string; items: ViewTx[]; monthBreak: string | null }

/** Busy days show this many rows until expanded */
const LIMIT = 6

const chevron = (open: boolean) => (
  <ChevronDown size={16} color="var(--t3)" style={{ flex: 'none', transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .2s cubic-bezier(0.23,1,0.32,1)' }} />
)
const countChip = (n: number) => (
  <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--t3)', padding: '1px 6px', borderRadius: 6, background: 'var(--s2)' }}>{n}</span>
)
const totalSpan = (x: { text: string; color: string }) => (
  <span key={x.text} style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, color: x.color, whiteSpace: 'nowrap' }}>{x.text}</span>
)
const moreText = (n: number, label: string) => `Show ${n - 5} more on ${label.replace(/^Today · |^Yesterday · /, '')}`

interface ListProps {
  groups: DayGroup[]
  collapsed: Record<string, boolean>
  expanded: Record<string, boolean>
  onToggle: (key: string) => void
  onExpand: (key: string) => void
  onOpen: (t: ViewTx) => void
  /** Desktop: day headers stick under the page header, on the list card's surface */
  desktop?: boolean
}

export default function TransactionList({ groups, collapsed, expanded, onToggle, onExpand, onOpen, desktop = false }: ListProps) {
  return (
    <>
      {groups.map((g, i) => {
        const open = !collapsed[g.key]
        const long = g.items.length > LIMIT + 1 && !expanded[g.key]
        const items = long ? g.items.slice(0, 5) : g.items
        const label = dayLabel(g.key)
        const totals = dayTotals(g.items)
        return (
          <Fragment key={g.key}>
            {g.monthBreak && (desktop
              ? <div style={{ padding: '20px 12px 4px', fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 24, lineHeight: 1.1 }}>{g.monthBreak}</div>
              : <div style={{ padding: '18px 12px 0', fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 22 }}>{g.monthBreak}</div>)}
            {desktop ? (
              <div style={{ position: 'sticky', top: 'var(--txn-head, 0px)', zIndex: 2, background: 'var(--surface)', borderTop: i === 0 || g.monthBreak ? '0' : '1px solid var(--border)' }}>
                <button onClick={() => onToggle(g.key)} aria-expanded={open} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '14px 12px 8px', background: 'transparent', border: 0, textAlign: 'left' }}>
                  {chevron(open)}
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
                  {countChip(g.items.length)}
                  <span style={{ flex: 1 }} />
                  <span style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{totals.map(totalSpan)}</span>
                </button>
              </div>
            ) : (
              <button onClick={() => onToggle(g.key)} aria-expanded={open} style={{ width: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 8px', minHeight: 44, padding: '12px 12px 6px', background: 'transparent', border: 0, textAlign: 'left' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 0 auto' }}>
                  {chevron(open)}
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
                  {countChip(g.items.length)}
                </span>
                <span style={{ display: 'flex', gap: '4px 12px', flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }}>{totals.map(totalSpan)}</span>
              </button>
            )}
            {open && (
              <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: desktop ? 4 : 0 }}>
                {items.map(tx => <TxnRow key={tx.id} tx={tx} onOpen={onOpen} />)}
                {long && (desktop ? (
                  <button className="txn-hover" onClick={() => onExpand(g.key)} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 12px 6px 68px', height: 36, padding: '0 12px', border: '1px dashed var(--border)', borderRadius: 10, background: 'transparent', fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
                    <ChevronsDown size={14} />{moreText(g.items.length, label)}
                  </button>
                ) : (
                  <button onClick={() => onExpand(g.key)} style={{ margin: '2px 12px 6px', height: 44, border: '1px dashed var(--border)', borderRadius: 12, background: 'transparent', fontSize: 14, fontWeight: 600, color: 'var(--t2)' }}>
                    {moreText(g.items.length, label)}
                  </button>
                ))}
              </div>
            )}
          </Fragment>
        )
      })}
    </>
  )
}
