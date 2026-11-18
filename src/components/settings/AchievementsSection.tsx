'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useAppStore } from '@/store/appStore'
import { computeLongestMoneyStreak } from '@/lib/utils'
import { BADGES, getBadgeEarnedDate, type BadgeDef } from '@/lib/badges'
import { Sym, MONO, SERIF, card, Modal } from './ui'

const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`

function BadgeDialog({ badge, best, onClose }: { badge: BadgeDef | null; best: number; onClose: () => void }) {
  const transactions = useAppStore(s => s.transactions)
  const settings = useAppStore(s => s.settings)
  if (!badge) return null
  const { name, Icon, iconColor, description, quote, threshold } = badge
  const earned = best >= threshold
  const left = threshold - best
  const earnedDate = earned ? getBadgeEarnedDate(transactions.map(t => t.date), settings?.noSpendDays ?? [], threshold) : null

  return (
    <Modal open onClose={onClose} label={name} width={400}>
      <div style={{
        width: 96, height: 96, borderRadius: '50%', display: 'grid', placeItems: 'center', marginTop: -14, flex: 'none',
        ...(earned
          ? { background: `color-mix(in oklch, ${iconColor} 18%, transparent)`, border: `2px solid color-mix(in oklch, ${iconColor} 35%, transparent)`, color: iconColor }
          : { border: '2px dashed var(--line2)', color: 'var(--mut)' }),
      }}>
        {earned ? <Icon size={44} /> : <Sym name="lock" size={46} />}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: SERIF, fontSize: 32, lineHeight: 1.1 }}>{name}</div>
        <div style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 500, color: 'var(--mut)', marginTop: 6 }}>{threshold}-day streak badge</div>
      </div>
      <div style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--mut)', textAlign: 'center', maxWidth: 300 }}>{description}</div>
      <div style={{ width: '100%', padding: '14px 16px', borderRadius: 18, background: 'var(--sf2)', border: '1px solid var(--line)', boxSizing: 'border-box' }}>
        {earned ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sym name="check_circle" size={22} fill style={{ color: 'var(--good)' }} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--good)' }}>Badge earned</div>
              {earnedDate && <div style={{ fontSize: 12.5, color: 'var(--mut)', marginTop: 2 }}>Achieved on {format(parseISO(earnedDate), 'd MMM yyyy')}</div>}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500 }}>
              <span>Your best</span><span style={{ fontFamily: MONO }}>{best} / {threshold} days</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--line)', marginTop: 10, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (best / threshold) * 100)}%`, height: '100%', borderRadius: 4, background: 'var(--acc)', transition: 'width .4s ease' }} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--acc-txt)', marginTop: 8 }}>{days(left)} more to unlock</div>
          </>
        )}
      </div>
      <div style={{ alignSelf: 'stretch', borderLeft: '3px solid var(--acc)', padding: '2px 0 2px 14px', fontFamily: SERIF, fontStyle: 'italic', fontSize: 19, lineHeight: 1.35, color: 'var(--ink)' }}>{quote}</div>
    </Modal>
  )
}

export default function AchievementsSection() {
  const transactions = useAppStore(s => s.transactions)
  const settings = useAppStore(s => s.settings)
  const best = computeLongestMoneyStreak(transactions, settings?.noSpendDays ?? [])
  const next = BADGES.find(b => b.threshold > best)
  const [open, setOpen] = useState<BadgeDef | null>(null)

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px 28px', flexWrap: 'wrap', padding: '22px 24px 20px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: SERIF, fontSize: 56, lineHeight: 0.9, letterSpacing: '-0.02em' }}>{best}</span>
          <span style={{ fontSize: 13.5, lineHeight: 1.3, color: 'var(--mut)' }}>Longest streak:<br />{days(best)}</span>
        </div>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          {next ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5 }}>
                <span>Next up · <b style={{ fontWeight: 600 }}>{next.name}</b></span>
                <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 500, color: 'var(--mut)' }}>{best} / {next.threshold} days</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--sf2)', border: '1px solid var(--line)', marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (best / next.threshold) * 100)}%`, height: '100%', borderRadius: 4, background: 'var(--acc)' }} />
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--mut)', marginTop: 6 }}>{days(next.threshold - best)} more to unlock</div>
            </>
          ) : (
            <div style={{ fontSize: 13.5, color: 'var(--mut)' }}>Every badge earned. Keep the streak going.</div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(136px, 1fr))', gap: 10, padding: '18px 24px 24px' }}>
        {BADGES.map(b => {
          const e = best >= b.threshold
          const col = b.iconColor
          return (
            <button
              key={b.name} onClick={() => setOpen(b)} className="set-press"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 18, cursor: 'pointer', textAlign: 'left', color: 'inherit',
                border: e ? `1.5px solid color-mix(in oklch, ${col} 35%, transparent)` : '1.5px dashed var(--line2)',
                background: e ? `color-mix(in oklch, ${col} 9%, transparent)` : 'transparent', transition: 'transform .14s',
              }}
            >
              <span style={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', opacity: e ? 1 : 0.6, background: e ? `color-mix(in oklch, ${col} 18%, transparent)` : 'var(--sf2)', color: e ? col : 'var(--mut)' }}>
                <b.Icon size={19} />
              </span>
              <span style={{ opacity: e ? 1 : 0.6 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 500, lineHeight: 1.25 }}>{b.name}</span>
                <span style={{ display: 'block', fontFamily: MONO, fontSize: 11.5, fontWeight: 500, marginTop: 4, color: e ? col : 'var(--mut)' }}>
                  {e ? '✓ Earned' : `${days(b.threshold - best)} to go`}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <BadgeDialog badge={open} best={best} onClose={() => setOpen(null)} />
    </div>
  )
}
