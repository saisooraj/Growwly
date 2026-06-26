'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Sun, Moon, Bell } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { getLast6Months, getMonthLabel } from '@/lib/utils'
import { getCycleRange, formatCycleRange } from '@/lib/cycle'
import { usePathname } from 'next/navigation'

const PAGE_META: Record<string, { title: string; sub: string }> = {
  '/':             { title: 'Overview',      sub: 'Your money at a glance' },
  '/transactions': { title: 'Transactions',  sub: 'Every movement, searchable' },
  '/planning':     { title: 'Planning',      sub: 'The 50 / 30 / 20 split' },
  '/networth':     { title: 'Net Worth',     sub: 'Assets, cash & liabilities' },
  '/goals':        { title: 'Savings',       sub: 'Goals and contributions' },
  '/projects':     { title: 'Projects',      sub: 'One-off budgets and milestones' },
  '/borrowings':   { title: 'Borrowings',    sub: 'Who owes whom' },
  '/upcoming':     { title: 'Upcoming',      sub: 'Bills, autopay & scheduled income' },
  '/tasks':        { title: 'Tasks',         sub: 'Money to-dos and reminders' },
  '/health':       { title: 'Money Health',  sub: 'Habits, streaks & momentum' },
  '/market':       { title: 'Market',        sub: 'Stocks, funds, gold & news' },
  '/settings':     { title: 'Settings',      sub: 'Account, mode & appearance' },
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning,'
  if (h < 17) return 'Good afternoon,'
  return 'Good evening,'
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div style={{ width: 36, height: 36 }} />
  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      style={{
        width: 36, height: 36, borderRadius: 11, border: '1px solid var(--border)',
        background: 'var(--surface)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)',
        transition: 'background .15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
      title="Toggle theme"
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  )
}

export default function Header({ title }: { title?: string }) {
  const pathname = usePathname()
  const { user } = useAuth()
  const { selectedMonth, setSelectedMonth, settings } = useAppStore()
  const months = getLast6Months()
  const currentIdx = months.indexOf(selectedMonth)
  const canPrev = currentIdx > 0
  const canNext = currentIdx < months.length - 1
  const meta = PAGE_META[pathname] ?? { title: title ?? 'Overview', sub: '' }
  const isHome = pathname === '/'
  const firstName = user?.displayName?.split(' ')[0] ?? 'there'

  function prev() { if (canPrev) setSelectedMonth(months[currentIdx - 1]) }
  function next() { if (canNext) setSelectedMonth(months[currentIdx + 1]) }

  return (
    <header
      className="app-header"
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        borderBottom: '1px solid var(--hair)',
        background: 'var(--sidebar)',
        position: 'sticky', top: 0, zIndex: 5,
      }}
    >
      {/* Title block */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isHome ? (
          <>
            <div
              className="serif"
              style={{ fontSize: 16, fontStyle: 'italic', color: 'var(--text-3)', lineHeight: 1, marginBottom: 3 }}
            >
              {greeting()}
            </div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: 'var(--text)' }}>
              {firstName}
            </h1>
          </>
        ) : (
          <>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, color: 'var(--text)' }}>
              {meta.title}
            </h1>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 500, marginTop: 2 }}>
              {meta.sub}
            </div>
          </>
        )}
      </div>

      {/* Month switcher */}
      <div style={{
        display: 'flex', alignItems: 'center',
        border: '1px solid var(--border)', borderRadius: 13,
        background: 'var(--surface)', boxShadow: 'var(--elev)',
        overflow: 'hidden',
      }}>
        <button
          onClick={prev}
          disabled={!canPrev}
          style={{
            border: 'none', background: 'transparent', cursor: canPrev ? 'pointer' : 'default',
            padding: '8px 9px', display: 'flex', alignItems: 'center',
            color: 'var(--text-3)', opacity: canPrev ? 1 : 0.3,
          }}
        >
          <ChevronLeft size={15} strokeWidth={2.5} />
        </button>
        <div style={{ padding: '0 8px', minWidth: 84, textAlign: 'center' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, fontFamily: "'Geist Mono', monospace" }}>
            {getMonthLabel(selectedMonth)}
          </div>
          {settings?.salaryCycleRule && settings.salaryCycleRule !== 'none' && (() => {
            const { start, end } = getCycleRange(selectedMonth, settings)
            return (
              <div style={{ fontSize: 10, color: 'var(--text-4)', lineHeight: 1.2, marginTop: 1 }}>
                {formatCycleRange(start, end)}
              </div>
            )
          })()}
        </div>
        <button
          onClick={next}
          disabled={!canNext}
          style={{
            border: 'none', background: 'transparent', cursor: canNext ? 'pointer' : 'default',
            padding: '8px 9px', display: 'flex', alignItems: 'center',
            color: 'var(--text-3)', opacity: canNext ? 1 : 0.3,
          }}
        >
          <ChevronRight size={15} strokeWidth={2.5} />
        </button>
      </div>

      <ThemeToggle />

      <button
        disabled
        style={{
          width: 36, height: 36, borderRadius: 11, border: '1px solid var(--border)',
          background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-4)', opacity: 0.4, cursor: 'not-allowed',
        }}
        title="Notifications coming soon"
      >
        <Bell size={15} />
      </button>
    </header>
  )
}
