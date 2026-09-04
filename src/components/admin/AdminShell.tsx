'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  LayoutDashboard, Users, Activity,
  Flag, ClipboardList, Leaf, LogOut, Shield, ShieldAlert, Megaphone, MessageSquare,
  Menu, X,
} from 'lucide-react'

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? 'saisoorajpnair@gmail.com'
// Auto-logout after 60 minutes of no mouse/keyboard activity
const INACTIVITY_MS = 60 * 60 * 1000

const NAV = [
  { href: '/admin',              icon: LayoutDashboard, label: 'Overview'       },
  { href: '/admin/users',        icon: Users,           label: 'Users'          },
  { href: '/admin/system',       icon: Activity,        label: 'System Health'  },
  { href: '/admin/feature-flags',icon: Flag,            label: 'Feature Flags'  },
  { href: '/admin/announcements',icon: Megaphone,        label: 'Announcements'  },
  { href: '/admin/feedback',     icon: MessageSquare,    label: 'Feedback'       },
  { href: '/admin/audit-log',    icon: ClipboardList,   label: 'Audit Log'      },
  { href: '/admin/auth-alerts',  icon: ShieldAlert,     label: 'Auth Alerts'    },
]

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading, logout } = useAuth()
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Close the mobile drawer whenever the route changes
  useEffect(() => { setMobileNavOpen(false) }, [pathname])

  const handleSignOut = useCallback(async () => {
    // Revoke the HttpOnly session cookie server-side first
    await fetch('/api/admin/session', { method: 'DELETE' }).catch(() => {})
    await logout()
    router.replace('/admin/login')
  }, [logout, router])

  // Inactivity auto-logout
  const resetTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    inactivityTimer.current = setTimeout(handleSignOut, INACTIVITY_MS)
  }, [handleSignOut])

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    }
  }, [resetTimer])

  // Client-side guard — defense in depth (middleware is the primary gate)
  useEffect(() => {
    if (!loading && (!user || user.email !== ADMIN_EMAIL)) {
      router.replace('/admin/login')
    }
  }, [user, loading, router])

  // Login page must NOT be wrapped in the shell (would create a redirect loop)
  if (pathname === '/admin/login') return <>{children}</>

  if (loading || !user || user.email !== ADMIN_EMAIL) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg)',
      }}>
        <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Checking access…</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <style>{ADMIN_SHELL_CSS}</style>

      {/* Mobile drawer backdrop */}
      {mobileNavOpen && (
        <div className="gw-admin-backdrop" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`gw-admin-sidebar${mobileNavOpen ? ' open' : ''}`}
        style={{
          flexShrink: 0,
          background: 'var(--surface)', borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', padding: '18px 12px 16px',
          gap: 8, overflowY: 'auto',
        }}
      >
        {/* Close button — mobile only */}
        <button
          className="gw-admin-drawer-close"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close menu"
        >
          <X size={18} strokeWidth={2} />
        </button>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 8px 12px' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 11, flexShrink: 0,
            background: 'linear-gradient(140deg, var(--bad-2), var(--bad))',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={17} strokeWidth={2.2} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1.15 }}>
              Admin
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-4)', marginTop: 1 }}>
              Growwly Console
            </div>
          </div>
        </div>

        {/* Back to app */}
        <Link
          href="/"
          onClick={() => setMobileNavOpen(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '8px 10px', borderRadius: 10, textDecoration: 'none',
            background: 'var(--surface-2)', color: 'var(--text-3)',
            fontSize: 12.5, fontWeight: 500, marginBottom: 4,
          }}
        >
          <Leaf size={14} strokeWidth={1.8} />
          Back to App
        </Link>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 10px', borderRadius: 10,
                  background: active ? 'var(--bad-soft)' : 'transparent',
                  color: active ? 'var(--bad-ink)' : 'var(--text-2)',
                  fontSize: 13.5, fontWeight: active ? 700 : 500,
                  textDecoration: 'none', transition: 'background .12s, color .12s',
                  position: 'relative',
                }}
                onClick={() => setMobileNavOpen(false)}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                {active && (
                  <span style={{
                    position: 'absolute', left: -12, top: 9, bottom: 9, width: 3,
                    background: 'var(--bad)', borderRadius: '0 4px 4px 0',
                  }} />
                )}
                <Icon
                  size={16}
                  strokeWidth={active ? 2.2 : 1.7}
                  style={{ color: active ? 'var(--bad)' : 'var(--text-3)', flexShrink: 0 }}
                />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User card */}
        <div style={{
          padding: '10px 10px', borderRadius: 12,
          border: '1px solid var(--border)', background: 'var(--surface-2)',
          display: 'flex', alignItems: 'center', gap: 9, marginTop: 8,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(140deg, var(--bad-2), var(--bad))',
            color: '#fff', fontSize: 12, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {user.displayName?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.displayName ?? 'Admin'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-4)' }}>
              Session · 8h max
            </div>
          </div>
          <button
            onClick={handleSignOut}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-3)', padding: 4, borderRadius: 6,
              display: 'flex', alignItems: 'center',
            }}
            title="Sign out"
          >
            <LogOut size={14} strokeWidth={1.8} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="gw-admin-main" style={{ flex: 1, minWidth: 0, overflowY: 'auto', minHeight: '100vh' }}>
        {/* Mobile top bar */}
        <div className="gw-admin-topbar">
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-2)', padding: 6, borderRadius: 8,
              display: 'flex', alignItems: 'center',
            }}
          >
            <Menu size={20} strokeWidth={2} />
          </button>
          <div style={{
            width: 26, height: 26, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(140deg, var(--bad-2), var(--bad))',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={14} strokeWidth={2.2} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>
            Admin
          </span>
        </div>
        {children}
      </main>
    </div>
  )
}

const ADMIN_SHELL_CSS = `
.gw-admin-sidebar {
  width: 232px;
  height: 100vh;
  position: sticky;
  top: 0;
}
.gw-admin-topbar { display: none; }
.gw-admin-backdrop { display: none; }
.gw-admin-drawer-close { display: none; }

@media (max-width: 900px) {
  .gw-admin-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 60;
    transform: translateX(-100%);
    transition: transform 0.22s ease;
    box-shadow: var(--elev-lg);
  }
  .gw-admin-sidebar.open {
    transform: translateX(0);
  }
  .gw-admin-drawer-close {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 12px;
    right: 12px;
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 8px;
    background: var(--surface-2);
    color: var(--text-3);
    cursor: pointer;
  }
  .gw-admin-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 55;
    background: rgba(0, 0, 0, 0.45);
  }
  .gw-admin-topbar {
    display: flex;
    align-items: center;
    gap: 8px;
    position: sticky;
    top: 0;
    z-index: 40;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 9px 12px;
  }
  .gw-admin-main > div:not(.gw-admin-topbar) {
    padding-left: 16px !important;
    padding-right: 16px !important;
    max-width: 100% !important;
  }
  .gw-admin-main table {
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .gw-admin-main table th,
  .gw-admin-main table td {
    white-space: nowrap;
  }
}
`
