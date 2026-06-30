import { useState, useEffect, useRef } from 'react'

/**
 * Animates a number from 0 to `target` over `duration` ms using
 * requestAnimationFrame with an ease-out cubic curve.
 * Re-triggers automatically whenever `target` changes.
 */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0)
  const rafRef   = useRef<number>(0)
  const startRef = useRef<number | null>(null)
  const fromRef  = useRef<number>(0)

  useEffect(() => {
    if (target === 0) { setValue(0); return }

    // Always animate from whatever the current displayed value is
    fromRef.current  = 0
    startRef.current = null

    function tick(ts: number) {
      if (startRef.current === null) startRef.current = ts
      const elapsed  = ts - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic: decelerates toward the end
      const eased    = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(fromRef.current + (target - fromRef.current) * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return value
}
