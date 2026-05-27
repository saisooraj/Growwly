'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'

export type PushState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading'

export function usePushNotifications() {
  const { user } = useAuth()
  const [state, setState] = useState<PushState>('loading')

  const checkState = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported'); return
    }
    if (Notification.permission === 'denied') {
      setState('denied'); return
    }
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    setState(sub ? 'subscribed' : 'unsubscribed')
  }, [])

  useEffect(() => { checkState() }, [checkState])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user) return false
    setState('loading')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setState('denied'); return false }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ) as unknown as ArrayBuffer,
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, subscription: sub.toJSON() }),
      })

      setState('subscribed')
      return true
    } catch (err) {
      console.error('Push subscribe error:', err)
      setState('unsubscribed')
      return false
    }
  }, [user])

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!user) return
    setState('loading')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()

      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      })
    } catch (err) {
      console.error('Push unsubscribe error:', err)
    }
    setState('unsubscribed')
  }, [user])

  return { state, subscribe, unsubscribe, refresh: checkState }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(Array.from(raw).map((c) => c.charCodeAt(0)))
}
