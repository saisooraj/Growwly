'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { ConfirmationResult } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { useAuth } from '@/context/AuthContext'
import { auth, db } from '@/lib/firebase'
import {
  LogoTile, BackButton, GoogleButton, PrimaryButton, FieldMsg, authToast,
  ChartIcon, PieIcon, ShieldIcon, MailIcon, PhoneIcon, LockIcon, WarnIcon, AlertIcon, InfoIcon,
  CloseIcon, EyeIcon, EyeOffIcon, CheckIcon, RetryIcon, ArrowRightIcon,
} from './AuthUI'

// Optional parts of the design. Phone needs Firebase's paid plan for SMS, so it stays off.
export const AUTH_FLAGS = { phone: false, forgot: true, strength: true, suggest: true }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const TOO_MANY = 'Too many attempts. Wait a few minutes and try again.'
const NETWORK = 'Network error — check your connection and try again'
const GENERIC = 'Something went wrong. Please try again.'
const pretty = { textWrap: 'pretty' } as CSSProperties
const col: CSSProperties = { display: 'flex', flexDirection: 'column' }

function errCode(err: unknown) {
  return (err as { code?: string })?.code ?? ''
}

// ── Brand: desktop panel, mobile hero, compact header ──────────────────────────
const FEATURES = [
  { Icon: ChartIcon,  title: 'Visual charts', long: 'See where every rupee goes, month by month.', short: 'See every rupee' },
  { Icon: PieIcon,    title: 'Budget plans',  long: 'Plan around salary day, rent and EMIs.',      short: 'Plan each month' },
  { Icon: ShieldIcon, title: 'Secure data',   long: 'Secured with Firebase. Never sold, never shared.', short: 'Never shared' },
]

