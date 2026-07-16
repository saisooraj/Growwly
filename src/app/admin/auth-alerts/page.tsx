'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, ShieldAlert, CheckCheck, Smartphone, Monitor, Circle } from 'lucide-react'
import {
  getAllAuthAlerts,
  markAlertRead,
  markAllAlertsRead,
  type AuthAlertRecord,
} from '@/lib/authErrorLogger'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function parseDevice(ua: string): { device: string; browser: string; mobile: boolean } {
  const mobile = /iP(hone|ad|od)|Android/i.test(ua)
  let device = 'Desktop'
  if (/iPhone/i.test(ua))      device = 'iPhone'
  else if (/iPad/i.test(ua))   device = 'iPad'
  else if (/Android/i.test(ua)) device = 'Android'
  else if (/Mac/i.test(ua))    device = 'Mac'
  else if (/Windows/i.test(ua)) device = 'Windows'

  let browser = 'Unknown'
  if (/DuckDuckGo/i.test(ua))                          browser = 'DuckDuckGo'
  else if (/Brave/i.test(ua))                          browser = 'Brave'
  else if (/CriOS/i.test(ua))                          browser = 'Chrome (iOS)'
  else if (/FxiOS/i.test(ua))                          browser = 'Firefox (iOS)'
  else if (/OPiOS/i.test(ua))                          browser = 'Opera (iOS)'
  else if (/EdgiOS/i.test(ua))                         browser = 'Edge (iOS)'
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari'
  else if (/Chrome/i.test(ua))                         browser = 'Chrome'
  else if (/Firefox/i.test(ua))                        browser = 'Firefox'
  else if (/Edge/i.test(ua))                           browser = 'Edge'

  return { device, browser, mobile }
}

const ERROR_LABELS: Record<string, { label: string; color: string }> = {
  'auth/redirect-state-lost':  { label: 'ITP Blocked',     color: 'var(--bad)'  },
  'auth/popup-blocked':         { label: 'Popup Blocked',   color: 'var(--warn)' },
  'auth/network-request-failed':{ label: 'Network Error',   color: 'var(--warn)' },
  'auth/internal-error':        { label: 'Internal Error',  color: 'var(--bad)'  },
  'auth/cancelled-popup-request':{ label: 'Popup Cancelled',color: 'var(--text-3)'},
  'auth/popup-closed-by-user':  { label: 'Popup Closed',   color: 'var(--text-3)'},
  'unknown':                    { label: 'Unknown',         color: 'var(--text-3)'},
}

function ErrorBadge({ code }: { code: string }) {
  const meta = ERROR_LABELS[code] ?? { label: code, color: 'var(--text-3)' }
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999,
      background: `${meta.color}22`,
      color: meta.color,
      border: `1px solid ${meta.color}44`,
      whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  )
}

