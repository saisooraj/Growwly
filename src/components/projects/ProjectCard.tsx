'use client'

import { Trash2, Edit2, ChevronDown, ChevronRight } from 'lucide-react'
import { formatCurrencyFull, computeProjectPaid, isSavingsTransfer } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'
import { deleteProject } from '@/lib/firestore'
import { useRefreshData } from '@/hooks/useData'
import type { Project, Transaction } from '@/types'
import { useMemo, useState } from 'react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'

interface Props {
  project: Project
  onEdit: (p: Project) => void
}

const PAGE = 5

interface Payment {
  tx: Transaction
  amount: number      // signed: refunds count against the project
  sharePct: number    // this payment as a share of the budget
  beforePct: number   // progress just before it
  afterPct: number    // progress just after it
}

function paymentLabel(t: Transaction): string {
  if (t.notes?.trim()) return t.notes.trim()
  if (t.type === 'refund') return `Refund · ${t.category}`
  if (isSavingsTransfer(t)) return t.savingsVehicle ?? 'Savings'
  return t.category
}

// Oldest first so each payment knows how far along the project was when it landed;
// returned newest first for display.
function buildPayments(transactions: Transaction[], projectId: string, budget: number): Payment[] {
  const own = transactions
    .filter(t => t.projectId === projectId && (t.type === 'expense' || t.type === 'refund' || isSavingsTransfer(t)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  const pct = (n: number) => budget > 0 ? (n / budget) * 100 : 0
  let running = 0
  const out = own.map(tx => {
    const amount = tx.type === 'refund' ? -tx.amount : tx.amount
    const before = running
    running += amount
    return { tx, amount, sharePct: pct(amount), beforePct: pct(before), afterPct: pct(running) }
  })
  return out.reverse()
}

const STATUS_META: Record<Project['status'], { label: string; soft: string; ink: string }> = {
  active:    { label: 'Active',    soft: 'var(--good-soft)',  ink: 'var(--good-ink)'  },
  completed: { label: 'Completed', soft: 'var(--info-soft)',  ink: 'var(--info-ink)'  },
  paused:    { label: 'Paused',    soft: 'var(--surface-2)',  ink: 'var(--text-2)'    },
}

export default function ProjectCard({ project, onEdit }: Props) {
  const refresh = useRefreshData()
  const transactions = useAppStore((s) => s.transactions)
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [showPayments, setShowPayments] = useState(false)
  const [visible, setVisible] = useState(PAGE)
  // Derived from the linked transactions, so the total always matches the payments listed below
  const paid = useMemo(() => computeProjectPaid(transactions, project.id), [transactions, project.id])
  const payments = useMemo(() => buildPayments(transactions, project.id, project.totalBudget), [transactions, project.id, project.totalBudget])
  const pct = project.totalBudget > 0
    ? Math.min((paid / project.totalBudget) * 100, 100) : 0
  const remaining = project.totalBudget - paid
  const isOver = remaining < 0
  const status = STATUS_META[project.status]

  function handleDelete() {
    setConfirm({
      message: `Delete project "${project.name}"?`,
      onConfirm: async () => {
        try { await deleteProject(project.id); await refresh(); toast.success('Project deleted') }
        catch { toast.error('Failed to delete') }
      },
    })
  }

  const barColor = isOver
    ? 'var(--bad)'
    : pct > 80
      ? 'var(--warn)'
      : 'linear-gradient(90deg, var(--brand-2), var(--brand))'

  return (
    <div className="card card-press" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
            <h3 style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15, margin: 0 }}>{project.name}</h3>
            <span style={{
              padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
              background: status.soft, color: status.ink,
            }}>
              {status.label}
            </span>
          </div>
          {project.description && (
            <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: 0 }}>{project.description}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button
            onClick={() => onEdit(project)}
            style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={handleDelete}
            style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bad-soft)'; e.currentTarget.style.color = 'var(--bad-ink)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Budget progress */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-3)', marginBottom: 8 }}>
          <span>Budget: {formatCurrencyFull(project.totalBudget)}</span>
          <span style={{ fontWeight: 600, color: isOver ? 'var(--bad-ink)' : 'var(--text-2)' }}>
            {isOver ? `Over by ${formatCurrencyFull(Math.abs(remaining))}` : `${formatCurrencyFull(remaining)} left`}
          </span>
        </div>
        <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, borderRadius: 999, background: barColor, transition: 'width .7s cubic-bezier(.22,1,.36,1)' }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: 'Budget',   value: formatCurrencyFull(project.totalBudget) },
          { label: 'Paid',     value: formatCurrencyFull(paid) },
          { label: 'Progress', value: `${pct.toFixed(0)}%` },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center', padding: '10px 8px', background: 'var(--surface-2)', borderRadius: 12 }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 3px' }}>{s.label}</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Payments */}
      {payments.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <button
            type="button"
            onClick={() => { setShowPayments(v => !v); setVisible(PAGE) }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--text-2)', fontSize: 12.5, fontWeight: 600 }}
          >
            <span>{payments.length} payment{payments.length === 1 ? '' : 's'}</span>
            {showPayments ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>

          {showPayments && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              {payments.slice(0, visible).map(({ tx, amount, sharePct, beforePct, afterPct }) => {
                const isRefund = amount < 0
                const lo = Math.max(0, Math.min(beforePct, afterPct, 100))
                const hi = Math.max(0, Math.min(Math.max(beforePct, afterPct), 100))
                return (
                  <div key={tx.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {paymentLabel(tx)}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-4)', margin: '1px 0 0' }}>
                          {format(parseISO(tx.date), 'dd MMM yyyy')}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 12.5, fontWeight: 700, color: isRefund ? 'var(--good-ink)' : 'var(--text)', margin: 0 }}>
                          {isRefund ? '−' : ''}{formatCurrencyFull(Math.abs(amount))}
                        </p>
                        {project.totalBudget > 0 && (
                          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '1px 0 0' }}>
                            {isRefund ? '−' : '+'}{Math.abs(sharePct).toFixed(1)}% · {afterPct.toFixed(0)}% done
                          </p>
                        )}
                      </div>
                    </div>
                    {project.totalBudget > 0 && (
                      // Grey: progress before this payment. Coloured: what this payment added (or a refund took back).
                      <div style={{ position: 'relative', height: 5, marginTop: 6, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', inset: 0, width: `${lo}%`, background: 'var(--text-4)', opacity: 0.35 }} />
                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${lo}%`, width: `${Math.max(hi - lo, 0.6)}%`, background: isRefund ? 'var(--bad)' : 'var(--brand)' }} />
                      </div>
                    )}
                  </div>
                )
              })}

              {visible < payments.length && (
                <button
                  type="button" onClick={() => setVisible(v => v + PAGE)}
                  style={{ alignSelf: 'center', border: 'none', background: 'var(--surface-2)', borderRadius: 999, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}
                >
                  Show {Math.min(PAGE, payments.length - visible)} more
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {project.startDate && (
        <p style={{ fontSize: 11.5, color: 'var(--text-4)', margin: 0 }}>
          Started: {format(parseISO(project.startDate), 'dd MMM yyyy')}
          {project.endDate && ` · Due: ${format(parseISO(project.endDate), 'dd MMM yyyy')}`}
        </p>
      )}

      {confirm && (
        <ConfirmDialog open message={confirm.message} onConfirm={confirm.onConfirm} onClose={() => setConfirm(null)} />
      )}
    </div>
  )
}
