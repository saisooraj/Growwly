'use client'

import Link from 'next/link'
import { useAppStore } from '@/store/appStore'
import { GoalIcon } from '@/lib/categoryIcons'
import { Ring, useIsDesk } from './ui'

const COLORS = ['var(--brand)', 'var(--info)', 'var(--warn)', 'var(--wants)']

export default function GoalsCard() {
  const goals = useAppStore(s => s.savingsGoals)
  const desk = useIsDesk()
  // Nearest deadline first; goals without one go last
  const list = [...goals].sort((a, b) => (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999'))

  return (
    <div className="ov-card" style={{ gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div className="ov-title">Goals</div>
        <div style={{ fontSize: 12, color: 'var(--ink2)', marginRight: 'auto' }}>{list.length} active</div>
        <Link href="/goals" className="ov-link">See all →</Link>
      </div>
      {/* A rail inside the card on a phone (the page never scrolls sideways), a wrapping grid on desktop */}
      <div className="ov-rail" style={{ display: 'flex', gap: 12, overflowX: 'auto', flexWrap: desk ? 'wrap' : 'nowrap', margin: '0 -4px', padding: '0 4px', overscrollBehaviorX: 'contain' }}>
        {list.map((g, i) => {
          const p = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0
          return (
            <Link key={g.id} href="/goals" style={{ width: 84, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center', color: 'inherit', textDecoration: 'none' }}>
              <Ring size={64} r={27} stroke={6} pct={p} color={p >= 100 ? 'var(--good)' : COLORS[i % 4]} track="var(--surface2)">
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                  <GoalIcon emoji={g.emoji} size={24} color="var(--ink2)" stroke={1.6} />
                </div>
              </Ring>
              <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{g.name}</div>
              <div className="ov-mono" style={{ fontSize: 11.5, color: 'var(--ink2)' }}>{p}%</div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
