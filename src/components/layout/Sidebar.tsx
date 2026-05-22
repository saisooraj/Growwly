'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ArrowLeftRight,
  CalendarDays,
  FolderKanban,
  HandCoins,
  Settings,
  TrendingUp,
  Flame,
  LineChart,
  Target,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils'
import Image from 'next/image'

const NAV = [
  { href: '/',             icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/transactions', icon: ArrowLeftRight,  label: 'Transactions' },
  { href: '/planning',     icon: CalendarDays,    label: 'Planning' },
  { href: '/goals',        icon: Target,          label: 'Savings Goals' },
  { href: '/projects',     icon: FolderKanban,    label: 'Projects' },
  { href: '/borrowings',   icon: HandCoins,       label: 'Borrowings' },
  { href: '/market',       icon: LineChart,       label: 'Market Watch' },
  { href: '/settings',     icon: Settings,        label: 'Settings' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const settings = useAppStore((s) => s.settings)
  const isHighExpense = settings?.financialMode === 'high-expense'

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 bg-[#0A0B14] text-white border-r border-[#151728] flex-shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-[#151728]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-brand-500 to-fuchsia-500 shadow-lg shadow-brand-500/30">
            <TrendingUp size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight bg-gradient-to-r from-brand-400 to-fuchsia-400 bg-clip-text text-transparent">
            Growwly
          </span>
        </div>
        {isHighExpense && (
          <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-500/20 rounded-lg">
            <Flame size={14} className="text-orange-400" />
            <span className="text-xs font-medium text-orange-300">High Expense Mode</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-gradient-to-r from-brand-600/80 to-brand-700/60 text-white shadow-sm shadow-brand-500/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              )}
            >
              <Icon size={17} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      {user && (
        <div className="px-4 py-4 border-t border-[#151728]">
          <div className="flex items-center gap-3 mb-3">
            {user.photoURL ? (
              <Image
                src={user.photoURL}
                alt={user.displayName ?? 'User'}
                width={32}
                height={32}
                className="rounded-full ring-2 ring-brand-500/30"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-fuchsia-500 flex items-center justify-center text-sm font-bold">
                {user.displayName?.[0] ?? 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.displayName ?? 'User'}
              </p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full text-xs text-slate-500 hover:text-white transition-colors text-left px-1 py-1"
          >
            Sign out
          </button>
        </div>
      )}
    </aside>
  )
}
