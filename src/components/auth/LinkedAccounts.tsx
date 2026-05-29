'use client'

import { useState } from 'react'
import { Mail, Chrome, Check, Link2, Unlink, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'

type LinkView = null | 'link-google' | 'link-email' | 'change-password'

function ProviderRow({
  icon, label, sub, linked, onLink, onUnlink, canUnlink,
}: {
  icon: React.ReactNode
  label: string
  sub: string
  linked: boolean
  onLink: () => void
  onUnlink: () => void
  canUnlink: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: linked ? 'var(--brand-soft)' : 'var(--surface-2)',
        color: linked ? 'var(--brand-ink)' : 'var(--text-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</p>
        <p style={{ fontSize: 11.5, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</p>
      </div>
      {linked ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--good-ink)', background: 'var(--good-soft)', padding: '2px 8px', borderRadius: 999 }}>
            <Check size={11} /> Linked
          </span>
          {canUnlink && (
            <button
              onClick={onUnlink}
              className="btn btn-sm"
              style={{ padding: '4px 8px', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--bad-ink)' }}
            >
              <Unlink size={11} /> Remove
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={onLink}
          className="btn btn-sm"
          style={{ padding: '4px 10px', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
        >
          <Link2 size={11} /> Link
        </button>
      )}
    </div>
  )
}

export default function LinkedAccounts() {
  const { user, linkGoogle, linkEmailPassword, unlinkProvider, changePassword } = useAuth()

  const [view, setView]               = useState<LinkView>(null)
  const [confirmUnlink, setConfirmUnlink] = useState<string | null>(null)

  const [loading, setLoading]         = useState(false)

  // Email link / change password state
  const [emailInput, setEmailInput]   = useState(user?.email ?? '')
  const [pwInput, setPwInput]         = useState('')
  const [pwConfirm, setPwConfirm]     = useState('')
  const [currentPw, setCurrentPw]     = useState('')
  const [showPw, setShowPw]           = useState(false)

  if (!user) return null

  const providers = user.providerData.map(p => p.providerId)
  const hasGoogle = providers.includes('google.com')
  const hasEmail  = providers.includes('password')
  const providerCount = providers.length

  // ── Unlink ─────────────────────────────────────────────────────────────────

  async function doUnlink(providerId: string) {
    try {
      await unlinkProvider(providerId)
      toast.success('Account unlinked')
    } catch {
      toast.error('Failed to unlink — you may need to re-authenticate')
    }
  }

  // ── Link Google ────────────────────────────────────────────────────────────

  async function handleLinkGoogle() {
    setLoading(true)
    try {
      await linkGoogle()
      toast.success('Google account linked!')
      setView(null)
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? ''
      if (code === 'auth/credential-already-in-use') toast.error('This Google account is already linked to another Growwly account.')
      else toast.error('Failed to link Google account')
    } finally {
      setLoading(false)
    }
  }

  // ── Link Email/Password ────────────────────────────────────────────────────

  async function handleLinkEmail() {
    if (!emailInput || !pwInput) return
    if (pwInput !== pwConfirm) { toast.error('Passwords do not match'); return }
    if (pwInput.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      await linkEmailPassword(emailInput, pwInput)
      toast.success('Email & password added!')
      setView(null)
      setPwInput('')
      setPwConfirm('')
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? ''
      if (code === 'auth/email-already-in-use') toast.error('This email is already used by another account.')
      else if (code === 'auth/credential-already-in-use') toast.error('Email/password already linked.')
      else toast.error('Failed to add email/password')
    } finally {
      setLoading(false)
    }
  }

  // ── Change password ────────────────────────────────────────────────────────

  async function handleChangePassword() {
    if (!pwInput || !pwConfirm) return
    if (pwInput !== pwConfirm) { toast.error('Passwords do not match'); return }
    if (pwInput.length < 6) { toast.error('Minimum 6 characters'); return }
    setLoading(true)
    try {
      await changePassword(currentPw, pwInput)
      toast.success('Password updated!')
      setView(null)
      setCurrentPw('')
      setPwInput('')
      setPwConfirm('')
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? ''
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') toast.error('Current password is wrong')
      else toast.error('Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 10,
    border: '1px solid var(--border-strong)', background: 'var(--surface)',
    color: 'var(--text)', fontSize: 13, outline: 'none',
  }

  // ── Inline form panels ──────────────────────────────────────────────────────

  function renderInlineView() {
    if (!view) return null

    return (
      <div style={{ marginTop: 16, padding: '16px', background: 'var(--surface-2)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button onClick={() => setView(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 4 }}>
          <ArrowLeft size={13} /> Back
        </button>

        {view === 'link-google' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Link your Google account so you can sign in with Google. Your data stays the same.</p>
            <button className="btn-primary" onClick={handleLinkGoogle} disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Chrome size={14} /> {loading ? 'Connecting…' : 'Connect Google Account'}
            </button>
          </>
        )}

        {view === 'link-email' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Add an email and password so you can also sign in with your email.</p>
            <input className="input" style={{ fontSize: 13 }} type="email" placeholder="Email address" value={emailInput} onChange={e => setEmailInput(e.target.value)} />
            <div style={{ position: 'relative' }}>
              <input className="input" style={{ fontSize: 13, paddingRight: 40 }} type={showPw ? 'text' : 'password'} placeholder="New password (min 6 chars)" value={pwInput} onChange={e => setPwInput(e.target.value)} />
              <button onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <input className="input" style={{ fontSize: 13 }} type={showPw ? 'text' : 'password'} placeholder="Confirm password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} />
            <button className="btn-primary" onClick={handleLinkEmail} disabled={!emailInput || !pwInput || loading}>
              {loading ? 'Saving…' : 'Add Email & Password'}
            </button>
          </>
        )}

        {view === 'change-password' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Change your current password.</p>
            <input className="input" style={{ fontSize: 13 }} type="password" placeholder="Current password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
            <div style={{ position: 'relative' }}>
              <input className="input" style={{ fontSize: 13, paddingRight: 40 }} type={showPw ? 'text' : 'password'} placeholder="New password" value={pwInput} onChange={e => setPwInput(e.target.value)} />
              <button onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <input className="input" style={{ fontSize: 13 }} type={showPw ? 'text' : 'password'} placeholder="Confirm new password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} />
            <button className="btn-primary" onClick={handleChangePassword} disabled={!currentPw || !pwInput || loading}>
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <div>
      <ProviderRow
        icon={<Chrome size={15} />}
        label="Google"
        sub={hasGoogle ? (user.providerData.find(p => p.providerId === 'google.com')?.email ?? 'Linked') : 'Not linked'}
        linked={hasGoogle}
        canUnlink={providerCount > 1}
        onLink={() => { setView('link-google'); handleLinkGoogle() }}
        onUnlink={() => setConfirmUnlink('google.com')}
      />
      <ProviderRow
        icon={<Mail size={15} />}
        label="Email & Password"
        sub={hasEmail ? (user.email ?? 'Linked') : 'Not linked — add a password to sign in with email'}
        linked={hasEmail}
        canUnlink={providerCount > 1}
        onLink={() => { setEmailInput(user.email ?? ''); setView('link-email') }}
        onUnlink={() => setConfirmUnlink('password')}
      />

      {hasEmail && !view && (
        <button
          onClick={() => setView('change-password')}
          className="btn btn-sm"
          style={{ marginTop: 10, fontSize: 12 }}
        >
          Change password
        </button>
      )}

      {renderInlineView()}

      <ConfirmDialog
        open={!!confirmUnlink}
        message={`Remove ${confirmUnlink === 'google.com' ? 'Google' : 'email/password'} from your account? You must have at least one sign-in method.`}
        confirmLabel="Remove"
        onConfirm={() => confirmUnlink && doUnlink(confirmUnlink)}
        onClose={() => setConfirmUnlink(null)}
      />
    </div>
  )
}
