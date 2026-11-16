'use client'

import type { ReactNode, CSSProperties } from 'react'
import toast from 'react-hot-toast'

// Shared pieces for the auth screens. Styles live in the "Auth" section of globals.css.

// ── Icons (inline, matching the design's stroke icons) ─────────────────────────
type IconProps = { size?: number; stroke?: number; style?: CSSProperties }

function Svg({ size = 20, stroke = 2, style, children }: IconProps & { children: ReactNode }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {children}
    </svg>
  )
}

export const LeafIcon = (p: IconProps) => <Svg {...p}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></Svg>
export const ChartIcon = (p: IconProps) => <Svg {...p}><path d="M3 3v18h18" /><path d="M8 16v-4M13 16V8M18 16v-9" /></Svg>
export const PieIcon = (p: IconProps) => <Svg {...p}><path d="M21 12A9 9 0 1 1 12 3v9z" /><path d="M15.5 3.7A9 9 0 0 1 20.3 8.5H15.5z" /></Svg>
export const ShieldIcon = (p: IconProps) => <Svg {...p}><path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></Svg>
export const MailIcon = (p: IconProps) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Svg>
export const PhoneIcon = (p: IconProps) => <Svg {...p}><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18h2" /></Svg>
export const LockIcon = (p: IconProps) => <Svg {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>
export const WarnIcon = (p: IconProps) => <Svg {...p}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></Svg>
export const AlertIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></Svg>
export const InfoIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></Svg>
export const CloseIcon = (p: IconProps) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>
export const BackIcon = (p: IconProps) => <Svg {...p}><path d="M19 12H5M12 19l-7-7 7-7" /></Svg>
export const EyeIcon = (p: IconProps) => <Svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></Svg>
export const EyeOffIcon = (p: IconProps) => <Svg {...p}><path d="M3 3l18 18" /><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7c1.9 0 3.6-.6 5-1.4" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></Svg>
export const CheckIcon = (p: IconProps) => <Svg {...p}><path d="m5 12 5 5 9-10" /></Svg>
export const RetryIcon = (p: IconProps) => <Svg {...p}><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" /><path d="M21 3v5h-5" /></Svg>
export const ArrowRightIcon = (p: IconProps) => <Svg {...p}><path d="M5 12h14M13 5l7 7-7 7" /></Svg>
export const ArrowUpRightIcon = (p: IconProps) => <Svg {...p}><path d="M7 17 17 7M8 7h9v9" /></Svg>

export function GoogleMark() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

// ── Logo tile ──────────────────────────────────────────────────────────────────
const LOGO = {
  lg: { box: 60, radius: 16, icon: 30, stroke: 2,   shadow: '0 10px 28px -8px' },
  md: { box: 44, radius: 12, icon: 22, stroke: 2,   shadow: '0 8px 22px -8px' },
  sm: { box: 32, radius: 9,  icon: 16, stroke: 2.2, shadow: '0 6px 16px -6px' },
}

export function LogoTile({ size = 'lg', plain = false }: { size?: keyof typeof LOGO; plain?: boolean }) {
  const s = LOGO[size]
  const inset = size === 'sm' ? '' : ', inset 0 1px 0 color-mix(in oklch, var(--on-brand) 25%, transparent)'
  return (
    <div aria-hidden="true" className="auth-logo" style={{
      width: s.box, height: s.box, borderRadius: s.radius,
      boxShadow: plain ? undefined : `${s.shadow} color-mix(in oklch, var(--brand) 75%, transparent)${inset}`,
    }}>
      <LeafIcon size={s.icon} stroke={s.stroke} />
    </div>
  )
}

// ── Buttons ────────────────────────────────────────────────────────────────────
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" aria-label="Back" onClick={onClick} className="auth-back">
      <BackIcon />
    </button>
  )
}

export function GoogleButton({ label, loading, onClick, icon }: {
  label: string
  loading: boolean
  onClick: () => void
  icon?: ReactNode
}) {
  return (
    <button type="button" onClick={onClick} aria-busy={loading} className="auth-btn auth-btn-google" style={icon ? { gap: 10 } : undefined}>
      {loading ? <span aria-hidden="true" className="auth-spinner" /> : (icon ?? <GoogleMark />)}
      <span>{loading ? 'Connecting…' : label}</span>
    </button>
  )
}

