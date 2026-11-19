'use client'

import { parseISO } from 'date-fns'
import {
  IconAlarm, IconChevronDown, IconChevronUp, IconCircleCheck, IconCircleDashed, IconDotsVertical, IconHelpCircle,
  IconInfoCircle, IconLink, IconPlus, IconReceipt, IconTrendingDown, IconTrophy,
} from '@tabler/icons-react'
import { MON, daysOverdue, fmtD, monthYear, paymentLabel, type GoalStatus, type GoalView, type ProjectView, type TablerIcon } from './goalsModel'
import { DotsButton, GoalGlyph, MONO, MenuPopover, Tile, useGoals, type MenuItem } from './goalsUi'

// ── Words and colours for a goal, shared by the card and the detail sheet ───────

export const PILL: Record<GoalStatus, [string, string, string, TablerIcon]> = {
  ontrack:    ['On track',    'var(--good-soft)', 'var(--good-ink)', IconCircleCheck],
  behind:     ['Behind',      'var(--warn-soft)', 'var(--warn-ink)', IconTrendingDown],
  overdue:    ['Overdue',     'var(--bad-soft)',  'var(--bad-ink)',  IconAlarm],
  notstarted: ['Not started', 'var(--surface2)',  'var(--ink2)',     IconCircleDashed],
  notarget:   ['No target',   'var(--surface2)',  'var(--ink2)',     IconHelpCircle],
  reached:    ['Reached',     'var(--good-soft)', 'var(--good-ink)', IconTrophy],
}

export const barColorOf = (s: GoalStatus) =>
  s === 'behind' ? 'var(--warn)' : s === 'overdue' ? 'var(--bad)' : s === 'reached' ? 'var(--good)' : 'var(--brand)'

export function goalMeta(g: GoalView, now: Date): { meta: string; metaColor: string } {
  const reached = g.status === 'reached'
  if (!g.date) return { meta: 'No target date', metaColor: 'var(--ink3)' }
  if (g.past && !reached) {
    const days = daysOverdue(g, now)
    const ago = days < 45 ? `${days} day${days === 1 ? '' : 's'}` : `${Math.floor(days / 30.4)} mo`
    return { meta: `Was due ${MON[g.date.getMonth()]} ${g.date.getFullYear()} · ${ago} overdue`, metaColor: 'var(--bad-ink)' }
  }
  const left = reached ? 'reached' : g.monthsLeft === 0 ? 'due this month' : `${g.monthsLeft} mo left`
  return { meta: `${monthYear(g.date)} · ${left}`, metaColor: 'var(--ink3)' }
}

export function goalNote(g: GoalView, m: (v: number, id: string) => string): { note: string; noteColor: string } {
  const id = g.id
  switch (g.status) {
    case 'behind':   return { note: `Behind by ${m(g.behindBy, id)}`, noteColor: 'var(--warn-ink)' }
    case 'overdue':  return { note: `${m(g.remaining, id)} to go`, noteColor: 'var(--bad-ink)' }
    case 'notarget': return { note: 'Set a target', noteColor: 'var(--ink2)' }
    case 'reached':  return { note: 'Goal reached!', noteColor: 'var(--ink2)' }
  }
  if (g.need != null) return { note: g.monthsLeft === 0 ? `${m(g.need, id)} needed this month` : `${m(g.need, id)}/mo needed`, noteColor: 'var(--ink2)' }
  return { note: `${m(g.remaining, id)} to go`, noteColor: 'var(--ink2)' }
}

const markerLeft = (g: GoalView) => `${g.expected !== null && g.goal.targetAmount ? Math.min(100, (g.expected / g.goal.targetAmount) * 100) : 0}%`
export const hasMarkerOf = (g: GoalView) => !!g.date && g.status !== 'reached' && !g.past && g.status !== 'notarget'

// ── Goal card ───────────────────────────────────────────────────────────────────

