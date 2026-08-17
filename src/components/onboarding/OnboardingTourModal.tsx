'use client'

import { useEffect, useState } from 'react'
import type { AnnouncementStep } from '@/types'
import { resolveIcon } from '@/lib/announcements'

interface Props {
  open: boolean
  steps: AnnouncementStep[]
  onFinish: () => void
  onSkip: () => void
}

export default function OnboardingTourModal({ open, steps, onFinish, onSkip }: Props) {
  const [visible, setVisible] = useState(false)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (open) {
      setVisible(true)
      setIndex(0)
    } else {
      setVisible(false)
    }
  }, [open])

  if (!open || !visible || steps.length === 0) return null

  const step = steps[index]
  const isLast = index === steps.length - 1
  const { iconKey, title, body } = step
  const Icon = resolveIcon(iconKey)

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
      onClick={() => close(onSkip)}
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
        {/* Skip */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <button
            onClick={() => close(onSkip)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12.5, fontWeight: 600, color: 'var(--text-4)',
              padding: '4px 2px', fontFamily: 'inherit',
            }}
          >
            Skip
          </button>
        </div>

        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <div style={{
            width: 68, height: 68, borderRadius: 20,
            background: 'var(--brand-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={30} style={{ color: 'var(--brand)' }} />
          </div>
        </div>

        {/* Title + body */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 10 }}>
            {title}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
            {body}
          </div>
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === index ? 18 : 6, height: 6, borderRadius: 3,
                background: i === index ? 'var(--brand)' : 'var(--border)',
                transition: 'width .2s, background .2s',
              }}
            />
          ))}
        </div>

        {/* Nav buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          {index > 0 && (
            <button
              onClick={() => setIndex(i => i - 1)}
              className="btn-ghost btn"
              style={{ flex: 1, padding: '12px', borderRadius: 14, fontSize: 13.5, fontWeight: 700 }}
            >
              Back
            </button>
          )}
          <button
            onClick={() => isLast ? close(onFinish) : setIndex(i => i + 1)}
            style={{
              flex: 2, padding: '13px', borderRadius: 14, border: 'none',
              background: 'var(--brand)', color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 4px 16px color-mix(in oklch, var(--brand) 40%, transparent)',
              transition: 'opacity .15s, transform .1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          >
            {isLast ? "Let's go" : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
