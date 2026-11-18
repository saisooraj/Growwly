'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import AppShell from '@/components/layout/AppShell'
import { useAuth } from '@/context/AuthContext'
import { useAppStore } from '@/store/appStore'
import { usePrivacy } from '@/store/privacyStore'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { computeLongestMoneyStreak } from '@/lib/utils'
import { Sym, MONO, SERIF, SectionHead, useIsDesktop, inr, LOCAL_AI } from '@/components/settings/ui'
import ProfileSection, { IdentityRow, displayName } from '@/components/settings/ProfileSection'
import MoneySection from '@/components/settings/MoneySection'
import NotificationsSection, { REMINDER_TIMES } from '@/components/settings/NotificationsSection'
import AppearanceSection, { ACCENTS } from '@/components/settings/AppearanceSection'
import ShortcutsSection from '@/components/settings/ShortcutsSection'
import AchievementsSection from '@/components/settings/AchievementsSection'
import DataSection from '@/components/settings/DataSection'
import HelpSection, { APP_VERSION } from '@/components/settings/HelpSection'

type SectionKey = 'profile' | 'money' | 'notif' | 'appear' | 'short' | 'ach' | 'data' | 'help'

// Desktop heading description, and the phone sub-page description where it differs
const SECTIONS: { key: SectionKey; label: string; icon: string; desc: string; phoneDesc?: string }[] = [
  { key: 'profile', label: 'Profile & account',        icon: 'person',                 desc: 'Who you are and how you sign in' },
  { key: 'money',   label: 'Money setup',              icon: 'account_balance_wallet', desc: 'What Growwly believes about your money', phoneDesc: 'Mode, targets, salary cycle and vehicles' },
  { key: 'notif',   label: 'Notifications',            icon: 'notifications',          desc: 'A daily nudge, nothing more' },
  { key: 'appear',  label: 'Appearance & layout',      icon: 'palette',                desc: 'Make Growwly look and read your way', phoneDesc: 'Theme, accent, tabs and your Overview' },
  { key: 'short',   label: 'Shortcuts & integrations', icon: 'bolt',                   desc: 'Log faster, from anywhere' },
  { key: 'ach',     label: 'Achievements',             icon: 'military_tech',          desc: 'Streak badges for logging every day' },
  { key: 'data',    label: 'Data & privacy',           icon: 'shield_lock',            desc: 'Your data, your copy' },
  { key: 'help',    label: 'Help & about',             icon: 'help',                   desc: 'Tell us what to fix next' },
]
const SECTION = Object.fromEntries(SECTIONS.map(s => [s.key, s])) as Record<SectionKey, (typeof SECTIONS)[number]>
const isSection = (k: string | null): k is SectionKey => !!k && k in SECTION

// What the settings search matches: label, section, extra keywords
const INDEX: [string, SectionKey, string][] = [
  ['Sign-in methods', 'profile', 'google email password link'],
  ['Sign out', 'profile', 'logout'],
  ['Financial mode', 'money', 'normal high expense'],
  ['Budget targets', 'money', 'income weekly emergency fund'],
  ['Salary cycle', 'money', 'payday working day'],
  ['Vehicles', 'money', 'fuel mileage bike car'],
  ['Daily reminders', 'notif', 'push notification time'],
  ['Theme', 'appear', 'dark light system'],
  ['Accent colour', 'appear', 'color forest violet ember rose ocean mono'],
  ['Navigation tabs', 'appear', 'health tasks'],
  ['Overview layout', 'appear', 'dashboard order blocks reorder hide'],
  ['iPhone Quick Add', 'short', 'shortcut back tap token ios'],
  ...(LOCAL_AI ? [['AI hub', 'short', 'claude chatbot'] as [string, SectionKey, string]] : []),
  ['Streak badges', 'ach', 'streak achievements'],
  ['Export backup', 'data', 'json download'],
  ['Restore from backup', 'data', 'import json'],
  ['Delete account', 'data', 'remove leave close'],
  ['Send feedback', 'help', 'bug feature'],
  ['About Growwly', 'help', 'version privacy'],
]

function search(q: string) {
  const ql = q.trim().toLowerCase()
  if (!ql) return []
  return INDEX.filter(([l, s, kw]) => `${l} ${kw} ${SECTION[s].label}`.toLowerCase().includes(ql)).map(([l, s]) => ({ label: l, key: s }))
}

