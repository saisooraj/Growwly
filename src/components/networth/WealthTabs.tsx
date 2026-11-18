'use client'

import Link from 'next/link'

/** Sub-tabs inside Wealth: Net worth and the FIRE plan. Full width on phones, 300px from 1024. */
export default function WealthTabs({ active }: { active: 'networth' | 'fire' }) {
  const tab = (key: 'networth' | 'fire', href: string, label: string) => {
    const on = key === active
    return (
      <Link href={href} aria-current={on ? 'page' : undefined}
        style={{
          flex: 1, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          fontSize: 13.5, fontWeight: on ? 700 : 500, textDecoration: 'none', whiteSpace: 'nowrap',
          background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--text)' : 'var(--text-2)', boxShadow: on ? 'var(--elev)' : 'none',
        }}>
        {label}
        {!on && key === 'fire' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--good)' }} />}
      </Link>
    )
  }
  return (
    <nav aria-label="Wealth" className="nw-seg" style={{ display: 'flex', padding: 3, borderRadius: 13, background: 'var(--surface-3)', gap: 2, boxSizing: 'border-box' }}>
      {tab('networth', '/networth', 'Net worth')}
      {tab('fire', '/networth/fire', 'FIRE plan')}
    </nav>
  )
}
