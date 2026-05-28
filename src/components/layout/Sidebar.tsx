'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ArrowLeftRight,
  CalendarDays,
  CalendarClock,
  FolderKanban,
  HandCoins,
  Settings,
  Leaf,
  Flame,
  LineChart,
  Target,
  CheckSquare,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useAppStore } from '@/store/appStore'
import Image from 'next/image'

const NAV = [
  { href: '/',             icon: LayoutDashboard, label: 'Overview' },
  { href: '/transactions', icon: ArrowLeftRight,  label: 'Transactions' },
  { href: '/planning',     icon: CalendarDays,    label: 'Planning' },
  { href: '/upcoming',     icon: CalendarClock,   label: 'Upcoming' },
  { href: '/goals',        icon: Target,          label: 'Savings' },
  { href: '/projects',     icon: FolderKanban,    label: 'Projects' },
  { href: '/borrowings',   icon: HandCoins,       label: 'Borrowings' },
  { href: '/tasks',        icon: CheckSquare,     label: 'Tasks' },
  { href: '/market',       icon: LineChart,       label: 'Market' },
  { href: '/settings',     icon: Settings,        label: 'Settings' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const settings = useAppStore((s) => s.settings)
  const isHighExpense = settings?.financialMode === 'high-expense'

  return (
    <aside
      className="hidden lg:flex flex-col flex-shrink-0"
      style={{
        width: 240,
        height: '100vh',
        position: 'sticky',
        top: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        padding: '18px 14px',
        gap: 14,
        zIndex: 10,
        overflowY: 'auto',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 12px' }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-deep) 100%)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25), 0 4px 12px -4px var(--brand)',
        }}>
          <Leaf size={18} strokeWidth={2} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text)' }}>
            Growwly
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 1 }}>
            Money OS
          </div>
        </div>
      </div>

      {/* Mode pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px', borderRadius: 10,
        background: isHighExpense ? 'var(--warn-soft)' : 'var(--good-soft)',
        color: isHighExpense ? 'var(--warn-ink)' : 'var(--good-ink)',
      }}>
        {isHighExpense ? <Flame size={14} /> : <Leaf size={14} />}
        <span style={{ fontSize: 12, fontWeight: 500 }}>
          {isHighExpense ? 'High Expense Mode' : 'Normal Mode'}
        </span>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 10,
                background: active ? 'var(--surface-2)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-2)',
                fontSize: 13.5, fontWeight: active ? 500 : 400,
                textDecoration: 'none', transition: 'all .12s',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              {active && (
                <span style={{
                  position: 'absolute', left: -14, top: 8, bottom: 8, width: 3,
                  background: 'var(--brand)', borderRadius: '0 4px 4px 0',
                }} />
              )}
              <Icon size={16} strokeWidth={1.6} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* User card */}
      {user && (
        <div style={{
          padding: 10, borderRadius: 12, border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {user.photoURL ? (
            <Image
              src={user.photoURL}
              alt={user.displayName ?? 'User'}
              width={32}
              height={32}
              style={{ borderRadius: '50%' }}
            />
          ) : (
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, oklch(0.6 0.13 245), oklch(0.45 0.13 280))',
              color: '#fff', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {user.displayName?.[0]?.toUpperCase() ?? 'U'}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.displayName ?? 'User'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.email}
            </div>
          </div>
          <button
            onClick={logout}
            className="btn-ghost btn btn-sm"
            style={{ padding: '4px 6px', fontSize: 11, flexShrink: 0 }}
          >
            Out
          </button>
        </div>
      )}
    </aside>
  )
}
