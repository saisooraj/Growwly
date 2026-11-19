'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  IconArrowRight, IconArrowsSort, IconCheck, IconChevronDown, IconChevronUp, IconCircleCheck, IconCrane, IconEye,
  IconEyeOff, IconHeartbeat, IconLock, IconMinus, IconPencil, IconPigMoney, IconPlus, IconSparkles, IconTargetArrow, IconTrash,
} from '@tabler/icons-react'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import { usePrivacy } from '@/store/privacyStore'
import { useIsDesktop } from '@/components/transactions/TransactionDetailModal'
import AddTransactionModal from '@/components/transactions/AddTransactionModal'
import { addProject, addSavingsGoal, deleteProject, deleteSavingsGoal, updateProject, updateSavingsGoal } from '@/lib/firestore'
import { goalsOnTrack } from '@/lib/pulse'
import { MASK } from '@/components/overview/ui'
import {
  SORTS, SORT_FNS, byDeadline, digits, goalView, inr, labelOf, nameOf, projectView,
  type GoalView, type ProjectView, type SortKey,
} from './goalsModel'
import { Ctx, MONO, Overlay, POP_SHADOW, SERIF, Seg, Tile, type GoalsCtx, type LongPress, type MenuItem } from './goalsUi'
import { DoneRow, GoalCard, ProjectCard } from './GoalsCards'
import {
  ActionSheet, AddMoney, Celebrate, DeleteConfirm, GoalDetail, GoalForm, NewMenu, ProjectForm,
  type GoalDraft, type ProjectDraft,
} from './GoalsSheets'

type Filter = 'all' | 'goals' | 'projects'
type OverlayKind = 'detail' | 'addMoney' | 'celebrate' | 'goalForm' | 'projectForm' | 'delete' | 'menu' | 'newMenu'
const WIDTH: Record<OverlayKind, number> = { detail: 620, goalForm: 580, projectForm: 580, addMoney: 460, celebrate: 440, delete: 440, menu: 420, newMenu: 460 }
const LIMIT = 8
// The local AI flag (lib/ai/local/flag), written out so production builds drop the coach card
const LOCAL_AI = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_AI_LOCAL === '1'
const FONT = (w: number, s: number) => `${w} ${s}px 'Plus Jakarta Sans',sans-serif`

