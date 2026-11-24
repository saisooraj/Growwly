'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowLeftRight, ArrowUp, Check, Link2, Lock, Pencil, Repeat, Shield, Trash, X } from 'lucide-react'
import CategoryPicker from '@/components/transactions/CategoryPicker'
import type { Project, UpcomingExpense, UpcomingPayment } from '@/types'
import {
  RECURRING_MODE, catColor, catName, dueText, endOfMonth, firstOfNextMonth, fullD, monthName, nextMonth,
  num, plainInr, r2, sh, words, wsh, type Derived,
} from './upView'
import { nextDueOf, type NewPayment } from './upActions'
import { CYCLE_LABEL, cycleOf } from '@/lib/subscriptions'

type Money = (n: number, round?: boolean) => string

// ── Shared bits ──────────────────────────────────────────────────────────────

export const chip = (sel: boolean) => ({
  background: sel ? 'var(--brand-soft)' : 'transparent',
  border: `1px solid ${sel ? 'var(--brand)' : 'var(--border-strong)'}`,
  color: sel ? 'var(--brand-ink)' : 'var(--text-2)',
})

export function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} aria-pressed={on} style={{ width: 46, height: 28, borderRadius: 99, border: 0, padding: 3, background: on ? 'var(--brand)' : 'var(--border-strong)', display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', cursor: 'pointer', flexShrink: 0, transition: 'background .15s' }}>
      <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
    </button>
  )
}

const fieldLabel: CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }
const input: CSSProperties = { height: 48, borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--bg)', padding: '0 14px', fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box' }
const bigAmountBox: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-strong)', borderRadius: 14, padding: '0 16px', height: 62, background: 'var(--bg)' }
const bigAmountInput: CSSProperties = { flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', fontSize: 28, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }
const ghostBtn: CSSProperties = { height: 50, padding: '0 18px', borderRadius: 14, border: '1px solid var(--border-strong)', background: 'transparent', fontWeight: 500, cursor: 'pointer' }
const primaryBtn = (on: boolean, h = 50, fs = 15): CSSProperties => ({ flex: 1, height: h, borderRadius: 14, border: 0, background: on ? 'var(--brand)' : 'var(--surface-2)', color: on ? 'var(--on-brand)' : 'var(--text-4)', fontWeight: 600, fontSize: fs, cursor: on ? 'pointer' : 'not-allowed', fontVariantNumeric: 'tabular-nums' })
const cleanAmount = (v: string) => v.replace(/[^\d.,]/g, '')

// ── Frame ────────────────────────────────────────────────────────────────────

export function SheetFrame({ desktop, side, title, eyebrow, onClose, footer, children }: {
  desktop: boolean; side?: boolean; title: string; eyebrow?: string; onClose: () => void; footer: ReactNode; children: ReactNode
}) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const panel: CSSProperties = !desktop
    ? { left: 0, right: 0, bottom: 0, maxHeight: '90%', borderRadius: '26px 26px 0 0' }
    : side
      ? { top: 12, right: 12, bottom: 12, width: 440, borderRadius: 20 }
      : { inset: 0, margin: 'auto', width: 520, height: 'fit-content', maxHeight: '88%', borderRadius: 20 }
  const hpad = desktop ? '20px 22px 12px' : '10px 18px 12px'
  const bpad = desktop ? '4px 22px 22px' : '4px 18px 18px'
  const fpad = desktop ? '14px 22px' : '12px 16px max(30px, env(safe-area-inset-bottom, 0px))'

  return (
    <div className="up" style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--scrim)' }} />
      <div role="dialog" aria-modal="true" aria-label={title} className="up-sheet" style={{ position: 'absolute', ...panel, background: 'var(--surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 30px 80px -20px rgba(0,0,0,.45)' }}>
        {!desktop && <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}><span style={{ width: 38, height: 5, borderRadius: 99, background: 'var(--border-strong)' }} /></div>}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: hpad }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {eyebrow && <div style={{ fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{eyebrow}</div>}
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ width: 40, height: 40, borderRadius: 12, border: 0, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><X size={18} strokeWidth={2} /></button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: bpad }}>{children}</div>
        <div style={{ display: 'flex', gap: 10, padding: fpad, borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>{footer}</div>
      </div>
    </div>
  )
}

// ── Item detail ──────────────────────────────────────────────────────────────