export function PrimaryButton({ children, onClick, disabled = false, loading = false, style }: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  style?: CSSProperties
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || loading} aria-busy={loading}
      className="auth-btn auth-btn-primary" style={style}>
      {loading && <span aria-hidden="true" className="auth-spinner" />}
      {children}
    </button>
  )
}

export function FieldMsg({ id, children, warn = false, style }: { id?: string; children: ReactNode; warn?: boolean; style?: CSSProperties }) {
  return (
    <p id={id} role="alert" className={`auth-msg${warn ? ' is-warn' : ''}`} style={style}>
      {warn ? <WarnIcon size={15} stroke={2.2} /> : <AlertIcon size={15} stroke={2.2} />}
      {children}
    </p>
  )
}

// ── Boot loader ────────────────────────────────────────────────────────────────
// Shown while auth starts up and again between sign-in and the dashboard.
export function BootLoader() {
  return (
    <div className="auth" style={{ position: 'fixed', inset: 0 }}>
      <div role="status" aria-live="polite" className="auth-boot" style={{ animation: 'authFade 240ms var(--ease) both' }}>
        <div style={{ borderRadius: 16, animation: 'authPulse 1.6s var(--ease) infinite' }}>
          <LogoTile size="lg" />
        </div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-2)' }}>Loading Growwly…</p>
      </div>
    </div>
  )
}

// ── Privacy consent sheet ──────────────────────────────────────────────────────
// Bottom sheet on phones, centred dialog on desktop, over a still loader.
export function ConsentSheet({ onAgree, saving }: { onAgree: () => void; saving: boolean }) {
  return (
    <div className="auth" style={{ position: 'fixed', inset: 0, background: 'var(--bg)' }}>
      <div aria-hidden="true" className="auth-boot">
        <LogoTile size="lg" plain />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-2)' }}>Loading Growwly…</p>
      </div>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', animation: 'authFade 280ms var(--ease) both' }} />
      <div className="auth-consent-wrap">
        <div role="dialog" aria-modal="true" aria-labelledby="auth-consent-title" className="auth-consent">
          <span aria-hidden="true" className="auth-mobile-only" style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '-8px 0 20px' }} />
          <div aria-hidden="true" style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--brand-soft)', color: 'var(--brand-ink)', display: 'grid', placeItems: 'center' }}>
            <ShieldIcon size={28} />
          </div>
          <h2 id="auth-consent-title" style={{ margin: '18px 0 0', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Privacy Policy</h2>
          <p style={{ margin: '8px 0 0', maxWidth: 320, fontSize: 15, lineHeight: 1.55, color: 'var(--text-2)', textWrap: 'pretty' } as CSSProperties}>
            We&apos;ve added a privacy policy. Please review it before continuing.
          </p>
          <PrimaryButton onClick={onAgree} loading={saving} style={{ marginTop: 26 }}>
            <span>{saving ? 'Saving…' : 'I Understand & Agree'}</span>
          </PrimaryButton>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, marginTop: 8, fontSize: 15, textDecoration: 'none' }}>
            Read full Privacy Policy
            <ArrowUpRightIcon size={14} stroke={2.2} />
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Toast ──────────────────────────────────────────────────────────────────────
// Toasts are only for success and network/system errors; field problems show inline.
export function authToast(kind: 'ok' | 'err', text: string) {
  const ok = kind === 'ok'
  toast.custom(t => (
    <div className="auth">
      <div role={ok ? 'status' : 'alert'} aria-live={ok ? 'polite' : 'assertive'} className={`auth-toast${t.visible ? '' : ' is-leaving'}`}>
        <span aria-hidden="true" style={{
          flex: 'none', width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center',
          background: ok ? 'var(--brand-soft)' : 'var(--bad-soft)', color: ok ? 'var(--brand-ink)' : 'var(--bad-ink)',
        }}>
          {ok
            ? <CheckIcon size={15} stroke={3} />
            : <Svg size={16} stroke={2.6}><path d="M12 7v6M12 17h.01" /></Svg>}
        </span>
        <span>{text}</span>
      </div>
    </div>
  ), { position: 'top-center', duration: 3200 })
}
