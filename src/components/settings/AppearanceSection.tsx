'use client'

import { useEffect, useState, type DragEvent } from 'react'
import { useTheme } from 'next-themes'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { useAppStore } from '@/store/appStore'
import { setUserSettings } from '@/lib/firestore'
import { useRefreshData } from '@/hooks/useData'
import { DEFAULT_CARD_ORDER, CARD_LABELS, resolveCardOrder } from '@/lib/dashboardConstants'
import {
  Sym, MONO, card, CardHead, hint, rowTitle, sub, SavedChip, Segmented, Switch, btnPrimary, useSavedFlash,
} from './ui'

export type Accent = 'green' | 'purple' | 'orange' | 'pink' | 'blue' | 'black'

// Swatch colours are the app's --brand for each accent (globals.css), so the swatch is what you get
export const ACCENTS: { id: Accent; name: string; css: string }[] = [
  { id: 'green',  name: 'Forest', css: 'oklch(0.62 0.15 158)' },
  { id: 'purple', name: 'Violet', css: 'oklch(0.585 0.205 286)' },
  { id: 'orange', name: 'Ember',  css: 'oklch(0.66 0.19 42)' },
  { id: 'pink',   name: 'Rose',   css: 'oklch(0.62 0.22 358)' },
  { id: 'blue',   name: 'Ocean',  css: 'oklch(0.54 0.22 261)' },
  { id: 'black',  name: 'Mono',   css: 'linear-gradient(90deg, #14151A 50%, #FFFFFF 50%)' },
]

// ── Theme + accent ──────────────────────────────────────────────────────────

function ThemeAccentCard() {
  const { user } = useAuth()
  const settings = useAppStore(s => s.settings)
  const refresh = useRefreshData()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [accent, setAccent] = useState<Accent>('green')
  const [saved, flash] = useSavedFlash()
  useEffect(() => setMounted(true), [])
  useEffect(() => { if (settings) setAccent((settings.accentColor as Accent) ?? 'green') }, [settings])

  async function saveAccent(color: Accent) {
    if (!user || color === accent) return
    setAccent(color)
    // Apply now for instant feedback; AppShell applies it from settings after the refresh too
    if (color === 'green') document.documentElement.removeAttribute('data-accent')
    else document.documentElement.setAttribute('data-accent', color)
    try {
      await setUserSettings(user.uid, { accentColor: color })
      await refresh()
      flash('accent')
    } catch { toast.error('Failed to save accent') }
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '20px 24px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={rowTitle}>Theme</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 999, background: 'var(--info-bg)', color: 'var(--info)', fontSize: 11, fontWeight: 500 }}>New</span>
            {saved === 'theme' && <SavedChip small />}
          </div>
          <div style={sub}>Same as the switch in the header.</div>
        </div>
        {mounted && (
          <Segmented
            label="Theme" value={(theme ?? 'system') as 'light' | 'dark' | 'system'}
            onPick={t => { if (t !== theme) { setTheme(t); flash('theme') } }}
            options={[
              { id: 'light', label: 'Light', icon: 'light_mode' },
              { id: 'dark', label: 'Dark', icon: 'dark_mode' },
              { id: 'system', label: 'System', icon: 'contrast' },
            ]}
          />
        )}
      </div>

      <CardHead title="Accent colour" saved={saved === 'accent'} pad="20px 24px 0" right={<span style={hint}>Applies instantly, syncs to your account</span>} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '16px 24px 24px' }}>
        <div role="radiogroup" aria-label="Accent colour" style={{ flex: '1 1 300px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8, alignContent: 'start' }}>
          {ACCENTS.map(a => {
            const sel = a.id === accent
            return (
              <button
                key={a.id} role="radio" aria-checked={sel} aria-label={a.name} onClick={() => saveAccent(a.id)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '14px 8px 12px', borderRadius: 18, border: `1.5px solid ${sel ? 'var(--acc)' : 'var(--line)'}`, background: sel ? 'var(--acc-soft)' : 'transparent', cursor: 'pointer', color: 'inherit', transition: 'background .15s, border-color .15s' }}
              >
                <span style={{ width: 38, height: 38, borderRadius: '50%', background: a.css, display: 'grid', placeItems: 'center', boxShadow: 'inset 0 0 0 1px rgba(20,21,26,.12)' }}>
                  <Sym name="check" size={20} style={{ color: '#fff', opacity: sel ? 1 : 0, mixBlendMode: a.id === 'black' ? 'difference' : 'normal' }} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</span>
              </button>
            )
          })}
        </div>
        <div aria-hidden style={{ flex: '1 1 230px', display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 18, background: 'var(--bg)', border: '1px solid var(--line)' }}>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--mut)' }}>Live preview</span>
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, padding: '14px 16px', color: 'var(--on-acc)', background: 'linear-gradient(135deg, var(--acc), color-mix(in oklch, var(--acc) 70%, black))', boxShadow: '0 12px 24px -14px color-mix(in oklch, var(--acc) 80%, transparent)' }}>
            <div style={{ position: 'absolute', right: -40, top: -60, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(closest-side, color-mix(in oklch, var(--acc) 35%, white), transparent)', opacity: 0.6 }} />
            <div style={{ position: 'relative', fontSize: 12, opacity: 0.85 }}>Left to spend this week</div>
            <div style={{ position: 'relative', fontFamily: MONO, fontSize: 22, fontWeight: 500, letterSpacing: '-0.03em', marginTop: 4 }}>₹1,840</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 10, background: 'var(--acc)', color: 'var(--on-acc)', fontSize: 13, fontWeight: 500 }}><Sym name="add" size={16} />Add expense</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 999, background: 'var(--acc-soft)', color: 'var(--acc-txt)', fontSize: 12, fontWeight: 500 }}>On track</span>
            <span style={{ width: 40, height: 24, borderRadius: 12, padding: 3, background: 'var(--acc)', boxSizing: 'border-box' }}>
              <span style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: 'translateX(16px)' }} />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Navigation tabs ─────────────────────────────────────────────────────────