export function DetailSheet({ desktop, x, money, masked, projects, nextItem, onClose, onEdit, onDelete, onPay, onSettle, onAddNext, onEditPay, onDeletePay }: {
  desktop: boolean; x: Derived; money: Money; masked: boolean; projects: Project[]; nextItem?: UpcomingExpense
  onClose: () => void; onEdit: () => void; onDelete: () => void; onPay: () => void; onSettle: () => void; onAddNext: () => void
  onEditPay: (p: UpcomingPayment) => void; onDeletePay: (p: UpcomingPayment) => void
}) {
  const [confirm, setConfirm] = useState<string | null>(null)
  const [histAll, setHistAll] = useState(false)
  const { it, paid, remaining, d, inc, settled, ps } = x
  const overdue = !inc && d < 0 && !settled, soon = !inc && d >= 0 && d <= 7 && !settled, tiny = remaining > 0 && remaining < 1
  const pct = it.amount > 0 ? Math.min(100, Math.round(paid / it.amount * 100)) : 100

  let status: string, stBg: string, stInk: string
  if (settled) { status = inc ? 'Received' : 'Settled'; stBg = 'var(--good-soft)'; stInk = 'var(--good-ink)' }
  else if (overdue) { status = 'Overdue'; stBg = 'var(--bad-soft)'; stInk = 'var(--bad-ink)' }
  else if (soon) { status = 'Due soon'; stBg = 'var(--warn-soft)'; stInk = 'var(--warn-ink)' }
  else if (paid > 0) { status = `${pct}% ${inc ? 'received' : 'paid'}`; stBg = 'var(--info-soft)'; stInk = 'var(--info-ink)' }
  else if (inc) { status = 'Expected'; stBg = 'var(--good-soft)'; stInk = 'var(--good-ink)' }
  else { status = 'Planned'; stBg = 'var(--surface-2)'; stInk = 'var(--text-2)' }

  const dueV = settled ? `${inc ? 'Received' : 'Paid'} ${sh(x.last ?? it.dueDate)}` : dueText(x, it.dueDate, false)
  const nxDate = nextDueOf(it), nxM = monthName(nxDate)
  const cyc = it.isSubscription ? CYCLE_LABEL[cycleOf(it)] : 'Monthly'
  const metas: { k: string; v: string; sub?: string; color?: string; dot?: string }[] = [
    { k: inc ? 'Expected' : 'Due', v: dueV, sub: settled ? `Was due ${fullD(it.dueDate)}` : fullD(it.dueDate), color: overdue ? 'var(--bad-ink)' : soon ? 'var(--warn-ink)' : undefined },
    { k: 'Category', v: catName(it.category), dot: catColor(it.category) },
  ]
  if (it.projectId) metas.push({ k: 'Project', v: projects.find(p => p.id === it.projectId)?.name ?? 'Project' })
  if (it.isRecurring) metas.push({
    k: 'Repeats',
    v: nextItem ? `${cyc} · Next added for ${sh(nextItem.dueDate)}` : `${cyc} · Next: ${sh(nxDate)}`,
    sub: it.isSubscription ? 'A subscription: the next renewal is added once this one is paid.'
      : RECURRING_MODE === 'auto' ? `${nxM}’s item is added automatically once this one is settled.` : `When this is settled, we’ll offer to add ${nxM}’s.`,
  })
  if (it.notes) metas.push({ k: 'Notes', v: it.notes })

  const shown = histAll ? ps : ps.slice(0, 4)
  const over = r2(paid - it.amount)
  const wordsTxt = words(it.amount)
  const cta = settled ? (inc ? 'Log another receipt' : 'Log another payment') : tiny ? 'Settle (less than ₹1 left)' : `${inc ? 'Receive' : 'Pay'} ${money(remaining)}`
  const showRecurPrompt = settled && !!it.isRecurring && !it.nextUpcomingId && RECURRING_MODE === 'prompt'
  const delBtn: CSSProperties = { height: 38, padding: '0 14px', borderRadius: 10, border: 0, fontWeight: 500, cursor: 'pointer' }

  return (
    <SheetFrame
      desktop={desktop} side title="Item details" eyebrow={inc ? 'Expected income' : 'Upcoming bill'} onClose={onClose}
      footer={<>
        <button onClick={onEdit} aria-label="Edit item" style={{ height: 50, padding: '0 16px', borderRadius: 14, border: '1px solid var(--border-strong)', background: 'transparent', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}><Pencil size={16} strokeWidth={2} />Edit</button>
        <button onClick={() => setConfirm('item')} aria-label="Delete item" style={{ width: 50, height: 50, borderRadius: 14, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--bad-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><Trash size={17} strokeWidth={2} /></button>
        <button onClick={tiny ? onSettle : onPay} style={{ flex: 1, height: 50, borderRadius: 14, border: 0, background: settled ? 'var(--surface-2)' : 'var(--brand)', color: settled ? 'var(--text)' : 'var(--on-brand)', fontWeight: 600, fontSize: 15, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 12px' }}>{cta}</button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: stBg, color: stInk }}>{status}</span>
            {it.isRecurring && <span style={{ fontSize: 12, fontWeight: 500, padding: '3px 9px', borderRadius: 99, background: 'var(--surface-2)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 5 }}><Repeat size={12} strokeWidth={2} />{cyc}</span>}
            <span style={{ fontSize: 12, fontWeight: 500, padding: '3px 9px', borderRadius: 99, background: 'var(--surface-2)', color: 'var(--text-2)' }}>{inc ? 'Income' : 'Expense'}</span>
          </div>
          <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em', textWrap: 'pretty', overflowWrap: 'anywhere', lineHeight: 1.3 } as CSSProperties}>{it.label}</div>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, overflowWrap: 'anywhere' }}>{(inc ? '+' : '') + money(it.amount)}</div>
          {!masked && wordsTxt && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{wordsTxt}</div>}
          {paid > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: settled || inc ? 'var(--good)' : 'var(--brand)', borderRadius: 99 }} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: 'var(--text-2)' }}>{money(paid)}{inc ? ' received · ' : ' paid · '}{tiny ? 'less than ₹1' : money(remaining)}{inc ? ' pending' : ' left'}</span>
                <span style={{ color: 'var(--text-3)' }}>{pct}% {inc ? 'received' : 'paid'}</span>
              </div>
            </div>
          )}
          {over > 0 && <div style={{ fontSize: 13, padding: '10px 12px', borderRadius: 12, background: 'var(--info-soft)', color: 'var(--info-ink)' }}>{inc ? 'Received' : 'Paid'} {money(over)} more than planned. That’s fine; it stays on record as overpaid.</div>}
          {tiny && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '10px 10px 10px 12px', borderRadius: 12, background: 'var(--warn-soft)', color: 'var(--warn-ink)' }}>
              <span style={{ flex: 1 }}>Less than ₹1 left, probably paise from an older entry. Settle it to close this item.</span>
              <button onClick={onSettle} style={{ height: 36, padding: '0 12px', borderRadius: 10, border: 0, background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>Settle</button>
            </div>
          )}
        </div>

        {showRecurPrompt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px 12px 14px', borderRadius: 14, background: 'var(--brand-soft)', color: 'var(--brand-ink)' }}>
            <Repeat size={18} strokeWidth={2} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 13 }}><div style={{ fontWeight: 600 }}>This repeats monthly</div><div>Add {nxM}’s, due {sh(nxDate)}?</div></div>
            <button onClick={onAddNext} style={{ height: 38, padding: '0 12px', borderRadius: 10, border: 0, background: 'var(--brand)', color: 'var(--on-brand)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Add {nxM}’s</button>
          </div>
        )}

        <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          {metas.map((m, i) => (
            <div key={m.k} style={{ display: 'flex', gap: 12, padding: '12px 14px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
              <span style={{ width: 78, flexShrink: 0, color: 'var(--text-3)', fontSize: 13, paddingTop: 1 }}>{m.k}</span>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: m.color ?? 'var(--text)', fontWeight: 500, overflowWrap: 'anywhere' }}>
                  {m.dot && <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: m.dot }} />}{m.v}
                </span>
                {m.sub && <span style={{ fontSize: 12, color: 'var(--text-3)', textWrap: 'pretty' } as CSSProperties}>{m.sub}</span>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingBottom: 6 }}>
            <span style={{ fontWeight: 600 }}>{inc ? 'Receipts' : 'Payments'}</span>
            <span style={{ color: 'var(--text-3)', fontSize: 13 }}>{ps.length ? `· ${ps.length}` : ''}</span>
            <span style={{ flex: 1 }} /><span style={{ fontSize: 12, color: 'var(--text-3)' }}>Newest first</span>
          </div>
          {ps.length === 0 && <div style={{ padding: 14, borderRadius: 12, background: 'var(--surface-2)', color: 'var(--text-3)', fontSize: 13 }}>{inc ? 'Nothing received yet. Log part or all of it when it arrives.' : 'No payments yet. Log part or all of it when you pay.'}</div>}
          {shown.map(p => {
            const ef = p.efAmount ?? 0, linked = !!p.linkedTransactionId
            return (
              <div key={p.id} style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}><span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{money(p.amount)}</span><span style={{ color: 'var(--text-3)', fontSize: 13 }}>{wsh(p.date)}</span></div>
                    {(p.notes || linked || ef > 0) && (
                      <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-3)', alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                        {linked && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--brand-ink)' }}><Link2 size={12} strokeWidth={2} />In Transactions</span>}
                        {ef > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={12} strokeWidth={2} />{money(ef)} from Emergency Fund</span>}
                        <span>{p.notes}</span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => onEditPay(p)} aria-label="Edit payment" className="up-hov" style={{ width: 40, height: 40, borderRadius: 10, border: 0, background: 'transparent', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Pencil size={16} strokeWidth={2} /></button>
                  <button onClick={() => setConfirm(`pay:${p.id}`)} aria-label="Delete payment" className="up-hov-bad" style={{ width: 40, height: 40, borderRadius: 10, border: 0, background: 'transparent', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Trash size={16} strokeWidth={2} /></button>
                </div>
                {confirm === `pay:${p.id}` && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, marginBottom: 10, borderRadius: 12, background: 'var(--bad-soft)', color: 'var(--bad-ink)', fontSize: 13 }}>
                    <div><div style={{ fontWeight: 600 }}>Remove this payment entry?</div>{linked && <div style={{ marginTop: 2 }}>The {money(p.amount)} {inc ? 'income' : 'expense'} in Transactions stays as is.</div>}</div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => setConfirm(null)} style={{ ...delBtn, height: 36, background: 'var(--surface)' }}>Keep</button>
                      <button onClick={() => { setConfirm(null); onDeletePay(p) }} style={{ ...delBtn, height: 36, background: 'var(--bad)', color: '#fff', fontWeight: 600 }}>Remove</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {!histAll && ps.length > 4 && <button onClick={() => setHistAll(true)} style={{ height: 42, border: 0, borderTop: '1px solid var(--border)', background: 'transparent', color: 'var(--brand-ink)', fontWeight: 600, cursor: 'pointer' }}>Show all {ps.length} {inc ? 'receipts' : 'payments'}</button>}
        </div>

        {confirm === 'item' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 14, background: 'var(--bad-soft)', color: 'var(--bad-ink)', fontSize: 13 }}>
            <div>
              <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>Delete &quot;{it.label}&quot;?</div>
              <div style={{ marginTop: 2 }}>{ps.length ? `Its ${ps.length} ${inc ? 'receipt' : 'payment'}${ps.length > 1 ? 's go' : ' goes'} too. Linked entries in Transactions stay.` : 'This can’t be undone.'}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirm(null)} style={{ ...delBtn, background: 'var(--surface)' }}>Cancel</button>
              <button onClick={onDelete} style={{ ...delBtn, background: 'var(--bad)', color: '#fff', fontWeight: 600 }}>Delete item</button>
            </div>
          </div>
        )}
      </div>
    </SheetFrame>
  )
}

