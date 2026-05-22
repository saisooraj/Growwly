'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  User,
} from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Handle any pending redirect result first, then listen for auth state
    getRedirectResult(auth)
      .catch(() => {})
      .finally(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
          setUser(u)
          setLoading(false)
        })
        return unsub
      })
  }, [])

  async function signInWithGoogle() {
    try {
      // Try popup first — works on desktop and most mobile browsers
      await signInWithPopup(auth, googleProvider)
    } catch (err: any) {
      // Popup blocked (common on mobile) — fall back to redirect
      if (
        err?.code === 'auth/popup-blocked' ||
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        await signInWithRedirect(auth, googleProvider)
      } else {
        throw err
      }
    }
  }

  async function logout() {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
