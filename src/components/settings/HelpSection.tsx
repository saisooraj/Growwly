'use client'

import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { submitFeedback } from '@/lib/feedback'
import type { FeedbackType } from '@/types'
import pkg from '../../../package.json'
import { Sym, MONO, card, sub, btnPrimary } from './ui'

export const APP_VERSION = pkg.version

const TYPES: { id: FeedbackType; label: string; icon: string; placeholder: string }[] = [
  { id: 'bug',             label: 'Bug',             icon: 'bug_report',  placeholder: 'What went wrong, and what were you doing when it happened?' },
  { id: 'feature_request', label: 'Feature request', icon: 'lightbulb',   placeholder: "What should Growwly do that it doesn't today?" },
  { id: 'other',           label: 'Other',           icon: 'chat_bubble', placeholder: 'Anything on your mind…' },
]

function FeedbackCard() {
  const { user } = useAuth()
  const [type, setType] = useState<FeedbackType>('bug')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const canSend = !!text.trim() && !sending

  async function send() {
    if (!user || !text.trim()) return
    setSending(true)
    try {
      const idToken = await user.getIdToken()
      await submitFeedback(idToken, { type, message: text.trim(), context: 'settings' })
      setText('')
      setSent(true)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to send feedback')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ ...card, padding: '22px 24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>Send feedback</div>
        <div style={{ ...sub, lineHeight: 1.5 }}>Read by the people who build Growwly — if we act on it, we&apos;ll let you know right here in the app.</div>
      </div>
      <div role="radiogroup" aria-label="Feedback type" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TYPES.map(t => {
          const sel = t.id === type
          return (
            <button
              key={t.id} role="radio" aria-checked={sel} onClick={() => setType(t.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 999, border: `1.5px solid ${sel ? 'var(--acc)' : 'var(--line2)'}`, background: sel ? 'var(--acc-soft)' : 'transparent', color: sel ? 'var(--acc-txt)' : 'var(--ink)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}
            >
              <Sym name={t.icon} size={17} />{t.label}
            </button>
          )
        })}
      </div>
      <textarea
        className="set-field" value={text} rows={4} aria-label="Your feedback"
        onChange={e => { setText(e.target.value); setSent(false) }}
        placeholder={TYPES.find(t => t.id === type)?.placeholder}
        style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 108, padding: '14px 16px', borderRadius: 18, background: 'var(--sf2)', color: 'var(--ink)', fontSize: 14.5, lineHeight: 1.5 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {sent && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', borderRadius: 999, background: 'var(--good-bg)', color: 'var(--good)', fontSize: 13, fontWeight: 500 }}>
            <Sym name="check" size={16} />Thanks — we&apos;ll take a look.
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={send} disabled={!canSend} style={{ ...btnPrimary(canSend, 40), gap: 8 }}><Sym name="send" size={18} />{sending ? 'Sending…' : 'Send Feedback'}</button>
      </div>
    </div>
  )
}

const FEATURES = [
  { icon: 'donut_large', label: 'Smart budgeting' },
  { icon: 'account_balance', label: 'Net worth tracking' },
  { icon: 'health_and_safety', label: 'Emergency fund' },
  { icon: 'calculate', label: 'FI calculator' },
]

function About() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 4px 0', borderTop: '1px dashed var(--line2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, oklch(0.68 0.15 155), oklch(0.46 0.12 165))', color: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 8px 18px -8px oklch(0.5 0.14 160)', flex: 'none' }}>
          <Sym name="eco" size={24} fill />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Growwly</div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 500, letterSpacing: '.14em', color: 'var(--mut)', marginTop: 3 }}>YOUR PERSONAL MONEY OS</div>
        </div>
        <div style={{ flex: '1 1 260px', fontSize: 13.5, lineHeight: 1.5, color: 'var(--mut)', minWidth: 0 }}>Budgets, net worth and an emergency fund in one calm place — built for how India earns and spends.</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {FEATURES.map(f => (
          <span key={f.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', borderRadius: 999, border: '1px solid var(--line)', fontSize: 12.5, fontWeight: 500, color: 'var(--mut)' }}>
            <Sym name={f.icon} size={16} />{f.label}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: MONO, fontSize: 12.5, color: 'var(--mut)' }}>
        <span>Version {APP_VERSION}</span>
        <Link href="/privacy" style={{ color: 'var(--acc-txt)', textDecoration: 'none' }}>Privacy policy</Link>
        <span>Times in IST</span>
      </div>
    </div>
  )
}

export default function HelpSection() {
  return (
    <>
      <FeedbackCard />
      <About />
    </>
  )
}
