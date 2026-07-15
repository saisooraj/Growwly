'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/adminApi'
import { RefreshCw, ClipboardList } from 'lucide-react'

interface AuditEntry {
  id: string
  action: string
  targetUid?: string | null
  details?: string | null
  performedAt: string
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  user_disabled:        { label: 'User Disabled',       color: 'var(--bad)'  },
  user_enabled:         { label: 'User Enabled',        color: 'var(--good)' },
  feature_flag_created: { label: 'Flag Created',        color: 'var(--info)' },
  feature_flag_updated: { label: 'Flag Updated',        color: 'var(--warn)' },
  feature_flag_deleted: { label: 'Flag Deleted',        color: 'var(--bad)'  },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await adminFetch<{ entries: AuditEntry[] }>('/api/admin/audit-log?limit=200')
      setEntries(data.entries)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const actionTypes = ['all', ...Array.from(new Set(entries.map(e => e.action)))]

  const filtered = filter === 'all' ? entries : entries.filter(e => e.action === filter)

  return (
    <div style={{ padding: 28, maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em' }}>
            Audit Log
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 4 }}>
            All admin actions — most recent first
          </p>
        </div>
        <button
          onClick={load}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--surface)', color: 'var(--text-2)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} strokeWidth={1.8} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--bad-soft)', color: 'var(--bad-ink)', fontSize: 13.5, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Filter pills */}
      {!loading && entries.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {actionTypes.map(type => {
            const meta = ACTION_LABELS[type]
            const active = filter === type
            return (
              <button
                key={type}
                onClick={() => setFilter(type)}
                style={{
                  padding: '5px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: active ? 700 : 500,
                  border: active ? 'none' : '1px solid var(--border)',
                  background: active ? (meta?.color ?? 'var(--bad)') : 'var(--surface)',
                  color: active ? '#fff' : 'var(--text-3)',
                  cursor: 'pointer',
                }}
              >
                {type === 'all' ? 'All' : (meta?.label ?? type)}
              </button>
            )
          })}
        </div>
      )}

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
      }}>
        {loading ? (
          <div style={{ padding: '28px', color: 'var(--text-4)', fontSize: 13.5, textAlign: 'center' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <ClipboardList size={32} style={{ color: 'var(--text-4)', marginBottom: 12 }} strokeWidth={1.5} />
            <div style={{ color: 'var(--text-4)', fontSize: 13.5 }}>No audit log entries yet</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Timestamp', 'Action', 'Details', 'Target UID'].map(h => (
                  <th key={h} style={{
                    padding: '11px 18px', textAlign: 'left',
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
              {filtered.map((entry, i) => {
                const meta = ACTION_LABELS[entry.action]
                return (
                  <tr key={entry.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                    <td style={{ padding: '11px 18px', fontSize: 12.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                      {fmtDate(entry.performedAt)}
                    </td>
                    <td style={{ padding: '11px 18px' }}>
                      <span style={{
                        fontSize: 12, fontWeight: 700, padding: '2px 9px', borderRadius: 999,
                        background: `${meta?.color ?? 'var(--text-3)'}22`,
                        color: meta?.color ?? 'var(--text-3)',
                        border: `1px solid ${meta?.color ?? 'var(--border)'}44`,
                        whiteSpace: 'nowrap',
                      }}>
                        {meta?.label ?? entry.action}
                      </span>
                    </td>
                    <td style={{ padding: '11px 18px', fontSize: 13, color: 'var(--text-2)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.details ?? '—'}
                    </td>
                    <td style={{ padding: '11px 18px', fontSize: 11.5, color: 'var(--text-4)', fontFamily: 'monospace' }}>
                      {entry.targetUid ? entry.targetUid.slice(0, 16) + '…' : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
