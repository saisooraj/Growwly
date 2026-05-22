'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserSessionPersistence,
  signOut,
  User,
} from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithGoogle: () => void   // intentionally NOT async — preserves Safari gesture context
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: () => {},
  logout: async () => {},
})

const POPUP_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment', // iOS Safari throws this
])

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Handle pending redirect result first, then start auth listener
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

  // NOT async — must call signInWithPopup synchronously within the user-gesture
  // stack so Safari doesn't consider it a non-gesture popup and block it
  function signInWithGoogle() {
    signInWithPopup(auth, googleProvider).catch((err) => {
      if (POPUP_FALLBACK_CODES.has(err?.code)) {
        // Popup blocked or unsupported (common on iOS Safari) — use redirect
        // Session persistence avoids ITP restrictions on localStorage
        setPersistence(auth, browserSessionPersistence)
          .then(() => signInWithRedirect(auth, googleProvider))
          .catch(() => {})
      }
    })
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
