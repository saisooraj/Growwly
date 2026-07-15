'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/adminApi'
import { RefreshCw, Database, MessageSquare, Bell, Flag, ClipboardList } from 'lucide-react'

interface SystemHealth {
  collections: { name: string; count: number }[]
  ai: { totalChatRequests: number; lastChatAt: string | null }
  admin: { activeFlagCount: number; lastAuditAt: string | null }
  pushSubscriptions: number
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const COLLECTION_LABELS: Record<string, string> = {
  transactions: 'Transactions',
  budgets: 'Budgets',
  projects: 'Projects',
  borrowings: 'Borrowings',
  contacts: 'Contacts',
  emergencyFunds: 'Emergency Funds',
  userSettings: 'User Settings',
  savingsGoals: 'Savings Goals',
  upcoming: 'Upcoming Expenses',
  upcomingPayments: 'Upcoming Payments',
  tasks: 'Tasks',
  assets: 'Assets',
  liabilities: 'Liabilities',
  healthRoutines: 'Health Routines',
  healthLogs: 'Health Logs',
  pushSubscriptions: 'Push Subscriptions',
  userProfiles: 'User Profiles',
  admin_feature_flags: 'Feature Flags',
  admin_audit_log: 'Audit Log',
}

export default function SystemPage() {
  const [data, setData] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const d = await adminFetch<SystemHealth>('/api/admin/system')
      setData(d)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const totalDocs = data?.collections.reduce((s, c) => s + c.count, 0) ?? 0

  return (
    <div style={{ padding: 28, maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em' }}>
            System Health
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 4 }}>
            Firestore collection sizes and service stats
          </p>
        </div>
        <button
          onClick={load}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--surface)', color: 'var(--text-2)', fontSize: 13, fontWeight: 500,
            cursor: 'pointer',
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

      {loading ? (
        <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading system data…</div>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, marginBottom: 28 }}>
            {[
              {
                icon: Database, label: 'Total Documents',
                value: totalDocs.toLocaleString('en-IN'),
                sub: 'across all collections',
                color: 'var(--info)',
              },
              {
                icon: MessageSquare, label: 'AI Chat Requests',
                value: data.ai.totalChatRequests.toLocaleString('en-IN'),
                sub: `Last: ${fmtDate(data.ai.lastChatAt)}`,
                color: 'var(--bad)',
              },
              {
                icon: Bell, label: 'Push Subscriptions',
                value: data.pushSubscriptions.toLocaleString('en-IN'),
                sub: 'active devices',
                color: 'var(--warn)',
              },
              {
                icon: Flag, label: 'Active Feature Flags',
                value: String(data.admin.activeFlagCount),
                sub: 'flags enabled',
                color: 'var(--good)',
              },
              {
                icon: ClipboardList, label: 'Last Admin Action',
                value: data.admin.lastAuditAt ? '✓' : '—',
                sub: fmtDate(data.admin.lastAuditAt),
                color: 'var(--text-3)',
              },
            ].map(({ icon: Icon, label, value, sub, color }) => (
              <div key={label} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 16, padding: '16px 18px', boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9, background: `${color}1a`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
                }}>
                  <Icon size={16} style={{ color }} strokeWidth={1.8} />
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>{value}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2, fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 4 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Collection table */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              Firestore Collections
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['Collection', 'Document Count', 'Share'].map(h => (
                    <th key={h} style={{
                      padding: '10px 18px', textAlign: 'left',
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
                {[...data.collections]
                  .sort((a, b) => b.count - a.count)
                  .map((col, i) => {
                    const pct = totalDocs > 0 ? (col.count / totalDocs) * 100 : 0
                    return (
                      <tr key={col.name} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                        <td style={{ padding: '11px 18px', fontSize: 13.5, color: 'var(--text)', fontWeight: 500 }}>
                          {COLLECTION_LABELS[col.name] ?? col.name}
                          <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 400, marginLeft: 6, fontFamily: 'monospace' }}>
                            {col.name}
                          </span>
                        </td>
                        <td style={{ padding: '11px 18px', fontSize: 13.5, color: 'var(--text-2)', fontWeight: 600 }}>
                          {col.count.toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '11px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              flex: 1, height: 6, borderRadius: 3,
                              background: 'var(--surface-3)', overflow: 'hidden',
                              maxWidth: 180,
                            }}>
                              <div style={{
                                width: `${pct}%`, height: '100%',
                                background: 'var(--info)', borderRadius: 3,
                                transition: 'width .3s',
                              }} />
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--text-3)', width: 36, textAlign: 'right', flexShrink: 0 }}>
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