// ── Add / edit item ──────────────────────────────────────────────────────────

export interface ItemDraft {
  flow: 'expense' | 'income'
  label: string
  amount: string
  date: string
  cat: string
  project: string | null
  notes: string
  recurring: boolean
}

export function ItemFormSheet({ desktop, editing, initial, today, projects, saving, onClose, onSave }: {
  desktop: boolean; editing: boolean; initial: ItemDraft; today: string; projects: Project[]; saving: boolean
  onClose: () => void; onSave: (f: ItemDraft) => void
}) {
  const [f, setF] = useState<ItemDraft>(initial)
  const set = (p: Partial<ItemDraft>) => setF(s => ({ ...s, ...p }))
  const isExp = f.flow === 'expense', amt = num(f.amount)
  const can = !!f.label.trim() && amt > 0 && !saving
  const nm = monthName(nextMonth(f.date || today))
  const echo = amt > 0 ? `${words(amt) ? `${words(amt)} · ` : ''}${plainInr(amt)}` : ''
  const dateChips: [string, string][] = [['1st of next month', firstOfNextMonth(today)], ['End of this month', endOfMonth(today)], ['Today', today]]
  const recurHelp = f.recurring
    ? RECURRING_MODE === 'auto' ? `Keep this note every month automatically. ${nm}’s is added when this one is settled.` : `Keep this note every month. When it’s settled, we’ll offer to add ${nm}’s.`
    : 'Keep this note every month automatically'

  const flowBtn = (flow: ItemDraft['flow'], label: string, Icon: typeof ArrowDown) => {
    const s = f.flow === flow
    return (
      <button key={flow} onClick={() => { if (!editing && !s) set({ flow, cat: flow === 'expense' ? 'Food & Dining' : 'Other Income', project: null }) }} style={{
        flex: 1, height: 42, borderRadius: 11, border: 0, background: s ? 'var(--surface)' : 'transparent',
        color: s ? (flow === 'income' ? 'var(--good-ink)' : 'var(--text)') : editing ? 'var(--text-4)' : 'var(--text-3)',
        boxShadow: s ? '0 1px 3px rgba(0,0,0,.12)' : 'none', fontWeight: 600, cursor: editing ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      }}><Icon size={16} strokeWidth={2} />{label}</button>
    )
  }

  return (
    <SheetFrame
      desktop={desktop} onClose={onClose}
      title={editing ? 'Edit item' : f.flow === 'income' ? 'Expected income' : 'New upcoming bill'}
      eyebrow={editing ? undefined : 'Add to Upcoming'}
      footer={<>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
        <button onClick={() => can && onSave(f)} disabled={!can} style={primaryBtn(can)}>{editing ? 'Save changes' : isExp ? 'Add to upcoming' : 'Add expected income'}</button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', padding: 4, borderRadius: 14, background: 'var(--surface-2)', gap: 4 }}>
            {flowBtn('expense', 'Expense', ArrowDown)}
            {flowBtn('income', 'Income', ArrowUp)}
          </div>
          {editing && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)' }}><Lock size={12} strokeWidth={2} />Type can’t change after an item is created.</div>}
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={fieldLabel}>Amount (₹)</span>
          <div style={bigAmountBox}>
            <span style={{ fontSize: 24, color: 'var(--text-3)', fontWeight: 500 }}>₹</span>
            <input inputMode="decimal" value={f.amount} onChange={e => set({ amount: cleanAmount(e.target.value) })} placeholder="0" style={bigAmountInput} />
          </div>
          {echo && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{echo}</span>}
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={fieldLabel}>{isExp ? 'What is it?' : 'What’s coming in?'}</span>
          <input value={f.label} onChange={e => set({ label: e.target.value })} placeholder={isExp ? 'e.g. Rent, Credit card bill, Flight…' : 'e.g. Security deposit, Freelance payout…'} style={input} />
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={fieldLabel}>{isExp ? 'Expected date' : 'Expected by'}</span>
          <input type="date" value={f.date} onChange={e => set({ date: e.target.value })} style={input} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {dateChips.map(([label, v]) => (
              <button key={label} onClick={() => set({ date: v })} style={{ height: 34, padding: '0 12px', borderRadius: 99, ...chip(f.date === v), fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={fieldLabel}>Category</span>
          <CategoryPicker key={f.flow} value={f.cat} onChange={v => set({ cat: v })} type={f.flow} />
        </div>
        {isExp && projects.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={fieldLabel}>Link to Project (optional)</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[{ id: null as string | null, name: 'None' }, ...projects].map(p => (
                <button key={p.id ?? 'none'} onClick={() => set({ project: p.id })} style={{ height: 36, padding: '0 12px', borderRadius: 99, ...chip(f.project === p.id), display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{p.name}</button>
              ))}
            </div>
          </div>
        )}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={fieldLabel}>Notes (optional)</span>
          <textarea value={f.notes} onChange={e => set({ notes: e.target.value })} rows={2} placeholder="Account, reference number, reminders" style={{ borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--bg)', padding: '12px 14px', fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, border: '1px solid var(--border)' }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Repeat size={17} strokeWidth={2} /></span>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>Repeats monthly</div><div style={{ fontSize: 12, color: 'var(--text-3)', textWrap: 'pretty' } as CSSProperties}>{recurHelp}</div></div>
          <Switch on={f.recurring} onClick={() => set({ recurring: !f.recurring })} label="Repeats monthly" />
        </div>
      </div>
    </SheetFrame>
  )
}

// ── Log / edit payment ───────────────────────────────────────────────────────

export function PaySheet({ desktop, x, editPay, money, today, projects, efBalance, saving, onClose, onSave, onSaveEdit }: {
  desktop: boolean; x: Derived; editPay: UpcomingPayment | null; money: Money; today: string; projects: Project[]; efBalance: number; saving: boolean
  onClose: () => void; onSave: (p: NewPayment) => void; onSaveEdit: (p: { amount: number; date: string; notes: string }) => void
}) {
  const { it, inc } = x
  const isEdit = !!editPay
  const R = isEdit ? Math.max(0, r2(it.amount - (x.paid - editPay.amount))) : x.remaining
  const [amount, setAmount] = useState(isEdit ? String(editPay.amount) : String(x.remaining || ''))
  const [date, setDate] = useState(isEdit ? editPay.date : today)
  const [notes, setNotes] = useState(isEdit ? editPay.notes ?? '' : '')
  const [toTxn, setToTxn] = useState(true)
  const [cat, setCat] = useState(it.category ?? (inc ? 'Other Income' : 'Other'))
  const [project, setProject] = useState<string | null>(it.projectId ?? null)
  const [useEF, setUseEF] = useState(false)
  const [efAmount, setEfAmount] = useState('')

  const a = num(amount)
  let hint: string, hintColor = 'var(--text-3)'
  if (!(a > 0)) hint = 'Enter an amount'
  else if (Math.abs(a - R) < 0.005) { hint = inc ? 'Marks this as fully received' : 'Settles this item'; hintColor = 'var(--good-ink)' }
  else if (a < R) hint = `After this: ${money(R - a)} remaining`
  else { hint = `${money(a - R)} more than remaining. It will show as overpaid.`; hintColor = 'var(--warn-ink)' }

  const showEF = !isEdit && !inc && efBalance > 0
  const efMax = Math.min(a, efBalance), efA = Math.min(num(efAmount), efMax)
  const full = R > 0 && Math.abs(a - R) < 0.005
  const half = Math.round(R / 2)
  const pct = it.amount > 0 ? Math.min(100, Math.round(x.paid / it.amount * 100)) : 0
  const linked = isEdit && !!editPay.linkedTransactionId
  const can = a > 0 && !saving

  const qb = (label: string, v: number | null) => {
    const s = v === null ? !full && Math.abs(a - half) >= 0.005 : Math.abs(a - v) < 0.005
    return (
      <button key={label} onClick={() => {
        if (v === null) { setAmount(''); return }
        setAmount(String(v))
        if (useEF) setEfAmount(String(Math.min(v, efBalance)))
      }} style={{ minHeight: 58, padding: '8px 10px', borderRadius: 14, border: `1.5px solid ${s ? 'var(--brand)' : 'var(--border)'}`, background: s ? 'var(--brand-soft)' : 'var(--surface)', color: s && v !== null ? 'var(--brand-ink)' : 'var(--text)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 2, cursor: 'pointer', textAlign: 'left', minWidth: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{v === null ? 'Type below' : money(v)}</span>
      </button>
    )
  }

  const cta = isEdit ? 'Save changes' : !(a > 0) ? 'Enter an amount'
    : full ? (inc ? `Receive ${money(a)} · complete` : `Pay ${money(a)} · settle`)
    : (inc ? `Log ${money(a)} received` : `Log ${money(a)} payment`)

  function save() {
    if (!can) return
    if (isEdit) onSaveEdit({ amount: a, date, notes })
    else onSave({ amount: a, date, notes, toTxn, category: cat, projectId: project, efAmount: useEF ? efA : 0 })
  }

  const todaySel = date === today
  const searchFor = editPay ? (editPay.notes || it.label) : ''

  return (
    <SheetFrame
      desktop={desktop} onClose={onClose} eyebrow={it.label}
      title={isEdit ? (inc ? 'Edit receipt' : 'Edit payment') : (inc ? 'Log money received' : 'Log payment')}
      footer={<button onClick={save} disabled={!can} style={primaryBtn(can, 54, 16)}>{cta}</button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {!isEdit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 14, background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontVariantNumeric: 'tabular-nums' }}><span style={{ color: 'var(--text-3)' }}>{inc ? 'Still to come' : 'Remaining'}</span><span style={{ fontWeight: 600 }}>{money(R)}</span></div>
            <div style={{ height: 6, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: inc ? 'var(--good)' : 'var(--brand)', borderRadius: 99 }} /></div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{money(x.paid)} of {money(it.amount)}{inc ? ' received so far' : ' paid so far'}{it.isRecurring ? ' · repeats monthly' : ''}</div>
          </div>
        )}
        {!isEdit && R >= 2 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
            {qb(inc ? 'All of it' : 'Full remaining', R)}
            {qb('Half', half)}
            {qb('Other', null)}
          </div>
        )}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={fieldLabel}>{inc ? 'Amount received (₹)' : 'Amount paid (₹)'}</span>
          <div style={bigAmountBox}>
            <span style={{ fontSize: 24, color: 'var(--text-3)', fontWeight: 500 }}>₹</span>
            <input inputMode="decimal" value={amount} onChange={e => setAmount(cleanAmount(e.target.value))} placeholder="0" style={bigAmountInput} />
          </div>
          <span style={{ fontSize: 13, color: hintColor, fontWeight: 500 }}>{hint}</span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={fieldLabel}>Date</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...input, flex: 1, minWidth: 0, width: 'auto', height: 46 }} />
            <button onClick={() => setDate(today)} style={{ height: 46, padding: '0 14px', borderRadius: 12, border: `1px solid ${todaySel ? 'var(--brand)' : 'var(--border-strong)'}`, background: todaySel ? 'var(--brand-soft)' : 'transparent', color: todaySel ? 'var(--brand-ink)' : 'var(--text-2)', fontWeight: 500, cursor: 'pointer' }}>Today</button>
          </div>
        </div>

        {!isEdit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, borderRadius: 14, border: `1px solid ${toTxn ? 'color-mix(in oklab, var(--brand) 40%, var(--border))' : 'var(--border)'}`, background: toTxn ? 'color-mix(in oklab, var(--brand-soft) 55%, transparent)' : 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ArrowLeftRight size={17} strokeWidth={2} /></span>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{inc ? 'Also log as income transaction' : 'Also log as expense transaction'}</div><div style={{ fontSize: 12, color: 'var(--text-3)' }}>{inc ? 'Adds to your monthly income' : 'Adds to your monthly spending'}</div></div>
              <Switch on={toTxn} onClick={() => setToTxn(v => !v)} label="Also log as transaction" />
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', textWrap: 'pretty' } as CSSProperties}>
              {toTxn ? `Creates a ${money(a)} ${inc ? 'income' : 'expense'} entry dated ${sh(date || today)} in Transactions, linked to this payment.` : `Only this note is updated. Your monthly ${inc ? 'income' : 'spending'} won’t change.`}
            </div>
            {toTxn && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)' }}>Transaction category</span>
                  <CategoryPicker value={cat} onChange={setCat} type={inc ? 'income' : 'expense'} />
                </div>
                {!inc && projects.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)' }}>Project</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {[{ id: null as string | null, name: 'None' }, ...projects].map(p => (
                        <button key={p.id ?? 'none'} onClick={() => setProject(p.id)} style={{ height: 32, padding: '0 10px', borderRadius: 99, ...chip(project === p.id), fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{p.name}</button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {showEF && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, borderRadius: 14, border: `1px solid ${useEF ? 'color-mix(in oklab, var(--warn) 55%, var(--border))' : 'var(--border)'}`, background: useEF ? 'color-mix(in oklab, var(--warn-soft) 70%, transparent)' : 'transparent' }}>
            <button onClick={() => { setUseEF(v => !v); if (!efAmount) setEfAmount(String(Math.min(a, efBalance))) }} style={{ display: 'flex', alignItems: 'center', gap: 12, border: 0, background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer', width: '100%' }}>
              <span style={{ width: 22, height: 22, borderRadius: 7, border: `1.5px solid ${useEF ? 'var(--brand)' : 'var(--border-strong)'}`, background: useEF ? 'var(--brand)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{useEF && <Check size={14} strokeWidth={3} />}</span>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>Part of this came from Emergency Fund</div><div style={{ fontSize: 12, color: 'var(--text-3)' }}>Balance {money(efBalance)} · optional</div></div>
              <Shield size={20} strokeWidth={2} style={{ flexShrink: 0, color: 'var(--warn-ink)' }} />
            </button>
            {useEF && (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, height: 46, padding: '0 14px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--bg)' }}>
                    <span style={{ color: 'var(--text-3)' }}>₹</span>
                    <input inputMode="decimal" value={efAmount} onChange={e => { const v = num(e.target.value); setEfAmount(v > efMax ? String(efMax) : cleanAmount(e.target.value)) }} style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }} />
                  </div>
                  <button onClick={() => setEfAmount(String(efMax))} style={{ height: 46, padding: '0 12px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>Max {money(efMax)}</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-3)' }}>From Emergency Fund</span><span style={{ fontWeight: 600, color: 'var(--warn-ink)' }}>{money(efA)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-3)' }}>From your regular money</span><span style={{ fontWeight: 600 }}>{money(Math.max(0, a - efA))}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px dashed var(--border-strong)' }}><span style={{ color: 'var(--text-3)' }}>Fund balance after</span><span style={{ fontWeight: 600 }}>{money(efBalance - efA)}</span></div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', textWrap: 'pretty' } as CSSProperties}>We’ll take this out of your Emergency Fund and log it as a withdrawal transfer.</div>
              </>
            )}
          </div>
        )}

        <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={fieldLabel}>Notes (optional)</span>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. UPI transfer, cheque…" style={{ ...input, height: 46 }} />
        </label>

        {linked && (
          <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 12, background: 'var(--info-soft)', color: 'var(--info-ink)', fontSize: 13 }}>
            <Link2 size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>The {money(editPay.amount)} {inc ? 'income' : 'expense'} in Transactions stays as is. Edit it there if the amount or date changed.</span>
              <Link href={`/transactions?search=${encodeURIComponent(searchFor)}`} style={{ fontWeight: 600, color: 'var(--info-ink)', textDecoration: 'none' }}>Open in Transactions →</Link>
            </div>
          </div>
        )}
      </div>
    </SheetFrame>
  )
}

