'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo } from 'react'
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns'
import { Plus, Check, ChevronDown, ChevronUp, Edit2, Trash2, CircleDot } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import TaskModal from '@/components/tasks/TaskModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useAppStore } from '@/store/appStore'
import { useRefreshData } from '@/hooks/useData'
import { updateTask, deleteTask } from '@/lib/firestore'
import type { Task, TaskPriority } from '@/types'
import toast from 'react-hot-toast'

const PRIORITY_META: Record<TaskPriority, { label: string; color: string; soft: string; ink: string }> = {
  'immediate': { label: 'Immediate', color: 'var(--bad)',    soft: 'var(--bad-soft)',    ink: 'var(--bad-ink)'    },
  'this-week': { label: 'This Week', color: 'var(--warn)',   soft: 'var(--warn-soft)',   ink: 'var(--warn-ink)'   },
  'later':     { label: 'Later',     color: 'var(--good)',   soft: 'var(--good-soft)',   ink: 'var(--good-ink)'   },
  'someday':   { label: 'Someday',   color: 'var(--text-3)', soft: 'var(--surface-2)',   ink: 'var(--text-2)'     },
}

const PRIORITY_ORDER: TaskPriority[] = ['immediate', 'this-week', 'later', 'someday']

function formatDue(dateStr: string): { text: string; overdue: boolean } {
  try {
    const d = parseISO(dateStr)
    if (isToday(d))    return { text: 'Today',    overdue: false }
    if (isTomorrow(d)) return { text: 'Tomorrow', overdue: false }
    if (isPast(d))     return { text: format(d, 'dd MMM'), overdue: true }
    return { text: format(d, 'dd MMM'), overdue: false }
  } catch { return { text: dateStr, overdue: false } }
}

interface TaskRowProps {
  task: Task
  onEdit: (t: Task) => void
  onDeleted: () => void
}

