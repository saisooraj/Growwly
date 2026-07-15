import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySession } from '@/lib/adminSession'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'saisoorajpnair@gmail.com'

// Routes that are allowed without a valid admin session
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login'])
const PUBLIC_API_PATHS = new Set(['/api/admin/session'])

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isAdminPage = pathname.startsWith('/admin')
  const isAdminApi = pathname.startsWith('/api/admin')

  if (!isAdminPage && !isAdminApi) return NextResponse.next()

  // Allow the login page and session-creation endpoint through
  if (PUBLIC_ADMIN_PATHS.has(pathname) || PUBLIC_API_PATHS.has(pathname)) {
    return NextResponse.next()
  }

  const sessionCookie = req.cookies.get(SESSION_COOKIE)?.value ?? ''
  const session = sessionCookie ? await verifySession(sessionCookie) : null

  // Double-check email even though it's already in the signed payload
  if (!session || session.email !== ADMIN_EMAIL) {
    if (isAdminApi) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        {
          status: 401,
          headers: {
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        }
      )
    }
    const loginUrl = new URL('/admin/login', req.url)
    if (pathname !== '/admin') loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Attach email to a read-only header so route handlers can use it
  const res = NextResponse.next()
  res.headers.set('x-admin-email', session.email)
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  return res
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
