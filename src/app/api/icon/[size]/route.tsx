import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(_: NextRequest, { params }: { params: { size: string } }) {
  const size = parseInt(params.size) || 192
  const radius = Math.round(size * 0.22)
  const fontSize = Math.round(size * 0.55)

  return new ImageResponse(
    <div
      style={{
        background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius,
      }}
    >
      <span style={{ color: 'white', fontSize, fontWeight: 900, lineHeight: 1 }}>G</span>
    </div>,
    { width: size, height: size }
  )
}
