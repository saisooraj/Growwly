'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// A modal centred on the screen, on phones and desktop alike. Tall content scrolls inside the
// panel; the page behind stays put.
export default function CenteredModal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  // Rendered on <body>: a page wrapper's entrance animation makes it the containing block for
  // fixed children, which would pin the overlay to the page column instead of the screen.
  return createPortal(
    <div
      role="dialog" aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
        background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)',
        touchAction: 'none', // a drag on the backdrop must not scroll the page behind
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '100%',
        overflowY: 'auto', overscrollBehavior: 'contain', touchAction: 'pan-y', padding: 24,
      }}>
        {children}
      </div>
    </div>,
    document.body
  )
}
