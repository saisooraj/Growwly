'use client'

import { useLayoutEffect, useRef, type InputHTMLAttributes } from 'react'

// Indian digit grouping for display only: "2323345.5" → "23,23,345.5".
// The value going in and out stays a plain number string, so nothing stored changes.
export function groupINR(raw: string): string {
  if (!raw) return ''
  const [int, dec] = raw.split('.')
  const grouped = int.length > 3
    ? int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + int.slice(-3)
    : int
  return dec !== undefined ? `${grouped}.${dec}` : grouped
}

// Typed text → plain number string: digits and one dot, at most 2 decimals, no leading zeros.
function toRaw(text: string): string {
  let s = text.replace(/[^\d.]/g, '')
  const dot = s.indexOf('.')
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '').slice(0, 2)
  return s.replace(/^0+(?=\d)/, '')
}

const significant = (s: string) => s.replace(/[^\d.]/g, '').length

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string
  onValueChange: (raw: string) => void
}

export default function AmountInput({ value, onValueChange, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  // Digits/dot to the left of the caret, so it stays put when commas shift around
  const caret = useRef<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || caret.current === null || document.activeElement !== el) return
    let seen = 0
    let pos = 0
    while (pos < el.value.length && seen < caret.current) {
      if (/[\d.]/.test(el.value[pos])) seen++
      pos++
    }
    el.setSelectionRange(pos, pos)
    caret.current = null
  })

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={groupINR(value)}
      onChange={e => {
        const before = e.target.value.slice(0, e.target.selectionStart ?? e.target.value.length)
        caret.current = significant(before)
        onValueChange(toRaw(e.target.value))
      }}
    />
  )
}