const TABS = [
  { field: 'showHealthTab' as const, name: 'Health', sub: 'Log workouts, sleep, water intake and daily wellness metrics', icon: 'favorite' },
  { field: 'showTasksTab' as const,  name: 'Tasks',  sub: 'A simple to-do list', icon: 'check_circle' },
]

function TabsCard() {
  const { user } = useAuth()
  const settings = useAppStore(s => s.settings)
  const refresh = useRefreshData()
  const [vals, setVals] = useState({ showHealthTab: false, showTasksTab: false })
  const [busy, setBusy] = useState(false)
  const [saved, flash] = useSavedFlash()
  useEffect(() => {
    if (settings) setVals({ showHealthTab: settings.showHealthTab ?? false, showTasksTab: settings.showTasksTab ?? false })
  }, [settings])

  async function toggle(field: keyof typeof vals) {
    if (!user) return
    const next = !vals[field]
    setVals(v => ({ ...v, [field]: next }))
    setBusy(true)
    try {
      await setUserSettings(user.uid, { [field]: next })
      await refresh()
      flash('tabs')
    } catch {
      setVals(v => ({ ...v, [field]: !next }))
      toast.error('Failed to save')
    } finally { setBusy(false) }
  }

  return (
    <div style={card}>
      <CardHead title="Navigation tabs" saved={saved === 'tabs'} pad="22px 24px 10px" right={<span style={hint}>Optional tabs in your sidebar and bottom nav</span>} />
      {TABS.map(t => (
        <div key={t.field} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', borderTop: '1px solid var(--line)' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--sf2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', flex: 'none' }}><Sym name={t.icon} size={21} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={rowTitle}>{t.name}</div>
            <div style={sub}>{t.sub}</div>
          </div>
          <Switch on={vals[t.field]} onClick={() => toggle(t.field)} disabled={busy} label={t.name} />
        </div>
      ))}
    </div>
  )
}

// ── Overview layout ─────────────────────────────────────────────────────────

// Row name, second line, and the block's shape in the mini preview (height px, full or half width)
const OV_META: Record<string, { name: string; sub?: string; h: number; w: 1 | 0.5 }> = {
  month:     { name: 'Month', sub: 'Health score, verdict and pace', h: 46, w: 1 },
  attention: { name: 'Needs attention', h: 26, w: 1 },
  spend:     { name: 'Spent today', h: 30, w: 0.5 },
  week:      { name: 'This week', h: 30, w: 0.5 },
  streak:    { name: 'Money streak', h: 22, w: 1 },
  upcoming:  { name: 'Upcoming', h: 30, w: 1 },
  emergency: { name: 'Emergency fund', h: 28, w: 0.5 },
  savings:   { name: 'Savings', h: 28, w: 0.5 },
  loans:     { name: 'Loans', h: 26, w: 0.5 },
  goals:     { name: 'Goals', h: 26, w: 0.5 },
  trends:    { name: 'Trends', sub: 'Categories and in vs out', h: 40, w: 1 },
}
const metaOf = (id: string) => OV_META[id] ?? { name: CARD_LABELS[id] ?? id, h: 28, w: 1 as const }
const TRAY = 'tray'
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])