export function GoalCard({ g, now, delay, menuOpen, menuItems, onOpen, onMenu, onAdd }: {
  g: GoalView; now: Date; delay: string; menuOpen: boolean; menuItems: MenuItem[]
  onOpen: () => void; onMenu: (e: React.MouseEvent) => void; onAdd: (e: React.MouseEvent) => void
}) {
  const { m, lp, mounted, consumeLongPress } = useGoals()
  const id = g.id
  const [pill, pillBg, pillFg, PillIcon] = PILL[g.status]
  const { meta, metaColor } = goalMeta(g, now)
  const { note, noteColor } = goalNote(g, m)
  const reached = g.status === 'reached'
  const open = () => { if (!consumeLongPress()) onOpen() }

  return (
    <article
      role="button" tabIndex={0} aria-label={g.goal.name} {...lp(id)} className="gl-noselect"
      onClick={open} onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen() } }}
      style={{
        position: 'relative', background: 'var(--surface)', borderRadius: 24, boxShadow: 'var(--shadow)', padding: 18,
        display: 'flex', flexDirection: 'column', gap: 14, cursor: 'pointer', minWidth: 0,
        opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(10px)',
        transition: `opacity 420ms ease ${delay}, transform 420ms ease ${delay}`,
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Tile size={44} radius={14} bg={reached ? 'var(--good-soft)' : 'var(--brand-soft)'} fg={reached ? 'var(--good-ink)' : 'var(--brand-ink)'}>
          <GoalGlyph emoji={g.goal.emoji} size={22} />
        </Tile>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{g.goal.name}</div>
          <div style={{ color: metaColor, fontSize: 12.5, marginTop: 3 }}>{meta}</div>
        </div>
        <DotsButton onClick={onMenu} margin="-8px -10px 0 0" Icon={IconDotsVertical} />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 500, letterSpacing: '-0.03em', overflowWrap: 'anywhere', lineHeight: 1.15 }}>{m(g.goal.currentAmount, id)}</div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: 'var(--ink3)', marginTop: 2 }}>saved of {m(g.goal.targetAmount, id)}</div>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', borderRadius: 999, background: pillBg, color: pillFg, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
          <PillIcon size={14} stroke={2} />{pill}
        </span>
      </div>

      <div style={{ position: 'relative', height: 8, borderRadius: 99, background: 'var(--surface2)' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${mounted ? g.pct : 0}%`, borderRadius: 99, background: barColorOf(g.status), transition: `width 800ms cubic-bezier(.16,1,.3,1) ${delay}` }} />
        {hasMarkerOf(g) && <div title="Where you planned to be today" style={{ position: 'absolute', top: -4, bottom: -4, left: markerLeft(g), width: 2, marginLeft: -1, borderRadius: 2, background: 'var(--ink)', opacity: 0.7 }} />}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--ink2)' }}><span style={{ fontFamily: MONO }}>{Math.floor(g.pct)}%</span> done</span>
        <span style={{ color: noteColor, fontWeight: 600, fontFamily: MONO, fontSize: 12 }}>{note}</span>
      </div>

      {g.linked && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--ink3)', minWidth: 0 }}>
          <IconLink size={14} stroke={2} style={{ flex: 'none' }} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Adds up from savings named “{g.goal.name}”</span>
        </div>
      )}

      <button onClick={onAdd} style={{ height: 44, border: 0, borderRadius: 14, background: 'var(--brand-soft)', color: 'var(--brand-ink)', font: "600 14px 'Plus Jakarta Sans',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
        <IconPlus size={18} stroke={2} />Add money
      </button>

      {menuOpen && <MenuPopover items={menuItems} top={52} />}
    </article>
  )
}

// ── A reached goal in the Done group ────────────────────────────────────────────

export function DoneRow({ g, menuOpen, menuItems, onOpen, onMenu }: {
  g: GoalView; menuOpen: boolean; menuItems: MenuItem[]; onOpen: () => void; onMenu: (e: React.MouseEvent) => void
}) {
  const { m, lp, consumeLongPress } = useGoals()
  return (
    <div
      role="button" tabIndex={0} aria-label={g.goal.name} {...lp(g.id)} className="gl-noselect"
      onClick={() => { if (!consumeLongPress()) onOpen() }}
      onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen() } }}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, background: 'var(--surface2)', cursor: 'pointer', minWidth: 0 }}
    >
      <Tile size={44} radius={14} bg="var(--good-soft)" fg="var(--good-ink)"><GoalGlyph emoji={g.goal.emoji} size={22} /></Tile>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.goal.name}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: 'var(--good-ink)', marginTop: 2, flexWrap: 'wrap' }}>
          <IconTrophy size={14} stroke={2} /><span style={{ fontWeight: 600 }}>Goal reached!</span>
          <span style={{ fontFamily: MONO, color: 'var(--ink2)' }}>{m(g.goal.currentAmount, g.id)}</span>
        </div>
      </div>
      <DotsButton onClick={onMenu} Icon={IconDotsVertical} />
      {menuOpen && <MenuPopover items={menuItems} top={56} />}
    </div>
  )
}

// ── Project card ────────────────────────────────────────────────────────────────

const STATUS_PILL = {
  active:    ['Active',    'var(--good-soft)', 'var(--good-ink)'],
  completed: ['Completed', 'var(--info-soft)', 'var(--info-ink)'],
  paused:    ['Paused',    'var(--surface2)',  'var(--ink2)'],
} as const

export function ProjectCard({ p, delay, expanded, shown, menuOpen, menuItems, onToggle, onMore, onMenu, onAddTx }: {
  p: ProjectView; delay: string; expanded: boolean; shown: number; menuOpen: boolean; menuItems: MenuItem[]
  onToggle: () => void; onMore: () => void; onMenu: (e: React.MouseEvent) => void; onAddTx: () => void
}) {
  const { m, lp, mounted, desktop } = useGoals()
  const { project, id, paid, raw, over, rows } = p
  const budget = project.totalBudget
  const [pill, pillBg, pillFg] = STATUS_PILL[project.status]
  const barColor = project.status === 'paused' ? 'var(--ink3)' : over ? 'var(--bad)' : raw > 80 ? 'var(--warn)' : 'var(--brand)'
  const bigLabel = over ? 'Over budget by' : project.status === 'completed' ? 'Came in under by' : 'Left to spend'
  const dates = [project.startDate && `Started ${fmtD(parseISO(project.startDate))}`, project.endDate && `Due ${fmtD(parseISO(project.endDate))}`].filter(Boolean).join(' · ')
  const tiles = [
    { l: 'Budget', v: m(budget, id), c: 'var(--ink)' },
    { l: 'Paid', v: m(paid, id), c: 'var(--ink)' },
    { l: 'Progress', v: `${Math.round(raw)}%`, c: over ? 'var(--bad-ink)' : raw > 80 ? 'var(--warn-ink)' : 'var(--ink)' },
  ]
  const Chev = expanded ? IconChevronUp : IconChevronDown

  return (
    <article
      {...lp(id)} className="gl-noselect"
      style={{
        position: 'relative', gridColumn: expanded && desktop ? '1 / -1' : 'auto', background: 'var(--surface)', borderRadius: 24, boxShadow: 'var(--shadow)', padding: 20,
        display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0,
        opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(10px)',
        transition: `opacity 420ms ease ${delay}, transform 420ms ease ${delay}`,
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 16, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{project.name}</span>
            <span style={{ height: 22, display: 'flex', alignItems: 'center', padding: '0 9px', borderRadius: 999, background: pillBg, color: pillFg, fontSize: 11.5, fontWeight: 600 }}>{pill}</span>
          </div>
          {dates && <div style={{ color: 'var(--ink3)', fontSize: 12.5, marginTop: 4 }}>{dates}</div>}
        </div>
        <DotsButton onClick={onMenu} margin="-10px -10px 0 0" Icon={IconDotsVertical} />
      </div>

      {project.description && (
        <p style={{ margin: 0, color: 'var(--ink2)', fontSize: 13, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: expanded ? 20 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere', textWrap: 'pretty' } as React.CSSProperties}>{project.description}</p>
      )}

      <div>
        <div style={{ fontSize: 12.5, color: over ? 'var(--bad-ink)' : 'var(--ink3)', fontWeight: 600 }}>{bigLabel}</div>
        <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 500, letterSpacing: '-0.03em', color: over ? 'var(--bad-ink)' : 'var(--ink)', overflowWrap: 'anywhere', lineHeight: 1.2 }}>{m(over ? paid - budget : budget - paid, id)}</div>
      </div>

      <div style={{ height: 8, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${mounted ? Math.min(100, Math.max(0, raw)) : 0}%`, borderRadius: 99, background: barColor, transition: `width 800ms cubic-bezier(.16,1,.3,1) ${delay}` }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
        {tiles.map(t => (
          <div key={t.l} style={{ background: 'var(--surface2)', borderRadius: 14, padding: '10px 12px', minWidth: 0 }}>
            <div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{t.l}</div>
            <div style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 500, marginTop: 2, overflowWrap: 'anywhere', color: t.c }}>{t.v}</div>
          </div>
        ))}
      </div>

      <button onClick={onToggle} aria-expanded={expanded} style={{ height: 44, margin: '0 -8px -6px', padding: '0 8px', border: 0, borderRadius: 12, background: 'transparent', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8, font: "600 13.5px 'Plus Jakarta Sans',sans-serif", cursor: 'pointer' }}>
        <IconReceipt size={18} stroke={2} style={{ color: 'var(--ink3)' }} />
        <span>{rows.length ? `${rows.length} payment${rows.length === 1 ? '' : 's'}` : 'No payments yet'}</span>
        <span style={{ flex: 1 }} />
        <Chev size={18} stroke={2} style={{ color: 'var(--ink3)' }} />
      </button>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: -6 }}>
          {rows.length > 0 ? (
            <>
              {rows.slice(0, shown).map(r => {
                const refund = r.value < 0
                const cp = Math.min(100, Math.max(0, r.prevPct)), cn = Math.min(100, Math.max(0, r.newPct))
                const start = refund ? cn : cp
                return (
                  <div key={r.tx.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '4px 12px', padding: '12px 0', borderTop: '1px solid var(--line)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{paymentLabel(r.tx)}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 1 }}>{fmtD(parseISO(r.tx.date))}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 500, color: refund ? 'var(--good-ink)' : 'var(--ink)' }}>{m(r.value, id)}</div>
                      {budget > 0 && (
                        <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--ink3)', marginTop: 1, whiteSpace: 'nowrap' }}>
                          {refund ? '−' : '+'}{Math.abs((r.value / budget) * 100).toFixed(1)}% · {Math.round(r.newPct)}% done
                        </div>
                      )}
                    </div>
                    {budget > 0 && (
                      // Grey: progress before this payment. Coloured: what it added, or what a refund gave back.
                      <div style={{ gridColumn: '1 / -1', position: 'relative', height: 4, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden', marginTop: 4 }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${start}%`, background: 'var(--ink3)', opacity: 0.4 }} />
                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${start}%`, width: `${Math.abs(cn - cp)}%`, background: refund ? 'var(--good)' : 'var(--brand)' }} />
                      </div>
                    )}
                  </div>
                )
              })}
              {rows.length > shown && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 12, color: 'var(--ink3)', flex: 1 }}>Showing {Math.min(shown, rows.length)} of {rows.length}</span>
                  <button onClick={onMore} style={{ height: 40, padding: '0 16px', border: 0, borderRadius: 999, background: 'var(--surface2)', color: 'var(--ink)', font: "600 13px 'Plus Jakarta Sans',sans-serif", cursor: 'pointer' }}>Show 5 more</button>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: 16, borderRadius: 16, background: 'var(--surface2)', color: 'var(--ink2)', fontSize: 13, textAlign: 'center' }}>No payments yet.</div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, fontSize: 12, color: 'var(--ink3)', lineHeight: 1.5 }}>
            <IconInfoCircle size={15} stroke={2} style={{ flex: 'none', marginTop: 1 }} />
            <span>
              Paid is the total of transactions linked here. To add a payment, log a transaction and choose <b style={{ color: 'var(--ink2)' }}>Link to project</b>.{' '}
              <button onClick={onAddTx} style={{ border: 0, padding: 0, background: 'none', color: 'inherit', font: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer' }}>Add transaction</button>
            </span>
          </div>
        </div>
      )}

      {menuOpen && <MenuPopover items={menuItems} top={52} />}
    </article>
  )
}
