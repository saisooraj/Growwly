const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  customWorkerSrc: 'src/worker',
})

const securityHeaders = [
  // Prevent clickjacking — admin cannot be embedded in any iframe
  { key: 'X-Frame-Options', value: 'DENY' },
  // Stop browsers from sniffing MIME types
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Enable XSS auditor in older browsers
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Only send the origin (no path) in Referer headers
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable camera/mic/geo — admin panel doesn't need any of these
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // HSTS — enforces HTTPS for 2 years (Vercel always serves over HTTPS)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Prevent caching of admin responses in shared/proxy caches
  { key: 'Surrogate-Control', value: 'no-store' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { domains: ['lh3.googleusercontent.com'] },
  async headers() {
    return [
      {
        // Apply strict security headers to all admin routes
        source: '/admin/:path*',
        headers: [
          ...securityHeaders,
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      {
        // API routes: no caching + stricter headers
        source: '/api/admin/:path*',
        headers: [
          ...securityHeaders,
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'Content-Type', value: 'application/json' },
        ],
      },
      {
        // Baseline headers for the rest of the app
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

module.exports = withPWA(nextConfig)