const NO_MATCH = 'No settings match. Try “salary” or “backup”.'

// ⌘K belongs to the AI command bar when it's on (laptop dev only); "/" always works
const CMD_K = !LOCAL_AI

export default function SettingsPage() {
  const desktop = useIsDesktop()
  const push = usePushNotifications()

  const body = (key: SectionKey, compact: boolean): ReactNode => {
    switch (key) {
      case 'profile': return <ProfileSection />
      case 'money':   return <MoneySection />
      case 'notif':   return <NotificationsSection push={push} />
      case 'appear':  return <AppearanceSection compact={compact} />
      case 'short':   return <ShortcutsSection />
      case 'ach':     return <AchievementsSection />
      case 'data':    return <DataSection />
      case 'help':    return <HelpSection />
    }
  }

  return (
    <AppShell title="Settings">
      <div className="set set-page anim-page">
        {desktop ? <Desktop body={body} /> : <Phone body={body} pushOn={push.state === 'subscribed'} />}
      </div>
    </AppShell>
  )
}

// ── Desktop: sticky header, section nav + search, every section on one page ──

const HEAD_OFFSET = 110 // the nav's sticky top, clear of the header

function Desktop({ body }: { body: (k: SectionKey, compact: boolean) => ReactNode }) {
  const { user } = useAuth()
  const params = useSearchParams()
  const { resolvedTheme, setTheme } = useTheme()
  const masked = usePrivacy(s => s.masked)
  const togglePrivacy = usePrivacy(s => s.toggle)
  const hydratePrivacy = usePrivacy(s => s.hydrate)
  const [active, setActive] = useState<SectionKey>('profile')
  const [q, setQ] = useState('')
  const [mounted, setMounted] = useState(false)
  const refs = useRef<Partial<Record<SectionKey, HTMLElement | null>>>({})
  const lockUntil = useRef(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const results = useMemo(() => search(q), [q])

  useEffect(() => { setMounted(true); hydratePrivacy() }, [hydratePrivacy])

  const go = useCallback((k: SectionKey, smooth = true) => {
    const el = refs.current[k]
    if (!el) return
    setActive(k)
    lockUntil.current = Date.now() + 700
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - HEAD_OFFSET + 8, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  // Arriving with ?s=money (from a phone sub-page or a link) lands on that section
  useEffect(() => {
    const s = params.get('s')
    if (isSection(s)) requestAnimationFrame(() => go(s, false))
  }, [params, go])

  // Highlight the section being read: the last one whose top has passed under the header
  useEffect(() => {
    function onScroll() {
      if (Date.now() < lockUntil.current) return
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      if (atEnd) { setActive('help'); return }
      let cur: SectionKey = 'profile'
      for (const s of SECTIONS) {
        const el = refs.current[s.key]
        if (el && el.getBoundingClientRect().top <= HEAD_OFFSET + 40) cur = s.key
      }
      setActive(cur)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable
      if ((CMD_K && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pick = (k: SectionKey) => { setQ(''); searchRef.current?.blur(); go(k) }
  const name = displayName(user)
  const iconBtn = { width: 40, height: 40, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--sf)', color: 'var(--ink)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' } as const

  return (
    <>
      <header style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 12, padding: '18px 48px', background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.02em' }}>Settings</h1>
          <div style={{ fontSize: 13, color: 'var(--mut)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Synced to your account · {user?.email}</div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={togglePrivacy} aria-pressed={masked} aria-label={masked ? 'Show ₹ figures' : 'Hide ₹ figures'} title={masked ? 'Show ₹ figures' : 'Hide ₹ figures'} className="set-hover" style={iconBtn}>
          <Sym name={masked ? 'visibility_off' : 'visibility'} />
        </button>
        <button onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme" title="Toggle theme" className="set-hover" style={iconBtn}>
          {mounted && <Sym name={resolvedTheme === 'dark' ? 'light_mode' : 'dark_mode'} />}
        </button>
        <div aria-hidden style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: 'var(--acc)', color: 'var(--on-acc)', display: 'grid', placeItems: 'center', fontFamily: SERIF, fontSize: 22, flex: 'none' }}>
          {user?.photoURL
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={user.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : name[0]?.toUpperCase()}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '232px minmax(0, 1fr)', gap: 48, padding: '32px 48px 96px', alignItems: 'start' }}>
        <nav aria-label="Settings sections" style={{ position: 'sticky', top: HEAD_OFFSET, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 12px', borderRadius: 12, background: 'var(--sf)', border: '1px solid var(--line2)', cursor: 'text' }}>
            <Sym name="search" size={19} style={{ color: 'var(--mut)' }} />
            <input
              ref={searchRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search settings" aria-label="Search settings"
              onKeyDown={e => { if (e.key === 'Enter' && results[0]) pick(results[0].key); if (e.key === 'Escape') { setQ(''); e.currentTarget.blur() } }}
              style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--ink)', fontSize: 14 }}
            />
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 500, color: 'var(--mut)', padding: '2px 6px', border: '1px solid var(--line2)', borderRadius: 6 }}>{CMD_K ? '⌘K' : '/'}</span>
          </label>

          {!q.trim() ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {SECTIONS.map(s => {
                const a = s.key === active
                return (
                  <button
                    key={s.key} onClick={() => go(s.key)} aria-current={a ? 'true' : undefined} className={a ? undefined : 'set-hover'}
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, height: 38, padding: '0 12px', border: 0, borderRadius: 11, background: a ? 'var(--acc-soft)' : 'transparent', color: a ? 'var(--acc-txt)' : 'var(--mut)', fontSize: 14, fontWeight: a ? 600 : 500, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 3, background: 'var(--acc)', opacity: a ? 1 : 0, transition: 'opacity .15s' }} />
                    <Sym name={s.icon} size={19} fill={a} />{s.label}
                  </button>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 6, borderRadius: 18, background: 'var(--sf)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
              {results.map(r => (
                <button key={r.label} onClick={() => pick(r.key)} className="set-hover" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '9px 10px', border: 0, borderRadius: 10, background: 'transparent', color: 'var(--ink)', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{r.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--mut)' }}>{SECTION[r.key].label}</span>
                </button>
              ))}
              {results.length === 0 && <div style={{ padding: 10, fontSize: 13, color: 'var(--mut)' }}>{NO_MATCH}</div>}
            </div>
          )}
        </nav>

        <div style={{ minWidth: 0, maxWidth: 840, display: 'flex', flexDirection: 'column', gap: 56 }}>
          {SECTIONS.map(s => (
            <section key={s.key} ref={el => { refs.current[s.key] = el }} data-sec={s.key} aria-label={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <SectionHead title={s.label} desc={s.desc} />
              {body(s.key, false)}
            </section>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Phone: a grouped list that opens each section as its own page ────────────

function Phone({ body, pushOn }: { body: (k: SectionKey, compact: boolean) => ReactNode; pushOn: boolean }) {
  const router = useRouter()
  const params = useSearchParams()
  const s = params.get('s')
  const sub = isSection(s) ? s : null
  // Opened from the list → Back pops history; arrived on a sub-page directly → Back replaces
  const pushed = useRef(false)

  const open = (k: SectionKey) => { pushed.current = true; router.push(`/settings?s=${k}`) }
  const back = () => {
    if (pushed.current) { pushed.current = false; router.back() }
    else router.replace('/settings')
  }

  useEffect(() => { window.scrollTo(0, 0) }, [sub])

  if (sub) {
    const meta = SECTION[sub]
    return (
      <div style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', height: 44, padding: '0 8px' }}>
          <button onClick={back} style={{ display: 'flex', alignItems: 'center', border: 0, background: 'transparent', padding: 0, color: 'var(--acc-txt)', fontSize: 16, fontWeight: 500, cursor: 'pointer' }}>
            <Sym name="chevron_left" size={28} />Settings
          </button>
        </div>
        <div style={{ padding: '2px 20px 16px' }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.025em' }}>{meta.label}</h1>
          <div style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--mut)', marginTop: 4 }}>{meta.phoneDesc ?? meta.desc}</div>
        </div>
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {body(sub, true)}
        </div>
      </div>
    )
  }

  return <PhoneRoot open={open} pushOn={pushOn} />
}

function PhoneRoot({ open, pushOn }: { open: (k: SectionKey) => void; pushOn: boolean }) {
  const { logout } = useAuth()
  const settings = useAppStore(s => s.settings)
  const transactions = useAppStore(s => s.transactions)
  const [q, setQ] = useState('')
  const results = useMemo(() => search(q), [q])

  const best = computeLongestMoneyStreak(transactions, settings?.noSpendDays ?? [])
  const mode = settings?.financialMode === 'high-expense' ? 'High Expense' : 'Normal'
  const income = settings?.monthlyIncomeTarget
  const reminder = REMINDER_TIMES.find(t => t.hour === (settings?.pushReminderHour ?? 19))?.time
  const accent = ACCENTS.find(a => a.id === (settings?.accentColor ?? 'green'))?.name ?? 'Forest'

  const main: [SectionKey, string][] = [
    ['money', income ? `${mode} · ${inr(income)}` : mode],
    ['notif', pushOn ? reminder ?? 'On' : 'Off'],
    ['appear', accent],
    ['short', settings?.iosShortcut ? 'Quick Add on' : 'Off'],
    ['ach', `Best ${best} day${best === 1 ? '' : 's'}`],
  ]
  const more: [SectionKey, string][] = [['data', 'Backup'], ['help', 'Feedback']]

  const row = (icon: string, label: string, value: string, accentTile: boolean, first: boolean, trail = 'chevron_right') => (
    <>
      <div style={{
        width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', flex: 'none',
        ...(accentTile ? { background: 'var(--acc-soft)', color: 'var(--acc-txt)' } : { background: 'var(--sf2)', border: '1px solid var(--line)' }),
      }}>
        <Sym name={icon} size={19} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, height: 56, paddingRight: 12, borderTop: first ? 0 : '1px solid var(--line)' }}>
        <span style={{ flex: 1, fontSize: 15.5, fontWeight: 500, color: 'var(--ink)' }}>{label}</span>
        <span style={{ fontSize: 14, color: 'var(--mut)', whiteSpace: 'nowrap' }}>{value}</span>
        <Sym name={trail} size={20} style={{ color: 'var(--mut)' }} />
      </div>
    </>
  )
  const rowBtn = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', paddingLeft: 14, border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left', textDecoration: 'none' } as const
  const group = { background: 'var(--sf)', border: '1px solid var(--line)', borderRadius: 24, overflow: 'hidden' } as const

  return (
    <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.025em', padding: '0 4px' }}>Settings</h1>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 12px', borderRadius: 12, background: 'color-mix(in oklch, var(--ink) 6%, transparent)', color: 'var(--mut)' }}>
        <Sym name="search" size={19} />
        <input
          value={q} onChange={e => setQ(e.target.value)} placeholder="Search settings" aria-label="Search settings" enterKeyHint="search"
          style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--ink)', fontSize: 16 }}
        />
        {q && (
          <button onClick={() => setQ('')} aria-label="Clear search" style={{ border: 0, background: 'transparent', color: 'var(--mut)', display: 'grid', placeItems: 'center', padding: 0 }}>
            <Sym name="close" size={18} />
          </button>
        )}
      </label>

      {q.trim() ? (
        <div style={group}>
          {results.map((r, i) => (
            <button key={r.label} onClick={() => open(r.key)} style={rowBtn}>
              {row(SECTION[r.key].icon, r.label, SECTION[r.key].label, true, i === 0)}
            </button>
          ))}
          {results.length === 0 && <div style={{ padding: 16, fontSize: 14, color: 'var(--mut)' }}>{NO_MATCH}</div>}
        </div>
      ) : (
        <>
          <IdentityRow onOpen={() => open('profile')} />
          <div style={group}>
            {main.map(([k, v], i) => (
              <button key={k} onClick={() => open(k)} style={rowBtn}>{row(SECTION[k].icon, SECTION[k].label, v, true, i === 0)}</button>
            ))}
          </div>
          <div style={group}>
            {more.map(([k, v], i) => (
              <button key={k} onClick={() => open(k)} style={rowBtn}>{row(SECTION[k].icon, SECTION[k].label, v, false, i === 0)}</button>
            ))}
            {LOCAL_AI && <Link href="/ai" style={rowBtn}>{row('auto_awesome', 'AI hub', '', false, false, 'arrow_outward')}</Link>}
          </div>
          <button onClick={logout} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 18, background: 'var(--sf)', border: '1px solid var(--line)', color: 'var(--bad)', fontSize: 15.5, fontWeight: 500, cursor: 'pointer' }}>
            <Sym name="logout" size={19} />Sign out
          </button>
          <div style={{ textAlign: 'center', fontFamily: MONO, fontSize: 12, color: 'var(--mut)' }}>
            Growwly {APP_VERSION} · <Link href="/privacy" style={{ color: 'var(--mut)' }}>Privacy policy</Link>
          </div>
        </>
      )}
    </div>
  )
}
