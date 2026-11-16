'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Dialog } from '@headlessui/react'
import { addMonths, format, getDaysInMonth, parseISO } from 'date-fns'
import { Check, ChevronLeft, ChevronRight, Download, Globe, Hash, Search, Shapes, CalendarRange, X } from 'lucide-react'
import { CategoryIcon } from '@/lib/categoryIcons'
import { MONO, avatarStyle } from './txnView'

export type FilterType = 'all' | 'expense' | 'income' | 'savings' | 'transfer'

export interface Filters {
  type: FilterType
  cat: string | null
  tag: string | null
  vehicle: string | null
  from: string | null
  to: string | null
  preset: string | null
  q: string
}

export const TYPE_OPTS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'expense', label: 'Expenses' },
  { id: 'income', label: 'Income' },
  { id: 'savings', label: 'Savings' },
  { id: 'transfer', label: 'Transfers' },
]

export interface CatItem { id: string; name: string; color: string; count: number; custom: boolean }
export interface TagItem { tag: string; count: number }
export interface Preset { id: string; label: string; sub: string; from: string | null; to: string | null }
export interface VehicleItem { id: string | null; label: string; icon?: ReactNode }

// ── Shared styles ─────────────────────────────────────────────────────────────

export const chipStyle = (active: boolean, phone: boolean): CSSProperties => ({
  height: phone ? 44 : 36, padding: phone ? '0 16px' : '0 12px', display: 'inline-flex', alignItems: 'center', gap: 6,
  flex: 'none', borderRadius: 999, border: `1px solid ${active ? 'var(--t1)' : 'var(--border)'}`,
  background: active ? 'var(--t1)' : 'var(--surface)', color: active ? 'var(--bg)' : 'var(--t1)',
  fontSize: phone ? 14 : 13, fontWeight: 600, whiteSpace: 'nowrap',
  transition: 'background .18s cubic-bezier(0.23,1,0.32,1), color .18s',
})

export const segStyle = (active: boolean): CSSProperties => ({
  height: 36, padding: '0 14px', border: 0, borderRadius: 9, fontSize: 13, fontWeight: 600,
  background: active ? 'var(--surface)' : 'transparent', color: active ? 'var(--t1)' : 'var(--t2)',
  boxShadow: active ? '0 1px 2px rgba(0,0,0,.08), 0 0 0 1px var(--border)' : 'none',
  transition: 'background .18s cubic-bezier(0.23,1,0.32,1), color .18s',
})

export const EYEBROW: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--t3)' }

const iconBtn: CSSProperties = { width: 44, height: 44, border: 0, borderRadius: 999, background: 'var(--s2)', display: 'grid', placeItems: 'center', color: 'var(--t1)', flex: 'none' }

// ── Category list ─────────────────────────────────────────────────────────────

