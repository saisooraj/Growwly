'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { QueryDocumentSnapshot } from 'firebase/firestore'
import { getTransactionsPage } from '@/lib/firestore'
import type { Transaction } from '@/types'

interface Options { userId: string | undefined; enabled?: boolean }

export function useInfiniteTransactions({ userId, enabled = true }: Options) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading]           = useState(false)
  const [hasMore, setHasMore]           = useState(true)
  const cursor = useRef<QueryDocumentSnapshot | null>(null)
  const started = useRef(false)

  const loadMore = useCallback(async () => {
    if (!userId || loading || !hasMore) return
    setLoading(true)
    try {
      const result = await getTransactionsPage(userId, cursor.current ?? undefined)
      cursor.current = result.lastDoc
      setTransactions(prev => [...prev, ...result.transactions])
      setHasMore(result.hasMore)
    } finally {
      setLoading(false)
    }
  }, [userId, loading, hasMore])

  // Initial load
  useEffect(() => {
    if (!userId || !enabled || started.current) return
    started.current = true
    loadMore()
  }, [userId, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset when userId changes
  useEffect(() => {
    started.current = false
    setTransactions([])
    setHasMore(true)
    cursor.current = null
  }, [userId])

  // IntersectionObserver sentinel ref
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) loadMore()
    }, { rootMargin: '200px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loading, loadMore])

  return { transactions, loading, hasMore, loadMore, sentinelRef }
}