function OverviewCard({ compact }: { compact?: boolean }) {
  const { user } = useAuth()
  const settings = useAppStore(s => s.settings)
  const refresh = useRefreshData()
  const savedOrder = resolveCardOrder(settings?.dashboardCardOrder)
  const savedHidden = settings?.dashboardHiddenCards ?? []
  const [order, setOrder] = useState<string[]>(savedOrder)
  const [hidden, setHidden] = useState<string[]>(savedHidden)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, flash] = useSavedFlash()

  useEffect(() => {
    setOrder(resolveCardOrder(settings?.dashboardCardOrder))
    setHidden(settings?.dashboardHiddenCards ?? [])
  }, [settings?.dashboardCardOrder, settings?.dashboardHiddenCards])

  const dirty = !same(order, savedOrder) || !same([...hidden].sort(), [...savedHidden].sort())
  const toggleHidden = (id: string) => setHidden(h => (h.includes(id) ? h.filter(x => x !== id) : [...h, id]))
  const swap = (i: number, j: number) => { const a = order.slice(); [a[i], a[j]] = [a[j], a[i]]; setOrder(a) }
  // Drop `from` just above `to` ('__end' puts it last)
  const move = (from: string, to: string) => {
    const a = order.filter(x => x !== from)
    const i = a.indexOf(to)
    a.splice(i < 0 ? a.length : i, 0, from)
    setOrder(a)
  }
  const endDrag = () => { setDragId(null); setOverId(null) }
  const over = (id: string) => (e: DragEvent) => { e.preventDefault(); if (overId !== id) setOverId(id) }
  const drop = (to: string) => (e: DragEvent) => { e.preventDefault(); if (dragId && dragId !== to) move(dragId, to); endDrag() }

  async function save() {
    if (!user) return
    setSaving(true)
    try {
      await setUserSettings(user.uid, { dashboardCardOrder: order, dashboardHiddenCards: hidden })
      await refresh()
      flash('overview')
    } catch {
      toast.error('Failed to save order')
    } finally {
      setSaving(false)
    }
  }

  const trayHidden = hidden.includes(TRAY)
  const dropLine = (soft: boolean) => (
    <div style={{ position: 'absolute', left: 4, right: 4, top: -5, height: 3, borderRadius: 2, background: 'var(--acc)', boxShadow: soft ? '0 0 0 3px var(--acc-soft)' : undefined }} />
  )
  const eyeBtn = (isHidden: boolean, label: string, onClick: () => void) => (
    <button onClick={onClick} aria-label={label} aria-pressed={!isHidden} style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--sf)', color: isHidden ? 'var(--mut)' : 'var(--acc-txt)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}>
      <Sym name={isHidden ? 'visibility_off' : 'visibility'} size={18} />
    </button>
  )
  const arrow = (dir: 'up' | 'down', off: boolean, onClick: () => void, name: string) => (
    <button onClick={onClick} disabled={off} aria-label={`Move ${name} ${dir}`} style={{ width: 28, height: 28, borderRadius: 8, border: 0, background: 'transparent', color: 'var(--mut)', display: 'grid', placeItems: 'center', cursor: off ? 'default' : 'pointer', opacity: off ? 0.3 : 1, flex: 'none' }}>
      <Sym name={dir === 'up' ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} size={18} />
    </button>
  )

  const preview = order.filter(id => !hidden.includes(id)).map(id => {
    const m = metaOf(id), drg = id === dragId
    return (
      <div key={id} style={{
        width: m.w < 1 ? 'calc(50% - 3px)' : '100%', height: m.h, borderRadius: 7, boxSizing: 'border-box', padding: '5px 6px',
        background: id === 'month' ? 'var(--acc)' : drg ? 'var(--acc-soft)' : 'var(--sf)',
        color: id === 'month' ? 'var(--on-acc)' : drg ? 'var(--acc-txt)' : 'var(--mut)',
        border: `1px solid ${drg ? 'var(--acc)' : 'var(--line)'}`,
        fontSize: 9, fontWeight: 500, lineHeight: 1.2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', transition: 'all .2s',
      }}>{m.name}</div>
    )
  })

  return (
    <div style={card}>
      <div style={{ padding: '22px 24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>Overview layout</div>
          {saved === 'overview' && <SavedChip />}
        </div>
        <div style={{ ...sub, marginTop: 4 }}>Drag blocks to reorder, or use the arrows. Hidden blocks stay off your Overview.</div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, padding: '0 24px 20px', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {order.map((id, i) => {
            const m = metaOf(id), hid = hidden.includes(id), drg = id === dragId, last = i === order.length - 1
            return (
              <div key={id} onDragOver={over(id)} onDrop={drop(id)} style={{ position: 'relative', zIndex: drg ? 3 : 1 }}>
                {overId === id && !drg && dropLine(true)}
                <div
                  draggable onDragStart={e => { try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id) } catch { /* old browsers */ } setDragId(id) }}
                  onDragEnd={endDrag}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px 7px 6px', borderRadius: 14,
                    border: `1px solid ${drg ? 'var(--acc)' : 'var(--line)'}`, background: drg ? 'var(--sf)' : 'var(--sf2)',
                    boxShadow: drg ? '0 18px 36px -14px rgba(20,21,26,.4)' : 'none',
                    transform: drg ? 'translateX(6px) rotate(-0.6deg) scale(1.015)' : 'none', transition: 'transform .15s, box-shadow .15s',
                  }}
                >
                  <Sym name="drag_indicator" size={20} style={{ color: 'var(--mut)', cursor: 'grab' }} />
                  <span style={{ width: 20, fontFamily: MONO, fontSize: 11.5, fontWeight: 500, color: 'var(--mut)' }}>{String(i + 1).padStart(2, '0')}</span>
                  <div style={{ flex: 1, minWidth: 0, opacity: hid ? 0.45 : 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.3, textDecoration: hid ? 'line-through' : 'none' }}>{m.name}</div>
                    {m.sub && <div style={{ fontSize: 12, lineHeight: 1.35, color: 'var(--mut)', textDecoration: hid ? 'line-through' : 'none' }}>{m.sub}</div>}
                  </div>
                  {arrow('up', i === 0, () => i > 0 && swap(i - 1, i), m.name)}
                  {arrow('down', last, () => !last && swap(i, i + 1), m.name)}
                  {eyeBtn(hid, hid ? `Show ${m.name}` : `Hide ${m.name}`, () => toggleHidden(id))}
                </div>
              </div>
            )
          })}
          <div onDragOver={over('more')} onDrop={e => { e.preventDefault(); if (dragId) move(dragId, '__end'); endDrag() }} style={{ position: 'relative' }}>
            {overId === 'more' && dropLine(false)}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px 7px 6px', borderRadius: 14, border: '1px dashed var(--line2)' }}>
              <Sym name="lock" size={19} style={{ color: 'var(--mut)', width: 20, textAlign: 'center' }} />
              <span style={{ width: 20, fontFamily: MONO, fontSize: 11.5, fontWeight: 500, color: 'var(--mut)' }}>{String(order.length + 1).padStart(2, '0')}</span>
              <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, opacity: trayHidden ? 0.45 : 1, textDecoration: trayHidden ? 'line-through' : 'none' }}>More you can track</div>
              <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 999, background: 'var(--sf2)', border: '1px solid var(--line)', color: 'var(--mut)', fontSize: 11.5, fontWeight: 500, whiteSpace: 'nowrap' }}>Always last</span>
              {eyeBtn(trayHidden, trayHidden ? 'Show More you can track' : 'Hide More you can track', () => toggleHidden(TRAY))}
            </div>
          </div>
        </div>

        {!compact && (
          <div style={{ flex: '0 0 200px', position: 'sticky', top: 110, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--mut)' }}>Overview preview</span>
            <div aria-hidden style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 10, borderRadius: 18, background: 'var(--bg)', border: '1px solid var(--line)' }}>
              {preview}
              {!trayHidden && (
                <div style={{ width: '100%', height: 22, borderRadius: 7, boxSizing: 'border-box', padding: '5px 6px', background: 'transparent', color: 'var(--mut)', border: '1px solid var(--line2)', fontSize: 9, fontWeight: 500, lineHeight: 1.2, overflow: 'hidden', whiteSpace: 'nowrap' }}>More you can track</div>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '14px 24px', borderTop: '1px solid var(--line)', background: 'var(--sf2)' }}>
        <button
          onClick={() => { setOrder(DEFAULT_CARD_ORDER); setHidden([]) }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 10px', border: 0, borderRadius: 10, background: 'transparent', color: 'var(--mut)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}
        >
          <Sym name="restart_alt" size={18} />Reset to default
        </button>
        <div style={{ flex: 1 }} />
        {dirty && <span style={{ fontSize: 13, color: 'var(--mut)' }}>Unsaved changes</span>}
        <button onClick={save} disabled={!dirty || saving} style={btnPrimary(dirty && !saving)}>{saving ? 'Saving…' : 'Save layout'}</button>
      </div>
    </div>
  )
}

export default function AppearanceSection({ compact }: { compact?: boolean }) {
  return (
    <>
      <ThemeAccentCard />
      <TabsCard />
      <OverviewCard compact={compact} />
    </>
  )
}
