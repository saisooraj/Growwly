'use client'

interface Props {
  progress?: number // 0-1, ignored when indeterminate
  label?: string
  indeterminate?: boolean
}

export function ProgressBar({ progress = 0, label, indeterminate }: Props) {
  const pct = Math.max(0, Math.min(1, progress)) * 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-2)' }}>
          <span>{label}</span>
          {!indeterminate && <span style={{ fontWeight: 700, color: 'var(--text)' }}>{Math.round(pct)}%</span>}
        </div>
      )}
      <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden', position: 'relative' }}>
        {indeterminate ? (
          <>
            <style>{`@keyframes gw-progress-indeterminate { 0% { left: -40%; } 100% { left: 100%; } }`}</style>
            <div style={{
              position: 'absolute', top: 0, bottom: 0, width: '40%',
              background: 'var(--brand)', borderRadius: 999,
              animation: 'gw-progress-indeterminate 1.1s ease-in-out infinite',
            }} />
          </>
        ) : (
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: 'var(--brand)',
              borderRadius: 999,
              transition: 'width .2s ease',
            }}
          />
        )}
      </div>
    </div>
  )
}
