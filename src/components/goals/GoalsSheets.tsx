'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format, parseISO, startOfDay, differenceInMonths } from 'date-fns'
import {
  IconAlertCircle, IconArrowsExchange, IconCalendarStats, IconChevronRight, IconCrane, IconInfoCircle, IconLink,
  IconLinkOff, IconLock, IconPencil, IconPlus, IconRoute, IconTargetArrow, IconTrash, IconTrophy,
} from '@tabler/icons-react'
import type { Project } from '@/types'
import { GOAL_GLYPHS, ICON_LABELS, MON, digits, fmtD, inr, monthYear, type GoalView } from './goalsModel'
import { PILL, barColorOf, goalMeta, hasMarkerOf } from './GoalsCards'
import { CloseButton, FIELD, FIELD_LABEL, GoalGlyph, MONO, SERIF, Seg, Tile, btn, useEntered, useGoals, type MenuItem } from './goalsUi'

const pad = (desktop: boolean) => (desktop ? '24px 28px 24px' : '14px 18px 22px')
const FONT = (w: number, s: number) => `${w} ${s}px 'Plus Jakarta Sans',sans-serif`
const C = 339.3 // ring circumference, r = 54

// ── Goal detail ─────────────────────────────────────────────────────────────────

export function GoalDetail({ g, now, onClose, onEdit, onAdd, onWithdraw }: {
  g: GoalView; now: Date; onClose: () => void; onEdit: () => void; onAdd: () => void; onWithdraw: () => void
}) {
  const { m, lp, desktop } = useGoals()
  const entered = useEntered()
  const id = g.id, goal = g.goal
  const [pill, pillBg, pillFg, PillIcon] = PILL[g.status]
  const { meta, metaColor } = goalMeta(g, now)
  const barColor = barColorOf(g.status)
  const overdue = g.status === 'overdue'
  const stats = [
    { l: 'Saved', v: m(goal.currentAmount, id), c: 'var(--ink)' },
    { l: 'To go', v: m(g.remaining, id), c: 'var(--ink)' },
    overdue ? { l: 'Due now', v: m(g.remaining, id), c: 'var(--bad-ink)' } : { l: 'Needed a month', v: g.need != null ? `${m(g.need, id)}/mo` : '—', c: 'var(--ink)' },
    { l: 'Target date', v: g.date ? monthYear(g.date) : 'No date', c: overdue ? 'var(--bad-ink)' : 'var(--ink)' },
  ]
  const hasPace = !!g.date && g.status !== 'reached' && g.status !== 'notarget'
  const expected = g.expected ?? 0
  const paceTxt = overdue
    ? `The target date passed on ${g.date ? fmtD(g.date) : ''}. ${m(g.remaining, id)} is still to go — pick a new date or add money to close it out.`
    : g.status === 'behind'
      ? `By today you'd planned to have ${m(expected, id)}. You're behind by ${m(g.behindBy, id)}. Saving ${m(g.need ?? 0, id)}/mo from now still gets you there on time.`
      : `By today you'd planned to have ${m(expected, id)}. You're on track — ${m(g.need ?? 0, id)}/mo gets you there on time.`

  // "At your pace": saved so far over the months since the goal was created
  const elapsedMo = Math.max(1, (startOfDay(now).getTime() - g.created.getTime()) / (30.44 * 864e5))
  const rate = goal.currentAmount / elapsedMo
  let finishTxt: string | null = null
  if (rate > 0 && g.remaining > 0) {
    const fm = Math.ceil(g.remaining / rate)
    const fd = new Date(now.getFullYear(), now.getMonth() + fm, 1)
    finishTxt = `At your pace so far (${m(rate, id)}/mo), you'd finish around ${MON[fd.getMonth()]} ${fd.getFullYear()}.`
  }

  const L = g.linked
  const sources = L ? [
    { Icon: IconLink, t: `Savings named “${goal.name}”`, s: 'Contributions you log to this savings vehicle add here; withdrawals take money out. The names must match exactly (any case).', v: m(L.sum, id), n: `${L.n} ${L.n === 1 ? 'entry' : 'entries'}` },
    { Icon: IconPencil, t: 'Typed in', s: 'Set in the goal form or with Add money.', v: m(Math.max(0, goal.currentAmount - L.sum), id), n: 'the rest' },
  ] : [
    { Icon: IconLinkOff, t: 'Not linked to savings yet', s: `Log a savings contribution to a vehicle named “${goal.name}” and it will add here on its own.`, v: m(goal.currentAmount, id), n: 'typed in' },
  ]

  return (
    <div style={{ padding: pad(desktop), display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <Tile size={52} radius={16} bg={g.status === 'reached' ? 'var(--good-soft)' : 'var(--brand-soft)'} fg={g.status === 'reached' ? 'var(--good-ink)' : 'var(--brand-ink)'}>
          <GoalGlyph emoji={goal.emoji} size={26} />
        </Tile>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 19, lineHeight: 1.25, letterSpacing: '-0.01em', overflowWrap: 'anywhere' }}>{goal.name}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, height: 24, padding: '0 9px', borderRadius: 999, background: pillBg, color: pillFg, fontSize: 12, fontWeight: 600 }}><PillIcon size={14} stroke={2} />{pill}</span>
            <span style={{ color: metaColor, fontSize: 12.5 }}>{meta}</span>
          </div>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      <div {...lp(id)} className="gl-noselect" style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 132, height: 132, flex: 'none' }}>
          <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden>
            <circle cx="66" cy="66" r="54" fill="none" stroke="var(--surface2)" strokeWidth={12} />
            <circle cx="66" cy="66" r="54" fill="none" stroke={barColor} transform="rotate(-90 66 66)" strokeWidth={12} strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - (entered ? g.pct : 0) / 100)} style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(.16,1,.3,1)' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 500, letterSpacing: '-0.04em' }}>{Math.floor(g.pct)}%</span>
            <span style={{ fontSize: 11.5, color: 'var(--ink3)' }}>done</span>
          </div>
        </div>
        <div style={{ flex: '1 1 220px', minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
          {stats.map(st => (
            <div key={st.l} style={{ background: 'var(--surface2)', borderRadius: 14, padding: '10px 12px', minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{st.l}</div>
              <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 500, marginTop: 2, overflowWrap: 'anywhere', color: st.c }}>{st.v}</div>
            </div>
          ))}
        </div>
      </div>

      {hasPace && (
        <div style={{ background: 'var(--surface2)', borderRadius: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}><IconRoute size={18} stroke={2} style={{ color: 'var(--ink3)' }} />Pace</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink2)', textWrap: 'pretty' } as React.CSSProperties}>{paceTxt}</div>
          <div style={{ position: 'relative', height: 8, borderRadius: 99, background: 'var(--surface)', margin: '4px 0' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${entered ? g.pct : 0}%`, borderRadius: 99, background: barColor, transition: 'width 800ms cubic-bezier(.16,1,.3,1)' }} />
            {hasMarkerOf(g) && <div style={{ position: 'absolute', top: -5, bottom: -5, left: `${goal.targetAmount ? Math.min(100, (expected / goal.targetAmount) * 100) : 0}%`, width: 2, marginLeft: -1, borderRadius: 2, background: 'var(--ink)' }} />}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 11.5, color: 'var(--ink3)', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: barColor }} />Saved</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 2, height: 12, background: 'var(--ink)' }} />Where you planned to be today</span>
          </div>
          {finishTxt && <div style={{ fontSize: 13, color: 'var(--ink2)', paddingTop: 8, borderTop: '1px solid var(--line)', textWrap: 'pretty' } as React.CSSProperties}>{finishTxt}</div>}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Where the saved amount comes from</div>
        {sources.map(sr => (
          <div key={sr.t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderTop: '1px solid var(--line)' }}>
            <Tile size={36} radius={12} bg="var(--surface2)" fg="var(--ink2)"><sr.Icon size={18} stroke={2} /></Tile>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, overflowWrap: 'anywhere' }}>{sr.t}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 2, textWrap: 'pretty' } as React.CSSProperties}>{sr.s}</div>
            </div>
            <div style={{ textAlign: 'right', flex: 'none' }}>
              <div style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 500 }}>{sr.v}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{sr.n}</div>
            </div>
          </div>
        ))}
        {L && (
          <Link href={`/transactions?type=savings&vehicle=${encodeURIComponent(L.vehicle)}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-ink)', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
            <IconArrowsExchange size={16} stroke={2} />See linked transactions
          </Link>
        )}
      </div>

      {L && (
        <div style={{ background: 'var(--surface2)', borderRadius: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>History</span></div>
          {L.rows.slice(0, 3).map(r => (
            <div key={r.tx.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--ink3)', width: 52, flex: 'none' }}>{format(parseISO(r.tx.date), 'dd MMM')}</span>
              <span style={{ flex: 1, minWidth: 0, color: 'var(--ink2)' }}>{r.value < 0 ? 'Savings withdrawal' : 'Savings contribution'}</span>
              <span style={{ fontFamily: MONO, fontWeight: 500, color: r.value < 0 ? 'var(--bad-ink)' : 'var(--good-ink)' }}>{r.value < 0 ? m(r.value, id) : `+${m(r.value, id)}`}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, position: 'sticky', bottom: 0, background: 'var(--surface)', padding: '12px 0 4px', marginBottom: -4 }}>
        <button onClick={onEdit} aria-label="Edit goal" style={{ width: 48, height: 48, flex: 'none', border: 0, borderRadius: 14, background: 'var(--surface2)', color: 'var(--ink)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><IconPencil size={20} stroke={2} /></button>
        <button onClick={onWithdraw} style={btn('soft', 48, 14, FONT(600, 14), { flex: 1 })}>Withdraw</button>
        <button onClick={onAdd} style={btn('brand', 48, 14, FONT(600, 14), { flex: 1.4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 })}><IconPlus size={18} stroke={2} />Add money</button>
      </div>
    </div>
  )
}

// ── Add money / Withdraw ────────────────────────────────────────────────────────

export function AddMoney({ g, initialMode, onClose, onConfirm }: {
  g: GoalView; initialMode: 'add' | 'withdraw'; onClose: () => void
  onConfirm: (after: number, reached: boolean, mode: 'add' | 'withdraw') => Promise<void>
}) {
  const { m, desktop } = useGoals()
  const [mode, setMode] = useState(initialMode)
  const [amount, setAmount] = useState('5000')
  const [busy, setBusy] = useState(false)
  const id = g.id, goal = g.goal
  const saved = goal.currentAmount, target = goal.targetAmount
  const amt = parseInt(digits(amount)) || 0
  const tgt = target || 1
  const after = mode === 'add' ? saved + amt : saved - amt
  const invalid = mode === 'withdraw' && amt > saved
  const oldP = Math.min(100, (saved / tgt) * 100), newP = Math.min(100, (Math.max(0, after) / tgt) * 100)
  const needChip: [number, string][] = g.need ? [[g.need, `${g.past ? 'Rest' : 'Monthly'} ${m(g.need, id)}`]] : []
  const chips: [number, string][] = mode === 'add'
    ? [[1000, '+₹1,000'], [5000, '+₹5,000'], [10000, '+₹10,000'], ...needChip]
    : [[1000, '₹1,000'], [5000, '₹5,000'], [saved, `All ${m(saved, id)}`]]
  const reachNow = mode === 'add' && target > 0 && after >= target && saved < target
  const left = Math.max(0, target - after)
  const impact = reachNow ? 'This reaches your goal' : invalid ? '—'
    : g.date && !g.past ? `${m(Math.ceil(left / Math.max(g.monthsLeft ?? 0, 1)), id)}/mo needed after this`
    : `${m(left, id)} to go after this`
  const disabled = invalid || !amt || busy
  const shown = amt ? inr(amt) : ''

  async function confirm() {
    if (disabled) return
    setBusy(true)
    try { await onConfirm(Math.max(0, after), reachNow, mode) } finally { setBusy(false) }
  }

  return (
    <div style={{ padding: pad(desktop), display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Tile size={44} radius={14} bg={g.status === 'reached' ? 'var(--good-soft)' : 'var(--brand-soft)'} fg={g.status === 'reached' ? 'var(--good-ink)' : 'var(--brand-ink)'}><GoalGlyph emoji={goal.emoji} size={22} /></Tile>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{goal.name}</div>
          <div style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--ink3)' }}>{m(saved, id)} saved of {m(target, id)}</div>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <Seg items={[{ k: 'add', label: 'Add money' }, { k: 'withdraw', label: 'Withdraw' }]} value={mode} onChange={setMode} height={40} font={FONT(600, 14)} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', padding: '8px 0' }}>
        <span style={{ fontFamily: MONO, fontSize: 32, color: 'var(--ink3)' }}>{mode === 'withdraw' ? '−' : ''}₹</span>
        <input
          value={shown} onChange={e => setAmount(digits(e.target.value))} inputMode="numeric" aria-label="Amount"
          onKeyDown={e => { if (e.key === 'Enter') confirm() }}
          style={{ width: Math.max(1, inr(amt).length) * 27 + 6, minWidth: 60, maxWidth: 260, border: 0, outline: 'none', background: 'transparent', color: 'var(--ink)', font: `500 44px ${MONO}`, letterSpacing: '-0.04em', textAlign: 'left', padding: 0 }}
        />
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {chips.map(([v, l]) => {
          const on = v === amt
          return <button key={l} onClick={() => setAmount(String(v))} style={{ height: 40, padding: '0 14px', border: 0, borderRadius: 999, background: on ? 'var(--brand)' : 'var(--surface2)', color: on ? '#fff' : 'var(--ink)', font: `500 13px ${MONO}`, cursor: 'pointer' }}>{l}</button>
        })}
      </div>
      <div style={{ background: 'var(--surface2)', borderRadius: 18, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--ink3)' }}>After this</span>
          <span style={{ fontFamily: MONO, color: 'var(--ink)' }}>{m(Math.max(0, after), id)} of {m(target, id)} · {Math.floor(newP)}%</span>
        </div>
        <div style={{ position: 'relative', height: 8, borderRadius: 99, background: 'var(--surface)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${mode === 'add' ? oldP : newP}%`, background: 'var(--brand)', borderRadius: 99 }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${mode === 'add' ? oldP : newP}%`, width: `${Math.abs(newP - oldP)}%`, background: mode === 'add' ? 'var(--brand2)' : 'var(--warn)', transition: 'width 300ms ease, left 300ms ease' }} />
        </div>
        <div style={{ fontSize: 13, color: reachNow ? 'var(--good-ink)' : 'var(--ink2)', fontWeight: 500 }}>{impact}</div>
      </div>
      {invalid && <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--bad-ink)' }}><IconAlertCircle size={16} stroke={2} />You can withdraw up to {m(saved, id)}.</div>}
      <button onClick={confirm} disabled={disabled} style={btn('brand', 52, 16, FONT(600, 15), { opacity: disabled ? 0.45 : 1 })}>
        {mode === 'add' ? 'Add' : 'Withdraw'} ₹{inr(amt)}
      </button>
    </div>
  )
}

// ── Goal reached ────────────────────────────────────────────────────────────────

const CF = ['var(--brand)', 'var(--warn)', 'var(--good)', 'var(--brand2)', 'var(--info)']

export function Celebrate({ g, onNewGoal, onClose }: { g: GoalView; onNewGoal: () => void; onClose: () => void }) {
  const { m, desktop } = useGoals()
  const on = useEntered(60)
  return (
    <div style={{ padding: desktop ? '28px 32px 28px' : '18px 20px 26px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'relative', width: 180, height: 150, display: 'grid', placeItems: 'center' }}>
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2, r = 58 + (i % 3) * 14
          return (
            <span key={i} style={{
              position: 'absolute', left: '50%', top: '50%', width: 6 + (i % 3) * 3, height: 6 + (i % 3) * 3, borderRadius: i % 2 ? '50%' : 2, background: CF[i % 5],
              opacity: on ? 1 : 0,
              transform: on ? `translate(-50%,-50%) translate(${Math.cos(a) * r}px, ${Math.sin(a) * r * 0.78}px) rotate(${i * 40}deg)` : 'translate(-50%,-50%) scale(.2)',
              transition: 'transform 900ms cubic-bezier(.16,1,.3,1), opacity 600ms ease',
            }} />
          )
        })}
        <div style={{ width: 96, height: 96, borderRadius: 32, background: 'var(--good-soft)', color: 'var(--good-ink)', display: 'grid', placeItems: 'center', transform: on ? 'scale(1)' : 'scale(.4)', transition: 'transform 600ms cubic-bezier(.34,1.56,.64,1)' }}>
          <IconTrophy size={48} stroke={2} />
        </div>
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 44, lineHeight: 1, letterSpacing: '-0.01em' }}>Goal reached!</div>
      <div style={{ fontSize: 15, color: 'var(--ink2)', maxWidth: 320, textWrap: 'pretty', overflowWrap: 'anywhere' } as React.CSSProperties}>
        You saved <span style={{ fontFamily: MONO, color: 'var(--ink)' }}>{m(g.goal.targetAmount, g.id)}</span> for {g.goal.name}.
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink3)' }}>It moves to Done. You can still add or withdraw.</div>
      <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 10 }}>
        <button onClick={onNewGoal} style={btn('soft', 48, 14, FONT(600, 14), { flex: 1 })}>Set a new goal</button>
        <button onClick={onClose} style={btn('brand', 48, 14, FONT(600, 14), { flex: 1 })}>Done</button>
      </div>
    </div>
  )
}

// ── New / edit goal ─────────────────────────────────────────────────────────────

export interface GoalDraft { icon: string | null; name: string; target: string; saved: string; date: string }

export function GoalForm({ editing, initial, onClose, onSave }: {
  editing: boolean; initial: GoalDraft; onClose: () => void; onSave: (d: GoalDraft) => Promise<void>
}) {
  const { desktop } = useGoals()
  const [f, setF] = useState(initial)
  const [busy, setBusy] = useState(false)
  const fT = parseInt(digits(f.target)) || 0, fS = parseInt(digits(f.saved)) || 0
  const today = startOfDay(new Date())
  let preview: string
  if (!fT) preview = 'Add a target amount to see what you need each month.'
  else if (f.date) {
    const dd = parseISO(f.date)
    if (dd < today) preview = 'That date has passed. Pick a date in the future.'
    else {
      const ml = Math.max(0, differenceInMonths(dd, today))
      preview = fS >= fT ? 'Already reached — it will go to Done.' : `₹${inr(Math.ceil((fT - fS) / Math.max(ml, 1)))}/mo needed to reach it by ${monthYear(dd)}.`
    }
  } else preview = `No date set. ₹${inr(Math.max(0, fT - fS))} to go, at your own pace.`
  const linkTxt = f.name
    ? `Saved so far also changes on its own when you log savings to a vehicle named “${f.name}”.`
    : 'Saved so far also changes on its own when you log savings to a vehicle with the same name as this goal.'
  const disabled = busy || !f.name.trim() || !fT

  async function save() {
    if (disabled) return
    setBusy(true)
    try { await onSave(f) } finally { setBusy(false) }
  }

  return (
    <div style={{ padding: pad(desktop), display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 19, letterSpacing: '-0.01em' }}>{editing ? 'Edit goal' : 'New goal'}</div>
        <CloseButton onClick={onClose} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={FIELD_LABEL}>Icon</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 6 }}>
          {ICON_LABELS.map(label => {
            const Icon = GOAL_GLYPHS[label], on = f.icon === label
            return (
              <button key={label} onClick={() => setF({ ...f, icon: label })} title={label} aria-label={label} aria-pressed={on}
                style={{ aspectRatio: '1', minHeight: 44, border: 0, borderRadius: 14, background: on ? 'var(--brand)' : 'var(--surface2)', color: on ? '#fff' : 'var(--ink2)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                <Icon size={21} stroke={2} />
              </button>
            )
          })}
        </div>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ ...FIELD_LABEL, display: 'flex', justifyContent: 'space-between' }}>Name<span style={{ fontFamily: MONO, fontWeight: 400, color: 'var(--ink3)' }}>{f.name.length}/60</span></span>
        <input className="gl-input" value={f.name} onChange={e => setF({ ...f, name: e.target.value.slice(0, 60) })} maxLength={60} placeholder="e.g. Goa trip" style={{ ...FIELD, font: FONT(500, 15) }} />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        <MoneyField label="Target amount" value={fT ? inr(fT) : ''} onChange={v => setF({ ...f, target: digits(v) })} />
        <MoneyField label="Saved so far" value={fS ? inr(fS) : ''} onChange={v => setF({ ...f, saved: digits(v) })} />
      </div>
      <div style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.5, marginTop: -8 }}>
        <IconLink size={15} stroke={2} style={{ flex: 'none', marginTop: 1 }} />
        <span style={{ textWrap: 'pretty', overflowWrap: 'anywhere' } as React.CSSProperties}>{linkTxt}</span>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={FIELD_LABEL}>Target date <span style={{ fontWeight: 400, color: 'var(--ink3)' }}>· optional</span></span>
        <input className="gl-input" type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} style={{ ...FIELD, font: `500 15px ${MONO}` }} />
      </label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', borderRadius: 16, background: 'var(--brand-soft)', color: 'var(--brand-ink)', fontSize: 13.5, fontWeight: 500 }}>
        <IconCalendarStats size={18} stroke={2} style={{ flex: 'none' }} />
        <span style={{ textWrap: 'pretty' } as React.CSSProperties}>{preview}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, position: 'sticky', bottom: 0, background: 'var(--surface)', padding: '8px 0 4px' }}>
        <button onClick={onClose} style={btn('soft', 50, 14, FONT(600, 14), { flex: 1 })}>Cancel</button>
        <button onClick={save} disabled={disabled} style={btn('brand', 50, 14, FONT(600, 15), { flex: 2, opacity: disabled ? 0.45 : 1 })}>{busy ? 'Saving…' : editing ? 'Update goal' : 'Create goal'}</button>
      </div>
    </div>
  )
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={FIELD_LABEL}>{label}</span>
      <div className="gl-field" style={{ display: 'flex', alignItems: 'center', height: 48, borderRadius: 14, background: 'var(--surface2)', padding: '0 14px', gap: 4 }}>
        <span style={{ fontFamily: MONO, color: 'var(--ink3)' }}>₹</span>
        <input value={value} onChange={e => onChange(e.target.value)} inputMode="numeric" style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', color: 'var(--ink)', font: `500 15px ${MONO}`, outline: 'none' }} />
      </div>
    </label>
  )
}