export function BrandPanel() {
  return (
    <aside className="auth-brand">
      <div aria-hidden="true" className="auth-brand-lines" />
      <div aria-hidden="true" className="auth-brand-rule" />
      <div aria-hidden="true" className="auth-brand-rupee">₹</div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
        <LogoTile size="md" />
        <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Growwly</span>
      </div>
      <div style={{ position: 'relative', maxWidth: 560 }}>
        <h1 style={{ margin: 0, fontSize: 50, lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.035em', textWrap: 'balance' } as CSSProperties}>
          Your personal finance{' '}
          <span style={{ display: 'block', fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400, fontSize: 68, letterSpacing: '-0.01em', color: 'var(--brand-ink)', marginTop: 4 }}>
            command centre.
          </span>
        </h1>
        <ul style={{ listStyle: 'none', margin: '44px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 440 }}>
          {FEATURES.map(({ Icon, title, long }) => (
            <li key={title} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <span aria-hidden="true" className="auth-feature-icon"><Icon size={20} /></span>
              <span style={{ paddingTop: 1 }}>
                <span style={{ display: 'block', fontSize: 16, fontWeight: 700 }}>{title}</span>
                <span style={{ display: 'block', marginTop: 3, fontSize: 15, lineHeight: 1.5, color: 'var(--text-2)' }}>{long}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p style={{ position: 'relative', margin: 0, fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 21, color: 'var(--text-2)' }}>
        Built for people who want to grow their wealth
      </p>
    </aside>
  )
}

export function MobileHero() {
  return (
    <header className="auth-mobile-only" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '16px 4px 28px', animation: 'authIn 420ms var(--ease) both' }}>
      <LogoTile size="lg" />
      <h1 style={{ margin: '20px 0 0', fontSize: 34, lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.035em' }}>Growwly</h1>
      <p style={{ margin: '8px 0 0', fontSize: 16, lineHeight: 1.4, color: 'var(--text-2)' }}>
        Your personal finance{' '}
        <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 20, color: 'var(--text)' }}>command centre</span>
      </p>
      <ul style={{ listStyle: 'none', margin: '24px 0 0', padding: 0, width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {FEATURES.map(({ Icon, title, short }) => (
          <li key={title} className="auth-tile">
            <span aria-hidden="true" className="auth-tile-icon"><Icon size={18} /></span>
            <span>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>{title}</span>
              <span style={{ display: 'block', marginTop: 2, fontSize: 12, lineHeight: 1.35, color: 'var(--text-2)' }}>{short}</span>
            </span>
          </li>
        ))}
      </ul>
    </header>
  )
}

export function CompactHeader() {
  return (
    <header className="auth-mobile-only" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px 20px' }}>
      <LogoTile size="sm" />
      <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Growwly</span>
    </header>
  )
}

// ── Welcome ────────────────────────────────────────────────────────────────────
export function WelcomeView({ banner, onDismissBanner, onEmail, onPhone, gLoading, onGoogle }: {
  banner: boolean
  onDismissBanner: () => void
  onEmail: () => void
  onPhone: () => void
  gLoading: boolean
  onGoogle: () => void
}) {
  return (
    <div className="auth-in" style={col}>
      {banner && (
        <div role="alert" className="auth-warn-box" style={{ padding: '12px 6px 12px 14px', marginBottom: 22, borderRadius: 12, animation: 'authIn 320ms var(--ease) both' }}>
          <WarnIcon size={20} style={{ flex: 'none', marginTop: 1 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Sign-in was interrupted</p>
            <p style={{ margin: '3px 0 0', fontSize: 14, lineHeight: 1.45 }}>
              Your browser may have blocked the sign-in flow. Tap <strong>Continue with Google</strong> below to try again.
            </p>
          </div>
          <button type="button" aria-label="Dismiss" onClick={onDismissBanner} className="auth-banner-close">
            <CloseIcon size={18} />
          </button>
        </div>
      )}
      <h2 className="auth-h2" style={{ marginTop: 0 }}>Get started free</h2>
      <p className="auth-sub">Track expenses, plan budgets, grow your wealth.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        <button type="button" onClick={onEmail} className="auth-btn auth-btn-soft">
          <MailIcon />
          <span>Continue with Email</span>
        </button>
        {AUTH_FLAGS.phone && (
          <button type="button" onClick={onPhone} className="auth-btn auth-btn-outline">
            <PhoneIcon />
            <span>Continue with phone</span>
          </button>
        )}
        <div role="separator" className="auth-divider">or</div>
        <GoogleButton label="Continue with Google" loading={gLoading} onClick={onGoogle} />
      </div>
      <p style={{ margin: '18px 0 0', textAlign: 'center', fontSize: 13, lineHeight: 1.5, color: 'var(--text-2)' }}>
        By continuing, you agree to our <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
      </p>
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>
        <LockIcon size={15} stroke={2.2} style={{ color: 'var(--brand-ink)' }} />
        <span>Data secured with Firebase · Never shared</span>
      </div>
      <p className="auth-mobile-only" style={{ margin: '10px 0 0', textAlign: 'center', fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 16, color: 'var(--text-2)' }}>
        Built for people who want to grow their wealth
      </p>
    </div>
  )
}

// ── Email sign in / sign up ────────────────────────────────────────────────────
type FieldErrors = { email?: string; password?: string; confirm?: string }
type FormError = 'incorrect' | 'noAccount' | 'tooMany' | 'disabled'

const FORM_ERR: Record<FormError, string> = {
  incorrect: 'Incorrect email or password',
  noAccount: 'No account with this email — try signing up instead',
  tooMany: TOO_MANY,
  disabled: 'This account has been disabled. Contact support.',
}

const STRENGTH = [
  { label: 'Too short',         bar: 'var(--bad)',   ink: 'var(--bad-ink)',   tip: 'Use at least 6 characters.' },
  { label: 'Weak',              bar: 'var(--bad)',   ink: 'var(--bad-ink)',   tip: 'Add numbers, a symbol or more length.' },
  { label: 'Could be stronger', bar: 'var(--warn)',  ink: 'var(--warn-ink)',  tip: 'Try 10+ characters or add a symbol.' },
  { label: 'Good',              bar: 'var(--brand)', ink: 'var(--brand-ink)', tip: 'Nice — a symbol would make it even stronger.' },
  { label: 'Strong',            bar: 'var(--brand)', ink: 'var(--brand-ink)', tip: 'Great password.' },
]

function strengthOf(pw: string) {
  let score = 0
  if (pw.length >= 6) score++
  if (pw.length >= 10) score++
  if (/\d/.test(pw) && /[a-z]/i.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw) && pw.length >= 6) score++
  return Math.min(4, score)
}

export function EmailView({ mode, setMode, email, setEmail, gLoading, onGoogle, onBack, onConflict, onForgot }: {
  mode: 'signin' | 'signup'
  setMode: (m: 'signin' | 'signup') => void
  email: string
  setEmail: (v: string) => void
  gLoading: boolean
  onGoogle: () => void
  onBack: () => void
  onConflict: (methods: string[]) => void
  onForgot: () => void
}) {
  const { signInWithEmail, signUpWithEmail, getSignInMethodsForEmail } = useAuth()
  const signup = mode === 'signup'
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [agreed, setAgreed]       = useState(false)
  const [agreeAttn, setAgreeAttn] = useState(0)
  const [errors, setErrors]       = useState<FieldErrors>({})
  const [formError, setFormError] = useState<FormError | null>(null)
  const [loading, setLoading]     = useState(false)
  const pwRef      = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)
  const agreeRef   = useRef<HTMLLabelElement>(null)

  // Auto-tick the privacy box when the user agrees on the /privacy page in another tab
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'gw_privacy_agreed' && e.newValue) {
        setAgreed(true)
        setAgreeAttn(0)
        localStorage.removeItem('gw_privacy_agreed')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function switchMode(m: 'signin' | 'signup') {
    setMode(m)
    setErrors({})
    setFormError(null)
    if (m === 'signin') setAgreeAttn(0)
  }

  function scrollToAgree() {
    const el = agreeRef.current
    const scroller = el?.closest('.auth-col') as HTMLElement | null
    if (!el || !scroller) return
    const c = scroller.getBoundingClientRect(), r = el.getBoundingClientRect()
    if (r.top < c.top + 16 || r.bottom > c.bottom - 16) {
      scroller.scrollBy({ top: r.top - c.top - c.height / 3, behavior: 'smooth' })
    }
  }

  async function submit() {
    const addr = email.trim()
    if (!addr || !password || loading) return

    const next: FieldErrors = {}
    if (!EMAIL_RE.test(addr)) next.email = 'Invalid email address'
    if (signup) {
      if (password.length < 6) next.password = 'Password must be at least 6 characters'
      else if (password !== confirm) next.confirm = 'Passwords do not match'
    }
    if (Object.keys(next).length) { setErrors(next); setFormError(null); return }
    if (signup && !agreed) { setAgreeAttn(n => n + 1); scrollToAgree(); return }

    setLoading(true)
    setFormError(null)
    setErrors({})
    try {
      if (signup) {
        await signUpWithEmail(addr, password)
        if (auth.currentUser) {
          await setDoc(doc(db, 'users', auth.currentUser.uid), {
            privacyAgreed: true,
            privacyAgreedAt: new Date().toISOString(),
          }, { merge: true })
        }
      } else {
        await signInWithEmail(addr, password)
      }
      authToast('ok', signup ? 'Account created!' : 'Welcome back!')
    } catch (err: unknown) {
      const code = errCode(err)
      if (code === 'auth/account-exists-with-different-credential' || code === 'auth/email-already-in-use') {
        const methods = await getSignInMethodsForEmail(addr).catch(() => [])
        onConflict(methods)
      } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setFormError('incorrect')
      } else if (code === 'auth/user-not-found') {
        setFormError('noAccount')
      } else if (code === 'auth/too-many-requests') {
        setFormError('tooMany')
      } else if (code === 'auth/user-disabled') {
        setFormError('disabled')
      } else if (code === 'auth/invalid-email') {
        setErrors({ email: 'Invalid email address' })
      } else if (code === 'auth/weak-password') {
        setErrors({ password: 'Password must be at least 6 characters' })
      } else if (code === 'auth/network-request-failed') {
        authToast('err', NETWORK)
      } else {
        authToast('err', GENERIC)
      }
    } finally {
      setLoading(false)
    }
  }

  const incorrect = formError === 'incorrect'
  const suggest = AUTH_FLAGS.suggest && formError === 'noAccount' && !signup
  const showStrength = AUTH_FLAGS.strength && signup && password.length > 0 && !errors.password
  const score = strengthOf(password)
  const level = STRENGTH[score]
  const attn = agreeAttn > 0 && !agreed

  return (
    <div className="auth-in" style={col}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <BackButton onClick={onBack} />
        <div role="tablist" aria-label="Sign in or sign up" className="auth-seg">
          <button type="button" role="tab" aria-selected={!signup} onClick={() => switchMode('signin')}>Sign In</button>
          <button type="button" role="tab" aria-selected={signup} onClick={() => switchMode('signup')}>Sign Up</button>
        </div>
      </div>
      <h2 className="auth-h2">{signup ? 'Create your account' : 'Welcome back'}</h2>
      <p className="auth-sub">{signup ? 'Just an email and a password to begin.' : 'Sign in to pick up where you left off.'}</p>

      <form noValidate onSubmit={e => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: 16, margin: '22px 0 0' }}>
        <div className="auth-field">
          <label htmlFor="auth-email" className="auth-label">Email</label>
          <input
            id="auth-email" className="auth-input" type="email" name="email" inputMode="email"
            autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com"
            value={email}
            onChange={e => { setEmail(e.target.value); setErrors(er => ({ ...er, email: undefined })); setFormError(null) }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); pwRef.current?.focus() } }}
            aria-invalid={!!errors.email || incorrect}
            aria-describedby={errors.email ? 'auth-email-err' : undefined}
          />
          {errors.email && <FieldMsg id="auth-email-err">{errors.email}</FieldMsg>}
        </div>

        <div className="auth-field">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 20 }}>
            <label htmlFor="auth-pw" className="auth-label">Password</label>
            {AUTH_FLAGS.forgot && !signup && (
              <button type="button" onClick={onForgot} className="auth-forgot">
                Forgot password?
              </button>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <input
              id="auth-pw" ref={pwRef} className="auth-input" style={{ paddingRight: 54 }}
              type={showPw ? 'text' : 'password'} name="password"
              autoComplete={signup ? 'new-password' : 'current-password'}
              placeholder={signup ? 'At least 6 characters' : 'Your password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setErrors(er => ({ ...er, password: undefined, confirm: undefined })); setFormError(null) }}
              onKeyDown={e => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                if (signup) confirmRef.current?.focus()
                else submit()
              }}
              aria-invalid={!!errors.password || incorrect}
              aria-describedby={errors.password ? 'auth-pw-err' : undefined}
            />
            <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw} className="auth-eye">
              {showPw ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {errors.password && <FieldMsg id="auth-pw-err">{errors.password}</FieldMsg>}
          {showStrength && (
            <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div aria-hidden="true" style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                  {[0, 1, 2, 3].map(i => (
                    <span key={i} style={{ height: 4, borderRadius: 2, background: i < Math.max(1, score) ? level.bar : 'var(--border)', transition: 'background-color 220ms var(--ease)' }} />
                  ))}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: level.ink }}>{level.label}</span>
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{level.tip}</span>
            </div>
          )}
        </div>

        {signup && (
          <>
            <div className="auth-field" style={{ animation: 'authIn 300ms var(--ease) both' }}>
              <label htmlFor="auth-confirm" className="auth-label">Confirm password</label>
              <input
                id="auth-confirm" ref={confirmRef} className="auth-input"
                type={showPw ? 'text' : 'password'} name="confirm-password" autoComplete="new-password"
                placeholder="Re-enter password"
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setErrors(er => ({ ...er, confirm: undefined })) }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
                aria-invalid={!!errors.confirm}
                aria-describedby={errors.confirm ? 'auth-confirm-err' : undefined}
              />
              {errors.confirm && <FieldMsg id="auth-confirm-err">{errors.confirm}</FieldMsg>}
            </div>
            <div className="auth-field">
              <label ref={agreeRef} style={{
                display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                border: `1px solid ${attn ? 'var(--warn)' : 'var(--border)'}`,
                background: attn ? 'var(--warn-soft)' : 'transparent',
                animation: attn ? `authShake${agreeAttn % 2 ? 'A' : 'B'} 440ms var(--ease)` : 'none',
                transition: 'background-color 200ms var(--ease), border-color 200ms var(--ease)',
              }}>
                <span style={{ position: 'relative', flex: 'none', width: 22, height: 22, marginTop: 1 }}>
                  <input
                    type="checkbox" checked={agreed}
                    onChange={e => { setAgreed(e.target.checked); if (e.target.checked) setAgreeAttn(0) }}
                    aria-describedby={attn ? 'auth-agree-err' : undefined}
                    style={{
                      appearance: 'none', WebkitAppearance: 'none', display: 'block', margin: 0, width: 22, height: 22,
                      borderRadius: 6, cursor: 'pointer',
                      border: `1.5px solid ${agreed ? 'var(--brand-deep)' : attn ? 'var(--warn-ink)' : 'var(--text-3)'}`,
                      background: agreed ? 'var(--brand-deep)' : 'var(--bg)',
                      transition: 'background-color 160ms var(--ease), border-color 160ms var(--ease)',
                    }}
                  />
                  {agreed && (
                    <CheckIcon size={22} stroke={2.6} style={{ position: 'absolute', inset: 0, padding: 3, color: 'var(--on-brand)', pointerEvents: 'none' }} />
                  )}
                </span>
                <span style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)' }}>
                  I agree to the <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>. My financial data is stored securely and only the developer can access it — solely for technical support.
                </span>
              </label>
              {attn && <FieldMsg id="auth-agree-err" warn>Tick the box to agree before creating your account.</FieldMsg>}
            </div>
          </>
        )}

        {formError && !suggest && (
          <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, background: 'var(--bad-soft)', color: 'var(--bad-ink)', fontSize: 14, lineHeight: 1.45, fontWeight: 600, animation: 'authIn 260ms var(--ease) both' }}>
            <AlertIcon size={18} stroke={2.2} style={{ flex: 'none', marginTop: 1 }} />
            <span>{FORM_ERR[formError]}</span>
          </div>
        )}

        {suggest && (
          <div role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, borderRadius: 12, background: 'var(--info-soft)', color: 'var(--info-ink)', animation: 'authIn 260ms var(--ease) both' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <InfoIcon size={18} stroke={2.2} style={{ flex: 'none', marginTop: 1 }} />
              <span style={{ fontSize: 14, lineHeight: 1.45, fontWeight: 500, overflowWrap: 'anywhere' }}>
                <strong style={{ display: 'block', fontWeight: 700 }}>New here?</strong>There&apos;s no account for {email.trim()} yet.
              </span>
            </div>
            <button type="button" onClick={() => { switchMode('signup'); setConfirm('') }} className="auth-suggest-btn">
              Create an account with this email
              <ArrowRightIcon size={16} stroke={2.2} />
            </button>
          </div>
        )}

        <PrimaryButton onClick={submit} disabled={!(email && password)} loading={loading} style={{ marginTop: 4 }}>
          <span>{loading ? (signup ? 'Creating account…' : 'Signing in…') : (signup ? 'Create Account' : 'Sign In')}</span>
        </PrimaryButton>
      </form>

      <div role="separator" className="auth-divider" style={{ margin: '20px 0' }}>or</div>
      <GoogleButton label="Continue with Google" loading={gLoading} onClick={onGoogle} />
    </div>
  )
}

