'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ConfirmationResult } from 'firebase/auth'
import { useAuth } from '@/context/AuthContext'
import { BootLoader, authToast } from '@/components/auth/AuthUI'
import {
  BrandPanel, MobileHero, CompactHeader,
  WelcomeView, EmailView, ConflictView, GoogleUnavailableView,
  PhoneView, OtpView, ResetView, ResetSentView,
} from '@/components/auth/AuthViews'

type Screen = 'home' | 'email' | 'conflict' | 'googleFail' | 'phone' | 'otp' | 'reset' | 'resetSent'

const BACK: Record<Screen, Screen> = {
  home: 'home', email: 'home', conflict: 'email', googleFail: 'home',
  phone: 'home', otp: 'phone', reset: 'email', resetSent: 'email',
}

const SS_REDIRECT_FAILED = 'gw_auth_redirect_failed'

function ssGet(key: string): string | null {
  try { return sessionStorage.getItem(key) } catch { return null }
}
function ssRemove(key: string) {
  try { sessionStorage.removeItem(key) } catch { /* ignore */ }
}

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth()
  const router = useRouter()
  const colRef = useRef<HTMLElement>(null)

  const [screen, setScreen]           = useState<Screen>('home')
  const [mode, setMode]               = useState<'signin' | 'signup'>('signin')
  const [email, setEmail]             = useState('')
  const [conflictMethods, setConflictMethods] = useState<string[]>([])
  const [resetEmail, setResetEmail]   = useState('')
  const [phone, setPhone]             = useState('')
  const [phoneResult, setPhoneResult] = useState<ConfirmationResult | null>(null)

  // Landed here after a failed OAuth redirect
  const [banner, setBanner]         = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [gLoading, setGLoading]     = useState(false)

  // Safety net: if Firebase auth loading takes >2s (Strict Mode double-mount,
  // slow network, etc.), force the form to show so users aren't stuck forever.
  const [authTimedOut, setAuthTimedOut] = useState(false)
  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => setAuthTimedOut(true), 2000)
    return () => clearTimeout(t)
  }, [loading])

  useEffect(() => {
    if (ssGet(SS_REDIRECT_FAILED)) {
      ssRemove(SS_REDIRECT_FAILED)
      setBanner(true)
    }
  }, [])

  useEffect(() => {
    if (!loading && user) router.replace('/')
  }, [user, loading])

  function go(next: Screen) {
    setScreen(next)
    if (colRef.current) colRef.current.scrollTop = 0
  }

  async function runGoogle() {
    setGLoading(true)
    try {
      await signInWithGoogle()
    } catch {
      authToast('err', 'Something went wrong. Please try again.')
    } finally {
      setGLoading(false)
    }
  }

  function handleGoogle() {
    if (gLoading) return
    setBanner(false)
    const next = retryCount + 1
    setRetryCount(next)
    // After 2 failed attempts, show the Google-unavailable screen
    if (next >= 3) { go('googleFail'); return }
    runGoogle()
  }

  // Signed in (or still starting up): the same loader carries through to the dashboard
  if ((loading && !authTimedOut) || user) return <BootLoader />

  const toEmail = () => go('email')
  const backToSignin = () => { setMode('signin'); go('email') }

  let view
  switch (screen) {
    case 'home':
      view = (
        <WelcomeView
          banner={banner} onDismissBanner={() => setBanner(false)}
          onEmail={toEmail} onPhone={() => go('phone')}
          gLoading={gLoading} onGoogle={handleGoogle}
        />
      )
      break
    case 'email':
      view = (
        <EmailView
          mode={mode} setMode={setMode} email={email} setEmail={setEmail}
          gLoading={gLoading} onGoogle={handleGoogle}
          onBack={() => go(BACK.email)}
          onConflict={methods => { setConflictMethods(methods); go('conflict') }}
          onForgot={() => go('reset')}
        />
      )
      break
    case 'conflict':
      view = (
        <ConflictView
          email={email.trim()} methods={conflictMethods} gLoading={gLoading}
          onBack={() => go(BACK.conflict)} onGoogle={handleGoogle} onUseDifferent={toEmail}
        />
      )
      break
    case 'googleFail':
      view = (
        <GoogleUnavailableView
          gLoading={gLoading} onBack={() => go(BACK.googleFail)} onEmail={toEmail}
          onRetry={() => { if (gLoading) return; setRetryCount(0); runGoogle() }}
        />
      )
      break
    case 'phone':
      view = (
        <PhoneView
          onBack={() => go(BACK.phone)} onEmail={toEmail}
          onSent={(result, digits) => { setPhoneResult(result); setPhone(digits); go('otp') }}
        />
      )
      break
    case 'otp':
      view = phoneResult && (
        <OtpView phone={phone} confirmResult={phoneResult} onResent={setPhoneResult} onBack={() => go(BACK.otp)} />
      )
      break
    case 'reset':
      view = (
        <ResetView
          initialEmail={email.trim()} onBack={() => go(BACK.reset)} onBackToSignin={backToSignin}
          onSent={addr => { setResetEmail(addr); go('resetSent') }}
        />
      )
      break
    case 'resetSent':
      view = <ResetSentView email={resetEmail} onBack={() => go(BACK.resetSent)} onBackToSignin={backToSignin} />
      break
  }

  return (
    <div className="auth auth-root">
      <BrandPanel />
      <main ref={colRef} className="auth-col">
        {screen === 'home' && <div aria-hidden="true" className="auth-lines auth-mobile-only" />}
        <div className="auth-col-inner">
          {screen === 'home' ? <MobileHero /> : <CompactHeader />}
          <section aria-label="Sign in to Growwly" className="auth-card">
            {view}
          </section>
        </div>
      </main>
    </div>
  )
}
