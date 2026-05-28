'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, GripVertical } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import { addTask, updateTask } from '@/lib/firestore'
import type { Task, TaskPriority, Subtask } from '@/types'
import toast from 'react-hot-toast'

const PRIORITIES: { value: TaskPriority; label: string; color: string; soft: string }[] = [
  { value: 'immediate', label: 'Immediate',  color: 'var(--bad)',  soft: 'var(--bad-soft)'  },
  { value: 'this-week', label: 'This Week',  color: 'var(--warn)', soft: 'var(--warn-soft)' },
  { value: 'later',     label: 'Later',      color: 'var(--good)', soft: 'var(--good-soft)' },
  { value: 'someday',   label: 'Someday',    color: 'var(--text-3)', soft: 'var(--surface-2)' },
]

function nanoid() {
  return Math.random().toString(36).slice(2, 10)
}

interface Props {
  task?: Task | null
  defaultPriority?: TaskPriority
  onClose: () => void
}

export default function TaskModal({ task, defaultPriority = 'this-week', onClose }: Props) {
  const { user } = useAuth()
  const refresh = useRefreshData()
  const isEditing = !!task

  const [title, setTitle]           = useState(task?.title ?? '')
  const [nextAction, setNextAction] = useState(task?.nextAction ?? '')
  const [dueDate, setDueDate]       = useState(task?.dueDate ?? '')
  const [priority, setPriority]     = useState<TaskPriority>(task?.priority ?? defaultPriority)
  const [tags, setTags]             = useState<string[]>(task?.tags ?? [])
  const [tagInput, setTagInput]     = useState('')
  const [subtasks, setSubtasks]     = useState<Subtask[]>(task?.subtasks ?? [])
  const [subtaskInput, setSubtaskInput] = useState('')
  const [saving, setSaving]         = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)
  useEffect(() => { titleRef.current?.focus() }, [])

  function addTag() {
    const val = tagInput.trim().toLowerCase()
    if (val && !tags.includes(val)) setTags(t => [...t, val])
    setTagInput('')
  }

  function removeTag(tag: string) {
    setTags(t => t.filter(x => x !== tag))
  }

  function addSubtask() {
    const val = subtaskInput.trim()
    if (!val) return
    setSubtasks(s => [...s, { id: nanoid(), title: val, done: false }])
    setSubtaskInput('')
  }

  function toggleSubtask(id: string) {
    setSubtasks(s => s.map(st => st.id === id ? { ...st, done: !st.done } : st))
  }

  function removeSubtask(id: string) {
    setSubtasks(s => s.filter(st => st.id !== id))
  }

  async function handleSave() {
    if (!user || !title.trim()) return
    setSaving(true)
    try {
      // Firestore rejects undefined values — build payload with only defined fields
      const payload: Record<string, unknown> = {
        title: title.trim(),
        priority,
        status: task?.status ?? 'pending',
        tags,
        subtasks,
      }
      if (nextAction.trim())    payload.nextAction   = nextAction.trim()
      if (dueDate)              payload.dueDate      = dueDate
      if (task?.completedAt)    payload.completedAt  = task.completedAt

      if (isEditing) {
        await updateTask(task!.id, payload)
        toast.success('Task updated')
      } else {
        await addTask(user.uid, payload as Omit<import('@/types').Task, 'id' | 'userId' | 'createdAt'>)
        toast.success('Task added')
      }
      await refresh()
      onClose()
    } catch (err) {
      console.error('Task save error:', err)
      toast.error('Failed to save task')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 20,
        border: '1px solid var(--border)',
        width: '100%', maxWidth: 520,
        boxShadow: 'var(--shadow-lg)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '90vh', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
            {isEditing ? 'Edit task' : 'New task'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Title */}
          <div>
            <label className="label">Task *</label>
            <input
              ref={titleRef}
              className="input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>

          {/* Next action */}
          <div>
            <label className="label">Next action</label>
            <input
              className="input"
              value={nextAction}
              onChange={e => setNextAction(e.target.value)}
              placeholder="Concrete next step…"
            />
          </div>

          {/* Priority + Due date row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Priority</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {PRIORITIES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', borderRadius: 8, border: 'none',
                      background: priority === p.value ? p.soft : 'transparent',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'background .1s',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: priority === p.value ? 'var(--text)' : 'var(--text-2)', fontWeight: priority === p.value ? 500 : 400 }}>
                      {p.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Due date</label>
              <input
                type="date"
                className="input"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="label">Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: tags.length ? 8 : 0 }}>
              {tags.map(tag => (
                <span key={tag} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 12, padding: '3px 8px', borderRadius: 999,
                  background: 'var(--brand-soft)', color: 'var(--brand-ink)',
                }}>
                  #{tag}
                  <button onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit', opacity: .7 }}>
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
            <input
              className="input"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
              placeholder="Type tag and press Enter"
            />
          </div>

          {/* Subtasks */}
          <div>
            <label className="label">Checklist</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: subtasks.length ? 8 : 0 }}>
              {subtasks.map(st => (
                <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <GripVertical size={13} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
                  <input
                    type="checkbox"
                    checked={st.done}
                    onChange={() => toggleSubtask(st.id)}
                    style={{ width: 15, height: 15, accentColor: 'var(--brand)', flexShrink: 0, cursor: 'pointer' }}
                  />
                  <span style={{ flex: 1, fontSize: 13, color: st.done ? 'var(--text-3)' : 'var(--text)', textDecoration: st.done ? 'line-through' : 'none' }}>
                    {st.title}
                  </span>
                  <button onClick={() => removeSubtask(st.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 2 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={subtaskInput}
                onChange={e => setSubtaskInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask() } }}
                placeholder="Add checklist item…"
              />
              <button
                onClick={addSubtask}
                className="btn"
                style={{ flexShrink: 0, padding: '8px 10px' }}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={!title.trim() || saving}
          >
            {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add task'}
          </button>
        </div>
      </div>
    </div>
  )
}