// ── Account already exists ─────────────────────────────────────────────────────
export function ConflictView({ email, methods, gLoading, onBack, onGoogle, onUseDifferent }: {
  email: string
  methods: string[]
  gLoading: boolean
  onBack: () => void
  onGoogle: () => void
  onUseDifferent: () => void
}) {
  const hasGoogle = methods.includes('google.com')
  const names = [hasGoogle && 'Google', methods.includes('phone') && 'Phone'].filter(Boolean)

  return (
    <div className="auth-in" style={col}>
      <BackButton onClick={onBack} />
      <div role="alert" className="auth-warn-box" style={{ marginTop: 22, padding: 16, borderRadius: 18 }}>
        <WarnIcon size={22} style={{ flex: 'none', marginTop: 1 }} />
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>Account already exists</p>
          <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
            <strong>{email}</strong> is already registered{names.length ? ` via ${names.join(' and ')}` : ''}.
          </p>
        </div>
      </div>
      <ol style={{ listStyle: 'none', margin: '22px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span aria-hidden="true" className="auth-step">1</span>
          <span style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-2)', paddingTop: 2 }}>Sign in with your existing method first,</span>
        </li>
        <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span aria-hidden="true" className="auth-step">2</span>
          <span style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-2)', paddingTop: 2 }}>
            then add a password in <strong style={{ color: 'var(--text)', fontWeight: 700, whiteSpace: 'nowrap' }}>Settings → Linked Accounts</strong>.
          </span>
        </li>
      </ol>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 26 }}>
        {hasGoogle && <GoogleButton label="Sign in with Google" loading={gLoading} onClick={onGoogle} />}
        <button type="button" onClick={onUseDifferent} className="auth-link-btn" style={{ marginTop: 4 }}>Use a different email</button>
      </div>
    </div>
  )
}

