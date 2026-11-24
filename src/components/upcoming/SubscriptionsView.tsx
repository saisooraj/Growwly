'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Radar, Repeat, X } from 'lucide-react'
import {
  CYCLE_SHORT, chargesInMonth, serviceById, QUICK_PICKS,
  type CalendarCharge, type SpottedSubscription, type Subscription,
} from '@/lib/subscriptions'
import type { UpcomingPayment } from '@/types'
import SubTile from './SubTile'
import { subStatus, toneInk } from './SubscriptionSheets'
import { MONTHS, catName, pd, plural, sh } from './upView'

type Money = (n: number, round?: boolean) => string

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }
const eyebrow: CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)' }
const ellipsis: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const tnum: CSSProperties = { fontVariantNumeric: 'tabular-nums' }
const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function SubscriptionsView({ desktop, subs, payments, spotted, today, money, stickyTop, onOpen, onAdd, onTrack, onDismiss }: {
  desktop: boolean
  stickyTop: number
  subs: Subscription[]                 // sorted
  payments: UpcomingPayment[]
  spotted: SpottedSubscription[]
  today: string
  money: Money
  onOpen: (id: string) => void
  onAdd: (serviceId?: string) => void
  onTrack: (s: SpottedSubscription) => void
  onDismiss: (s: SpottedSubscription) => void
}) {
  const phone = !desktop
  const live = subs.filter(s => s.status.kind !== 'cancelled')
  const cancelled = subs.filter(s => s.status.kind === 'cancelled')
  const [showCancelled, setShowCancelled] = useState(false)

  const monthly = live.reduce((a, s) => a + s.monthly, 0)
  const trials = live.filter(s => s.status.kind === 'trial' || s.status.kind === 'trial-ended')
  const trialMonthly = trials.reduce((a, s) => a + s.monthly, 0)
  const next = live.slice().sort((a, b) => a.nextDate.localeCompare(b.nextDate)).find(s => s.nextDate >= today)
  const saved = cancelled.reduce((a, s) => a + s.monthly, 0)
  const attention = live.filter(s => s.status.kind === 'trial-ended' || s.status.kind === 'due' || (s.status.kind === 'trial' && s.status.days <= 3))
  const rest = live.filter(s => !attention.includes(s))

  // ── Empty ──
  if (subs.length === 0) {
    const picks = QUICK_PICKS.slice(0, 6).map(serviceById).filter((s): s is NonNullable<typeof s> => !!s)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {spotted.length > 0 && <Spotted spotted={spotted} money={money} onTrack={onTrack} onDismiss={onDismiss} />}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, padding: phone ? '40px 20px' : '64px 24px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--brand-soft)', color: 'var(--brand-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Repeat size={28} strokeWidth={1.8} /></div>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>No subscriptions yet</div>
          <div style={{ color: 'var(--text-3)', maxWidth: 360, textWrap: 'pretty' } as CSSProperties}>Add the apps and plans you pay for. You’ll see every renewal on a calendar, what they cost a year, and a warning before a free trial starts charging.</div>
          <button onClick={() => onAdd()} style={{ height: 46, padding: '0 22px', borderRadius: 12, border: 0, background: 'var(--brand)', color: 'var(--on-brand)', fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>Add a subscription</button>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
            {picks.map(p => (
              <button key={p.id} onClick={() => onAdd(p.id)} style={{ height: 36, padding: '0 12px 0 6px', borderRadius: 99, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                <SubTile label={p.name} service={p} size={24} />{p.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const summary = (
    <div style={{ ...card, padding: phone ? 18 : '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={eyebrow}>Subscriptions cost you</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
            <span style={{ fontSize: phone ? 34 : 40, fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1.05, ...tnum }}>{money(monthly, true)}</span>
            <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>a month</span>
          </div>
          <div style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 4, ...tnum }}>
            {money(monthly * 12, true)} a year · {plural(live.length, 'subscription')}
          </div>
        </div>
        {next && (
          <button onClick={() => onOpen(next.id)} className="up-hov" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', minWidth: 0, maxWidth: '100%' }}>
            <SubTile label={next.head.label} category={next.head.category} size={34} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Next charge · {sh(next.nextDate)}</div>
              <div style={{ fontWeight: 600, ...ellipsis }}>{next.head.label} · {money(next.head.amount)}</div>
            </div>
          </button>
        )}
      </div>
      {(trials.length > 0 || saved > 0) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {trials.length > 0 && <span style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 99, background: 'var(--warn-soft)', color: 'var(--warn-ink)', ...tnum }}>Includes {money(trialMonthly, true)}/mo from {plural(trials.length, 'trial')}</span>}
          {saved > 0 && <span style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 99, background: 'var(--good-soft)', color: 'var(--good-ink)', ...tnum }}>Saving {money(saved, true)}/mo from {plural(cancelled.length, 'cancellation')}</span>}
        </div>
      )}
    </div>
  )

  const list = (title: string, xs: Subscription[], dotC: string, sub?: string) => xs.length > 0 && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotC }} />
        <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
        {sub && <span style={{ color: 'var(--text-3)', fontSize: 13 }}>{sub}</span>}
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>{xs.map((s, i) => <Row key={s.id} s={s} first={i === 0} money={money} phone={phone} onOpen={onOpen} />)}</div>
    </div>
  )

  const cal = <Calendar subs={subs} payments={payments} today={today} money={money} onOpen={onOpen} phone={phone} />

  const main = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
      {summary}
      {spotted.length > 0 && <Spotted spotted={spotted} money={money} onTrack={onTrack} onDismiss={onDismiss} />}
      {phone && cal}
      {list('Needs a decision', attention, 'var(--bad)', plural(attention.length, 'item'))}
      {list(attention.length ? 'Everything else' : 'Active', rest, 'var(--brand)', `${money(rest.reduce((a, s) => a + s.monthly, 0), true)}/mo`)}
      {cancelled.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => setShowCancelled(v => !v)} aria-expanded={showCancelled} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px', height: 32, border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--text)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-4)' }} />
            <span style={{ fontSize: 15, fontWeight: 600 }}>Cancelled</span>
            <span style={{ color: 'var(--text-3)', fontSize: 13 }}>{cancelled.length}</span>
            <span style={{ flex: 1 }} />
            <ChevronDown size={16} strokeWidth={2} style={{ color: 'var(--text-3)', transform: showCancelled ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          </button>
          {showCancelled && <div style={{ ...card, overflow: 'hidden' }}>{cancelled.map((s, i) => <Row key={s.id} s={s} first={i === 0} money={money} phone={phone} onOpen={onOpen} />)}</div>}
        </div>
      )}
    </div>
  )

  if (phone) return main
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 24, alignItems: 'start' }}>
      {main}
      <div style={{ position: 'sticky', top: stickyTop }}>{cal}</div>
    </div>
  )
}

