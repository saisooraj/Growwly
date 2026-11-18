'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import LinkedAccounts from '@/components/auth/LinkedAccounts'
import { Sym, MONO, SERIF } from './ui'

export function displayName(user: { displayName: string | null; email: string | null } | null) {
  return user?.displayName || user?.email?.split('@')[0] || 'You'
}

function Avatar({ size, font }: { size: number; font: number }) {
  const { user } = useAuth()
  const name = displayName(user)
  return (
    <div style={{
      position: 'relative', width: size, height: size, borderRadius: '50%', flex: 'none', overflow: 'hidden',
      background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.32)',
      display: 'grid', placeItems: 'center', fontFamily: SERIF, fontSize: font, lineHeight: 1,
    }}>
      {user?.photoURL
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={user.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : name[0]?.toUpperCase()}
    </div>
  )
}

const heroBg = {
  color: 'var(--on-acc)',
  background: 'linear-gradient(135deg, var(--acc) 0%, color-mix(in oklch, var(--acc) 70%, black) 100%)',
} as const

function Glow({ size, right, top }: { size: number; right: number; top: number }) {
  return (
    <div aria-hidden style={{
      position: 'absolute', right, top, width: size, height: size, borderRadius: '50%', pointerEvents: 'none', opacity: 0.6,
      background: 'radial-gradient(closest-side, color-mix(in oklch, var(--acc) 35%, white), transparent)',
    }} />
  )
}

/** The accent identity card. Tapping the name five times opens the admin console (admin only). */
export function IdentityHero() {
  const { user } = useAuth()
  const router = useRouter()
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
  const isAdmin = !!adminEmail && user?.email === adminEmail
  const taps = useRef(0)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (tapTimer.current) clearTimeout(tapTimer.current) }, [])

  function onTap() {
    if (!isAdmin) return
    taps.current += 1
    if (tapTimer.current) clearTimeout(tapTimer.current)
    if (taps.current >= 5) {
      taps.current = 0
      toast.success('Opening admin console…')
      router.push('/admin')
      return
    }
    tapTimer.current = setTimeout(() => { taps.current = 0 }, 1500)
  }

  if (!user) return null
  const providers = user.providerData.map(p => p.providerId)
  const chips = [providers.includes('google.com') && 'Google', providers.includes('password') && 'Email & password'].filter(Boolean) as string[]

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 24, padding: 28, ...heroBg, boxShadow: '0 24px 48px -24px color-mix(in oklch, var(--acc) 75%, transparent)' }}>
      <Glow size={340} right={-90} top={-140} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div onClick={onTap} style={{ display: 'flex', alignItems: 'center', gap: 18, flex: '1 1 240px', minWidth: 0, userSelect: 'none', WebkitTapHighlightColor: 'transparent' }}>
          <Avatar size={64} font={34} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: SERIF, fontSize: 38, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(user)}</div>
            <div style={{ fontFamily: MONO, fontSize: 13, opacity: 0.85, marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
          </div>
        </div>
        {chips.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {chips.map(c => (
              <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', borderRadius: 999, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.22)', fontSize: 13, fontWeight: 500 }}>
                <Sym name="check_circle" size={16} />{c}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Phone root: the same card as a row that opens Profile & account */
export function IdentityRow({ onOpen }: { onOpen: () => void }) {
  const { user } = useAuth()
  if (!user) return null
  return (
    <button
      onClick={onOpen} className="set-press"
      style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 14, padding: 18, border: 0, borderRadius: 24, textAlign: 'left', cursor: 'pointer', ...heroBg, boxShadow: '0 18px 36px -20px color-mix(in oklch, var(--acc) 80%, transparent)' }}
    >
      <Glow size={200} right={-60} top={-90} />
      <Avatar size={52} font={28} />
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(user)}</div>
        <div style={{ fontFamily: MONO, fontSize: 12.5, opacity: 0.85, marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
      </div>
      <Sym name="chevron_right" size={22} style={{ position: 'relative', opacity: 0.8 }} />
    </button>
  )
}

export default function ProfileSection() {
  return (
    <>
      <IdentityHero />
      <LinkedAccounts />
    </>
  )
}
