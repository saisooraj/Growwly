'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ArrowLeftRight,
  CalendarDays,
  CalendarClock,
  Target,
  FolderKanban,
  HandCoins,
  LineChart,
  Settings,
} from 'lucide-react'

const NAV = [
  { href: '/',             icon: LayoutDashboard, label: 'Home' },
  { href: '/transactions', icon: ArrowLeftRight,  label: 'Txns' },
  { href: '/planning',     icon: CalendarDays,    label: 'Plan' },
  { href: '/upcoming',     icon: CalendarClock,   label: 'Upcoming' },
  { href: '/goals',        icon: Target,          label: 'Goals' },
  { href: '/projects',     icon: FolderKanban,    label: 'Projects' },
  { href: '/borrowings',   icon: HandCoins,       label: 'Borrow' },
  { href: '/market',       icon: LineChart,       label: 'Market' },
  { href: '/settings',     icon: Settings,        label: 'Settings' },
]

export default function MobileNav() {
  const pathname  = usePathname()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [fadeLeft, setFadeLeft]   = useState(false)
  const [fadeRight, setFadeRight] = useState(true)

  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    setFadeLeft(el.scrollLeft > 8)
    setFadeRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8)
  }

  // Scroll active item into view on mount / route change
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const active = el.querySelector('[data-active="true"]') as HTMLElement | null
    if (active) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    onScroll()
  }, [pathname])

  return (
    <nav
      className="lg:hidden"
      style={{
        position: 'fixed', bottom: 12, left: 12, right: 12, zIndex: 50,
        background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
        backdropFilter: 'blur(20px) saturate(150%)',
        WebkitBackdropFilter: 'blur(20px) saturate(150%)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        alignItems: 'stretch',
      } as React.CSSProperties}
    >
      {/* Left fade */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 36,
        borderRadius: '18px 0 0 18px',
        background: 'linear-gradient(to right, color-mix(in oklch, var(--surface) 95%, transparent), transparent)',
        zIndex: 1, pointerEvents: 'none',
        opacity: fadeLeft ? 1 : 0,
        transition: 'opacity .2s',
      }} />

      {/* Scrollable row */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="mobile-nav-scroll"
        style={{
          display: 'flex',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          padding: 6,
          gap: 2,
          flex: 1,
        }}
      >
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              data-active={active}
              style={{
                flexShrink: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '8px 12px', borderRadius: 12, textDecoration: 'none',
                background: active ? 'var(--brand-soft)' : 'transparent',
                color: active ? 'var(--brand-ink)' : 'var(--text-3)',
                fontSize: 10.5, fontWeight: active ? 600 : 500,
                transition: 'all .12s',
                minWidth: 56,
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>

      {/* Right fade — also shows dots to hint scrollability */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 44,
        borderRadius: '0 18px 18px 0',
        background: 'linear-gradient(to left, color-mix(in oklch, var(--surface) 95%, transparent), transparent)',
        zIndex: 1, pointerEvents: 'none',
        opacity: fadeRight ? 1 : 0,
        transition: 'opacity .2s',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        paddingRight: 8,
      }}>
        {/* Three dots scroll hint */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 3, height: 3, borderRadius: '50%',
              background: 'var(--text-3)',
              opacity: 1 - i * 0.25,
            }} />
          ))}
        </div>
      </div>
    </nav>
  )
}
