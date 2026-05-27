'use client'

import { useState, useEffect, useRef } from 'react'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, CATEGORY_EMOJI } from '@/lib/utils'

interface Props {
  value: string
  onChange: (v: string) => void
  type: 'expense' | 'income'
}

export default function CategoryPicker({ value, onChange, type }: Props) {
  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const isPredefined = cats.includes(value)
  const [showCustom, setShowCustom] = useState(!isPredefined && value !== '')
  const customRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showCustom) customRef.current?.focus()
  }, [showCustom])

  // When type changes, reset to first predefined if current value doesn't fit
  useEffect(() => {
    if (!cats.includes(value)) {
      if (!showCustom) {
        onChange(cats[0])
      }
    }
  }, [type])

  function selectPredefined(cat: string) {
    setShowCustom(false)
    onChange(cat)
  }

  function activateCustom() {
    setShowCustom(true)
    onChange('')
  }

  const isActive = (cat: string) => !showCustom && value === cat

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {cats.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => selectPredefined(cat)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 20,
              border: `1.5px solid ${isActive(cat) ? 'var(--brand)' : 'var(--border)'}`,
              background: isActive(cat) ? 'var(--brand-soft)' : 'var(--surface-2)',
              color: isActive(cat) ? 'var(--brand-ink)' : 'var(--text-2)',
              fontSize: 12.5, fontWeight: isActive(cat) ? 600 : 400,
              cursor: 'pointer', transition: 'all .12s',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 13 }}>{CATEGORY_EMOJI[cat] ?? '📦'}</span>
            {cat}
          </button>
        ))}

        {/* Custom chip */}
        <button
          type="button"
          onClick={activateCustom}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 11px', borderRadius: 20,
            border: `1.5px solid ${showCustom ? 'var(--brand)' : 'var(--border)'}`,
            background: showCustom ? 'var(--brand-soft)' : 'var(--surface-2)',
            color: showCustom ? 'var(--brand-ink)' : 'var(--text-3)',
            fontSize: 12.5, fontWeight: showCustom ? 600 : 400,
            cursor: 'pointer', transition: 'all .12s',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: 13 }}>✏️</span>
          Custom
        </button>
      </div>

      {showCustom && (
        <input
          ref={customRef}
          type="text"
          className="input"
          placeholder="Type a category name…"
          value={value}
          onChange={e => onChange(e.target.value)}
          required
          style={{ marginTop: 2 }}
        />
      )}
    </div>
  )
}
