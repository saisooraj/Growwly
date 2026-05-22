import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
      }}
    >
      <span style={{ color: 'white', fontSize: 20, fontWeight: 900 }}>G</span>
    </div>,
    { ...size }
  )
}
