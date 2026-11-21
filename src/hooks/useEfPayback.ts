import { useMemo } from 'react'
import { useAppStore } from '@/store/appStore'
import { buildEfPayback, type EfPaybackState } from '@/lib/efPayback'
import { computePulse } from '@/lib/pulse'
import { getCycleMonth } from '@/lib/utils'

export interface EfPaybackInfo extends EfPaybackState {
  freeCash: number   // this cycle's cash after upcoming bills, the same figure Pulse shows
  suggested: number  // what can go back right now
}

export function useEfPayback(): EfPaybackInfo {
  const transactions     = useAppStore(s => s.transactions)
  const settings         = useAppStore(s => s.settings)
  const budgets          = useAppStore(s => s.budgets)
  const emergencyFund    = useAppStore(s => s.emergencyFund)
  const savingsGoals     = useAppStore(s => s.savingsGoals)
  const projects         = useAppStore(s => s.projects)
  const borrowings       = useAppStore(s => s.borrowings)
  const upcomingExpenses = useAppStore(s => s.upcomingExpenses)
  const upcomingPayments = useAppStore(s => s.upcomingPayments)

  const state = useMemo(() => buildEfPayback(transactions), [transactions])

  // Always the current cycle, whichever month is being viewed
  const freeCash = useMemo(() => {
    if (state.owed <= 0) return 0
    return computePulse({
      transactions, settings, budgets, emergencyFund, savingsGoals, projects, borrowings,
      upcomingExpenses, upcomingPayments, selectedMonth: getCycleMonth(settings),
    }).cashPosition.freeCash
  }, [state.owed, transactions, settings, budgets, emergencyFund, savingsGoals, projects, borrowings, upcomingExpenses, upcomingPayments])

  return { ...state, freeCash, suggested: Math.min(Math.ceil(state.owed), Math.floor(freeCash)) }
}
