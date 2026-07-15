'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { Shield, Loader2 } from 'lucide-react'

const ADMIN_EMAIL = 'saisoorajpnair@gmail.com'
const PIN_LENGTH = 6

type Step = 'sign-in' | 'pin' | 'verifying'

function AdminLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/admin'
  const { user, loading, signInWithGoogle, logout } = useAuth()

  const [step, setStep] = useState<Step>('sign-in')
  const [pin, setPin] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Move to pin step once correct user is signed in
  useEffect(() => {
    if (!loading && user) {
      if (user.email === ADMIN_EMAIL) {
        setStep('pin')
        setTimeout(() => inputRefs.current[0]?.focus(), 100)
      } else {
        // Wrong account — sign them out silently
        logout()
        setError('This Google account is not authorized.')
      }
    }
    if (!loading && !user && step === 'pin') {
      setStep('sign-in')
    }
  }, [user, loading, step, logout])

  function handlePinKey(index: number, value: string) {
    if (!/^\d?$/.test(value)) return
    const next = [...pin]
    next[index] = value
    setPin(next)
    if (value && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
    if (next.every(d => d !== '')) {
      submitPin(next.join(''))
    }
  }

  function handlePinBackspace(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  async function submitPin(pinStr: string) {
    if (!user || submitting) return
    setSubmitting(true)
    setError(null)
    setStep('verifying')

    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, pin: pinStr }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Access denied')
        setPin(['', '', '', '', '', ''])
        setStep('pin')
        setTimeout(() => inputRefs.current[0]?.focus(), 50)
        return
      }

      router.replace(next)
    } catch {
      setError('Network error. Try again.')
      setPin(['', '', '', '', '', ''])
      setStep('pin')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={centerStyle}>
        <Loader2 size={24} style={{ color: 'var(--text-4)', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={centerStyle}>
        <div style={{
          width: '100%', maxWidth: 380,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 24, padding: '36px 32px',
          boxShadow: 'var(--elev-lg)',
        }}>
          {/* Icon */}
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'linear-gradient(140deg, var(--bad-2), var(--bad))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <Shield size={24} color="#fff" strokeWidth={2} />
          </div>

          <h1 style={{
            fontSize: 20, fontWeight: 800, color: 'var(--text)',
            textAlign: 'center', margin: '0 0 6px', letterSpacing: '-0.03em',
          }}>
            Admin Console
          </h1>
          <p style={{
            fontSize: 13, color: 'var(--text-3)', textAlign: 'center',
            margin: '0 0 28px', lineHeight: 1.5,
          }}>
            {step === 'sign-in'
              ? 'Sign in with your admin Google account'
              : step === 'verifying'
              ? 'Verifying…'
              : `Welcome, ${user?.displayName?.split(' ')[0]}. Enter your PIN.`}
          </p>

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 18,
              background: 'var(--bad-soft)', color: 'var(--bad-ink)',
              fontSize: 13, fontWeight: 500, textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          {/* Step: sign in */}
          {step === 'sign-in' && (
            <button
              onClick={signInWithGoogle}
              style={{
                width: '100%', padding: '12px 20px', borderRadius: 12,
                border: '1px solid var(--border)', background: 'var(--surface-2)',
                color: 'var(--text)', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 10,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          )}

          {/* Step: PIN */}
          {(step === 'pin' || step === 'verifying') && (
            <div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
                {pin.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el }}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handlePinKey(i, e.target.value)}
                    onKeyDown={e => handlePinBackspace(i, e)}
                    disabled={step === 'verifying'}
                    style={{
                      width: 44, height: 52, textAlign: 'center',
                      fontSize: 22, fontWeight: 800, letterSpacing: '0.1em',
                      borderRadius: 12, border: `2px solid ${digit ? 'var(--bad)' : 'var(--border)'}`,
                      background: 'var(--surface-2)', color: 'var(--text)',
                      outline: 'none', transition: 'border-color .15s',
                    }}
                  />
                ))}
              </div>

              {step === 'verifying' && (
                <div style={{ textAlign: 'center' }}>
                  <Loader2 size={20} style={{ color: 'var(--text-3)', animation: 'spin 1s linear infinite' }} />
                </div>
              )}

              <button
                onClick={() => { logout(); setStep('sign-in'); setPin(['', '', '', '', '', '']); setError(null) }}
                style={{
                  width: '100%', marginTop: 16, padding: '8px',
                  background: 'none', border: 'none', color: 'var(--text-4)',
                  fontSize: 12.5, cursor: 'pointer',
                }}
              >
                Sign out and use a different account
              </button>
            </div>
          )}
        </div>

        <p style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 16, textAlign: 'center' }}>
          Restricted access · Growwly Admin Console
        </p>
      </div>
    </>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div style={centerStyle}><Loader2 size={24} style={{ color: 'var(--text-4)', animation: 'spin 1s linear infinite' }} /></div>}>
      <AdminLoginContent />
    </Suspense>
  )
}

const centerStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: 'var(--bg)',
}
