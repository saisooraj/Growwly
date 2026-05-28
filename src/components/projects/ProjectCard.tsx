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

const STATUS_MAP = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-700' },
  paused: { label: 'Paused', color: 'bg-slate-100 text-slate-600' },
}

export default function ProjectCard({ project, onEdit }: Props) {
  const refresh = useRefreshData()
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const pct = project.totalBudget > 0
    ? Math.min((project.paid / project.totalBudget) * 100, 100)
    : 0

  const remaining = project.totalBudget - project.paid
  const isOver = remaining < 0
  const status = STATUS_MAP[project.status]

  function handleDelete() {
    setConfirm({
      message: `Delete project "${project.name}"?`,
      onConfirm: async () => {
        try {
          await deleteProject(project.id)
          await refresh()
          toast.success('Project deleted')
        } catch { toast.error('Failed to delete') }
      },
    })
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-800">{project.name}</h3>
            <span className={`badge ${status.color}`}>{status.label}</span>
          </div>
          {project.description && (
            <p className="text-xs text-slate-400">{project.description}</p>
          )}
        </div>
        <div className="flex gap-1">
          <button onClick={() => onEdit(project)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <Edit2 size={14} />
          </button>
          <button onClick={handleDelete} className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-500">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Budget progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>Budget: {formatCurrencyFull(project.totalBudget)}</span>
          <span className={isOver ? 'text-red-500 font-medium' : ''}>
            {isOver ? `Over by ${formatCurrencyFull(Math.abs(remaining))}` : `${formatCurrencyFull(remaining)} left`}
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-700 ${
              isOver ? 'bg-red-500' : pct > 80 ? 'bg-yellow-400' : 'bg-brand-500'
            }`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 bg-slate-50 rounded-xl">
          <p className="text-xs text-slate-400">Budget</p>
          <p className="text-sm font-semibold text-slate-700">{formatCurrencyFull(project.totalBudget)}</p>
        </div>
        <div className="text-center p-2 bg-slate-50 rounded-xl">
          <p className="text-xs text-slate-400">Paid</p>
          <p className="text-sm font-semibold text-slate-700">{formatCurrencyFull(project.paid)}</p>
        </div>
        <div className="text-center p-2 bg-slate-50 rounded-xl">
          <p className="text-xs text-slate-400">Progress</p>
          <p className="text-sm font-semibold text-slate-700">{pct.toFixed(0)}%</p>
        </div>
      </div>

      {project.startDate && (
        <p className="text-xs text-slate-400 mt-3">
          Started: {format(parseISO(project.startDate), 'dd MMM yyyy')}
          {project.endDate && ` · Due: ${format(parseISO(project.endDate), 'dd MMM yyyy')}`}
        </p>
      )}

      {confirm && (
        <ConfirmDialog
          open={true}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
