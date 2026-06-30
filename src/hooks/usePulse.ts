import { useMemo } from 'react'
import { useAppStore } from '@/store/appStore'
import { computePulse } from '@/lib/pulse'
import type { FinancialPulse } from '@/types'

export function usePulse(): FinancialPulse {
  const transactions      = useAppStore(s => s.transactions)
  const settings          = useAppStore(s => s.settings)
  const emergencyFund     = useAppStore(s => s.emergencyFund)
  const savingsGoals      = useAppStore(s => s.savingsGoals)
  const projects          = useAppStore(s => s.projects)
  const borrowings        = useAppStore(s => s.borrowings)
  const upcomingExpenses  = useAppStore(s => s.upcomingExpenses)
  const upcomingPayments  = useAppStore(s => s.upcomingPayments)
  const selectedMonth     = useAppStore(s => s.selectedMonth)

  return useMemo(
    () => computePulse({ transactions, settings, emergencyFund, savingsGoals, projects, borrowings, upcomingExpenses, upcomingPayments, selectedMonth }),
    [transactions, settings, emergencyFund, savingsGoals, projects, borrowings, upcomingExpenses, upcomingPayments, selectedMonth]
  )
}
