'use client'

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import type { BadgeDef } from '@/lib/badges'

interface Props {
  badge: BadgeDef | null
  earnedDate: string | null
  queueLength: number
  onClose: () => void
}

export default function BadgeCelebrationModal({ badge, earnedDate, queueLength, onClose }: Props) {
  const [visible, setVisible] = useState(false)
  const [particles, setParticles] = useState<{ x: number; y: number; color: string; size: number; angle: number; speed: number }[]>([])

  useEffect(() => {
    if (badge) {
      setVisible(true)
      setParticles(
        Array.from({ length: 18 }, (_, i) => ({
          x: 30 + Math.random() * 40,
          y: 10 + Math.random() * 30,
          color: [badge.iconColor, '#fbbf24', '#34d399', '#f472b6', '#60a5fa'][i % 5],
          size: 4 + Math.random() * 5,
          angle: Math.random() * 360,
          speed: 0.6 + Math.random() * 0.8,
        }))
      )
    } else {
      setVisible(false)
    }
  }, [badge])

  if (!badge || !visible) return null

  const { name, Icon, iconColor, description, quote, threshold } = badge

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 150)
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
      onClick={handleClose}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes popIn { from { opacity: 0; transform: scale(.85) translateY(12px) } to { opacity: 1; transform: scale(1) translateY(0) } }
        @keyframes floatUp { from { opacity: 1; transform: translateY(0) rotate(var(--a)) } to { opacity: 0; transform: translateY(-80px) rotate(calc(var(--a) + 120deg)) } }
        @keyframes pulse-ring { 0% { transform: scale(1); opacity: .6 } 100% { transform: scale(1.5); opacity: 0 } }
      `}</style>

      <div
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 24, padding: '32px 28px 28px',
          maxWidth: 360, width: '100%',
          boxShadow: `0 24px 80px -12px rgba(0,0,0,.5), 0 0 0 1px ${iconColor}33`,
          display: 'flex', flexDirection: 'column', gap: 0,
          position: 'relative', overflow: 'hidden',
          animation: 'popIn .25s cubic-bezier(.34,1.56,.64,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Confetti particles */}
        {particles.map((p, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${p.x}%`, top: `${p.y}%`,
              width: p.size, height: p.size,
              borderRadius: p.size > 7 ? '50%' : 2,
              background: p.color,
              // @ts-expect-error custom property
              '--a': `${p.angle}deg`,
              animation: `floatUp ${p.speed + 1.2}s ease-out ${i * 60}ms forwards`,
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Glow strip at top */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, transparent, ${iconColor}, transparent)`,
        }} />

        {/* Header label */}
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase',
          color: iconColor, textAlign: 'center', marginBottom: 20,
        }}>
          🎉 Badge Unlocked
        </div>

        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18, position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            {/* Pulse ring */}
            <div style={{
              position: 'absolute', inset: -8, borderRadius: '50%',
              border: `2px solid ${iconColor}`,
              animation: 'pulse-ring 1.6s ease-out infinite',
            }} />
            <div style={{
              width: 80, height: 80, borderRadius: 22,
              background: `color-mix(in oklch, ${iconColor} 20%, var(--surface-2))`,
              border: `2px solid color-mix(in oklch, ${iconColor} 45%, transparent)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 8px 32px color-mix(in oklch, ${iconColor} 35%, transparent)`,
            }}>
              <Icon size={36} style={{ color: iconColor }} />
            </div>
          </div>
        </div>

        {/* Name + subtitle */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 5 }}>
            {threshold}-day streak badge
          </div>
        </div>

        {/* Description */}
        <div style={{ fontSize: 13.5, color: 'var(--text-2)', textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>
          {description}
        </div>

        {/* Earned date */}
        {earnedDate && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '10px 16px', borderRadius: 12, marginBottom: 16,
            background: `color-mix(in oklch, ${iconColor} 12%, var(--surface))`,
            border: `1px solid color-mix(in oklch, ${iconColor} 28%, transparent)`,
          }}>
            <span style={{ fontSize: 14 }}>📅</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 500 }}>
              Earned on <strong style={{ color: 'var(--text)' }}>{format(parseISO(earnedDate), 'dd MMM yyyy')}</strong>
            </span>
          </div>
        )}

        {/* Quote */}
        <div style={{
          padding: '12px 16px', borderRadius: 12, marginBottom: 24,
          background: 'var(--surface-2)',
          borderLeft: `3px solid ${iconColor}`,
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', lineHeight: 1.65 }}>
            {quote}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handleClose}
          style={{
            width: '100%', padding: '13px', borderRadius: 14, border: 'none',
            background: iconColor, color: '#fff',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: `0 4px 16px color-mix(in oklch, ${iconColor} 40%, transparent)`,
            transition: 'opacity .15s, transform .1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'scale(1.01)' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)' }}
        >
          {queueLength > 1 ? `Awesome! Next badge →` : 'Awesome! 🎊'}
        </button>

        {queueLength > 1 && (
          <div style={{ fontSize: 11, color: 'var(--text-4)', textAlign: 'center', marginTop: 10 }}>
            {queueLength} badges unlocked
          </div>
        )}
      </div>
    </div>
  )
}
