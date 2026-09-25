'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import AppShell from '@/components/layout/AppShell'
import { useAppStore } from '@/store/appStore'
import { buildCategoryTrend, buildCurrentPeriodDetail, bucketTopSlices, getMonthsEndingAt } from '@/lib/spendingAnalytics'
import { getCycleRange } from '@/lib/cycle'
import { CATEGORY_COLORS, EXPENSE_CATEGORIES, buildMonthlySummary, getCycleMonth, getMonthLabel } from '@/lib/utils'
import { DEFAULT_NEEDS, DEFAULT_RULE, DEFAULT_SAVINGS } from '@/components/planning/SpendingRuleCard'
import SpendingKpiRow from '@/components/spending/SpendingKpiRow'
import SpendingDonut from '@/components/spending/SpendingDonut'
import CategoryChecklist from '@/components/spending/CategoryChecklist'
import CategoryGrid from '@/components/spending/CategoryGrid'
import SpendingTrendChart from '@/components/spending/SpendingTrendChart'
import NeedsWantsSavingsSummary from '@/components/spending/NeedsWantsSavingsSummary'
import RecurringSplitCard from '@/components/spending/RecurringSplitCard'
import SpendingHeatmap from '@/components/spending/SpendingHeatmap'
import TopTransactionsList from '@/components/spending/TopTransactionsList'

const MAX_DONUT_SLICES = 8
const MAX_TREND_LINES = 8

