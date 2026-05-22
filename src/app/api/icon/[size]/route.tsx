import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(_: NextRequest, { params }: { params: { size: string } }) {
  const size = parseInt(params.size) || 192

  return new ImageResponse(
    <div
      style={{
        width: size,
        height: size,
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
    { width: size, height: size }
  )
}
