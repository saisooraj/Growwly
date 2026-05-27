'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Sun, Moon, Bell, Leaf, Settings } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAppStore } from '@/store/appStore'
import { getLast6Months, getMonthLabel } from '@/lib/utils'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const PAGE_META: Record<string, { title: string; sub: string }> = {
  '/':             { title: 'Overview',      sub: 'Your money at a glance' },
  '/transactions': { title: 'Transactions',  sub: 'Every movement, searchable and filtered' },
  '/planning':     { title: 'Planning',      sub: 'Set the plan and watch it land' },
  '/goals':        { title: 'Savings goals', sub: 'Targets and contributions' },
  '/projects':     { title: 'Projects',      sub: 'Construction, events, one-off budgets' },
  '/borrowings':   { title: 'Borrowings',    sub: 'Lent and borrowed, who and when' },
  '/market':       { title: 'Market',        sub: 'Stocks, funds, gold and news' },
  '/settings':     { title: 'Settings',      sub: 'Account, mode, budgets and backups' },
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div style={{ width: 34, height: 34 }} />

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="btn btn-sm"
      style={{ padding: 8, borderRadius: 10 }}
      title="Toggle theme"
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  )
}

export default function Header({ title }: { title?: string }) {
  const pathname = usePathname()
  const { selectedMonth, setSelectedMonth } = useAppStore()
  const months = getLast6Months()
  const currentIdx = months.indexOf(selectedMonth)
  const canPrev = currentIdx > 0
  const canNext = currentIdx < months.length - 1
  const meta = PAGE_META[pathname] ?? { title: title ?? 'Overview', sub: '' }

  const now = new Date()
  const [yr, mon] = selectedMonth.split('-').map(Number)
  const isCurrentMonth = yr === now.getFullYear() && mon - 1 === now.getMonth()
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const monthName = monthNames[mon - 1] ?? ''

  function prev() { if (canPrev) setSelectedMonth(months[currentIdx - 1]) }
  function next() { if (canNext) setSelectedMonth(months[currentIdx + 1]) }

  return (
    <header
      className="app-header"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        position: 'sticky', top: 0, zIndex: 5,
      }}
    >
      {/* Mobile logo */}
      <Link href="/" className="flex items-center lg:hidden" style={{ gap: 8, textDecoration: 'none' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-deep) 100%)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Leaf size={13} strokeWidth={2} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
          Growwly
        </span>
      </Link>

      {/* Desktop title block */}
      <div style={{ flex: 1, minWidth: 0 }} className="hidden lg:block">
        <div
          className="serif"
          style={{ fontSize: 15, fontStyle: 'italic', color: 'var(--text-3)', fontWeight: 400, lineHeight: 1, marginBottom: 4 }}
        >
          {isCurrentMonth ? 'this month' : `in ${monthName}`}
        </div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 500, letterSpacing: '-0.015em', lineHeight: 1.15, color: 'var(--text)' }}>
          {meta.title}
        </h1>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>{meta.sub}</div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Month picker */}
        <div style={{
          display: 'flex', alignItems: 'center',
          border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)',
        }}>
          <button
            onClick={prev}
            disabled={!canPrev}
            className="btn-ghost"
            style={{ border: 0, padding: '7px 8px', borderRadius: 10, opacity: canPrev ? 1 : 0.3 }}
          >
            <ChevronLeft size={15} />
          </button>
          <span
            className="num"
            style={{ padding: '0 8px', fontSize: 12, fontWeight: 500, minWidth: 72, textAlign: 'center', color: 'var(--text)' }}
          >
            {getMonthLabel(selectedMonth)}
          </span>
          <button
            onClick={next}
            disabled={!canNext}
            className="btn-ghost"
            style={{ border: 0, padding: '7px 8px', borderRadius: 10, opacity: canNext ? 1 : 0.3 }}
          >
            <ChevronRight size={15} />
          </button>
        </div>

        <ThemeToggle />

        {/* Bell with notification dot */}
        <button
          className="btn btn-sm"
          style={{ padding: 8, borderRadius: 10, position: 'relative' }}
        >
          <Bell size={15} />
          <span style={{
            position: 'absolute', top: 5, right: 5,
            width: 6, height: 6, borderRadius: 999,
            background: 'var(--bad)',
            boxShadow: '0 0 0 2px var(--surface)',
          }} />
        </button>

        {/* Settings — visible on mobile only (desktop uses sidebar) */}
        <Link
          href="/settings"
          className="btn btn-sm lg:hidden"
          style={{ padding: 8, borderRadius: 10, textDecoration: 'none', color: pathname === '/settings' ? 'var(--brand)' : 'inherit' }}
          title="Settings"
        >
          <Settings size={15} />
        </Link>
      </div>
    </header>
  )
}
