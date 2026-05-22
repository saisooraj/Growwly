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
        const [txs, budgets, projects, borrowings, ef, settings] =
          await Promise.all([
            getUserTransactions(user.uid),
            getUserBudgets(user.uid),
            getUserProjects(user.uid),
            getUserBorrowings(user.uid),
            getEmergencyFund(user.uid),
            getUserSettings(user.uid),
          ])
        setTransactions(txs)
        setBudgets(budgets)
        setProjects(projects)
        setBorrowings(borrowings)
        setEmergencyFund(ef)
        setSettings(settings)
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
    setLoading,
    setInitialized,
  } = useAppStore()

  return async function refresh() {
    if (!user) return
    setInitialized(false)
    setLoading(true)
    try {
      const [txs, budgets, projects, borrowings, ef, settings] =
        await Promise.all([
          getUserTransactions(user.uid),
          getUserBudgets(user.uid),
          getUserProjects(user.uid),
          getUserBorrowings(user.uid),
          getEmergencyFund(user.uid),
          getUserSettings(user.uid),
        ])
      setTransactions(txs)
      setBudgets(budgets)
      setProjects(projects)
      setBorrowings(borrowings)
      setEmergencyFund(ef)
      setSettings(settings)
      setInitialized(true)
    } finally {
      setLoading(false)
    }
  }
}
