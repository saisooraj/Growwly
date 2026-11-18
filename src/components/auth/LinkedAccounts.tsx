'use client'

import { useState, type ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Sym, MONO, card, sub, rowTitle, btnOutline, btnPrimary, btnGhostBad, btnBad, field } from '@/components/settings/ui'
import toast from 'react-hot-toast'

type LinkView = null | 'link-google' | 'link-email' | 'change-password'

const linkedPill = (
  <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 999, background: 'var(--good-bg)', color: 'var(--good)', fontSize: 12, fontWeight: 500, flex: 'none' }}>Linked</span>
)

function ProviderRow({ tile, label, detail, top, children }: { tile: ReactNode; label: string; detail: string; top?: boolean; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', flexWrap: 'wrap', borderTop: top ? '1px solid var(--line)' : undefined }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--sf2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', flex: 'none' }}>{tile}</div>
      <div style={{ flex: '1 1 160px', minWidth: 0 }}>
        <div style={rowTitle}>{label}</div>
        <div style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--mut)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</div>
      </div>
      {children}
    </div>
  )
}

// Sign-in methods card on Settings: Google and email/password, linking, unlinking,
// changing the password, and signing out of this device.
export default function LinkedAccounts() {
  const { user, logout, linkGoogle, linkEmailPassword, unlinkProvider, changePassword } = useAuth()

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

  // ── Inline form panel ──────────────────────────────────────────────────────

  const input = (type: string, placeholder: string, value: string, onChange: (v: string) => void, eye = false) => (
    <div className="set-field" style={{ ...field(44), display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--ink)', fontSize: 14 }}
      />
      {eye && (
        <button onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} style={{ border: 0, background: 'transparent', color: 'var(--mut)', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}>
          <Sym name={showPw ? 'visibility_off' : 'visibility'} size={18} />
        </button>
      )}
    </div>
  )

  function renderInlineView() {
    if (!view) return null
    const pw = showPw ? 'text' : 'password'
    const close = () => { setView(null); setPwInput(''); setPwConfirm(''); setCurrentPw('') }

    return (
      <div style={{ padding: '16px 24px 20px', borderTop: '1px solid var(--line)', background: 'var(--sf2)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {view === 'link-google' && (
          <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--mut)' }}>Link your Google account so you can sign in with Google. Your data stays the same.</div>
        )}
        {view === 'link-email' && (
          <>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--mut)' }}>Add an email and password so you can also sign in with your email.</div>
            {input('email', 'Email address', emailInput, setEmailInput)}
            {input(pw, 'New password (min 6 chars)', pwInput, setPwInput, true)}
            {input(pw, 'Confirm password', pwConfirm, setPwConfirm)}
          </>
        )}
        {view === 'change-password' && (
          <>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--mut)' }}>Change your current password.</div>
            {input('password', 'Current password', currentPw, setCurrentPw)}
            {input(pw, 'New password', pwInput, setPwInput, true)}
            {input(pw, 'Confirm new password', pwConfirm, setPwConfirm)}
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={close} style={btnOutline(38, 12, 14)}>Cancel</button>
          {view === 'link-google' && (
            <button onClick={handleLinkGoogle} disabled={loading} style={{ ...btnPrimary(!loading) }}>{loading ? 'Connecting…' : 'Connect Google account'}</button>
          )}
          {view === 'link-email' && (
            <button onClick={handleLinkEmail} disabled={!emailInput || !pwInput || loading} style={btnPrimary(!!emailInput && !!pwInput && !loading)}>{loading ? 'Saving…' : 'Add email & password'}</button>
          )}
          {view === 'change-password' && (
            <button onClick={handleChangePassword} disabled={!currentPw || !pwInput || loading} style={btnPrimary(!!currentPw && !!pwInput && !loading)}>{loading ? 'Updating…' : 'Update password'}</button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px 16px', flexWrap: 'wrap', padding: '22px 24px 6px' }}>
        <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>Sign-in methods</div>
        <div style={{ ...sub, fontSize: 13.5, lineHeight: 1.5, marginTop: 0 }}>Your data stays the same regardless of which method you use.</div>
      </div>

      <ProviderRow
        tile={<span style={{ fontSize: 17, fontWeight: 600 }}>G</span>}
        label="Google"
        detail={hasGoogle ? (user.providerData.find(p => p.providerId === 'google.com')?.email ?? 'Linked') : 'Not linked'}
      >
        {hasGoogle ? (
          <>
            {linkedPill}
            {providerCount > 1 && <button onClick={() => setConfirmUnlink('google.com')} style={btnGhostBad()}>Remove</button>}
          </>
        ) : (
          <button onClick={() => { setView('link-google'); handleLinkGoogle() }} disabled={loading} style={btnOutline()}>
            <Sym name="link" size={17} />Link
          </button>
        )}
      </ProviderRow>

      <ProviderRow
        top
        tile={<Sym name="mail" size={21} />}
        label="Email & password"
        detail={hasEmail ? (user.email ?? 'Linked') : 'Not linked — add a password to sign in with email'}
      >
        {hasEmail ? (
          <>
            {linkedPill}
            <button onClick={() => setView('change-password')} style={btnOutline()}>Change password</button>
            {providerCount > 1 && <button onClick={() => setConfirmUnlink('password')} style={btnGhostBad()}>Remove</button>}
          </>
        ) : (
          <button onClick={() => { setEmailInput(user.email ?? ''); setView('link-email') }} style={btnOutline()}>
            <Sym name="link" size={17} />Link
          </button>
        )}
      </ProviderRow>

      {renderInlineView()}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 24px', flexWrap: 'wrap', borderTop: '1px solid var(--line)', background: 'var(--sf2)' }}>
        <div style={{ flex: '1 1 200px', fontSize: 13.5, lineHeight: 1.5, color: 'var(--mut)' }}>Signs you out on this device only. Your data stays synced.</div>
        <button onClick={logout} style={{ ...btnBad(), gap: 8 }}><Sym name="logout" size={18} />Sign out</button>
      </div>

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