export function CategoryList({ exp, inc, selected, onPick, phone, query, onQuery }: {
  exp: CatItem[]; inc: CatItem[]; selected: string | null; onPick: (id: string) => void
  phone: boolean; query: string; onQuery: (q: string) => void
}) {
  const q = query.trim().toLowerCase()
  const e = exp.filter(c => !q || c.name.toLowerCase().includes(q))
  const i = inc.filter(c => !q || c.name.toLowerCase().includes(q))
  const item = (c: CatItem) => {
    const sel = selected === c.id
    return (
      <button key={c.id} className="txn-hover" onClick={() => onPick(c.id)} style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: phone ? 48 : 40, padding: '0 10px', border: 0,
        borderRadius: 10, background: sel ? 'var(--good-soft)' : 'transparent', color: 'var(--t1)', fontSize: phone ? 16 : 14,
        fontWeight: sel ? 600 : 500, textAlign: 'left',
      }}>
        <span style={avatarStyle(c.color, 28, 8)}><CategoryIcon category={c.id} size={15} color={c.color} stroke={2} /></span>
        <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{c.name}</span>
        {c.custom && <span style={{ fontSize: phone ? 12 : 11, color: 'var(--t3)' }}>custom</span>}
        <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--t3)' }}>{c.count || ''}</span>
        {sel && <Check size={phone ? 18 : 16} color="var(--good-ink)" />}
      </button>
    )
  }
  return (
    <>
      <div style={{ padding: phone ? '4px 16px 8px' : '0 0 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: phone ? 10 : 8, height: phone ? 48 : 40, padding: phone ? '0 14px' : '0 12px', borderRadius: phone ? 14 : 10, background: 'var(--s2)' }}>
          <Search size={phone ? 17 : 15} color="var(--t3)" style={{ flex: 'none' }} />
          <input
            value={query} onChange={ev => onQuery(ev.target.value)} autoFocus={!phone}
            placeholder={`Search ${exp.length + inc.length} categories`}
            style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', font: 'inherit', fontSize: phone ? 16 : 14, color: 'var(--t1)' }}
          />
        </div>
      </div>
      <div style={phone ? { flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 8px 8px' } : { maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {e.length > 0 && <div style={{ ...EYEBROW, padding: phone ? '8px 12px 4px' : '8px 10px 4px' }}>Expense</div>}
        {e.map(item)}
        {i.length > 0 && <div style={{ ...EYEBROW, padding: phone ? '14px 12px 4px' : '12px 10px 4px' }}>Income</div>}
        {i.map(item)}
        {!e.length && !i.length && (phone
          ? <div style={{ padding: '20px 12px', fontSize: 14, color: 'var(--t2)' }}>No category matches “{query.trim()}”</div>
          : <div style={{ padding: '20px 10px', fontSize: 13, color: 'var(--t2)', textAlign: 'center' }}>No category called “{query.trim()}”</div>)}
      </div>
    </>
  )
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export function TagChips({ tags, selected, onPick, phone }: { tags: TagItem[]; selected: string | null; onPick: (t: string) => void; phone: boolean }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignContent: 'flex-start' }}>
      {tags.map(t => (
        <button key={t.tag} onClick={() => onPick(t.tag)} style={chipStyle(selected === t.tag, phone)}>
          #{t.tag}
          {t.count > 0 && <span style={{ fontFamily: MONO, fontSize: phone ? 12 : 11, opacity: 0.6 }}>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

// ── Date range ────────────────────────────────────────────────────────────────

export function DateRangePicker({ presets, from, to, preset, onChange, phone, homeMonth, today }: {
  presets: Preset[]; from: string | null; to: string | null; preset: string | null
  onChange: (p: { from: string | null; to: string | null; preset: string | null }) => void
  phone: boolean; homeMonth: string; today: string
}) {
  const [month, setMonth] = useState(() => (to ?? from ?? today).slice(0, 7))
  const first = parseISO(`${month}-01`)
  const offset = (first.getDay() + 6) % 7
  const days = getDaysInMonth(first)
  const canNext = month < today.slice(0, 7)

  function pick(d: string) {
    if (!from || to) onChange({ from: d, to: null, preset: 'custom' })
    else if (d < from) onChange({ from: d, to: from, preset: 'custom' })
    else onChange({ from, to: d, preset: 'custom' })
  }

  const cellH = phone ? 44 : 34
  const navBtn: CSSProperties = { width: phone ? 32 : 26, height: phone ? 32 : 26, border: 0, borderRadius: 999, background: 'transparent', display: 'grid', placeItems: 'center', color: 'var(--t2)' }

  const presetList = (
      <div style={phone ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 } : { display: 'flex', flexDirection: 'column', gap: 6 }}>
        {presets.map(p => {
          const sel = preset === p.id
          return (
            <button key={p.id} onClick={() => onChange({ from: p.from, to: p.to, preset: p.id })} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, width: '100%', padding: phone ? '12px 14px' : '10px 12px',
              border: `1px solid ${sel ? 'var(--good)' : 'var(--border)'}`, borderRadius: 12, background: sel ? 'var(--good-soft)' : 'var(--surface)',
              color: 'var(--t1)', fontSize: 14, fontWeight: 600, textAlign: 'left',
            }}>
              {p.label}
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t2)' }}>{p.sub}</span>
            </button>
          )
        })}
      </div>
  )
  const nav = (
    <>
      <button aria-label="Previous month" onClick={() => setMonth(format(addMonths(first, -1), 'yyyy-MM'))} style={navBtn}><ChevronLeft size={16} /></button>
      <button aria-label="Next month" disabled={!canNext} onClick={() => setMonth(format(addMonths(first, 1), 'yyyy-MM'))} style={{ ...navBtn, opacity: canNext ? 1 : 0.35 }}><ChevronRight size={16} /></button>
    </>
  )

  const calendar = (
    <>
      {phone ? (
        <div style={{ display: 'flex', alignItems: 'center', padding: '18px 4px 8px' }}>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>{format(first, 'MMMM yyyy')}</span>
          {nav}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 4px 10px' }}>
          <span style={{ fontSize: 14, fontWeight: 700, marginRight: 4 }}>{format(first, 'MMMM yyyy')}</span>
          {nav}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--t3)' }}>Tap start, then end</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', fontSize: 11, color: 'var(--t3)', textAlign: 'center', fontWeight: 600, paddingBottom: 4 }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', rowGap: 2 }}>
        {Array.from({ length: offset }, (_, i) => <div key={`b${i}`} style={{ height: cellH }} />)}
        {Array.from({ length: days }, (_, i) => {
          const ds = `${month}-${String(i + 1).padStart(2, '0')}`
          const fut = ds > today
          const end = ds === from || ds === to
          const inR = !!from && !!to && ds > from && ds < to
          return (
            <div key={ds} role={fut ? undefined : 'button'} onClick={fut ? undefined : () => pick(ds)} style={{
              height: cellH, display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 13,
              borderRadius: inR ? 0 : 10, cursor: fut ? 'default' : 'pointer',
              background: end ? 'var(--good)' : inR ? 'var(--good-soft)' : 'transparent',
              color: end ? '#fff' : fut ? 'var(--t4)' : inR ? 'var(--good-ink)' : 'var(--t1)',
              fontWeight: end || ds === today ? 700 : 400,
              boxShadow: ds === today && !end ? 'inset 0 0 0 1px var(--t3)' : 'none',
            }}>{i + 1}</div>
          )
        })}
      </div>
      {phone ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--info-soft)', color: 'var(--info-ink)', fontSize: 13, lineHeight: 1.45, fontWeight: 500 }}>
          <Globe size={15} style={{ flex: 'none', marginTop: 2 }} />
          A date range looks across all months, not just {homeMonth}.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--info-soft)', color: 'var(--info-ink)', fontSize: 12, lineHeight: 1.45, fontWeight: 500 }}>
          <Globe size={14} style={{ flex: 'none', marginTop: 1 }} />
          A date range looks across all months — it replaces the month switcher until you clear it.
        </div>
      )}
    </>
  )

  return phone
    ? <>{presetList}{calendar}</>
    : <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 16 }}>{presetList}<div>{calendar}</div></div>
}

