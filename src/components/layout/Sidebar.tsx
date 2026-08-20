'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ArrowLeftRight, CalendarDays, CalendarClock,
  FolderKanban, HandCoins, Settings, Leaf, Flame, LineChart,
  Target, CheckSquare, TrendingUp, Activity, Sparkles,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useAppStore } from '@/store/appStore'
import Image from 'next/image'

const ALL_NAV = [
  { href: '/',             icon: LayoutDashboard, label: 'Overview',     optional: false },
  { href: '/transactions', icon: ArrowLeftRight,  label: 'Transactions', optional: false },
  { href: '/planning',     icon: CalendarDays,    label: 'Planning',     optional: false },
  { href: '/networth',     icon: TrendingUp,      label: 'Net Worth',    optional: false },
  { href: '/upcoming',     icon: CalendarClock,   label: 'Upcoming',     optional: false },
  { href: '/goals',        icon: Target,          label: 'Savings',      optional: false },
  { href: '/projects',     icon: FolderKanban,    label: 'Projects',     optional: false },
  { href: '/borrowings',   icon: HandCoins,       label: 'Borrowings',   optional: false },
  { href: '/tasks',        icon: CheckSquare,     label: 'Tasks',        optional: true, settingKey: 'showTasksTab' as const },
  { href: '/health',       icon: Activity,        label: 'Health',       optional: true, settingKey: 'showHealthTab' as const },
  { href: '/market',       icon: LineChart,       label: 'Market',       optional: false },
  { href: '/chat',         icon: Sparkles,        label: 'AI Assistant', optional: false },
  { href: '/settings',     icon: Settings,        label: 'Settings',     optional: false },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const settings = useAppStore((s) => s.settings)
  const tasks = useAppStore(s => (s as any).tasks ?? [])

  const isHighExpense = settings?.financialMode === 'high-expense'
  const NAV = ALL_NAV.filter(item => !item.optional || (item.settingKey && settings?.[item.settingKey]))

  const pendingTasks = tasks.filter((t: any) => t.status !== 'done').length

  function badge(href: string): number | null {
    if (href === '/tasks') return pendingTasks > 0 ? pendingTasks : null
    return null
  }

  return (
    <aside
      className="hidden lg:flex flex-col flex-shrink-0"
      style={{
        width: 248,
        height: '100vh',
        position: 'sticky',
        top: 0,
        background: 'var(--sidebar)',
        borderRight: '1px solid var(--hair)',
        padding: '20px 14px 16px',
        gap: 12,
        zIndex: 10,
        overflowY: 'auto',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '4px 8px 14px' }}>
        <div style={{
          width: 38, height: 38, borderRadius: 13, flexShrink: 0,
          background: 'linear-gradient(150deg, var(--brand-2) 0%, var(--brand) 100%)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 16px -5px var(--brand), inset 0 1px 0 rgba(255,255,255,.25)',
        }}>
          <Leaf size={20} strokeWidth={2} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1.15 }}>
            Growwly
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-4)', marginTop: 1 }}>
            Money OS
          </div>
        </div>
      </div>

      {/* High Expense Mode pill */}
      {isHighExpense && (
        <Link
          href="/settings"
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '9px 12px', borderRadius: 13, textDecoration: 'none',
            background: 'var(--warn-soft)', color: 'var(--warn-ink)', marginBottom: 2,
          }}
        >
          <Flame size={15} strokeWidth={2} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>High Expense Mode</span>
        </Link>
      )}

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, margin: '0 -2px' }}>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          const b = badge(href)
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '9px 12px', borderRadius: 12,
                background: active ? 'var(--brand-soft)' : 'transparent',
                color: active ? 'var(--brand-ink)' : 'var(--text-2)',
                fontSize: 13.5, fontWeight: active ? 700 : 500,
                textDecoration: 'none', transition: 'background .12s, color .12s',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              {active && (
                <span style={{
                  position: 'absolute', left: -14, top: 9, bottom: 9, width: 3,
                  background: 'var(--brand)', borderRadius: '0 4px 4px 0',
                }} />
              )}
              <Icon
                size={17}
                strokeWidth={active ? 2.2 : 1.7}
                style={{ color: active ? 'var(--brand)' : 'var(--text-3)', flexShrink: 0 }}
              />
              <span style={{ flex: 1 }}>{label}</span>
              {b != null && (
                <span style={{
                  fontSize: 11, fontWeight: 800,
                  color: 'var(--brand-ink)', background: 'var(--brand-soft)',
                  borderRadius: 999, padding: '1px 7px', flexShrink: 0,
                }}>{b}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* User card */}
      {user && (
        <div style={{
          padding: '10px 12px', borderRadius: 14,
          border: '1px solid var(--border)',
          background: 'var(--surface-2)',
          display: 'flex', alignItems: 'center', gap: 10,
          marginTop: 8,
        }}>
          {user.photoURL ? (
            <Image
              src={user.photoURL}
              alt={user.displayName ?? 'User'}
              width={34} height={34}
              style={{ borderRadius: '50%', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(140deg, var(--brand-2), var(--brand))',
              color: '#fff', fontSize: 14, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {user.displayName?.[0]?.toUpperCase() ?? 'U'}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.displayName ?? 'User'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.email}
            </div>
          </div>
          <button
            onClick={logout}
            className="btn-ghost btn btn-sm"
            style={{ padding: '4px 8px', fontSize: 11, flexShrink: 0 }}
          >
            Out
          </button>
        </div>
      )}
    </aside>
  )
}
