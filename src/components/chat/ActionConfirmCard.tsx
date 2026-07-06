'use client'

import type { PendingAction, AddTransactionPayload, UpdateTransactionPayload, DeleteTransactionPayload } from '@/lib/ai/types'
import { Check, X, AlertTriangle } from 'lucide-react'

interface Props {
  action: PendingAction
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

function formatDateHuman(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function ActionDetails({ action }: { action: PendingAction }) {
  if (action.type === 'add_transaction') {
    const p = action.payload as AddTransactionPayload
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
        <Row label="Type" value={p.type === 'income' ? '📈 Income' : '📉 Expense'} />
        <Row label="Category" value={p.category} />
        <Row label="Amount" value={`₹${p.amount.toLocaleString('en-IN')}`} highlight />
        <Row label="Date" value={formatDateHuman(p.date)} />
        {p.notes && <Row label="Notes" value={p.notes} />}
      </div>
    )
  }

  if (action.type === 'update_transaction') {
    const p = action.payload as UpdateTransactionPayload
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
        {p.amount !== undefined && <Row label="New Amount" value={`₹${p.amount.toLocaleString('en-IN')}`} highlight />}
        {p.category !== undefined && <Row label="New Category" value={p.category} />}
        {p.date !== undefined && <Row label="New Date" value={formatDateHuman(p.date)} />}
        {p.notes !== undefined && <Row label="New Notes" value={p.notes} />}
      </div>
    )
  }

  if (action.type === 'delete_transaction') {
    const p = action.payload as DeleteTransactionPayload
    return (
      <div style={{
        margin: '12px 0',
        padding: '10px 12px',
        background: 'var(--bad-soft)',
        borderRadius: 12,
        color: 'var(--bad-ink)',
        fontSize: 13,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <AlertTriangle size={15} style={{ flexShrink: 0 }} />
        <span>This action cannot be undone. Will delete: <strong>{p.description}</strong></span>
      </div>
    )
  }

  return null
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', width: 80, flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: 14, fontWeight: highlight ? 700 : 500,
        color: highlight ? 'var(--text)' : 'var(--text-2)',
      }}>{value}</span>
    </div>
  )
}

const ACTION_LABELS: Record<string, { title: string; confirmLabel: string; confirmStyle: 'brand' | 'danger' }> = {
  add_transaction:    { title: 'Add Transaction',    confirmLabel: 'Confirm & Add',    confirmStyle: 'brand' },
  update_transaction: { title: 'Update Transaction', confirmLabel: 'Confirm & Update', confirmStyle: 'brand' },
  delete_transaction: { title: 'Delete Transaction', confirmLabel: 'Confirm & Delete', confirmStyle: 'danger' },
}

export default function ActionConfirmCard({ action, onConfirm, onCancel, loading }: Props) {
  const meta = ACTION_LABELS[action.type] ?? { title: 'Confirm Action', confirmLabel: 'Confirm', confirmStyle: 'brand' as const }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      {/* Assistant avatar */}
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0, marginTop: 4,
        background: 'linear-gradient(140deg, var(--brand-2), var(--brand))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, color: '#fff', fontWeight: 700,
      }}>
        ✦
      </div>

      <div style={{
        flex: 1, minWidth: 0,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '18px 18px 18px 4px',
        padding: '14px 16px',
        boxShadow: 'var(--elev)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
            color: 'var(--brand-ink)', background: 'var(--brand-soft)',
            padding: '2px 8px', borderRadius: 999,
          }}>
            Action Required
          </span>
        </div>

        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
          {meta.title}
        </div>

        <ActionDetails action={action} />

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <X size={13} />
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`btn btn-sm ${meta.confirmStyle === 'danger' ? 'btn-danger' : 'btn-brand'}`}
            style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, justifyContent: 'center' }}
          >
            {loading ? (
              <span style={{
                width: 13, height: 13, borderRadius: '50%',
                border: '2px solid currentColor', borderTopColor: 'transparent',
                animation: 'gw-spin .7s linear infinite', display: 'inline-block',
              }} />
            ) : (
              <Check size={13} />
            )}
            {loading ? 'Processing…' : meta.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
