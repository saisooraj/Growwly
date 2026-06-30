'use client'

import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useAppStore } from '@/store/appStore'
import { getCurrentMonth, getCycleMonth } from '@/lib/utils'
import {
  getUserTransactions,
  getUserBudgets,
  getUserProjects,
  getUserBorrowings,
  getEmergencyFund,
  getUserSettings,
  getUserSavingsGoals,
  getUserUpcoming,
  getUserUpcomingPayments,
  getUserTasks,
  getUserAssets,
  getUserLiabilities,
  getUserHealthRoutines,
  getHealthLogs,
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
    setUpcomingPayments,
    setTasks,
    setAssets,
    setLiabilities,
    setHealthRoutines,
    setHealthLogs,
    setLoading,
    setInitialized,
    setSelectedMonth,
    selectedMonth,
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
        const from60 = new Date(); from60.setDate(from60.getDate() - 60)
        const from60Str = from60.toISOString().slice(0, 10)

        const [txs, budgets, projects, borrowings, ef, settings, goals, upcoming, upcomingPmts, tasks, assets, liabilities, healthRoutines, healthLogs] =
          await Promise.all([
            getUserTransactions(user.uid),
            getUserBudgets(user.uid),
            getUserProjects(user.uid),
            getUserBorrowings(user.uid),
            getEmergencyFund(user.uid),
            getUserSettings(user.uid),
            getUserSavingsGoals(user.uid).catch(() => []),
            getUserUpcoming(user.uid).catch(() => []),
            getUserUpcomingPayments(user.uid).catch(() => []),
            getUserTasks(user.uid).catch(() => []),
            getUserAssets(user.uid).catch(() => []),
            getUserLiabilities(user.uid).catch(() => []),
            getUserHealthRoutines(user.uid).catch(() => []),
            getHealthLogs(user.uid, from60Str).catch(() => []),
          ])
        setTransactions(txs)
        setBudgets(budgets)
        setProjects(projects)
        setBorrowings(borrowings)
        setEmergencyFund(ef)
        setSettings(settings)
        // Auto-advance to the correct cycle month if still on the default calendar month
        if (selectedMonth === getCurrentMonth()) {
          setSelectedMonth(getCycleMonth(settings))
        }
        setSavingsGoals(goals)
        setUpcomingExpenses(upcoming)
        setUpcomingPayments(upcomingPmts)
        setTasks(tasks)
        setAssets(assets)
        setLiabilities(liabilities)
        setHealthRoutines(healthRoutines)
        setHealthLogs(healthLogs)
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
    setUpcomingPayments,
    setTasks,
    setAssets,
    setLiabilities,
    setHealthRoutines,
    setHealthLogs,
    setLoading,
  } = useAppStore()

  return async function refresh() {
    if (!user) return
    setLoading(true)
    try {
      const from60 = new Date(); from60.setDate(from60.getDate() - 60)
      const from60Str = from60.toISOString().slice(0, 10)

      const [txs, budgets, projects, borrowings, ef, settings, goals, upcoming, upcomingPmts, tasks, assets, liabilities, healthRoutines, healthLogs] =
        await Promise.all([
          getUserTransactions(user.uid),
          getUserBudgets(user.uid),
          getUserProjects(user.uid),
          getUserBorrowings(user.uid),
          getEmergencyFund(user.uid),
          getUserSettings(user.uid),
          getUserSavingsGoals(user.uid).catch(() => []),
          getUserUpcoming(user.uid).catch(() => []),
          getUserUpcomingPayments(user.uid).catch(() => []),
          getUserTasks(user.uid).catch(() => []),
          getUserAssets(user.uid).catch(() => []),
          getUserLiabilities(user.uid).catch(() => []),
          getUserHealthRoutines(user.uid).catch(() => []),
          getHealthLogs(user.uid, from60Str).catch(() => []),
        ])
      setTransactions(txs)
      setBudgets(budgets)
      setProjects(projects)
      setBorrowings(borrowings)
      setEmergencyFund(ef)
      setSettings(settings)
      setSavingsGoals(goals)
      setUpcomingExpenses(upcoming)
      setUpcomingPayments(upcomingPmts)
      setTasks(tasks)
      setAssets(assets)
      setLiabilities(liabilities)
      setHealthRoutines(healthRoutines)
      setHealthLogs(healthLogs)
    } finally {
      setLoading(false)
    }
  }
}
