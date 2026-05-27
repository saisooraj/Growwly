import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #16a34a 0%, #0d6b2e 100%)',
        borderRadius: 8,
      }}
    >
      {/* Sprout: stem + two leaves */}
      <div style={{ display: 'flex', position: 'relative', width: 18, height: 20 }}>
        {/* Stem */}
        <div style={{
          position: 'absolute', bottom: 0, left: '50%',
          width: 2, height: 12,
          background: 'rgba(255,255,255,0.9)',
          borderRadius: 2,
          transform: 'translateX(-50%)',
        }} />
        {/* Left leaf */}
        <div style={{
          position: 'absolute', bottom: 5, left: 0,
          width: 9, height: 9,
          background: 'rgba(255,255,255,0.95)',
          borderRadius: '50% 50% 0 50%',
          transform: 'rotate(-30deg)',
        }} />
        {/* Right leaf */}
        <div style={{
          position: 'absolute', bottom: 8, right: 0,
          width: 9, height: 9,
          background: 'rgba(255,255,255,0.95)',
          borderRadius: '50% 50% 50% 0',
          transform: 'rotate(30deg)',
        }} />
      </div>
    </div>,
    { ...size }
  )
}
