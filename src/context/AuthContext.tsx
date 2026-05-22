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
  authError: string | null
  signInWithGoogle: () => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  authError: null,
  signInWithGoogle: () => {},
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    // Set up auth listener immediately
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })

    // Process any pending redirect result (fires onAuthStateChanged if successful)
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) setAuthError(null)
      })
      .catch((err) => {
        // Surface the real error so we can debug
        setAuthError(`redirect_error: ${err?.code ?? err?.message ?? 'unknown'}`)
        setLoading(false)
      })

    return unsub
  }, [])

  function signInWithGoogle() {
    setAuthError(null)
    signInWithPopup(auth, googleProvider).catch((popupErr) => {
      const code = popupErr?.code ?? ''
      // Surface popup error for debugging
      setAuthError(`popup_error: ${code}`)

      const shouldRedirect =
        code === 'auth/popup-blocked' ||
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/operation-not-supported-in-this-environment'

      if (shouldRedirect) {
        setAuthError(`popup_failed(${code})_trying_redirect`)
        signInWithRedirect(auth, googleProvider)
      }
    })
  }

  async function logout() {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, authError, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
