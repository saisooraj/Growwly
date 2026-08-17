'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/adminApi'
import { ANNOUNCEMENT_ICONS } from '@/lib/announcements'
import { Plus, Trash2, RefreshCw, ChevronUp, ChevronDown, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type {
  Announcement, AnnouncementStep, AnnouncementType, AnnouncementStatus,
  AnnouncementAudience, AnnouncementPlatformTarget, AnnouncementTrigger,
} from '@/types'

const ICON_KEYS = Object.keys(ANNOUNCEMENT_ICONS)
const EMPTY_STEP: AnnouncementStep = { iconKey: 'sparkles', title: '', body: '' }

interface AnnouncementCounts { impression: number; click: number; complete: number; dismiss: number }
const ZERO_COUNTS: AnnouncementCounts = { impression: 0, click: 0, complete: 0, dismiss: 0 }

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 10,
  border: '1px solid var(--border)', background: 'var(--surface-2)',
  color: 'var(--text)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
}

function AnnouncementFormModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: Announcement
  onClose: () => void
  onSave: (data: Partial<Announcement> & { id?: string }) => Promise<unknown>
}) {
  const [type, setType] = useState<AnnouncementType>(initial?.type ?? 'feature_spotlight')
  const [status, setStatus] = useState<AnnouncementStatus>(initial?.status ?? 'draft')
  const [priority, setPriority] = useState(initial?.priority ?? 0)
  const [platformMode, setPlatformMode] = useState<'all' | 'desktop' | 'mobile'>(
    !initial?.platforms?.length ? 'all' : (initial.platforms[0] as 'desktop' | 'mobile')
  )
  const [audience, setAudience] = useState<AnnouncementAudience>(initial?.audience ?? 'all')
  const [trigger, setTrigger] = useState<AnnouncementTrigger>(initial?.triggerPoint ?? 'app_load')
  const [oncePerPlatform, setOncePerPlatform] = useState(initial?.oncePerPlatform ?? false)
  const [startAt, setStartAt] = useState(initial?.startAt?.slice(0, 10) ?? '')
  const [endAt, setEndAt] = useState(initial?.endAt?.slice(0, 10) ?? '')

  // Spotlight content
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [iconKey, setIconKey] = useState(initial?.iconKey ?? 'sparkles')
  const [ctaLabel, setCtaLabel] = useState(initial?.ctaLabel ?? '')
  const [ctaHref, setCtaHref] = useState(initial?.ctaHref ?? '')

  // Tour content
  const [steps, setSteps] = useState<AnnouncementStep[]>(initial?.steps?.length ? initial.steps : [{ ...EMPTY_STEP }])

  const [saving, setSaving] = useState(false)

  function updateStep(i: number, patch: Partial<AnnouncementStep>) {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  }
  function moveStep(i: number, dir: -1 | 1) {
    setSteps(prev => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  async function handleSave() {
    if (type === 'onboarding_tour') {
      if (steps.some(s => !s.title.trim() || !s.body.trim())) {
        toast.error('Every step needs a title and body')
        return
      }
    } else if (!title.trim() || !body.trim()) {
      toast.error('Title and body are required')
      return
    }

    setSaving(true)
    try {
      const platforms: AnnouncementPlatformTarget[] = platformMode === 'all' ? [] : [platformMode]
      const effectiveTrigger: AnnouncementTrigger = type === 'onboarding_tour' ? 'app_load' : trigger
      await onSave({
        id: initial?.id,
        type,
        status,
        priority,
        platforms,
        audience,
        oncePerPlatform,
        triggerPoint: effectiveTrigger,
        featureKey: effectiveTrigger === 'salary_logged' ? 'salary_cycle' : undefined,
        startAt: startAt ? new Date(startAt).toISOString() : undefined,
        endAt: endAt ? new Date(endAt).toISOString() : undefined,
        ...(type === 'onboarding_tour'
          ? { steps: steps.map(s => ({ ...s, title: s.title.trim(), body: s.body.trim() })) }
          : { title: title.trim(), body: body.trim(), iconKey, ctaLabel: ctaLabel.trim() || undefined, ctaHref: ctaHref.trim() || undefined }),
      })
      onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 20, padding: 28,
        width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto',
        boxShadow: 'var(--elev-lg)', border: '1px solid var(--border)',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: '0 0 20px', letterSpacing: '-0.03em' }}>
          {initial ? 'Edit Announcement' : 'New Announcement'}
        </h2>

        {/* Type + status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Type</label>
            <select value={type} onChange={e => setType(e.target.value as AnnouncementType)} disabled={!!initial} style={inputStyle}>
              <option value="feature_spotlight">Feature spotlight (single card)</option>
              <option value="onboarding_tour">Onboarding tour (multi-step)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as AnnouncementStatus)} style={inputStyle}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Targeting */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Platforms</label>
            <select value={platformMode} onChange={e => setPlatformMode(e.target.value as typeof platformMode)} style={inputStyle}>
              <option value="all">All platforms</option>
              <option value="desktop">Desktop only</option>
              <option value="mobile">Mobile only</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Audience</label>
            <select value={audience} onChange={e => setAudience(e.target.value as AnnouncementAudience)} style={inputStyle}>
              <option value="all">All users</option>
              <option value="new_users">New users (joined &lt; 7 days ago)</option>
            </select>
          </div>
        </div>

        {type === 'feature_spotlight' && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Trigger</label>
            <select value={trigger} onChange={e => setTrigger(e.target.value as AnnouncementTrigger)} style={inputStyle}>
              <option value="app_load">On app load (like a regular spotlight)</option>
              <option value="salary_logged">Right after logging a Salary transaction, if no salary cycle is set</option>
            </select>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Priority</label>
            <input type="number" value={priority} onChange={e => setPriority(Number(e.target.value))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Starts (optional)</label>
            <input type="date" value={startAt} onChange={e => setStartAt(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Ends (optional)</label>
            <input type="date" value={endAt} onChange={e => setEndAt(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <button
            onClick={() => setOncePerPlatform(!oncePerPlatform)}
            style={{
              width: 42, height: 24, borderRadius: 12, border: 'none',
              background: oncePerPlatform ? 'var(--good)' : 'var(--surface-3)',
              cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0,
            }}
          >
            <span style={{ position: 'absolute', width: 18, height: 18, borderRadius: '50%', background: '#fff', top: 3, left: oncePerPlatform ? 21 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
          </button>
          <span style={{ fontSize: 13.5, color: 'var(--text-2)', fontWeight: 500 }}>
            Show once per platform (e.g. once on mobile <em>and</em> once on desktop) instead of once ever
          </span>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0 20px' }} />

        {/* Content */}
        {type === 'feature_spotlight' ? (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Did you know about salary cycles?" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Body</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="What the feature does and why it's useful" style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 8 }}>
              <div>
                <label style={labelStyle}>Icon</label>
                <select value={iconKey} onChange={e => setIconKey(e.target.value)} style={inputStyle}>
                  {ICON_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>CTA label (optional)</label>
                <input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} placeholder="e.g. Open Settings" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>CTA link (optional)</label>
                <input value={ctaHref} onChange={e => setCtaHref(e.target.value)} placeholder="/settings" style={inputStyle} />
              </div>
            </div>
          </>
        ) : (
          <div>
            <label style={labelStyle}>Steps</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {steps.map((step, i) => (
                <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--surface-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)' }}>Step {i + 1}</span>
                    <div style={{ flex: 1 }} />
                    <button onClick={() => moveStep(i, -1)} disabled={i === 0} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', opacity: i === 0 ? 0.3 : 1 }}><ChevronUp size={14} /></button>
                    <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', opacity: i === steps.length - 1 ? 0.3 : 1 }}><ChevronDown size={14} /></button>
                    <button onClick={() => setSteps(prev => prev.filter((_, idx) => idx !== i))} disabled={steps.length === 1} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bad-ink)', opacity: steps.length === 1 ? 0.3 : 1 }}><X size={14} /></button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8, marginBottom: 8 }}>
                    <select value={step.iconKey} onChange={e => updateStep(i, { iconKey: e.target.value })} style={inputStyle}>
                      {ICON_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <input value={step.title} onChange={e => updateStep(i, { title: e.target.value })} placeholder="Step title" style={inputStyle} />
                  </div>
                  <textarea value={step.body} onChange={e => updateStep(i, { body: e.target.value })} rows={2} placeholder="Step body" style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
              ))}
            </div>
            <button
              onClick={() => setSteps(prev => [...prev, { ...EMPTY_STEP }])}
              style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            >
              <Plus size={13} /> Add step
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: 'var(--bad)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [analytics, setAnalytics] = useState<Record<string, AnnouncementCounts>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Announcement | undefined>()
  const [deleting, setDeleting] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [listData, analyticsData] = await Promise.all([
        adminFetch<{ announcements: Announcement[] }>('/api/admin/announcements'),
        adminFetch<{ analytics: Record<string, AnnouncementCounts> }>('/api/admin/announcements/analytics'),
      ])
      setItems(listData.announcements)
      setAnalytics(analyticsData.analytics)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function saveItem(data: Partial<Announcement> & { id?: string }) {
    const result = await adminFetch<{ ok: boolean; id: string }>('/api/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    await load()
    toast.success(data.id ? 'Announcement updated' : 'Announcement created')
    return result
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this announcement?')) return
    setDeleting(id)
    try {
      await adminFetch('/api/admin/announcements', { method: 'DELETE', body: JSON.stringify({ id }) })
      setItems(prev => prev.filter(a => a.id !== id))
      toast.success('Announcement deleted')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setDeleting(null)
    }
  }

  const statusColor: Record<AnnouncementStatus, string> = {
    active: 'var(--good)', draft: 'var(--text-4)', archived: 'var(--bad-ink)',
  }

  return (
    <div style={{ padding: 28, maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em' }}>
            Announcements
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 4 }}>
            Onboarding tours and feature spotlights shown inside the app
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            <RefreshCw size={14} strokeWidth={1.8} />
          </button>
          <button onClick={() => { setEditItem(undefined); setShowModal(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: 'var(--bad)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={15} strokeWidth={2} /> New Announcement
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--bad-soft)', color: 'var(--bad-ink)', fontSize: 13.5, marginBottom: 20 }}>
          {error}
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        {loading ? (
          <div style={{ padding: 28, color: 'var(--text-4)', fontSize: 13.5, textAlign: 'center' }}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 36, color: 'var(--text-4)', fontSize: 13.5, textAlign: 'center' }}>
            No announcements yet. The built-in "Get Started" tour is showing to new users until you create one.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Status', 'Type', 'Title', 'Targeting', 'Priority', 'Shown / Acted / Dismissed', ''].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.05em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((a, i) => (
                <tr key={a.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: statusColor[a.status], textTransform: 'capitalize' }}>{a.status}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <code style={{ fontSize: 11.5, fontFamily: 'monospace', color: 'var(--bad-ink)', background: 'var(--bad-soft)', padding: '2px 7px', borderRadius: 6 }}>
                      {a.type === 'onboarding_tour' ? 'tour' : 'spotlight'}
                    </code>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13.5, fontWeight: 600, color: 'var(--text)', maxWidth: 240 }}>
                    {a.type === 'onboarding_tour' ? (a.steps?.[0]?.title ?? '—') + ` (${a.steps?.length ?? 0} steps)` : (a.title || '—')}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)' }}>
                    {a.platforms.length ? a.platforms.join(', ') : 'all platforms'} · {a.audience === 'new_users' ? 'new users' : 'all users'}
                    {a.triggerPoint === 'salary_logged' && <> · after salary logged</>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-3)' }}>{a.priority}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--text-2)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {(() => {
                      const c = analytics[a.id] ?? ZERO_COUNTS
                      const acted = c.click + c.complete
                      const ctr = c.impression ? Math.round((acted / c.impression) * 100) : null
                      return (
                        <>
                          {c.impression} shown{ctr !== null ? ` (${ctr}% acted)` : ''} · {c.dismiss} dismissed
                        </>
                      )
                    })()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setEditItem(a); setShowModal(true) }} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                        Edit
                      </button>
                      <button onClick={() => deleteItem(a.id)} disabled={deleting === a.id} style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid var(--bad-soft)', background: 'var(--bad-soft)', color: 'var(--bad-ink)', cursor: 'pointer', opacity: deleting === a.id ? 0.5 : 1, display: 'flex', alignItems: 'center' }}>
                        <Trash2 size={12} strokeWidth={1.8} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <AnnouncementFormModal initial={editItem} onClose={() => setShowModal(false)} onSave={saveItem} />
      )}
    </div>
  )
}