// ── Row ──────────────────────────────────────────────────────────────────────

function Row({ s, first, money, phone, onOpen }: { s: Subscription; first: boolean; money: Money; phone: boolean; onOpen: (id: string) => void }) {
  const st = subStatus(s)
  const cancelled = s.status.kind === 'cancelled'
  const d = pd(cancelled && s.status.kind === 'cancelled' ? s.status.on : s.nextDate)
  return (
    <div onClick={() => onOpen(s.id)} className="up-hov" style={{ display: 'flex', alignItems: 'center', gap: phone ? 12 : 14, padding: phone ? '12px 12px' : '14px 18px', borderTop: first ? 'none' : '1px solid var(--border)', cursor: 'pointer', transition: 'background .15s' }}>
      <SubTile label={s.head.label} category={s.head.category} size={46} muted={cancelled} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ ...ellipsis, fontWeight: 500, fontSize: 15, color: cancelled ? 'var(--text-3)' : 'var(--text)' }}>{s.head.label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, minWidth: 0 }}>
          <span style={{ ...tnum, color: 'var(--text-2)', whiteSpace: 'nowrap', textDecoration: cancelled ? 'line-through' : 'none' }}>{money(s.head.amount)}<span style={{ color: 'var(--text-3)' }}>{CYCLE_SHORT[s.cycle]}</span></span>
          <span style={{ color: 'var(--text-4)' }}>·</span>
          <span style={{ ...ellipsis, color: toneInk[st.tone], fontWeight: st.tone === 'plain' ? 400 : 500 }}>{st.text}</span>
        </div>
      </div>
      {/* Calendar-page date, like a desk calendar: the strip goes grey once cancelled */}
      <div style={{ width: 46, flexShrink: 0, borderRadius: 11, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 2px 6px -3px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ alignSelf: 'stretch', height: 7, background: cancelled ? 'var(--border-strong)' : 'var(--bad)' }} />
        <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, marginTop: 5, ...tnum, color: cancelled ? 'var(--text-3)' : 'var(--text)' }}>{d.getDate()}</span>
        <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.08em', color: 'var(--text-3)', margin: '3px 0 5px' }}>{MONTHS[d.getMonth()].slice(0, 3).toUpperCase()}</span>
      </div>
    </div>
  )
}

