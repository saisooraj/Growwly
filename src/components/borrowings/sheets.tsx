'use client'

import type { CSSProperties, ReactNode } from 'react'
import { Field, Ico, P, pretty, type Tone } from './parts'

// ── Frame: bottom sheet on phones, centred dialog on desktop ─────────────────

export function SheetFrame({ title, sub, width, onClose, children }: {
  title: string; sub?: string; width: string; onClose: () => void; children: ReactNode
}) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'var(--ov-align)', background: 'var(--scrim)', animation: 'bw-fade .15s ease-out' }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}
        className="bw-sheet" style={{ width, maxWidth: '100%', maxHeight: 'var(--sh-max)', background: 'var(--surface)', borderRadius: 'var(--sh-r)', boxShadow: 'var(--sheet-shadow)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'var(--grab)', justifyContent: 'center', paddingTop: 8, flex: 'none' }}><div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--line-2)' }} /></div>
        {sub !== undefined && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 14px 10px 20px', flex: 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2, overflowWrap: 'anywhere' }}>{sub}</div>
            </div>
            <button onClick={onClose} aria-label="Close" style={{ width: 40, height: 40, flex: 'none', borderRadius: 999, border: 0, background: 'var(--sunk)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-2)' }}>
              <Ico d={P.close} size={16} sw={2.2} join={false} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

const input: CSSProperties = {
  width: '100%', boxSizing: 'border-box', height: 'var(--field-h)', padding: '0 14px', borderRadius: 14,
  border: 0, background: 'var(--sunk)', fontSize: 15, fontWeight: 500, outline: 'none',
}
const dateInput: CSSProperties = { ...input, padding: '0 12px', fontSize: 14 }
const bare: CSSProperties = { border: 0, outline: 0, background: 'transparent', flex: 1, minWidth: 0 }
const errText: CSSProperties = { fontSize: 12.5, color: 'var(--bad-ink)', fontWeight: 600 }
const big: CSSProperties = { display: 'flex', alignItems: 'center', height: 60, borderRadius: 16, background: 'var(--sunk)', padding: '0 16px', gap: 6 }

const cancelBtn: CSSProperties = { flex: 'var(--btn-flex)', height: 'var(--field-h)', padding: '0 20px', borderRadius: 999, border: 0, background: 'var(--sunk)', fontWeight: 600, fontSize: 14.5, cursor: 'pointer' }
const primaryBtn: CSSProperties = { flex: 'var(--btn-flex)', height: 'var(--field-h)', padding: '0 24px', borderRadius: 999, border: 0, background: 'var(--brand)', color: 'var(--on-brand)', fontWeight: 600, fontSize: 14.5, cursor: 'pointer', boxShadow: '0 6px 16px -6px var(--brand)' }
const body: CSSProperties = { flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '4px 20px 18px', display: 'flex', flexDirection: 'column', gap: 16 }
const footer: CSSProperties = { flex: 'none', padding: '12px 20px calc(16px + var(--sab))', borderTop: '1px solid var(--line)', display: 'flex', gap: 10, justifyContent: 'flex-end', background: 'var(--surface)' }

function Banner({ tone, icon, children, style }: { tone: Tone; icon: 'warn' | 'info'; children: ReactNode; style?: CSSProperties }) {
  return (
    <div data-tone={tone} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: 'var(--ts)', color: 'var(--ti)', borderRadius: 14, padding: '10px 12px', fontSize: 13, lineHeight: 1.4, ...style }}>
      {icon === 'warn'
        ? <Ico d={P.warn} size={16} sw={2.2} style={{ flex: 'none', marginTop: 1 }} />
        : <Ico d={P.info} size={16} join={false} circles={[[12, 12, 9]]} style={{ flex: 'none', marginTop: 1 }} />}
      <span>{children}</span>
    </div>
  )
}

// ── Add / Edit record ─────────────────────────────────────────────────────────