function FlowBadge({ flow }: { flow: string }) {
  const label = flow.startsWith('google-redirect:ios')
    ? 'iOS Redirect'
    : flow.startsWith('google-redirect:popup-blocked')
    ? 'Popup → Redirect'
    : flow.startsWith('google-redirect')
    ? 'Google Redirect'
    : flow
  return (
    <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono, monospace)' }}>
      {label}
    </span>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AuthAlertsPage() {
  const [alerts, setAlerts]   = useState<AuthAlertRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all' | 'unread'>('unread')
  const [marking, setMarking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setAlerts(await getAllAuthAlerts(200))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const unread  = alerts.filter(a => !a.read)
  const shown   = filter === 'unread' ? unread : alerts

  // Summary counts
  const itpCount     = alerts.filter(a => !a.read && a.code === 'auth/redirect-state-lost').length
  const networkCount = alerts.filter(a => !a.read && a.code === 'auth/network-request-failed').length
  const mobileCount  = alerts.filter(a => !a.read && parseDevice(a.userAgent).mobile).length

  async function handleMarkAllRead() {
    setMarking(true)
    await markAllAlertsRead()
    await load()
    setMarking(false)
  }

  async function handleMarkOne(id: string) {
    await markAlertRead(id)
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))
  }

  return (
    <div style={{ padding: 28, maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em' }}>
              Auth Alerts
            </h1>
            {unread.length > 0 && (
              <span style={{
                fontSize: 12, fontWeight: 800, padding: '2px 10px', borderRadius: 999,
                background: 'var(--bad)', color: '#fff',
              }}>
                {unread.length} unread
              </span>
            )}
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 4 }}>
            Sign-in failures logged from user devices
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {unread.length > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={marking}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                borderRadius: 10, border: 'none',
                background: 'var(--bad)', color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: marking ? 0.6 : 1,
              }}
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
          <button
            onClick={load}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text-2)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} strokeWidth={1.8} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && unread.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12, marginBottom: 24,
        }}>
          {[
            { label: 'Unread failures',   value: unread.length,  color: 'var(--bad)'  },
            { label: 'ITP / iOS blocked', value: itpCount,       color: 'var(--warn)' },
            { label: 'Network errors',    value: networkCount,   color: 'var(--warn)' },
            { label: 'Mobile devices',    value: mobileCount,    color: 'var(--info)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '16px 18px', boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1 }}>
                {value}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 5, fontWeight: 500 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter pills */}
      {!loading && alerts.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {(['unread', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '5px 14px', borderRadius: 999, fontSize: 12.5,
                fontWeight: filter === f ? 700 : 500,
                border: filter === f ? 'none' : '1px solid var(--border)',
                background: filter === f ? 'var(--bad)' : 'var(--surface)',
                color: filter === f ? '#fff' : 'var(--text-3)',
                cursor: 'pointer',
              }}
            >
              {f === 'unread' ? `Unread (${unread.length})` : `All (${alerts.length})`}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
      }}>
        {loading ? (
          <div style={{ padding: 28, color: 'var(--text-4)', fontSize: 13.5, textAlign: 'center' }}>
            Loading…
          </div>
        ) : shown.length === 0 ? (
          <div style={{ padding: '48px 28px', textAlign: 'center' }}>
            <ShieldAlert size={36} style={{ color: 'var(--text-4)', marginBottom: 12 }} strokeWidth={1.4} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-3)', marginBottom: 4 }}>
              {filter === 'unread' ? 'No unread failures' : 'No auth failures logged'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-4)' }}>
              {filter === 'unread' ? 'All caught up.' : 'Sign-in errors will appear here when they occur.'}
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['', 'Timestamp', 'Error', 'Flow', 'Device', ''].map((h, i) => (
                  <th key={i} style={{
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
              {shown.map((alert, i) => {
                const { device, browser, mobile } = parseDevice(alert.userAgent)
                return (
                  <tr
                    key={alert.id}
                    style={{
                      borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                      background: alert.read ? 'transparent' : 'rgba(239,68,68,0.03)',
                    }}
                  >
                    {/* Unread dot */}
                    <td style={{ padding: '11px 8px 11px 16px', width: 20 }}>
                      {!alert.read && (
                        <Circle size={7} style={{ color: 'var(--bad)', fill: 'var(--bad)' }} />
                      )}
                    </td>

                    {/* Timestamp */}
                    <td style={{ padding: '11px 16px', fontSize: 12.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                      {fmtDate(alert.timestamp)}
                    </td>

                    {/* Error code */}
                    <td style={{ padding: '11px 16px' }}>
                      <ErrorBadge code={alert.code} />
                    </td>

                    {/* Flow */}
                    <td style={{ padding: '11px 16px' }}>
                      <FlowBadge flow={alert.flow} />
                    </td>

                    {/* Device + browser */}
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {mobile
                          ? <Smartphone size={13} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
                          : <Monitor size={13} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
                        }
                        <span style={{ fontSize: 12.5, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                          {device} · {browser}
                        </span>
                      </div>
                    </td>

                    {/* Mark read */}
                    <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                      {!alert.read && (
                        <button
                          onClick={() => handleMarkOne(alert.id)}
                          style={{
                            fontSize: 11.5, fontWeight: 600, padding: '3px 10px',
                            borderRadius: 8, border: '1px solid var(--border)',
                            background: 'var(--surface-2)', color: 'var(--text-3)',
                            cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          Mark read
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {shown.length > 0 && (
        <p style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 12, textAlign: 'right' }}>
          Showing {shown.length} of {alerts.length} total · last 200 records
        </p>
      )}
    </div>
  )
}
