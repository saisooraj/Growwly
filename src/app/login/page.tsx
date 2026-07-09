'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  TrendingUp, ShieldCheck, BarChart3, Wallet, Zap,
  Mail, ArrowLeft, Eye, EyeOff, ChevronRight,
} from 'lucide-react'
import type { ConfirmationResult } from 'firebase/auth'
import toast from 'react-hot-toast'
import GoogleIcon from '@/components/ui/GoogleIcon'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { auth } from '@/lib/firebase'

type Screen =
  | 'home'
  | 'phone-number'
  | 'phone-otp'
  | 'email-signin'
  | 'email-signup'
  | 'email-conflict'

// ── Shared input style ──────────────────────────────────────────────────────
const inputCls = "w-full bg-white/8 border border-white/15 rounded-2xl px-4 py-3.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-400/60 focus:bg-white/10 transition-all"

// ── Home screen ─────────────────────────────────────────────────────────────
function HomeScreen({ onMethod, onGoogle }: { onMethod: (s: Screen) => void; onGoogle: () => void }) {
  return (
    <>
      <div className="flex flex-col gap-3 mb-4">
        <button
          onClick={() => onMethod('email-signin')}
          className="w-full flex items-center gap-3 bg-white/8 hover:bg-white/12 border border-white/12 text-white font-medium py-3.5 px-4 rounded-2xl transition-all text-sm"
        >
          <span className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <Mail size={15} />
          </span>
          Continue with Email
          <ChevronRight size={15} className="ml-auto text-slate-500" />
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-xs text-slate-600">or</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <button
        onClick={onGoogle}
        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-semibold py-3.5 px-4 rounded-2xl transition-colors duration-150 shadow-lg text-sm"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <p className="text-center text-xs text-slate-600 mt-4">
        By continuing, you agree to our{' '}
        <a href="/privacy" className="text-slate-500 hover:text-slate-400 underline underline-offset-2">Privacy Policy</a>
      </p>
    </>
  )
}