// ── Google sign-in unavailable ─────────────────────────────────────────────────
export function GoogleUnavailableView({ gLoading, onBack, onRetry, onEmail }: {
  gLoading: boolean
  onBack: () => void
  onRetry: () => void
  onEmail: () => void
}) {
  return (
    <div className="auth-in" style={col}>
      <BackButton onClick={onBack} />
      <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '12px 4px 0' }}>
        <div aria-hidden="true" style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bad-soft)', color: 'var(--bad)', display: 'grid', placeItems: 'center' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4.5M12 16h.01" /></svg>
        </div>
        <h2 style={{ margin: '20px 0 0', fontSize: 22, lineHeight: 1.25, fontWeight: 700, letterSpacing: '-0.02em' }}>Google sign-in unavailable</h2>
        <p style={{ margin: '8px 0 0', maxWidth: 320, fontSize: 15, lineHeight: 1.55, color: 'var(--text-2)', ...pretty }}>
          Your browser blocked the sign-in window. This can happen in private browsing or when cookies are restricted.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 28 }}>
        <GoogleButton label="Try Google again" loading={gLoading} onClick={onRetry} icon={<RetryIcon size={19} />} />
        <PrimaryButton onClick={onEmail}>
          <MailIcon />
          Use email instead
        </PrimaryButton>
      </div>
    </div>
  )
}