// ── New / edit project ──────────────────────────────────────────────────────────

export interface ProjectDraft { name: string; desc: string; budget: string; start: string; end: string; status: Project['status'] }

export function ProjectForm({ editing, initial, paidTxt, onClose, onSave }: {
  editing: boolean; initial: ProjectDraft; paidTxt: string; onClose: () => void; onSave: (d: ProjectDraft) => Promise<void>
}) {
  const { desktop } = useGoals()
  const [f, setF] = useState(initial)
  const [busy, setBusy] = useState(false)
  const pB = parseInt(digits(f.budget)) || 0
  const disabled = busy || !f.name.trim() || !pB

  async function save() {
    if (disabled) return
    setBusy(true)
    try { await onSave(f) } finally { setBusy(false) }
  }

  return (
    <div style={{ padding: pad(desktop), display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 19, letterSpacing: '-0.01em' }}>{editing ? 'Edit project' : 'New project'}</div>
        <CloseButton onClick={onClose} />
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={FIELD_LABEL}>Name</span>
        <input className="gl-input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. House construction" style={{ ...FIELD, font: FONT(500, 15) }} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={FIELD_LABEL}>Description</span>
        <textarea className="gl-input" value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} rows={3} placeholder="What's this budget for?" style={{ border: 0, borderRadius: 14, background: 'var(--surface2)', color: 'var(--ink)', padding: '12px 14px', font: "400 14px/1.5 'Plus Jakarta Sans',sans-serif", outline: 'none', resize: 'vertical' }} />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        <MoneyField label="Total budget" value={pB ? inr(pB) : ''} onChange={v => setF({ ...f, budget: digits(v) })} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={FIELD_LABEL}>Paid so far</span>
          <div style={{ display: 'flex', alignItems: 'center', height: 48, borderRadius: 14, background: 'transparent', boxShadow: 'inset 0 0 0 1px var(--line)', padding: '0 14px', gap: 6, color: 'var(--ink2)' }}>
            <IconLock size={16} stroke={2} /><span style={{ fontFamily: MONO, fontSize: 15 }}>{paidTxt}</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.5, marginTop: -6 }}>
        <IconInfoCircle size={15} stroke={2} style={{ flex: 'none', marginTop: 1 }} />
        <span style={{ textWrap: 'pretty' } as React.CSSProperties}>Paid is the total of the transactions linked to this project. To add a payment, log a transaction and link it here.</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={FIELD_LABEL}>Start date</span>
          <input className="gl-input" type="date" value={f.start} onChange={e => setF({ ...f, start: e.target.value })} style={{ ...FIELD, font: `500 14px ${MONO}` }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={FIELD_LABEL}>End date <span style={{ fontWeight: 400, color: 'var(--ink3)' }}>· optional</span></span>
          <input className="gl-input" type="date" value={f.end} onChange={e => setF({ ...f, end: e.target.value })} style={{ ...FIELD, font: `500 14px ${MONO}` }} />
        </label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={FIELD_LABEL}>Status</span>
        <Seg items={[{ k: 'active', label: 'Active' }, { k: 'paused', label: 'Paused' }, { k: 'completed', label: 'Completed' }]} value={f.status} onChange={k => setF({ ...f, status: k })} height={40} font={FONT(600, 13.5)} />
      </div>
      <div style={{ display: 'flex', gap: 8, position: 'sticky', bottom: 0, background: 'var(--surface)', padding: '8px 0 4px' }}>
        <button onClick={onClose} style={btn('soft', 50, 14, FONT(600, 14), { flex: 1 })}>Cancel</button>
        <button onClick={save} disabled={disabled} style={btn('brand', 50, 14, FONT(600, 15), { flex: 2, opacity: disabled ? 0.45 : 1 })}>{busy ? 'Saving…' : editing ? 'Save project' : 'Create project'}</button>
      </div>
    </div>
  )
}

