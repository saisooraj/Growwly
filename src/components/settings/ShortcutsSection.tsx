'use client'

import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { useAuth } from '@/context/AuthContext'
import { useAppStore } from '@/store/appStore'
import { useRefreshData } from '@/hooks/useData'
import { EXPENSE_CATEGORIES } from '@/lib/utils'
import { buildQuickAddShortcut } from '@/lib/iosShortcutPlist'
import { Sym, MONO, card, rowTitle, sub, btnOutline, btnPrimary, btnBad, LOCAL_AI } from './ui'

const STEPS = [
  <>On your iPhone, open <b>Settings → Shortcuts</b> and turn on <b>Allow Untrusted Shortcuts</b> (run any shortcut once if the toggle is missing).</>,
  <>Tap <b>Download shortcut</b> right after generating a token, then open the file. It imports into Shortcuts with your token already in it.</>,
  <>Open <b>Settings → Accessibility → Touch → Back Tap</b>, pick <b>Double Tap</b> (or <b>Triple Tap</b>) and choose <b>Growwly Quick Add</b>.</>,
  <>Tap the back of your phone to test. From the lock screen, iOS asks for Face ID once before the prompts appear.</>,
]

function QuickAddCard() {
  const { user } = useAuth()
  const settings = useAppStore(s => s.settings)
  const refresh = useRefreshData()
  const [token, setToken] = useState<string | null>(null) // plaintext, shown once right after generating
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [steps, setSteps] = useState(false)
  const hasToken = !!settings?.iosShortcut

  async function generate(rotate = false) {
    if (!user) return
    setBusy(true)
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/ios-shortcut/token', { method: 'POST', headers: { Authorization: `Bearer ${idToken}` } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setToken(data.token as string)
      setCopied(false)
      await refresh()
      if (rotate) toast.success('New token generated — old one revoked')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate token')
    } finally {
      setBusy(false)
    }
  }

  async function revoke() {
    if (!user) return
    setBusy(true)
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/ios-shortcut/token', { method: 'DELETE', headers: { Authorization: `Bearer ${idToken}` } })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Failed')
      }
      setToken(null)
      await refresh()
      toast.success('Shortcut access revoked')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to revoke')
    } finally {
      setBusy(false)
    }
  }

  function download() {
    if (!token) return
    const categories = Array.from(new Set([...EXPENSE_CATEGORIES, ...(settings?.customCategories ?? [])]))
    const xml = buildQuickAddShortcut({ origin: window.location.origin, token, categories })
    const url = URL.createObjectURL(new Blob([xml], { type: 'application/octet-stream' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'Growwly Quick Add.shortcut'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function copy() {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Copy failed — select and copy manually')
    }
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '22px 24px 16px' }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--acc-soft)', color: 'var(--acc-txt)', display: 'grid', placeItems: 'center', flex: 'none' }}><Sym name="phone_iphone" size={24} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>iPhone Quick Add</div>
          <div style={{ ...sub, lineHeight: 1.5 }}>Tap the back of your iPhone to log an expense in three taps — even from the lock screen.</div>
        </div>
      </div>

      {!hasToken && !token && (
        <div style={{ margin: '0 24px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '16px 18px', borderRadius: 18, border: '1px dashed var(--line2)' }}>
          <div style={{ flex: '1 1 220px', fontSize: 13.5, lineHeight: 1.5, color: 'var(--mut)' }}>Create a private token so the Shortcut can add expenses to your account. You&apos;ll see it once.</div>
          <button onClick={() => generate(false)} disabled={busy} style={{ ...btnPrimary(!busy, 40), gap: 8 }}><Sym name="key" size={18} />{busy ? 'Working…' : 'Generate access token'}</button>
        </div>
      )}

      {token && (
        <div style={{ margin: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 18px', borderRadius: 18, background: 'var(--warn-bg)', border: '1px solid color-mix(in oklch, var(--warn) 30%, transparent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--warn)', fontSize: 13.5, fontWeight: 600 }}><Sym name="visibility" size={18} />Copy this token now — it won&apos;t be shown again.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 14px', borderRadius: 12, background: 'var(--sf)', border: '1px solid var(--line2)' }}>
            <code style={{ flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 14, fontWeight: 500, letterSpacing: '.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'all' }}>{token}</code>
            <button onClick={copy} style={{ ...btnOutline(34, 10, 13), background: 'var(--sf2)' }}><Sym name={copied ? 'check' : 'content_copy'} size={16} />{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={download} style={{ ...btnPrimary(), padding: '0 14px', gap: 8 }}><Sym name="download" size={18} />Download shortcut</button>
            <button onClick={() => setToken(null)} style={btnOutline(38, 12, 14)}>I&apos;ve saved it</button>
          </div>
        </div>
      )}

      {hasToken && !token && (
        <div style={{ margin: '0 24px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '14px 18px', borderRadius: 18, background: 'var(--sf2)', border: '1px solid var(--line)' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--good)', boxShadow: '0 0 0 4px var(--good-bg)', flex: 'none' }} />
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 500 }}>Active — created {settings?.iosShortcut?.createdAt ? format(parseISO(settings.iosShortcut.createdAt), 'd MMM yyyy') : '—'}</div>
            <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--mut)', marginTop: 2 }}>Your token is stored as a hash, so it can&apos;t be shown again.</div>
          </div>
          <button onClick={() => generate(true)} disabled={busy} style={{ ...btnOutline(36), opacity: busy ? 0.6 : 1 }}>{busy ? 'Working…' : 'Generate new token'}</button>
          <button onClick={revoke} disabled={busy} style={{ ...btnBad(36, 10, 13.5), padding: '0 12px', opacity: busy ? 0.6 : 1 }}>Revoke</button>
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--line)' }}>
        <button
          onClick={() => setSteps(s => !s)} aria-expanded={steps}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '14px 24px', border: 0, background: 'transparent', color: 'var(--ink)', fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'left' }}
        >
          <Sym name="checklist" size={19} style={{ color: 'var(--mut)' }} />
          <span style={{ flex: 1 }}>Set-up steps</span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--mut)' }}>4 steps · 2 min</span>
          <Sym name={steps ? 'expand_less' : 'expand_more'} size={20} style={{ color: 'var(--mut)' }} />
        </button>
        {steps && (
          <div style={{ padding: '0 24px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, fontSize: 13.5, lineHeight: 1.5 }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--acc-soft)', color: 'var(--acc-txt)', display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 12, fontWeight: 600, flex: 'none' }}>{i + 1}</span>
                <span>{s}</span>
              </div>
            ))}
            <div style={{ marginTop: 4, padding: '12px 14px', borderRadius: 12, background: 'var(--sf2)', border: '1px solid var(--line)', fontFamily: MONO, fontSize: 12.5, lineHeight: 1.6, color: 'var(--mut)' }}>
              <span style={{ color: 'var(--ink)' }}>For developers</span> · POST <span style={{ color: 'var(--ink)' }}>{'{ token, amount, description, category }'}</span> to /api/ios-shortcut/transaction
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Link to the AI hub; it only exists on the owner's laptop (`next dev` with the local AI on) */
export function AiHubLink() {
  if (!LOCAL_AI) return null
  return (
    <Link href="/ai" className="set-press" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 24px', borderRadius: 24, background: 'var(--sf)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)', textDecoration: 'none', color: 'var(--ink)' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--sf2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', flex: 'none' }}><Sym name="auto_awesome" size={21} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={rowTitle}>AI chat &amp; Log from Claude</div>
        <div style={sub}>Assistant settings and the Claude connector live in AI hub.</div>
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13.5, fontWeight: 500, color: 'var(--acc-txt)', whiteSpace: 'nowrap' }}>Open AI hub<Sym name="arrow_outward" size={17} /></span>
    </Link>
  )
}

export default function ShortcutsSection() {
  return (
    <>
      <QuickAddCard />
      <AiHubLink />
    </>
  )
}