// ── Phone number ───────────────────────────────────────────────────────────────
export function PhoneView({ onBack, onEmail, onSent }: {
  onBack: () => void
  onEmail: () => void
  onSent: (result: ConfirmationResult, digits: string) => void
}) {
  const { sendPhoneOTP } = useAuth()
  const [phone, setPhone]     = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const display = phone.length > 5 ? `${phone.slice(0, 5)} ${phone.slice(5)}` : phone

  async function send() {
    if (loading) return
    if (phone.length !== 10 || !/^[6-9]/.test(phone)) { setError('Enter a valid 10-digit mobile number.'); return }
    setLoading(true)
    setError(null)
    try {
      onSent(await sendPhoneOTP(`+91${phone}`), phone)
    } catch (err: unknown) {
      const code = errCode(err)
      const message = (err as { message?: string })?.message ?? ''
      if (code === 'auth/invalid-phone-number' || code === 'auth/missing-phone-number') setError('Enter a valid 10-digit mobile number.')
      else if (code === 'auth/too-many-requests') setError(TOO_MANY)
      else if (code === 'auth/network-request-failed') authToast('err', NETWORK)
      else if (code === 'auth/operation-not-allowed') authToast('err', 'Phone auth not enabled in Firebase Console')
      else if (code === 'auth/captcha-check-failed') authToast('err', 'reCAPTCHA failed — try refreshing the page')
      else if (message.includes('BILLING_NOT_ENABLED')) authToast('err', 'Phone sign-in requires a Firebase Blaze plan — use Email or Google instead')
      else authToast('err', `Failed to send OTP (${code || 'unknown'})`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-in" style={col}>
      <BackButton onClick={onBack} />
      <h2 className="auth-h2">Enter your mobile number</h2>
      <p className="auth-sub">We&apos;ll send a one-time code to verify</p>
      <div className="auth-field" style={{ marginTop: 22 }}>
        <label htmlFor="auth-phone" className="auth-label">Mobile number</label>
        <div className={`auth-phone${error ? ' is-invalid' : ''}`}>
          <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px 0 14px', borderRight: '1px solid var(--border)', font: "500 16px/1 'Geist Mono', monospace", color: 'var(--text)' }}>
            <span aria-hidden="true" style={{ fontSize: 18 }}>🇮🇳</span>
            <span aria-label="Country code plus 91">+91</span>
          </span>
          <input
            id="auth-phone" className="input-lg" type="tel" name="tel" inputMode="numeric" autoComplete="tel-national"
            placeholder="98765 43210" value={display}
            onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(null) }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } }}
            aria-invalid={!!error} aria-describedby="auth-phone-hint"
            style={{ flex: 1, minWidth: 0, height: '100%', border: 0, background: 'transparent', padding: '0 14px', font: "500 17px 'Geist Mono', monospace", letterSpacing: '.02em', color: 'var(--text)', outline: 'none' }}
          />
        </div>
        {error
          ? <FieldMsg id="auth-phone-hint">{error}</FieldMsg>
          : <p id="auth-phone-hint" style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>Use international format if outside India</p>}
      </div>
      <PrimaryButton onClick={send} disabled={phone.length === 0} loading={loading} style={{ marginTop: 24 }}>
        <span>{loading ? 'Sending…' : 'Send OTP'}</span>
      </PrimaryButton>
      <button type="button" onClick={onEmail} className="auth-link-btn" style={{ marginTop: 8 }}>Use email instead</button>
    </div>
  )
}

