'use client'

import { useState, useEffect, useRef } from 'react'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, CATEGORY_EMOJI } from '@/lib/utils'

// ── Emoji palette ─────────────────────────────────────────────────────────────
const EMOJI_PALETTE = [
  // Food & Drink
  '🍕','🍔','🌮','🍜','🍣','🥗','🥪','🥘','🍱','🍰','🧁','🍩','☕','🥤','🧃','🍺','🍷',
  // Transport
  '🚗','🚕','🚌','🚂','✈️','🛵','🚲','🛺','⛽','🚢','🚁',
  // Shopping & Style
  '🛍️','👗','👟','👜','💄','⌚','📦','🏷️','🎁',
  // Entertainment & Leisure
  '🎬','🎮','🎵','🎸','🎭','🎲','⚽','🏀','🎯','🏋️','🧘','🏊',
  // Home & Life
  '🏠','🏢','🛁','🔧','💡','🛋️','🧹','🌱','🐶','🐱',
  // Health & Wellness
  '💊','🏥','🩺','💉','🧬','❤️','🦷','👓',
  // Finance & Work
  '💰','💳','📈','💎','🥇','🏦','💼','📊','💻','📱','📚','🎓','🖥️',
  // People & Social
  '🎊','🤝','👶','💍','🏖️','🌍','✈️',
  // Nature & Elements
  '🌿','🌊','⚡','🌞','🔥','❄️','🌈',
  // Misc
  '⭐','🔑','📷','🎀','🧧','🪴','🏆','🎪',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function isEmojiChar(str: string) {
  // Matches emoji (any char with code point > 0xFF, roughly)
  return str.length > 0 && str.codePointAt(0)! > 255
}

/** Parse "🍕 Pizza" → { emoji: "🍕", name: "Pizza" } */
function parseCustomValue(val: string): { emoji: string; name: string } {
  if (!val) return { emoji: '', name: '' }
  const spaceIdx = val.indexOf(' ')
  if (spaceIdx > 0) {
    const maybEmoji = val.slice(0, spaceIdx)
    if (isEmojiChar(maybEmoji)) {
      return { emoji: maybEmoji, name: val.slice(spaceIdx + 1) }
    }
  }
  return { emoji: '', name: val }
}

/** Build the stored value from emoji + name */
function buildValue(emoji: string, name: string) {
  return emoji ? `${emoji} ${name}` : name
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  value: string
  onChange: (v: string) => void
  type: 'expense' | 'income'
}

export default function CategoryPicker({ value, onChange, type }: Props) {
  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const isPredefined = cats.includes(value)

  const [showCustom, setShowCustom]       = useState(!isPredefined && value !== '')
  const [showEmojiGrid, setShowEmojiGrid] = useState(false)
  const [emoji, setEmoji]                 = useState(() => parseCustomValue(value).emoji)
  const [name, setName]                   = useState(() => parseCustomValue(value).name)
  const nameRef = useRef<HTMLInputElement>(null)

  // Keep emoji/name in sync when an existing custom value is passed in (edit mode)
  useEffect(() => {
    if (!isPredefined && value) {
      const parsed = parseCustomValue(value)
      setEmoji(parsed.emoji)
      setName(parsed.name)
      setShowCustom(true)
    }
  }, [])

  // Focus name input when custom mode activates
  useEffect(() => {
    if (showCustom) nameRef.current?.focus()
  }, [showCustom])

  // When type changes, reset to first predefined if not in custom mode
  useEffect(() => {
    if (!cats.includes(value) && !showCustom) {
      onChange(cats[0])
    }
  }, [type])

  function selectPredefined(cat: string) {
    setShowCustom(false)
    setShowEmojiGrid(false)
    onChange(cat)
  }

  function activateCustom() {
    setShowCustom(true)
    setShowEmojiGrid(false)
    setEmoji('')
    setName('')
    onChange('')
  }

  function handleNameChange(n: string) {
    setName(n)
    onChange(buildValue(emoji, n))
  }

  function handleEmojiSelect(e: string) {
    setEmoji(e)
    setShowEmojiGrid(false)
    onChange(buildValue(e, name))
    nameRef.current?.focus()
  }

  function handleEmojiClear() {
    setEmoji('')
    setShowEmojiGrid(false)
    onChange(buildValue('', name))
  }

  const isActive = (cat: string) => !showCustom && value === cat

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Predefined chips */}
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
              cursor: 'pointer', transition: 'all .12s', whiteSpace: 'nowrap',
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
            cursor: 'pointer', transition: 'all .12s', whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: 13 }}>✏️</span>
          Custom
        </button>
      </div>

      {/* Custom mode: emoji button + name input */}
      {showCustom && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Emoji selector button */}
            <button
              type="button"
              onClick={() => setShowEmojiGrid(v => !v)}
              title="Pick an emoji"
              style={{
                flexShrink: 0, width: 44, height: 44, borderRadius: 10,
                border: `1.5px solid ${showEmojiGrid ? 'var(--brand)' : 'var(--border)'}`,
                background: showEmojiGrid ? 'var(--brand-soft)' : 'var(--surface-2)',
                cursor: 'pointer', fontSize: 22, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                transition: 'all .12s',
              }}
            >
              {emoji || <span style={{ fontSize: 18, color: 'var(--text-4)' }}>?</span>}
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

          {/* Inline emoji grid */}
          {showEmojiGrid && (
            <div style={{
              padding: 12, borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              boxShadow: 'var(--shadow-lg)',
            }}>
              {/* Clear selection */}
              {emoji && (
                <button
                  type="button"
                  onClick={handleEmojiClear}
                  style={{
                    marginBottom: 8, fontSize: 11, color: 'var(--text-3)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  }}
                >
                  ✕ Remove emoji
                </button>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {EMOJI_PALETTE.map((e, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleEmojiSelect(e)}
                    title={e}
                    style={{
                      width: 36, height: 36, borderRadius: 8, fontSize: 20,
                      border: `1.5px solid ${emoji === e ? 'var(--brand)' : 'transparent'}`,
                      background: emoji === e ? 'var(--brand-soft)' : 'transparent',
                      cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      transition: 'background .1s',
                    }}
                    onMouseEnter={e2 => (e2.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e2 => (e2.currentTarget.style.background = emoji === e ? 'var(--brand-soft)' : 'transparent')}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
