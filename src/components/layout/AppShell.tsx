'use client'

import { useEffect } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileNav from './MobileNav'
import AuthGuard from '@/components/ui/AuthGuard'
import { useAppStore } from '@/store/appStore'

interface Props {
  title?: string
  children: React.ReactNode
}

// Maps accent names → CSS overrides for brand tokens.
// The green default is handled by :root in globals.css;
// other accents are applied via data-accent attribute.
const ACCENT_ATTRS: Record<string, string> = {
  green:  'green',
  purple: 'purple',
  orange: 'orange',
  pink:   'pink',
}

export default function AppShell({ title, children }: Props) {
  const settings = useAppStore(s => s.settings)

  // Apply accent color as a data attribute on <html> so the CSS
  // selectors in globals.css (:root[data-accent="..."]) take effect.
  useEffect(() => {
    const accent = settings?.accentColor ?? 'green'
    const attr = ACCENT_ATTRS[accent] ?? 'green'
    if (attr === 'green') {
      document.documentElement.removeAttribute('data-accent')
    } else {
      document.documentElement.setAttribute('data-accent', attr)
    }
  }, [settings?.accentColor])

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
