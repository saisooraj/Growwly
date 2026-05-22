import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#06030F',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://growwly-v1.vercel.app/logo.png"
        alt="Growwly"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>,
    { ...size }
  )
}
