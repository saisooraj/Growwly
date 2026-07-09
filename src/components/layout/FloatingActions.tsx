'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'

const HIDDEN_PAGES = new Set(['/chat', '/login'])

export default function FloatingActions() {
  const pathname = usePathname()
  const router   = useRouter()

  if (HIDDEN_PAGES.has(pathname)) return null

  return (
    <>
      <style>{`
        @keyframes gw-ai-glow {
          0%, 100% { box-shadow: 0 6px 20px -4px var(--brand), 0 0 0 0 color-mix(in oklch, var(--brand) 40%, transparent); }
          55%       { box-shadow: 0 6px 20px -4px var(--brand), 0 0 0 9px color-mix(in oklch, var(--brand) 0%, transparent); }
        }
        .gw-ai-fab { animation: gw-ai-glow 3.6s ease-in-out infinite; }
        .gw-ai-fab:active { transform: scale(0.91) !important; animation: none; }
      `}</style>

      {/*
        Mobile : right-3.5 (14px), bottom-[100px] — clears the floating nav pill
        Desktop: lg:right-6 (24px), lg:bottom-6 (24px)
      */}
      <button
        onClick={() => router.push('/chat')}
        aria-label="Open Groowtt AI"
        className="gw-ai-fab fixed z-40 right-3.5 bottom-[100px] lg:right-6 lg:bottom-6 flex items-center justify-center"
        style={{
          width: 50, height: 50,
          borderRadius: 16,
          background: 'linear-gradient(150deg, var(--brand-2), var(--brand))',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
          transition: 'transform .14s cubic-bezier(.2,.8,.2,1)',
        }}
        onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.91)')}
        onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <Sparkles size={22} strokeWidth={1.8} />
      </button>
    </>
  )
}
