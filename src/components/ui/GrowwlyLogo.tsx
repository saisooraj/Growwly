'use client'

type Size = 'sm' | 'md' | 'lg'

const SIZES: Record<Size, { box: number; icon: number; radius: number }> = {
  sm: { box: 32, icon: 15, radius: 10 },
  md: { box: 44, icon: 20, radius: 14 },
  lg: { box: 60, icon: 28, radius: 18 },
}

// Inlined SVG avoids hydration mismatches caused by Lucide version drift
// between the server bundle and cached client bundles served by the SW.
function LeafIcon({ size }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  )
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
      <LeafIcon size={icon} />
    </div>
  )
}
