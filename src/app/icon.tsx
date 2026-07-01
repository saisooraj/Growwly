import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

const SVG = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#16a34a"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="7" fill="url(#g)"/>
  <g transform="translate(6 6) scale(0.833)" fill="none" stroke="white" stroke-opacity="0.95" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
  </g>
</svg>`)

export default function Icon() {
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`data:image/svg+xml,${SVG}`} width={32} height={32} alt="" />,
    { ...size }
  )
}
