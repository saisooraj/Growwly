'use client'

import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  open: boolean
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onClose: () => void
}

export default function ConfirmDialog({ open, message, confirmLabel = 'Delete', onConfirm, onClose }: Props) {
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

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
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
            background: 'var(--bad-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={16} style={{ color: 'var(--bad-ink)' }} />
          </div>
          <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5, paddingTop: 6 }}>
            {message}
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            ref={confirmRef}
            className="btn-danger"
            onClick={() => { onConfirm(); onClose() }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
