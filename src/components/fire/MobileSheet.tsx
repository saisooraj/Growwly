'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { SlidersHorizontal } from 'lucide-react'
import { MONO } from './shared'

interface Props {
  open: boolean
  onOpen: () => void
  onClose: () => void
  /** Live answer, e.g. "FI in 16.8 yrs · age 44" */
  mini: string
  barNote: string
  saveState: 'idle' | 'saving' | 'saved'
  children: ReactNode
}

/**
 * Phones: a bar above the tab bar opens "Your numbers & assumptions" in a bottom sheet.
 * The sheet header keeps the live answer in view while you edit. Close with Done, the
 * scrim, or a downward swipe on the header.
 */
export default function MobileSheet({ open, onOpen, onClose, mini, barNote, saveState, children }: Props) {
  const [mounted, setMounted] = useState(false)
  const [drag, setDrag] = useState(0)
  const y0 = useRef<number | null>(null)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!mounted) return null

  return createPortal(
    <>
      {!open && (
        <div style={{
          position: 'fixed', zIndex: 45, left: 'max(14px, env(safe-area-inset-left, 0px))', right: 76,
          bottom: 'calc(max(20px, env(safe-area-inset-bottom, 0px)) + 74px)',
        }}>
          <button type="button" onClick={onOpen}
            style={{
              width: '100%', minHeight: 50, borderRadius: 18, border: 0, background: 'var(--text)', color: 'var(--bg)', fontSize: 14.5, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', boxShadow: 'var(--elev-lg)', cursor: 'pointer', fontFamily: 'inherit',
            }}>
            <SlidersHorizontal size={16} style={{ flex: 'none' }} />
            <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Your numbers &amp; assumptions</span>
            <span style={{ font: `500 11.5px/1 ${MONO}`, opacity: 0.75, whiteSpace: 'nowrap' }}>{barNote}</span>
          </button>
        </div>
      )}

      {open && (
        <>
          <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 119, background: 'rgba(20,21,26,.35)' }} />
          <div role="dialog" aria-modal="true" aria-label="Your numbers and assumptions" className="fire-sheet-body"
            style={{
              position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 120, height: '85dvh', overflowY: 'auto',
              background: 'var(--bg)', borderRadius: '24px 24px 0 0', boxShadow: '0 -12px 40px -12px rgba(24,20,48,.35)',
              display: 'flex', flexDirection: 'column', gap: 12, padding: '0 12px calc(28px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box',
              transform: drag > 0 ? `translateY(${drag}px)` : undefined, transition: drag > 0 ? 'none' : 'transform .25s cubic-bezier(.22,1,.36,1)',
            }}>
            <div
              onTouchStart={e => { y0.current = e.touches[0].clientY }}
              onTouchMove={e => { if (y0.current != null) setDrag(Math.max(0, e.touches[0].clientY - y0.current)) }}
              onTouchEnd={() => { if (drag > 90) onClose(); setDrag(0); y0.current = null }}
              style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)', padding: '10px 4px 12px', display: 'flex', flexDirection: 'column', gap: 10, touchAction: 'none' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)', alignSelf: 'center' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 17, fontWeight: 700 }}>Your numbers</span>
                  <span aria-live="polite" style={{ alignSelf: 'flex-start', fontSize: 12.5, fontWeight: 700, color: 'var(--brand-ink)', background: 'var(--brand-soft)', padding: '4px 8px', borderRadius: 999 }}>{mini} · live</span>
                </div>
                {saveState === 'saving' && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Saving…</span>}
                {saveState === 'saved' && <span style={{ fontSize: 12, color: 'var(--good-ink)', fontWeight: 600 }}>✓ Saved</span>}
                <button type="button" onClick={onClose}
                  style={{ minHeight: 40, padding: '0 16px', borderRadius: 12, border: 0, background: 'var(--text)', color: 'var(--bg)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Done
                </button>
              </div>
            </div>
            {children}
          </div>
        </>
      )}
    </>,
    document.body,
  )
}