export default function SpendingBreakdownPage() {
  const router = useRouter()
  const { transactions, budgets, selectedMonth, settings } = useAppStore()

  // Local range picker, synced to the global header month switcher on load/navigation —
  // same pattern as CategoryPieChart's chartMonth.
  const [chartMonth, setChartMonth] = useState(selectedMonth)
  useEffect(() => { setChartMonth(selectedMonth) }, [selectedMonth])

  const [rangeMonths, setRangeMonths] = useState<3 | 6 | 12>(6)
  const [checkedCats, setCheckedCats] = useState<Set<string> | 'all'>('all')
  const [masked, setMasked] = useState(true)

  // +1 so there's always a baseline month for month-over-month comparisons.
  const months = useMemo(() => getMonthsEndingAt(chartMonth, rangeMonths + 1), [chartMonth, rangeMonths])

  // The one expensive computation on this page — a single pass over `transactions`.
  // `checkedCats` and `masked` are deliberately NOT in this dependency array: toggling
  // the checklist or the privacy toggle must never re-trigger this.
  const trend = useMemo(() => buildCategoryTrend(transactions, months, settings), [transactions, months, settings])

  const currentIdx = months.length - 1
  const prevIdx = months.length - 2

  const allCategoryKeys = useMemo(() => {
    const keys = new Set<string>([...EXPENSE_CATEGORIES, ...Object.keys(trend.totalByCategory)])
    return Array.from(keys).sort(
      (a, b) => (trend.byCategoryByMonth[b]?.[currentIdx] ?? 0) - (trend.byCategoryByMonth[a]?.[currentIdx] ?? 0)
    )
  }, [trend, currentIdx])

  const toggleCat = useCallback((cat: string) => {
    setCheckedCats(prev => {
      const base = prev === 'all' ? new Set(allCategoryKeys) : new Set(prev)
      if (base.has(cat)) base.delete(cat)
      else base.add(cat)
      return base
    })
  }, [allCategoryKeys])
  const selectAll = useCallback(() => setCheckedCats('all'), [])
  const selectNone = useCallback(() => setCheckedCats(new Set()), [])

  const goToCategory = useCallback((cat: string) => {
    router.push(`/transactions?cat=${encodeURIComponent(cat)}`)
  }, [router])

  // ── Donut: checklist-filtered current-month totals, top N + "Other" ──
  const donutEntries = useMemo(() => {
    return allCategoryKeys
      .filter(cat => checkedCats === 'all' || checkedCats.has(cat))
      .map(cat => [cat, trend.byCategoryByMonth[cat]?.[currentIdx] ?? 0] as [string, number])
  }, [allCategoryKeys, checkedCats, trend, currentIdx])

  const { top: donutTop, rest: donutRest, otherTotal } = useMemo(
    () => bucketTopSlices(donutEntries, MAX_DONUT_SLICES),
    [donutEntries]
  )

  const donutData = useMemo(() => [
    ...donutTop.map(([name, value]) => ({ name, value, color: CATEGORY_COLORS[name] ?? '#94a3b8', isOther: false })),
    ...(otherTotal > 0 ? [{ name: 'Other', value: otherTotal, color: '#94a3b8', isOther: true }] : []),
  ], [donutTop, otherTotal])

  const donutTotal = donutData.reduce((s, d) => s + d.value, 0)

  // ── Budget map for the currently viewed month ──
  const budgetMap = useMemo(() => {
    const monthBudgets = budgets.filter(b => b.month === chartMonth)
    return Object.fromEntries(monthBudgets.map(b => [b.category, b.planned])) as Record<string, number>
  }, [budgets, chartMonth])

  // ── Category grid: uncapped, checklist-filtered ──
  const gridRows = useMemo(() => {
    return allCategoryKeys
      .filter(cat => checkedCats === 'all' || checkedCats.has(cat))
      .map(cat => ({
        category: cat,
        actual: trend.byCategoryByMonth[cat]?.[currentIdx] ?? 0,
        prevActual: trend.byCategoryByMonth[cat]?.[prevIdx] ?? 0,
        planned: budgetMap[cat] ?? 0,
      }))
      .filter(r => r.actual > 0 || r.planned > 0)
      .sort((a, b) => b.actual - a.actual)
  }, [allCategoryKeys, checkedCats, trend, currentIdx, prevIdx, budgetMap])

  // ── Trend chart: checklist-filtered, capped at MAX_TREND_LINES by current spend ──
  const trendMonths = useMemo(() => months.slice(1), [months])

  const trendView = useMemo(() => {
    const candidates = allCategoryKeys
      .filter(cat => checkedCats === 'all' || checkedCats.has(cat))
      .map(cat => ({
        category: cat,
        color: CATEGORY_COLORS[cat] ?? '#94a3b8',
        values: (trend.byCategoryByMonth[cat] ?? new Array(months.length).fill(0)).slice(1),
        total: trend.totalByCategory[cat] ?? 0,
      }))
      .filter(l => l.total > 0)
      .sort((a, b) => b.total - a.total)

    return {
      lines: candidates.slice(0, MAX_TREND_LINES),
      overflow: Math.max(0, candidates.length - MAX_TREND_LINES),
    }
  }, [allCategoryKeys, checkedCats, trend, months.length])

  // ── KPIs ──
  const totalSpent = trend.totalsByMonth[currentIdx] ?? 0
  const prevTotal = trend.totalsByMonth[prevIdx] ?? 0
  const momPct = prevTotal > 0 ? Math.round(((totalSpent - prevTotal) / prevTotal) * 100) : null
  const topCategory = gridRows[0]?.category ?? null

  const { start: cycleStart, end: cycleEnd } = useMemo(() => getCycleRange(chartMonth, settings), [chartMonth, settings])
  const daysInCycle = useMemo(
    () => differenceInCalendarDays(parseISO(cycleEnd), parseISO(cycleStart)) + 1,
    [cycleStart, cycleEnd]
  )
  const avgPerDay = daysInCycle > 0 ? totalSpent / daysInCycle : 0

  // ── Pace forecast: only meaningful for the cycle that's actually in progress ──
  const isLiveCycle = chartMonth === getCycleMonth(settings)
  const daysElapsed = isLiveCycle
    ? Math.min(daysInCycle, Math.max(1, differenceInCalendarDays(new Date(), parseISO(cycleStart)) + 1))
    : daysInCycle
  const projectedTotal = isLiveCycle ? (totalSpent / daysElapsed) * daysInCycle : null
  const plannedTotal = useMemo(() => Object.values(budgetMap).reduce((s, v) => s + v, 0), [budgetMap])

  // ── Daily heatmap, biggest expenses, recurring split — one extra pass, current cycle only ──
  const periodDetail = useMemo(
    () => buildCurrentPeriodDetail(transactions, cycleStart, cycleEnd),
    [transactions, cycleStart, cycleEnd]
  )

  // ── Needs / Wants / Savings — compact read-only echo of SpendingRuleCard's own calc ──
  const needsCats = settings?.categoryBuckets?.needs ?? DEFAULT_NEEDS
  const savingsCats = settings?.categoryBuckets?.savings ?? DEFAULT_SAVINGS
  const rule = settings?.spendingRule ?? DEFAULT_RULE

  const currentMonthSummary = useMemo(
    () => buildMonthlySummary(transactions, chartMonth, settings),
    [transactions, chartMonth, settings]
  )

  const bucketAmounts = useMemo(() => {
    const needsSet = new Set(needsCats)
    const savingsSet = new Set(savingsCats)
    const amounts = { needs: 0, wants: 0, savings: 0 }
    for (const cat of allCategoryKeys) {
      const amt = trend.byCategoryByMonth[cat]?.[currentIdx] ?? 0
      if (amt <= 0) continue
      const bucket = needsSet.has(cat) ? 'needs' : savingsSet.has(cat) ? 'savings' : 'wants'
      amounts[bucket] += amt
    }
    const savingsNet = currentMonthSummary.savingsContributed - currentMonthSummary.savingsWithdrawn
    if (savingsNet > 0) amounts.savings += savingsNet
    return amounts
  }, [allCategoryKeys, trend, currentIdx, needsCats, savingsCats, currentMonthSummary])

  const totalIncome = currentMonthSummary.totalIncome || 1
  const bucketPcts = {
    needs: (bucketAmounts.needs / totalIncome) * 100,
    wants: (bucketAmounts.wants / totalIncome) * 100,
    savings: (bucketAmounts.savings / totalIncome) * 100,
  }

  return (
    <AppShell title="Spending Breakdown">
      <div className="anim-page" style={{ maxWidth: 1120, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SpendingKpiRow
          totalSpent={totalSpent}
          avgPerDay={avgPerDay}
          momPct={momPct}
          topCategory={topCategory}
          masked={masked}
          onToggleMasked={() => setMasked(v => !v)}
          projectedTotal={projectedTotal}
          plannedTotal={plannedTotal}
        />

        <div className="spend-grid">
          <NeedsWantsSavingsSummary
            amounts={bucketAmounts}
            pcts={bucketPcts}
            target={rule}
            masked={masked}
          />
          <RecurringSplitCard
            recurringTotal={Math.max(0, periodDetail.recurringTotal)}
            oneOffTotal={Math.max(0, periodDetail.oneOffTotal)}
            masked={masked}
          />
        </div>

        <div className="spend-grid">
          <SpendingDonut
            data={donutData}
            rest={donutRest}
            total={donutTotal}
            monthLabel={getMonthLabel(chartMonth)}
            masked={masked}
            onSliceClick={goToCategory}
          />
          <CategoryChecklist
            categories={allCategoryKeys}
            checked={checkedCats}
            onToggle={toggleCat}
            onSelectAll={selectAll}
            onSelectNone={selectNone}
          />
        </div>

        <CategoryGrid rows={gridRows} masked={masked} onRowClick={goToCategory} />

        <SpendingTrendChart
          months={trendMonths}
          lines={trendView.lines}
          overflowCount={trendView.overflow}
          masked={masked}
          rangeMonths={rangeMonths}
          onRangeChange={setRangeMonths}
        />

        <div className="spend-grid">
          <SpendingHeatmap days={periodDetail.dailySpend} masked={masked} />
          <TopTransactionsList
            transactions={periodDetail.topTransactions}
            masked={masked}
            onCategoryClick={goToCategory}
          />
        </div>
      </div>
    </AppShell>
  )
}
