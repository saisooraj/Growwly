'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { buildFinancialSnapshot } from '@/lib/ai/buildContext'
import { executeAction } from '@/lib/ai/actionExecutor'
import { getUserTransactions } from '@/lib/firestore'
import {
  loadChatbotSettings,
  saveChatbotSettings,
  DEFAULT_CHATBOT_CONFIG,
  type ChatbotProviderConfig,
} from '@/lib/ai/chatbotSettings'
import type { ChatMessage, PendingAction } from '@/lib/ai/types'
import toast from 'react-hot-toast'

let msgCounter = 0
function makeId() { return `msg-${++msgCounter}-${Date.now()}` }

export function useChat() {
  const { user } = useAuth()

  const transactions    = useAppStore(s => s.transactions)
  const budgets         = useAppStore(s => s.budgets)
  const savingsGoals    = useAppStore(s => s.savingsGoals)
  const emergencyFund   = useAppStore(s => s.emergencyFund)
  const borrowings      = useAppStore(s => s.borrowings)
  const settings        = useAppStore(s => s.settings)
  const setTransactions = useAppStore(s => s.setTransactions)

  const [messages, setMessages]             = useState<ChatMessage[]>([])
  const [pendingAction, setPendingAction]   = useState<PendingAction | null>(null)
  const [loading, setLoading]               = useState(false)
  const [confirming, setConfirming]         = useState(false)
  const [providerConfig, setProviderConfig] = useState<ChatbotProviderConfig>(DEFAULT_CHATBOT_CONFIG)

  // Load saved settings once the user uid is available
  useEffect(() => {
    if (user?.uid) {
      setProviderConfig(loadChatbotSettings(user.uid))
    }
  }, [user?.uid])

  const updateProviderConfig = useCallback((config: ChatbotProviderConfig) => {
    setProviderConfig(config)
    if (user?.uid) saveChatbotSettings(user.uid, config)
  }, [user?.uid])

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const full: ChatMessage = { ...msg, id: makeId(), timestamp: Date.now() }
    setMessages(prev => [...prev, full])
    return full
  }, [])

  const sendMessage = useCallback(async (content: string) => {
    if (!user?.uid || loading) return

    addMessage({ role: 'user', content })
    setLoading(true)

    try {
      const snapshot = buildFinancialSnapshot({
        userId: user.uid,
        transactions,
        budgets,
        savingsGoals,
        emergencyFund,
        borrowings,
        settings,
      })

      const apiMessages = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content },
      ]

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, snapshot, providerConfig }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      const data = await res.json()

      if (data.type === 'action') {
        const action = data.action as PendingAction
        setPendingAction(action)
        addMessage({ role: 'assistant', content: action.preview, action })
      } else if (data.type === 'message') {
        addMessage({ role: 'assistant', content: data.content ?? 'No response received.' })
      } else {
        throw new Error('Unexpected response format')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      addMessage({ role: 'assistant', content: `Sorry, I ran into an error: ${msg}`, isError: true })
    } finally {
      setLoading(false)
    }
  }, [user, loading, messages, transactions, budgets, savingsGoals, emergencyFund, borrowings, settings, providerConfig, addMessage])

  const confirmAction = useCallback(async () => {
    if (!pendingAction || !user?.uid || confirming) return
    setConfirming(true)

    try {
      const result = await executeAction(pendingAction, user.uid)

      if (result.success) {
        const refreshed = await getUserTransactions(user.uid)
        setTransactions(refreshed)
        setPendingAction(null)
        addMessage({ role: 'assistant', content: `Done! ${result.message}` })
        toast.success('Done!')
      } else {
        addMessage({ role: 'assistant', content: `Could not complete: ${result.message}`, isError: true })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Execution failed'
      addMessage({ role: 'assistant', content: `Error: ${msg}`, isError: true })
      toast.error('Action failed')
    } finally {
      setConfirming(false)
    }
  }, [pendingAction, user, confirming, setTransactions, addMessage])

  const cancelAction = useCallback(() => {
    setPendingAction(null)
    addMessage({ role: 'assistant', content: 'Cancelled. Let me know if you need anything else.' })
  }, [addMessage])

  const clearMessages = useCallback(() => {
    setMessages([])
    setPendingAction(null)
  }, [])

  return {
    messages,
    pendingAction,
    loading,
    confirming,
    providerConfig,
    sendMessage,
    confirmAction,
    cancelAction,
    clearMessages,
    updateProviderConfig,
  }
}
