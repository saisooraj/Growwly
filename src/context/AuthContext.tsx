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
  linkWithPhoneNumber,
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
import { auth, googleProvider, db } from '@/lib/firebase'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { logAuthError } from '@/lib/authErrorLogger'

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

// ── reCAPTCHA helpers ──────────────────────────────────────────────────────────
let _recaptcha: RecaptchaVerifier | null = null

function makeRecaptcha(): RecaptchaVerifier {
  if (_recaptcha) {
    try { _recaptcha.clear() } catch { /* already cleared */ }
    _recaptcha = null
  }
  const container = document.getElementById('recaptcha-root') ?? document.body
  _recaptcha = new RecaptchaVerifier(auth, container, { size: 'invisible' })
  return _recaptcha
}

function clearRecaptcha() {
  if (_recaptcha) {
    try { _recaptcha.clear() } catch { /* ignore */ }
    _recaptcha = null
  }
  const el = document.getElementById('recaptcha-root')
  if (el) el.innerHTML = ''
}

// ── iOS / WKWebView detection ──────────────────────────────────────────────────
// All browsers on iOS (Safari, Chrome, Firefox) use WKWebView and block popups.
// Skip the popup attempt entirely and go straight to redirect on any iOS device.
function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iP(hone|ad|od)/i.test(navigator.userAgent)
}

// ── sessionStorage keys ────────────────────────────────────────────────────────
const SS_REDIRECT_PENDING = 'gw_auth_redirect_pending'
const SS_REDIRECT_FAILED  = 'gw_auth_redirect_failed'

function ssGet(key: string): string | null {
  try { return sessionStorage.getItem(key) } catch { return null }
}
function ssSet(key: string, val: string) {
  try { sessionStorage.setItem(key, val) } catch { /* private mode */ }
}
function ssRemove(key: string) {
  try { sessionStorage.removeItem(key) } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    let unsubAuthState: (() => void) | undefined

    const redirectPending = ssGet(SS_REDIRECT_PENDING)

    // Process any pending OAuth redirect BEFORE starting the auth state listener.
    // This prevents onAuthStateChanged from firing with null (and triggering a
    // premature redirect to /login) while the redirect result is still being settled.
    getRedirectResult(auth)
      .then(() => {
        ssRemove(SS_REDIRECT_PENDING)
        ssRemove(SS_REDIRECT_FAILED)
      })
      .catch(async (err) => {
        const code = (err as { code?: string })?.code ?? 'unknown'
        const msg  = (err as { message?: string })?.message ?? 'Redirect sign-in failed'

        // Only treat as a failure if we actually initiated a redirect
        if (redirectPending) {
          ssRemove(SS_REDIRECT_PENDING)
          ssSet(SS_REDIRECT_FAILED, code)
          await logAuthError({ code, message: msg, flow: `google-redirect:${redirectPending}` })
        }
      })
      .finally(() => {
        if (cancelled) return

        unsubAuthState = onAuthStateChanged(auth, async (u) => {
          setUser(u)
          setLoading(false)

          if (u && db) {
            const profileRef = doc(db, 'userProfiles', u.uid)
            const now = new Date().toISOString()
            try {
              const snap = await getDoc(profileRef)
              if (!snap.exists()) {
                await setDoc(profileRef, {
                  uid: u.uid,
                  email: u.email,
                  displayName: u.displayName,
                  photoURL: u.photoURL,
                  createdAt: now,
                  lastActiveAt: now,
                })
              } else {
                await setDoc(profileRef, {
                  email: u.email,
                  displayName: u.displayName,
                  photoURL: u.photoURL,
                  lastActiveAt: now,
                }, { merge: true })
              }
            } catch { /* non-critical, don't block auth */ }
          }
        })
      })

    return () => {
      cancelled = true
      unsubAuthState?.()
    }
  }, [])

  // ── Google ──────────────────────────────────────────────────────────────────

  function signInWithGoogle() {
    // All iOS browsers (Safari, Chrome, Firefox) use WKWebView and will always
    // block popups — skip straight to redirect to avoid the race condition that
    // caused the "stuck on login" bug in iOS Safari.
    if (isIOSDevice()) {
      ssSet(SS_REDIRECT_PENDING, 'ios')
      signInWithRedirect(auth, googleProvider)
      return
    }

    signInWithPopup(auth, googleProvider).catch((err) => {
      const code = (err as { code?: string })?.code ?? ''
      const shouldRedirect =
        code === 'auth/popup-blocked' ||
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/operation-not-supported-in-this-environment'
      if (shouldRedirect) {
        ssSet(SS_REDIRECT_PENDING, 'popup-blocked')
        signInWithRedirect(auth, googleProvider)
      }
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
    try {
      const result = await signInWithPhoneNumber(auth, phone, verifier)
      clearRecaptcha()
      return result
    } catch (err) {
      clearRecaptcha()
      throw err
    }
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
    try {
      const result = await linkWithPhoneNumber(auth.currentUser, phone, verifier)
      clearRecaptcha()
      return result
    } catch (err) {
      clearRecaptcha()
      throw err
    }
  }

  async function confirmPhoneLink(result: ConfirmationResult, otp: string) {
    await result.confirm(otp)
  }

  async function unlinkProvider(providerId: string) {
    if (!auth.currentUser) throw new Error('Not signed in')
    await unlink(auth.currentUser, providerId)
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
