import AdminShell from '@/components/admin/AdminShell'

// Server Component — AdminShell itself is 'use client' and handles the login bypass internally
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