// ── OTP ────────────────────────────────────────────────────────────────────────
export function OtpView({ phone, confirmResult, onResent, onBack }: {
  phone: string
  confirmResult: ConfirmationResult
  onResent: (result: ConfirmationResult) => void
  onBack: () => void
}) {
  const { confirmPhoneOTP, sendPhoneOTP } = useAuth()
  const [otp, setOtp]         = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const [resend, setResend]   = useState(30)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (resend <= 0) return
    const t = setTimeout(() => setResend(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [resend])

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 380)
    return () => clearTimeout(t)
  }, [])

  async function verify(code: string) {
    if (code.length !== 6 || loading) return
    setLoading(true)
    setError(null)
    try {
      await confirmPhoneOTP(confirmResult, code)
      authToast('ok', 'Welcome back!')
    } catch (err: unknown) {
      const c = errCode(err)
      if (c === 'auth/invalid-verification-code') setError("That code isn't right. Check the SMS and try again.")
      else if (c === 'auth/code-expired') setError('This code has expired. Request a new one below.')
      else if (c === 'auth/too-many-requests') setError(TOO_MANY)
      else if (c === 'auth/network-request-failed') authToast('err', NETWORK)
      else authToast('err', 'Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function resendCode() {
    setOtp('')
    setError(null)
    try {
      onResent(await sendPhoneOTP(`+91${phone}`))
      authToast('ok', 'New code sent')
      setResend(30)
    } catch (err: unknown) {
      const c = errCode(err)
      if (c === 'auth/too-many-requests') setError(TOO_MANY)
      else authToast('err', c === 'auth/network-request-failed' ? NETWORK : GENERIC)
    }
  }

  const activeIdx = Math.min(otp.length, 5)

  return (
    <div className="auth-in" style={col}>
      <BackButton onClick={onBack} />
      <h2 className="auth-h2">Enter the OTP</h2>
      <p className="auth-sub">Code sent to <span className="auth-mono" style={{ color: 'var(--text)' }}>+91 ••••••{phone.slice(-4)}</span></p>
      <div style={{ position: 'relative', marginTop: 24 }}>
        <label htmlFor="auth-otp" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>One-time code, 6 digits</label>
        <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
          {[0, 1, 2, 3, 4, 5].map(i => {
            const d = otp[i] ?? ''
            const active = focused && i === activeIdx && !loading
            const cls = ['auth-otp-box', d && 'is-filled', active && 'is-active', error && 'is-invalid'].filter(Boolean).join(' ')
            return (
              <div key={i} className={cls}>
                {d}
                {active && !d && <span className="auth-otp-caret" />}
              </div>
            )
          })}
        </div>
        <input
          id="auth-otp" ref={inputRef} type="text" name="otp" inputMode="numeric" autoComplete="one-time-code"
          pattern="[0-9]*" maxLength={6} value={otp}
          onChange={e => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 6)
            setOtp(v)
            setError(null)
            if (v.length === 6) verify(v)
          }}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          aria-invalid={!!error} aria-describedby={error ? 'auth-otp-err' : undefined}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, border: 0, padding: 0, fontSize: 16, color: 'transparent', background: 'transparent', caretColor: 'transparent', cursor: 'text' }}
        />
      </div>
      {error && <FieldMsg id="auth-otp-err" style={{ margin: '10px 0 0' }}>{error}</FieldMsg>}
      <PrimaryButton onClick={() => verify(otp)} disabled={otp.length < 6} loading={loading} style={{ marginTop: 24 }}>
        <span>{loading ? 'Verifying…' : 'Verify & Sign in'}</span>
      </PrimaryButton>
      <div aria-live="polite" style={{ display: 'flex', justifyContent: 'center', marginTop: 8, minHeight: 44, alignItems: 'center' }}>
        {resend > 0
          ? <span style={{ fontSize: 14, color: 'var(--text-2)' }}>Resend OTP in <span className="auth-mono" style={{ color: 'var(--text)' }}>{resend}s</span></span>
          : (
            <button type="button" onClick={resendCode} className="auth-link-btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <RetryIcon size={16} stroke={2.2} />
              Resend OTP
            </button>
          )}
      </div>
    </div>
  )
}

