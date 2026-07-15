'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { adminFetch } from '@/lib/adminApi'
import { ArrowLeft, UserX, UserCheck, TrendingUp, TrendingDown } from 'lucide-react'
import toast from 'react-hot-toast'

interface Transaction {
  id: string
  type: string
  amount: number
  category: string
  date: string
  notes?: string
}

interface UserDetail {
  user: {
    uid: string
    email: string | null
    displayName: string | null
    photoURL: string | null
    disabled: boolean
    createdAt: string | null
    lastSignIn: string | null
    providers: string[]
  }
  profile: {
    createdAt?: string
    lastActiveAt?: string
  } | null
  stats: {
    transactions: number
    goals: number
    borrowings: number
    tasks: number
    monthIncome: number
    monthExpenses: number
  }
  recentTransactions: Transaction[]
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtCurrency(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

export default function UserDetailPage() {
  const { uid } = useParams<{ uid: string }>()
  const [data, setData] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    adminFetch<UserDetail>(`/api/admin/users/${uid}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [uid])

  async function toggleUser() {
    if (!data) return
    setToggling(true)
    try {
      const action = data.user.disabled ? 'enable' : 'disable'
      await adminFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ uid, action }),
      })
      setData(prev => prev ? { ...prev, user: { ...prev.user, disabled: !prev.user.disabled } } : prev)
      toast.success(action === 'enable' ? 'User enabled' : 'User disabled')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setToggling(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 28, color: 'var(--text-3)', fontSize: 14 }}>Loading user…</div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ padding: 28 }}>
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--bad-soft)', color: 'var(--bad-ink)', fontSize: 13.5 }}>
          {error ?? 'User not found'}
        </div>
      </div>
    )
  }

  const { user, profile, stats, recentTransactions } = data

  return (
    <div style={{ padding: 28, maxWidth: 900, margin: '0 auto' }}>
      {/* Back */}
      <Link
        href="/admin/users"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: 'var(--text-3)', textDecoration: 'none', marginBottom: 20,
          fontWeight: 500,
        }}
      >
        <ArrowLeft size={14} strokeWidth={1.8} />
        Back to Users
      </Link>

      {/* Profile card */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 18, padding: '22px 24px', marginBottom: 20,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          {user.photoURL ? (
            <Image src={user.photoURL} alt="" width={64} height={64} style={{ borderRadius: '50%', flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
              background: 'var(--info-soft)', color: 'var(--info-ink)',
              fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {user.displayName?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em' }}>
                {user.displayName ?? 'Unknown User'}
              </h2>
              <span style={{
                fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999,
                background: user.disabled ? 'var(--bad-soft)' : 'var(--good-soft)',
                color: user.disabled ? 'var(--bad-ink)' : 'var(--good-ink)',
              }}>
                {user.disabled ? 'Disabled' : 'Active'}
              </span>
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 4 }}>{user.email}</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4, fontFamily: 'var(--font-mono, monospace)' }}>
              uid: {user.uid}
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>Joined</div>
                <div style={{ fontSize: 13.5, color: 'var(--text-2)', marginTop: 2 }}>{fmtDate(profile?.createdAt ?? user.createdAt)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>Last Active</div>
                <div style={{ fontSize: 13.5, color: 'var(--text-2)', marginTop: 2 }}>{fmtDate(profile?.lastActiveAt ?? user.lastSignIn)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>Providers</div>
                <div style={{ fontSize: 13.5, color: 'var(--text-2)', marginTop: 2 }}>{user.providers.join(', ') || '—'}</div>
              </div>
            </div>
          </div>
          <button
            onClick={toggleUser}
            disabled={toggling}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', borderRadius: 10,
              border: `1px solid ${user.disabled ? 'var(--good-soft)' : 'var(--bad-soft)'}`,
              background: user.disabled ? 'var(--good-soft)' : 'var(--bad-soft)',
              color: user.disabled ? 'var(--good-ink)' : 'var(--bad-ink)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
              opacity: toggling ? 0.5 : 1,
            }}
          >
            {user.disabled
              ? <><UserCheck size={14} strokeWidth={2} /> Enable Account</>
              : <><UserX size={14} strokeWidth={2} /> Disable Account</>
            }
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Transactions', value: stats.transactions },
          { label: 'Goals', value: stats.goals },
          { label: 'Borrowings', value: stats.borrowings },
          { label: 'Tasks', value: stats.tasks },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '16px 18px', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>
              {value.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3, fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* This month */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '18px 22px', marginBottom: 20, boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
          This Month
        </div>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TrendingUp size={20} style={{ color: 'var(--good)' }} strokeWidth={1.8} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--good)', letterSpacing: '-0.03em' }}>
                {fmtCurrency(stats.monthIncome)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>Income</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TrendingDown size={20} style={{ color: 'var(--bad)' }} strokeWidth={1.8} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--bad)', letterSpacing: '-0.03em' }}>
                {fmtCurrency(stats.monthExpenses)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>Expenses</div>
            </div>
          </div>
          <div>
            <div style={{
              fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em',
              color: stats.monthIncome - stats.monthExpenses >= 0 ? 'var(--good)' : 'var(--bad)',
            }}>
              {fmtCurrency(stats.monthIncome - stats.monthExpenses)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>Net</div>
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          Recent Transactions
        </div>
        {recentTransactions.length === 0 ? (
          <div style={{ padding: '20px', color: 'var(--text-4)', fontSize: 13.5, textAlign: 'center' }}>No transactions yet</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {recentTransactions.map((t, i) => (
                <tr key={t.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                  <td style={{ padding: '11px 20px', fontSize: 13, color: 'var(--text-3)' }}>{t.date}</td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--text)' }}>{t.category}</td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--text-2)' }}>{t.notes ?? '—'}</td>
                  <td style={{ padding: '11px 20px', fontSize: 13.5, fontWeight: 700, textAlign: 'right',
                    color: t.type === 'income' ? 'var(--good)' : t.type === 'expense' ? 'var(--bad)' : 'var(--text-2)',
                  }}>
                    {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}{fmtCurrency(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <Link
            href={`/admin/data-explorer?uid=${uid}`}
            style={{
              fontSize: 12.5, color: 'var(--bad)', textDecoration: 'none', fontWeight: 600,
            }}
          >
            View all data in Data Explorer →
          </Link>
        </div>
      </div>
    </div>
  )
}
