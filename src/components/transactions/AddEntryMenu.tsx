'use client'

import { useEffect, useRef } from 'react'
import { Pencil, Camera, ScanLine, Plus } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onManual: () => void
  onScan: () => void
  anchor: React.ReactNode
  placement?: 'up' | 'down'
  variant?: 'list' | 'icons'
}

export function AddEntryMenu({ open, onClose, onManual, onScan, anchor, placement = 'down', variant = 'list' }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open, onClose])

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 70,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 18,
    boxShadow: '0 12px 28px rgba(0,0,0,.22)',
    overflow: 'hidden',
  }

  if (variant === 'icons') {
    panelStyle.left = '50%'
    panelStyle.transform = 'translateX(-50%)'
    panelStyle.padding = '16px 18px'
    panelStyle.display = 'flex'
    panelStyle.gap = 22
  } else {
    panelStyle.right = 0
    panelStyle.minWidth = 208
  }

  if (placement === 'up') {
    panelStyle.bottom = '100%'
    panelStyle.marginBottom = 10
  } else {
    panelStyle.top = '100%'
    panelStyle.marginTop = 10
  }

  const rowStyle: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
    padding: '11px 14px', background: 'transparent', border: 'none',
    cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--text)',
    fontFamily: 'inherit', textAlign: 'left',
  }
  const iconWrapStyle: React.CSSProperties = {
    width: 26, height: 26, borderRadius: 8, flexShrink: 0,
    background: 'var(--brand-soft)', color: 'var(--brand-ink)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  const iconColStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
    background: 'transparent', border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', padding: 2, width: 62,
  }
  const iconBubbleStyle: React.CSSProperties = {
    width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
    background: 'var(--brand-soft)', color: 'var(--brand-ink)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'transform .12s ease',
  }
  const iconLabelStyle: React.CSSProperties = {
    fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap',
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      {anchor}
      {open && variant === 'icons' && (
        <div style={panelStyle}>
          <button
            type="button"
            onClick={() => { onClose(); onScan() }}
            style={iconColStyle}
            onPointerDown={e => (e.currentTarget.querySelector('span')!.style.transform = 'scale(0.92)')}
            onPointerUp={e => (e.currentTarget.querySelector('span')!.style.transform = 'scale(1)')}
            onPointerLeave={e => (e.currentTarget.querySelector('span')!.style.transform = 'scale(1)')}
          >
            <span style={iconBubbleStyle}><ScanLine size={20} /></span>
            <span style={iconLabelStyle}>Scan</span>
          </button>
          <button
            type="button"
            onClick={() => { onClose(); onManual() }}
            style={iconColStyle}
            onPointerDown={e => (e.currentTarget.querySelector('span')!.style.transform = 'scale(0.92)')}
            onPointerUp={e => (e.currentTarget.querySelector('span')!.style.transform = 'scale(1)')}
            onPointerLeave={e => (e.currentTarget.querySelector('span')!.style.transform = 'scale(1)')}
          >
            <span style={iconBubbleStyle}><Plus size={22} /></span>
            <span style={iconLabelStyle}>Add</span>
          </button>
        </div>
      )}
      {open && variant === 'list' && (
        <div style={panelStyle}>
          <button
            type="button"
            onClick={() => { onClose(); onManual() }}
            style={rowStyle}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={iconWrapStyle}><Pencil size={14} /></span>
            Add Manually
          </button>
          <div style={{ height: 1, background: 'var(--border)' }} />
          <button
            type="button"
            onClick={() => { onClose(); onScan() }}
            style={rowStyle}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={iconWrapStyle}><Camera size={14} /></span>
            Scan / Upload Bill
          </button>
        </div>
      )}
    </div>
  )
}
