import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: 180,
        height: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #16a34a 0%, #0d6b2e 100%)',
        borderRadius: 40,
      }}
    >
      {/* Sprout: stem + two leaves */}
      <div style={{ display: 'flex', position: 'relative', width: 90, height: 100 }}>
        {/* Stem */}
        <div style={{
          position: 'absolute', bottom: 0, left: '50%',
          width: 10, height: 56,
          background: 'rgba(255,255,255,0.9)',
          borderRadius: 8,
          transform: 'translateX(-50%)',
        }} />
        {/* Left leaf */}
        <div style={{
          position: 'absolute', bottom: 26, left: 2,
          width: 44, height: 44,
          background: 'rgba(255,255,255,0.95)',
          borderRadius: '50% 50% 0 50%',
          transform: 'rotate(-30deg)',
        }} />
        {/* Right leaf */}
        <div style={{
          position: 'absolute', bottom: 40, right: 2,
          width: 44, height: 44,
          background: 'rgba(255,255,255,0.95)',
          borderRadius: '50% 50% 50% 0',
          transform: 'rotate(30deg)',
        }} />
      </div>
    </div>,
    { ...size }
  )
}
