'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { adminFetch } from '@/lib/adminApi'
import { Search, UserX, UserCheck, ExternalLink, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface AdminUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  disabled: boolean
  createdAt: string | null
  lastSignIn: string | null
  providers: string[]
  profile: {
    lastActiveAt?: string
    createdAt?: string
  } | null
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ProviderPills({ providers }: { providers: string[] }) {
  const labels: Record<string, string> = {
    'google.com': 'Google',
    'password': 'Email',
    'phone': 'Phone',
  }
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {providers.map(p => (
        <span key={p} style={{
          fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
          background: 'var(--surface-2)', color: 'var(--text-3)', border: '1px solid var(--border)',
        }}>
          {labels[p] ?? p}
        </span>
      ))}
    </div>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [toggling, setToggling] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await adminFetch<{ users: AdminUser[] }>('/api/admin/users')
      setUsers(data.users.sort((a, b) =>
        (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
      ))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function toggleUser(uid: string, currentlyDisabled: boolean) {
    setToggling(uid)
    try {
      await adminFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ uid, action: currentlyDisabled ? 'enable' : 'disable' }),
      })
      setUsers(prev => prev.map(u =>
        u.uid === uid ? { ...u, disabled: !currentlyDisabled } : u
      ))
      toast.success(currentlyDisabled ? 'User enabled' : 'User disabled')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setToggling(null)
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return users
    return users.filter(u =>
      u.email?.toLowerCase().includes(q) ||
      u.displayName?.toLowerCase().includes(q) ||
      u.uid.toLowerCase().includes(q)
    )
  }, [users, search])

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em' }}>
            Users
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 4 }}>
            {loading ? 'Loading…' : `${users.length} total users`}
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
        <div style={{
          padding: '12px 16px', borderRadius: 12, background: 'var(--bad-soft)',
          color: 'var(--bad-ink)', fontSize: 13.5, marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16, maxWidth: 400 }}>
        <Search size={15} style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-4)', pointerEvents: 'none',
        }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email or UID…"
          style={{
            width: '100%', padding: '9px 12px 9px 36px',
            borderRadius: 11, border: '1px solid var(--border)',
            background: 'var(--surface)', color: 'var(--text)',
            fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {['User', 'Joined', 'Last Sign In', 'Providers', 'Status', ''].map(h => (
                <th key={h} style={{
                  padding: '11px 16px', textAlign: 'left',
                  fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)',
                  letterSpacing: '.05em', textTransform: 'uppercase',
                  borderBottom: '1px solid var(--border)',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-4)', fontSize: 13.5 }}>
                  Loading users…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-4)', fontSize: 13.5 }}>
                  {search ? 'No users match your search' : 'No users found'}
                </td>
              </tr>
            ) : filtered.map((u, i) => (
              <tr
                key={u.uid}
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}
              >
                {/* User */}
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {u.photoURL ? (
                      <Image
                        src={u.photoURL} alt="" width={32} height={32}
                        style={{ borderRadius: '50%', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: 'var(--info-soft)', color: 'var(--info-ink)',
                        fontSize: 13, fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {u.displayName?.[0]?.toUpperCase() ?? u.email?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                        {u.displayName ?? '—'}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{u.email ?? u.uid.slice(0, 16)}</div>
                    </div>
                  </div>
                </td>
                {/* Joined */}
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                  {fmtDate(u.profile?.createdAt ?? u.createdAt)}
                </td>
                {/* Last sign in */}
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                  {fmtDate(u.profile?.lastActiveAt ?? u.lastSignIn)}
                </td>
                {/* Providers */}
                <td style={{ padding: '12px 16px' }}>
                  <ProviderPills providers={u.providers} />
                </td>
                {/* Status */}
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                    background: u.disabled ? 'var(--bad-soft)' : 'var(--good-soft)',
                    color: u.disabled ? 'var(--bad-ink)' : 'var(--good-ink)',
                  }}>
                    {u.disabled ? 'Disabled' : 'Active'}
                  </span>
                </td>
                {/* Actions */}
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Link
                      href={`/admin/users/${u.uid}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '5px 10px', borderRadius: 8,
                        border: '1px solid var(--border)', background: 'var(--surface-2)',
                        color: 'var(--text-2)', fontSize: 12, fontWeight: 500,
                        textDecoration: 'none',
                      }}
                    >
                      <ExternalLink size={12} strokeWidth={1.8} />
                      View
                    </Link>
                    <button
                      onClick={() => toggleUser(u.uid, u.disabled)}
                      disabled={toggling === u.uid}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '5px 10px', borderRadius: 8,
                        border: `1px solid ${u.disabled ? 'var(--good-soft)' : 'var(--bad-soft)'}`,
                        background: u.disabled ? 'var(--good-soft)' : 'var(--bad-soft)',
                        color: u.disabled ? 'var(--good-ink)' : 'var(--bad-ink)',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        opacity: toggling === u.uid ? 0.5 : 1,
                      }}
                    >
                      {u.disabled
                        ? <><UserCheck size={12} strokeWidth={1.8} /> Enable</>
                        : <><UserX size={12} strokeWidth={1.8} /> Disable</>
                      }
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
