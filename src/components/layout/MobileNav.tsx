'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ArrowLeftRight, TrendingUp,
  Plus, X,
  CalendarDays, CalendarClock, Target, FolderKanban,
  HandCoins, CheckSquare, Activity, LineChart, Settings,
  Flame, Leaf, Sparkles,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { useRefreshData } from '@/hooks/useData'
import AddTransactionModal from '@/components/transactions/AddTransactionModal'
import BillScannerModal from '@/components/transactions/BillScannerModal'
import { AddEntryMenu } from '@/components/transactions/AddEntryMenu'

// ── Main nav tabs (always visible) ────────────────────────────────────────────
const MAIN_NAV = [
  { href: '/',             icon: LayoutDashboard, label: 'Home'     },
  { href: '/transactions', icon: ArrowLeftRight,  label: 'Activity' },
  // FAB slot in position 3
  { href: '/networth',     icon: TrendingUp,      label: 'Wealth'   },
]

// ── More sheet sections ────────────────────────────────────────────────────────
const MORE_SECTIONS = [
  { href: '/planning',   label: 'Planning',   Icon: CalendarDays  },
  { href: '/upcoming',   label: 'Upcoming',   Icon: CalendarClock },
  { href: '/goals',      label: 'Savings',    Icon: Target        },
  { href: '/projects',   label: 'Projects',   Icon: FolderKanban  },
  { href: '/borrowings', label: 'Borrowings', Icon: HandCoins     },
  { href: '/tasks',      label: 'Tasks',      Icon: CheckSquare,  settingKey: 'showTasksTab' as const  },
  { href: '/health',     label: 'Health',     Icon: Activity,     settingKey: 'showHealthTab' as const },
  { href: '/market',     label: 'Market',     Icon: LineChart     },
  { href: '/chat',       label: 'AI Chat',    Icon: Sparkles      },
  { href: '/settings',   label: 'Settings',   Icon: Settings      },
]

// ── NavBtn ─────────────────────────────────────────────────────────────────────
function NavBtn({
  href, icon: Icon, label, active,
}: { href?: string; icon: React.ElementType; label: string; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href ?? '#'}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 3, padding: '6px 0', textDecoration: 'none',
        color: active ? 'var(--brand)' : 'var(--text-4)',
        transition: 'color .18s',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Icon
        size={23}
        strokeWidth={active ? 2.2 : 1.8}
        style={{ transition: 'transform .18s', transform: active ? 'translateY(-1px)' : 'none' }}
      />
      <span style={{ fontSize: 10, fontWeight: active ? 700 : 600 }}>{label}</span>
    </Link>
  )
}

