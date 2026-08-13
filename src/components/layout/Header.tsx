'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Sun, Moon, Bell, Plus, Search, Flame } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { AddEntryMenu } from '@/components/transactions/AddEntryMenu'
import { getLast6Months, getMonthLabel, computeMoneyStreak } from '@/lib/utils'
import { getCycleRange, formatCycleRange } from '@/lib/cycle'
import { usePathname, useRouter } from 'next/navigation'

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

function getGreeting(): string {
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
        transition: 'background .15s', flexShrink: 0,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
      title="Toggle theme"
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  )
}

// ── Search bar (desktop only) ────────────────────────────────────────────────

function SearchBar() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')

  // ⌘K / Ctrl+K focuses the bar
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    // Navigate to transactions; the page reads ?search= and fills its own search bar
    router.push(q ? `/transactions?search=${encodeURIComponent(q)}` : '/transactions')
    setQuery('')
    inputRef.current?.blur()
  }

  return (
    <form onSubmit={submit} className="hidden lg:flex" style={{ alignItems: 'center', flexShrink: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 12px', borderRadius: 11,
        border: '1px solid var(--border)', background: 'var(--surface)',
        boxShadow: 'var(--elev)',
        transition: 'border-color .15s, box-shadow .15s',
        width: 200,
      }}
        onFocusCapture={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand)'
          ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px color-mix(in oklch, var(--brand) 15%, transparent)'
        }}
        onBlurCapture={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
          ;(e.currentTarget as HTMLElement).style.boxShadow = 'var(--elev)'
        }}
      >
        <Search size={13} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search..."
          style={{
            border: 'none', background: 'transparent', outline: 'none',
            fontSize: 13, color: 'var(--text)', flex: 1, minWidth: 0,
            fontFamily: 'inherit',
          }}
        />
        <kbd style={{
          fontSize: 10, color: 'var(--text-4)', background: 'var(--surface-2)',
          border: '1px solid var(--border)', borderRadius: 5,
          padding: '1px 5px', flexShrink: 0, lineHeight: 1.6,
          fontFamily: "'Geist Mono', monospace",
        }}>
          ⌘K
        </kbd>
      </div>
    </form>
  )
}

// ── Main header ──────────────────────────────────────────────────────────────