// ── Reset password ─────────────────────────────────────────────────────────────
export function ResetView({ initialEmail, onBack, onBackToSignin, onSent }: {
  initialEmail: string
  onBack: () => void
  onBackToSignin: () => void
  onSent: (email: string) => void
}) {
  const { sendPasswordReset } = useAuth()
  const [email, setEmail]     = useState(initialEmail)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function send() {
    const addr = email.trim()
    if (!addr || loading) return
    if (!EMAIL_RE.test(addr)) { setError('Invalid email address'); return }
    setLoading(true)
    setError(null)
    try {
      await sendPasswordReset(addr)
      onSent(addr)
    } catch (err: unknown) {
      const code = errCode(err)
      // Don't reveal whether an address has an account
      if (code === 'auth/user-not-found') onSent(addr)
      else if (code === 'auth/invalid-email') setError('Invalid email address')
      else if (code === 'auth/too-many-requests') setError(TOO_MANY)
      else authToast('err', code === 'auth/network-request-failed' ? NETWORK : GENERIC)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-in" style={col}>
      <BackButton onClick={onBack} />
      <h2 className="auth-h2">Reset your password</h2>
      <p className="auth-sub">Enter the email you signed up with and we&apos;ll send you a link to set a new password.</p>
      <div className="auth-field" style={{ marginTop: 22 }}>
        <label htmlFor="auth-reset" className="auth-label">Email</label>
        <input
          id="auth-reset" className="auth-input" type="email" name="email" inputMode="email"
          autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(null) }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } }}
          aria-invalid={!!error} aria-describedby={error ? 'auth-reset-err' : undefined}
        />
        {error && <FieldMsg id="auth-reset-err">{error}</FieldMsg>}
      </div>
      <PrimaryButton onClick={send} disabled={!email} loading={loading} style={{ marginTop: 24 }}>
        <span>{loading ? 'Sending link…' : 'Send reset link'}</span>
      </PrimaryButton>
      <button type="button" onClick={onBackToSignin} className="auth-link-btn" style={{ marginTop: 8 }}>Back to sign in</button>
    </div>
  )
}