// ── Phone filter ─────────────────────────────────────────────────────────────

export interface Seg { key: string; label: string; sel: boolean; on: () => void }
export interface CatOpt { name: string; label: string; color: string; sel: boolean; count: number; on: () => void }

export const segBtnStyle = (sel: boolean): CSSProperties => ({ background: sel ? 'var(--surface)' : 'transparent', color: sel ? 'var(--text)' : 'var(--text-3)', boxShadow: sel ? '0 1px 3px rgba(0,0,0,.12)' : 'none' })
export const checkBox = (sel: boolean, size: number): CSSProperties => ({ width: size, height: size, borderRadius: size === 22 ? 7 : 6, border: `1.5px solid ${sel ? 'var(--brand)' : 'var(--border-strong)'}`, background: sel ? 'var(--brand)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-brand)', flexShrink: 0 })

export function FilterSheet({ segs, cats, shown, onClear, onClose }: { segs: Seg[]; cats: CatOpt[]; shown: number; onClear: () => void; onClose: () => void }) {
  return (
    <SheetFrame
      desktop={false} title="Filter" onClose={onClose}
      footer={<>
        <button onClick={onClear} style={ghostBtn}>Clear</button>
        <button onClick={onClose} style={primaryBtn(true)}>Show {shown} {shown === 1 ? 'item' : 'items'}</button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={fieldLabel}>Show</span>
          <div style={{ display: 'flex', padding: 3, borderRadius: 12, background: 'var(--surface-2)', gap: 2 }}>
            {segs.map(s => <button key={s.key} onClick={s.on} style={{ flex: 1, height: 40, borderRadius: 9, border: 0, ...segBtnStyle(s.sel), fontWeight: 500, cursor: 'pointer' }}>{s.label}</button>)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ ...fieldLabel, marginBottom: 4 }}>Category</span>
          {cats.map(c => (
            <button key={c.name} onClick={c.on} style={{ width: '100%', height: 48, display: 'flex', alignItems: 'center', gap: 12, padding: '0 4px', border: 0, borderBottom: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
              <span style={checkBox(c.sel, 22)}>{c.sel && <Check size={14} strokeWidth={3} />}</span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
              <span style={{ flex: 1, fontSize: 15 }}>{c.label}</span><span style={{ color: 'var(--text-3)', fontSize: 13 }}>{c.count}</span>
            </button>
          ))}
        </div>
      </div>
    </SheetFrame>
  )
}