// ── Spotted in spending ──────────────────────────────────────────────────────

function Spotted({ spotted, money, onTrack, onDismiss }: { spotted: SpottedSubscription[]; money: Money; onTrack: (s: SpottedSubscription) => void; onDismiss: (s: SpottedSubscription) => void }) {
  const why = (s: SpottedSubscription) =>
    s.reason === 'repeat' ? `Same amount ${plural(s.count, 'time')}, a month apart`
      : s.reason === 'category' ? `Logged under ${catName('Subscriptions')}`
        : s.count > 1 ? `${plural(s.count, 'charge')} in recent spending` : 'Found in recent spending'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
        <Radar size={16} strokeWidth={2} style={{ color: 'var(--info-ink)' }} />
        <span style={{ fontSize: 15, fontWeight: 600 }}>Spotted in your spending</span>
        <span style={{ color: 'var(--text-3)', fontSize: 13 }}>{spotted.length}</span>
      </div>
      <div style={{ ...card, overflow: 'hidden', borderColor: 'color-mix(in oklab, var(--info) 35%, var(--border))' }}>
        {spotted.map((s, i) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px 12px 14px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
            <SubTile label={s.label} service={s.service} category={s.category} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...ellipsis, fontWeight: 500 }}>{s.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', ...ellipsis }}><span style={tnum}>{money(s.amount)}</span> on {sh(s.lastDate)} · {why(s)}</div>
            </div>
            <button onClick={() => onTrack(s)} style={{ height: 36, padding: '0 12px', borderRadius: 10, border: 0, background: 'var(--brand-soft)', color: 'var(--brand-ink)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}><Plus size={15} strokeWidth={2.4} />Track</button>
            <button onClick={() => onDismiss(s)} aria-label={`${s.label} isn’t a subscription`} title="Not a subscription" style={{ width: 36, height: 36, borderRadius: 10, border: 0, background: 'transparent', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><X size={16} strokeWidth={2} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Calendar ─────────────────────────────────────────────────────────────────

function Calendar({ subs, payments, today, money, onOpen, phone }: {
  subs: Subscription[]; payments: UpcomingPayment[]; today: string; money: Money; onOpen: (id: string) => void; phone: boolean
}) {
  const [ym, setYm] = useState(today.slice(0, 7))
  const [picked, setPicked] = useState<string | null>(null)
  const charges = useMemo(() => chargesInMonth(subs, payments, ym, today), [subs, payments, ym, today])
  const byDay = new Map<string, CalendarCharge[]>()
  for (const c of charges) { const a = byDay.get(c.date); if (a) a.push(c); else byDay.set(c.date, [c]) }

  const first = pd(`${ym}-01`)
  const lead = first.getDay()
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)]
  while (cells.length % 7) cells.push(null)
  const shift = (n: number) => { const d = new Date(first.getFullYear(), first.getMonth() + n, 1); setYm(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); setPicked(null) }
  const total = charges.reduce((a, c) => a + c.amount, 0)
  const dayList = picked ? byDay.get(picked) ?? [] : []
  const cell = phone ? 'min(44px, calc((100vw - 64px) / 7))' : '40px'

  const stateDot = (c: CalendarCharge) => c.state === 'paid' ? 'var(--good)' : c.state === 'due' || c.trial ? 'var(--bad)' : 'var(--text-4)'

  return (
    <div style={{ borderRadius: 'var(--radius-xl)', padding: phone ? '16px 14px' : '18px 18px', color: '#fff', background: 'linear-gradient(160deg, var(--hero-a) 0%, var(--hero-b) 100%)', boxShadow: '0 22px 44px -26px color-mix(in oklab, var(--hero-a) 80%, transparent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>{MONTHS[first.getMonth()]}{first.getFullYear() !== pd(today).getFullYear() ? ` ${first.getFullYear()}` : ''}</div>
          <div style={{ fontSize: 12, opacity: 0.8, ...tnum }}>{charges.length ? `${plural(charges.length, 'charge')} · ${money(total, true)}` : 'No charges'}</div>
        </div>
        <button onClick={() => shift(-1)} aria-label="Previous month" style={{ width: 36, height: 36, borderRadius: 10, border: 0, background: 'rgba(255,255,255,.14)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronLeft size={18} /></button>
        <button onClick={() => shift(1)} aria-label="Next month" style={{ width: 36, height: 36, borderRadius: 10, border: 0, background: 'rgba(255,255,255,.14)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronRight size={18} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, ${cell})`, justifyContent: 'space-between', rowGap: 6 }}>
        {WD.map((w, i) => <span key={i} style={{ fontSize: 11, fontWeight: 600, opacity: 0.6, textAlign: 'center', paddingBottom: 2 }}>{w}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={i} />
          const cs = byDay.get(d) ?? []
          const isToday = d === today, sel = d === picked
          const top = cs[0]
          return (
            <button
              key={d} onClick={() => cs.length && setPicked(sel ? null : d)} disabled={!cs.length}
              aria-label={cs.length ? `${sh(d)}: ${cs.map(c => c.sub.head.label).join(', ')}` : sh(d)}
              style={{
                position: 'relative', width: cell, height: cell, padding: 0, borderRadius: 12, border: 0,
                background: sel ? 'rgba(255,255,255,.28)' : cs.length ? 'rgba(255,255,255,.1)' : 'transparent',
                boxShadow: isToday ? 'inset 0 0 0 1.5px rgba(255,255,255,.85)' : 'none',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: cs.length ? 'pointer' : 'default',
                fontSize: 14, fontWeight: 500, ...tnum,
              }}
            >
              {top
                ? <SubTile label={top.sub.head.label} category={top.sub.head.category} size={phone ? 28 : 26} muted={top.sub.status.kind === 'cancelled' && top.state !== 'paid'} />
                : <span style={{ opacity: d < today ? 0.5 : 0.9 }}>{Number(d.slice(8))}</span>}
              {cs.length > 1 && <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 99, background: '#fff', color: 'var(--hero-a)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{cs.length}</span>}
              {top && <span style={{ position: 'absolute', bottom: 2, width: 5, height: 5, borderRadius: '50%', background: stateDot(top), boxShadow: '0 0 0 1.5px rgba(255,255,255,.9)' }} />}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 11, opacity: 0.85, flexWrap: 'wrap' }}>
        {([['var(--good)', 'Paid'], ['var(--text-4)', 'Coming up'], ['var(--bad)', 'Trial ends / not logged']] as const).map(([c, l]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: c, boxShadow: '0 0 0 1.5px rgba(255,255,255,.9)' }} />{l}</span>
        ))}
      </div>
      {picked && dayList.length > 0 && (
        <div style={{ marginTop: 12, borderRadius: 14, background: 'var(--surface)', color: 'var(--text)', overflow: 'hidden' }}>
          {dayList.map((c, i) => (
            <button key={`${c.sub.id}-${i}`} onClick={() => onOpen(c.sub.id)} className="up-hov" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: 0, borderTop: i ? '1px solid var(--border)' : 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}>
              <SubTile label={c.sub.head.label} category={c.sub.head.category} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, ...ellipsis }}>{c.sub.head.label}</div>
                <div style={{ fontSize: 12, color: c.state === 'due' || c.trial ? 'var(--bad-ink)' : c.state === 'paid' ? 'var(--good-ink)' : 'var(--text-3)' }}>
                  {c.state === 'paid' ? 'Paid' : c.trial ? (c.state === 'due' ? 'Trial ended' : 'Trial ends, first charge') : c.state === 'due' ? 'Not logged yet' : c.projected ? 'Expected renewal' : 'Renews'} · {sh(c.date)}
                </div>
              </div>
              <span style={{ fontWeight: 600, ...tnum }}>{money(c.amount)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
