'use client'

import { CategoryIcon, getCategoryDisplayName } from '@/lib/categoryIcons'
import { CATEGORY_COLORS } from '@/lib/utils'

interface Props {
  categories: string[]
  checked: Set<string> | 'all'
  onToggle: (category: string) => void
  onSelectAll: () => void
  onSelectNone: () => void
}

export default function CategoryChecklist({ categories, checked, onToggle, onSelectAll, onSelectNone }: Props) {
  const isChecked = (cat: string) => checked === 'all' || checked.has(cat)
  const checkedCount = checked === 'all' ? categories.length : checked.size

  return (
    <div className="card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>Categories</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{checkedCount} of {categories.length} shown</div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={onSelectAll} className="btn btn-sm btn-ghost pressable" style={{ padding: '4px 9px', fontSize: 11 }}>All</button>
          <button onClick={onSelectNone} className="btn btn-sm btn-ghost pressable" style={{ padding: '4px 9px', fontSize: 11 }}>None</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
        {categories.map(cat => {
          const on = isChecked(cat)
          const color = CATEGORY_COLORS[cat] ?? '#94a3b8'
          return (
            <button
              key={cat}
              onClick={() => onToggle(cat)}
              className="pressable"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 7px', borderRadius: 9, width: '100%',
                background: 'transparent', border: 'none', cursor: 'pointer',
                textAlign: 'left', fontFamily: 'inherit', opacity: on ? 1 : 0.45,
                transition: 'opacity .15s, background .12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{
                width: 15, height: 15, borderRadius: 5, flexShrink: 0,
                border: `1.5px solid ${on ? color : 'var(--border-strong)'}`,
                background: on ? color : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background .15s, border-color .15s',
              }}>
                {on && <span style={{ width: 5, height: 5, borderRadius: 1.5, background: '#fff' }} />}
              </span>
              <CategoryIcon category={cat} size={14} color={color} />
              <span style={{
                flex: 1, fontSize: 12.5, color: 'var(--text-2)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {getCategoryDisplayName(cat)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
