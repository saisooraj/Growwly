'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'

export interface WatchItem { key: string; name: string }
export interface ListedItem extends WatchItem { holding: boolean }

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

// Mutual fund entries saved before this hook carry `code` instead of `key`
const toItem = (x: { key?: string; code?: number | string; name?: string }): WatchItem =>
  ({ key: String(x.key ?? x.code ?? ''), name: x.name ?? '' })

/**
 * The list a market card shows: the user's holdings of that kind, plus items added on the card,
 * minus holdings removed from it. Added and removed items live on this device, per user.
 * `holdings` must be memoized. `legacy` (module-level, so stable) seeds the added list the first
 * time, from a watchlist saved before holdings joined it.
 */
export function useWatchlist(name: string, holdings: WatchItem[], legacy?: () => WatchItem[]) {
  const { user } = useAuth()
  const extraKey = user ? `sw_${name}_extra:${user.uid}` : null
  const hiddenKey = user ? `sw_${name}_hidden:${user.uid}` : null

  const [extra, setExtra] = useState<WatchItem[]>([])
  const [hidden, setHidden] = useState<string[]>([])

  useEffect(() => {
    if (!extraKey || !hiddenKey) return
    let saved = read<WatchItem[] | null>(extraKey, null)?.map(toItem) ?? null
    if (!saved) {
      saved = legacy?.() ?? []
      write(extraKey, saved)
    }
    setExtra(saved)
    setHidden(read<(string | number)[]>(hiddenKey, []).map(String))
  }, [extraKey, hiddenKey, legacy])

  const holdingKeys = useMemo(() => new Set(holdings.map(h => h.key)), [holdings])

  const items = useMemo<ListedItem[]>(() => [
    ...holdings.map(h => ({ ...h, holding: true })),
    ...extra.filter(e => !holdingKeys.has(e.key)).map(e => ({ ...e, holding: false })),
  ].filter(i => !hidden.includes(i.key)), [holdings, holdingKeys, extra, hidden])

  const hiddenHoldings = useMemo(() => holdings.filter(h => hidden.includes(h.key)), [holdings, hidden])

  function saveHidden(next: string[]) {
    setHidden(next)
    if (hiddenKey) write(hiddenKey, next)
  }

  function saveExtra(next: WatchItem[]) {
    setExtra(next)
    if (extraKey) write(extraKey, next)
  }

  function add(item: WatchItem) {
    if (hidden.includes(item.key)) saveHidden(hidden.filter(k => k !== item.key))
    if (holdingKeys.has(item.key) || extra.some(e => e.key === item.key)) return
    saveExtra([...extra, item])
  }

  function remove(key: string) {
    // A holding can't leave the list, only be hidden from this card
    if (holdingKeys.has(key)) saveHidden([...hidden, key])
    else saveExtra(extra.filter(e => e.key !== key))
  }

  return {
    items,
    hiddenHoldings,
    add,
    remove,
    restoreHidden: () => saveHidden([]),
    isListed: (key: string) => items.some(i => i.key === key),
  }
}
