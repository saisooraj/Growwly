'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/adminApi'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Users, ArrowLeftRight, Target, HandCoins, MessageSquare, Bell, Briefcase, CheckSquare } from 'lucide-react'

interface Metrics {
  totals: {
    users: number
    transactions: number
    goals: number
    borrowings: number
    tasks: number
    projects: number
    pushSubscriptions: number
    chatRequests: number
  }
  activity: {
    newUsersThisWeek: number
    newUsersThisMonth: number
    activeUsersThisWeek: number
  }
  newUsersByDay: { date: string; count: number }[]
}

function StatCard({
  icon: Icon, label, value, sub, color = 'var(--brand)',
}: {
  icon: React.ElementType
  label: string
  value: number | string
  sub?: string
  color?: string
}) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 10,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: `${color}1a`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} style={{ color }} strokeWidth={1.8} />
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1, letterSpacing: '-0.03em' }}>
          {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminFetch<Metrics>('/api/admin/metrics')
      .then(setMetrics)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const chartData = metrics?.newUsersByDay.map(d => ({
    date: d.date.slice(5), // MM-DD
    count: d.count,
  })) ?? []

  const hasChartData = chartData.some(d => d.count > 0)

  return (
    <div style={{ padding: 28, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em' }}>
          Overview
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 4 }}>
          Platform-wide metrics across all users
        </p>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 12, background: 'var(--bad-soft)',
          color: 'var(--bad-ink)', fontSize: 13.5, marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading metrics…</div>
      ) : metrics ? (
        <>
          {/* Stats grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 14, marginBottom: 28,
          }}>
            <StatCard icon={Users}         label="Total Users"         value={metrics.totals.users}          sub={`${metrics.activity.activeUsersThisWeek} active this week`}  color="var(--info)" />
            <StatCard icon={ArrowLeftRight} label="Total Transactions"  value={metrics.totals.transactions}                                                                       color="var(--brand)" />
            <StatCard icon={Target}         label="Savings Goals"       value={metrics.totals.goals}                                                                              color="var(--good)" />
            <StatCard icon={HandCoins}      label="Borrowings"          value={metrics.totals.borrowings}                                                                         color="var(--warn)" />
            <StatCard icon={MessageSquare}  label="AI Chat Requests"    value={metrics.totals.chatRequests}                                                                       color="var(--bad)" />
            <StatCard icon={Bell}           label="Push Subscriptions"  value={metrics.totals.pushSubscriptions}                                                                  color="var(--info)" />
            <StatCard icon={Briefcase}      label="Projects"            value={metrics.totals.projects}                                                                           color="var(--brand-2)" />
            <StatCard icon={CheckSquare}    label="Tasks"               value={metrics.totals.tasks}                                                                              color="var(--text-3)" />
          </div>

          {/* Activity row */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 14, marginBottom: 28,
          }}>
            {[
              { label: 'New users this week', value: metrics.activity.newUsersThisWeek },
              { label: 'New users this month', value: metrics.activity.newUsersThisMonth },
              { label: 'Active users this week', value: metrics.activity.activeUsersThisWeek },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 14, padding: '16px 20px', boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.04em' }}>{value}</div>
                <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3, fontWeight: 500 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* New users chart */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 18, padding: '22px 24px', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 18 }}>
              New Users — Last 30 Days
            </div>
            {hasChartData ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--text-4)' }}
                    tickLine={false}
                    axisLine={false}
                    interval={4}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--text-4)' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 10, fontSize: 12, color: 'var(--text)',
                    }}
                    cursor={{ fill: 'var(--surface-2)' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={20}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill="var(--info)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{
                height: 200, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: 'var(--text-4)', fontSize: 13,
              }}>
                No new signups in the last 30 days
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
