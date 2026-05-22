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

function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(
    typeof navigator !== 'undefined' ? navigator.userAgent : ''
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub: (() => void) | null = null

    // Wait for redirect result FIRST, then start auth listener
    // This prevents the flash-to-null that causes blank screen on mobile
    getRedirectResult(auth)
      .catch(() => {})
      .finally(() => {
        unsub = onAuthStateChanged(auth, (u) => {
          setUser(u)
          setLoading(false)
        })
      })

    return () => { unsub?.() }
  }, [])

  async function signInWithGoogle() {
    if (isMobile()) {
      await signInWithRedirect(auth, googleProvider)
    } else {
      await signInWithPopup(auth, googleProvider)
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