export interface FormVM {
  summary: string; isLent: boolean; setLent: () => void; setBorrowed: () => void
  amount: string; onAmount: (v: string) => void; amountWords: string; amountErr: string
  person: string; onPerson: (v: string) => void; personLabel: string; personPh: string; personErr: string
  sugg: { name: string; initial: string; avBg: string; avInk: string; on: () => void }[]
  desc: string; onDesc: (v: string) => void; date: string; onDate: (v: string) => void
  due: string; onDue: (v: string) => void; dueLabel: string; dueErr: string
  repaid: string; onRepaid: (v: string) => void; repaidErr: string
  status: 'pending' | 'partial' | 'repaid'; setPending: () => void; setRepaid: () => void; logText: string
  isLoan: boolean; toggleLoan: () => void; rate: string; onRate: (v: string) => void; tenure: string; onTenure: (v: string) => void
  emi: string; onEmi: (v: string) => void; emiEdited: boolean; resetEmi: () => void; resetLabel: string; emiHint: string
  rateErr: boolean; tenureErr: boolean; loanErr: string
  save: () => void; saveLabel: string; busy: boolean
}

const statusPill: CSSProperties = { height: 28, padding: '0 12px', border: 0, borderRadius: 999, background: 'transparent', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', cursor: 'pointer' }
const loanInput: CSSProperties = { ...input, padding: '0 12px', borderRadius: 12 }

export function FormBody({ f, onCancel }: { f: FormVM; onCancel: () => void }) {
  return (
    <>
      <div style={body}>
        {f.summary && <Banner tone="bad" icon="warn" style={{ alignItems: 'center', fontWeight: 600, gap: 8 }}>{f.summary}</Banner>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Type</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {([
              [true, f.setLent, 'good', '↑', 'I lent', 'They owe me'],
              [false, f.setBorrowed, 'bad', '↓', 'I borrowed', 'I owe them'],
            ] as const).map(([lent, on, tone, glyph, label, hint]) => (
              <button key={label} onClick={on} data-pick={String(f.isLent === lent)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 16, border: 0, background: 'var(--sunk)', display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', minHeight: 56 }}>
                <span data-tone={tone} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--ts)', color: 'var(--ti)', display: 'grid', placeItems: 'center', fontWeight: 700, flex: 'none' }}>{glyph}</span>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <Field label="Amount">
          <div className="bw-field" data-err={String(!!f.amountErr)} style={big}>
            <span className="bw-num" style={{ fontSize: 22, fontWeight: 500, color: 'var(--ink-3)' }}>₹</span>
            <input value={f.amount} onChange={e => f.onAmount(e.target.value)} inputMode="decimal" placeholder="0" aria-label="Amount" className="input-lg bw-num" style={{ ...bare, fontSize: 24, fontWeight: 600 }} />
            <span style={{ fontSize: 12.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{f.amountWords}</span>
          </div>
          {f.amountErr && <div style={errText}>{f.amountErr}</div>}
        </Field>

        <Field label={f.personLabel}>
          <input className="bw-focus" value={f.person} onChange={e => f.onPerson(e.target.value)} placeholder={f.personPh} maxLength={60} data-err={String(!!f.personErr)} style={input} />
          {f.sugg.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {f.sugg.map(s => (
                <button key={s.name} onClick={s.on} style={{ height: 36, padding: '0 14px 0 5px', borderRadius: 999, border: 0, background: 'var(--sunk)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', maxWidth: 200 }}>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 700, background: s.avBg, color: s.avInk, flex: 'none' }}>{s.initial}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                </button>
              ))}
            </div>
          )}
          {f.personErr && <div style={errText}>{f.personErr}</div>}
        </Field>

        <Field label={<>Description <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>· optional</span></>}>
          <input className="bw-focus" value={f.desc} onChange={e => f.onDesc(e.target.value)} maxLength={200} placeholder="What was it for? e.g. Goa trip" style={input} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <Field label="Date"><input className="bw-focus" type="date" value={f.date} onChange={e => f.onDate(e.target.value)} style={dateInput} /></Field>
          <Field label={f.dueLabel}><input className="bw-focus" type="date" value={f.due} onChange={e => f.onDue(e.target.value)} data-err={String(!!f.dueErr)} style={dateInput} /></Field>
        </div>
        {f.dueErr && <div style={{ ...errText, marginTop: -8 }}>{f.dueErr}</div>}

        <Field label="Repaid so far">
          <div className="bw-field" data-err={String(!!f.repaidErr)} style={{ display: 'flex', alignItems: 'center', height: 'var(--field-h)', borderRadius: 14, background: 'var(--sunk)', padding: '0 14px', gap: 6 }}>
            <span style={{ fontSize: 15, color: 'var(--ink-3)' }}>₹</span>
            <input value={f.repaid} onChange={e => f.onRepaid(e.target.value)} inputMode="decimal" placeholder="0" aria-label="Repaid so far" className="bw-num" style={{ ...bare, fontSize: 15, fontWeight: 500 }} />
          </div>
          {f.repaidErr && <div style={errText}>{f.repaidErr}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Status</span>
            <div style={{ display: 'flex', gap: 4, background: 'var(--sunk)', padding: 3, borderRadius: 999 }}>
              <button onClick={f.setPending} data-seg={String(f.status === 'pending')} style={statusPill}>Pending</button>
              <span data-seg={String(f.status === 'partial')} style={{ ...statusPill, cursor: 'default', display: 'flex', alignItems: 'center' }}>Partial</span>
              <button onClick={f.setRepaid} data-seg={String(f.status === 'repaid')} style={statusPill}>Repaid</button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Status follows the repaid amount, so it can&apos;t contradict it.</div>
        </Field>

        {f.logText && <Banner tone="info" icon="info">{f.logText}</Banner>}

        <div style={{ border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
          <button role="switch" aria-checked={f.isLoan} onClick={f.toggleLoan} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: 0, background: 'var(--surface-2)', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>This is a formal loan / EMI</span>
              <span style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.4 }}>For personal EMIs, like a family loan. Home, car and credit-card loans live in Net worth → Liabilities.</span>
            </span>
            <span data-sw={String(f.isLoan)} style={{ width: 40, height: 24, borderRadius: 999, background: 'var(--line-2)', position: 'relative', display: 'block', flex: 'none', transition: 'background .15s' }}>
              <span style={{ position: 'absolute', top: 3, left: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', display: 'block', transition: 'transform .15s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
            </span>
          </button>
          {f.isLoan && (
            <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--line)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
                <LoanField label="Interest % / yr"><input className="bw-focus" value={f.rate} onChange={e => f.onRate(e.target.value)} inputMode="decimal" placeholder="12" data-err={String(f.rateErr)} style={loanInput} /></LoanField>
                <LoanField label="Tenure (months)"><input className="bw-focus" value={f.tenure} onChange={e => f.onTenure(e.target.value)} inputMode="numeric" placeholder="24" data-err={String(f.tenureErr)} style={loanInput} /></LoanField>
                <LoanField label="EMI ₹ / month"><input value={f.emi} onChange={e => f.onEmi(e.target.value)} inputMode="decimal" placeholder="—" className="bw-focus bw-num" style={{ ...loanInput, background: 'var(--brand-soft)', fontWeight: 600 }} /></LoanField>
              </div>
              {f.loanErr && <div style={errText}>{f.loanErr}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-3)', flexWrap: 'wrap' }}>
                <span>{f.emiHint}</span>
                {f.emiEdited && <button onClick={f.resetEmi} style={{ border: 0, background: 'transparent', color: 'var(--brand-ink)', fontWeight: 600, fontSize: 12, cursor: 'pointer', padding: 0 }}>{f.resetLabel}</button>}
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={footer}>
        <button onClick={onCancel} style={cancelBtn}>Cancel</button>
        <button onClick={f.save} data-off={String(f.busy)} style={primaryBtn}>{f.saveLabel}</button>
      </div>
    </>
  )
}

function LoanField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>{label}</label>
      {children}
    </div>
  )
}

// ── Record a repayment ────────────────────────────────────────────────────────

export interface RepayVM {
  choices: { id: string; title: string; out: string; active: boolean; on: () => void }[]
  tone: Tone; recTitle: string; out: string
  amount: string; onAmount: (v: string) => void
  quick: { label: string; active: boolean; on: () => void }[]
  err: boolean; previewTone: Tone; preview: string
  date: string; onDate: (v: string) => void; note: string; onNote: (v: string) => void; notePh: string
  logNote: string; save: () => void; saveLabel: string; busy: boolean
}

export function RepayBody({ rp, onCancel }: { rp: RepayVM; onCancel: () => void }) {
  return (
    <>
      <div style={body}>
        {rp.choices.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Which record?</div>
            {rp.choices.map(c => (
              <button key={c.id} onClick={c.on} data-pick={String(c.active)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14, border: 0, background: 'var(--sunk)', cursor: 'pointer', textAlign: 'left', minHeight: 'var(--hit)' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                <span className="bw-num" style={{ fontSize: 13, fontWeight: 500 }}>{c.out}</span>
              </button>
            ))}
          </div>
        )}
        <div data-tone={rp.tone} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--sunk)', borderRadius: 16, padding: '12px 14px' }}>
          <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: 'var(--t)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Still outstanding</div>
            <div style={{ fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>{rp.recTitle}</div>
          </div>
          <div className="bw-num" style={{ fontSize: 18, fontWeight: 600 }}>{rp.out}</div>
        </div>
        <Field label="Amount repaid">
          <div className="bw-field" data-err={String(rp.err)} style={big}>
            <span className="bw-num" style={{ fontSize: 22, fontWeight: 500, color: 'var(--ink-3)' }}>₹</span>
            <input value={rp.amount} onChange={e => rp.onAmount(e.target.value)} inputMode="decimal" aria-label="Amount repaid" className="input-lg bw-num" style={{ ...bare, fontSize: 24, fontWeight: 600 }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {rp.quick.map(q => (
              <button key={q.label} onClick={q.on} data-pick={String(q.active)} className="bw-num" style={{ height: 38, padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--sunk)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{q.label}</button>
            ))}
          </div>
        </Field>
        <div data-tone={rp.previewTone} style={{ display: 'flex', gap: 9, alignItems: 'center', background: 'var(--ts)', color: 'var(--ti)', borderRadius: 14, padding: '10px 12px', fontSize: 13.5, fontWeight: 600 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--t)', flex: 'none' }} />{rp.preview}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr)', gap: 10 }}>
          <Field label="Date"><input className="bw-focus" type="date" value={rp.date} onChange={e => rp.onDate(e.target.value)} style={dateInput} /></Field>
          <Field label="Note"><input className="bw-focus" value={rp.note} onChange={e => rp.onNote(e.target.value)} placeholder={rp.notePh} maxLength={200} style={{ ...input, fontSize: 14.5 }} /></Field>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{rp.logNote}</div>
      </div>
      <div style={{ ...footer, background: undefined }}>
        <button onClick={onCancel} style={cancelBtn}>Cancel</button>
        <button onClick={rp.save} data-off={String(rp.err || rp.busy)} style={{ ...primaryBtn, whiteSpace: 'nowrap' }}>{rp.saveLabel}</button>
      </div>
    </>
  )
}

// ── Mark repaid / Delete confirm ──────────────────────────────────────────────

export interface ConfirmVM {
  isMark: boolean; tone: Tone; title: string; body: string
  recTone: Tone; recTitle: string; recSub: string; recAmount: string
  onEdit: () => void; onConfirm: () => void
}

export function ConfirmBody({ cf, onCancel }: { cf: ConfirmVM; onCancel: () => void }) {
  const solid: CSSProperties = { flex: '1 1 0', height: 'var(--field-h)', padding: '0 18px', borderRadius: 999, border: 0, fontWeight: 600, fontSize: 14.5, cursor: 'pointer', whiteSpace: 'nowrap' }
  return (
    <>
      <div style={{ padding: '20px 22px 6px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
        <div data-tone={cf.tone} style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--ts)', color: 'var(--ti)', display: 'grid', placeItems: 'center' }}>
          {cf.isMark ? <Ico d={P.check} size={22} sw={2.4} /> : <Ico d={P.trash} size={22} sw={2.2} />}
        </div>
        <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em' }}>{cf.title}</div>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5, ...pretty, overflowWrap: 'anywhere' }}>{cf.body}</div>
        <div data-tone={cf.recTone} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--sunk)', borderRadius: 16, padding: '10px 12px' }}>
          <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: 'var(--t)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>{cf.recTitle}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{cf.recSub}</div>
          </div>
          <div className="bw-num" style={{ fontSize: 15, fontWeight: 600 }}>{cf.recAmount}</div>
        </div>
        {cf.isMark && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Got a different amount? Use <b style={{ color: 'var(--ink-2)', fontWeight: 600 }}>Edit instead</b>, or record a partial repayment.</div>}
      </div>
      <div style={{ flex: 'none', padding: '16px 22px calc(18px + var(--sab))', display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {cf.isMark && <button onClick={cf.onEdit} style={{ flex: '1 1 100%', height: 'var(--field-h)', padding: '0 14px', borderRadius: 999, border: 0, background: 'transparent', color: 'var(--brand-ink)', fontWeight: 600, fontSize: 14.5, cursor: 'pointer', order: 3 }}>Edit instead</button>}
        <button onClick={onCancel} style={{ ...cancelBtn, flex: '1 1 0' }}>Cancel</button>
        {cf.isMark
          ? <button onClick={cf.onConfirm} style={{ ...solid, background: 'var(--brand)', color: 'var(--on-brand)' }}>Mark repaid</button>
          : <button onClick={cf.onConfirm} style={{ ...solid, background: 'var(--bad)', color: 'var(--on-bad)' }}>Delete record</button>}
      </div>
    </>
  )
}

// ── Sort (phone sheet; desktop uses a popover with the same options) ─────────

export interface SortOpt { key: string; label: string; hint: string; active: boolean; on: () => void }

export function SortBody({ opts }: { opts: SortOpt[] }) {
  return (
    <div style={{ padding: '0 16px calc(20px + var(--sab))', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {opts.map(o => (
        <button key={o.key} onClick={o.on} data-pick={String(o.active)} style={{ width: '100%', minHeight: 52, border: 0, borderRadius: 16, background: 'var(--sunk)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', fontSize: 15, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
          <span>{o.label}</span><span style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 400 }}>{o.hint}</span>
        </button>
      ))}
    </div>
  )
}

export function SortPopover({ opts }: { opts: SortOpt[] }) {
  return (
    <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 30, width: 220, background: 'var(--surface)', borderRadius: 16, boxShadow: '0 1px 2px rgba(0,0,0,.06), 0 18px 44px -12px rgba(0,0,0,.28)', padding: 6, animation: 'bw-fade .12s ease-out' }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', padding: '6px 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sort people by</div>
      {opts.map(o => (
        <button key={o.key} onClick={o.on} data-pick={String(o.active)} style={{ width: '100%', height: 38, border: 0, borderRadius: 10, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', fontSize: 13.5, cursor: 'pointer', textAlign: 'left' }}>
          <span>{o.label}</span><span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{o.hint}</span>
        </button>
      ))}
    </div>
  )
}

// ── People ────────────────────────────────────────────────────────────────────

export interface PeopleRowVM {
  key: string; name: string; initial: string; avBg: string; avInk: string; pill: string; pillTone: Tone; sub: string
  mode: 'view' | 'edit' | 'del'; canEdit: boolean
  onEdit: () => void; onSave: () => void; onDelete: () => void
  renameNote: string; delTitle: string; delBody: string
  contactOnlyLabel: string; allLabel: string; optContactOnly: boolean; optAll: boolean
  delContactOnly: () => void; delAll: () => void
}

export interface PeopleVM {
  q: string; onQ: (v: string) => void; startAdd: () => void
  adding: boolean; newName: string; newPhone: string; onNewName: (v: string) => void; onNewPhone: (v: string) => void
  addErr: string; cancelAdd: () => void; saveAdd: () => void
  editName: string; editPhone: string; onEditName: (v: string) => void; onEditPhone: (v: string) => void
  cancelEdit: () => void; saveEdit: () => void; cancelDel: () => void
  list: PeopleRowVM[]; emptyText: string; busy: boolean
}

const pmInput: CSSProperties = { ...input, borderRadius: 12, fontSize: 14.5 }
const smBtn: CSSProperties = { height: 'var(--hit)', padding: '0 12px', borderRadius: 999, border: 0, background: 'var(--sunk)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flex: 'none' }
const smCancel: CSSProperties = { height: 'var(--hit)', padding: '0 16px', borderRadius: 999, border: 0, background: 'var(--sunk)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }
const smSave: CSSProperties = { height: 'var(--hit)', padding: '0 18px', borderRadius: 999, border: 0, background: 'var(--brand)', color: 'var(--on-brand)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }

export function PeopleBody({ pm }: { pm: PeopleVM }) {
  return (
    <>
      <div style={{ flex: 'none', padding: '0 20px 10px', display: 'flex', gap: 8 }}>
        <label className="bw-field" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, height: 'var(--field-h)', padding: '0 14px', borderRadius: 999, background: 'var(--sunk)', boxSizing: 'border-box', color: 'var(--ink-3)', minWidth: 0 }}>
          <Ico d={P.search} size={16} join={false} circles={[[11, 11, 7]]} style={{ flex: 'none' }} />
          <input value={pm.q} onChange={e => pm.onQ(e.target.value)} placeholder="Search people" aria-label="Search people" style={{ ...bare, fontSize: 14.5 }} />
        </label>
        <button onClick={pm.startAdd} style={{ height: 'var(--field-h)', padding: '0 18px 0 14px', borderRadius: 999, border: 0, background: 'var(--brand)', color: 'var(--on-brand)', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flex: 'none', boxShadow: '0 6px 16px -6px var(--brand)' }}>
          <Ico d={P.plus} size={16} sw={2.4} join={false} />Add
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 20px calc(20px + var(--sab))' }}>
        {pm.adding && (
          <div style={{ boxShadow: 'inset 0 0 0 1.5px var(--brand)', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10, background: 'var(--surface)' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>New person</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
              <input className="bw-focus" value={pm.newName} onChange={e => pm.onNewName(e.target.value)} placeholder="Name" aria-label="Name" maxLength={60} data-err={String(!!pm.addErr)} autoFocus style={pmInput} />
              <input className="bw-focus" value={pm.newPhone} onChange={e => pm.onNewPhone(e.target.value)} placeholder="Phone (optional)" aria-label="Phone (optional)" type="tel" inputMode="tel" style={pmInput} />
            </div>
            {pm.addErr && <div style={errText}>{pm.addErr}</div>}
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>A phone number lets WhatsApp reminders open straight to their chat.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={pm.cancelAdd} style={smCancel}>Cancel</button>
              <button onClick={pm.saveAdd} data-off={String(pm.busy)} style={smSave}>Save person</button>
            </div>
          </div>
        )}
        {pm.list.map(c => (
          <div key={c.key} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
            {c.mode === 'view' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 15, background: c.avBg, color: c.avInk }}>{c.initial}</div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span data-tone={c.pillTone} className="bw-num" style={{ fontSize: 11.5, fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: 'var(--ts)', color: 'var(--ti)', whiteSpace: 'nowrap' }}>{c.pill}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.sub}</span>
                  </div>
                </div>
                {c.canEdit
                  ? <button onClick={c.onEdit} aria-label={`Edit ${c.name}`} style={smBtn}><Ico d={P.edit} size={14} />Edit</button>
                  : <button onClick={c.onSave} style={smBtn}>Save</button>}
                <button onClick={c.onDelete} aria-label={`Delete ${c.name}`} style={{ ...smBtn, color: 'var(--bad-ink)' }}><Ico d={P.trash} size={14} />Delete</button>
              </div>
            )}
            {c.mode === 'edit' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>Editing contact</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
                  <input value={pm.editName} onChange={e => pm.onEditName(e.target.value)} aria-label="Name" maxLength={60} autoFocus style={{ ...pmInput, boxShadow: '0 0 0 2px var(--brand)' }} />
                  <input className="bw-focus" value={pm.editPhone} onChange={e => pm.onEditPhone(e.target.value)} placeholder="Phone (optional)" aria-label="Phone" type="tel" inputMode="tel" style={pmInput} />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c.renameNote}</span>
                  <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                    <button onClick={pm.cancelEdit} style={smCancel}>Cancel</button>
                    <button onClick={pm.saveEdit} data-off={String(pm.busy)} style={smSave}>Save</button>
                  </div>
                </div>
              </div>
            )}
            {c.mode === 'del' && (
              <div data-tone="bad" style={{ background: 'var(--ts)', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, background: c.avBg, color: c.avInk }}>{c.initial}</div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ti)', overflowWrap: 'anywhere' }}>{c.delTitle}</div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45 }}>{c.delBody}</div>
                <div data-off={String(pm.busy)} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {c.optContactOnly && <button onClick={c.delContactOnly} style={{ flex: '1 1 auto', height: 'var(--hit)', padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--surface)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{c.contactOnlyLabel}</button>}
                  {c.optAll && <button onClick={c.delAll} style={{ flex: '1 1 auto', height: 'var(--hit)', padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--bad)', color: 'var(--on-bad)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{c.allLabel}</button>}
                  <button onClick={pm.cancelDel} style={{ flex: '0 0 auto', height: 'var(--hit)', padding: '0 12px', borderRadius: 999, border: 0, background: 'transparent', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: 'var(--ink-2)' }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {pm.list.length === 0 && <div style={{ padding: '28px 0', textAlign: 'center', fontSize: 13.5, color: 'var(--ink-3)' }}>{pm.emptyText}</div>}
      </div>
    </>
  )
}
