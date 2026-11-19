'use client'

import type { CSSProperties, ReactNode } from 'react'

export type Tone = 'good' | 'bad' | 'warn' | 'info' | 'brand' | 'neutral'

// ── Icons (the design's own strokes) ──────────────────────────────────────────

export const P = {
  repay: 'M9 10l-5 5 5 5M20 4v7a4 4 0 0 1-4 4H4',
  check: 'M5 12l5 5 9-10',
  chat: 'M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z',
  edit: 'M4 20h4L19 9l-4-4L4 16v4z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  chevDown: 'M6 9l6 6 6-6',
  chevRight: 'M9 6l6 6-6 6',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  search: 'M20 20l-3.5-3.5',
  warn: 'M12 3l10 18H2L12 3zM12 10v4M12 17.5v.5',
  info: 'M12 11v6M12 7.5v.5',
  people: 'M2 21c0-4 3-6 7-6s7 2 7 6M16 4a4 4 0 0 1 0 8M22 21c0-3-1.5-5-4-5.7',
  person: 'M4 21c0-4 3.6-6 8-6s8 2 8 6',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z',
  eyeOff: 'M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.3 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6',
  sort: 'M4 7h16M7 12h10M10 17h4',
  clock: 'M12 7v5l3 2',
  owed: 'M17 7L7 17M7 9v8h8',
  owe: 'M7 17L17 7M9 7h8v8',
}

export function Ico({ d, size, sw = 2, stroke = 'currentColor', join = true, circles, style }: {
  d: string; size: number; sw?: number; stroke?: string; join?: boolean; circles?: [number, number, number][]; style?: CSSProperties
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden
      style={{ fill: 'none', stroke, strokeWidth: sw, strokeLinecap: 'round', ...(join ? { strokeLinejoin: 'round' } : {}), ...style }}>
      {circles?.map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}
      <path d={d} />
    </svg>
  )
}

export const pretty = { textWrap: 'pretty' } as CSSProperties
export const balance = { textWrap: 'balance' } as CSSProperties

// ── Record row (an Upcoming-style row: date tile, title and amount, status line) ──

export interface RecVM {
  id: string; closed: boolean; title: string; amount: string; amountTone: 'good' | 'ink' | 'muted'
  tileMon: string; tileDay: string; tileTone: Tone
  status: string; statusTone: 'bad' | 'warn' | 'muted'; meta: string
  progress: { pct: string; label: string } | null
  loan: { emi: string; rate: string; left: string; next: string } | null
  action: string; actionUrgent: boolean
  expanded: boolean; onToggle: () => void
  settlements: { title: string; isExpense: boolean; amount: string; date: string; tone: Tone }[]
  moreSettlements: string; isOpen: boolean
  onRepay: () => void; onMark: () => void; onRemind: () => void; onEdit: () => void; onDelete: () => void
}

const amountInk = { good: 'var(--good-ink)', ink: 'var(--ink)', muted: 'var(--ink-2)' }
const statusInk = { bad: 'var(--bad-ink)', warn: 'var(--warn-ink)', muted: 'var(--ink-3)' }
const ellipsis: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

const rowBtn: CSSProperties = {
  height: 'var(--hit)', borderRadius: 999, border: 0, background: 'var(--sunk)',
  fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', padding: '0 6px',
}

function LoanCell({ label, value, num }: { label: string; value: string; num?: boolean }) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '8px 10px', minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{label}</div>
      <div className={num ? 'bw-num' : undefined} style={{ fontSize: 13, fontWeight: 600, ...ellipsis }}>{value}</div>
    </div>
  )
}

