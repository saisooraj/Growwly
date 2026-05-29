'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPhoneNumber,
  EmailAuthProvider,
  linkWithCredential,
  linkWithPopup,
  unlink,
  fetchSignInMethodsForEmail,
  updatePassword,
  reauthenticateWithCredential,
  RecaptchaVerifier,
  User,
  ConfirmationResult,
} from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'

export interface AuthContextType {
  user: User | null
  loading: boolean

  // Google
  signInWithGoogle: () => void

  // Email / password
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  getSignInMethodsForEmail: (email: string) => Promise<string[]>

  // Phone OTP
  sendPhoneOTP: (phone: string) => Promise<ConfirmationResult>
  confirmPhoneOTP: (result: ConfirmationResult, otp: string) => Promise<void>

  // Account linking (must be logged in)
  linkGoogle: () => Promise<void>
  linkEmailPassword: (email: string, password: string) => Promise<void>
  linkPhone: (phone: string) => Promise<ConfirmationResult>
  confirmPhoneLink: (result: ConfirmationResult, otp: string) => Promise<void>
  unlinkProvider: (providerId: string) => Promise<void>

  // Password management
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  setInitialPassword: (email: string, password: string) => Promise<void>

  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

// Reusable invisible reCAPTCHA factory — creates a fresh verifier each call
function makeRecaptcha() {
  const container = document.getElementById('recaptcha-root') ?? document.body
  return new RecaptchaVerifier(auth, container, { size: 'invisible' })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    getRedirectResult(auth).catch(() => {})
    return unsub
  }, [])

  // ── Google ──────────────────────────────────────────────────────────────────

  function signInWithGoogle() {
    signInWithPopup(auth, googleProvider).catch((err) => {
      const code = err?.code ?? ''
      const shouldRedirect =
        code === 'auth/popup-blocked' ||
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/operation-not-supported-in-this-environment'
      if (shouldRedirect) signInWithRedirect(auth, googleProvider)
    })
  }

  // ── Email / Password ────────────────────────────────────────────────────────

  async function signInWithEmail(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function signUpWithEmail(email: string, password: string) {
    await createUserWithEmailAndPassword(auth, email, password)
  }

  async function getSignInMethodsForEmail(email: string) {
    return fetchSignInMethodsForEmail(auth, email)
  }

  // ── Phone OTP ───────────────────────────────────────────────────────────────

  async function sendPhoneOTP(phone: string): Promise<ConfirmationResult> {
    const verifier = makeRecaptcha()
    return signInWithPhoneNumber(auth, phone, verifier)
  }

  async function confirmPhoneOTP(result: ConfirmationResult, otp: string) {
    await result.confirm(otp)
  }

  // ── Account Linking ─────────────────────────────────────────────────────────

  async function linkGoogle() {
    if (!auth.currentUser) throw new Error('Not signed in')
    await linkWithPopup(auth.currentUser, googleProvider)
  }

  async function linkEmailPassword(email: string, password: string) {
    if (!auth.currentUser) throw new Error('Not signed in')
    const credential = EmailAuthProvider.credential(email, password)
    await linkWithCredential(auth.currentUser, credential)
  }

  async function linkPhone(phone: string): Promise<ConfirmationResult> {
    if (!auth.currentUser) throw new Error('Not signed in')
    const verifier = makeRecaptcha()
    return signInWithPhoneNumber(auth, phone, verifier)
  }

  async function confirmPhoneLink(result: ConfirmationResult, otp: string) {
    if (!auth.currentUser) throw new Error('Not signed in')
    const credential = result.verificationId
      ? (await import('firebase/auth')).PhoneAuthProvider.credential(result.verificationId, otp)
      : null
    if (!credential) throw new Error('Invalid OTP session')
    await linkWithCredential(auth.currentUser, credential)
  }

  async function unlinkProvider(providerId: string) {
    if (!auth.currentUser) throw new Error('Not signed in')
    await unlink(auth.currentUser, providerId)
    // Refresh user object
    await auth.currentUser.reload()
    setUser({ ...auth.currentUser })
  }

  // ── Password Management ─────────────────────────────────────────────────────

  async function changePassword(currentPassword: string, newPassword: string) {
    if (!auth.currentUser?.email) throw new Error('Not signed in')
    const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword)
    await reauthenticateWithCredential(auth.currentUser, cred)
    await updatePassword(auth.currentUser, newPassword)
  }

  // Used when no password is set yet (phone/Google account adding email+pass)
  async function setInitialPassword(email: string, password: string) {
    if (!auth.currentUser) throw new Error('Not signed in')
    const credential = EmailAuthProvider.credential(email, password)
    await linkWithCredential(auth.currentUser, credential)
  }

  async function logout() {
    await signOut(auth)
  }

  const value: AuthContextType = {
    user, loading,
    signInWithGoogle,
    signInWithEmail, signUpWithEmail, getSignInMethodsForEmail,
    sendPhoneOTP, confirmPhoneOTP,
    linkGoogle, linkEmailPassword, linkPhone, confirmPhoneLink, unlinkProvider,
    changePassword, setInitialPassword,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      {/* Invisible reCAPTCHA anchor — must be in DOM for phone auth */}
      <div id="recaptcha-root" />
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
