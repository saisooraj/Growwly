'use client'

import Link from 'next/link'

/** Sub-tabs inside Wealth: Net worth and the FIRE plan. */
export default function WealthTabs({ active }: { active: 'networth' | 'fire' }) {
  const tab = (key: 'networth' | 'fire', href: string, label: string) => {
    const on = key === active
    return (
      <Link href={href} aria-current={on ? 'page' : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 14px', borderRadius: 8, textDecoration: 'none',
          fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
          background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--text)' : 'var(--text-2)', boxShadow: on ? 'var(--elev)' : 'none',
        }}>
        {label}
        {key === 'fire' && !on && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)' }} />}
      </Link>
    )
  }
  return (
    <nav aria-label="Wealth" style={{ display: 'inline-flex', gap: 4, padding: 4, background: 'var(--surface-2)', borderRadius: 12, alignSelf: 'flex-start' }}>
      {tab('networth', '/networth', 'Net worth')}
      {tab('fire', '/networth/fire', 'FIRE plan')}
    </nav>
  )
}