// ── Phone: one bottom sheet with drill-in pickers ─────────────────────────────

type SheetView = 'main' | 'cat' | 'tag' | 'date'

export function FilterSheet({
  open, onClose, initialView = 'main', filters, setFilters, clearAll, resultCount,
  exp, inc, tags, presets, vehicles, homeMonth, today, onExport, exportCount, dateLabel,
}: {
  open: boolean; onClose: () => void; initialView?: SheetView
  filters: Filters; setFilters: (p: Partial<Filters>) => void; clearAll: () => void; resultCount: number
  exp: CatItem[]; inc: CatItem[]; tags: TagItem[]; presets: Preset[]; vehicles: VehicleItem[]
  homeMonth: string; today: string; onExport: () => void; exportCount: number; dateLabel: string
}) {
  const [view, setView] = useState<SheetView>(initialView)
  const [catQ, setCatQ] = useState('')
  useEffect(() => { if (open) { setView(initialView); setCatQ('') } }, [open, initialView])

  const showCat = filters.type !== 'savings' && filters.type !== 'transfer'
  const allCats = [...exp, ...inc]
  const catValue = filters.cat ? allCats.find(c => c.id === filters.cat)?.name ?? filters.cat : 'Any'

  const head = (title: string, back: boolean, close = true) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: back ? '6px 8px' : '6px 8px 6px 20px' }}>
      {back && <button onClick={() => { setView('main'); setCatQ('') }} aria-label="Back" style={{ ...iconBtn, background: 'transparent' }}><ChevronLeft size={20} /></button>}
      <Dialog.Title style={{ flex: 1, margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</Dialog.Title>
      {close && <button onClick={onClose} aria-label="Close" style={iconBtn}><X size={18} /></button>}
    </div>
  )
  const navRow = (icon: ReactNode, label: string, value: string, onClick: () => void) => (
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, border: 0, borderBottom: '1px solid var(--border)', background: 'transparent', color: 'var(--t1)', padding: '0 4px' }}>
      {icon}
      <span style={{ flex: 1, textAlign: 'left', fontSize: 16, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 15, color: 'var(--t2)', maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
      <ChevronRight size={16} color="var(--t3)" style={{ flex: 'none' }} />
    </button>
  )

  return (
    <Dialog open={open} onClose={onClose} className="txn-scope" style={{ position: 'relative', zIndex: 50 }}>
      <div className="txn-anim-fade" style={{ position: 'fixed', inset: 0, background: 'var(--scrim)' }} aria-hidden />
      <Dialog.Panel className="txn-anim-sheet" style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, height: '84%', display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', color: 'var(--t1)', borderRadius: '24px 24px 0 0', boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}><span style={{ width: 36, height: 5, borderRadius: 3, background: 'var(--s3)' }} /></div>

        {view === 'main' && (
          <>
            {head('Filters', false)}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 16px' }}>
              <div style={{ ...EYEBROW, padding: '8px 4px' }}>Type</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {TYPE_OPTS.map(o => (
                  <button key={o.id} onClick={() => setFilters({ type: o.id, cat: o.id === 'savings' || o.id === 'transfer' ? null : filters.cat, vehicle: o.id === 'savings' ? filters.vehicle : null })} style={chipStyle(filters.type === o.id, true)}>{o.label}</button>
                ))}
              </div>
              {filters.type === 'savings' && vehicles.length > 1 && (
                <>
                  <div style={{ ...EYEBROW, padding: '18px 4px 8px' }}>Vehicle</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {vehicles.map(v => (
                      <button key={v.label} onClick={() => setFilters({ vehicle: v.id })} style={chipStyle(filters.vehicle === v.id, true)}>{v.icon}{v.label}</button>
                    ))}
                  </div>
                </>
              )}
              <div style={{ marginTop: 18, borderTop: '1px solid var(--border)' }}>
                {showCat && navRow(<Shapes size={18} color="var(--t2)" />, 'Category', catValue, () => setView('cat'))}
                {tags.length > 0 && navRow(<Hash size={18} color="var(--t2)" />, 'Tag', filters.tag ? `#${filters.tag}` : 'Any', () => setView('tag'))}
                {navRow(<CalendarRange size={18} color="var(--t2)" />, 'Date range', filters.from || filters.to ? dateLabel : 'This month', () => setView('date'))}
                {navRow(<Download size={18} color="var(--t2)" />, 'Export CSV', `${exportCount} ${exportCount === 1 ? 'row' : 'rows'}`, onExport)}
              </div>
            </div>
          </>
        )}

        {view === 'cat' && (
          <>
            {head('Category', true)}
            <CategoryList
              exp={exp} inc={inc} selected={filters.cat} phone query={catQ} onQuery={setCatQ}
              onPick={id => { setFilters({ cat: filters.cat === id ? null : id }); setView('main'); setCatQ('') }}
            />
          </>
        )}

        {view === 'tag' && (
          <>
            {head('Tag', true, false)}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 16px' }}>
              <TagChips tags={tags} selected={filters.tag} phone onPick={t => { setFilters({ tag: filters.tag === t ? null : t }); setView('main') }} />
            </div>
          </>
        )}

        {view === 'date' && (
          <>
            {head('Date range', true, false)}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 16px 8px' }}>
              <DateRangePicker presets={presets} from={filters.from} to={filters.to} preset={filters.preset} onChange={p => setFilters(p)} phone homeMonth={homeMonth} today={today} />
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, padding: '12px 16px max(20px, calc(env(safe-area-inset-bottom, 0px) + 2px))', borderTop: '1px solid var(--border)' }}>
          <button onClick={clearAll} style={{ height: 50, padding: '0 18px', border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', fontSize: 16, fontWeight: 600, color: 'var(--t1)' }}>Clear all</button>
          <button onClick={onClose} style={{ flex: 1, height: 50, border: 0, borderRadius: 14, background: 'var(--t1)', fontSize: 16, fontWeight: 600, color: 'var(--bg)' }}>
            {resultCount ? `Show ${resultCount} ${resultCount === 1 ? 'result' : 'results'}` : 'No matches'}
          </button>
        </div>
      </Dialog.Panel>
    </Dialog>
  )
}

// ── Desktop: popover under a chip ─────────────────────────────────────────────

export function Popover({ open, onClose, anchor, children, width = 320, align = 'left', top = 44, padding = 8, radius = 18 }: {
  open: boolean; onClose: () => void; anchor: ReactNode; children: ReactNode; width?: number; align?: 'left' | 'right'
  top?: number; padding?: number; radius?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, onClose])
  return (
    <div ref={ref} style={{ position: 'relative', flex: 'none' }}>
      {anchor}
      {open && (
        <div className="txn-anim-pop-sm" style={{
          position: 'absolute', top, [align]: 0, zIndex: 30, width, padding,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: radius, boxShadow: 'var(--shadow-lg)',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}