export default function GoalsPage() {
  const desktop = useIsDesktop()
  const { user } = useAuth()
  const refresh = useRefreshData()
  const { savingsGoals, projects, transactions, initialized } = useAppStore()
  const masked = usePrivacy(s => s.masked)
  const togglePrivacy = usePrivacy(s => s.toggle)
  const hydratePrivacy = usePrivacy(s => s.hydrate)
  useEffect(() => { hydratePrivacy() }, [hydratePrivacy])

  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t) }, [])

  const [filter, setFilter] = useState<Filter>('all')
  // /goals?filter=projects (where the old /projects page sends you) opens on that section
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get('filter')
    if (f === 'goals' || f === 'projects') setFilter(f)
  }, [])
  const [sort, setSort] = useState<SortKey>('attention')
  const [sortOpen, setSortOpen] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [doneOpen, setDoneOpen] = useState(true)
  const [moreGoals, setMoreGoals] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [showN, setShowN] = useState<Record<string, number>>({})
  const [ov, setOv] = useState<{ kind: OverlayKind; id: string | null; mode?: 'add' | 'withdraw' } | null>(null)
  const [addTxOpen, setAddTxOpen] = useState(false)

  // ── Press and hold to peek at one card's amounts while privacy is on ────────────
  const [revealed, setRevealed] = useState<string | null>(null)
  const lpTimer = useRef<ReturnType<typeof setTimeout>>()
  const rvTimer = useRef<ReturnType<typeof setTimeout>>()
  const lpFired = useRef(false)
  useEffect(() => () => { clearTimeout(lpTimer.current); clearTimeout(rvTimer.current) }, [])
  const lp = useCallback((id: string): LongPress => {
    if (!masked) return {}
    const up = () => clearTimeout(lpTimer.current)
    return {
      onPointerDown: () => {
        lpFired.current = false
        clearTimeout(lpTimer.current)
        lpTimer.current = setTimeout(() => {
          lpFired.current = true
          setRevealed(id)
          clearTimeout(rvTimer.current)
          rvTimer.current = setTimeout(() => setRevealed(null), 3000)
        }, 500)
      },
      onPointerUp: up, onPointerLeave: up, onPointerCancel: up,
      onContextMenu: e => e.preventDefault(),
    }
  }, [masked])
  const ctx: GoalsCtx = useMemo(() => ({
    desktop, mounted, lp,
    m: (v, id) => (v < 0 ? '−' : '') + (masked && revealed !== id ? MASK : `₹${inr(v)}`),
    consumeLongPress: () => { const f = lpFired.current; lpFired.current = false; return f },
  }), [desktop, mounted, lp, masked, revealed])
  const m = ctx.m

  // ── Derived data ───────────────────────────────────────────────────────────────
  const now = useMemo(() => new Date(), [])
  const goals = useMemo(() => savingsGoals.map(g => goalView(g, transactions, now)), [savingsGoals, transactions, now])
  const projViews = useMemo(() => projects.map(p => projectView(p, transactions)), [projects, transactions])

  const active = goals.filter(g => g.status !== 'reached').sort(SORT_FNS[sort])
  const done = goals.filter(g => g.status === 'reached')
  const visible = active.length > LIMIT + 1 && !moreGoals ? active.slice(0, LIMIT) : active
  const act = projViews.filter(p => p.project.status === 'active').sort((a, b) => Number(b.over) - Number(a.over) || b.raw - a.raw)
  const other = projViews.filter(p => p.project.status !== 'active').sort((a, b) => b.project.status.localeCompare(a.project.status))
  const projGroups = [act.length ? { label: 'Active', items: act } : null, other.length ? { label: 'Paused & completed', items: other } : null]
    .filter((x): x is { label: string; items: ProjectView[] } => !!x)
  const projDelay = (p: ProjectView) => `${(visible.length + 3 + projViews.indexOf(p)) * 40}ms`

  const loading = !initialized
  const emptyAll = !loading && !goals.length && !projViews.length

  // ── Hero ───────────────────────────────────────────────────────────────────────
  const counted = goals.filter(g => g.status !== 'notarget')
  const total = counted.length, onN = counted.filter(g => g.on).length, behindN = total - onN
  const tSaved = goals.reduce((s, g) => s + g.goal.currentAmount, 0), tTarget = goals.reduce((s, g) => s + g.goal.targetAmount, 0)
  const tToGo = goals.reduce((s, g) => s + g.remaining, 0)
  const monthly = goals.filter(g => g.need != null && !g.past).reduce((s, g) => s + (g.need ?? 0), 0)
  const overdueAmt = goals.filter(g => g.status === 'overdue').reduce((s, g) => s + g.remaining, 0)
  const aB = act.reduce((s, p) => s + p.project.totalBudget, 0), aP = act.reduce((s, p) => s + p.paid, 0)
  const within = act.filter(p => !p.over).length, overs = act.filter(p => p.over)
  const overSum = overs.reduce((s, p) => s + (p.paid - p.project.totalBudget), 0)
  const notOn = counted.filter(g => !g.on)
  const parts: string[] = []
  if (notOn.length && notOn.length <= 2) parts.push(notOn.map(g => `${g.goal.name} is ${g.status === 'overdue' ? 'overdue' : g.status === 'notstarted' ? 'not started' : 'behind'}`).join(', '))
  else if (notOn.length) parts.push(`${notOn.length} goals need attention`)
  if (overs.length === 1) parts.push(`${overs[0].project.name} is over budget`)
  else if (overs.length) parts.push(`${overs.length} projects are over budget`)
  const near = act.filter(p => !p.over && p.raw > 80)
  if (near.length === 1) parts.push(`${near[0].project.name} has used ${Math.round(near[0].raw)}% of its budget`)
  const headline = total ? (behindN ? `${onN} of ${total} goals on track` : `All ${total} goals on track`)
    : act.length ? `${within} of ${act.length} projects within budget` : 'Your goals'
  const sub = parts.length ? `${parts.join('. ')}.` : 'Everything is going to plan.'
  // The health score's own wording, which also counts active projects
  const pulse = goalsOnTrack(savingsGoals, projects, now).note
  const goalPct = tTarget ? Math.min(100, (tSaved / tTarget) * 100) : 0
  const projPct = aB ? (aP / aB) * 100 : 0
  const gStats = [
    { l: 'On track', v: `${onN} of ${total}`, sub: null as string | null },
    { l: 'Needed a month', v: `${m(monthly, 'hero')}/mo`, sub: overdueAmt > 0 ? `+ ${m(overdueAmt, 'hero')} overdue` : null },
    { l: 'To go', v: m(tToGo, 'hero'), sub: null },
  ]
  const pStats = [
    { l: 'Within budget', v: `${within} of ${act.length}` },
    { l: 'Left', v: m(Math.max(0, aB - aP), 'hero') },
    { l: 'Over budget', v: overs.length ? m(overSum, 'hero') : 'None' },
  ]
  const fund = notOn.filter(g => g.date).sort(byDeadline)[0] ?? active.filter(g => g.date)[0]
  const showCoach = LOCAL_AI && !loading && !!fund && filter !== 'projects'

  // ── Actions ────────────────────────────────────────────────────────────────────
  const open = (kind: OverlayKind, id: string | null, mode?: 'add' | 'withdraw') => { setMenuFor(null); setSortOpen(false); setOv({ kind, id, mode }) }
  const close = useCallback(() => setOv(null), [])
  const menuClick = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation()
    if (desktop) { setSortOpen(false); setMenuFor(menuFor === id ? null : id) }
    else open('menu', id)
  }
  const goalMenu = (id: string): MenuItem[] => [
    { icon: IconPencil, label: 'Edit goal', onClick: () => open('goalForm', id) },
    { icon: IconPlus, label: 'Add money', onClick: () => open('addMoney', id, 'add') },
    { icon: IconMinus, label: 'Withdraw', onClick: () => open('addMoney', id, 'withdraw') },
    { icon: IconTrash, label: 'Delete goal', danger: true, onClick: () => open('delete', id) },
  ]
  const projectMenu = (id: string): MenuItem[] => [
    { icon: IconPencil, label: 'Edit project', onClick: () => open('projectForm', id) },
    { icon: IconTrash, label: 'Delete project', danger: true, onClick: () => open('delete', id) },
  ]

  async function saveGoal(d: GoalDraft, existing: GoalView | undefined) {
    if (!user) return
    const targetAmount = parseInt(digits(d.target)) || 0
    const currentAmount = parseInt(digits(d.saved)) || 0
    const emoji = d.icon ? nameOf(d.icon) : existing?.goal.emoji ?? 'IconTarget'
    try {
      if (existing) {
        await updateSavingsGoal(existing.id, { name: d.name.trim(), emoji, targetAmount, currentAmount, targetDate: d.date || null })
        toast.success('Goal updated')
      } else {
        await addSavingsGoal(user.uid, { name: d.name.trim(), emoji, targetAmount, currentAmount, ...(d.date ? { targetDate: d.date } : {}) })
        toast.success('Goal created')
      }
      await refresh()
      close()
    } catch { toast.error('Something went wrong') }
  }

  async function saveProject(d: ProjectDraft, existing: ProjectView | undefined) {
    if (!user) return
    const base = { name: d.name.trim(), description: d.desc.trim(), totalBudget: parseInt(digits(d.budget)) || 0, paid: existing?.paid ?? 0, startDate: d.start, status: d.status }
    try {
      if (existing) {
        await updateProject(existing.id, { ...base, endDate: d.end || null })
        toast.success('Project updated')
      } else {
        await addProject(user.uid, { ...base, ...(d.end ? { endDate: d.end } : {}) })
        toast.success('Project created')
      }
      await refresh()
      close()
    } catch { toast.error('Something went wrong') }
  }

  async function moveMoney(g: GoalView, after: number, reached: boolean, mode: 'add' | 'withdraw') {
    try {
      await updateSavingsGoal(g.id, { currentAmount: after })
      await refresh()
      if (reached) open('celebrate', g.id)
      else { toast.success(mode === 'add' ? 'Money added' : 'Money withdrawn'); close() }
    } catch { toast.error('Something went wrong') }
  }

  async function remove(g: GoalView | undefined, p: ProjectView | undefined) {
    try {
      if (g) { await deleteSavingsGoal(g.id); toast.success('Goal deleted') }
      else if (p) { await deleteProject(p.id); toast.success('Project deleted') }
      await refresh()
      close()
    } catch { toast.error('Failed to delete') }
  }

  // ── Overlay content ────────────────────────────────────────────────────────────
  const selG = ov?.id ? goals.find(g => g.id === ov.id) : undefined
  const selP = ov?.id ? projViews.find(p => p.id === ov.id) : undefined
  let sheet: React.ReactNode = null
  let sheetLabel = ''
  if (ov) {
    switch (ov.kind) {
      case 'detail':
        if (selG) { sheetLabel = selG.goal.name; sheet = <GoalDetail g={selG} now={now} onClose={close} onEdit={() => open('goalForm', selG.id)} onAdd={() => open('addMoney', selG.id, 'add')} onWithdraw={() => open('addMoney', selG.id, 'withdraw')} /> }
        break
      case 'addMoney':
        if (selG) { sheetLabel = ov.mode === 'withdraw' ? 'Withdraw' : 'Add money'; sheet = <AddMoney key={`${selG.id}-${ov.mode}`} g={selG} initialMode={ov.mode ?? 'add'} onClose={close} onConfirm={(after, reached, mode) => moveMoney(selG, after, reached, mode)} /> }
        break
      case 'celebrate':
        if (selG) { sheetLabel = 'Goal reached'; sheet = <Celebrate g={selG} onNewGoal={() => open('goalForm', null)} onClose={close} /> }
        break
      case 'goalForm': {
        sheetLabel = selG ? 'Edit goal' : 'New goal'
        const initial: GoalDraft = selG
          ? { icon: labelOf(selG.goal.emoji), name: selG.goal.name, target: String(selG.goal.targetAmount), saved: String(selG.goal.currentAmount), date: selG.goal.targetDate ?? '' }
          : { icon: 'Goal', name: '', target: '', saved: '', date: '' }
        sheet = <GoalForm key={ov.id ?? 'new'} editing={!!selG} initial={initial} onClose={close} onSave={d => saveGoal(d, selG)} />
        break
      }
      case 'projectForm': {
        sheetLabel = selP ? 'Edit project' : 'New project'
        const pr = selP?.project
        const initial: ProjectDraft = pr
          ? { name: pr.name, desc: pr.description ?? '', budget: String(pr.totalBudget), start: pr.startDate ?? '', end: pr.endDate ?? '', status: pr.status }
          : { name: '', desc: '', budget: '', start: format(new Date(), 'yyyy-MM-dd'), end: '', status: 'active' }
        sheet = <ProjectForm key={ov.id ?? 'new'} editing={!!selP} initial={initial} paidTxt={selP ? m(selP.paid, selP.id) : '₹0'} onClose={close} onSave={d => saveProject(d, selP)} />
        break
      }
      case 'delete':
        if (selG) {
          sheetLabel = 'Delete goal'
          const body = `“${selG.goal.name}” and its ${m(selG.goal.currentAmount, selG.id)} of progress will be removed from Goals. Your transactions and accounts stay as they are.`
            + (selG.linked ? ` New savings named “${selG.goal.name}” won't add anywhere.` : '')
          sheet = <DeleteConfirm title="Delete this goal?" body={body} btnLabel="Delete goal" onClose={close} onDelete={() => remove(selG, undefined)} />
        } else if (selP) {
          sheetLabel = 'Delete project'
          const n = selP.rows.length
          sheet = <DeleteConfirm title="Delete this project?" body={`“${selP.project.name}” will be removed. Its ${n} linked payment${n === 1 ? '' : 's'} stay in Transactions, unlinked.`} btnLabel="Delete project" onClose={close} onDelete={() => remove(undefined, selP)} />
        }
        break
      case 'menu':
        if (selG) { sheetLabel = selG.goal.name; sheet = <ActionSheet title={selG.goal.name} items={goalMenu(selG.id)} onClose={close} /> }
        else if (selP) { sheetLabel = selP.project.name; sheet = <ActionSheet title={selP.project.name} items={projectMenu(selP.id)} onClose={close} /> }
        break
      case 'newMenu':
        sheetLabel = 'Add'
        sheet = <NewMenu onGoal={() => open('goalForm', null)} onProject={() => open('projectForm', null)} />
        break
    }
  }

  // ── Layout ─────────────────────────────────────────────────────────────────────
  const pad = desktop ? 32 : 16
  const segItems: { k: Filter; label: string; count: number }[] = [
    { k: 'all', label: 'All', count: goals.length + projViews.length },
    { k: 'goals', label: 'Goals', count: goals.length },
    { k: 'projects', label: 'Projects', count: projViews.length },
  ]
  const GRID = (min: number): React.CSSProperties => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fill,minmax(min(${min}px,100%),1fr))`, gap: 16 })
  const card: React.CSSProperties = { background: 'var(--surface)', borderRadius: 24, boxShadow: 'var(--shadow)' }

  return (
    <Ctx.Provider value={ctx}>
      <div className="gl gl-page" style={{ display: 'flex', flexDirection: 'column' }}>

        <header style={{ position: 'sticky', top: 0, zIndex: 6, background: 'var(--paper)', padding: desktop ? '28px 32px 16px' : 'max(20px, calc(env(safe-area-inset-top, 0px) + 8px)) 16px 12px' }}>
          <div style={{ maxWidth: 1040, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ margin: 0, fontSize: desktop ? 30 : 26, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.15 }}>Goals</h1>
                <div style={{ color: 'var(--ink3)', fontSize: 13, marginTop: 2 }}>Savings goals and project budgets</div>
              </div>
              <button onClick={togglePrivacy} aria-pressed={masked} aria-label={masked ? 'Show amounts' : 'Hide amounts'} style={{ width: 44, height: 44, borderRadius: 999, border: 0, background: 'var(--surface)', boxShadow: 'var(--shadow)', color: 'var(--ink2)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}>
                {masked ? <IconEyeOff size={20} stroke={2} /> : <IconEye size={20} stroke={2} />}
              </button>
              <button onClick={() => open('newMenu', null)} aria-label="New goal or project" style={{ height: 44, minWidth: 44, padding: desktop ? '0 18px 0 14px' : 0, borderRadius: 999, border: 0, background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, font: FONT(600, 14), cursor: 'pointer', boxShadow: '0 6px 16px -6px var(--brand)', flex: 'none' }}>
                <IconPlus size={20} stroke={2} />{desktop && <span>New</span>}
              </button>
            </div>
            {!loading && !emptyAll && (
              <Seg items={segItems} value={filter} onChange={setFilter} height={36} pad="0 16px" font={FONT(600, 13)} style={{ alignSelf: desktop ? 'flex-start' : 'stretch' }} />
            )}
            {masked && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink2)' }}>
                <IconLock size={16} stroke={2} style={{ flex: 'none' }} /><span>Amounts hidden. Press and hold a card to see its amounts for 3 seconds.</span>
              </div>
            )}
          </div>
        </header>

        <main style={{ width: '100%', maxWidth: 1104, margin: '0 auto', boxSizing: 'border-box', padding: `8px ${pad}px 40px`, display: 'flex', flexDirection: 'column', gap: desktop ? 28 : 24, flex: 1 }}>

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} aria-busy="true">
              <div style={{ height: desktop ? 230 : 300, borderRadius: 24, background: 'var(--surface2)' }} />
              <div style={{ height: 18, width: 140, borderRadius: 8, background: 'var(--surface2)' }} />
              <div style={GRID(290)}>
                {[1, 2, 3].map(k => (
                  <div key={k} style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--surface2)' }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ height: 12, width: '70%', borderRadius: 6, background: 'var(--surface2)' }} />
                        <div style={{ height: 10, width: '40%', borderRadius: 6, background: 'var(--surface2)' }} />
                      </div>
                    </div>
                    <div style={{ height: 22, width: '50%', borderRadius: 8, background: 'var(--surface2)' }} />
                    <div style={{ height: 8, borderRadius: 99, background: 'var(--surface2)' }} />
                    <div style={{ height: 40, borderRadius: 12, background: 'var(--surface2)' }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {emptyAll && (
            <section style={{ ...card, padding: desktop ? 36 : '24px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ fontFamily: SERIF, fontSize: desktop ? 44 : 34, lineHeight: 1.05, letterSpacing: '-0.01em' }}>Plan for what matters.</div>
              <div style={{ color: 'var(--ink2)', fontSize: 15, maxWidth: 460, textWrap: 'pretty' } as React.CSSProperties}>Save towards a goal, or keep a big one-off spend on budget. Both live here.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(260px,100%),1fr))', gap: 12 }}>
                {[
                  { Icon: IconTargetArrow, t: 'No savings goals yet', s: 'Add a goal — trip, phone, home, anything', b: 'Add your first goal', primary: true, go: () => open('goalForm', null) },
                  { Icon: IconCrane, t: 'No projects yet', s: 'Add a budget — construction, wedding, any big one-off', b: 'Add a project', primary: false, go: () => open('projectForm', null) },
                ].map(x => (
                  <div key={x.t} style={{ background: 'var(--surface2)', borderRadius: 20, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
                    <Tile size={44} radius={14} bg="var(--brand-soft)" fg="var(--brand-ink)"><x.Icon size={22} stroke={2} /></Tile>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{x.t}</div>
                    <div style={{ color: 'var(--ink2)', fontSize: 13 }}>{x.s}</div>
                    <button onClick={x.go} style={{ marginTop: 4, height: 44, padding: '0 18px', border: 0, borderRadius: 999, background: x.primary ? 'var(--brand)' : 'var(--surface)', color: x.primary ? '#fff' : 'var(--ink)', boxShadow: x.primary ? 'none' : 'var(--shadow)', font: FONT(600, 14), cursor: 'pointer' }}>{x.b}</button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!loading && !emptyAll && (
            <section
              {...lp('hero')} className="gl-noselect"
              style={{
                position: 'relative', overflow: 'hidden', borderRadius: 24, padding: desktop ? 28 : 20, color: '#fff',
                background: 'linear-gradient(155deg, var(--brand-deep), var(--brand) 58%, var(--brand2))', boxShadow: 'var(--hero-shadow)',
                opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(10px)', transition: 'opacity 420ms ease, transform 420ms ease',
              }}
            >
              <div style={{ position: 'absolute', right: -90, top: -140, width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.30), rgba(255,255,255,0) 68%)', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 22 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                    <div style={{ fontFamily: SERIF, fontSize: desktop ? 38 : 30, lineHeight: 1.05, letterSpacing: '-0.01em' }}>{headline}</div>
                    <div style={{ opacity: 0.88, fontSize: 13.5, marginTop: 8, maxWidth: 560, textWrap: 'pretty', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' } as React.CSSProperties}>{sub}</div>
                  </div>
                  {total > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: 'rgba(255,255,255,.14)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      <IconHeartbeat size={15} stroke={2} />Pulse · {pulse}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '22px 28px' }}>
                  {goals.length > 0 && (
                    <HeroHalf
                      Icon={IconPigMoney} label="Saving towards" big={m(tSaved, 'hero')} of={`of ${m(tTarget, 'hero')} · ${Math.floor(goalPct)}%`}
                      w={mounted ? goalPct : 0} delay={120} stats={gStats} desktop={desktop}
                    />
                  )}
                  {act.length > 0 && (
                    <HeroHalf
                      Icon={IconCrane} label="Big spends" big={m(aP, 'hero')} of={`of ${m(aB, 'hero')} · ${Math.round(projPct)}% used`}
                      w={mounted ? Math.min(100, projPct) : 0} delay={200} stats={pStats.map(s => ({ ...s, sub: null }))} desktop={desktop}
                    />
                  )}
                </div>
              </div>
            </section>
          )}

          {showCoach && fund && (
            <section style={{ ...card, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', opacity: mounted ? 1 : 0, transition: 'opacity 420ms ease 40ms' }}>
              <Tile size={44} radius={14} bg="var(--brand-soft)" fg="var(--brand-ink)"><IconSparkles size={22} stroke={2} /></Tile>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Goal coach</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--surface2)', color: 'var(--ink2)' }}>Runs on this device</span>
                </div>
                <div style={{ color: 'var(--ink2)', fontSize: 13, marginTop: 3, textWrap: 'pretty', overflowWrap: 'anywhere' } as React.CSSProperties}>
                  Fund first: <b style={{ color: 'var(--ink)' }}>{fund.goal.name}</b>. {fund.status === 'overdue' ? `${m(fund.remaining, 'coach')} closes it out.` : `${m(fund.need ?? 0, 'coach')}/mo keeps it on track.`}
                </div>
              </div>
              <Link href="/ai" style={{ height: 40, padding: '0 16px', borderRadius: 999, background: 'var(--brand-soft)', color: 'var(--brand-ink)', font: FONT(600, 13), display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                Open coach<IconArrowRight size={16} stroke={2} />
              </Link>
            </section>
          )}

          {!loading && !emptyAll && filter !== 'projects' && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Savings goals</h2>
                <span style={{ fontFamily: MONO, color: 'var(--ink3)', fontSize: 13 }}>{goals.length}</span>
                <div style={{ flex: 1 }} />
                {goals.length > 0 && (
                  <button onClick={() => { setMenuFor(null); setSortOpen(!sortOpen) }} aria-expanded={sortOpen} style={{ height: 36, padding: '0 12px', border: 0, borderRadius: 999, background: 'transparent', color: 'var(--ink2)', font: FONT(500, 13), display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <IconArrowsSort size={16} stroke={2} />{SORTS.find(s => s[0] === sort)?.[1]}
                  </button>
                )}
                {sortOpen && (
                  <div role="menu" style={{ position: 'absolute', right: 0, top: 42, zIndex: 16, width: 230, background: 'var(--surface)', borderRadius: 16, boxShadow: POP_SHADOW.replace('.2)', '.18)'), padding: 6 }}>
                    {SORTS.map(([k, l]) => (
                      <button key={k} role="menuitemradio" aria-checked={sort === k} className="gl-hov" onClick={() => { setSort(k); setSortOpen(false) }} style={{ width: '100%', height: 44, border: 0, borderRadius: 10, background: sort === k ? 'var(--surface2)' : 'transparent', color: 'var(--ink)', font: FONT(500, 14), display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ flex: 1 }}>{l}</span>{sort === k && <IconCheck size={18} stroke={2} style={{ color: 'var(--brand)' }} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {goals.length > 0 ? (
                <>
                  {visible.length > 0 && (
                    <div style={GRID(290)}>
                      {visible.map((g, i) => (
                        <GoalCard
                          key={g.id} g={g} now={now} delay={`${(i + 2) * 40}ms`} menuOpen={desktop && menuFor === g.id} menuItems={goalMenu(g.id)}
                          onOpen={() => open('detail', g.id)} onMenu={menuClick(g.id)} onAdd={e => { e.stopPropagation(); open('addMoney', g.id, 'add') }}
                        />
                      ))}
                    </div>
                  )}
                  {active.length > LIMIT + 1 && (
                    <button onClick={() => setMoreGoals(!moreGoals)} style={{ ...card, alignSelf: 'center', height: 44, padding: '0 20px', border: 0, borderRadius: 999, color: 'var(--ink)', font: FONT(600, 13), cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {moreGoals ? 'Show fewer' : `Show ${active.length - LIMIT} more goals`}
                      {moreGoals ? <IconChevronUp size={16} stroke={2} /> : <IconChevronDown size={16} stroke={2} />}
                    </button>
                  )}
                  {done.length > 0 && (
                    <div style={{ ...card, padding: 6 }}>
                      <button onClick={() => setDoneOpen(!doneOpen)} aria-expanded={doneOpen} style={{ width: '100%', minHeight: 52, border: 0, background: 'transparent', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', cursor: 'pointer', font: FONT(600, 14), textAlign: 'left' }}>
                        <IconCircleCheck size={20} stroke={2} style={{ color: 'var(--good)' }} /><span>Done</span>
                        <span style={{ fontFamily: MONO, color: 'var(--ink3)', fontWeight: 500, fontSize: 13 }}>{done.length}</span>
                        <span style={{ flex: 1 }} />
                        {doneOpen ? <IconChevronUp size={18} stroke={2} style={{ color: 'var(--ink3)' }} /> : <IconChevronDown size={18} stroke={2} style={{ color: 'var(--ink3)' }} />}
                      </button>
                      {doneOpen && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(290px,100%),1fr))', gap: 6 }}>
                          {done.map(g => (
                            <DoneRow key={g.id} g={g} menuOpen={desktop && menuFor === g.id} menuItems={goalMenu(g.id)} onOpen={() => open('detail', g.id)} onMenu={menuClick(g.id)} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ ...card, padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
                  <Tile size={52} radius={16} bg="var(--brand-soft)" fg="var(--brand-ink)"><IconTargetArrow size={26} stroke={2} /></Tile>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>No savings goals yet</div>
                  <div style={{ color: 'var(--ink2)', fontSize: 13 }}>Add a goal — trip, phone, home, anything</div>
                  <button onClick={() => open('goalForm', null)} style={{ marginTop: 6, height: 44, padding: '0 20px', border: 0, borderRadius: 999, background: 'var(--brand)', color: '#fff', font: FONT(600, 14), cursor: 'pointer' }}>Add your first goal</button>
                </div>
              )}
            </section>
          )}

          {!loading && !emptyAll && filter !== 'goals' && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Project budgets</h2>
                <span style={{ fontFamily: MONO, color: 'var(--ink3)', fontSize: 13 }}>{projViews.length}</span>
              </div>
              {projViews.length > 0 ? projGroups.map(grp => (
                <div key={grp.label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink3)' }}>{grp.label}</div>
                  <div style={GRID(420)}>
                    {grp.items.map(p => (
                      <ProjectCard
                        key={p.id} p={p} delay={projDelay(p)} expanded={!!expanded[p.id]} shown={showN[p.id] ?? 5}
                        menuOpen={desktop && menuFor === p.id} menuItems={projectMenu(p.id)}
                        onToggle={() => setExpanded(s => ({ ...s, [p.id]: !s[p.id] }))}
                        onMore={() => setShowN(s => ({ ...s, [p.id]: (s[p.id] ?? 5) + 5 }))}
                        onMenu={menuClick(p.id)} onAddTx={() => setAddTxOpen(true)}
                      />
                    ))}
                  </div>
                </div>
              )) : (
                <div style={{ ...card, padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
                  <Tile size={52} radius={16} bg="var(--brand-soft)" fg="var(--brand-ink)"><IconCrane size={26} stroke={2} /></Tile>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>No projects yet</div>
                  <div style={{ color: 'var(--ink2)', fontSize: 13 }}>Add a budget — construction, wedding, any big one-off</div>
                  <button onClick={() => open('projectForm', null)} style={{ marginTop: 6, height: 44, padding: '0 20px', border: 0, borderRadius: 999, background: 'var(--brand)', color: '#fff', font: FONT(600, 14), cursor: 'pointer' }}>Add a project</button>
                </div>
              )}
            </section>
          )}
        </main>

        {(menuFor || sortOpen) && <div onClick={() => { setMenuFor(null); setSortOpen(false) }} style={{ position: 'fixed', inset: 0, zIndex: 14 }} />}
      </div>

      {ov && sheet && <Overlay key={ov.kind} desktop={desktop} maxW={WIDTH[ov.kind]} label={sheetLabel} onClose={close}>{sheet}</Overlay>}
      <AddTransactionModal open={addTxOpen} onClose={() => setAddTxOpen(false)} />
    </Ctx.Provider>
  )
}

function HeroHalf({ Icon, label, big, of, w, delay, stats, desktop }: {
  Icon: typeof IconPigMoney; label: string; big: string; of: string; w: number; delay: number
  stats: { l: string; v: string; sub: string | null }[]; desktop: boolean
}) {
  return (
    <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.85 }}><Icon size={16} stroke={2} />{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: desktop ? 36 : 30, fontWeight: 500, letterSpacing: '-0.04em', lineHeight: 1 }}>{big}</span>
        <span style={{ fontFamily: MONO, fontSize: 13, opacity: 0.82 }}>{of}</span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,.22)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${w}%`, background: '#fff', borderRadius: 99, transition: `width 900ms cubic-bezier(.16,1,.3,1) ${delay}ms` }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(92px,1fr))', gap: 8 }}>
        {stats.map(st => (
          <div key={st.l} style={{ background: 'rgba(255,255,255,.13)', borderRadius: 16, padding: '10px 12px', minWidth: 0 }}>
            <div style={{ fontSize: 11.5, opacity: 0.82 }}>{st.l}</div>
            <div style={{ fontFamily: MONO, fontSize: desktop ? 15 : 13.5, fontWeight: 500, marginTop: 2, overflowWrap: 'anywhere' }}>{st.v}</div>
            {st.sub && <div style={{ fontSize: 11, opacity: 0.82, marginTop: 2, fontFamily: MONO }}>{st.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
