'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ArrowLeftRight,
  CalendarDays,
  Target,
  HandCoins,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/',             icon: LayoutDashboard, label: 'Home' },
  { href: '/transactions', icon: ArrowLeftRight,  label: 'Txns' },
  { href: '/planning',     icon: CalendarDays,    label: 'Plan' },
  { href: '/goals',        icon: Target,          label: 'Goals' },
  { href: '/borrowings',   icon: HandCoins,       label: 'Borrow' },
]

export default function MobileNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#0A0B14] border-t border-slate-200 dark:border-[#151728] lg:hidden">
      <div className="flex items-center justify-around h-16">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors',
                active ? 'text-brand-500' : 'text-slate-400 dark:text-slate-500'
              )}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
