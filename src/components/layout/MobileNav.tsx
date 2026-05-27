'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ArrowLeftRight,
  CalendarDays,
  CalendarClock,
  Target,
} from 'lucide-react'

const NAV = [
  { href: '/',             icon: LayoutDashboard, label: 'Home' },
  { href: '/transactions', icon: ArrowLeftRight,  label: 'Txns' },
  { href: '/planning',     icon: CalendarDays,    label: 'Plan' },
  { href: '/upcoming',     icon: CalendarClock,   label: 'Upcoming' },
  { href: '/goals',        icon: Target,          label: 'Goals' },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      className="flex lg:hidden"
      style={{
        position: 'fixed', bottom: 12, left: 12, right: 12, zIndex: 50,
        background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
        backdropFilter: 'blur(20px) saturate(150%)',
        WebkitBackdropFilter: 'blur(20px) saturate(150%)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        padding: 6,
        boxShadow: 'var(--shadow-lg)',
        justifyContent: 'space-around',
      }}
    >
      {NAV.map(({ href, icon: Icon, label }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '8px 4px', borderRadius: 12, textDecoration: 'none',
              background: active ? 'var(--brand-soft)' : 'transparent',
              color: active ? 'var(--brand-ink)' : 'var(--text-3)',
              fontSize: 10.5, fontWeight: 500,
              transition: 'all .12s',
            }}
          >
            <Icon size={18} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
