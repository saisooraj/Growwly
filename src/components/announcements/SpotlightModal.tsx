'use client'

import { useEffect, useState } from 'react'
import type { Announcement } from '@/types'
import { resolveIcon } from '@/lib/announcements'

interface Props {
  announcement: Announcement | null
  onDismiss: () => void
  onCta: () => void
}

export default function SpotlightModal({ announcement, onDismiss, onCta }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(!!announcement)
  }, [announcement])

  if (!announcement || !visible) return null

  const Icon = resolveIcon(announcement.iconKey)

  function close(action: () => void) {
    setVisible(false)
    setTimeout(action, 150)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 70,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        animation: 'fadeIn .2s ease',
      }}
      onClick={() => close(onDismiss)}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes popIn { from { opacity: 0; transform: scale(.85) translateY(12px) } to { opacity: 1; transform: scale(1) translateY(0) } }
      `}</style>

      <div
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 24, padding: '28px 26px 24px',
          maxWidth: 380, width: '100%',
          boxShadow: '0 24px 80px -12px rgba(0,0,0,.5)',
          display: 'flex', flexDirection: 'column',
          animation: 'popIn .25s cubic-bezier(.34,1.56,.64,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <button
            onClick={() => close(onDismiss)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12.5, fontWeight: 600, color: 'var(--text-4)',
              padding: '4px 2px', fontFamily: 'inherit',
            }}
          >
            Dismiss
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <div style={{
            width: 68, height: 68, borderRadius: 20,
            background: 'var(--brand-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={30} style={{ color: 'var(--brand)' }} />
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 10 }}>
            {announcement.title}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
            {announcement.body}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {announcement.ctaLabel && (
            <button
              onClick={() => close(onCta)}
              style={{
                flex: 1, padding: '13px', borderRadius: 14, border: 'none',
                background: 'var(--brand)', color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 4px 16px color-mix(in oklch, var(--brand) 40%, transparent)',
              }}
            >
              {announcement.ctaLabel}
            </button>
          )}
          {!announcement.ctaLabel && (
            <button
              onClick={() => close(onDismiss)}
              style={{
                flex: 1, padding: '13px', borderRadius: 14, border: 'none',
                background: 'var(--brand)', color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 4px 16px color-mix(in oklch, var(--brand) 40%, transparent)',
              }}
            >
              Got it
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
