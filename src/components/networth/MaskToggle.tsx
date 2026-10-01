'use client'

import { Eye, EyeOff } from 'lucide-react'

export default function MaskToggle({ masked, onToggle }: { masked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button" onClick={onToggle}
      aria-label={masked ? 'Show amounts' : 'Hide amounts'} title={masked ? 'Show amounts' : 'Hide amounts'}
      style={{ display: 'flex', flexShrink: 0, padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-4)' }}
    >
      {masked ? <Eye size={15} /> : <EyeOff size={15} />}
    </button>
  )
}