export function RecordRow({ r, first }: { r: RecVM; first: boolean }) {
  return (
    <div style={{ borderTop: first ? 'none' : '1px solid var(--line)' }}>
      <div role="button" tabIndex={0} aria-expanded={r.expanded} onClick={r.onToggle} className="bw-row"
        onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); r.onToggle() } }}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer', transition: 'background .15s' }}>
        <div data-tone={r.tileTone} style={{ width: 46, height: 50, flex: 'none', borderRadius: 12, background: 'var(--ts)', color: 'var(--ti)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          {r.closed ? <Ico d={P.check} size={18} sw={2.4} /> : (
            <>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em' }}>{r.tileMon}</span>
              <span className="bw-num" style={{ fontSize: 18, fontWeight: 600, lineHeight: 1 }}>{r.tileDay}</span>
            </>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ flex: 1, minWidth: 0, ...ellipsis, fontWeight: 600, fontSize: 15, color: r.closed ? 'var(--ink-2)' : 'var(--ink)' }}>{r.title}</span>
            <span className="bw-num" style={{ fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap', color: amountInk[r.amountTone] }}>{r.amount}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink-3)', minWidth: 0 }}>
            <span style={{ flex: 1, minWidth: 0, ...ellipsis }}>
              {r.status && <span style={{ color: statusInk[r.statusTone], fontWeight: 600 }}>{r.status}</span>}
              {r.status && r.meta && ' · '}
              {r.meta}
            </span>
            <Ico d={P.chevDown} size={14} stroke="var(--ink-3)" style={{ flex: 'none', transform: r.expanded ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }} />
          </div>
          {r.progress && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 1 }}>
              <div style={{ flex: 1, height: 5, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{ width: r.progress.pct, height: '100%', borderRadius: 999, background: 'var(--brand)' }} />
              </div>
              <span className="bw-num" style={{ fontSize: 11.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{r.progress.label}</span>
            </div>
          )}
        </div>
        {r.action && (
          <button onClick={e => { e.stopPropagation(); r.onRepay() }}
            style={{ height: 40, padding: '0 14px', flex: 'none', borderRadius: 999, border: 0, fontWeight: 600, fontSize: 13.5, cursor: 'pointer',
              background: r.actionUrgent ? 'var(--brand)' : 'var(--brand-soft)', color: r.actionUrgent ? 'var(--on-brand)' : 'var(--brand-ink)',
              boxShadow: r.actionUrgent ? '0 6px 16px -8px var(--brand)' : 'none' }}>{r.action}</button>
        )}
      </div>

      {r.expanded && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {r.loan && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 6 }}>
              <LoanCell label="EMI" value={r.loan.emi} num />
              <LoanCell label="Rate" value={r.loan.rate} />
              <LoanCell label="Months left" value={r.loan.left} />
              <LoanCell label="Next EMI" value={r.loan.next} />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-3)', padding: '4px 0' }}>Settlements</div>
            {r.settlements.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {r.settlements.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: i === 0 ? 'none' : '1px dashed var(--line)' }}>
                    <div data-tone={s.tone} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--t)', marginTop: 6, flex: 'none' }} />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, overflowWrap: 'anywhere' }}>{s.title}</span>
                      {s.isExpense && <span data-tone="warn" style={{ background: 'var(--ts)', color: 'var(--ti)', fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 999 }}>expense</span>}
                    </div>
                    <div style={{ textAlign: 'right', flex: 'none' }}>
                      <div className="bw-num" style={{ fontSize: 13.5, fontWeight: 500 }}>{s.amount}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{s.date}</div>
                    </div>
                  </div>
                ))}
                {r.moreSettlements && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', padding: '6px 0 0 18px', borderTop: '1px dashed var(--line)' }}>{r.moreSettlements}</div>}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>No repayments yet.</div>
            )}
          </div>
          {r.isOpen ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
              <button onClick={r.onMark} style={{ ...rowBtn, color: 'var(--ink)', fontWeight: 600 }}>
                <Ico d={P.check} size={16} sw={2.2} style={{ flex: 'none' }} />Mark fully repaid
              </button>
              <button onClick={r.onRemind} title="Remind on WhatsApp" style={{ ...rowBtn, color: 'var(--ink)', fontWeight: 600 }}>
                <Ico d={P.chat} size={16} stroke="var(--good)" style={{ flex: 'none' }} />Remind
              </button>
              <button onClick={r.onEdit} style={{ ...rowBtn, color: 'var(--ink)', fontWeight: 600 }}>
                <Ico d={P.edit} size={15} style={{ flex: 'none' }} />Edit
              </button>
              <button onClick={r.onDelete} style={{ ...rowBtn, color: 'var(--bad-ink)', fontWeight: 600 }}>
                <Ico d={P.trash} size={15} style={{ flex: 'none' }} />Delete
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex' }}>
              <button onClick={r.onDelete} style={{ ...rowBtn, color: 'var(--bad-ink)', fontWeight: 600, padding: '0 14px' }}>
                <Ico d={P.trash} size={15} style={{ flex: 'none' }} />Delete record
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Records in one bordered card, divided by hairlines, like an Upcoming group */
function RecordList({ rows }: { rows: RecVM[] }) {
  if (!rows.length) return null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, overflow: 'hidden' }}>
      {rows.map((r, i) => <RecordRow key={r.id} r={r} first={i === 0} />)}
    </div>
  )
}

// ── Person panel (desktop detail pane, phone sheet, single-person inline) ─────

export interface TimelineGroup {
  label: string
  items: { glyph: string; tone: Tone; title: string; sub: string; amount: string; date: string; isExpense: boolean }[]
}

export interface PersonVM {
  key: string; name: string; initial: string; avBg: string; avInk: string; sub: string
  isPhone: boolean; onClose: () => void
  tone: Tone; netLabel: string; netAmount: string; breakdown: string
  warnText: string; warnTone: Tone; noOpen: boolean
  onRemind: () => void; onRepay: () => void; onAdd: () => void; contactLabel: string; onContact: () => void
  tabTimeline: boolean; onTabRecords: () => void; onTabTimeline: () => void; recordsTabLabel: string
  openRecords: RecVM[]; noOpenText: string
  settledCount: number; showSettled: boolean; settledToggle: string; onToggleSettled: () => void; settledRecords: RecVM[]
  timeline: TimelineGroup[]
}

