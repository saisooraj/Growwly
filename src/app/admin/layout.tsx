'use client'

import { usePathname } from 'next/navigation'
import AdminShell from '@/components/admin/AdminShell'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Login page must NOT be wrapped in AdminShell (would cause a redirect loop)
  if (pathname === '/admin/login') return <>{children}</>
  return <AdminShell>{children}</AdminShell>
}
