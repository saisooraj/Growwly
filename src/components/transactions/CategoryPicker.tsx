'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Pencil } from 'lucide-react'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'
import {
  CategoryIcon,
  ICON_PALETTE,
  ICON_COMPONENT_MAP,
  parseCustomCategory,
  buildCustomCategory,
  getCategoryDisplayName,
} from '@/lib/categoryIcons'

const PALETTE_GROUPS = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Home', 'Health', 'Finance', 'Social', 'Misc']

interface Props {
  value: string
  onChange: (v: string) => void
  type: 'expense' | 'income'
}

export default function CategoryPicker({ value, onChange, type }: Props) {
  const customCategories = useAppStore(s => s.settings?.customCategories ?? [])
  const baseCats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  const cats = [
    ...baseCats.slice(0, -1),
    ...customCategories.filter(c => !baseCats.includes(c)),
    baseCats[baseCats.length - 1],
  ]

  const isPredefined = cats.includes(value)
  const parsed = parseCustomCategory(value)
  const isCustomValue = !isPredefined && value !== ''

  const [showCustom, setShowCustom]       = useState(isCustomValue)
  const [showIconGrid, setShowIconGrid]   = useState(false)
  const [iconName, setIconName]           = useState(() => isCustomValue ? (parsed.iconName ?? '') : '')
  const [name, setName]                   = useState(() => isCustomValue ? parsed.name : '')
  const [search, setSearch]               = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isCustomValue) {
      setIconName(parsed.iconName ?? '')
      setName(parsed.name)
      setShowCustom(true)
    }
  }, [])

  useEffect(() => {
    if (showCustom) nameRef.current?.focus()
  }, [showCustom])

  useEffect(() => {
    if (!cats.includes(value) && !showCustom) onChange(cats[0])
  }, [type])

  function selectPredefined(cat: string) {
    setShowCustom(false)
    setShowIconGrid(false)
    onChange(cat)
  }

  function activateCustom() {
    setShowCustom(true)
    setShowIconGrid(false)
    setIconName('')
    setName('')
    onChange('')
  }

  function handleNameChange(n: string) {
    setName(n)
    if (n) onChange(iconName ? buildCustomCategory(iconName, n) : n)
    else onChange('')
  }

  function handleIconSelect(iName: string) {
    setIconName(iName)
    setShowIconGrid(false)
    if (name) onChange(buildCustomCategory(iName, name))
    nameRef.current?.focus()
  }

  function handleIconClear() {
    setIconName('')
    setShowIconGrid(false)
    if (name) onChange(name)
  }

  const isActive = (cat: string) => !showCustom && value === cat

  const filteredPalette = search
    ? ICON_PALETTE.filter(p => p.label.toLowerCase().includes(search.toLowerCase()) || p.group.toLowerCase().includes(search.toLowerCase()))
    : ICON_PALETTE

  const SelectedIcon = iconName ? ICON_COMPONENT_MAP[iconName] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Category chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {cats.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => selectPredefined(cat)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 11px', borderRadius: 20,
              border: `1.5px solid ${isActive(cat) ? 'var(--brand)' : 'var(--border)'}`,
              background: isActive(cat) ? 'var(--brand-soft)' : 'var(--surface-2)',
              color: isActive(cat) ? 'var(--brand-ink)' : 'var(--text-2)',
              fontSize: 12.5, fontWeight: isActive(cat) ? 600 : 400,
              cursor: 'pointer', transition: 'all .12s', whiteSpace: 'nowrap',
            }}
          >
            <CategoryIcon category={cat} size={13} color={isActive(cat) ? 'var(--brand-ink)' : 'var(--text-3)'} />
            {getCategoryDisplayName(cat)}
          </button>
        ))}

        {/* Custom chip */}
        <button
          type="button"
          onClick={activateCustom}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 11px', borderRadius: 20,
            border: `1.5px solid ${showCustom ? 'var(--brand)' : 'var(--border)'}`,
            background: showCustom ? 'var(--brand-soft)' : 'var(--surface-2)',
            color: showCustom ? 'var(--brand-ink)' : 'var(--text-3)',
            fontSize: 12.5, fontWeight: showCustom ? 600 : 400,
            cursor: 'pointer', transition: 'all .12s', whiteSpace: 'nowrap',
          }}
        >
          <Pencil size={12} />
          Custom
        </button>
      </div>

      {/* Custom mode */}
      {showCustom && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Icon selector button */}
            <button
              type="button"
              onClick={() => setShowIconGrid(v => !v)}
              title="Pick an icon"
              style={{
                flexShrink: 0, width: 44, height: 44, borderRadius: 10,
                border: `1.5px solid ${showIconGrid ? 'var(--brand)' : 'var(--border)'}`,
                background: showIconGrid ? 'var(--brand-soft)' : 'var(--surface-2)',
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                transition: 'all .12s',
                color: showIconGrid ? 'var(--brand-ink)' : 'var(--text-3)',
              }}
            >
              {SelectedIcon
                ? <SelectedIcon size={22} color={showIconGrid ? 'var(--brand-ink)' : 'var(--text-2)'} stroke={1.5} />
                : <span style={{ fontSize: 11, color: 'var(--text-4)' }}>Icon</span>
              }
            </button>

            {/* Name input */}
            <input
              ref={nameRef}
              type="text"
              className="input"
              placeholder="Category name…"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              required
              style={{ flex: 1 }}
            />
          </div>

          {/* Icon grid */}
          {showIconGrid && (
            <div style={{
              padding: 12, borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              boxShadow: 'var(--shadow-lg)',
            }}>
              {/* Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                <Search size={13} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Search icons…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)', width: '100%' }}
                  autoFocus
                />
              </div>

              {iconName && (
                <button
                  type="button"
                  onClick={handleIconClear}
                  style={{ marginBottom: 8, fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  ✕ Remove icon
                </button>
              )}

              {/* Grouped icons */}
              {search ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {filteredPalette.map(p => {
                    const active = iconName === p.name
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => handleIconSelect(p.name)}
                        title={p.label}
                        style={{
                          width: 38, height: 38, borderRadius: 8, border: `1.5px solid ${active ? 'var(--brand)' : 'transparent'}`,
                          background: active ? 'var(--brand-soft)' : 'transparent',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: active ? 'var(--brand-ink)' : 'var(--text-2)',
                          transition: 'background .1s',
                        }}
                        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <p.Icon size={20} stroke={1.5} />
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
                  {PALETTE_GROUPS.map(group => {
                    const groupIcons = ICON_PALETTE.filter(p => p.group === group)
                    if (groupIcons.length === 0) return null
                    return (
                      <div key={group}>
                        <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{group}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {groupIcons.map(p => {
                            const active = iconName === p.name
                            return (
                              <button
                                key={p.name}
                                type="button"
                                onClick={() => handleIconSelect(p.name)}
                                title={p.label}
                                style={{
                                  width: 38, height: 38, borderRadius: 8, border: `1.5px solid ${active ? 'var(--brand)' : 'transparent'}`,
                                  background: active ? 'var(--brand-soft)' : 'transparent',
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: active ? 'var(--brand-ink)' : 'var(--text-2)',
                                  transition: 'background .1s',
                                }}
                                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                              >
                                <p.Icon size={20} stroke={1.5} />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