function TaskRow({ task, onEdit, onDeleted }: TaskRowProps) {
  const refresh = useRefreshData()
  const [expanded, setExpanded] = useState(false)
  const [hovered, setHovered] = useState(false)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const isDone = task.status === 'done'
  const hasSubs = task.subtasks.length > 0
  const subsDone = task.subtasks.filter(s => s.done).length
  const due = task.dueDate ? formatDue(task.dueDate) : null

  async function toggleDone() {
    try {
      const update: Record<string, unknown> = { status: isDone ? 'pending' : 'done' }
      if (!isDone) update.completedAt = new Date().toISOString()
      await updateTask(task.id, update)
      await refresh()
    } catch { toast.error('Failed to update') }
  }

  async function toggleSubtask(subId: string) {
    const updated = task.subtasks.map(s => s.id === subId ? { ...s, done: !s.done } : s)
    try {
      await updateTask(task.id, { subtasks: updated })
      await refresh()
    } catch { toast.error('Failed to update') }
  }

  async function doDelete() {
    try {
      await deleteTask(task.id)
      await refresh()
      onDeleted()
    } catch { toast.error('Failed to delete') }
  }

  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: isDone ? 'var(--surface-2)' : 'var(--surface)',
        opacity: isDone ? 0.65 : 1,
        transition: 'opacity .2s',
        overflow: 'hidden',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px' }}>
        {/* Checkbox */}
        <button
          onClick={toggleDone}
          style={{
            width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
            border: `2px solid ${isDone ? 'var(--good)' : 'var(--border-strong)'}`,
            background: isDone ? 'var(--good)' : 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all .15s',
          }}
        >
          {isDone && <Check size={11} color="#fff" strokeWidth={3} />}
        </button>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 13.5, fontWeight: 500,
              color: isDone ? 'var(--text-3)' : 'var(--text)',
              textDecoration: isDone ? 'line-through' : 'none',
            }}>
              {task.title}
            </span>
            {hasSubs && (
              <span style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 999, flexShrink: 0 }}>
                {subsDone}/{task.subtasks.length}
              </span>
            )}
            {task.tags.map(tag => (
              <span key={tag} style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 999, background: 'var(--brand-soft)', color: 'var(--brand-ink)' }}>
                #{tag}
              </span>
            ))}
            {due && (
              <span style={{
                fontSize: 11, padding: '1px 7px', borderRadius: 999, flexShrink: 0,
                background: due.overdue ? 'var(--bad-soft)' : 'var(--surface-2)',
                color: due.overdue ? 'var(--bad-ink)' : 'var(--text-3)',
              }}>
                {due.text}
              </span>
            )}
          </div>
          {task.nextAction && (
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              → {task.nextAction}
            </p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          {(hovered || hasSubs) && hasSubs && (
            <button
              onClick={() => setExpanded(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, display: 'flex' }}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          {hovered && (
            <>
              <button
                onClick={() => onEdit(task)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, display: 'flex' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
              >
                <Edit2 size={13} />
              </button>
              <button
                onClick={() => setConfirmOpen(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, display: 'flex' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--bad)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Subtasks */}
      {expanded && hasSubs && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px 10px 44px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {task.subtasks.map(st => (
            <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={st.done}
                onChange={() => toggleSubtask(st.id)}
                style={{ width: 14, height: 14, accentColor: 'var(--brand)', cursor: 'pointer', flexShrink: 0 }}
              />
              <span style={{ fontSize: 12.5, color: st.done ? 'var(--text-3)' : 'var(--text-2)', textDecoration: st.done ? 'line-through' : 'none' }}>
                {st.title}
              </span>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        message="Delete this task?"
        onConfirm={doDelete}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  )
}

export default function TasksPage() {
  const { tasks } = useAppStore()
  const refresh = useRefreshData()
  const [modal, setModal] = useState<{ open: boolean; task?: Task; priority?: TaskPriority }>({ open: false })
  const [showDone, setShowDone] = useState(false)

  const pending = useMemo(() => tasks.filter(t => t.status === 'pending'), [tasks])
  const done    = useMemo(() => tasks.filter(t => t.status === 'done')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')), [tasks])

  const grouped = useMemo(() => {
    const map = new Map<TaskPriority, Task[]>()
    for (const p of PRIORITY_ORDER) map.set(p, [])
    for (const t of pending) {
      map.get(t.priority)!.push(t)
    }
    return map
  }, [pending])

  return (
    <AppShell title="Tasks">
      <div className="anim-page" style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
              {pending.length} pending · {done.length} completed
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={() => setModal({ open: true })}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} />
            New task
          </button>
        </div>

        {/* Priority groups */}
        {PRIORITY_ORDER.map(priority => {
          const group = grouped.get(priority)!
          const meta = PRIORITY_META[priority]
          if (group.length === 0) return null
          return (
            <div key={priority}>
              {/* Group header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <CircleDot size={13} style={{ color: meta.color }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  {meta.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-4)', background: 'var(--surface-2)', padding: '1px 7px', borderRadius: 999 }}>
                  {group.length}
                </span>
                <button
                  onClick={() => setModal({ open: true, priority })}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-2)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-4)')}
                >
                  <Plus size={12} /> Add
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onEdit={t => setModal({ open: true, task: t })}
                    onDeleted={refresh}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {/* Empty state */}
        {pending.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>All clear — no pending tasks.</p>
            <button className="btn-primary" onClick={() => setModal({ open: true })}>
              <Plus size={13} /> Add first task
            </button>
          </div>
        )}

        {/* Completed section */}
        {done.length > 0 && (
          <div>
            <button
              onClick={() => setShowDone(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: 8 }}
            >
              {showDone ? <ChevronUp size={13} style={{ color: 'var(--text-3)' }} /> : <ChevronDown size={13} style={{ color: 'var(--text-3)' }} />}
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                Completed
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-4)', background: 'var(--surface-2)', padding: '1px 7px', borderRadius: 999 }}>
                {done.length}
              </span>
            </button>
            {showDone && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {done.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onEdit={t => setModal({ open: true, task: t })}
                    onDeleted={refresh}
                  />
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {modal.open && (
        <TaskModal
          task={modal.task}
          defaultPriority={modal.priority}
          onClose={() => setModal({ open: false })}
        />
      )}
    </AppShell>
  )
}
