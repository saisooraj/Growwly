'use client'

import { useEffect, useRef } from 'react'
import type { AnimationItem } from 'lottie-web'
import drop from './lottie/loading-drop.json'

// "Loading drop" by LottieFiles (lottiefiles.com/6607-loading-drop): a drop falling into
// ripples. The animation ships in black; it is tinted to the container's CSS `color` so it can
// be white on the net worth hero and brand-coloured elsewhere. The player (lottie-web's light
// SVG build) is loaded on first use, not bundled into every page.

// Resolve any CSS colour (including oklch and var()-derived ones) to 0–1 RGB for Lottie
function toLottieRgb(cssColor: string): [number, number, number] {
  try {
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return [0, 0, 0]
    ctx.fillStyle = cssColor
    ctx.fillRect(0, 0, 1, 1)
    const px = ctx.getImageData(0, 0, 1, 1).data
    return [px[0] / 255, px[1] / 255, px[2] / 255]
  } catch { return [0, 0, 0] }
}

// Copy of the animation with every fill and stroke set to one colour
function tinted(rgb: [number, number, number]): unknown {
  const walk = (o: unknown): unknown => {
    if (Array.isArray(o)) return o.map(walk)
    if (!o || typeof o !== 'object') return o
    const node = o as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node)) out[k] = walk(v)
    if ((node.ty === 'fl' || node.ty === 'st') && node.c && typeof node.c === 'object') {
      out.c = { ...(node.c as object), k: [...rgb, 1] }
    }
    return out
  }
  return walk(drop)
}

export default function LoadingDrop({ size = 56, label = 'Loading', style }: {
  size?: number
  label?: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let anim: AnimationItem | null = null
    let cancelled = false
    import('lottie-web/build/player/lottie_light').then(({ default: lottie }) => {
      const el = ref.current
      if (cancelled || !el) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      anim = lottie.loadAnimation({
        container: el,
        renderer: 'svg',
        loop: !reduced,
        autoplay: !reduced,
        animationData: tinted(toLottieRgb(getComputedStyle(el).color)),
      })
      // Reduced motion: hold a single frame with the drop mid-fall
      if (reduced) anim.goToAndStop(20, true)
    }).catch(() => {})
    return () => { cancelled = true; anim?.destroy() }
  }, [])

  return (
    <div
      ref={ref}
      role="status"
      aria-label={label}
      style={{ width: size, height: size, flex: 'none', ...style }}
    />
  )
}