export function ResetSentView({ email, onBack, onBackToSignin }: {
  email: string
  onBack: () => void
  onBackToSignin: () => void
}) {
  const { sendPasswordReset } = useAuth()

  async function resend() {
    try {
      await sendPasswordReset(email)
      authToast('ok', 'Reset email sent again')
    } catch (err: unknown) {
      const code = errCode(err)
      if (code === 'auth/user-not-found') authToast('ok', 'Reset email sent again')
      else authToast('err', code === 'auth/too-many-requests' ? TOO_MANY : code === 'auth/network-request-failed' ? NETWORK : GENERIC)
    }
  }

  return (
    <div role="status" className="auth-in" style={col}>
      <BackButton onClick={onBack} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '12px 4px 0' }}>
        <div aria-hidden="true" style={{ position: 'relative', width: 64, height: 64, borderRadius: '50%', background: 'var(--brand-soft)', color: 'var(--brand-ink)', display: 'grid', placeItems: 'center' }}>
          <MailIcon size={28} />
          <span style={{ position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: '50%', background: 'var(--brand-deep)', color: 'var(--on-brand)', border: '3px solid var(--surface)', display: 'grid', placeItems: 'center' }}>
            <CheckIcon size={12} stroke={3.4} />
          </span>
        </div>
        <h2 className="auth-h2" style={{ marginTop: 20 }}>Check your inbox</h2>
        <p style={{ margin: '8px 0 0', maxWidth: 330, fontSize: 15, lineHeight: 1.55, color: 'var(--text-2)', ...pretty }}>
          We sent a reset link to <strong style={{ color: 'var(--text)', overflowWrap: 'anywhere' }}>{email}</strong>. It can take a minute — check spam if you don&apos;t see it.
        </p>
      </div>
      <PrimaryButton onClick={onBackToSignin} style={{ marginTop: 28 }}>Back to sign in</PrimaryButton>
      <button type="button" onClick={resend} className="auth-link-btn" style={{ marginTop: 8 }}>Didn&apos;t get it? Resend email</button>
    </div>
  )
}