export default function Header({ title, scrolled = false, onAdd, onScan }: { title?: string; scrolled?: boolean; onAdd?: () => void; onScan?: () => void }) {
  const pathname = usePathname()
  const { user } = useAuth()
  const { selectedMonth, setSelectedMonth, settings, transactions } = useAppStore()
  const tasks      = useAppStore(s => (s as any).tasks ?? [])
  const borrowings = useAppStore(s => s.borrowings)
  const [addMenuOpen, setAddMenuOpen] = useState(false)

  const moneyStreak = computeMoneyStreak(transactions, settings?.noSpendDays ?? [])

  const months     = getLast6Months()
  const currentIdx = months.indexOf(selectedMonth)
  const canPrev    = currentIdx > 0
  const canNext    = currentIdx < months.length - 1
  const meta       = PAGE_META[pathname] ?? { title: title ?? 'Overview', sub: '' }
  const isHome     = pathname === '/'
  const firstName  = user?.displayName?.split(' ')[0] ?? 'there'
  const greeting   = getGreeting()
  const compactLabel = isHome ? `${greeting} ${firstName}` : meta.title

  // Notification badge: overdue tasks OR pending borrowings
  const overdueCount   = tasks.filter((t: any) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date()).length
  const pendingBorrows = borrowings.filter(b => b.status !== 'repaid').length
  const hasBadge       = overdueCount > 0 || pendingBorrows > 0
  const badgeCount     = overdueCount + pendingBorrows

  function prev() { if (canPrev) setSelectedMonth(months[currentIdx - 1]) }
  function next() { if (canNext) setSelectedMonth(months[currentIdx + 1]) }

  return (
    <header
      className="app-header"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: '1px solid var(--hair)',
        background: scrolled
          ? 'color-mix(in oklch, var(--sidebar) 88%, transparent)'
          : 'var(--sidebar)',
        backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
        position: 'sticky', top: 0, zIndex: 5,
        transition: 'background .25s, backdrop-filter .25s',
      }}
    >
      {/* ── MOBILE title ── */}
      <div className="lg:hidden" style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          transform: scrolled ? 'translateY(-6px)' : 'translateY(0)',
          opacity: scrolled ? 0 : 1,
          transition: 'opacity .22s ease, transform .22s ease',
          pointerEvents: scrolled ? 'none' : 'auto',
          position: scrolled ? 'absolute' : 'relative',
        }}>
          {isHome ? (
            <>
              <div className="serif" style={{ fontSize: 15, fontStyle: 'italic', color: 'var(--text-3)', lineHeight: 1, marginBottom: 2 }}>
                {greeting}
              </div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: 'var(--text)' }}>
                {firstName}
              </h1>
            </>
          ) : (
            <>
              <h1 style={{ margin: 0, fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--text)' }}>
                {meta.title}
              </h1>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, marginTop: 1 }}>
                {meta.sub}
              </div>
            </>
          )}
        </div>

        <div style={{
          opacity: scrolled ? 1 : 0,
          transform: scrolled ? 'translateY(0)' : 'translateY(4px)',
          transition: 'opacity .22s ease, transform .22s ease',
          pointerEvents: scrolled ? 'auto' : 'none',
          position: scrolled ? 'relative' : 'absolute',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {compactLabel}
          </div>
        </div>
      </div>

      {/* ── DESKTOP title ── */}
      <div className="hidden lg:block" style={{ minWidth: 0 }}>
        {isHome ? (
          <>
            <div className="serif" style={{ fontSize: 16, fontStyle: 'italic', color: 'var(--text-3)', lineHeight: 1, marginBottom: 3 }}>
              {greeting}
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

      {/* Spacer pushes controls to the right on desktop */}
      <div className="hidden lg:block" style={{ flex: 1 }} />

      {/* ── Search bar (desktop, hidden on /transactions which has its own) ── */}
      {pathname !== '/transactions' && <SearchBar />}

      {/* ── Month switcher ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        border: '1px solid var(--border)', borderRadius: 13,
        background: 'var(--surface)', boxShadow: 'var(--elev)',
        overflow: 'hidden', flexShrink: 0,
      }}>
        <button onClick={prev} disabled={!canPrev}
          style={{ border: 'none', background: 'transparent', cursor: canPrev ? 'pointer' : 'default', padding: '8px 9px', display: 'flex', alignItems: 'center', color: 'var(--text-3)', opacity: canPrev ? 1 : 0.3 }}>
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
        <button onClick={next} disabled={!canNext}
          style={{ border: 'none', background: 'transparent', cursor: canNext ? 'pointer' : 'default', padding: '8px 9px', display: 'flex', alignItems: 'center', color: 'var(--text-3)', opacity: canNext ? 1 : 0.3 }}>
          <ChevronRight size={15} strokeWidth={2.5} />
        </button>
      </div>

      <ThemeToggle />

      {/* ── Money streak ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '6px 11px', borderRadius: 20, flexShrink: 0,
        background: moneyStreak > 0 ? '#f9731622' : 'var(--surface-2)',
        color:      moneyStreak > 0 ? '#f97316'   : 'var(--text-4)',
        fontWeight: 700, fontSize: 13.5,
      }}>
        <Flame size={14} />
        {moneyStreak}
      </div>

      {/* ── Bell with notification badge ── */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          style={{
            width: 36, height: 36, borderRadius: 11, border: '1px solid var(--border)',
            background: hasBadge ? 'var(--bad-soft)' : 'var(--surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: hasBadge ? 'var(--bad-ink)' : 'var(--text-3)',
            cursor: 'default', flexShrink: 0,
            transition: 'background .2s, color .2s',
          }}
          title={hasBadge ? `${badgeCount} item${badgeCount !== 1 ? 's' : ''} need attention` : 'Notifications'}
        >
          <Bell size={15} />
        </button>
        {hasBadge && (
          <span style={{
            position: 'absolute', top: -3, right: -3,
            width: 16, height: 16, borderRadius: '50%',
            background: 'var(--bad)',
            border: '2px solid var(--sidebar)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 800, color: '#fff',
          }}>
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </div>

      {/* ── + Add button (desktop) ── */}
      {onAdd && (
        <AddEntryMenu
          open={addMenuOpen}
          onClose={() => setAddMenuOpen(false)}
          onManual={onAdd}
          onScan={onScan ?? onAdd}
          anchor={
            <button
              onClick={() => (onScan ? setAddMenuOpen(o => !o) : onAdd())}
              className="hidden lg:flex items-center gap-2"
              style={{
                padding: '9px 16px', borderRadius: 13, border: 'none',
                background: 'linear-gradient(150deg, var(--brand-2), var(--brand))',
                color: '#fff', cursor: 'pointer',
                fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.01em',
                boxShadow: '0 4px 14px -4px var(--brand)',
                transition: 'transform .12s ease, box-shadow .12s ease',
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 8px 20px -6px var(--brand)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 14px -4px var(--brand)' }}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1.04)')}
            >
              <Plus size={16} strokeWidth={2.8} />
              Add
            </button>
          }
        />
      )}
    </header>
  )
}