// ── MoreSheet ─────────────────────────────────────────────────────────────────
function MoreSheet({
  open, onClose, pathname,
}: { open: boolean; onClose: () => void; pathname: string }) {
  const router = useRouter()
  const settings = useAppStore(s => s.settings)
  const tasks = useAppStore(s => s.tasks ?? [])
  const healthLogs = useAppStore(s => (s as any).healthLogs ?? [])
  const healthStreak: number = (useAppStore(s => (s as any).healthStreak) ?? 0)
  const isHighExpense = settings?.financialMode === 'high-expense'
  const [mounted, setMounted] = useState(false)
  const [closing, setClosing] = useState(false)

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
      document.body.style.overflow = 'hidden'
    } else if (mounted) {
      setClosing(true)
      document.body.style.overflow = ''
      const t = setTimeout(() => { setMounted(false); setClosing(false) }, 340)
      return () => clearTimeout(t)
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!mounted) return null

  const pendingTasks = tasks.filter((t: any) => t.status !== 'done').length

  const visibleSections = MORE_SECTIONS.filter(s => {
    if (!s.settingKey) return true
    return settings?.[s.settingKey] === true
  })

  function badge(href: string): string | number | null {
    if (href === '/tasks') return pendingTasks > 0 ? pendingTasks : null
    if (href === '/health') return healthStreak > 0 ? `🔥${healthStreak}` : null
    return null
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(8,6,20,.46)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
        className={closing ? 'gw-overlay-out' : 'gw-overlay-in'}
      />

      {/* Sheet */}
      <div
        className={closing ? 'gw-sheet-exit' : 'gw-sheet-enter'}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'var(--bg)',
          borderRadius: '28px 28px 0 0',
          padding: '10px 20px calc(env(safe-area-inset-bottom, 0px) + 28px)',
          boxShadow: '0 -12px 40px rgba(0,0,0,.18)',
        }}
      >
        {/* Handle */}
        <div style={{
          width: 40, height: 4, borderRadius: 999,
          background: 'var(--border-strong)', margin: '0 auto 20px', opacity: .6,
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>All sections</span>
          <button
            onClick={onClose}
            style={{
              width: 34, height: 34, borderRadius: '50%', border: 'none',
              background: 'var(--surface-2)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* High Expense Mode pill */}
        {isHighExpense && (
          <button
            onClick={() => { onClose(); router.push('/settings') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '12px 14px', borderRadius: 14, border: 'none', cursor: 'pointer',
              background: 'var(--warn-soft)', color: 'var(--warn-ink)',
              marginBottom: 14, fontFamily: 'inherit',
            }}
          >
            <Flame size={17} />
            <span style={{ fontSize: 14, fontWeight: 700 }}>High Expense Mode</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, opacity: .8 }}>Active</span>
          </button>
        )}

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {visibleSections.map(s => {
            const active = pathname === s.href || pathname.startsWith(s.href + '/')
            const b = badge(s.href)
            return (
              <Link
                key={s.href}
                href={s.href}
                onClick={onClose}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9,
                  padding: '16px 8px', borderRadius: 18, textDecoration: 'none',
                  background: active ? 'var(--brand-soft)' : 'var(--surface-2)',
                  position: 'relative',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {b != null && (
                  <span style={{
                    position: 'absolute', top: 8, right: 10,
                    fontSize: 10.5, fontWeight: 800, color: 'var(--warn-ink)',
                  }}>{b}</span>
                )}
                <s.Icon
                  size={24}
                  strokeWidth={1.8}
                  style={{ color: active ? 'var(--brand)' : 'var(--text-2)' }}
                />
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: active ? 'var(--brand-ink)' : 'var(--text-2)',
                }}>{s.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function MobileNav() {
  const pathname = usePathname()
  const settings = useAppStore(s => s.settings)
  const refresh = useRefreshData()
  const [addOpen, setAddOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const moreActive = !['/', '/transactions', '/networth'].includes(pathname)

  return (
    <>
      <nav
        className="flex lg:hidden"
        style={{
          position: 'fixed',
          bottom: 20,
          left: 14,
          right: 14,
          zIndex: 50,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            background: 'var(--nav-bg)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid var(--nav-border)',
            borderRadius: 26,
            boxShadow: 'var(--nav-shadow)',
            padding: '6px 8px',
            pointerEvents: 'auto',
          }}
        >
          {/* Home + Activity */}
          {MAIN_NAV.slice(0, 2).map(item => (
            <NavBtn
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={pathname === item.href}
            />
          ))}

          {/* FAB */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <AddEntryMenu
              open={addMenuOpen}
              onClose={() => setAddMenuOpen(false)}
              onManual={() => setAddOpen(true)}
              onScan={() => setScanOpen(true)}
              placement="up"
              variant="icons"
              anchor={
                <button
                  onClick={() => setAddMenuOpen(o => !o)}
                  style={{
                    width: 52, height: 52, borderRadius: 17, border: 'none',
                    background: 'linear-gradient(150deg, var(--brand-2), var(--brand))',
                    color: '#fff', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginTop: -24,
                    boxShadow: '0 8px 20px -5px var(--brand), 0 2px 6px rgba(0,0,0,.18)',
                    transition: 'transform .14s cubic-bezier(.2,.8,.2,1)',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
                  onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                  onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <Plus size={26} strokeWidth={2.6} />
                </button>
              }
            />
          </div>

          {/* Net Worth */}
          {MAIN_NAV.slice(2).map(item => (
            <NavBtn
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={pathname === item.href}
            />
          ))}

          {/* More */}
          <button
            onClick={() => setMoreOpen(true)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 3, padding: '6px 0', background: 'none', border: 'none', cursor: 'pointer',
              color: moreActive ? 'var(--brand)' : 'var(--text-4)',
              transition: 'color .18s',
              WebkitTapHighlightColor: 'transparent',
              fontFamily: 'inherit',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center', height: 23 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: moreActive ? 18 : 14 + i * 2,
                  height: 2.5, borderRadius: 999,
                  background: 'currentColor', transition: 'width .18s',
                }} />
              ))}
            </div>
            <span style={{ fontSize: 10, fontWeight: moreActive ? 700 : 600 }}>More</span>
          </button>
        </div>
      </nav>

      <AddTransactionModal
        open={addOpen}
        onClose={() => { setAddOpen(false); refresh() }}
      />

      <BillScannerModal
        open={scanOpen}
        onClose={() => { setScanOpen(false); refresh() }}
      />

      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        pathname={pathname}
      />
    </>
  )
}
