'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { useAppStore } from '@/store/appStore'

interface Props {
  value: string[]
  onChange: (tags: string[]) => void
}

export default function TagPicker({ value, onChange }: Props) {
  const customTags = useAppStore(s => s.settings?.customTags ?? [])
  const [input, setInput] = useState('')

  const suggestions = customTags.filter(t => !value.includes(t))

  function toggle(tag: string) {
    onChange(value.includes(tag) ? value.filter(t => t !== tag) : [...value, tag])
  }

  function addFromInput() {
    const t = input.trim()
    if (!t) return
    if (!value.includes(t)) onChange([...value, t])
    setInput('')
  }

  function remove(tag: string) {
    onChange(value.filter(t => t !== tag))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {value.map(tag => (
            <span
              key={tag}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 8px 4px 10px', borderRadius: 20,
                border: '1.5px solid var(--brand)', background: 'var(--brand-soft)',
                color: 'var(--brand-ink)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
              }}
            >
              #{tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--brand-ink)', padding: 0 }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {suggestions.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              style={{
                padding: '4px 10px', borderRadius: 20,
                border: '1.5px solid var(--border)', background: 'var(--surface-2)',
                color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          className="input"
          placeholder="Add a tag, e.g. Christmas…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); addFromInput() }
          }}
          style={{ flex: 1, fontSize: 12.5, padding: '6px 10px' }}
        />
        <button
          type="button"
          onClick={addFromInput}
          disabled={!input.trim()}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
            padding: '6px 12px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--surface-2)',
            color: 'var(--text-2)', fontSize: 12, fontWeight: 600,
            cursor: input.trim() ? 'pointer' : 'default', opacity: input.trim() ? 1 : 0.5,
          }}
        >
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  )
}
