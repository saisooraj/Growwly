'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle } from 'lucide-react'

interface Props {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onClose: () => void
  extraAction?: { label: string; onAction: () => void; danger?: boolean }
  /** 'danger' (default) = red alert styling; 'positive' = green confirm styling. */
  tone?: 'danger' | 'positive'
}

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onClose, extraAction, tone = 'danger' }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) confirmRef.current?.focus()
  }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  const positive = tone === 'positive'
  const Icon = positive ? CheckCircle : AlertTriangle
  const iconBg = positive ? 'var(--good-soft)' : 'var(--bad-soft)'
  const iconInk = positive ? 'var(--good-ink)' : 'var(--bad-ink)'
  const confirmClass = positive ? 'btn-brand' : 'btn-danger'

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 16,
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
        width: '100%', maxWidth: 360,
        padding: '24px 24px 20px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={16} style={{ color: iconInk }} />
          </div>
          <div style={{ paddingTop: 4 }}>
            {title && <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{title}</p>}
            <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5 }}>{message}</p>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          {extraAction && (
            <button
              className={extraAction.danger ? 'btn-danger' : 'btn'}
              style={extraAction.danger ? { opacity: 0.75 } : undefined}
              onClick={() => { extraAction.onAction(); onClose() }}
            >
              {extraAction.label}
            </button>
          )}
          <button
            ref={confirmRef}
            className={confirmClass}
            onClick={() => { onConfirm(); onClose() }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
