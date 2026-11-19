'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, Sun, Moon, Plus, Search, Flame } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { AddEntryMenu } from '@/components/transactions/AddEntryMenu'
import { getLast6Months, getMonthLabel, computeMoneyStreak } from '@/lib/utils'
import { getCycleRange, formatCycleRange } from '@/lib/cycle'
import { usePathname, useRouter } from 'next/navigation'
import { usePrivacy } from '@/store/privacyStore'
import { format, parseISO } from 'date-fns'

// `back` marks a sub-page: the header shows an arrow to its parent page.
const PAGE_META: Record<string, { title: string; sub: string; back?: { href: string; label: string } }> = {
  '/':             { title: 'Overview',      sub: 'Your money at a glance' },
  '/transactions': { title: 'Transactions',  sub: 'Every movement, searchable' },
  '/planning':     { title: 'Planning',      sub: 'The 50 / 30 / 20 split' },
  '/planning/spending': { title: 'Spending Breakdown', sub: 'Where this month’s money went', back: { href: '/planning', label: 'Planning' } },
  '/networth':     { title: 'Net Worth',     sub: 'Assets, cash & liabilities' },
  '/goals':        { title: 'Goals',         sub: 'Savings goals and project budgets' },
  '/borrowings':   { title: 'Borrowings',    sub: 'Who owes whom' },
  '/upcoming':     { title: 'Upcoming',      sub: 'Bills, autopay & scheduled income' },
  '/tasks':        { title: 'Tasks',         sub: 'Money to-dos and reminders' },
  '/health':       { title: 'Money Health',  sub: 'Habits, streaks & momentum' },
  '/market':       { title: 'Market',        sub: 'Stocks, funds, gold & news' },
  '/settings':     { title: 'Settings',      sub: 'Account, mode & appearance' },
}

function BackLink({ href, label, size }: { href: string; label: string; size: number }) {
  return (
    <Link
      href={href}
      aria-label={`Back to ${label}`}
      title={`Back to ${label}`}
      className="pressable"
      style={{
        width: size, height: size, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)',
      }}
    >
      <ArrowLeft size={Math.round(size * 0.47)} strokeWidth={2.2} />
    </Link>
  )
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

// ── Privacy (home): one switch hides every ₹ figure ────────────────────────────

function EyeIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <ellipse cx="12" cy="12" rx="10" ry="6.5" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

function PrivacyButton({ round }: { round?: boolean }) {
  const masked = usePrivacy(s => s.masked)
  const toggle = usePrivacy(s => s.toggle)
  const hydrate = usePrivacy(s => s.hydrate)
  useEffect(() => { hydrate() }, [hydrate])
  const colors = masked ? { background: 'var(--ink)', color: 'var(--bg)' } : { background: 'var(--surface)', color: 'var(--ink)' }
  return (
    <button
      onClick={toggle}
      aria-pressed={masked}
      aria-label={masked ? 'Show amounts' : 'Hide amounts'}
      className={round ? 'ov' : 'ov hidden lg:flex'}
      style={round ? {
        width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer', flex: 'none',
        display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow)', ...colors,
      } : {
        height: 40, padding: '0 14px', alignItems: 'center', gap: 8, borderRadius: 12, border: 'none', cursor: 'pointer',
        boxShadow: 'var(--shadow)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', flexShrink: 0, ...colors,
      }}
    >
      <EyeIcon size={round ? 20 : 18} />
      {!round && (masked ? 'Amounts hidden' : 'Hide amounts')}
    </button>
  )
}

