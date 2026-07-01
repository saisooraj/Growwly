'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileNav from './MobileNav'
import AuthGuard from '@/components/ui/AuthGuard'
import AddTransactionModal from '@/components/transactions/AddTransactionModal'
import { useAppStore } from '@/store/appStore'
import { useRefreshData } from '@/hooks/useData'
import { Leaf } from 'lucide-react'

interface Props {
  title?: string
  children: React.ReactNode
}

const ACCENT_ATTRS: Record<string, string> = {
  green: 'green', purple: 'purple', orange: 'orange', pink: 'pink', blue: 'blue',
}

// Approximate hex values for each accent (used for favicon SVG + theme-color meta)
const BRAND_HEX: Record<string, { brand: string; deep: string }> = {
  green:  { brand: '#22c55e', deep: '#16a34a' },
  purple: { brand: '#9333ea', deep: '#7c3aed' },
  orange: { brand: '#f97316', deep: '#ea580c' },
  pink:   { brand: '#ec4899', deep: '#db2777' },
  blue:   { brand: '#0073e5', deep: '#005ab8' },
}

function makeFaviconSvg(brand: string, deep: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${brand}"/>
        <stop offset="100%" stop-color="${deep}"/>
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="7" fill="url(#g)"/>
    <g transform="translate(6 6) scale(0.833)" fill="none" stroke="white" stroke-opacity="0.95" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
    </g>
  </svg>`
}

const PULL_THRESHOLD = 58
const PULL_MAX = 96

// ── Pull-to-refresh indicator (matches g-app.jsx Loader) ─────────────────────
function PullIndicator({ pull, busy }: { pull: number; busy: boolean }) {
  const p = Math.min(1, pull / PULL_THRESHOLD)
  const y = Math.max(8, pull - 26)
  if (pull === 0 && !busy) return null
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 0,
      display: 'flex', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 6,
    }}>
      <div style={{
        transform: `translateY(${y}px) scale(${0.6 + p * 0.4})`,
        opacity: p,
        width: 38, height: 38, borderRadius: '50%',
        background: 'var(--surface)', boxShadow: 'var(--elev)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {busy ? (
          // Spinner ring
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            border: '2.5px solid var(--brand)',
            borderTopColor: 'transparent',
            animation: 'gw-spin .7s linear infinite',
          }} />
        ) : (
          // Leaf that rotates with pull distance (from design)
          <Leaf
            size={18}
            style={{
              color: 'var(--brand)',
              transform: `rotate(${pull * 4}deg)`,
            }}
          />
        )}
      </div>
    </div>
  )
}

export default function AppShell({ title, children }: Props) {
  const settings = useAppStore(s => s.settings)
  const refresh = useRefreshData()

  const mainRef = useRef<HTMLElement>(null)
  const [scrollY, setScrollY] = useState(0)
  const [pull, setPull] = useState(0)
  const [busy, setBusy] = useState(false)
  const drag = useRef({ active: false, y0: 0 })
  const [addOpen, setAddOpen] = useState(false)

  // ── Accent color + dynamic favicon + theme-color ────────────────────────────
  useEffect(() => {
    const accent = settings?.accentColor ?? 'green'
    const attr   = ACCENT_ATTRS[accent] ?? 'green'

    // 1. CSS design token
    if (attr === 'green') document.documentElement.removeAttribute('data-accent')
    else document.documentElement.setAttribute('data-accent', attr)

    // 2. Favicon — swap to an SVG data URL matching the brand gradient
    const { brand, deep } = BRAND_HEX[accent] ?? BRAND_HEX.green
    const svgUrl = `data:image/svg+xml,${encodeURIComponent(makeFaviconSvg(brand, deep))}`
    let iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!iconLink) {
      iconLink = document.createElement('link')
      iconLink.rel = 'icon'
      document.head.appendChild(iconLink)
    }
    iconLink.type = 'image/svg+xml'
    iconLink.href = svgUrl

    // 3. theme-color meta — controls browser chrome / PWA title bar colour
    let themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!themeMeta) {
      themeMeta = document.createElement('meta')
      themeMeta.name = 'theme-color'
      document.head.appendChild(themeMeta)
    }
    themeMeta.content = brand
  }, [settings?.accentColor])

  // ── Scroll tracking ─────────────────────────────────────────────────────────
  const onScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollY((e.currentTarget).scrollTop)
  }, [])

  // ── Pull-to-refresh ─────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const el = mainRef.current
    if (el && el.scrollTop <= 0 && !busy) {
      drag.current = { active: true, y0: e.clientY }
    }
  }, [busy])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!drag.current.active) return
    const dy = e.clientY - drag.current.y0
    if (dy > 0) setPull(Math.min(PULL_MAX, dy * 0.55))
    else setPull(0)
  }, [])

  const onPointerEnd = useCallback(() => {
    if (!drag.current.active) return
    drag.current.active = false
    if (pull > PULL_THRESHOLD) {
      setBusy(true)
      setPull(PULL_THRESHOLD)
      refresh().finally(() => {
        setBusy(false)
        setPull(0)
      })
    } else {
      setPull(0)
    }
  }, [pull, refresh])

  const scrolled = scrollY > 55

  return (
    <AuthGuard>
      <div className="app">
        <Sidebar />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: '100vh' }}>
          <Header title={title} scrolled={scrolled} onAdd={() => setAddOpen(true)} />
          <main
            ref={mainRef}
            className="main-content"
            style={{
              flex: 1,
              background: 'var(--bg)',
              overflowY: 'auto',
              overflowX: 'hidden',
              position: 'relative',
              WebkitOverflowScrolling: 'touch' as never,
            }}
            onScroll={onScroll}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerLeave={onPointerEnd}
            onPointerCancel={onPointerEnd}
          >
            {/* Content shifts down with pull, springs back when released */}
            <div style={{
              transform: `translateY(${pull}px)`,
              transition: pull > 0 ? 'none' : 'transform .32s cubic-bezier(.22,1,.36,1)',
              minHeight: '100%',
            }}>
              {children}
            </div>

            {/* Pull indicator lives outside the shifting div so it stays fixed */}
            <PullIndicator pull={pull} busy={busy} />
          </main>
        </div>
        <MobileNav />

      {/* Global add-transaction modal — lives outside the scroll/transform tree */}
      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} />
      </div>
    </AuthGuard>
  )
}
