'use client'

interface Props {
  progress: number // 0-1
  label?: string
}

export function ProgressBar({ progress, label }: Props) {
  const pct = Math.max(0, Math.min(1, progress)) * 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-2)' }}>
          <span>{label}</span>
          <span style={{ fontWeight: 700, color: 'var(--text)' }}>{Math.round(pct)}%</span>
        </div>
      )}
      <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'var(--brand)',
            borderRadius: 999,
            transition: 'width .2s ease',
          }}
        />
      </div>
    </div>
  )
}
