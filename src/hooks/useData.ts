'use client'

import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useAppStore } from '@/store/appStore'
import {
  getUserTransactions,
  getUserBudgets,
  getUserProjects,
  getUserBorrowings,
  getEmergencyFund,
  getUserSettings,
  getUserSavingsGoals,
  getUserUpcoming,
} from '@/lib/firestore'

export function useData() {
  const { user } = useAuth()
  const {
    setTransactions,
    setBudgets,
    setProjects,
    setBorrowings,
    setEmergencyFund,
    setSettings,
    setSavingsGoals,
    setUpcomingExpenses,
    setLoading,
    setInitialized,
    initialized,
    reset,
  } = useAppStore()

  useEffect(() => {
    if (!user) {
      reset()
      return
    }
    if (initialized) return

    async function load() {
      if (!user) return
      setLoading(true)
      try {
        const [txs, budgets, projects, borrowings, ef, settings, goals, upcoming] =
          await Promise.all([
            getUserTransactions(user.uid),
            getUserBudgets(user.uid),
            getUserProjects(user.uid),
            getUserBorrowings(user.uid),
            getEmergencyFund(user.uid),
            getUserSettings(user.uid),
            getUserSavingsGoals(user.uid).catch(() => []),
            getUserUpcoming(user.uid).catch(() => []),
          ])
        setTransactions(txs)
        setBudgets(budgets)
        setProjects(projects)
        setBorrowings(borrowings)
        setEmergencyFund(ef)
        setSettings(settings)
        setSavingsGoals(goals)
        setUpcomingExpenses(upcoming)
        setInitialized(true)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user, initialized])
}

export function useRefreshData() {
  const { user } = useAuth()
  const {
    setTransactions,
    setBudgets,
    setProjects,
    setBorrowings,
    setEmergencyFund,
    setSettings,
    setSavingsGoals,
    setUpcomingExpenses,
    setLoading,
    setInitialized,
  } = useAppStore()

  return async function refresh() {
    if (!user) return
    setInitialized(false)
    setLoading(true)
    try {
      const [txs, budgets, projects, borrowings, ef, settings, goals, upcoming] =
        await Promise.all([
          getUserTransactions(user.uid),
          getUserBudgets(user.uid),
          getUserProjects(user.uid),
          getUserBorrowings(user.uid),
          getEmergencyFund(user.uid),
          getUserSettings(user.uid),
          getUserSavingsGoals(user.uid).catch(() => []),
          getUserUpcoming(user.uid).catch(() => []),
        ])
      setTransactions(txs)
      setBudgets(budgets)
      setProjects(projects)
      setBorrowings(borrowings)
      setEmergencyFund(ef)
      setSettings(settings)
      setSavingsGoals(goals)
      setUpcomingExpenses(upcoming)
      setInitialized(true)
    } finally {
      setLoading(false)
    }
  }
}
