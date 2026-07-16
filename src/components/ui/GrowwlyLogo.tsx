'use client'

import { Leaf } from 'lucide-react'

type Size = 'sm' | 'md' | 'lg'

const SIZES: Record<Size, { box: number; icon: number; radius: number }> = {
  sm: { box: 32, icon: 15, radius: 10 },
  md: { box: 44, icon: 20, radius: 14 },
  lg: { box: 60, icon: 28, radius: 18 },
}

export default function GrowwlyLogo({
  size = 'md',
  pulse = false,
}: {
  size?: Size
  pulse?: boolean
}) {
  const { box, icon, radius } = SIZES[size]
  return (
    <div
      className={pulse ? 'animate-pulse' : ''}
      style={{
        width: box, height: box, borderRadius: radius, flexShrink: 0,
        background: 'linear-gradient(150deg, var(--brand-2, #4ade80) 0%, var(--brand-deep, #15803d) 100%)',
        color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 6px 20px -6px var(--brand, #22c55e)',
      }}
    >
      <Leaf size={icon} strokeWidth={2} />
    </div>
  )
}
