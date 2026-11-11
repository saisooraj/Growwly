'use client'

import { createContext, useContext, useEffect, useRef } from 'react'

// Pull-to-refresh is opt-in per page. App data is already live (Firestore listeners), so a
// page only offers the gesture when it has something to fetch, such as market prices. AppShell
// owns the gesture and the indicator; a page just says what refreshing means for it.

type Register = (onRefresh: () => Promise<unknown>) => () => void

export const PullToRefreshContext = createContext<Register | null>(null)

/** Turn on pull-to-refresh for the current page. `onRefresh` resolves when the fetch is done. */
export function usePullToRefresh(onRefresh: () => Promise<unknown>) {
  const register = useContext(PullToRefreshContext)
  const latest = useRef(onRefresh)
  latest.current = onRefresh
  useEffect(() => register?.(() => latest.current()), [register])
}
