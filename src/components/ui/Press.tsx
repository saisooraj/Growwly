'use client'

import { useState, ReactNode, ElementType, ComponentPropsWithoutRef } from 'react'

type PressProps<T extends ElementType = 'div'> = {
  as?: T
  scale?: number
  children: ReactNode
  style?: React.CSSProperties
  className?: string
  disabled?: boolean
} & Omit<ComponentPropsWithoutRef<T>, 'style' | 'className' | 'children'>

export default function Press<T extends ElementType = 'div'>({
  as, scale = 0.96, children, style, className, disabled, onClick, ...rest
}: PressProps<T>) {
  const [down, setDown] = useState(false)
  const El = (as ?? 'div') as ElementType

  return (
    <El
      className={className}
      onClick={disabled ? undefined : onClick}
      onPointerDown={() => { if (!disabled) setDown(true) }}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      onPointerCancel={() => setDown(false)}
      style={{
        transition: 'transform .14s cubic-bezier(.2,.8,.2,1), opacity .14s',
        transform: down ? `scale(${scale})` : 'scale(1)',
        opacity: down ? 0.88 : 1,
        cursor: disabled ? 'default' : 'pointer',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
        ...style,
      }}
      {...rest}
    >
      {children}
    </El>
  )
}
