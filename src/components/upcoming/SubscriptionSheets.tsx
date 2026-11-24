'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { Check, Link2, Pencil, RotateCcw, Search, Sparkles, Unlink } from 'lucide-react'
import CategoryPicker from '@/components/transactions/CategoryPicker'
import {
  CYCLE_LABEL, CYCLE_MONTHS, QUICK_PICKS, linkCandidates, linkedTxnIds, matchService, planLink, serviceById,
  type Charge, type Subscription,
} from '@/lib/subscriptions'
import type { BillingCycle, Transaction, UpcomingPayment } from '@/types'
import { SheetFrame, Switch, checkBox, chip } from './UpcomingSheets'
import SubTile from './SubTile'
import { addDays, catColor, catName, firstOfNextMonth, fullD, num, plainInr, plural, sh, wsh } from './upView'
import type { SubDraft } from './upActions'

type Money = (n: number, round?: boolean) => string

const fieldLabel: CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }
const input: CSSProperties = { height: 48, borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--bg)', padding: '0 14px', fontSize: 16, outline: 'none', width: '100%', boxSizing: 'border-box' }
const ghostBtn: CSSProperties = { height: 50, padding: '0 18px', borderRadius: 14, border: '1px solid var(--border-strong)', background: 'transparent', fontWeight: 500, cursor: 'pointer' }
const primaryBtn = (on: boolean): CSSProperties => ({ flex: 1, height: 50, borderRadius: 14, border: 0, background: on ? 'var(--brand)' : 'var(--surface-2)', color: on ? 'var(--on-brand)' : 'var(--text-4)', fontWeight: 600, fontSize: 15, cursor: on ? 'pointer' : 'not-allowed', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 12px' })
const cleanAmount = (v: string) => v.replace(/[^\d.,]/g, '')

// ── Status line ──────────────────────────────────────────────────────────────

export type SubTone = 'bad' | 'warn' | 'info' | 'muted' | 'plain'
export const toneInk: Record<SubTone, string> = { bad: 'var(--bad-ink)', warn: 'var(--warn-ink)', info: 'var(--info-ink)', muted: 'var(--text-4)', plain: 'var(--text-3)' }
export const toneSoft: Record<SubTone, string> = { bad: 'var(--bad-soft)', warn: 'var(--warn-soft)', info: 'var(--info-soft)', muted: 'var(--surface-2)', plain: 'var(--surface-2)' }

/** "Trial ended", "Trial ends in 3 days", "Renews tomorrow", "Renews Dec 4"… */
export function subStatus(s: Subscription): { text: string; tone: SubTone } {
  const st = s.status
  switch (st.kind) {
    case 'cancelled': return { text: `Cancelled ${sh(st.on)}`, tone: 'muted' }
    case 'trial-ended': return { text: st.days === 0 ? 'Trial ends today' : 'Trial ended', tone: 'bad' }
    case 'trial': return { text: st.days === 1 ? 'Trial ends tomorrow' : st.days <= 7 ? `Trial ends in ${st.days} days` : `Trial ends ${sh(s.nextDate)}`, tone: st.days <= 3 ? 'warn' : 'info' }
    case 'due': return { text: `Renewed ${sh(s.nextDate)} · not logged`, tone: 'warn' }
    case 'soon': return { text: st.days === 0 ? 'Renews today' : st.days === 1 ? 'Renews tomorrow' : `Renews in ${st.days} days`, tone: 'warn' }
    default: return { text: `Renews ${sh(s.nextDate)}`, tone: 'plain' }
  }
}

// ── Add / edit ───────────────────────────────────────────────────────────────

export const blankSubDraft = (today: string, pre?: Partial<SubDraft>): SubDraft => ({
  label: '', amount: '', cycle: 'monthly', trial: false, date: today, cat: 'Subscriptions', notes: '', ...pre,
})

export function SubscriptionFormSheet({ desktop, editing, initial, today, saving, pastCount = 0, onClose, onSave }: {
  desktop: boolean; editing: boolean; initial: SubDraft; today: string; saving: boolean
  pastCount?: number            // expenses found for a spotted subscription, offered for linking
  onClose: () => void; onSave: (f: SubDraft, linkPast: boolean) => void
}) {
  const [f, setF] = useState<SubDraft>(initial)
  const [linkPast, setLinkPast] = useState(true)
  const set = (p: Partial<SubDraft>) => setF(s => ({ ...s, ...p }))
  const amt = num(f.amount)
  const can = !!f.label.trim() && amt > 0 && !!f.date && !saving
  const svc = matchService(f.label)
  const perYear = amt > 0 ? amt * (12 / CYCLE_MONTHS[f.cycle]) : 0
  const echo = amt > 0 ? (f.cycle === 'yearly' ? `About ${plainInr(Math.round(amt / 12))} a month` : `${plainInr(Math.round(perYear))} a year`) : ''
  const dateChips: [string, string][] = f.trial
    ? [['In 7 days', addDays(today, 7)], ['In 14 days', addDays(today, 14)], ['In 30 days', addDays(today, 30)]]
    : [['Today', today], ['1st of next month', firstOfNextMonth(today)]]
  const picks = QUICK_PICKS.map(serviceById).filter((s): s is NonNullable<typeof s> => !!s)
  const cycles: [BillingCycle, string][] = [['monthly', 'Monthly'], ['quarterly', 'Every 3 months'], ['yearly', 'Yearly']]

  return (
    <SheetFrame
      desktop={desktop} onClose={onClose}
      title={editing ? 'Edit subscription' : 'New subscription'}
      eyebrow={editing ? undefined : 'Add to Subscriptions'}
      footer={<>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
        <button onClick={() => can && onSave(f, pastCount > 0 && linkPast)} disabled={!can} style={primaryBtn(can)}>{editing ? 'Save changes' : 'Add subscription'}</button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {!editing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={fieldLabel}>Popular</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {picks.map(p => {
                const sel = svc?.id === p.id
                return (
                  <button key={p.id} onClick={() => set({ label: p.name, cat: p.category })} style={{ height: 36, padding: '0 12px 0 6px', borderRadius: 99, ...chip(sel), display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                    <SubTile label={p.name} service={p} size={24} />{p.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={fieldLabel}>Name</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SubTile label={f.label || '?'} category={f.cat} size={48} />
            <input value={f.label} onChange={e => { const v = e.target.value; const m = matchService(v); set({ label: v, ...(m && !editing ? { cat: m.category } : {}) }) }} placeholder="e.g. Netflix, Gym, Mobile plan" style={input} />
          </div>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={fieldLabel}>{f.trial ? 'Price after the trial (₹)' : 'Price (₹)'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-strong)', borderRadius: 14, padding: '0 16px', height: 62, background: 'var(--bg)' }}>
            <span style={{ fontSize: 24, color: 'var(--text-3)', fontWeight: 500 }}>₹</span>
            <input inputMode="decimal" value={f.amount} onChange={e => set({ amount: cleanAmount(e.target.value) })} placeholder="0" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', fontSize: 28, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }} />
          </div>
          {echo && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{echo}</span>}
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={fieldLabel}>Billed</span>
          <div style={{ display: 'flex', padding: 4, borderRadius: 14, background: 'var(--surface-2)', gap: 4 }}>
            {cycles.map(([c, label]) => {
              const s = f.cycle === c
              return <button key={c} onClick={() => set({ cycle: c })} style={{ flex: 1, height: 40, borderRadius: 11, border: 0, background: s ? 'var(--surface)' : 'transparent', color: s ? 'var(--text)' : 'var(--text-3)', boxShadow: s ? '0 1px 3px rgba(0,0,0,.12)' : 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}</button>
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, border: '1px solid var(--border)' }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--warn-soft)', color: 'var(--warn-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Sparkles size={17} strokeWidth={2} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>Free trial</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', textWrap: 'pretty' } as CSSProperties}>{f.trial ? 'We’ll flag it in the days before the first charge, so you can cancel in time.' : 'Turn on if it’s free for now and charges later.'}</div>
          </div>
          <Switch on={f.trial} onClick={() => set({ trial: !f.trial, date: !f.trial ? addDays(today, 7) : f.date })} label="Free trial" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={fieldLabel}>{f.trial ? 'Trial ends on' : 'Next renewal'}</span>
          <input type="date" value={f.date} onChange={e => set({ date: e.target.value })} style={input} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {dateChips.map(([label, v]) => (
              <button key={label} onClick={() => set({ date: v })} style={{ height: 34, padding: '0 12px', borderRadius: 99, ...chip(f.date === v), fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{label}</button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{f.trial ? 'The first charge lands on this day.' : 'The day it charges your card or account.'}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={fieldLabel}>Category</span>
          <CategoryPicker value={f.cat} onChange={v => set({ cat: v })} type="expense" />
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={fieldLabel}>Notes (optional)</span>
          <input value={f.notes} onChange={e => set({ notes: e.target.value })} placeholder="Card or account it’s charged to" style={input} />
        </label>

        {pastCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, border: '1px solid var(--border)' }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--brand-soft)', color: 'var(--brand-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Link2 size={17} strokeWidth={2} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>Link the {plural(pastCount, 'past charge')} found</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', textWrap: 'pretty' } as CSSProperties}>They show in this subscription’s history. Transactions stay as they are.</div>
            </div>
            <Switch on={linkPast} onClick={() => setLinkPast(v => !v)} label="Link past charges" />
          </div>
        )}
      </div>
    </SheetFrame>
  )
}

// ── Detail ───────────────────────────────────────────────────────────────────

export function SubscriptionSheet({ desktop, sub, money, onClose, onEdit, onPay, onAddNext, onCancel, onRestore, onLink, onUnlink }: {
  desktop: boolean; sub: Subscription; money: Money
  onClose: () => void; onEdit: () => void; onPay: () => void; onAddNext: () => void; onCancel: () => void; onRestore: () => void
  onLink: () => void; onUnlink: (c: Charge) => void
}) {
  const [confirm, setConfirm] = useState(false)
  const [unlinkId, setUnlinkId] = useState<string | null>(null)
  const [allCharges, setAllCharges] = useState(false)
  const { head, status } = sub
  const cancelled = status.kind === 'cancelled'
  const st = subStatus(sub)
  const per = CYCLE_LABEL[sub.cycle].toLowerCase()

  let banner: { tone: SubTone; title: string; body: string } | null = null
  if (status.kind === 'trial') banner = { tone: status.days <= 3 ? 'warn' : 'info', title: st.text, body: `${money(head.amount)} will be charged on ${fullD(sub.nextDate)}, then ${per}. Cancel with the service before then if you don’t want it.` }
  else if (status.kind === 'trial-ended') banner = { tone: 'bad', title: status.days === 0 ? 'Trial ends today' : `Trial ended ${sh(sub.nextDate)}`, body: `${money(head.amount)} is charged ${per} from now on. Keep it and log the charge, or cancel it if you meant to stop.` }
  else if (status.kind === 'due') banner = { tone: 'warn', title: `Renewed ${wsh(sub.nextDate)}`, body: `Log the ${money(sub.headRemaining)} charge so your totals stay right.` }
  else if (status.kind === 'cancelled') banner = { tone: 'muted', title: `Cancelled ${fullD(status.on)}`, body: `Saving ${money(sub.monthly, true)} a month, ${money(sub.yearly, true)} a year.` }

  const metas: { k: string; v: string; sub?: string; dot?: string }[] = []
  if (!cancelled) metas.push({ k: status.kind === 'trial' || status.kind === 'trial-ended' ? 'First charge' : 'Next charge', v: fullD(sub.nextDate), sub: st.text })
  metas.push({ k: 'Billed', v: `${CYCLE_LABEL[sub.cycle]} · ${money(head.amount)}`, sub: sub.cycle === 'yearly' ? `About ${money(sub.monthly, true)} a month` : `${money(sub.yearly, true)} a year` })
  metas.push({ k: 'Category', v: catName(head.category), dot: catColor(head.category) })
  metas.push({ k: 'Paid so far', v: money(sub.paidTotal, true), sub: sub.charges.length ? `${plural(sub.charges.length, 'charge')} since ${sh(sub.since)}` : 'No charges logged yet' })
  if (head.notes) metas.push({ k: 'Notes', v: head.notes })
  const charges = allCharges ? sub.charges : sub.charges.slice(0, 5)

  const primary = cancelled
    ? { label: 'Restore subscription', on: onRestore }
    : !sub.headSettled
      ? { label: status.kind === 'trial' ? `Log ${money(sub.headRemaining)} charge early` : `Log ${money(sub.headRemaining)} charge`, on: onPay }
      : !head.nextUpcomingId ? { label: `Add ${sh(sub.nextDate)} renewal`, on: onAddNext } : null

  return (
    <SheetFrame
      desktop={desktop} side title={head.label} eyebrow="Subscription" onClose={onClose}
      footer={<>
        {!cancelled && <button onClick={onEdit} aria-label="Edit subscription" style={{ ...ghostBtn, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 7 }}><Pencil size={16} strokeWidth={2} />Edit</button>}
        {primary
          ? <button onClick={primary.on} style={{ ...primaryBtn(true), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>{cancelled && <RotateCcw size={16} strokeWidth={2} />}{primary.label}</button>
          : <button onClick={onClose} style={{ ...ghostBtn, flex: 1 }}>Done</button>}
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <SubTile label={head.label} category={head.category} size={58} muted={cancelled} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
              {money(head.amount)}<span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-3)', letterSpacing: 0 }}> {sub.cycle === 'monthly' ? 'a month' : sub.cycle === 'yearly' ? 'a year' : 'every 3 months'}</span>
            </div>
            <div style={{ marginTop: 4, fontSize: 13, fontWeight: 500, color: toneInk[st.tone] }}>{st.text}</div>
          </div>
        </div>

        {banner && (
          <div style={{ padding: '12px 14px', borderRadius: 14, background: toneSoft[banner.tone], color: banner.tone === 'muted' ? 'var(--text-2)' : toneInk[banner.tone], fontSize: 13, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontWeight: 600 }}>{banner.title}</div>
            <div style={{ textWrap: 'pretty' } as CSSProperties}>{banner.body}</div>
          </div>
        )}

        <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          {metas.map((m, i) => (
            <div key={m.k} style={{ display: 'flex', gap: 12, padding: '12px 14px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
              <span style={{ width: 92, flexShrink: 0, color: 'var(--text-3)', fontSize: 13, paddingTop: 1 }}>{m.k}</span>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 500, overflowWrap: 'anywhere' }}>
                  {m.dot && <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: m.dot }} />}{m.v}
                </span>
                {m.sub && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{m.sub}</span>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 6 }}>
            <span style={{ fontWeight: 600 }}>Charges</span>
            <span style={{ color: 'var(--text-3)', fontSize: 13 }}>{sub.charges.length ? `· ${sub.charges.length}` : ''}</span>
            <span style={{ flex: 1 }} />
            <button onClick={onLink} style={{ height: 34, padding: '0 10px', borderRadius: 10, border: 0, background: 'var(--brand-soft)', color: 'var(--brand-ink)', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Link2 size={14} strokeWidth={2.2} />Link past charges</button>
          </div>
          {sub.charges.length === 0 && <div style={{ padding: 14, borderRadius: 12, background: 'var(--surface-2)', color: 'var(--text-3)', fontSize: 13 }}>Nothing logged yet. Link expenses you’ve already logged, or log each charge when it lands.</div>}
          {charges.map(c => (
            <div key={c.id} style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: c.txnId ? '6px 0' : '10px 0' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--text-2)' }}>{wsh(c.date)}</div>
                  {c.txnId && <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--brand-ink)' }}><Link2 size={12} strokeWidth={2} />In Transactions</div>}
                </div>
                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{money(c.amount)}</span>
                {c.txnId && <button onClick={() => setUnlinkId(unlinkId === c.id ? null : c.id)} aria-label="Unlink this charge" title="Unlink" className="up-hov" style={{ width: 36, height: 36, borderRadius: 10, border: 0, background: 'transparent', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><Unlink size={15} strokeWidth={2} /></button>}
              </div>
              {unlinkId === c.id && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 10, borderRadius: 12, background: 'var(--surface-2)', fontSize: 13 }}>
                  <span style={{ flex: 1, color: 'var(--text-2)', textWrap: 'pretty' } as CSSProperties}>Take this charge off {head.label}? The expense stays in Transactions.</span>
                  <button onClick={() => setUnlinkId(null)} style={{ height: 34, padding: '0 10px', borderRadius: 9, border: 0, background: 'var(--surface)', fontWeight: 500, cursor: 'pointer' }}>Keep</button>
                  <button onClick={() => { setUnlinkId(null); onUnlink(c) }} style={{ height: 34, padding: '0 10px', borderRadius: 9, border: 0, background: 'var(--text)', color: 'var(--surface)', fontWeight: 600, cursor: 'pointer' }}>Unlink</button>
                </div>
              )}
            </div>
          ))}
          {!allCharges && sub.charges.length > 5 && <button onClick={() => setAllCharges(true)} style={{ height: 42, border: 0, borderTop: '1px solid var(--border)', background: 'transparent', color: 'var(--brand-ink)', fontWeight: 600, cursor: 'pointer' }}>Show all {sub.charges.length}</button>}
        </div>

        {!cancelled && !confirm && (
          <button onClick={() => setConfirm(true)} style={{ height: 46, borderRadius: 14, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--bad-ink)', fontWeight: 600, cursor: 'pointer' }}>
            {status.kind === 'trial' || status.kind === 'trial-ended' ? 'I cancelled the trial' : 'I cancelled this subscription'}
          </button>
        )}
        {confirm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 14, background: 'var(--bad-soft)', color: 'var(--bad-ink)', fontSize: 13 }}>
            <div>
              <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>Mark {head.label} as cancelled?</div>
              <div style={{ marginTop: 2, textWrap: 'pretty' } as CSSProperties}>
                {sub.headPaid > 0
                  ? 'No more renewals are added. Charges already logged stay.'
                  : `The ${money(head.amount)} charge on ${sh(head.dueDate)} comes off Upcoming and no more renewals are added.${sub.charges.length ? ' Charges already logged stay.' : ''}`}
                {' '}This only updates your records here; cancel with the service too.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirm(false)} style={{ height: 38, padding: '0 14px', borderRadius: 10, border: 0, background: 'var(--surface)', fontWeight: 500, cursor: 'pointer' }}>Keep it</button>
              <button onClick={onCancel} style={{ height: 38, padding: '0 14px', borderRadius: 10, border: 0, background: 'var(--bad)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Mark cancelled</button>
            </div>
          </div>
        )}
      </div>
    </SheetFrame>
  )
}

// ── Link past charges ────────────────────────────────────────────────────────

export function LinkTransactionsSheet({ desktop, sub, transactions, payments, money, saving, onClose, onLink }: {
  desktop: boolean; sub: Subscription; transactions: Transaction[]; payments: UpcomingPayment[]; money: Money; saving: boolean
  onClose: () => void; onLink: (txns: Transaction[]) => void
}) {
  const { head } = sub
  const cands = useMemo(() => linkCandidates(sub, transactions, payments), [sub, transactions, payments])
  const strong = cands.filter(c => c.strong).map(c => c.txn)
  const weak = cands.filter(c => !c.strong).map(c => c.txn)
  const [sel, setSel] = useState<Set<string>>(() => new Set(strong.map(t => t.id)))
  const [q, setQ] = useState('')
  const ql = q.trim().toLowerCase()

  // Searching covers every unlinked expense, not just the suggestions
  const found = useMemo(() => {
    if (!ql) return []
    const taken = linkedTxnIds(payments)
    const cap = sub.status.kind === 'cancelled' ? head.dueDate : '9999-12-31'
    return transactions.filter(t => t.type === 'expense' && t.amount > 0 && !taken.has(t.id) && t.date <= cap
      && `${t.notes ?? ''} ${catName(t.category)} ${t.amount}`.toLowerCase().includes(ql)).slice(0, 80)
  }, [ql, transactions, payments, sub.status.kind, head.dueDate])

  const byId = useMemo(() => new Map(transactions.map(t => [t.id, t])), [transactions])
  const chosen = Array.from(sel).map(id => byId.get(id)).filter((t): t is Transaction => !!t)
  const total = chosen.reduce((a, t) => a + t.amount, 0)
  const plan = planLink(sub, chosen, payments)
  const toggle = (id: string) => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const can = chosen.length > 0 && !saving

  const row = (t: Transaction) => {
    const on = sel.has(t.id)
    return (
      <button key={t.id} onClick={() => toggle(t.id)} className="up-hov" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', border: 0, borderTop: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}>
        <span style={checkBox(on, 20)}>{on && <Check size={13} strokeWidth={3} />}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.notes?.trim() || catName(t.category)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)' }}>
            <span>{wsh(t.date)}</span><span style={{ color: 'var(--text-4)' }}>·</span>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: catColor(t.category), flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{catName(t.category)}</span>
          </div>
        </div>
        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{money(t.amount)}</span>
      </button>
    )
  }
  const group = (title: string, xs: Transaction[], extra?: JSX.Element) => xs.length > 0 && (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 0 6px' }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
        <span style={{ color: 'var(--text-3)', fontSize: 13 }}>{xs.length}</span>
        <span style={{ flex: 1 }} />{extra}
      </div>
      {xs.map(row)}
    </div>
  )
  const allStrong = strong.length > 0 && strong.every(t => sel.has(t.id))
  const selectAll = strong.length > 1 && (
    <button onClick={() => setSel(s => { const n = new Set(s); strong.forEach(t => (allStrong ? n.delete(t.id) : n.add(t.id))); return n })} style={{ border: 0, background: 'transparent', color: 'var(--brand-ink)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: '4px 0' }}>{allStrong ? 'Clear' : 'Select all'}</button>
  )

  let note = ''
  if (plan.attach.length) {
    const a = plan.attach.map(x => sh(x.item.dueDate))
    note = `${plural(plan.attach.length, 'pays', 'pay')} the ${a.join(', ')} renewal${a.length > 1 ? 's' : ''} already in Upcoming${plan.create.length ? `; ${plural(plan.create.length, 'becomes a past charge', 'become past charges')}` : ''}.`
  }

  return (
    <SheetFrame
      desktop={desktop} side title="Link past charges" eyebrow={head.label} onClose={onClose}
      footer={<>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
        <button onClick={() => can && onLink(chosen)} disabled={!can} style={primaryBtn(can)}>{chosen.length ? `Link ${plural(chosen.length, 'charge')} · ${money(total, true)}` : 'Pick charges to link'}</button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-3)', textWrap: 'pretty' } as CSSProperties}>
          Pick the expenses that were charges for {head.label}. They’re added to its history; the transactions and your spending totals don’t change.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 12px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--bg)' }}>
          <Search size={17} strokeWidth={2} style={{ flexShrink: 0, color: 'var(--text-3)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search all expenses: note, category or amount" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', fontSize: 16 }} />
        </div>
        {ql ? (
          found.length ? group('Matching expenses', found) : <div style={{ padding: 14, borderRadius: 12, background: 'var(--surface-2)', color: 'var(--text-3)', fontSize: 13 }}>No unlinked expenses match “{q.trim()}”.</div>
        ) : (
          <>
            {group(`Mentions ${head.label}`, strong, selectAll || undefined)}
            {group(`About ${money(head.amount)} in ${catName(head.category)}`, weak)}
            {cands.length === 0 && <div style={{ padding: 14, borderRadius: 12, background: 'var(--surface-2)', color: 'var(--text-3)', fontSize: 13, textWrap: 'pretty' } as CSSProperties}>No expenses mention {head.label} or match its price. Search above to find them by note, category or amount.</div>}
          </>
        )}
        {note && <div style={{ fontSize: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--info-soft)', color: 'var(--info-ink)' }}>Of these, {note}</div>}
      </div>
    </SheetFrame>
  )
}
