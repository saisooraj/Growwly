'use client'

import { auth } from './firebase'

async function getToken(): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  return user.getIdToken()
}

export async function adminFetch<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = await getToken()
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
  return data as T
}
