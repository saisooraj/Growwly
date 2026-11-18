'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { useAuth } from '@/context/AuthContext'
import { useAppStore } from '@/store/appStore'
import { setUserSettings } from '@/lib/firestore'
import { useRefreshData } from '@/hooks/useData'
import { getLast6Months } from '@/lib/utils'
import { getCycleRange, getCycleMonthForDate, getLastWorkingDay } from '@/lib/cycle'
import type { FinancialMode, UserSettings } from '@/types'
import VehiclesCard from './VehiclesCard'
import {
  Sym, MONO, card, CardHead, CardFoot, hint, rowTitle, btnOutline, btnPrimary, btnIcon, field,
  inr, digits, useSavedFlash,
} from './ui'

type SalaryCycleRule = 'none' | 'last-working-day' | 'fixed-day'

// ── Financial mode ──────────────────────────────────────────────────────────

function ModeCard() {
  const { user } = useAuth()
  const settings = useAppStore(s => s.settings)
  const refresh = useRefreshData()
  const [mode, setMode] = useState<FinancialMode>('normal')
  const [saved, flash] = useSavedFlash()
  useEffect(() => { if (settings) setMode(settings.financialMode ?? 'normal') }, [settings])

  async function saveMode(next: FinancialMode) {
    if (!user || next === mode) return
    setMode(next)
    try {
      await setUserSettings(user.uid, { financialMode: next })
      await refresh()
      flash('mode')
    } catch { toast.error('Failed to save mode') }
  }

  const option = (value: FinancialMode, title: string, desc: string, more: string, icon: string, tone: 'acc' | 'warn') => {
    const on = mode === value
    const c = tone === 'acc' ? { line: 'var(--acc)', bg: 'var(--acc-soft)', tile: 'var(--acc-soft)', ink: 'var(--acc-txt)', check: 'var(--on-acc)' }
                             : { line: 'var(--warn)', bg: 'var(--warn-bg)', tile: 'var(--warn-bg)', ink: 'var(--warn)', check: '#fff' }
    return (
      <button
        onClick={() => saveMode(value)} aria-pressed={on}
        style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 14, padding: 18, borderRadius: 18, border: `1.5px solid ${on ? c.line : 'var(--line)'}`, background: on ? c.bg : 'transparent', cursor: 'pointer', color: 'inherit', transition: 'background .15s, border-color .15s' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: c.tile, color: c.ink, display: 'grid', placeItems: 'center' }}><Sym name={icon} size={24} /></div>
          <div style={{ width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${on ? c.line : 'var(--line2)'}`, background: on ? c.line : 'transparent', display: 'grid', placeItems: 'center', color: c.check, boxSizing: 'border-box' }}>
            <Sym name="check" size={15} style={{ opacity: on ? 1 : 0 }} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3 }}>{title}</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.45, color: 'var(--mut)', marginTop: 2 }}>{desc}</div>
        </div>
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--mut)', borderTop: '1px dashed var(--line2)', paddingTop: 12, width: '100%' }}>{more}</div>
      </button>
    )
  }

  return (
    <div style={card}>
      <CardHead title="Financial mode" saved={saved === 'mode'} right={<span style={hint}>Changes how the whole app talks to you</span>} />
      <div style={{ padding: '16px 24px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
        {option('normal', 'Normal', 'Standard budget tracking', 'Calm Overview with weekly pace and a monthly verdict.', 'eco', 'acc')}
        {option('high-expense', 'High Expense', 'Cash pressure alerts, borrow tracking', 'Adds a cash-pressure strip to the header and tracks who you owe.', 'local_fire_department', 'warn')}
      </div>
    </div>
  )
}

// ── Budget targets ──────────────────────────────────────────────────────────

function MoneyInput({ label, placeholder, value, onChange, autoFocus }: { label: string; placeholder: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, color: 'var(--mut)' }}>{label}</span>
      <div className="set-field" style={{ ...field(46), display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 15, color: 'var(--mut)' }}>₹</span>
        <input
          inputMode="numeric" placeholder={placeholder} value={value} autoFocus={autoFocus}
          onChange={e => onChange(digits(e.target.value))}
          style={{ border: 0, outline: 0, background: 'transparent', fontFamily: MONO, fontSize: 16, fontWeight: 500, color: 'var(--ink)', width: '100%', minWidth: 0 }}
        />
      </div>
    </label>
  )
}

function BudgetCard() {
  const { user } = useAuth()
  const settings = useAppStore(s => s.settings)
  const refresh = useRefreshData()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [inc, setInc] = useState('')
  const [wk, setWk] = useState('')
  const [ef, setEf] = useState('')
  const [saved, flash] = useSavedFlash()

  function startEdit() {
    setInc(settings?.monthlyIncomeTarget ? String(settings.monthlyIncomeTarget) : '')
    setWk(settings?.weeklyBudget ? String(settings.weeklyBudget) : '')
    setEf(settings?.emergencyFundTarget ? String(settings.emergencyFundTarget) : '')
    setEditing(true)
  }

  async function save() {
    if (!user) return
    setSaving(true)
    try {
      await setUserSettings(user.uid, {
        monthlyIncomeTarget: Number(inc) || 0,
        weeklyBudget: Number(wk) || 0,
        emergencyFundTarget: Number(ef) || 0,
      })
      await refresh()
      setEditing(false)
      flash('budget')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const tile = (label: string, v?: number) => (
    <div style={{ padding: '16px 18px', borderRadius: 18, background: 'var(--sf2)', border: '1px solid var(--line)' }}>
      <div style={{ fontSize: 13, color: 'var(--mut)' }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 500, lineHeight: 1.2, letterSpacing: '-0.03em', marginTop: 8, color: v ? 'var(--ink)' : 'var(--mut)' }}>{v ? inr(v) : 'Not set'}</div>
    </div>
  )

  return (
    <div style={card}>
      <CardHead
        title="Budget targets" saved={saved === 'budget'}
        right={!editing && <button onClick={startEdit} style={btnOutline()}><Sym name="edit" size={17} />Edit</button>}
      />
      {!editing ? (
        <div style={{ padding: '16px 24px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {tile('Monthly income target', settings?.monthlyIncomeTarget)}
          {tile('Weekly spending budget', settings?.weeklyBudget)}
          {tile('Emergency fund target', settings?.emergencyFundTarget)}
        </div>
      ) : (
        <>
          <div style={{ padding: '16px 24px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <MoneyInput label="Monthly income target" placeholder="80000" value={inc} onChange={setInc} autoFocus />
            <MoneyInput label="Weekly spending budget" placeholder="3000" value={wk} onChange={setWk} />
            <MoneyInput label="Emergency fund target" placeholder="200000" value={ef} onChange={setEf} />
          </div>
          <CardFoot>
            <button onClick={() => setEditing(false)} style={btnOutline(38, 12, 14)}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ ...btnPrimary(), opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save targets'}</button>
          </CardFoot>
        </>
      )}
    </div>
  )
}

// ── Salary cycle ────────────────────────────────────────────────────────────

const RULES: { id: SalaryCycleRule; title: string; sub: string }[] = [
  { id: 'none',             title: 'Off',                                    sub: 'Use the calendar month — 1st to the last day.' },
  { id: 'last-working-day', title: 'Last working day of the previous month', sub: 'Mon–Fri. Right for most salaried jobs.' },
  { id: 'fixed-day',        title: 'A fixed day of the previous month',      sub: 'For salaries that land on a set date.' },
]

const dayLabel = (iso: string) => format(parseISO(iso), 'EEE, d MMM')

// The start a budget month gets from the rule alone, before any override
function autoStart(bm: string, rule: SalaryCycleRule, fixedDay: number): string {
  const [y, m] = bm.split('-').map(Number)
  const py = m === 1 ? y - 1 : y
  const pm = m === 1 ? 12 : m - 1
  if (rule === 'last-working-day') return getLastWorkingDay(py, pm)
  const lastDay = new Date(py, pm, 0).getDate()
  return format(new Date(py, pm - 1, Math.min(fixedDay || 28, lastDay)), 'yyyy-MM-dd')
}

function SalaryCard() {
  const { user } = useAuth()
  const settings = useAppStore(s => s.settings)
  const refresh = useRefreshData()
  const [editing, setEditing]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [rule, setRule]           = useState<SalaryCycleRule>('none')
  const [fixedDay, setFixedDay]   = useState('28')
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [rowEdit, setRowEdit]     = useState<string | null>(null)
  const [rowDate, setRowDate]     = useState('')
  const [saved, flash] = useSavedFlash()

  function startEdit() {
    setRule((settings?.salaryCycleRule ?? 'none') as SalaryCycleRule)
    setFixedDay(String(settings?.salaryCycleFixedDay ?? 28))
    setOverrides(settings?.cycleOverrides ?? {})
    setRowEdit(null)
    setEditing(true)
  }

  async function save() {
    if (!user) return
    setSaving(true)
    try {
      await setUserSettings(user.uid, {
        salaryCycleRule: rule,
        salaryCycleFixedDay: Number(fixedDay) || 28,
        cycleOverrides: overrides,
      })
      await refresh()
      setEditing(false)
      setRowEdit(null)
      flash('salary')
    } catch {
      toast.error('Failed to save cycle')
    } finally {
      setSaving(false)
    }
  }

  // Read view: the saved rule and the cycle today falls in
  const savedRule = (settings?.salaryCycleRule ?? 'none') as SalaryCycleRule
  const summary = savedRule === 'none' ? 'Off — budgets follow the calendar month'
    : savedRule === 'last-working-day' ? 'Last working day (Mon–Fri) of the previous month'
    : `Day ${settings?.salaryCycleFixedDay ?? 28} of the previous month`
  const today = format(new Date(), 'yyyy-MM-dd')
  const curMonth = getCycleMonthForDate(today, settings)
  const cur = getCycleRange(curMonth, settings)

  // Edit view: the draft rule applied to each month, newest first (next month included, so an
  // early salary this month can be set for the coming cycle)
  const draft = { ...settings, salaryCycleRule: rule, salaryCycleFixedDay: Number(fixedDay) || 28, cycleOverrides: overrides } as UserSettings
  const months = getLast6Months().reverse()

  return (
    <div style={card}>
      <CardHead
        title="Salary cycle" saved={saved === 'salary'}
        right={!editing && <button onClick={startEdit} style={btnOutline()}><Sym name="edit" size={17} />Edit</button>}
      />

      {!editing ? (
        <div style={{ padding: '10px 24px 22px', display: 'flex', flexWrap: 'wrap', gap: '10px 14px', alignItems: 'center' }}>
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>{summary}</div>
          {savedRule !== 'none' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 10px', borderRadius: 999, background: 'var(--sf2)', border: '1px solid var(--line)', fontFamily: MONO, fontSize: 12, fontWeight: 500, color: 'var(--mut)' }}>
              {format(parseISO(`${curMonth}-01`), 'MMM')} budget · {dayLabel(cur.start)} → {dayLabel(cur.end)}
            </span>
          )}
        </div>
      ) : (
        <>
          <div style={{ padding: '14px 24px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {RULES.map(r => {
              const sel = r.id === rule
              return (
                <div
                  key={r.id} role="radio" aria-checked={sel} tabIndex={0}
                  onClick={() => setRule(r.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRule(r.id) } }}
                  style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '14px 16px', borderRadius: 18, border: `1.5px solid ${sel ? 'var(--acc)' : 'var(--line)'}`, background: sel ? 'var(--acc-soft)' : 'transparent', cursor: 'pointer', outline: 'none' }}
                >
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${sel ? 'var(--acc)' : 'var(--line2)'}`, display: 'grid', placeItems: 'center', flex: 'none', boxSizing: 'border-box' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: sel ? 'var(--acc)' : 'transparent' }} />
                  </div>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={rowTitle}>{r.title}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--mut)', marginTop: 2 }}>{r.sub}</div>
                  </div>
                  {r.id === 'fixed-day' && sel && (
                    <label onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--mut)' }}>
                      Day
                      <input
                        className="set-field" inputMode="numeric" value={fixedDay} aria-label="Day of month"
                        onChange={e => setFixedDay(digits(e.target.value).slice(0, 2))}
                        style={{ width: 52, height: 36, borderRadius: 10, background: 'var(--sf)', textAlign: 'center', fontFamily: MONO, fontSize: 15, fontWeight: 500, color: 'var(--ink)', boxSizing: 'border-box' }}
                      />
                      <span style={{ fontFamily: MONO, fontSize: 12 }}>1–31</span>
                    </label>
                  )}
                </div>
              )
            })}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 4px 0', fontSize: 13, lineHeight: 1.5, color: 'var(--mut)' }}>
              <Sym name="info" size={17} style={{ color: 'var(--info)' }} />Salary credited on the last day of a month is budgeted for the next month.
            </div>
          </div>

          {rule !== 'none' && (
            <div style={{ margin: '16px 24px 0', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 16px', background: 'var(--sf2)', fontFamily: MONO, fontSize: 12, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mut)' }}>
                <span>Budget months</span><span>Cycle</span>
              </div>
              {months.map(bm => {
                const override = overrides[bm]
                const start = override ?? autoStart(bm, rule, Number(fixedDay))
                const { end } = getCycleRange(bm, draft)
                const ed = rowEdit === bm
                return (
                  <div key={bm} style={{ display: 'flex', alignItems: 'center', gap: '10px 14px', flexWrap: 'wrap', padding: '12px 16px', borderTop: '1px solid var(--line)', background: ed ? 'var(--acc-soft)' : 'transparent' }}>
                    <div style={{ width: 76, fontFamily: MONO, fontSize: 13.5, fontWeight: 600 }}>{format(parseISO(`${bm}-01`), 'MMM yyyy')}</div>
                    {!ed ? (
                      <>
                        <div style={{ flex: '1 1 220px', display: 'flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 13.5 }}>
                          <span>{dayLabel(start)}</span>
                          <Sym name="arrow_forward" size={16} style={{ color: 'var(--mut)' }} />
                          <span style={{ color: 'var(--mut)' }}>{dayLabel(end)}</span>
                        </div>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 500,
                          ...(override ? { background: 'var(--acc-soft)', border: '1px solid var(--acc-line)', color: 'var(--acc-txt)' } : { background: 'var(--sf2)', border: '1px solid var(--line)', color: 'var(--mut)' }),
                        }}>{override ? 'custom' : 'auto'}</span>
                        {override && (
                          <button
                            onClick={() => { const { [bm]: _, ...rest } = overrides; setOverrides(rest) }}
                            style={{ height: 28, padding: '0 6px', border: 0, background: 'transparent', color: 'var(--acc-txt)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}
                          >Reset to auto</button>
                        )}
                        <button onClick={() => { setRowEdit(bm); setRowDate(start) }} aria-label={`Edit cycle start for ${format(parseISO(`${bm}-01`), 'MMMM yyyy')}`} style={btnIcon(30, 9)}>
                          <Sym name="edit_calendar" size={16} />
                        </button>
                      </>
                    ) : (
                      <div style={{ flex: '1 1 300px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, color: 'var(--mut)' }}>Starts</span>
                        <input
                          type="date" className="set-field" value={rowDate} onChange={e => setRowDate(e.target.value)} autoFocus
                          style={{ height: 36, padding: '0 10px', borderRadius: 10, background: 'var(--sf)', color: 'var(--ink)', fontFamily: MONO, fontSize: 13.5, fontWeight: 500, boxSizing: 'border-box' }}
                        />
                        <div style={{ flex: 1 }} />
                        <button onClick={() => setRowEdit(null)} style={btnOutline(34, 10, 13)}>Cancel</button>
                        <button
                          onClick={() => { if (!rowDate) return; setOverrides({ ...overrides, [bm]: rowDate }); setRowEdit(null) }}
                          disabled={!rowDate} style={{ ...btnPrimary(!!rowDate, 34), padding: '0 14px', borderRadius: 10, fontSize: 13 }}
                        >Save</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <CardFoot style={{ marginTop: 20 }}>
            <button onClick={() => { setEditing(false); setRowEdit(null) }} style={btnOutline(38, 12, 14)}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ ...btnPrimary(), opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save cycle'}</button>
          </CardFoot>
        </>
      )}
    </div>
  )
}

export default function MoneySection() {
  return (
    <>
      <ModeCard />
      <BudgetCard />
      <SalaryCard />
      <VehiclesCard />
    </>
  )
}
