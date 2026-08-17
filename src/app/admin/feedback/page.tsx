'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/adminApi'
import { Bug, Lightbulb, MessageCircle, RefreshCw, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Feedback, FeedbackStatus, FeedbackType } from '@/types'

const TYPE_META: Record<FeedbackType, { label: string; icon: typeof Bug; color: string; bg: string }> = {
  bug: { label: 'Bug', icon: Bug, color: 'var(--bad-ink)', bg: 'var(--bad-soft)' },
  feature_request: { label: 'Feature request', icon: Lightbulb, color: 'var(--info-ink)', bg: 'var(--info-soft)' },
  other: { label: 'Other', icon: MessageCircle, color: 'var(--text-3)', bg: 'var(--surface-2)' },
}

const STATUS_META: Record<FeedbackStatus, { label: string; color: string; bg: string }> = {
  new: { label: 'New', color: 'var(--info-ink)', bg: 'var(--info-soft)' },
  in_progress: { label: 'In progress', color: 'var(--warn-ink)', bg: 'var(--warn-soft)' },
  resolved: { label: 'Resolved', color: 'var(--good-ink)', bg: 'var(--good-soft)' },
  wont_fix: { label: "Won't fix", color: 'var(--text-4)', bg: 'var(--surface-2)' },
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 10,
  border: '1px solid var(--border)', background: 'var(--surface-2)',
  color: 'var(--text)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function NotifyUserModal({
  item, onClose, onSent,
}: {
  item: Feedback
  onClose: () => void
  onSent: () => void
}) {
  const [title, setTitle] = useState('We fixed what you reported')
  const [body, setBody] = useState('')
  const [ctaLabel, setCtaLabel] = useState('')
  const [ctaHref, setCtaHref] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      toast.error('Title and message are required')
      return
    }
    setSending(true)
    try {
      await adminFetch('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({
          type: 'feature_spotlight',
          status: 'active',
          priority: 5,
          platforms: [],
          audience: 'all',
          oncePerPlatform: false,
          triggerPoint: 'app_load',
          targetUserId: item.userId,
          title: title.trim(),
          body: body.trim(),
          iconKey: 'sparkles',
          ctaLabel: ctaLabel.trim() || undefined,
          ctaHref: ctaHref.trim() || undefined,
        }),
      })
      await adminFetch('/api/admin/feedback', {
        method: 'POST',
        body: JSON.stringify({ id: item.id, status: 'resolved' }),
      })
      toast.success('Notification queued for this user')
      onSent()
      onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 460, boxShadow: 'var(--elev-lg)', border: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: '0 0 6px', letterSpacing: '-0.03em' }}>
          Notify {item.userName || item.userEmail || 'user'}
        </h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '0 0 18px' }}>
          Shows once, only to this user, next time they open the app. Marks this feedback as resolved.
        </p>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Message</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Explain what changed" style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>CTA label (optional)</label>
            <input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} placeholder="e.g. Check it out" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>CTA link (optional)</label>
            <input value={ctaHref} onChange={e => setCtaHref(e.target.value)} placeholder="/settings" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSend} disabled={sending} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 10, border: 'none', background: 'var(--bad)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', opacity: sending ? 0.6 : 1 }}>
            <Send size={13} /> {sending ? 'Sending…' : 'Send & mark resolved'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FeedbackPage() {
  const [items, setItems] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FeedbackStatus | 'all'>('all')
  const [notifyItem, setNotifyItem] = useState<Feedback | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await adminFetch<{ feedback: Feedback[] }>('/api/admin/feedback')
      setItems(data.feedback)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function updateStatus(item: Feedback, status: FeedbackStatus) {
    setItems(prev => prev.map(f => f.id === item.id ? { ...f, status } : f))
    try {
      await adminFetch('/api/admin/feedback', { method: 'POST', body: JSON.stringify({ id: item.id, status }) })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status')
      load()
    }
  }

  const visible = filter === 'all' ? items : items.filter(f => f.status === filter)

  return (
    <div style={{ padding: 28, maxWidth: 860, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em' }}>Feedback</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 4 }}>Bug reports, feature requests & general feedback from users</p>
        </div>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          <RefreshCw size={14} strokeWidth={1.8} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {(['all', 'new', 'in_progress', 'resolved', 'wont_fix'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 12px', borderRadius: 999, border: '1px solid var(--border)',
              background: filter === f ? 'var(--bad)' : 'var(--surface)',
              color: filter === f ? '#fff' : 'var(--text-2)',
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {f === 'all' ? 'All' : STATUS_META[f].label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--bad-soft)', color: 'var(--bad-ink)', fontSize: 13.5, marginBottom: 20 }}>{error}</div>
      )}

      {loading ? (
        <div style={{ padding: 28, color: 'var(--text-4)', fontSize: 13.5, textAlign: 'center' }}>Loading…</div>
      ) : visible.length === 0 ? (
        <div style={{ padding: 36, color: 'var(--text-4)', fontSize: 13.5, textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
          No feedback here yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.map(item => {
            const typeMeta = TYPE_META[item.type]
            const statusMeta = STATUS_META[item.status]
            const TypeIcon = typeMeta.icon
            return (
              <div key={item.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: typeMeta.color, background: typeMeta.bg, padding: '3px 9px', borderRadius: 999 }}>
                      <TypeIcon size={11} /> {typeMeta.label}
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: statusMeta.color, background: statusMeta.bg, padding: '3px 9px', borderRadius: 999 }}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-4)', whiteSpace: 'nowrap' }}>{fmtDate(item.createdAt)}</span>
                </div>

                <p style={{ fontSize: 13.5, color: 'var(--text)', margin: '0 0 10px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.message}</p>

                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
                  {item.userName || 'Unknown'} · {item.userEmail ?? '—'}
                  {item.context && <> · from {item.context}</>}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={item.status}
                    onChange={e => updateStatus(item, e.target.value as FeedbackStatus)}
                    style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 12.5 }}
                  >
                    {(['new', 'in_progress', 'resolved', 'wont_fix'] as const).map(s => (
                      <option key={s} value={s}>{STATUS_META[s].label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setNotifyItem(item)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--bad-soft)', color: 'var(--bad-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                  >
                    <Send size={12} /> Notify user
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {notifyItem && (
        <NotifyUserModal item={notifyItem} onClose={() => setNotifyItem(null)} onSent={load} />
      )}
    </div>
  )
}
