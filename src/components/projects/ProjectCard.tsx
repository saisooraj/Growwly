'use client'

import { Trash2, Edit2 } from 'lucide-react'
import { formatCurrencyFull } from '@/lib/utils'
import { deleteProject } from '@/lib/firestore'
import { useRefreshData } from '@/hooks/useData'
import type { Project } from '@/types'
import { useState } from 'react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'

interface Props {
  project: Project
  onEdit: (p: Project) => void
}

const STATUS_META: Record<Project['status'], { label: string; soft: string; ink: string }> = {
  active:    { label: 'Active',    soft: 'var(--good-soft)',  ink: 'var(--good-ink)'  },
  completed: { label: 'Completed', soft: 'var(--info-soft)',  ink: 'var(--info-ink)'  },
  paused:    { label: 'Paused',    soft: 'var(--surface-2)',  ink: 'var(--text-2)'    },
}

export default function ProjectCard({ project, onEdit }: Props) {
  const refresh = useRefreshData()
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const pct = project.totalBudget > 0
    ? Math.min((project.paid / project.totalBudget) * 100, 100) : 0
  const remaining = project.totalBudget - project.paid
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
          { label: 'Paid',     value: formatCurrencyFull(project.paid) },
          { label: 'Progress', value: `${pct.toFixed(0)}%` },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center', padding: '10px 8px', background: 'var(--surface-2)', borderRadius: 12 }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 3px' }}>{s.label}</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

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
