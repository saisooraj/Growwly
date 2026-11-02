import { format, parseISO, startOfMonth, endOfMonth, subDays, addMonths } from 'date-fns'
import type { UserSettings } from '@/types'

// Last Mon–Fri of a given calendar month (month is 1-based)
export function getLastWorkingDay(year: number, month: number): string {
  const d = new Date(year, month, 0)  // day-0 of next month = last day of this month
  const dow = d.getDay()              // 0=Sun, 6=Sat
  if (dow === 0) d.setDate(d.getDate() - 2)
  else if (dow === 6) d.setDate(d.getDate() - 1)
  return format(d, 'yyyy-MM-dd')
}

function computeCycleStart(year: number, month: number, settings: UserSettings): string {
  if (settings.salaryCycleRule === 'last-working-day') {
    return getLastWorkingDay(year, month)
  }
  const lastDay = new Date(year, month, 0).getDate()
  const day = Math.min(settings.salaryCycleFixedDay ?? 28, lastDay)
  return format(new Date(year, month - 1, day), 'yyyy-MM-dd')
}

// Returns the { start, end } date range for a budget month label like "2026-06"
export function getCycleRange(
  budgetMonth: string,
  settings?: UserSettings | null
): { start: string; end: string } {
  if (!settings?.salaryCycleRule || settings.salaryCycleRule === 'none') {
    const d = parseISO(`${budgetMonth}-01`)
    return {
      start: format(startOfMonth(d), 'yyyy-MM-dd'),
      end:   format(endOfMonth(d),   'yyyy-MM-dd'),
    }
  }

  const [year, month] = budgetMonth.split('-').map(Number)

  // Cycle start = last WD (or fixed day) of the PREVIOUS month, unless overridden
  const prevYear  = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  const start = settings.cycleOverrides?.[budgetMonth]
    ?? computeCycleStart(prevYear, prevMonth, settings)

  // Cycle end = one day before the next budget month's cycle start
  const nextYear  = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextBM    = `${nextYear}-${String(nextMonth).padStart(2, '0')}`
  const nextStart = settings.cycleOverrides?.[nextBM]
    ?? computeCycleStart(year, month, settings)
  const end = format(subDays(parseISO(nextStart), 1), 'yyyy-MM-dd')

  return { start, end }
}

// The budget-month label a date (yyyy-MM-dd) falls in, respecting the salary cycle.
// e.g. with a fixed-day-28 cycle, "2026-10-30" belongs to "2026-11". A cycle covers
// its own calendar month or starts late in the previous one, so the date's calendar
// month and its neighbours are the only candidates.
export function getCycleMonthForDate(date: string, settings?: UserSettings | null): string {
  const calendarMonth = date.slice(0, 7)
  if (!settings?.salaryCycleRule || settings.salaryCycleRule === 'none') return calendarMonth

  const base = parseISO(`${calendarMonth}-01`)
  for (const offset of [0, 1, -1]) {
    const m = format(addMonths(base, offset), 'yyyy-MM')
    const { start, end } = getCycleRange(m, settings)
    if (date >= start && date <= end) return m
  }
  return calendarMonth
}

// "May 29 – Jun 29"
export function formatCycleRange(start: string, end: string): string {
  return `${format(parseISO(start), 'MMM d')} – ${format(parseISO(end), 'MMM d')}`
}

// Whether a budget month is using a custom override
export function isCycleOverridden(budgetMonth: string, settings?: UserSettings | null): boolean {
  return !!(settings?.cycleOverrides?.[budgetMonth])
}
