'use client'

import { useMemo } from 'react'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary } from '@/lib/utils'
import type { MonthlySummary } from '@/types'

/**
 * Returns a memoized MonthlySummary for the given month (defaults to selectedMonth).
 * The summary is only recomputed when transactions, settings, borrowings, or the
 * target month changes — not on every render.
 */
export function useMonthlySummary(month?: string): MonthlySummary {
  const transactions  = useAppStore(s => s.transactions)
  const settings      = useAppStore(s => s.settings)
  const borrowings    = useAppStore(s => s.borrowings)
  const selectedMonth = useAppStore(s => s.selectedMonth)

  const targetMonth = month ?? selectedMonth

  return useMemo(
    () => buildMonthlySummary(transactions, targetMonth, settings, borrowings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, targetMonth, settings?.salaryCycleRule, settings?.salaryCycleFixedDay, borrowings],
  )
}
