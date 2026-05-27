'use client'

import { useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Handshake, Target } from 'lucide-react'
import AddTransactionModal from '@/components/transactions/AddTransactionModal'
import Link from 'next/link'

const ACTIONS = [
  { id: 'exp',  label: 'Expense', icon: ArrowDownRight, color: 'var(--bad-ink)',   bg: 'var(--bad-soft)',   type: 'modal' },
  { id: 'inc',  label: 'Income',  icon: ArrowUpRight,   color: 'var(--good-ink)',  bg: 'var(--good-soft)',  type: 'modal' },
  { id: 'lent', label: 'I lent',  icon: Handshake,      color: 'var(--info-ink)',  bg: 'var(--info-soft)',  type: 'href', href: '/borrowings' },
  { id: 'sav',  label: 'Save',    icon: Target,         color: 'var(--brand-ink)', bg: 'var(--brand-soft)', type: 'href', href: '/goals' },
] as const

export default function QuickActions() {
  const [addOpen, setAddOpen] = useState(false)

  return (
    <>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="h-eyebrow">Quick add</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {ACTIONS.map(it => {
            const Icon = it.icon
            const inner = (
              <>
                <span style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: it.bg, color: it.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={16} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                  {it.label}
                </span>
              </>
            )

            if (it.type === 'href') {
              return (
                <Link
                  key={it.id}
                  href={it.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', border: '1px solid var(--border)',
                    borderRadius: 10, background: 'var(--surface)', textDecoration: 'none',
                    transition: 'all .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
                >
                  {inner}
                </Link>
              )
            }

            return (
              <button
                key={it.id}
                onClick={() => setAddOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', border: '1px solid var(--border)',
                  borderRadius: 10, background: 'var(--surface)', cursor: 'pointer',
                  textAlign: 'left', transition: 'all .15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
              >
                {inner}
              </button>
            )
          })}
        </div>
      </div>

      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
