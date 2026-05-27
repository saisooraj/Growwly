'use client'

import Sidebar from './Sidebar'
import Header from './Header'
import MobileNav from './MobileNav'
import AuthGuard from '@/components/ui/AuthGuard'

interface Props {
  title?: string
  children: React.ReactNode
}

export default function AppShell({ title, children }: Props) {
  return (
    <AuthGuard>
      <div className="app">
        <Sidebar />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: '100vh' }}>
          <Header title={title} />
          <main
            className="main-content"
            style={{
              flex: 1,
              background: 'var(--bg)',
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            {children}
          </main>
        </div>
        <MobileNav />
      </div>
    </AuthGuard>
  )
}
