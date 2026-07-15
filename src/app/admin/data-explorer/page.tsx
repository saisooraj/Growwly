'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { adminFetch } from '@/lib/adminApi'
import { Search, ChevronRight } from 'lucide-react'

const USER_COLLECTIONS = [
  { key: 'transactions',    label: 'Transactions'    },
  { key: 'budgets',         label: 'Budgets'         },
  { key: 'savingsGoals',    label: 'Savings Goals'   },
  { key: 'borrowings',      label: 'Borrowings'      },
  { key: 'projects',        label: 'Projects'        },
  { key: 'tasks',           label: 'Tasks'           },
  { key: 'contacts',        label: 'Contacts'        },
  { key: 'upcoming',        label: 'Upcoming Expenses'},
  { key: 'assets',          label: 'Assets'          },
  { key: 'liabilities',     label: 'Liabilities'     },
  { key: 'healthRoutines',  label: 'Health Routines' },
]

interface CollectionSummary { name: string; count: number }

interface UserSummary {
  uid: string
  profile: Record<string, unknown> | null
  collections: CollectionSummary[]
  emergencyFund: Record<string, unknown> | null
  settings: Record<string, unknown> | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function JsonTable({ data }: { data: Record<string, any>[] }) {
  if (data.length === 0) {
    return <div style={{ padding: '16px', color: 'var(--text-4)', fontSize: 13.5, textAlign: 'center' }}>No records</div>
  }
  const cols = Object.keys(data[0]).filter(k => k !== 'userId')
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: 'var(--surface-2)' }}>
            {cols.map(c => (
              <th key={c} style={{
                padding: '8px 12px', textAlign: 'left', fontWeight: 700,
                color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase',
                letterSpacing: '.05em', whiteSpace: 'nowrap',
                borderBottom: '1px solid var(--border)',
              }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
              {cols.map(c => {
                const val = row[c]
                const str = val == null ? '—' : typeof val === 'object' ? JSON.stringify(val) : String(val)
                return (
                  <td key={c} style={{
                    padding: '8px 12px', color: 'var(--text-2)',
                    maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }} title={str}>
                    {str}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DataExplorerPage() {
  const searchParams = useSearchParams()
  const preUid = searchParams.get('uid') ?? ''

  const [uidInput, setUidInput] = useState(preUid)
  const [summary, setSummary] = useState<UserSummary | null>(null)
  const [activeCol, setActiveCol] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [colData, setColData] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(false)
  const [colLoading, setColLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadUser = useCallback(async (uid: string) => {
    if (!uid.trim()) return
    setLoading(true)
    setError(null)
    setSummary(null)
    setActiveCol(null)
    setColData([])
    try {
      const data = await adminFetch<UserSummary>(`/api/admin/data-explorer?uid=${encodeURIComponent(uid.trim())}`)
      setSummary(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (preUid) loadUser(preUid)
  }, [preUid, loadUser])

  async function loadCollection(col: string) {
    if (!summary) return
    setActiveCol(col)
    setColLoading(true)
    try {
      const data = await adminFetch<{ docs: Record<string, unknown>[] }>(
        `/api/admin/data-explorer?uid=${encodeURIComponent(summary.uid)}&collection=${col}`
      )
      setColData(data.docs)
    } catch {
      setColData([])
    } finally {
      setColLoading(false)
    }
  }

  return (
    <div style={{ padding: 28, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em' }}>
          Data Explorer
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 4 }}>
          Browse any user's data read-only
        </p>
      </div>

      {/* UID search */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, maxWidth: 560 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-4)', pointerEvents: 'none',
          }} />
          <input
            value={uidInput}
            onChange={e => setUidInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadUser(uidInput)}
            placeholder="Enter user UID or email…"
            style={{
              width: '100%', padding: '10px 12px 10px 36px',
              borderRadius: 11, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)',
              fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <button
          onClick={() => loadUser(uidInput)}
          disabled={loading}
          style={{
            padding: '10px 18px', borderRadius: 11,
            background: 'var(--bad)', color: '#fff',
            fontSize: 13.5, fontWeight: 700, border: 'none', cursor: 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Loading…' : 'Explore'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--bad-soft)', color: 'var(--bad-ink)', fontSize: 13.5, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {summary && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          {/* Left panel: user info + collection list */}
          <div style={{ width: 260, flexShrink: 0 }}>
            {/* User info */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '16px', marginBottom: 14,
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                {(summary.profile as Record<string, unknown>)?.displayName as string ?? 'Unknown User'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {(summary.profile as Record<string, unknown>)?.email as string ?? '—'}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 6, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {summary.uid}
              </div>
            </div>

            {/* Collections */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
            }}>
              {USER_COLLECTIONS.map(({ key, label }) => {
                const count = summary.collections.find(c => c.name === key)?.count ?? 0
                const active = activeCol === key
                return (
                  <button
                    key={key}
                    onClick={() => loadCollection(key)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', border: 'none', borderTop: '1px solid var(--border)',
                      background: active ? 'var(--bad-soft)' : 'transparent',
                      color: active ? 'var(--bad-ink)' : 'var(--text-2)',
                      cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 500,
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ChevronRight size={12} strokeWidth={active ? 2.2 : 1.5} />
                      {label}
                    </span>
                    <span style={{
                      fontSize: 11.5, fontWeight: 700, padding: '1px 7px', borderRadius: 999,
                      background: active ? 'var(--bad)' : 'var(--surface-2)',
                      color: active ? '#fff' : 'var(--text-3)',
                    }}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right panel: data table */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {activeCol ? (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{
                  padding: '14px 18px', borderBottom: '1px solid var(--border)',
                  fontSize: 14, fontWeight: 700, color: 'var(--text)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {USER_COLLECTIONS.find(c => c.key === activeCol)?.label}
                  {colData.length > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 500 }}>
                      ({colData.length} records)
                    </span>
                  )}
                </div>
                {colLoading ? (
                  <div style={{ padding: '24px', color: 'var(--text-4)', fontSize: 13.5, textAlign: 'center' }}>
                    Loading…
                  </div>
                ) : (
                  <JsonTable data={colData} />
                )}
              </div>
            ) : (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 16, padding: '32px 24px', textAlign: 'center',
                color: 'var(--text-4)', fontSize: 13.5, boxShadow: 'var(--shadow-sm)',
              }}>
                Select a collection from the left to browse data
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
