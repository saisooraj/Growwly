'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/adminApi'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface FeatureFlag {
  id: string
  key: string
  name: string
  description: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

function FlagModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: FeatureFlag
  onClose: () => void
  onSave: (flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>) => Promise<unknown>
}) {
  const [key, setKey] = useState(initial?.key ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [enabled, setEnabled] = useState(initial?.enabled ?? false)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!key.trim() || !name.trim()) {
      toast.error('Key and Name are required')
      return
    }
    setSaving(true)
    try {
      await onSave({ id: initial?.id ?? '', key: key.trim(), name: name.trim(), description: description.trim(), enabled })
      onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 20, padding: '28px',
        width: '100%', maxWidth: 460, boxShadow: 'var(--elev-lg)',
        border: '1px solid var(--border)',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: '0 0 20px', letterSpacing: '-0.03em' }}>
          {initial ? 'Edit Flag' : 'New Feature Flag'}
        </h2>
        {[
          { label: 'Key', value: key, set: setKey, placeholder: 'e.g. enable_chat_v2', mono: true },
          { label: 'Name', value: name, set: setName, placeholder: 'e.g. Chat V2', mono: false },
          { label: 'Description', value: description, set: setDescription, placeholder: 'Optional description', mono: false },
        ].map(({ label, value, set, placeholder, mono }) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              {label}
            </label>
            <input
              value={value}
              onChange={e => set(e.target.value)}
              placeholder={placeholder}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--surface-2)',
                color: 'var(--text)', fontSize: mono ? 12.5 : 13.5, outline: 'none',
                boxSizing: 'border-box', fontFamily: mono ? 'monospace' : 'inherit',
              }}
            />
          </div>
        ))}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <button
            onClick={() => setEnabled(!enabled)}
            style={{
              width: 42, height: 24, borderRadius: 12, border: 'none',
              background: enabled ? 'var(--good)' : 'var(--surface-3)',
              cursor: 'pointer', position: 'relative', transition: 'background .2s',
              flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', width: 18, height: 18, borderRadius: '50%',
              background: '#fff', top: 3, left: enabled ? 21 : 3,
              transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
            }} />
          </button>
          <span style={{ fontSize: 13.5, color: 'var(--text-2)', fontWeight: 500 }}>
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '9px 20px', borderRadius: 10, border: 'none',
              background: 'var(--bad)', color: '#fff', fontSize: 13.5, fontWeight: 700,
              cursor: 'pointer', opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save Flag'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editFlag, setEditFlag] = useState<FeatureFlag | undefined>()
  const [deleting, setDeleting] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await adminFetch<{ flags: FeatureFlag[] }>('/api/admin/feature-flags')
      setFlags(data.flags)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function toggleFlag(flag: FeatureFlag) {
    try {
      await adminFetch('/api/admin/feature-flags', {
        method: 'POST',
        body: JSON.stringify({ ...flag, enabled: !flag.enabled }),
      })
      setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, enabled: !f.enabled } : f))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  async function saveFlag(data: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>) {
    const result = await adminFetch<{ ok: boolean; id: string }>('/api/admin/feature-flags', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    await load()
    toast.success(data.id ? 'Flag updated' : 'Flag created')
    return result
  }

  async function deleteFlag(id: string) {
    if (!confirm('Delete this flag?')) return
    setDeleting(id)
    try {
      await adminFetch('/api/admin/feature-flags', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      })
      setFlags(prev => prev.filter(f => f.id !== id))
      toast.success('Flag deleted')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div style={{ padding: 28, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em' }}>
            Feature Flags
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 4 }}>
            Toggle features on or off globally
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={load}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text-2)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} strokeWidth={1.8} />
          </button>
          <button
            onClick={() => { setEditFlag(undefined); setShowModal(true) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              borderRadius: 10, border: 'none',
              background: 'var(--bad)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <Plus size={15} strokeWidth={2} />
            New Flag
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--bad-soft)', color: 'var(--bad-ink)', fontSize: 13.5, marginBottom: 20 }}>
          {error}
        </div>
      )}

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
      }}>
        {loading ? (
          <div style={{ padding: '28px', color: 'var(--text-4)', fontSize: 13.5, textAlign: 'center' }}>Loading…</div>
        ) : flags.length === 0 ? (
          <div style={{ padding: '36px', color: 'var(--text-4)', fontSize: 13.5, textAlign: 'center' }}>
            No feature flags yet. Create one to get started.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Status', 'Key', 'Name', 'Description', 'Updated', ''].map(h => (
                  <th key={h} style={{
                    padding: '11px 16px', textAlign: 'left',
                    fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
                    letterSpacing: '.05em', textTransform: 'uppercase',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flags.map((flag, i) => (
                <tr key={flag.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => toggleFlag(flag)}
                      style={{
                        width: 42, height: 24, borderRadius: 12, border: 'none',
                        background: flag.enabled ? 'var(--good)' : 'var(--surface-3)',
                        cursor: 'pointer', position: 'relative', transition: 'background .2s',
                      }}
                    >
                      <span style={{
                        position: 'absolute', width: 18, height: 18, borderRadius: '50%',
                        background: '#fff', top: 3, left: flag.enabled ? 21 : 3,
                        transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                      }} />
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <code style={{
                      fontSize: 12, fontFamily: 'monospace', color: 'var(--bad-ink)',
                      background: 'var(--bad-soft)', padding: '2px 7px', borderRadius: 6,
                    }}>
                      {flag.key}
                    </code>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                    {flag.name}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-3)', maxWidth: 220 }}>
                    {flag.description || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-4)', whiteSpace: 'nowrap' }}>
                    {flag.updatedAt ? new Date(flag.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => { setEditFlag(flag); setShowModal(true) }}
                        style={{
                          padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)',
                          background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteFlag(flag.id)}
                        disabled={deleting === flag.id}
                        style={{
                          padding: '5px 8px', borderRadius: 8, border: '1px solid var(--bad-soft)',
                          background: 'var(--bad-soft)', color: 'var(--bad-ink)', cursor: 'pointer',
                          opacity: deleting === flag.id ? 0.5 : 1, display: 'flex', alignItems: 'center',
                        }}
                      >
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
        <FlagModal
          initial={editFlag}
          onClose={() => setShowModal(false)}
          onSave={saveFlag}
        />
      )}
    </div>
  )
}