// ── Delete ──────────────────────────────────────────────────────────────────────

export function DeleteConfirm({ title, body, btnLabel, onClose, onDelete }: {
  title: string; body: string; btnLabel: string; onClose: () => void; onDelete: () => Promise<void>
}) {
  const { desktop } = useGoals()
  const [busy, setBusy] = useState(false)
  async function run() {
    setBusy(true)
    try { await onDelete() } finally { setBusy(false) }
  }
  return (
    <div style={{ padding: pad(desktop), display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Tile size={52} radius={16} bg="var(--bad-soft)" fg="var(--bad-ink)"><IconTrash size={26} stroke={2} /></Tile>
      <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-0.01em' }}>{title}</div>
      <div style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.55, textWrap: 'pretty', overflowWrap: 'anywhere' } as React.CSSProperties}>{body}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={onClose} style={btn('soft', 50, 14, FONT(600, 14), { flex: 1 })}>Cancel</button>
        <button onClick={run} disabled={busy} style={btn('bad', 50, 14, FONT(600, 14), { flex: 1, opacity: busy ? 0.45 : 1 })}>{btnLabel}</button>
      </div>
    </div>
  )
}

// ── Phone action sheet for ⋮ ────────────────────────────────────────────────────

export function ActionSheet({ title, items, onClose }: { title: string; items: MenuItem[]; onClose: () => void }) {
  return (
    <div style={{ padding: '8px 12px 20px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 12px 12px', fontWeight: 600, fontSize: 15, color: 'var(--ink2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
      {items.map(mi => (
        <button key={mi.label} onClick={mi.onClick} style={{ width: '100%', height: 54, border: 0, borderRadius: 14, background: 'transparent', color: mi.danger ? 'var(--bad-ink)' : 'var(--ink)', font: FONT(500, 16), display: 'flex', alignItems: 'center', gap: 14, padding: '0 12px', cursor: 'pointer' }}>
          <mi.icon size={22} stroke={2} />{mi.label}
        </button>
      ))}
      <button onClick={onClose} style={btn('soft', 52, 14, FONT(600, 15), { marginTop: 8 })}>Cancel</button>
    </div>
  )
}

// ── New: goal or project ────────────────────────────────────────────────────────

export function NewMenu({ onGoal, onProject }: { onGoal: () => void; onProject: () => void }) {
  const { desktop } = useGoals()
  const row = (Icon: typeof IconTargetArrow, t: string, s: string, onClick: () => void) => (
    <button onClick={onClick} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 16, border: 0, borderRadius: 18, background: 'var(--surface2)', color: 'var(--ink)', cursor: 'pointer', textAlign: 'left' }}>
      <Tile size={44} radius={14} bg="var(--brand-soft)" fg="var(--brand-ink)"><Icon size={22} stroke={2} /></Tile>
      <div style={{ flex: 1 }}>
        <div style={{ font: FONT(600, 15) }}>{t}</div>
        <div style={{ font: FONT(400, 13), color: 'var(--ink3)' }}>{s}</div>
      </div>
      <IconChevronRight size={20} stroke={2} style={{ color: 'var(--ink3)' }} />
    </button>
  )
  return (
    <div style={{ padding: pad(desktop), display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 19 }}>What do you want to add?</div>
      {row(IconTargetArrow, 'Savings goal', "Money you're putting aside — trip, phone, home", onGoal)}
      {row(IconCrane, 'Project budget', 'A big one-off spend — construction, wedding', onProject)}
    </div>
  )
}