const actBtn: CSSProperties = {
  minHeight: 66, padding: '10px 4px', borderRadius: 16, border: 0, background: 'var(--sunk)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
  fontSize: 12, fontWeight: 600, cursor: 'pointer', lineHeight: 1.2, textAlign: 'center',
}

export const tabBtn: CSSProperties = {
  height: 'calc(var(--hit) - 4px)', border: 0, borderRadius: 999, background: 'transparent',
  fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', cursor: 'pointer',
}

export function PersonPanel({ p }: { p: PersonVM }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 20, background: p.avBg, color: p.avInk }}>{p.initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2, overflowWrap: 'anywhere' }}>{p.name}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3 }}>{p.sub}</div>
        </div>
        {p.isPhone && (
          <button onClick={p.onClose} aria-label="Close" style={{ width: 44, height: 44, flex: 'none', borderRadius: 999, border: 0, background: 'var(--sunk)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-2)' }}>
            <Ico d={P.close} size={18} join={false} />
          </button>
        )}
      </div>

      <div style={{ background: 'var(--surface-2)', borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)' }}>{p.netLabel}</div>
        <div className="bw-num" style={{ fontSize: 30, fontWeight: 600, color: p.tone === 'good' ? 'var(--good-ink)' : 'var(--ink)', overflowWrap: 'anywhere', lineHeight: 1.15 }}>{p.netAmount}</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>{p.breakdown}</div>
        {p.warnText && (
          <div data-tone={p.warnTone} style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--ts)', color: 'var(--ti)', borderRadius: 12, padding: '9px 10px', fontSize: 12.5, fontWeight: 500, lineHeight: 1.4 }}>
            <Ico d={P.warn} size={16} style={{ flex: 'none', marginTop: 1 }} /><span>{p.warnText}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
        <button onClick={p.onRemind} data-off={String(p.noOpen)} style={actBtn}><Ico d={P.chat} size={20} stroke="var(--good)" />Remind on WhatsApp</button>
        <button onClick={p.onRepay} data-off={String(p.noOpen)} style={actBtn}><Ico d={P.repay} size={20} stroke="var(--brand)" />Record repayment</button>
        <button onClick={p.onAdd} style={actBtn}><Ico d={P.plus} size={20} stroke="var(--ink-2)" join={false} />Add record</button>
        <button onClick={p.onContact} style={actBtn}><Ico d={P.person} size={20} stroke="var(--ink-2)" circles={[[12, 8, 4]]} />{p.contactLabel}</button>
      </div>

      <div role="tablist" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--sunk)', borderRadius: 999, padding: 4, gap: 4 }}>
        <button role="tab" aria-selected={!p.tabTimeline} onClick={p.onTabRecords} data-seg={String(!p.tabTimeline)} style={tabBtn}>{p.recordsTabLabel}</button>
        <button role="tab" aria-selected={p.tabTimeline} onClick={p.onTabTimeline} data-seg={String(p.tabTimeline)} style={tabBtn}>Timeline</button>
      </div>

      {!p.tabTimeline ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <RecordList rows={p.openRecords} />
          {p.noOpen && <div style={{ padding: 14, borderRadius: 16, background: 'var(--sunk)', fontSize: 13, color: 'var(--ink-2)', textAlign: 'center' }}>{p.noOpenText}</div>}
          {p.settledCount > 0 && (
            <button onClick={p.onToggleSettled} style={{ height: 'var(--hit)', borderRadius: 999, border: '1px dashed var(--line-2)', background: 'transparent', color: 'var(--ink-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{p.settledToggle}</button>
          )}
          {p.showSettled && <RecordList rows={p.settledRecords} />}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {p.timeline.map(g => (
            <div key={g.label} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-3)', paddingBottom: 4 }}>{g.label}</div>
              {g.items.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' }}>
                  <div data-tone={e.tone} style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-2)', color: 'var(--ti)', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700, flex: 'none' }}>{e.glyph}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>{e.title}</span>
                      {e.isExpense && <span data-tone="warn" style={{ background: 'var(--ts)', color: 'var(--ti)', fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 999 }}>expense</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-3)', overflowWrap: 'anywhere', marginTop: 1 }}>{e.sub}</div>
                  </div>
                  <div style={{ textAlign: 'right', flex: 'none' }}>
                    <div className="bw-num" style={{ fontSize: 14, fontWeight: 500 }}>{e.amount}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{e.date}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** A labelled form field in the sheets */
export function Field({ label, children, gap = 6 }: { label: ReactNode; children: ReactNode; gap?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, minWidth: 0 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>{label}</label>
      {children}
    </div>
  )
}