// Phone header on the home screen: who, which cycle, and the privacy eye
function HomePhoneHeader({ firstName, greeting }: { firstName: string; greeting: string }) {
  const { user } = useAuth()
  const { selectedMonth, setSelectedMonth, settings, transactions } = useAppStore()
  const months = getLast6Months()
  const idx = months.indexOf(selectedMonth)
  const { start, end } = getCycleRange(selectedMonth, settings)
  const initial = (user?.displayName || user?.email || '?').trim().charAt(0).toUpperCase()
  const arrow = (dir: -1 | 1) => {
    const ok = dir < 0 ? idx > 0 : idx < months.length - 1
    return (
      <button
        onClick={() => ok && setSelectedMonth(months[idx + dir])} disabled={!ok}
        aria-label={dir < 0 ? 'Previous month' : 'Next month'}
        style={{ border: 'none', background: 'none', padding: '0 2px', font: 'inherit', color: 'inherit', cursor: ok ? 'pointer' : 'default', opacity: ok ? 1 : 0.3 }}
      >{dir < 0 ? '‹' : '›'}</button>
    )
  }
  return (
    <div className="ov" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--brand-soft)', color: 'var(--brand-ink)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 15, flex: 'none' }}>{initial}</div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: 'var(--ink2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {transactions.length === 0 ? `Welcome to Growwly, ${firstName}` : `${greeting} ${firstName}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
          <span>{arrow(-1)} {format(parseISO(`${selectedMonth}-01`), 'MMMM')} {arrow(1)}</span>
          <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--ink3)', letterSpacing: 0 }}>{format(parseISO(start), 'd MMM')} – {format(parseISO(end), 'd MMM')}</span>
        </div>
      </div>
      <PrivacyButton round />
    </div>
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

  function prev() { if (canPrev) setSelectedMonth(months[currentIdx - 1]) }
  function next() { if (canNext) setSelectedMonth(months[currentIdx + 1]) }

  // Transactions draws its own header: the month switcher there also reads "All time" while searching.
  // Net Worth draws its own too: the Wealth title, price refresh and privacy switch.
  // Upcoming draws its own sticky header with tabs, search and the category filter.
  // Settings draws its own: a sticky header on desktop and a large title on phones.
  // Market draws its own: the market status and the privacy switch.
  // Goals draws its own sticky header with the privacy switch, New and the All / Goals / Projects filter.
  if (pathname === '/transactions' || pathname === '/networth' || pathname === '/upcoming' || pathname === '/settings' || pathname === '/market' || pathname === '/goals') return null

  return (
    <header
      className="app-header"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `1px solid ${isHome && !scrolled ? 'transparent' : 'var(--hair)'}`,
        background: scrolled
          ? 'color-mix(in oklch, var(--sidebar) 88%, transparent)'
          : isHome ? 'var(--bg)' : 'var(--sidebar)',
        backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
        position: 'sticky', top: 0, zIndex: 5,
        transition: 'background .25s, backdrop-filter .25s',
      }}
    >
      {/* ── MOBILE title ── */}
      {isHome ? (
        <div className="lg:hidden" style={{ flex: 1, minWidth: 0 }}>
          <HomePhoneHeader firstName={firstName} greeting={greeting} />
        </div>
      ) : (
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {meta.back && <BackLink href={meta.back.href} label={meta.back.label} size={32} />}
              <div style={{ minWidth: 0 }}>
                <h1 style={{ margin: 0, fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {meta.title}
                </h1>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {meta.sub}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{
          opacity: scrolled ? 1 : 0,
          transform: scrolled ? 'translateY(0)' : 'translateY(4px)',
          transition: 'opacity .22s ease, transform .22s ease',
          pointerEvents: scrolled ? 'auto' : 'none',
          position: scrolled ? 'relative' : 'absolute',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {!isHome && meta.back && <BackLink href={meta.back.href} label={meta.back.label} size={28} />}
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {compactLabel}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ── DESKTOP title ── */}
      <div className="hidden lg:block" style={{ minWidth: 0 }}>
        {isHome ? (
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--text)' }}>
            Overview
          </h1>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {meta.back && <BackLink href={meta.back.href} label={meta.back.label} size={36} />}
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, color: 'var(--text)' }}>
                {meta.title}
              </h1>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 500, marginTop: 2 }}>
                {meta.sub}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Spacer pushes controls to the right on desktop */}
      <div className="hidden lg:block" style={{ flex: 1 }} />

      {/* ── Search bar (desktop, hidden on /transactions which has its own) ── */}
      {pathname !== '/transactions' && <SearchBar />}

      <div className={isHome ? 'hidden lg:flex' : 'flex'} style={{ alignItems: 'center', gap: 10, flexShrink: 0 }}>
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
      </div>

      {isHome && <PrivacyButton />}

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
              title="Add transaction (N)"
              aria-keyshortcuts="N"
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
              <span aria-hidden style={{ marginLeft: 2, fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 6, background: 'rgba(255,255,255,.22)' }}>N</span>
            </button>
          }
        />
      )}
    </header>
  )
}