// ── Phone number screen ──────────────────────────────────────────────────────
function PhoneNumberScreen({
  onBack, onOTPSent,
}: {
  onBack: () => void
  onOTPSent: (result: ConfirmationResult, phone: string) => void
}) {
  const { sendPhoneOTP } = useAuth()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSend() {
    const trimmed = phone.trim()
    if (!trimmed) return
    // Prepend +91 if not already international format
    const formatted = trimmed.startsWith('+') ? trimmed : `+91${trimmed.replace(/\D/g, '')}`
    setLoading(true)
    try {
      const result = await sendPhoneOTP(formatted)
      onOTPSent(result, formatted)
      toast.success('OTP sent!')
    } catch (err: unknown) {
      const code    = (err as { code?: string })?.code ?? ''
      const message = (err as { message?: string })?.message ?? ''
      console.error('[Phone OTP error]', code, err)
      if (code === 'auth/invalid-phone-number') toast.error('Invalid phone number')
      else if (code === 'auth/too-many-requests') toast.error('Too many attempts. Try later.')
      else if (code === 'auth/operation-not-allowed') toast.error('Phone auth not enabled in Firebase Console')
      else if (code === 'auth/captcha-check-failed') toast.error('reCAPTCHA failed — try refreshing the page')
      else if (code === 'auth/missing-phone-number') toast.error('Please enter a phone number')
      else if (message.includes('BILLING_NOT_ENABLED')) toast.error('Phone sign-in requires a Firebase Blaze plan — use Email or Google instead')
      else toast.error(`Failed to send OTP (${code || 'unknown'})`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-5 transition-colors">
        <ArrowLeft size={14} /> Back
      </button>
      <h2 className="text-base font-semibold text-white mb-1">Enter your mobile number</h2>
      <p className="text-sm text-slate-400 mb-5">We'll send a one-time code to verify</p>

      <div className="flex gap-2 mb-4">
        <div className="flex items-center bg-white/8 border border-white/15 rounded-2xl px-3 text-sm text-slate-300 gap-1.5 flex-shrink-0">
          🇮🇳 +91
        </div>
        <input
          className={inputCls}
          type="tel"
          placeholder="98765 43210"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          maxLength={15}
          autoFocus
        />
      </div>
      <p className="text-xs text-slate-600 mb-5">Use international format (+91 for India) if outside India</p>

      <button
        onClick={handleSend}
        disabled={!phone.trim() || loading}
        className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white font-semibold py-3.5 rounded-2xl transition-colors text-sm"
      >
        {loading ? 'Sending…' : 'Send OTP'}
      </button>
      <p className="text-center text-xs text-slate-600 mt-3">
        SMS requires Firebase Blaze plan · <button onClick={onBack} className="text-slate-500 hover:text-slate-400 underline underline-offset-2">Use email instead</button>
      </p>
    </>
  )
}

// ── OTP verification screen ──────────────────────────────────────────────────
function OTPScreen({
  phone, confirmResult, onBack,
}: {
  phone: string
  confirmResult: ConfirmationResult
  onBack: () => void
}) {
  const { confirmPhoneOTP } = useAuth()
  const [otp, setOtp]         = useState('')
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(30)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setResendTimer(t => { if (t <= 1) { clearInterval(timerRef.current!); return 0 } return t - 1 })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [])

  async function handleVerify() {
    if (otp.length < 6) return
    setLoading(true)
    try {
      await confirmPhoneOTP(confirmResult, otp)
      toast.success('Signed in!')
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? ''
      if (code === 'auth/invalid-verification-code') toast.error('Wrong OTP. Try again.')
      else if (code === 'auth/code-expired') toast.error('OTP expired. Request a new one.')
      else toast.error('Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const maskedPhone = phone.slice(0, -4).replace(/\d/g, '•') + phone.slice(-4)

  return (
    <>
      <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-5 transition-colors">
        <ArrowLeft size={14} /> Back
      </button>
      <h2 className="text-base font-semibold text-white mb-1">Enter the OTP</h2>
      <p className="text-sm text-slate-400 mb-5">Code sent to {maskedPhone}</p>

      <input
        className={`${inputCls} tracking-[0.4em] text-center text-lg font-semibold mb-4`}
        type="number"
        placeholder="------"
        value={otp}
        onChange={e => setOtp(e.target.value.slice(0, 6))}
        onKeyDown={e => e.key === 'Enter' && handleVerify()}
        autoFocus
      />

      <button
        onClick={handleVerify}
        disabled={otp.length < 6 || loading}
        className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white font-semibold py-3.5 rounded-2xl transition-colors text-sm mb-3"
      >
        {loading ? 'Verifying…' : 'Verify & Sign in'}
      </button>

      <p className="text-center text-xs text-slate-500">
        {resendTimer > 0
          ? `Resend OTP in ${resendTimer}s`
          : <button onClick={onBack} className="text-brand-400 hover:text-brand-300 transition-colors">Resend OTP</button>
        }
      </p>
    </>
  )
}

// ── Email sign-in / sign-up screen ──────────────────────────────────────────
function EmailScreen({
  onBack,
  onConflict,
}: {
  onBack: () => void
  onConflict: (email: string, methods: string[]) => void
}) {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, getSignInMethodsForEmail } = useAuth()
  const [mode, setMode]       = useState<'signin' | 'signup'>('signin')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false)

  async function handleSubmit() {
    if (!email || !password) return
    if (mode === 'signup' && password !== confirm) { toast.error('Passwords do not match'); return }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }

    setLoading(true)
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password)
      } else {
        await signUpWithEmail(email, password)
        if (auth.currentUser) {
          await setDoc(doc(db, 'users', auth.currentUser.uid), {
            privacyAgreed: true,
            privacyAgreedAt: new Date().toISOString(),
          }, { merge: true })
        }
      }
      toast.success(mode === 'signin' ? 'Welcome back!' : 'Account created!')
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? ''
      if (code === 'auth/account-exists-with-different-credential' || code === 'auth/email-already-in-use') {
        const methods = await getSignInMethodsForEmail(email).catch(() => [])
        onConflict(email, methods)
      } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        toast.error('Incorrect email or password')
      } else if (code === 'auth/user-not-found') {
        toast.error('No account with this email. Sign up instead?')
      } else if (code === 'auth/too-many-requests') {
        toast.error('Too many attempts. Try later or reset your password.')
      } else if (code === 'auth/weak-password') {
        toast.error('Password too weak. Use at least 6 characters.')
      } else {
        toast.error('Sign-in failed. Try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-5 transition-colors">
        <ArrowLeft size={14} /> Back
      </button>

      <div className="flex bg-white/6 rounded-2xl p-1 mb-5">
        {(['signin', 'signup'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              mode === m ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {m === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <input
          className={inputCls}
          type="email"
          placeholder="Email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoFocus
        />
        <div className="relative">
          <input
            className={inputCls + ' pr-11'}
            type={showPw ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && mode === 'signin' && handleSubmit()}
          />
          <button
            onClick={() => setShowPw(v => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            type="button"
          >
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {mode === 'signup' && (
          <input
            className={inputCls}
            type={showPw ? 'text' : 'password'}
            placeholder="Confirm password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        )}
        {mode === 'signup' && (
          <label className="flex items-start gap-2.5 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={agreedToPrivacy}
              onChange={e => setAgreedToPrivacy(e.target.checked)}
              className="mt-0.5 accent-brand-500 flex-shrink-0"
            />
            <span className="text-xs text-slate-400 leading-relaxed">
              I agree to the{' '}
              <a href="/privacy" target="_blank" className="text-slate-300 hover:text-white underline underline-offset-2">
                Privacy Policy
              </a>
              . My financial data is stored securely and only the developer can access it — solely for technical support.
            </span>
          </label>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!email || !password || loading || (mode === 'signup' && !agreedToPrivacy)}
        className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white font-semibold py-3.5 rounded-2xl transition-colors text-sm mb-4"
      >
        {loading ? (mode === 'signin' ? 'Signing in…' : 'Creating account…') : (mode === 'signin' ? 'Sign In' : 'Create Account')}
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-xs text-slate-600">or</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>
      <button
        onClick={signInWithGoogle}
        className="w-full flex items-center justify-center gap-3 bg-white/8 hover:bg-white/12 border border-white/12 text-white font-medium py-3 px-4 rounded-2xl transition-all text-sm"
      >
        <GoogleIcon />
        Continue with Google
      </button>
    </>
  )
}

// ── Conflict / account linking screen ───────────────────────────────────────
function ConflictScreen({
  email, methods, onBack, onGoogle,
}: {
  email: string
  methods: string[]
  onBack: () => void
  onGoogle: () => void
}) {
  const hasGoogle = methods.includes('google.com')
  const hasPhone  = methods.includes('phone')

  return (
    <>
      <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-5 transition-colors">
        <ArrowLeft size={14} /> Back
      </button>
      <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 mb-5">
        <p className="text-amber-400 text-sm font-medium mb-1">Account already exists</p>
        <p className="text-slate-400 text-xs">
          <span className="text-white">{email}</span> is already registered via{' '}
          {[hasGoogle && 'Google', hasPhone && 'Phone'].filter(Boolean).join(' and ')}.
        </p>
      </div>

      <p className="text-sm text-slate-300 mb-4">Sign in with your existing method first, then add a password in Settings → Linked Accounts.</p>

      {hasGoogle && (
        <button
          onClick={onGoogle}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-semibold py-3.5 px-4 rounded-2xl transition-colors text-sm mb-3 shadow-lg"
        >
          <GoogleIcon />
          Sign in with Google
        </button>
      )}
    </>
  )
}

// ── Main login page ─────────────────────────────────────────────────────────
export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth()
  const router = useRouter()

  const [screen, setScreen]               = useState<Screen>('home')
  const [phoneResult, setPhoneResult]     = useState<ConfirmationResult | null>(null)
  const [phoneNumber, setPhoneNumber]     = useState('')
  const [conflictEmail, setConflictEmail] = useState('')
  const [conflictMethods, setConflictMethods] = useState<string[]>([])

  useEffect(() => {
    if (!loading && user) router.replace('/')
  }, [user, loading])

  function handleGoogle() {
    try { signInWithGoogle() } catch { toast.error('Sign-in failed. Try again.') }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#06030F] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center animate-pulse bg-gradient-to-br from-brand-500 to-fuchsia-500 shadow-lg shadow-brand-500/30">
          <TrendingUp size={24} className="text-white" />
        </div>
        <p className="text-sm text-slate-400 font-medium">Loading Growwly…</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#06030F] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-violet-700/15 blur-[130px]" />
      <div className="pointer-events-none absolute bottom-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-fuchsia-700/10 blur-[100px]" />
      <div className="pointer-events-none absolute top-10 right-10 w-64 h-64 rounded-full bg-brand-800/10 blur-[80px]" />

      <div className="w-full max-w-md relative z-10">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 bg-gradient-to-br from-brand-500 to-fuchsia-500 shadow-2xl shadow-brand-500/30">
            <TrendingUp size={30} className="text-white" />
          </div>
          <h1 className="text-4xl font-display font-bold text-white mb-2 tracking-tight">
            Grow<span className="bg-gradient-to-r from-brand-400 to-fuchsia-400 bg-clip-text text-transparent">wly</span>
          </h1>
          <p className="text-slate-400 text-sm">Your personal finance command centre</p>
        </div>

        {/* Feature pills — only on home screen */}
        {screen === 'home' && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { icon: BarChart3,   label: 'Visual Charts' },
              { icon: Wallet,      label: 'Budget Plans'  },
              { icon: ShieldCheck, label: 'Secure Data'   },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
                <Icon size={20} className="text-brand-400 mx-auto mb-2" />
                <p className="text-xs text-slate-300 font-medium">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Auth card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-7 shadow-2xl">
          {screen === 'home' && (
            <div className="flex items-center gap-2 mb-1">
              <Zap size={16} className="text-brand-400" />
              <h2 className="text-base font-semibold text-white">Get started free</h2>
            </div>
          )}
          {screen === 'home' && (
            <p className="text-sm text-slate-400 mb-6">Track expenses, plan budgets, grow your wealth.</p>
          )}

          {screen === 'home' && (
            <HomeScreen onMethod={setScreen} onGoogle={handleGoogle} />
          )}
          {screen === 'phone-number' && (
            <PhoneNumberScreen
              onBack={() => setScreen('home')}
              onOTPSent={(result, phone) => {
                setPhoneResult(result)
                setPhoneNumber(phone)
                setScreen('phone-otp')
              }}
            />
          )}
          {screen === 'phone-otp' && phoneResult && (
            <OTPScreen
              phone={phoneNumber}
              confirmResult={phoneResult}
              onBack={() => setScreen('phone-number')}
            />
          )}
          {(screen === 'email-signin' || screen === 'email-signup') && (
            <EmailScreen
              onBack={() => setScreen('home')}
              onConflict={(email, methods) => {
                setConflictEmail(email)
                setConflictMethods(methods)
                setScreen('email-conflict')
              }}
            />
          )}
          {screen === 'email-conflict' && (
            <ConflictScreen
              email={conflictEmail}
              methods={conflictMethods}
              onBack={() => setScreen('email-signin')}
              onGoogle={handleGoogle}
            />
          )}

          <p className="text-center text-xs text-slate-600 mt-5">
            Data secured with Firebase · Never shared
          </p>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Built for people who want to grow their wealth
        </p>
      </div>
    </div>
  )
}
