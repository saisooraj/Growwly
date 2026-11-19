import { differenceInCalendarDays, differenceInMonths, parseISO, startOfDay } from 'date-fns'
import {
  IconTargetArrow, IconHome, IconBuilding, IconCrane, IconPlaneDeparture, IconBeach, IconCar, IconMotorbike,
  IconDeviceMobile, IconDeviceLaptop, IconDeviceWatch, IconDiamond, IconSchool, IconCertificate, IconPigMoney,
  IconChartLine, IconCoins, IconBuildingBank, IconFirstAidKit, IconShieldCheck, IconConfetti, IconHeartHandshake,
  IconUsers, IconGift, IconShoppingBag, IconBarbell, IconTrophy, IconSparkles,
} from '@tabler/icons-react'
import { GOAL_ICONS, type TablerIconComponent } from '@/lib/categoryIcons'
import { goalPace, isGoalOnTrack } from '@/lib/pulse'
import { isSavingsTransfer, countsTowardProject } from '@/lib/utils'
import type { Project, SavingsGoal, Transaction } from '@/types'

export type TablerIcon = TablerIconComponent

export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const monthYear = (d: Date) => `${MON[d.getMonth()]} ${d.getFullYear()}`
export const fmtD = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()]} ${d.getFullYear()}`
export const inr = (n: number) => Math.round(Math.abs(n)).toLocaleString('en-IN')
export const digits = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 11)

// ── Icons ────────────────────────────────────────────────────────────────────
// The design's glyph for each of the 28 goal icons. Goals store the GOAL_ICONS name
// (e.g. "IconPlane"), so older goals and the Overview keep working; this maps by label.
export const GOAL_GLYPHS: Record<string, TablerIcon> = {
  Goal: IconTargetArrow, Home: IconHome, Property: IconBuilding, Construction: IconCrane, Travel: IconPlaneDeparture,
  Vacation: IconBeach, Car: IconCar, Motorbike: IconMotorbike, Phone: IconDeviceMobile, Laptop: IconDeviceLaptop,
  Watch: IconDeviceWatch, Jewellery: IconDiamond, Education: IconSchool, Course: IconCertificate, Savings: IconPigMoney,
  Investment: IconChartLine, Gold: IconCoins, Bank: IconBuildingBank, Emergency: IconFirstAidKit, Insurance: IconShieldCheck,
  Celebration: IconConfetti, Wedding: IconHeartHandshake, Family: IconUsers, Gift: IconGift, Shopping: IconShoppingBag,
  Fitness: IconBarbell, Trophy: IconTrophy, Dream: IconSparkles,
}
const LABEL_BY_NAME = Object.fromEntries(GOAL_ICONS.map(p => [p.name, p.label]))
const NAME_BY_LABEL = Object.fromEntries(GOAL_ICONS.map(p => [p.label, p.name]))
export const ICON_LABELS = GOAL_ICONS.map(p => p.label).filter(l => GOAL_GLYPHS[l])
/** Label for a stored icon; null for legacy emoji values (drawn with GoalIcon instead) */
export const labelOf = (emoji: string): string | null => LABEL_BY_NAME[emoji] ?? null
export const nameOf = (label: string): string => NAME_BY_LABEL[label] ?? 'IconTarget'

// ── Goals ────────────────────────────────────────────────────────────────────

export type GoalStatus = 'ontrack' | 'behind' | 'overdue' | 'notstarted' | 'notarget' | 'reached'

export interface LinkedRow { tx: Transaction; value: number }
export interface Linked { n: number; sum: number; vehicle: string; rows: LinkedRow[] }

export interface GoalView {
  goal: SavingsGoal
  id: string
  status: GoalStatus
  on: boolean | null          // the health score's on-track check; null without a target
  date: Date | null
  created: Date
  past: boolean
  monthsLeft: number | null
  remaining: number
  expected: number | null     // where straight-line progress says it should be today
  need: number | null         // a month, or the whole rest once overdue
  behindBy: number
  pct: number                 // 0–100
  linked: Linked | null
}

/** Savings transactions whose vehicle name matches the goal: the same match Add Transaction uses to move saved amounts */
export function linkedSavings(goal: SavingsGoal, transactions: Transaction[]): Linked | null {
  const key = goal.name.trim().toLowerCase()
  const rows = transactions
    .filter(t => isSavingsTransfer(t) && t.transferKind !== 'ef_withdrawal' && (t.savingsVehicle ?? '').trim().toLowerCase() === key)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .map(tx => ({ tx, value: tx.transferKind === 'savings_withdrawal' ? -tx.amount : tx.amount }))
  if (!rows.length) return null
  return { n: rows.length, sum: rows.reduce((s, r) => s + r.value, 0), vehicle: rows[0].tx.savingsVehicle ?? goal.name, rows }
}

export function goalView(goal: SavingsGoal, transactions: Transaction[], now: Date): GoalView {
  const today = startOfDay(now)
  const target = goal.targetAmount, saved = goal.currentAmount
  const date = goal.targetDate ? parseISO(goal.targetDate) : null
  const created = parseISO(goal.createdAt)
  const noTarget = target <= 0
  const reached = !noTarget && saved >= target
  const past = !!date && date < today
  const monthsLeft = date ? Math.max(0, differenceInMonths(date, today)) : null
  const remaining = Math.max(0, target - saved)
  const pace = goalPace(goal, now)
  const expected = date ? target * (pace ?? 1) : null
  const on = noTarget ? null : isGoalOnTrack(goal, now)
  const status: GoalStatus = noTarget ? 'notarget' : reached ? 'reached' : past ? 'overdue'
    : (date && !on) ? 'behind' : (!date && saved <= 0) ? 'notstarted' : 'ontrack'
  const need = date && !reached && !noTarget ? (past ? remaining : Math.ceil(remaining / Math.max(monthsLeft ?? 0, 1))) : null
  return {
    goal, id: goal.id, status, on, date, created, past, monthsLeft, remaining, expected, need,
    behindBy: status === 'behind' && expected !== null ? Math.ceil(expected - saved) : 0,
    pct: noTarget ? 0 : Math.min(100, (saved / target) * 100),
    linked: linkedSavings(goal, transactions),
  }
}

export function daysOverdue(g: GoalView, now: Date): number {
  return g.date ? differenceInCalendarDays(startOfDay(now), g.date) : 0
}

export const RANK: Record<string, number> = { overdue: 0, behind: 1, notstarted: 2, ontrack: 3, nodate: 4, notarget: 5 }
export type SortKey = 'attention' | 'deadline' | 'progress' | 'name'
export const SORTS: [SortKey, string][] = [['attention', 'Needs attention first'], ['deadline', 'Nearest deadline'], ['progress', 'Most progress'], ['name', 'Name']]

const dk = (g: GoalView) => (g.date ? g.date.getTime() : Infinity)
const rk = (g: GoalView) => (g.status === 'ontrack' && !g.date ? RANK.nodate : RANK[g.status])
export const SORT_FNS: Record<SortKey, (a: GoalView, b: GoalView) => number> = {
  attention: (a, b) => rk(a) - rk(b) || dk(a) - dk(b) || b.pct - a.pct,
  deadline:  (a, b) => dk(a) - dk(b) || b.pct - a.pct,
  progress:  (a, b) => b.pct - a.pct,
  name:      (a, b) => a.goal.name.localeCompare(b.goal.name),
}
export const byDeadline = (a: GoalView, b: GoalView) => dk(a) - dk(b)

// ── Projects ─────────────────────────────────────────────────────────────────

export interface PaymentRow {
  tx: Transaction
  value: number      // signed: refunds count against the project
  prevPct: number    // progress just before it
  newPct: number     // progress just after it
}

export interface ProjectView {
  project: Project
  id: string
  paid: number
  raw: number        // % of budget used, uncapped
  over: boolean
  rows: PaymentRow[] // newest first
}

export function paymentLabel(t: Transaction): string {
  if (t.notes?.trim()) return t.notes.trim()
  if (t.type === 'refund') return `Refund · ${t.category}`
  if (isSavingsTransfer(t)) return t.savingsVehicle ?? 'Savings'
  return t.category
}

// Oldest first so each payment knows how far along the project was when it landed;
// paid is the same sum computeProjectPaid takes. Returned newest first for display.
export function projectView(project: Project, transactions: Transaction[]): ProjectView {
  const budget = project.totalBudget
  const pct = (n: number) => (budget > 0 ? (n / budget) * 100 : 0)
  const own = transactions
    .filter(t => t.projectId === project.id && countsTowardProject(t))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  let cum = 0
  const rows = own.map(tx => {
    const value = tx.type === 'refund' ? -tx.amount : tx.amount
    const prev = cum
    cum += value
    return { tx, value, prevPct: pct(prev), newPct: pct(cum) }
  }).reverse()
  return { project, id: project.id, paid: cum, raw: pct(cum), over: cum > budget, rows }
}
